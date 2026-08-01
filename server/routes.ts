import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { derivedFamily, derivedType, extractSubcategory } from "./storage";
import { classifyInventoryItem } from "../shared/classifyItem";
import { classifyReel, resolveReelMode } from "../shared/reelEligibility";
import { insertItemSchema, type Item, type CreateRmsExportHistory, type CreateRmsExportHistoryItem, completionReportPhotos, projects, dailyReports } from "../shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import type { Request } from "express";
import type { User } from "@shared/models/auth";

type RequestWithUser = Request & { currentUser?: User };
import { validateNewMovement, validateDraftForConfirmation } from "./services/inventory/movement-validation";
import { z } from "zod";
import { registerAuthRoutes, authStorage } from "./replit_integrations/auth";
import { isAuthenticated } from "./replit_integrations/auth/replitAuth";
import multer from "multer";
import path from "path";
import fs from "fs";
import express from "express";
import sharp from "sharp";
import crypto from "crypto";
import { uploadBuffer, downloadBuffer } from "./services/objectStorageUpload";
// ─── Upload magic-bytes validator ─────────────────────────────────────────────
// Verifies that file content matches the declared MIME type's signature.
function isImageMagicBytes(buf: Buffer, mimetype: string): boolean {
  if (buf.length < 12) return false;
  if (mimetype === "image/jpeg" || mimetype === "image/jpg") {
    return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  }
  if (mimetype === "image/png") {
    return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
        && buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a;
  }
  if (mimetype === "image/webp") {
    return buf.slice(0, 4).toString("ascii") === "RIFF"
        && buf.slice(8, 12).toString("ascii") === "WEBP";
  }
  return false;
}

// ─── RBAC middleware ─────────────────────────────────────────────────────────
// Roles: viewer < staff < manager < admin
// - viewer:  field mode, read-only
// - staff:   field mode, can do movements
// - manager: admin mode (normal pages), cannot access Admin Tools
// - admin:   full access including Admin Tools
async function requireRole(roles: string | string[], req: any, res: any, next: any) {
  const userId = req.session?.userId;
  if (!userId) return res.status(401).json({ message: "Authentication required" });
  try {
    const { authStorage } = await import("./replit_integrations/auth/storage");
    const user = await authStorage.getUser(userId);
    if (!user || user.status !== "active") return res.status(401).json({ message: "Authentication required" });
    const allowed = Array.isArray(roles) ? roles : [roles];
    if (!allowed.includes(user.role ?? "")) return res.status(403).json({ message: "Insufficient permissions" });
    (req as any).currentUser = user;
    next();
  } catch {
    res.status(500).json({ message: "Authorization check failed" });
  }
}

// Populates req.user from session without restricting by role.
async function loadCurrentUser(req: any, _res: any, next: any) {
  try {
    const userId = req.session?.userId;
    if (userId) {
      const { authStorage } = await import("./replit_integrations/auth/storage");
      const user = await authStorage.getUser(userId);
      if (user && user.status === "active") {
        req.user = user;
      }
    }
  } catch {
    // Non-fatal — route can still run
  }
  next();
}

// Admin Tools only (User Approvals, Export)
const requireAdmin       = (req: any, res: any, next: any) => requireRole("admin", req, res, next);
// Normal admin write operations (inventory CRUD, suppliers, projects, etc.)
const requireManager     = (req: any, res: any, next: any) => requireRole(["admin", "manager"], req, res, next);
// Read-only admin operations — manager_viewer can also access these GET routes
const requireManagerRead = (req: any, res: any, next: any) => requireRole(["admin", "manager", "manager_viewer"], req, res, next);
// Field operations (movements, transactions, drafts)
const requireStaff       = (req: any, res: any, next: any) => requireRole(["admin", "manager", "staff"], req, res, next);

// ─── Route param helpers ──────────────────────────────────────────────────────
function parseIntParam(val: any, name: string, res: any): number | null {
  const n = Number(val);
  if (!Number.isInteger(n) || n <= 0) {
    res.status(400).json({ message: `${name}은(는) 양의 정수여야 합니다` });
    return null;
  }
  return n;
}

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Map MIME type → safe extension (never trust originalname for extension)
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg":  ".jpg",
  "image/png":  ".png",
  "image/webp": ".webp",
};

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, file, cb) => {
      const ext = MIME_TO_EXT[file.mimetype] ?? ".jpg";
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, Object.keys(MIME_TO_EXT).includes(file.mimetype));
  },
});

// Multer for completion-report uploads — also accepts PDF (quotation only; enforced in handler)
const uploadCompletionReport = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = { ...MIME_TO_EXT, "application/pdf": ".pdf" };
    cb(null, Object.keys(allowed).includes(file.mimetype));
  },
});

function getUserId(req: any): string | null {
  return (req.session as any)?.userId ?? null;
}

function getUserDisplayName(req: any): string | null {
  const u = (req as any).currentUser;
  if (!u) return null;
  const full = [u.firstName, u.lastName].filter(Boolean).join(" ");
  return full || u.name || null;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  registerAuthRoutes(app);

  // Serve uploaded completion-report images from Object Storage (persistent across deploys)
  // Falls back to local uploadsDir for dev environments without Object Storage configured.
  const ALLOWED_UPLOAD_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
  const EXT_TO_MIME: Record<string, string> = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".png": "image/png", ".webp": "image/webp",
  };
  app.use("/uploads", async (req, res) => {
    const ext = path.extname(req.path).toLowerCase();
    if (!ALLOWED_UPLOAD_EXTS.has(ext)) return res.status(403).end();
    const filename = path.basename(req.path);
    // Try Object Storage first
    try {
      const buf = await downloadBuffer(filename);
      if (buf) {
        res.setHeader("Content-Type", EXT_TO_MIME[ext] ?? "image/jpeg");
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Content-Disposition", "inline");
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        return res.send(buf);
      }
    } catch {
      // fall through to local disk
    }
    // Fallback: local disk (dev only)
    const localPath = path.join(uploadsDir, filename);
    if (fs.existsSync(localPath)) {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Disposition", "inline");
      return res.sendFile(localPath);
    }
    return res.status(404).end();
  });

  // ─── Health ─────────────────────────────────────────────────────────────────
  app.get("/api/health", async (_req, res) => {
    try {
      const { pool } = await import("./db");
      const client = await pool.connect();
      client.release();
      res.json({ ok: true, database: "ok" });
    } catch {
      res.status(503).json({ ok: false, database: "error" });
    }
  });

  // ─── Current user ────────────────────────────────────────────────────────────
  app.get("/api/me", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const { authStorage } = await import("./replit_integrations/auth/storage");
      const user = await authStorage.getUser(userId);
      if (!user) return res.status(401).json({ message: "Not authenticated" });
      const { passwordHash: _ph, ...safe } = user as any;
      res.json(safe);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ─── Dashboard ──────────────────────────────────────────────────────────────
  app.get("/api/dashboard/stats", isAuthenticated, async (req, res) => {
    try {
      res.json(await storage.getDashboardStats());
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  app.get("/api/dashboard/monthly-trend", isAuthenticated, async (req, res) => {
    try {
      res.json(await storage.getDashboardMonthlyTrend());
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ─── Categories ─────────────────────────────────────────────────────────────
  app.get("/api/categories", isAuthenticated, async (_req, res) => {
    res.json(await storage.getCategories());
  });

  app.get("/api/inventory/categories/summary", isAuthenticated, async (_req, res) => {
    try {
      res.json(await storage.getCategorySummary());
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/inventory/category/:id/grouped", isAuthenticated, async (req, res) => {
    try {
      const data = await storage.getCategoryGrouped(Number(req.params.id));
      if (!data) return res.status(404).json({ message: "Category not found" });
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/inventory/category/:id/family-order", isAuthenticated, requireManager, async (req, res) => {
    try {
      const categoryId = parseIntParam(req.params.id, "id", res);
      if (categoryId === null) return;
      const { orders } = req.body;
      if (!Array.isArray(orders)) return res.status(400).json({ message: "orders must be an array" });
      await storage.updateFamilyGroupOrder(categoryId, orders);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/inventory/category/:id/family-header-order", isAuthenticated, requireManager, async (req, res) => {
    try {
      const categoryId = parseIntParam(req.params.id, "id", res);
      if (categoryId === null) return;
      const { orders } = req.body;
      if (!Array.isArray(orders)) return res.status(400).json({ message: "orders must be an array" });
      await storage.updateFamilyHeaderOrder(categoryId, orders);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/inventory/category/:id/classification-options", isAuthenticated, async (req, res) => {
    try {
      res.json(await storage.getClassificationOptions(Number(req.params.id)));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ─── Field Inventory API ────────────────────────────────────────────────────
  app.get("/api/field/families", isAuthenticated, async (req, res) => {
    const categoryId = req.query.category ? Number(req.query.category) : undefined;
    res.json(await storage.getFieldFamilies({ categoryId }));
  });

  app.get("/api/field/brands", isAuthenticated, async (req, res) => {
    const categoryId = req.query.category ? Number(req.query.category) : undefined;
    const family = req.query.family as string | undefined;
    res.json(await storage.getFieldBrands({ categoryId, family }));
  });

  app.get("/api/field/sizes", isAuthenticated, async (req, res) => {
    const categoryId = req.query.category ? Number(req.query.category) : undefined;
    const family = req.query.family as string | undefined;
    const type = req.query.type as string | undefined;
    const subcategory = req.query.subcategory as string | undefined;
    const status = req.query.status as string | undefined;
    const search = req.query.q as string | undefined;
    res.json(await storage.getFieldSizes({ categoryId, family, type, subcategory, status, search }));
  });

  app.get("/api/field/types", isAuthenticated, async (req, res) => {
    const categoryId = req.query.category ? Number(req.query.category) : undefined;
    const family = req.query.family as string | undefined;
    const brand = req.query.brand as string | undefined;
    res.json(await storage.getFieldTypes({ categoryId, family, brand }));
  });

  app.get("/api/field/subcategories", isAuthenticated, async (req, res) => {
    const categoryId = req.query.category ? Number(req.query.category) : undefined;
    const family = req.query.family as string | undefined;
    const type = req.query.type as string | undefined;
    res.json(await storage.getFieldSubcategories({ categoryId, family, type }));
  });

  app.get("/api/field/items", isAuthenticated, async (req, res) => {
    const categoryId = req.query.category ? Number(req.query.category) : undefined;
    const family = req.query.family as string | undefined;
    const brand = req.query.brand as string | undefined;
    const type = req.query.type as string | undefined;
    const subcategory = req.query.subcategory as string | undefined;
    const size = req.query.size as string | undefined;
    const status = req.query.status as string | undefined;
    const search = req.query.q as string | undefined;
    const page = req.query.page ? Number(req.query.page) : 1;
    const perPage = req.query.perPage ? Number(req.query.perPage) : 10;
    res.json(await storage.getFieldItems({ categoryId, family, brand, type, subcategory, size, status, search, page, perPage }));
  });

  // ─── Locations ──────────────────────────────────────────────────────────────
  app.get("/api/locations", isAuthenticated, async (_req, res) => {
    res.json(await storage.getLocations());
  });

  app.post("/api/locations", isAuthenticated, requireManager, async (req, res) => {
    try {
      const { name, code, locationType, description } = req.body;
      if (!name || !name.trim()) return res.status(400).json({ ok: false, error: "Name is required" });
      const existing = await storage.getLocations();
      const dup = existing.find(l => l.name.trim().toLowerCase() === name.trim().toLowerCase());
      if (dup) return res.json(dup);
      const created = await storage.createLocation({ name: name.trim(), code: code || name.trim().toUpperCase().replace(/\s+/g, "-").slice(0, 20), locationType: locationType || "warehouse", description: description || null });
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ ok: false, error: err.message });
    }
  });

  app.delete("/api/locations/:id", isAuthenticated, requireManager, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ ok: false, error: "Invalid id" });
      await storage.deleteLocation(id);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ ok: false, error: err.message });
    }
  });

  app.post("/api/locations/:id/restore", isAuthenticated, requireManager, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ ok: false, error: "Invalid id" });
      await storage.restoreLocation(id);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ ok: false, error: err.message });
    }
  });

  app.patch("/api/locations/:id/supplier", isAuthenticated, requireManager, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { supplierId } = req.body;
      if (isNaN(id)) return res.status(400).json({ ok: false, error: "Invalid id" });
      if (!supplierId || isNaN(Number(supplierId))) return res.status(400).json({ ok: false, error: "supplierId is required" });
      const updated = await storage.linkLocationToSupplier(id, Number(supplierId));
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ ok: false, error: err.message });
    }
  });

  app.delete("/api/locations/:id/supplier", isAuthenticated, requireManager, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ ok: false, error: "Invalid id" });
      const updated = await storage.unlinkLocationFromSupplier(id);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ ok: false, error: err.message });
    }
  });

  // ─── Suppliers ──────────────────────────────────────────────────────────────
  app.get("/api/suppliers", isAuthenticated, async (_req, res) => {
    res.json(await storage.getSuppliers());
  });

  app.get("/api/suppliers/:id", isAuthenticated, async (req, res) => {
    const data = await storage.getSupplier(Number(req.params.id));
    if (!data) return res.status(404).json({ message: "Not found" });
    res.json(data);
  });

  app.post("/api/suppliers", isAuthenticated, requireManager, async (req, res) => {
    try {
      const data = await storage.createSupplier(req.body);
      res.status(201).json(data);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.put("/api/suppliers/:id", isAuthenticated, requireManager, async (req, res) => {
    try {
      const data = await storage.updateSupplier(Number(req.params.id), req.body);
      res.json(data);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/suppliers/:id", isAuthenticated, requireManager, async (req, res) => {
    try {
      await storage.deleteSupplier(Number(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // ─── Projects ───────────────────────────────────────────────────────────────
  app.get("/api/projects", isAuthenticated, requireManagerRead, async (_req, res) => {
    res.json(await storage.getProjects());
  });

  app.get("/api/projects/:id", isAuthenticated, requireManagerRead, async (req, res) => {
    const data = await storage.getProject(Number(req.params.id));
    if (!data) return res.status(404).json({ message: "Not found" });
    res.json(data);
  });

  app.post("/api/projects", isAuthenticated, requireManager, async (req, res) => {
    try {
      const data = await storage.createProject(req.body);
      res.status(201).json(data);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.put("/api/projects/:id", isAuthenticated, requireManager, async (req, res) => {
    try {
      const data = await storage.updateProject(Number(req.params.id), req.body);
      res.json(data);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/projects/:id", isAuthenticated, requireManager, async (req, res) => {
    try {
      await storage.deleteProject(Number(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // ─── Completion Reports ─────────────────────────────────────────────────────
  app.get("/api/projects/:id/completion-report", isAuthenticated, requireManagerRead, async (req, res) => {
    try {
      const data = await storage.getOrCreateCompletionReport(Number(req.params.id));
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/projects/:id/completion-report", isAuthenticated, requireManager, async (req, res) => {
    try {
      const report = await storage.getOrCreateCompletionReport(Number(req.params.id));
      const { contractItem, workDescription, completionDate, quotationImageUrl, drawingImageUrl } = req.body;
      const updated = await storage.updateCompletionReport(report.id, {
        contractItem,
        workDescription,
        completionDate,
        quotationImageUrl,
        drawingImageUrl,
      });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/projects/:id/completion-report/pdf-info", isAuthenticated, requireManager, uploadCompletionReport.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file" });
      if (req.file.mimetype !== "application/pdf") {
        return res.status(400).json({ message: "File must be a PDF." });
      }
      const { pdfPageCount } = await import("./services/pdfFirstPage");
      const pageCount = await pdfPageCount(req.file.buffer);
      return res.json({ pageCount });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/projects/:id/completion-report/pdf-preview", isAuthenticated, requireManager, uploadCompletionReport.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file" });
      if (req.file.mimetype !== "application/pdf") {
        return res.status(400).json({ message: "File must be a PDF." });
      }
      const { pdfFirstPageToPng } = await import("./services/pdfFirstPage");
      const rawPage = parseInt(req.query.page as string, 10);
      const pageNumber = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
      const pngBuffer = await pdfFirstPageToPng(req.file.buffer, pageNumber);
      res.set("Content-Type", "image/png");
      res.set("Cache-Control", "no-store");
      return res.send(pngBuffer);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/projects/:id/completion-report/upload", isAuthenticated, requireManager, uploadCompletionReport.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file" });
      const type = req.body.type as string;
      if (!["quotation", "drawing", "photo"].includes(type)) {
        return res.status(400).json({ message: "Invalid upload type. Must be quotation, drawing, or photo." });
      }

      // PDF is allowed for quotation and drawing
      const isPdf = req.file.mimetype === "application/pdf";
      if (isPdf && !["quotation", "drawing"].includes(type)) {
        return res.status(400).json({ message: "PDF upload is only supported for quotation and drawing." });
      }

      let fileBuffer: Buffer = req.file.buffer;
      let ext = MIME_TO_EXT[req.file.mimetype] ?? ".jpg";

      if (isPdf) {
        const { pdfFirstPageToPng } = await import("./services/pdfFirstPage");
        const rawPage = parseInt(req.body.pdfPage ?? "1", 10);
        const pageNumber = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
        fileBuffer = await pdfFirstPageToPng(req.file.buffer, pageNumber);
        ext = ".png";
      } else {
        // Validate magic bytes for images
        if (!isImageMagicBytes(fileBuffer, req.file.mimetype)) {
          return res.status(400).json({ message: "File content does not match declared type." });
        }
        // Apply EXIF orientation to pixels for photos so PPTX export shows correct rotation
        if (type === "photo") {
          const sharp = (await import("sharp")).default;
          fileBuffer = await sharp(fileBuffer).rotate().jpeg({ quality: 85 }).toBuffer();
          ext = ".jpg";
        }
      }

      // Write to Object Storage (persistent across deploys)
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
      const mimeType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
      await uploadBuffer(filename, fileBuffer, mimeType);
      const url = `/uploads/${filename}`;

      const report = await storage.getOrCreateCompletionReport(Number(req.params.id));

      if (type === "photo") {
        // Support optional sectionId to add photo directly to a section
        const rawSid = req.body.sectionId ? Number(req.body.sectionId) : null;
        const sectionId = rawSid && !isNaN(rawSid) ? rawSid : (report.sections?.[0]?.id ?? null);
        const sectionPhotos = report.sections?.find(s => s.id === sectionId)?.photos ?? [];
        const maxOrder = sectionPhotos.length;
        const photo = await storage.addCompletionReportPhoto(report.id, {
          photoUrl: url,
          sortOrder: maxOrder,
          sectionId,
        });
        return res.json(photo);
      } else {
        const field = type === "quotation" ? "quotationImageUrl" : "drawingImageUrl";
        const updated = await storage.updateCompletionReport(report.id, { [field]: url });
        return res.json(updated);
      }
    } catch (err: any) {
      console.error("Completion report upload error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  // ── Completion Report: Section CRUD ────────────────────────────────────────
  app.post("/api/projects/:id/completion-report/sections", isAuthenticated, requireManager, async (req, res) => {
    try {
      const report = await storage.getOrCreateCompletionReport(Number(req.params.id));
      const { title, photosPerSlide } = req.body;
      const sortOrder = report.sections?.length ?? 0;
      const defaultTitle = sortOrder === 0 ? "Work Picture" : `Work Picture ${sortOrder + 1}`;
      const section = await storage.createCompletionReportSection(report.id, {
        title: title || defaultTitle,
        photosPerSlide: [0, 2, 4, 6, 8].includes(photosPerSlide) ? photosPerSlide : 0,
        sortOrder,
      });
      res.json(section);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/projects/:id/completion-report/sections/:sid", isAuthenticated, requireManager, async (req, res) => {
    try {
      const { title, photosPerSlide } = req.body;
      const updateData: any = {};
      if (title !== undefined) updateData.title = title;
      if (photosPerSlide !== undefined) updateData.photosPerSlide = [0, 2, 4, 6, 8].includes(photosPerSlide) ? photosPerSlide : 0;
      const section = await storage.updateCompletionReportSection(Number(req.params.sid), updateData);
      res.json(section);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/projects/:id/completion-report/sections/:sid", isAuthenticated, requireManager, async (req, res) => {
    try {
      await storage.deleteCompletionReportSection(Number(req.params.sid));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Reorder photos within a section
  app.post("/api/projects/:id/completion-report/sections/:sid/reorder", isAuthenticated, requireManager, async (req, res) => {
    try {
      const report = await storage.getOrCreateCompletionReport(Number(req.params.id));
      await storage.reorderCompletionReportPhotos(report.id, req.body.orderedIds);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Upload photo directly to a specific section
  app.post("/api/projects/:id/completion-report/sections/:sid/upload", isAuthenticated, requireManager, uploadCompletionReport.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file" });
      const isPdf = req.file.mimetype === "application/pdf";
      if (isPdf) return res.status(400).json({ message: "PDF not supported for section photos." });

      let fileBuffer: Buffer = req.file.buffer;
      let ext = MIME_TO_EXT[req.file.mimetype] ?? ".jpg";
      if (!isImageMagicBytes(fileBuffer, req.file.mimetype)) {
        return res.status(400).json({ message: "File content does not match declared type." });
      }
      // Apply EXIF orientation to pixels so PPTX export shows correct rotation
      const sharp = (await import("sharp")).default;
      fileBuffer = await sharp(fileBuffer).rotate().jpeg({ quality: 85 }).toBuffer();
      ext = ".jpg";

      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
      const mimeType = "image/jpeg";
      await uploadBuffer(filename, fileBuffer, mimeType);
      const url = `/uploads/${filename}`;

      const report = await storage.getOrCreateCompletionReport(Number(req.params.id));
      const sectionId = Number(req.params.sid);
      const sectionPhotos = report.sections?.find(s => s.id === sectionId)?.photos ?? [];
      const maxOrder = sectionPhotos.length;
      const photo = await storage.addCompletionReportPhoto(report.id, { photoUrl: url, sortOrder: maxOrder, sectionId });
      return res.json(photo);
    } catch (err: any) {
      console.error("Section upload error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  // ── Drawing Section CRUD ───────────────────────────────────────────────────
  app.post("/api/projects/:id/completion-report/drawing-sections", isAuthenticated, requireManager, async (req, res) => {
    try {
      const report = await storage.getOrCreateCompletionReport(Number(req.params.id));
      const sortOrder = report.drawingSections?.length ?? 0;
      const defaultTitle = sortOrder === 0 ? "Drawing" : `Drawing ${sortOrder + 1}`;
      const section = await storage.createDrawingSection(report.id, {
        title: req.body.title || defaultTitle,
        sortOrder,
      });
      res.json(section);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/projects/:id/completion-report/drawing-sections/:sid", isAuthenticated, requireManager, async (req, res) => {
    try {
      const { title } = req.body;
      const updateData: any = {};
      if (title !== undefined) updateData.title = title;
      const section = await storage.updateDrawingSection(Number(req.params.sid), updateData);
      res.json(section);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/projects/:id/completion-report/drawing-sections/:sid", isAuthenticated, requireManager, async (req, res) => {
    try {
      await storage.deleteDrawingSection(Number(req.params.sid));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Upload image for a specific drawing section (supports JPG/PNG/PDF)
  app.post("/api/projects/:id/completion-report/drawing-sections/:sid/upload", isAuthenticated, requireManager, uploadCompletionReport.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file" });
      const isPdf = req.file.mimetype === "application/pdf";
      let fileBuffer: Buffer = req.file.buffer;
      let ext = MIME_TO_EXT[req.file.mimetype] ?? ".jpg";

      if (isPdf) {
        const { pdfFirstPageToPng } = await import("./services/pdfFirstPage");
        const rawPage = parseInt(req.body.pdfPage ?? "1", 10);
        const pageNumber = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
        fileBuffer = await pdfFirstPageToPng(req.file.buffer, pageNumber);
        ext = ".png";
      } else {
        if (!isImageMagicBytes(fileBuffer, req.file.mimetype)) {
          return res.status(400).json({ message: "File content does not match declared type." });
        }
        const sharp = (await import("sharp")).default;
        fileBuffer = await sharp(fileBuffer).rotate().jpeg({ quality: 90 }).toBuffer();
        ext = ".jpg";
      }

      const mimeType = ext === ".png" ? "image/png" : "image/jpeg";
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
      await uploadBuffer(filename, fileBuffer, mimeType);
      const url = `/uploads/${filename}`;

      const sectionId = Number(req.params.sid);
      const updated = await storage.updateDrawingSection(sectionId, { imageUrl: url });
      return res.json(updated);
    } catch (err: any) {
      console.error("Drawing section upload error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/projects/:id/completion-report/photos/:photoId", isAuthenticated, requireManager, async (req, res) => {
    try {
      const report = await storage.getOrCreateCompletionReport(Number(req.params.id));
      const { and: andOp } = await import("drizzle-orm");

      // Only update fields that were actually provided in the request body
      const VALID_CROP_FOCUS = ["centre", "top", "bottom", "left", "right"];
      const updateData: Record<string, unknown> = {};
      if ("photoDate" in req.body) updateData.photoDate = req.body.photoDate ?? null;
      if ("description" in req.body) updateData.description = req.body.description ?? null;
      if ("cropFocus" in req.body) {
        const cf = req.body.cropFocus;
        updateData.cropFocus = (typeof cf === "string" && VALID_CROP_FOCUS.includes(cf)) ? cf : "centre";
      }
      // Manual crop coords (0-100 percent of original image dimensions)
      if ("cropX" in req.body) {
        const v = req.body.cropX == null ? null : Number(req.body.cropX);
        updateData.cropX = (v != null && isFinite(v) && v >= 0 && v <= 100) ? String(v) : null;
      }
      if ("cropY" in req.body) {
        const v = req.body.cropY == null ? null : Number(req.body.cropY);
        updateData.cropY = (v != null && isFinite(v) && v >= 0 && v <= 100) ? String(v) : null;
      }
      if ("cropWidth" in req.body) {
        const v = req.body.cropWidth == null ? null : Number(req.body.cropWidth);
        updateData.cropWidth = (v != null && isFinite(v) && v > 0 && v <= 100) ? String(v) : null;
      }
      if ("cropHeight" in req.body) {
        const v = req.body.cropHeight == null ? null : Number(req.body.cropHeight);
        updateData.cropHeight = (v != null && isFinite(v) && v > 0 && v <= 100) ? String(v) : null;
      }
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "No fields to update" });
      }

      const [updated] = await db.update(completionReportPhotos)
        .set(updateData as any)
        .where(andOp(
          eq(completionReportPhotos.id, Number(req.params.photoId)),
          eq(completionReportPhotos.reportId, report.id),
        ))
        .returning();
      if (!updated) return res.status(404).json({ message: "Photo not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/projects/:id/completion-report/photos/:photoId", isAuthenticated, requireManager, async (req, res) => {
    try {
      const report = await storage.getOrCreateCompletionReport(Number(req.params.id));
      const { and: andOp } = await import("drizzle-orm");
      const [existing] = await db.select().from(completionReportPhotos)
        .where(andOp(
          eq(completionReportPhotos.id, Number(req.params.photoId)),
          eq(completionReportPhotos.reportId, report.id),
        ));
      if (!existing) return res.status(404).json({ message: "Photo not found" });
      await storage.deleteCompletionReportPhoto(existing.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/projects/:id/completion-report/reorder", isAuthenticated, requireManager, async (req, res) => {
    try {
      const report = await storage.getOrCreateCompletionReport(Number(req.params.id));
      await storage.reorderCompletionReportPhotos(report.id, req.body.orderedIds);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/projects/:id/completion-report/export", isAuthenticated, requireManager, async (req, res) => {
    try {
      const projectId = Number(req.params.id);
      const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
      if (!project) return res.status(404).json({ message: "Project not found" });

      const report = await storage.getOrCreateCompletionReport(projectId);
      const { generateCompletionReportPptx } = await import("./services/completionReportPptx");
      const buffer = await generateCompletionReportPptx(project, report);

      const safeName = (project.name ?? "report").replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40);
      const poNum = ((project as any).poNumber ?? (project as any).code ?? "").replace(/[^a-zA-Z0-9]/g, "_").slice(0, 20);
      const filename = poNum ? `${poNum}_${safeName}_completion_report.pptx` : `${safeName}_completion_report.pptx`;
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", buffer.length);
      res.setHeader("Cache-Control", "no-store");
      res.send(buffer);
    } catch (err: any) {
      console.error("PPTX export error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  // ─── Items ──────────────────────────────────────────────────────────────────
  app.get("/api/items", isAuthenticated, async (req, res) => {
    const search     = req.query.search as string | undefined;
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
    const locationId = req.query.locationId ? Number(req.query.locationId) : undefined;
    const status     = req.query.status as string | undefined;

    const VALID_PATTERNS = ["core", "normal", "low", "none"] as const;
    type UsagePattern = typeof VALID_PATTERNS[number];
    const rawPattern = req.query.usagePattern as string | undefined;
    const usagePattern: UsagePattern | undefined = VALID_PATTERNS.includes(rawPattern as UsagePattern)
      ? (rawPattern as UsagePattern)
      : undefined;

    const pageParam = req.query.page !== undefined ? Math.max(1, Number(req.query.page)) : undefined;
    const perPage   = req.query.perPage ? Math.max(1, Number(req.query.perPage)) : 25;

    const VALID_SORTS = ["name", "sku", "quantityOnHand", "status"] as const;
    const VALID_DIRS  = ["asc", "desc"] as const;
    type SortKey = typeof VALID_SORTS[number];
    type Dir     = typeof VALID_DIRS[number];
    const rawSort = req.query.sort as string;
    const rawDir  = req.query.dir  as string;
    const sort: SortKey = VALID_SORTS.includes(rawSort as SortKey) ? (rawSort as SortKey) : "name";
    const dir:  Dir     = VALID_DIRS.includes(rawDir   as Dir)     ? (rawDir   as Dir)     : "asc";

    const result = await storage.getItems({
      search, categoryId, locationId, status, usagePattern,
      sort, dir,
      ...(pageParam !== undefined ? { page: pageParam, perPage } : {}),
    });

    if (pageParam === undefined) {
      return res.json(result.items);
    }

    res.json({ items: result.items, total: result.total });
  });

  app.get("/api/items/:id", isAuthenticated, async (req, res) => {
    const id = parseIntParam(req.params.id, "id", res);
    if (id === null) return;
    const data = await storage.getItem(id);
    if (!data) return res.status(404).json({ message: "Not found" });
    res.json(data);
  });

  // ── Auto-classify helper ──────────────────────────────────────────────────
  async function autoClassify(name: string, baseItemName: string | null | undefined, categoryId: number | undefined): Promise<{ subcategory?: string; detailType?: string }> {
    if (!categoryId) return {};
    const cats = await storage.getCategories();
    const cat = cats.find(c => c.id === categoryId);
    const categoryCode = cat?.code || '';
    const result = classifyInventoryItem({ name, baseItemName, categoryCode });
    return {
      subcategory: result.subcategory ?? undefined,
      detailType: result.detailType ?? undefined,
    };
  }

  // ── Classify preview endpoint ──────────────────────────────────────────────
  app.post("/api/items/classify", isAuthenticated, requireManager, async (req, res) => {
    try {
      const { name = '', baseItemName, categoryId, sizeLabel } = req.body;
      const cats = await storage.getCategories();
      const cat = cats.find(c => c.id === Number(categoryId));
      const categoryCode = cat?.code || '';

      const classification = classifyInventoryItem({ name, baseItemName, categoryCode, sizeLabel });
      const { subcategory, detailType } = classification;

      const family    = derivedFamily(subcategory, detailType, name, baseItemName);
      const type      = derivedType(subcategory, detailType, baseItemName, name);
      const subcatDisp = extractSubcategory(name, detailType, subcategory, baseItemName);

      res.json({ subcategory, detailType, family, type, subcategoryDisplay: subcatDisp, categoryCode });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/items", isAuthenticated, requireManager, async (req, res) => {
    try {
      const { imageUrl, ...rest } = req.body;
      const catId = rest.categoryId ? Number(rest.categoryId) : undefined;

      // Auto-classify subcategory/detailType when not explicitly provided
      const autoFields = (!rest.subcategory || !rest.detailType)
        ? await autoClassify(rest.name || '', rest.baseItemName, catId)
        : {};

      const rawBody = {
        ...rest,
        ...autoFields,
        subcategory: rest.subcategory || autoFields.subcategory || null,
        detailType: rest.detailType || autoFields.detailType || null,
        categoryId: catId,
        primaryLocationId: rest.primaryLocationId ? Number(rest.primaryLocationId) : undefined,
        supplierId: rest.supplierId ? Number(rest.supplierId) : undefined,
        quantityOnHand: Number(rest.quantityOnHand ?? 0),
        minimumStock: Number(rest.minimumStock ?? 0),
        reorderPoint: Number(rest.reorderPoint ?? 0),
        reorderQuantity: Number(rest.reorderQuantity ?? 0),
      };

      // Zod validation — catches type errors before hitting the DB
      const parsed = insertItemSchema.safeParse(rawBody);
      if (!parsed.success) {
        const msg = parsed.error.issues
          .map(i => `${i.path.join('.') || 'field'}: ${i.message}`)
          .join('; ');
        console.error('[POST /api/items] Validation failed:', parsed.error.issues);
        return res.status(400).json({ message: `입력값 오류: ${msg}` });
      }

      const created = await storage.createItem(parsed.data);
      if (imageUrl && typeof imageUrl === "string" && imageUrl.trim()) {
        await storage.createItemImage(created.id, imageUrl.trim());
      }
      res.status(201).json(created);
    } catch (err: any) {
      // Always log the full technical error server-side
      console.error('[POST /api/items] Insert failed:', err);

      // Extract Postgres error code from err or its cause (Drizzle wraps pg errors)
      const pgCode: string | undefined = err.code ?? err.cause?.code;
      const pgDetail: string = err.detail ?? err.cause?.detail ?? '';
      const pgColumn: string = err.column ?? err.cause?.column ?? '';

      if (pgCode === '23505') {
        // unique_violation — most commonly a duplicate SKU
        const match = pgDetail.match(/Key \((\w+)\)=\(([^)]+)\)/i);
        if (match) {
          const field = match[1];
          const value = match[2];
          if (field === 'sku') {
            return res.status(400).json({ message: `SKU '${value}'이(가) 이미 존재합니다` });
          }
          return res.status(400).json({ message: `중복된 값입니다: ${field} = '${value}'` });
        }
        return res.status(400).json({ message: 'SKU 또는 다른 필드 값이 이미 존재합니다' });
      }

      if (pgCode === '23503') {
        // foreign_key_violation
        return res.status(400).json({ message: '잘못된 카테고리 또는 위치 ID입니다' });
      }

      if (pgCode === '23502') {
        // not_null_violation
        const col = pgColumn || '알 수 없는 필드';
        return res.status(400).json({ message: `필수 필드가 누락되었습니다: ${col}` });
      }

      // Unknown DB/server error — strip SQL dump, return only the PG message line
      const rawMsg: string = err.message ?? '';
      const cleanMsg = rawMsg
        .split('\n')
        .find(line => !line.startsWith(' ') && !line.includes('insert into') && !line.includes('params:') && line.trim().length > 0)
        ?? '아이템 저장 중 오류가 발생했습니다';
      res.status(400).json({ message: cleanMsg });
    }
  });

  app.put("/api/items/:id", isAuthenticated, requireManager, async (req, res) => {
    try {
      const id = parseIntParam(req.params.id, "id", res);
      if (id === null) return;
      const body = {
        ...req.body,
        categoryId: req.body.categoryId ? Number(req.body.categoryId) : undefined,
        primaryLocationId: req.body.primaryLocationId ? Number(req.body.primaryLocationId) : undefined,
        supplierId: req.body.supplierId ? Number(req.body.supplierId) : undefined,
      };
      res.json(await storage.updateItem(id, body));
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/items/:id", isAuthenticated, requireManager, async (req, res) => {
    try {
      const id = parseIntParam(req.params.id, "id", res);
      if (id === null) return;
      await storage.deleteItem(id);
      res.status(204).end();
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/items/restore-batch", isAuthenticated, requireManager, async (req, res) => {
    try {
      const rawIds = req.body?.ids;
      if (!Array.isArray(rawIds) || rawIds.length === 0) {
        return res.status(400).json({ message: "ids 배열이 필요합니다." });
      }
      const ids = [...new Set(rawIds.map(Number).filter(n => Number.isInteger(n) && n > 0))];
      if (ids.length === 0) return res.status(400).json({ message: "유효한 ID가 없습니다." });
      await storage.restoreItems(ids);
      res.json({ restored: ids.length });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ─── Inventory Movements ─────────────────────────────────────────────────────
  app.get("/api/movements", isAuthenticated, async (req, res) => {
    const itemId = req.query.itemId ? Number(req.query.itemId) : undefined;
    const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
    const movementType = req.query.movementType as string;
    const locationId = req.query.locationId ? Number(req.query.locationId) : undefined;
    res.json(await storage.getInventoryMovements({ itemId, projectId, movementType, locationId }));
  });

  // Legacy alias
  app.get("/api/items/movements", isAuthenticated, async (req, res) => {
    const itemId = req.query.itemId ? Number(req.query.itemId) : undefined;
    const movementType = req.query.movementType as string;
    res.json(await storage.getInventoryMovements({ itemId, movementType }));
  });

  // Generic movement endpoint
  app.post("/api/movements", isAuthenticated, requireStaff, async (req, res) => {
    try {
      const body = req.body;
      const movementType = body.movementType as string;

      // ── Validate new movement input ──────────────────────────────────────────
      const vr = validateNewMovement({
        itemId:               body.itemId        ? Number(body.itemId)               : null,
        movementType:         body.movementType  ?? null,
        quantity:             body.quantity      != null ? Number(body.quantity)     : null,
        sourceLocationId:     body.sourceLocationId      ? Number(body.sourceLocationId)     : null,
        destinationLocationId: body.destinationLocationId ? Number(body.destinationLocationId) : null,
      });
      if (!vr.valid) {
        return res.status(400).json({
          message: "Validation failed",
          errors: Object.entries(vr.errors).map(([field, message]) => ({ field, message })),
        });
      }

      if (!movementType) return res.status(400).json({ message: "movementType is required" });

      const item = await storage.getItem(Number(body.itemId));
      if (!item) return res.status(404).json({ message: "Item not found" });

      const qty = Number(body.quantity);
      if (isNaN(qty)) return res.status(400).json({ message: "quantity must be a number" });
      if (movementType !== 'adjust' && qty <= 0) return res.status(400).json({ message: "quantity must be a positive number" });
      if (movementType === 'adjust' && qty < 0) return res.status(400).json({ message: "quantity must be zero or greater" });

      let newQty = item.quantityOnHand;

      if (movementType === 'receive' || movementType === 'return') {
        newQty += qty;
      } else if (movementType === 'issue') {
        if (item.quantityOnHand < qty) {
          return res.status(400).json({ message: `Insufficient stock. Available: ${item.quantityOnHand} ${item.unitOfMeasure}` });
        }
        newQty -= qty;
      } else if (movementType === 'adjust') {
        newQty = qty; // qty IS the final quantity for adjustments
      } else if (movementType === 'transfer') {
        if (item.quantityOnHand < qty) {
          return res.status(400).json({ message: `Insufficient stock for transfer. Available: ${item.quantityOnHand} ${item.unitOfMeasure}` });
        }
        // quantity doesn't change overall for transfers
        newQty = item.quantityOnHand;
      }

      const movement = await storage.createInventoryMovement({
        itemId: item.id,
        movementType,
        quantity: qty,
        previousQuantity: item.quantityOnHand,
        newQuantity: newQty,
        sourceLocationId: body.sourceLocationId ? Number(body.sourceLocationId) : null,
        destinationLocationId: body.destinationLocationId ? Number(body.destinationLocationId) : null,
        supplierId: (movementType === "receive" || movementType === "return") && body.supplierId ? Number(body.supplierId) : null,
        projectId: body.projectId ? Number(body.projectId) : null,
        unitCostSnapshot: item.unitCost,
        note: body.note ?? null,
        reason: body.reason ?? null,
        referenceType: body.referenceType ?? null,
        referenceId: body.referenceId ?? null,
        createdBy: getUserId(req),
      });

      if (movementType === "issue" || movementType === "return") {
        try {
          const explicitIds = Array.isArray(body.assetIds) && body.assetIds.length > 0
            ? (body.assetIds as any[]).map(Number)
            : null;
          if (explicitIds) {
            await storage.applyAssetMovementByIds(explicitIds, movementType as "issue" | "return", {
              itemId: item.id,
              projectId: movement.projectId ?? null,
              locationId: movement.destinationLocationId ?? null,
              assignedTo: movementType === "issue" ? getUserDisplayName(req) : null,
            });
          } else {
            await storage.syncAssetStatusOnMovement(item.id, movementType, qty, {
              projectId: movement.projectId ?? null,
              locationId: movement.destinationLocationId ?? null,
              assignedTo: movementType === "issue" ? getUserDisplayName(req) : null,
            });
          }
        } catch (_) { /* non-fatal: asset sync failure does not roll back the movement */ }
      }

      res.status(201).json(movement);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Internal error" });
    }
  });

  // Specific typed movement endpoints
  for (const type of ['receive', 'issue', 'return', 'adjust', 'transfer']) {
    app.post(`/api/movements/${type}`, isAuthenticated, requireStaff, async (req, res) => {
      try {
        req.body.movementType = type;

        // ── Validate new movement input ────────────────────────────────────────
        const vr = validateNewMovement({
          itemId:               req.body.itemId        ? Number(req.body.itemId)               : null,
          movementType:         type,
          quantity:             req.body.quantity      != null ? Number(req.body.quantity)     : null,
          sourceLocationId:     req.body.sourceLocationId      ? Number(req.body.sourceLocationId)     : null,
          destinationLocationId: req.body.destinationLocationId ? Number(req.body.destinationLocationId) : null,
        });
        if (!vr.valid) {
          return res.status(400).json({
            message: "Validation failed",
            errors: Object.entries(vr.errors).map(([field, message]) => ({ field, message })),
          });
        }

        const item = await storage.getItem(Number(req.body.itemId));
        if (!item) return res.status(404).json({ message: "Item not found" });

        const qty = Number(req.body.quantity);
        let newQty = item.quantityOnHand;

        if (type === 'receive' || type === 'return') newQty += qty;
        else if (type === 'issue') {
          if (item.quantityOnHand < qty) {
            return res.status(400).json({ message: `Insufficient stock. Available: ${item.quantityOnHand} ${item.unitOfMeasure}` });
          }
          newQty -= qty;
        } else if (type === 'adjust') {
          newQty = qty;
        } else if (type === 'transfer') {
          if (item.quantityOnHand < qty) {
            return res.status(400).json({ message: `Insufficient stock for transfer.` });
          }
          newQty = item.quantityOnHand;
        }

        const movement = await storage.createInventoryMovement({
          itemId: item.id,
          movementType: type,
          quantity: qty,
          previousQuantity: item.quantityOnHand,
          newQuantity: newQty,
          sourceLocationId: req.body.sourceLocationId ? Number(req.body.sourceLocationId) : null,
          destinationLocationId: req.body.destinationLocationId ? Number(req.body.destinationLocationId) : null,
          supplierId: (type === "receive" || type === "return") && req.body.supplierId ? Number(req.body.supplierId) : null,
          projectId: req.body.projectId ? Number(req.body.projectId) : null,
          unitCostSnapshot: item.unitCost,
          note: req.body.note ?? null,
          reason: req.body.reason ?? null,
          createdBy: getUserId(req),
        });

        if (type === "issue" || type === "return") {
          try {
            const explicitIds = Array.isArray(req.body.assetIds) && req.body.assetIds.length > 0
              ? (req.body.assetIds as any[]).map(Number)
              : null;
            if (explicitIds) {
              await storage.applyAssetMovementByIds(explicitIds, type as "issue" | "return", {
                itemId: item.id,
                projectId: movement.projectId ?? null,
                locationId: movement.destinationLocationId ?? null,
                assignedTo: type === "issue" ? getUserDisplayName(req) : null,
              });
            } else {
              await storage.syncAssetStatusOnMovement(item.id, type, qty, {
                projectId: movement.projectId ?? null,
                locationId: movement.destinationLocationId ?? null,
                assignedTo: type === "issue" ? getUserDisplayName(req) : null,
              });
            }
          } catch (_) { /* non-fatal */ }
        }

        res.status(201).json(movement);
      } catch (err: any) {
        res.status(500).json({ message: err.message || "Internal error" });
      }
    });
  }

  // Legacy alias
  app.post("/api/items/movements", isAuthenticated, requireStaff, async (req, res) => {
    try {
      // ── Validate new movement input ──────────────────────────────────────────
      const vr = validateNewMovement({
        itemId:               req.body.itemId        ? Number(req.body.itemId)               : null,
        movementType:         req.body.movementType  ?? null,
        quantity:             req.body.quantity      != null ? Number(req.body.quantity)     : null,
        sourceLocationId:     req.body.sourceLocationId      ? Number(req.body.sourceLocationId)     : null,
        destinationLocationId: req.body.destinationLocationId ? Number(req.body.destinationLocationId) : null,
      });
      if (!vr.valid) {
        return res.status(400).json({
          message: "Validation failed",
          errors: Object.entries(vr.errors).map(([field, message]) => ({ field, message })),
        });
      }

      const item = await storage.getItem(Number(req.body.itemId));
      if (!item) return res.status(404).json({ message: "Item not found" });

      const qty = Number(req.body.quantity);
      let newQty = item.quantityOnHand;
      const movementType = req.body.movementType;

      if (movementType === 'receive' || movementType === 'return') newQty += qty;
      else if (movementType === 'issue') {
        if (item.quantityOnHand < qty) {
          return res.status(400).json({ message: `Insufficient stock. Available: ${item.quantityOnHand} ${item.unitOfMeasure}` });
        }
        newQty -= qty;
      }
      else if (movementType === 'adjust') newQty = qty;

      const movement = await storage.createInventoryMovement({
        itemId: item.id,
        movementType,
        quantity: qty,
        previousQuantity: item.quantityOnHand,
        newQuantity: newQty,
        sourceLocationId: req.body.sourceLocationId ? Number(req.body.sourceLocationId) : null,
        destinationLocationId: req.body.destinationLocationId ? Number(req.body.destinationLocationId) : null,
        supplierId: (movementType === "receive" || movementType === "return") && req.body.supplierId ? Number(req.body.supplierId) : null,
        note: req.body.note ?? null,
        createdBy: getUserId(req),
      });

      if (movementType === "issue" || movementType === "return") {
        try {
          const explicitIds = Array.isArray(req.body.assetIds) && req.body.assetIds.length > 0
            ? (req.body.assetIds as any[]).map(Number)
            : null;
          if (explicitIds) {
            await storage.applyAssetMovementByIds(explicitIds, movementType as "issue" | "return", {
              itemId: item.id,
              projectId: movement.projectId ?? null,
              locationId: movement.destinationLocationId ?? null,
              assignedTo: movementType === "issue" ? getUserDisplayName(req) : null,
            });
          } else {
            await storage.syncAssetStatusOnMovement(item.id, movementType, qty, {
              projectId: movement.projectId ?? null,
              locationId: movement.destinationLocationId ?? null,
              assignedTo: movementType === "issue" ? getUserDisplayName(req) : null,
            });
          }
        } catch (_) { /* non-fatal */ }
      }

      res.status(201).json(movement);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Internal error" });
    }
  });

  app.put("/api/movements/:id", isAuthenticated, requireManager, async (req, res) => {
    try {
      const id = parseIntParam(req.params.id, "id", res);
      if (id === null) return;
      const { movementType, quantity, sourceLocationId, destinationLocationId, projectId, note, reason, itemId, transactionDate } = req.body;
      if (!movementType || !quantity) return res.status(400).json({ message: "movementType and quantity are required" });
      const editedBy = (req as any).user?.id ?? null;
      const updated = await storage.updateInventoryMovement(id, {
        movementType, quantity: Number(quantity),
        sourceLocationId: sourceLocationId !== undefined ? (sourceLocationId ? Number(sourceLocationId) : null) : undefined,
        destinationLocationId: destinationLocationId !== undefined ? (destinationLocationId ? Number(destinationLocationId) : null) : undefined,
        projectId: projectId !== undefined ? (projectId ? Number(projectId) : null) : undefined,
        note: note !== undefined ? (note || null) : undefined,
        reason: reason ?? null,
        itemId: itemId ? Number(itemId) : undefined,
        transactionDate: transactionDate ? new Date(transactionDate) : null,
        editedBy,
      });
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/movements/:id/undo", isAuthenticated, requireManager, async (req, res) => {
    try {
      const id = parseIntParam(req.params.id, "id", res);
      if (id === null) return;
      const reverted = await storage.undoMovementEdit(id);
      res.json(reverted);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/movements/:id", isAuthenticated, requireManager, async (req, res) => {
    try {
      const id = parseIntParam(req.params.id, "id", res);
      if (id === null) return;
      await storage.deleteMovement(id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/movements/bulk-delete", isAuthenticated, requireManager, async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "ids array is required" });
      }
      const result = await storage.bulkDeleteMovements(ids.map(Number));
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/movements/bulk-restore", isAuthenticated, requireManager, async (req, res) => {
    try {
      const { snapshots } = req.body;
      if (!Array.isArray(snapshots) || snapshots.length === 0) {
        return res.status(400).json({ message: "snapshots array is required" });
      }
      const result = await storage.bulkRestoreMovements(snapshots);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // ─── Item Groups (family metadata) ───────────────────────────────────────────
  app.put("/api/inventory/category/:categoryId/item-groups", isAuthenticated, requireManager, async (req, res) => {
    try {
      const categoryId = Number(req.params.categoryId);
      const { baseItemName, imageUrl, newName, manufacturerName, originalManufacturerName } = req.body;
      if (!baseItemName) return res.status(400).json({ message: "baseItemName is required" });
      const mfr = manufacturerName?.trim() || null;
      const originalMfr = originalManufacturerName?.trim() || null;
      if (newName && newName !== baseItemName) {
        await storage.renameFamily(categoryId, baseItemName, newName, originalMfr);
        await storage.upsertItemGroup(categoryId, newName, mfr, { imageUrl: imageUrl ?? null });
        return res.json({ success: true });
      }
      const updated = await storage.upsertItemGroup(categoryId, baseItemName, mfr, { imageUrl: imageUrl ?? null });
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/inventory/items/move-family", isAuthenticated, requireManager, async (req, res) => {
    try {
      const { itemIds, newBaseItemName, newManufacturerName } = req.body;
      if (!Array.isArray(itemIds) || itemIds.length === 0) return res.status(400).json({ message: "itemIds required" });
      if (!newBaseItemName) return res.status(400).json({ message: "newBaseItemName required" });
      await storage.moveFamilyItems(itemIds.map(Number), newBaseItemName, newManufacturerName ?? null);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/inventory/items/move-family-to-category", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { fromCategoryId, baseItemName, toCategoryId } = req.body;
      if (!fromCategoryId || !baseItemName || !toCategoryId) return res.status(400).json({ message: "fromCategoryId, baseItemName, toCategoryId are required" });
      if (fromCategoryId === toCategoryId) return res.status(400).json({ message: "Source and target categories must be different" });
      const hasConflict = await storage.familyExistsInCategory(Number(toCategoryId), String(baseItemName));
      if (hasConflict) {
        return res.status(409).json({ message: `Target category already has a family named "${baseItemName}"` });
      }
      const moved = await storage.moveFamilyToCategory(Number(fromCategoryId), String(baseItemName), Number(toCategoryId));
      res.json({ moved });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/inventory/items/bulk-delete", isAuthenticated, requireManager, async (req, res) => {
    try {
      const { itemIds } = req.body;
      if (!Array.isArray(itemIds) || itemIds.length === 0) return res.status(400).json({ message: "itemIds required" });
      await storage.bulkSoftDeleteItems(itemIds.map(Number));
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // ─── Location Balances ────────────────────────────────────────────────────────
  app.get("/api/location-balances", isAuthenticated, async (req, res) => {
    const locationId = req.query.locationId ? Number(req.query.locationId) : undefined;
    res.json(await storage.getLocationBalances(locationId));
  });

  // ─── Reorder / Purchasing ─────────────────────────────────────────────────────
  app.get("/api/reorder/recommendations", isAuthenticated, requireManagerRead, async (_req, res) => {
    res.json(await storage.getPurchaseRecommendations());
  });

  app.post("/api/reorder/generate", isAuthenticated, requireManager, async (_req, res) => {
    const data = await storage.generatePurchaseRecommendations();
    res.json(data);
  });

  app.put("/api/reorder/recommendations/:id/status", isAuthenticated, requireManager, async (req, res) => {
    try {
      const data = await storage.updateRecommendationStatus(Number(req.params.id), req.body.status);
      res.json(data);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // ─── Reorder: Save RMS to history (pending, no download) ─────────────────────
  const saveRmsSchema = z.object({
    header: z.object({
      date:           z.string().optional().default(""),
      requester:      z.string().optional().default(""),
      poNumber:       z.string().optional().default(""),
      projectName:    z.string().optional().default(""),
      deliveryTo:     z.string().optional().default(""),
    }),
    items: z.array(z.object({
      itemId:  z.number().int().positive().optional(),
      name:    z.string().default(""),
      size:    z.string().optional().default(""),
      qty:     z.union([z.number(), z.string()]).transform(v => {
        const n = Number(v);
        return Number.isFinite(n) && n >= 0 ? n : 0;
      }),
      onHand:  z.union([z.number(), z.string(), z.null()]).optional().transform(v => {
        if (v == null) return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      }),
      unit:    z.string().optional().default(""),
      remarks: z.string().optional().default(""),
    })).min(1),
    projectId: z.number().int().positive().optional(),
  });

  // Shared handler for creating a pending RMS history record (used by both endpoints below).
  const handleSaveRmsPending = async (req: any, res: any) => {
    try {
      const parsed = saveRmsSchema.parse(req.body);
      const currentUser = (req as RequestWithUser).currentUser;
      const itemIds = parsed.items
        .map((i: any) => i.itemId)
        .filter((v: any): v is number => typeof v === "number" && v > 0);
      const itemMap = new Map<number, Item>();
      if (itemIds.length > 0) {
        const { db } = await import("./db");
        const { items: itemsTable } = await import("../shared/schema");
        const { inArray } = await import("drizzle-orm");
        const rows = await db.select().from(itemsTable).where(inArray(itemsTable.id, itemIds));
        for (const r of rows) itemMap.set(r.id, r);
      }
      const lines: Omit<CreateRmsExportHistoryItem, "historyId">[] = parsed.items.map((it: any, idx: number) => {
        const dbItem = typeof it.itemId === "number" ? itemMap.get(it.itemId) : undefined;
        const safeItemId = dbItem ? dbItem.id : null;
        return {
          itemId: safeItemId,
          skuSnapshot: dbItem?.sku ?? null,
          nameSnapshot: it.name || dbItem?.name || null,
          sizeSnapshot: it.size || dbItem?.sizeLabel || null,
          unitSnapshot: it.unit || dbItem?.unitOfMeasure || null,
          qty: it.qty || 0,
          remarksSnapshot: it.remarks || null,
          onHandSnapshot: it.onHand != null ? it.onHand : (dbItem?.quantityOnHand ?? null),
          reorderPointSnapshot: dbItem?.reorderPoint ?? null,
          reorderQuantitySnapshot: dbItem?.reorderQuantity ?? null,
          minimumStockSnapshot: dbItem?.minimumStock ?? null,
          sortOrder: idx,
        };
      });
      const headerInsert: CreateRmsExportHistory = {
        exportType: "rms",
        exportedBy: currentUser?.id ?? null,
        exportedByName: currentUser?.name ?? currentUser?.email ?? null,
        requestFrom: parsed.header.requester || null,
        poNumber: parsed.header.poNumber || null,
        projectId: parsed.projectId ?? null,
        projectName: parsed.header.projectName || null,
        completionDate: null,
        deliveryTo: parsed.header.deliveryTo || null,
        itemCount: parsed.items.length,
        status: "pending",
      };
      const created = await storage.createRmsExportHistory(headerInsert, lines);
      const safeFn = (s: string) => (s || "").replace(/[\\/:*?"<>|]/g, "_").trim();
      const poPart = safeFn(parsed.header.poNumber || "");
      const seqStr = String(created.poSeq ?? 1).padStart(4, "0");
      const filename = poPart ? `RMS-${poPart}-${seqStr}.xlsx` : `RMS-${seqStr}.xlsx`;
      res.json({ id: created.id, poSeq: created.poSeq, filename });
    } catch (err: any) {
      if (err?.issues) return res.status(400).json({ message: "Invalid payload", issues: err.issues });
      res.status(500).json({ message: err.message || "Failed to save RMS history" });
    }
  };

  // Alias kept for backward compatibility — delegates to shared handler.
  app.post("/api/reorder/save-rms", isAuthenticated, requireManager, handleSaveRmsPending);

  // ─── Reorder: Export selected items into the company RMS Excel template ──────
  const exportRmsSchema = z.object({
    header: z.object({
      date:           z.string().optional().default(""),
      requester:      z.string().optional().default(""),
      poNumber:       z.string().optional().default(""),
      projectName:    z.string().optional().default(""),
      completionDate: z.string().optional().default(""),
      deliveryTo:     z.string().optional().default(""),
    }),
    items: z.array(z.object({
      itemId:  z.number().int().positive().optional(),
      name:    z.string().default(""),
      size:    z.string().optional().default(""),
      qty:     z.union([z.number(), z.string()]).transform(v => {
        const n = Number(v);
        return Number.isFinite(n) && n >= 0 ? n : 0;
      }),
      onHand:  z.union([z.number(), z.string(), z.null()]).optional().transform(v => {
        if (v == null) return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      }),
      unit:    z.string().optional().default(""),
      remarks: z.string().optional().default(""),
    })).min(1),
    projectId: z.number().int().positive().optional(),
  });

  app.post("/api/reorder/export-rms", isAuthenticated, requireManager, async (req, res) => {
    try {
      const parsed = exportRmsSchema.parse(req.body);
      const ExcelJS = (await import("exceljs")).default;
      const templatePath = path.resolve(process.cwd(), "server/templates/rms-template.xlsx");
      if (!fs.existsSync(templatePath)) {
        return res.status(500).json({ message: "RMS template file is missing on server." });
      }
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(templatePath);
      const ws = wb.getWorksheet("RMS") || wb.worksheets[0];
      if (!ws) return res.status(500).json({ message: "RMS template sheet not found." });

      // Header cells (column C in the template).
      const setCell = (addr: string, val: string) => {
        const cell = ws.getCell(addr);
        cell.value = val;
      };
      setCell("C1", parsed.header.date);
      setCell("C2", parsed.header.requester);
      setCell("C3", parsed.header.poNumber);
      setCell("C4", parsed.header.projectName);
      setCell("C5", parsed.header.completionDate);
      setCell("C6", parsed.header.deliveryTo);

      // Body rows — dynamic (no 50-item cap).  Written starting at row 9.
      // New 7-column layout: A=NO, B=SIZE, C=MATERIAL DESCRIPTION,
      //   D=On Hand, E=Order QTY, F=UNIT, G=REMARKS
      const itemsToWrite = parsed.items;
      const DATA_FONT = { size: 10, color: { theme: 1 as any }, name: "Calibri", family: 2, scheme: "minor" as any };
      const THIN_EDGE = { style: "thin" as const, color: { indexed: 64 } };
      const ALL_BORDERS = { left: THIN_EDGE, right: THIN_EDGE, top: THIN_EDGE, bottom: THIN_EDGE };

      let curRow = 9;
      for (let i = 0; i < itemsToWrite.length; i++) {
        const item = itemsToWrite[i];
        ws.getRow(curRow).height = 21;
        const sc = (col: number, val: any, halign = "center", wrap = false) => {
          const cell = ws.getCell(curRow, col);
          cell.value = val;
          cell.font = DATA_FONT;
          cell.border = ALL_BORDERS;
          cell.alignment = { horizontal: halign as any, vertical: "middle", wrapText: wrap };
        };
        sc(1, i + 1);
        sc(2, item.size || "");
        sc(3, item.name || "", "left", true);
        sc(4, item.onHand != null ? item.onHand : null);
        sc(5, item.qty || 0);
        sc(6, item.unit || "");
        sc(7, item.remarks || "");
        curRow++;
      }

      // Separator bar
      ws.getRow(curRow).height = 7.5;
      ws.mergeCells(`A${curRow}:G${curRow}`);
      const sepCell = ws.getCell(`A${curRow}`);
      sepCell.fill = { type: "pattern", pattern: "solid", fgColor: { theme: 0 as any, tint: -0.1499984740745262 }, bgColor: { indexed: 64 } };
      sepCell.border = { left: THIN_EDGE, right: THIN_EDGE, bottom: THIN_EDGE };
      curRow++;

      // REMARKS footer (3 merged rows)
      const remStart = curRow;
      ws.mergeCells(`A${remStart}:G${remStart + 2}`);
      const remCell = ws.getCell(`A${remStart}`);
      remCell.value = " REMARKS :     ";
      remCell.font = DATA_FONT;
      remCell.border = { left: THIN_EDGE, right: THIN_EDGE, top: THIN_EDGE };
      remCell.alignment = { horizontal: "left", vertical: "top" };
      ws.getRow(remStart).height = 40;

      const buf = await wb.xlsx.writeBuffer();

      // Best-effort: persist export history snapshot. Failures are logged but
      // do not interrupt the download response.
      let rmsFilename = `${((s: string) => (s || "").replace(/[\\/:*?"<>|]/g, "_").trim())(parsed.header.poNumber) || "RMS"}.xlsx`;
      try {
        const currentUser = (req as RequestWithUser).currentUser;
        const itemIds = itemsToWrite
          .map(i => i.itemId)
          .filter((v): v is number => typeof v === "number" && v > 0);
        const itemMap = new Map<number, Item>();
        if (itemIds.length > 0) {
          const { db } = await import("./db");
          const { items: itemsTable } = await import("../shared/schema");
          const { inArray } = await import("drizzle-orm");
          const rows = await db.select().from(itemsTable).where(inArray(itemsTable.id, itemIds));
          for (const r of rows) itemMap.set(r.id, r);
        }
        const lines: Omit<CreateRmsExportHistoryItem, "historyId">[] = itemsToWrite.map((it, idx) => {
          const dbItem = typeof it.itemId === "number" ? itemMap.get(it.itemId) : undefined;
          // Defensive: if the client sent an itemId that no longer resolves to
          // an existing items row, null the FK so the history insert can't
          // fail on a foreign-key violation.
          const safeItemId = dbItem ? dbItem.id : null;
          return {
            itemId: safeItemId,
            skuSnapshot: dbItem?.sku ?? null,
            nameSnapshot: it.name || dbItem?.name || null,
            sizeSnapshot: it.size || dbItem?.sizeLabel || null,
            unitSnapshot: it.unit || dbItem?.unitOfMeasure || null,
            qty: it.qty || 0,
            remarksSnapshot: it.remarks || null,
            onHandSnapshot: dbItem?.quantityOnHand ?? null,
            reorderPointSnapshot: dbItem?.reorderPoint ?? null,
            reorderQuantitySnapshot: dbItem?.reorderQuantity ?? null,
            minimumStockSnapshot: dbItem?.minimumStock ?? null,
            sortOrder: idx,
          };
        });
        const headerInsert: CreateRmsExportHistory = {
          exportType: "rms",
          exportedBy: currentUser?.id ?? null,
          exportedByName: currentUser?.name ?? currentUser?.email ?? null,
          requestFrom: parsed.header.requester || null,
          poNumber: parsed.header.poNumber || null,
          projectId: parsed.projectId ?? null,
          projectName: parsed.header.projectName || null,
          completionDate: parsed.header.completionDate || null,
          deliveryTo: parsed.header.deliveryTo || null,
          itemCount: itemsToWrite.length,
          status: "exported",
        };
        const created = await storage.createRmsExportHistory(headerInsert, lines);
        const seq = created.poSeq ?? 1;
        const safeFn = (s: string) => (s || "").replace(/[\\/:*?"<>|]/g, "_").trim();
        const poPart = safeFn(parsed.header.poNumber || "");
        const seqStr = String(seq).padStart(4, "0");
        rmsFilename = poPart ? `RMS-${poPart}-${seqStr}.xlsx` : `RMS-${seqStr}.xlsx`;
      } catch (histErr) {
        const msg = histErr instanceof Error ? histErr.message : String(histErr);
        console.error("[rms-export] failed to persist history:", msg);
      }

      const filename = rmsFilename;
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(Buffer.from(buf));
    } catch (err: any) {
      if (err?.issues) return res.status(400).json({ message: "Invalid export payload", issues: err.issues });
      res.status(500).json({ message: err.message || "Failed to export RMS" });
    }
  });

  // ─── Reorder: RMS export history ────────────────────────────────────────────
  app.get("/api/reorder/next-seq", isAuthenticated, requireManagerRead, async (req, res) => {
    try {
      const po = (req.query.po as string | undefined) || null;
      const nextSeq = await storage.getNextRmsSeq(po);
      res.set("Cache-Control", "no-store").json({ nextSeq });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to get next seq" });
    }
  });

  app.get("/api/reorder/history", isAuthenticated, requireManagerRead, async (_req, res) => {
    try {
      const rows = await storage.listRmsExportHistory(200);
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to load export history" });
    }
  });

  // ─── Reorder: Create pending history record (canonical endpoint) ───────────
  // POST /api/reorder/history is the official save endpoint; delegates to shared handler.
  app.post("/api/reorder/history", isAuthenticated, requireManager, handleSaveRmsPending);

  app.get("/api/reorder/history/:id", isAuthenticated, requireManagerRead, async (req, res) => {
    const id = parseIntParam(req.params.id, "id", res);
    if (id == null) return;
    try {
      const detail = await storage.getRmsExportHistoryDetail(id);
      if (!detail) return res.status(404).json({ message: "Not found" });
      res.json(detail);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to load export history detail" });
    }
  });

  const updateRmsHistorySchema = z.object({
    requestFrom: z.string().trim().max(255).nullable().optional(),
    poNumber: z.string().trim().max(255).nullable().optional(),
    projectName: z.string().trim().max(255).nullable().optional(),
    completionDate: z.string().trim().max(64).nullable().optional(),
    deliveryTo: z.string().trim().max(255).nullable().optional(),
  });

  app.patch("/api/reorder/history/:id", isAuthenticated, requireManager, async (req, res) => {
    const id = parseIntParam(req.params.id, "id", res);
    if (id == null) return;
    const parsed = updateRmsHistorySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid payload", issues: parsed.error.issues });
    }
    try {
      const updated = await storage.updateRmsExportHistory(id, parsed.data);
      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to update export history" });
    }
  });

  // ─── Reorder: Download Excel from existing history record ────────────────────
  app.post("/api/reorder/history/:id/download", isAuthenticated, requireManagerRead, async (req, res) => {
    const id = parseIntParam(req.params.id, "id", res);
    if (id == null) return;
    try {
      const detail = await storage.getRmsExportHistoryDetail(id);
      if (!detail) return res.status(404).json({ message: "Not found" });
      const ExcelJS = (await import("exceljs")).default;
      const templatePath = path.resolve(process.cwd(), "server/templates/rms-template.xlsx");
      if (!fs.existsSync(templatePath)) {
        return res.status(500).json({ message: "RMS template file is missing on server." });
      }
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(templatePath);
      const ws = wb.getWorksheet("RMS") || wb.worksheets[0];
      if (!ws) return res.status(500).json({ message: "RMS template sheet not found." });
      const setCell = (addr: string, val: string) => { ws.getCell(addr).value = val; };
      setCell("C1", detail.exportedAt ? new Date(detail.exportedAt).toISOString().slice(0, 10) : "");
      setCell("C2", detail.requestFrom || "");
      setCell("C3", detail.poNumber || "");
      setCell("C4", detail.projectName || "");
      setCell("C5", detail.completionDate || "");
      setCell("C6", detail.deliveryTo || "");
      const DATA_FONT = { size: 10, color: { theme: 1 as any }, name: "Calibri", family: 2, scheme: "minor" as any };
      const THIN_EDGE = { style: "thin" as const, color: { indexed: 64 } };
      const ALL_BORDERS = { left: THIN_EDGE, right: THIN_EDGE, top: THIN_EDGE, bottom: THIN_EDGE };
      const sortedLines = [...detail.lines].sort((a, b) => a.sortOrder - b.sortOrder);
      let curRow = 9;
      for (let i = 0; i < sortedLines.length; i++) {
        const item = sortedLines[i];
        ws.getRow(curRow).height = 21;
        const sc = (col: number, val: any, halign = "center", wrap = false) => {
          const cell = ws.getCell(curRow, col);
          cell.value = val;
          cell.font = DATA_FONT;
          cell.border = ALL_BORDERS;
          cell.alignment = { horizontal: halign as any, vertical: "middle", wrapText: wrap };
        };
        sc(1, i + 1);
        sc(2, item.sizeSnapshot || "");
        sc(3, item.nameSnapshot || "", "left", true);
        sc(4, item.onHandSnapshot != null ? item.onHandSnapshot : null);
        sc(5, item.qty || 0);
        sc(6, item.unitSnapshot || "");
        sc(7, item.remarksSnapshot || "");
        curRow++;
      }
      ws.getRow(curRow).height = 7.5;
      ws.mergeCells(`A${curRow}:G${curRow}`);
      const sepCell = ws.getCell(`A${curRow}`);
      sepCell.fill = { type: "pattern", pattern: "solid", fgColor: { theme: 0 as any, tint: -0.1499984740745262 }, bgColor: { indexed: 64 } };
      sepCell.border = { left: THIN_EDGE, right: THIN_EDGE, bottom: THIN_EDGE };
      curRow++;
      const remStart = curRow;
      ws.mergeCells(`A${remStart}:G${remStart + 2}`);
      const remCell = ws.getCell(`A${remStart}`);
      remCell.value = " REMARKS :     ";
      remCell.font = DATA_FONT;
      remCell.border = { left: THIN_EDGE, right: THIN_EDGE, top: THIN_EDGE };
      remCell.alignment = { horizontal: "left", vertical: "top" };
      ws.getRow(remStart).height = 40;
      const buf = await wb.xlsx.writeBuffer();
      await storage.updateRmsExportHistoryStatus(id, "exported");
      const safeFn = (s: string) => (s || "").replace(/[\\/:*?"<>|]/g, "_").trim();
      const poPart = safeFn(detail.poNumber || "");
      const seqStr = String(detail.poSeq ?? 1).padStart(4, "0");
      const filename = poPart ? `RMS-${poPart}-${seqStr}.xlsx` : `RMS-${seqStr}.xlsx`;
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(Buffer.from(buf));
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to download RMS Excel" });
    }
  });

  // ─── Reorder: Update items in a history record ────────────────────────────────
  const updateRmsItemsSchema = z.object({
    items: z.array(z.object({
      id: z.number().int().positive(),
      qty: z.number().int().min(0),
      sortOrder: z.number().int().min(0),
    })).min(0),
  });

  app.patch("/api/reorder/history/:id/items", isAuthenticated, requireManager, async (req, res) => {
    const id = parseIntParam(req.params.id, "id", res);
    if (id == null) return;
    const parsed = updateRmsItemsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid payload", issues: parsed.error.issues });
    }
    try {
      await storage.updateRmsExportHistoryItems(id, parsed.data.items);
      const updated = await storage.getRmsExportHistoryDetail(id);
      if (!updated) return res.status(404).json({ message: "Not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to update items" });
    }
  });

  // ─── Reorder: Add a new item to a pending history record ─────────────────────
  const addRmsItemSchema = z.object({
    itemId: z.number().int().positive().optional(),
    nameSnapshot: z.string().trim().min(1).max(500),
    sizeSnapshot: z.string().trim().max(255).optional(),
    unitSnapshot: z.string().trim().max(64).optional(),
    onHandSnapshot: z.number().int().min(0).optional(),
    qty: z.number().int().min(0).default(1),
  });

  app.post("/api/reorder/history/:id/items/add", isAuthenticated, requireManager, async (req, res) => {
    const id = parseIntParam(req.params.id, "id", res);
    if (id == null) return;
    const parsed = addRmsItemSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid payload", issues: parsed.error.issues });
    }
    try {
      const detail = await storage.getRmsExportHistoryDetail(id);
      if (!detail) return res.status(404).json({ message: "Not found" });
      if (detail.status !== "pending") {
        return res.status(409).json({ message: "Cannot modify a non-pending record" });
      }
      const updated = await storage.addRmsExportHistoryItem(id, parsed.data);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to add item" });
    }
  });

  // ─── Reorder: Batch-add items to a pending history record ────────────────────
  const addRmsItemsBatchSchema = z.object({
    items: z.array(z.object({
      itemId: z.number().int().positive().optional(),
      nameSnapshot: z.string().trim().min(1).max(500),
      sizeSnapshot: z.string().trim().max(255).optional(),
      unitSnapshot: z.string().trim().max(64).optional(),
      onHandSnapshot: z.number().int().min(0).optional(),
      qty: z.number().int().min(0).default(1),
    })).min(1).max(200),
  });

  app.post("/api/reorder/history/:id/items/add-batch", isAuthenticated, requireManager, async (req, res) => {
    const id = parseIntParam(req.params.id, "id", res);
    if (id == null) return;
    const parsed = addRmsItemsBatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid payload", issues: parsed.error.issues });
    }
    try {
      const detail = await storage.getRmsExportHistoryDetail(id);
      if (!detail) return res.status(404).json({ message: "Not found" });
      if (detail.status !== "pending") {
        return res.status(409).json({ message: "Cannot modify a non-pending record" });
      }
      const updated = await storage.addRmsExportHistoryItems(id, parsed.data.items);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to add items" });
    }
  });

  // ─── Reorder: Delete a single item from a pending history record ──────────────
  app.delete("/api/reorder/history/:id/items/:itemId", isAuthenticated, requireManager, async (req, res) => {
    const id = parseIntParam(req.params.id, "id", res);
    if (id == null) return;
    const itemId = parseIntParam(req.params.itemId, "itemId", res);
    if (itemId == null) return;
    try {
      const detail = await storage.getRmsExportHistoryDetail(id);
      if (!detail) return res.status(404).json({ message: "Not found" });
      if (detail.status !== "pending") {
        return res.status(409).json({ message: "Cannot modify a non-pending record" });
      }
      await storage.deleteRmsExportHistoryItem(id, itemId);
      res.json({ deleted: itemId });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to delete item" });
    }
  });

  const deleteRmsHistorySchema = z.object({
    ids: z.array(z.number().int().positive()).min(1).max(200),
  });

  app.delete("/api/reorder/history", isAuthenticated, requireManager, async (req, res) => {
    const parsed = deleteRmsHistorySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid payload", issues: parsed.error.issues });
    }
    try {
      const count = await storage.deleteRmsExportHistory(parsed.data.ids);
      res.json({ deleted: count });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to delete export history" });
    }
  });

  app.delete("/api/reorder/history/:id", isAuthenticated, requireManager, async (req, res) => {
    const id = parseIntParam(req.params.id, "id", res);
    if (id == null) return;
    try {
      const count = await storage.deleteRmsExportHistory([id]);
      if (count === 0) return res.status(404).json({ message: "Not found" });
      res.json({ deleted: count });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to delete export history" });
    }
  });

  // ─── Reports ─────────────────────────────────────────────────────────────────
  app.get("/api/reports/low-stock", isAuthenticated, requireManagerRead, async (_req, res) => {
    res.json(await storage.getReportLowStock());
  });

  app.get("/api/reports/by-location", isAuthenticated, requireManagerRead, async (_req, res) => {
    res.json(await storage.getReportByLocation());
  });

  app.get("/api/reports/valuation", isAuthenticated, requireManagerRead, async (_req, res) => {
    res.json(await storage.getReportValuation());
  });

  app.get("/api/reports/usage-by-project", isAuthenticated, requireManagerRead, async (_req, res) => {
    res.json(await storage.getReportUsageByProject());
  });

  // ─── Movement Drafts ─────────────────────────────────────────────────────────

  // Helper: managers and admins may access any draft; staff/viewer are limited to their own.
  function canAccessAllDrafts(role: string | null | undefined): boolean {
    return role === "admin" || role === "manager";
  }

  app.get("/api/drafts", isAuthenticated, loadCurrentUser, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user) return res.status(401).json({ message: "Authentication required" });
      const all = await storage.getDrafts();
      if (!canAccessAllDrafts(user.role)) {
        return res.json(all.filter(d => d.savedBy === user.id));
      }
      res.json(all);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/drafts/:id", isAuthenticated, loadCurrentUser, async (req: any, res) => {
    try {
      const id = parseIntParam(req.params.id, "id", res);
      if (id === null) return;
      const user = req.user;
      if (!user) return res.status(401).json({ message: "Authentication required" });
      const draft = await storage.getDraft(id);
      if (!draft) return res.status(404).json({ message: "Draft not found" });
      if (!canAccessAllDrafts(user.role) && draft.savedBy !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      res.json(draft);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/drafts", isAuthenticated, requireStaff, async (req, res) => {
    try {
      const { movementType, sourceLocationId, destinationLocationId, projectId, itemsJson, note } = req.body;
      if (!movementType) return res.status(400).json({ message: "movementType is required" });
      if (!itemsJson) return res.status(400).json({ message: "itemsJson is required" });

      const userId = getUserId(req);
      let savedByName: string | null = null;
      if (userId) {
        const user = await authStorage.getUser(userId);
        if (user) savedByName = user.name ?? (user.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : user.email ?? null);
      }

      const draft = await storage.createDraft({
        movementType,
        sourceLocationId: sourceLocationId ? Number(sourceLocationId) : null,
        destinationLocationId: destinationLocationId ? Number(destinationLocationId) : null,
        projectId: projectId ? Number(projectId) : null,
        itemsJson,
        note: note ?? null,
        savedBy: userId,
        savedByName,
      });
      res.status(201).json(draft);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/drafts/:id", isAuthenticated, requireStaff, async (req: any, res) => {
    try {
      const id = parseIntParam(req.params.id, "id", res);
      if (id === null) return;
      const draft = await storage.getDraft(id);
      if (!draft) return res.status(404).json({ message: "Draft not found" });
      const caller = req.currentUser;
      if (caller && !canAccessAllDrafts(caller.role) && draft.savedBy !== caller.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      await storage.deleteDraft(id);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/drafts/:id/confirm", isAuthenticated, requireStaff, async (req: any, res) => {
    try {
      const draftId = parseIntParam(req.params.id, "draftId", res);
      if (draftId === null) return;
      const draft = await storage.getDraft(draftId);
      if (!draft) return res.status(404).json({ message: "Draft not found" });
      const caller = req.currentUser;
      if (caller && !canAccessAllDrafts(caller.role) && draft.savedBy !== caller.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      // ── Validate each item in the draft before confirming ───────────────────
      let draftItems: any[] = [];
      try { draftItems = JSON.parse((draft as any).itemsJson || "[]"); } catch (_) {}

      const confirmErrors: { field: string; message: string; item?: string }[] = [];
      for (const di of draftItems) {
        const vr = validateDraftForConfirmation({
          itemId:               di.itemId              ?? null,
          movementType:         (draft as any).movementType         ?? null,
          quantity:             di.qty                 ?? null,
          sourceLocationId:     (draft as any).sourceLocationId     ?? null,
          destinationLocationId: (draft as any).destinationLocationId ?? null,
        });
        if (!vr.valid) {
          const label = di.itemName ? `"${di.itemName}"` : `item #${di.itemId}`;
          for (const [field, message] of Object.entries(vr.errors)) {
            confirmErrors.push({ field, message, item: label });
          }
        }
      }
      if (confirmErrors.length > 0) {
        return res.status(400).json({ message: "Validation failed", errors: confirmErrors });
      }

      const movementIds = await storage.confirmDraft(draftId, getUserId(req));

      // Sync asset status for each asset-tracked item in the draft
      const draftMT = draft.movementType;
      if (draftMT === "issue" || draftMT === "return") {
        const assignedTo = draftMT === "issue" ? getUserDisplayName(req) : null;
        for (const di of draftItems) {
          try {
            const explicitIds = Array.isArray((di as any).assetIds) && (di as any).assetIds.length > 0
              ? ((di as any).assetIds as any[]).map(Number)
              : null;
            if (explicitIds) {
              await storage.applyAssetMovementByIds(explicitIds, draftMT, {
                itemId: di.itemId,
                projectId: draftMT === "issue" ? ((draft as any).projectId ?? null) : null,
                locationId: (draft as any).destinationLocationId ?? null,
                assignedTo,
              });
            } else {
              await storage.syncAssetStatusOnMovement(di.itemId, draftMT, di.qty, {
                projectId: draftMT === "issue" ? ((draft as any).projectId ?? null) : null,
                locationId: (draft as any).destinationLocationId ?? null,
                assignedTo,
              });
            }
          } catch (_) { /* non-fatal */ }
        }
      }

      res.json({ ok: true, movementIds });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/upload/item-image", isAuthenticated, requireManager, upload.single("file"), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No file or unsupported file type. Allowed: jpg, jpeg, png, webp (max 8 MB)." });
    }
    // Validate actual file content against declared MIME type (magic bytes check)
    try {
      const header = Buffer.allocUnsafe(12);
      const fd = fs.openSync(req.file.path, "r");
      const bytesRead = fs.readSync(fd, header, 0, 12, 0);
      fs.closeSync(fd);
      if (bytesRead < 12 || !isImageMagicBytes(header, req.file.mimetype)) {
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({ message: "File content does not match the declared image type." });
      }
    } catch {
      fs.unlink(req.file.path, () => {});
      return res.status(500).json({ message: "Failed to validate uploaded file." });
    }
    // Convert to a self-contained JPEG base64 data URI so the image survives
    // server restarts and redeployments (no filesystem dependency).
    // sharp also corrects EXIF orientation and resizes to max 1200×1200.
    try {
      const jpegBuf = await sharp(req.file.path)
        .rotate()
        .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 82, mozjpeg: true })
        .toBuffer();
      const dataUri = `data:image/jpeg;base64,${jpegBuf.toString("base64")}`;
      res.json({ url: dataUri });
    } catch {
      return res.status(500).json({ message: "Failed to process uploaded image." });
    } finally {
      fs.unlink(req.file.path, () => {});
    }
  });

  app.patch("/api/inventory/:id/image", isAuthenticated, requireManager, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { imageUrl } = req.body;
      await storage.setItemImage(id, imageUrl ?? null);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ─── Item Image Gallery (multi-image, max 4) ─────────────────────────────────

  app.get("/api/inventory/:id/images", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid item id" });
      const images = await storage.getItemImages(id);
      res.json(images);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/inventory/:id/images", isAuthenticated, requireManager, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid item id" });
      const item = await storage.getItem(id);
      if (!item) return res.status(404).json({ message: "Item not found" });
      const { imageUrl, altText } = req.body;
      if (!imageUrl || typeof imageUrl !== "string" || !imageUrl.trim()) {
        return res.status(400).json({ message: "imageUrl is required" });
      }
      const images = await storage.appendItemImage(id, imageUrl.trim(), altText ?? null);
      res.status(201).json(images);
    } catch (err: any) {
      const status = err.message?.includes("최대 4장") ? 400 : 500;
      res.status(status).json({ message: err.message });
    }
  });

  app.delete("/api/inventory/:id/images/:imageId", isAuthenticated, requireManager, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const imageId = parseInt(req.params.imageId);
      if (isNaN(id) || isNaN(imageId)) return res.status(400).json({ message: "Invalid id" });
      const images = await storage.deleteItemImage(id, imageId);
      res.json(images);
    } catch (err: any) {
      const status = err.message?.includes("찾을 수 없습니다") ? 404 : 500;
      res.status(status).json({ message: err.message });
    }
  });

  app.patch("/api/inventory/:id/images/reorder", isAuthenticated, requireManager, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid item id" });
      const { imageIds } = req.body;
      if (!Array.isArray(imageIds) || imageIds.some(x => typeof x !== "number")) {
        return res.status(400).json({ message: "imageIds must be an array of numbers" });
      }
      const images = await storage.reorderItemImages(id, imageIds);
      res.json(images);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/inventory/:id/images/:imageId/primary", isAuthenticated, requireManager, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const imageId = parseInt(req.params.imageId);
      if (isNaN(id) || isNaN(imageId)) return res.status(400).json({ message: "Invalid id" });
      const images = await storage.setItemImagePrimary(id, imageId);
      res.json(images);
    } catch (err: any) {
      const status = err.message?.includes("찾을 수 없습니다") ? 404 : 500;
      res.status(status).json({ message: err.message });
    }
  });

  // ─── Admin Gate ─────────────────────────────────────────────────────────────
  function sha256hex(s: string): string {
    return crypto.createHash("sha256").update(s).digest("hex");
  }

  // Keep legacy admin session endpoints for compatibility
  app.post("/api/admin/verify", isAuthenticated, (req: any, res) => {
    res.json({ success: true });
  });

  app.get("/api/admin/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) return res.json({ isAdmin: false });
      const { authStorage } = await import("./replit_integrations/auth/storage");
      const user = await authStorage.getUser(userId);
      res.json({ isAdmin: user?.role === "admin" && user?.status === "active" });
    } catch {
      res.json({ isAdmin: false });
    }
  });

  app.post("/api/admin/logout", isAuthenticated, (req: any, res) => {
    res.json({ success: true });
  });

  // ─── User Management (Admin Only) ────────────────────────────────────────────
  app.get("/api/admin/users", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { authStorage } = await import("./replit_integrations/auth/storage");
      const status = req.query.status as string | undefined;
      const users = await authStorage.listUsers(status);
      const safe = users.map(({ passwordHash: _ph, ...u }: any) => u);
      res.json(safe);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/users/:id", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      if (req.params.id === req.session?.userId) {
        return res.status(400).json({ message: "You cannot modify your own role or status." });
      }
      const { authStorage } = await import("./replit_integrations/auth/storage");
      const { role, status } = req.body ?? {};
      const allowed: Record<string, string[]> = {
        role: ["admin", "manager", "manager_viewer", "staff", "viewer"],
        status: ["active", "pending", "rejected"],
      };
      const update: Record<string, string> = {};
      if (role !== undefined) {
        if (!allowed.role.includes(role)) return res.status(400).json({ message: "Invalid role" });
        update.role = role;
      }
      if (status !== undefined) {
        if (!allowed.status.includes(status)) return res.status(400).json({ message: "Invalid status" });
        update.status = status;
      }
      if (Object.keys(update).length === 0) return res.status(400).json({ message: "Nothing to update" });
      const user = await authStorage.updateUser(req.params.id, update);
      if (!user) return res.status(404).json({ message: "User not found" });
      const { passwordHash: _ph, ...safe } = user as any;
      res.json(safe);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/users/:id/approve", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { authStorage } = await import("./replit_integrations/auth/storage");
      const { role } = req.body ?? {};
      const update: any = { status: "active" };
      if (role && ["admin", "manager", "manager_viewer", "staff", "viewer"].includes(role)) update.role = role;
      const user = await authStorage.updateUser(req.params.id, update);
      if (!user) return res.status(404).json({ message: "User not found" });
      const { passwordHash: _ph, ...safe } = user as any;
      res.json(safe);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/users/:id/reject", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { authStorage } = await import("./replit_integrations/auth/storage");
      const user = await authStorage.updateUserStatus(req.params.id, "rejected");
      if (!user) return res.status(404).json({ message: "User not found" });
      const { passwordHash: _ph, ...safe } = user as any;
      res.json(safe);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/users/:id", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { authStorage } = await import("./replit_integrations/auth/storage");
      const user = await authStorage.getUser(req.params.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.status !== "rejected") return res.status(400).json({ message: "Only rejected users can be deleted" });
      await authStorage.deleteUser(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ─── Admin Audit: Reel Eligibility Dry-Run ───────────────────────────────────
  // Read-only, non-blocking. Shows how every item is classified so admins can
  // verify accuracy before any future server-side enforcement is enabled.
  app.get("/api/admin/audit/reel-eligibility", isAuthenticated, requireAdmin, async (_req, res) => {
    try {
      const { items: allItems } = await storage.getItems({ perPage: 999999, sort: "name", dir: "asc" });
      const report = allItems.map(item => {
        const clf = classifyReel({
          name:         item.name,
          sku:          item.sku,
          baseItemName: (item as any).baseItemName ?? null,
          subcategory:  (item as any).subcategory  ?? null,
          detailType:   (item as any).detailType   ?? null,
          unitOfMeasure: item.unitOfMeasure,
          category:     item.category ? { name: item.category.name, code: (item.category as any).code ?? null } : null,
        });
        return {
          id:           item.id,
          sku:          item.sku,
          name:         item.name,
          category:     item.category?.name ?? null,
          subcategory:  (item as any).subcategory  ?? null,
          detailType:   (item as any).detailType   ?? null,
          unitOfMeasure: item.unitOfMeasure,
          reelEligible: clf.eligible,
          rule:         clf.rule,
          matchedTerm:  clf.matchedTerm,
        };
      });
      res.json({
        generatedAt: new Date().toISOString(),
        totalItems:  report.length,
        eligible:    report.filter(r => r.reelEligible).length,
        ineligible:  report.filter(r => !r.reelEligible).length,
        items:       report,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ─── Admin Export: Full Inventory → Excel (.xlsx) ────────────────────────────
  app.get("/api/admin/export/inventory-xlsx", isAuthenticated, requireAdmin, async (_req, res) => {
    try {
      const ExcelJS = (await import("exceljs")).default;

      // 1. Fetch all active categories (sorted)
      const allCategories = await storage.getCategories();

      // 2. Fetch ALL active items with relations (no pagination for export)
      const { items: allItems } = await storage.getItems({ perPage: 999999 });

      // 3. Group items by categoryId
      const byCategoryId = new Map<number, typeof allItems>();
      for (const item of allItems) {
        const catId = item.categoryId ?? -1;
        if (!byCategoryId.has(catId)) byCategoryId.set(catId, []);
        byCategoryId.get(catId)!.push(item);
      }

      // 4. Build workbook
      const wb = new ExcelJS.Workbook();
      wb.creator = "VoltStock – TK Electric";
      wb.created = new Date();

      // ── Helper: export filename ───────────────────────────────────────────────────
      const buildExportFilename = (): string => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        return `SA WAREHOUSE MATERIAL STATUS-${year}-${month}.xlsx`;
      };

      // ── Helper: sanitize Excel worksheet name ─────────────────────────────────────
      const usedSheetNames = new Set<string>();
      const toSheetName = (name: string): string => {
        let s = name
          .replace(/\//g, "&")
          .replace(/[*?:\\\[\]]/g, "")
          .trim() || "Sheet";
        s = s.slice(0, 31);
        if (!usedSheetNames.has(s)) { usedSheetNames.add(s); return s; }
        for (let i = 2; ; i++) {
          const suffix = ` (${i})`;
          const candidate = s.slice(0, 31 - suffix.length) + suffix;
          if (!usedSheetNames.has(candidate)) { usedSheetNames.add(candidate); return candidate; }
        }
      };

      // ── Helper: compute item status ───────────────────────────────────────────────
      const itemStatus = (item: any): string => {
        if (item.statusOverride) return item.statusOverride;
        const qty = item.quantityOnHand ?? 0;
        const min = item.minimumStock ?? 0;
        const reorder = item.reorderPoint ?? 0;
        if (qty === 0) return "Out of Stock";
        if (qty <= reorder || qty <= min) return "Low Stock";
        return "In Stock";
      };

      // ── Colour palette ────────────────────────────────────────────────────────────
      const C = {
        headerBg:  "FF1A2E44",  // dark navy   – header row
        l1Bg:      "FF2D3748",  // dark slate  – level-1 group (subcategory)
        mfrBg:     "FF2D6E8E",  // medium teal-blue – manufacturer brand header
        mfrText:   "FFFFFFFF",  // white            – manufacturer brand text
        l2Bg:      "FFFFF2CC",  // soft golden-yellow – level-2 group (detailType)
        l3Bg:      "FFE8F0FD",  // pale blue   – level-3 group (baseItemName)
        l3Text:    "FF1E3A5F",  // dark blue   – level-3 text
        white:     "FFFFFFFF",
        darkText:  "FF1A1A1A",
        greenText: "FF1D6B3B",  greenBg: "FFD6F5E3",  // In Stock
        redText:   "FF9B1C1C",  redBg:   "FFFDE8E8",  // Out of Stock
        orangeText:"FF92400E",  orangeBg:"FFFEF3C7",  // Low Stock
      } as const;

      // ── Size sort helper ─────────────────────────────────────────────────────────
      // AWG/KCMIL wire sizes checked first (1/0, 2/0, #12, etc.) then conduit inch-sizes.
      const EXPORT_AWG_MAP: Record<string, number> = {
        '#14': 100, '#12': 200, '#10': 300,
        '#8': 400, '#6': 500, '#4': 600, '#3': 700, '#2': 800, '#1': 900,
        '1/0': 1000, '2/0': 1100, '3/0': 1200, '4/0': 1300,
        '250 KCMIL': 1400, '300 KCMIL': 1500, '350 KCMIL': 1600, '400 KCMIL': 1700,
        '500 KCMIL': 1800, '600 KCMIL': 1900, '750 KCMIL': 2000, '1000 KCMIL': 2100,
      };
      function detailTypeKey(t: string): number {
        if (!t) return 999_999;
        if (EXPORT_AWG_MAP[t] !== undefined) return EXPORT_AWG_MAP[t];
        const stripped = t.replace(/^#/, "");
        if (EXPORT_AWG_MAP[stripped] !== undefined) return EXPORT_AWG_MAP[stripped];
        if (EXPORT_AWG_MAP[`#${stripped}`] !== undefined) return EXPORT_AWG_MAP[`#${stripped}`];
        if (/^\d+$/.test(stripped) && parseInt(stripped) >= 250) {
          const kcmilKey = `${stripped} KCMIL`;
          if (EXPORT_AWG_MAP[kcmilKey] !== undefined) return EXPORT_AWG_MAP[kcmilKey];
        }
        return 999_999;
      }

      function exportSizeKey(item: any): number {
        const label = (item.sizeLabel ?? "").trim();
        if (!label) return 999999;
        // AWG/KCMIL lookup takes priority (standardised wire-size sort order)
        if (EXPORT_AWG_MAP[label] !== undefined) return EXPORT_AWG_MAP[label];
        // Strip leading # and retry (e.g. "#1/0" → "1/0")
        const stripped = label.replace(/^#/, "");
        if (EXPORT_AWG_MAP[stripped] !== undefined) return EXPORT_AWG_MAP[stripped];
        // Try adding # prefix (e.g. "12" → "#12", "10" → "#10")
        const hashLabel = `#${label}`;
        if (EXPORT_AWG_MAP[hashLabel] !== undefined) return EXPORT_AWG_MAP[hashLabel];
        // N/0-suffix range: "1/0-14AWG", "2/0-14AWG" → sort by primary conductor
        const slashORange = label.match(/^(\d+\/0)-/);
        if (slashORange && EXPORT_AWG_MAP[slashORange[1]] !== undefined) return EXPORT_AWG_MAP[slashORange[1]];
        // NNNMCM-MAWG range: "250MCM-6AWG", "500MCM-4AWG" → sort by KCMIL value
        const mcmRange = label.match(/^(\d+)MCM-/i);
        if (mcmRange) {
          const key = `${mcmRange[1]} KCMIL`;
          if (EXPORT_AWG_MAP[key] !== undefined) return EXPORT_AWG_MAP[key];
          return 2000 + (parseInt(mcmRange[1]) - 750) / 5;
        }
        // N-MMMKCMIL/MCM range: "1000-500MCM" → sort by first number (KCMIL)
        const kcmilSuffix = label.match(/^(\d+)-\d+(MCM|KCMIL)/i);
        if (kcmilSuffix) {
          const key = `${kcmilSuffix[1]} KCMIL`;
          if (EXPORT_AWG_MAP[key] !== undefined) return EXPORT_AWG_MAP[key];
          return 2000 + (parseInt(kcmilSuffix[1]) - 750) / 5;
        }
        // N-MAWG or N-M range: "2-14AWG", "4-14" → sort by primary AWG gauge
        const awgRange = label.match(/^(\d+)-(\d+)(AWG)?$/i);
        if (awgRange) {
          const first = parseInt(awgRange[1]);
          if (first >= 200) {
            const key = `${first} KCMIL`;
            if (EXPORT_AWG_MAP[key] !== undefined) return EXPORT_AWG_MAP[key];
            return 2000 + (first - 750) / 5;
          }
          const v = EXPORT_AWG_MAP[`#${first}`];
          if (v !== undefined) return v;
        }
        // Fall back to DB sizeSortValue for non-AWG sizes
        const dbVal = item.sizeSortValue ?? 0;
        if (dbVal !== 0) return dbVal;
        // Conduit / inch-based sizes
        const clean = label.replace(/['"]/g, "").trim();
        // compound fraction: 1-1/4, 1-1/2, 2-1/2, 3-1/2
        const compound = clean.match(/^(\d+)[-\s](\d+)\/(\d+)$/);
        if (compound) return (+compound[1] + +compound[2] / +compound[3]) * 1000;
        // simple fraction: 1/2, 3/4 (denominator ≠ 0 to avoid N/0 wire sizes slipping through)
        const frac = clean.match(/^(\d+)\/(\d+)$/);
        if (frac && frac[2] !== "0") return (+frac[1] / +frac[2]) * 1000;
        // plain integer / decimal: 1, 2, 3, 4, 6
        const num = parseFloat(clean);
        if (!isNaN(num)) return num * 1000;
        return 999999;
      }

      // ── Column-letter helper (supports > 26 columns) ──────────────────────────────
      const colLetter = (n: number): string => {
        if (n <= 26) return String.fromCharCode(64 + n);
        return String.fromCharCode(64 + Math.floor((n - 1) / 26)) + String.fromCharCode(64 + ((n - 1) % 26 + 1));
      };

      // ── 9 base export columns (Manufacturer inserted between Size and Family) ──────
      const COLS = [
        { key: "matName",   header: "Material Name", width: 36 },
        { key: "size",      header: "Size",          width: 14 },
        { key: "mfr",       header: "Manufacturer",  width: 22 },
        { key: "family",    header: "Family",        width: 22 },
        { key: "type",      header: "Type",          width: 20 },
        { key: "qty",       header: "Quantity",      width: 12 },
        { key: "unit",      header: "Unit",          width: 10 },
        { key: "status",    header: "Status",        width: 16 },
        { key: "updatedAt", header: "Last Updated",  width: 16 },
      ];

      // ── Pre-fetch item_groups image map (priority-1 images for PHOTO cells) ────
      // Keys: "${categoryId}:${baseItemName}" → imageUrl
      const itemGroupImageMap = await storage.getItemGroupImages();

      // ── Pre-fetch item_groups drag-and-drop sort order map ────────────────────
      // Keys: "${categoryId}:${baseItemName}" → sortOrder (lower = higher up)
      const itemGroupSortOrderMap = await storage.getItemGroupSortOrders();

      // ── Workbook-level image cache ────────────────────────────────────────────
      // Maps image URL → ExcelJS imageId so the same URL is fetched/decoded and
      // added to the workbook only once, even when it appears in multiple cells
      // or on multiple sheets. Reusing an existing imageId is free.
      const imageIdCache = new Map<string, number>();

      // ── Build one worksheet per category ─────────────────────────────────────────
      for (const cat of allCategories) {
        const catItems = byCategoryId.get(cat.id);
        if (!catItems || catItems.length === 0) continue;

        const ws = wb.addWorksheet(toSheetName(cat.name));

        // ── Per-sheet reel eligibility — only items in this category ─────────────
        // This ensures non-reel sheets have zero reel columns; reel sheets use
        // only their own maximum active-reel count, not a global cross-sheet max.
        const catReelEligibleIds = catItems
          .filter(item => resolveReelMode({
            name:          item.name,
            sku:           item.sku,
            subcategory:   item.subcategory,
            detailType:    item.detailType,
            baseItemName:  item.baseItemName,
            unitOfMeasure: item.unitOfMeasure,
            trackingMode:  item.trackingMode,
            category:      { name: cat.name, code: cat.code },
          }))
          .map(item => item.id);
        const catReelEligibleSet = new Set<number>(catReelEligibleIds);
        const catReelExportMap   = catReelEligibleIds.length > 0
          ? await storage.getWireReelExportData(catReelEligibleIds)
          : new Map<number, Array<{ reelId: string; lengthFt: number }>>();
        let catMaxReelCount = 0;
        for (const reels of catReelExportMap.values()) {
          if (reels.length > catMaxReelCount) catMaxReelCount = reels.length;
        }
        const catReelSummaryCols = catMaxReelCount > 0 ? 2 : 0;
        const totalCols          = COLS.length + catReelSummaryCols + catMaxReelCount;

        // Base columns + reel summary + reel detail columns
        // PHOTO column is prepended as column 1 (image-only — no key in rowData)
        const wsColDefs: { key: string; width: number }[] = [
          { key: "photo", width: 20 },
          ...COLS.map(c => ({ key: c.key, width: c.width })),
        ];
        if (catMaxReelCount > 0) {
          wsColDefs.push({ key: "reelQty",   width: 13 }); // Quantity (ft)
          wsColDefs.push({ key: "reelCount",  width: 13 }); // Total Reels
          for (let n = 1; n <= catMaxReelCount; n++) {
            wsColDefs.push({ key: `reel${n}`, width: 11 });
          }
        }
        ws.columns = wsColDefs;

        // ── Per-sheet Material Name width tracking ────────────────────────────────
        // Seeded with the header text length (13) so header is never clipped.
        let maxMatNameLen = 13;

        // ── Header row ────────────────────────────────────────────────────────────
        const headerValues: string[] = ["PHOTO", ...COLS.map(c => c.header)];
        if (catMaxReelCount > 0) {
          headerValues.push("Quantity", "Total Reels");
          for (let n = 1; n <= catMaxReelCount; n++) headerValues.push(`Reel #${n}`);
        }
        const headerRow = ws.addRow(headerValues);
        headerRow.height = 22;
        headerRow.eachCell({ includeEmpty: true }, cell => {
          cell.font      = { bold: true, size: 11, color: { argb: C.white } };
          cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: C.headerBg } };
          cell.alignment = { vertical: "middle", horizontal: "center" };
          cell.border    = { bottom: { style: "thin", color: { argb: C.white } } };
        });

        // ── Sort: subcategory (family) → manufacturer (branded first, alpha) → detailType → drag-and-drop → size ──
        const sorted = [...catItems].sort((a, b) => {
          const fa = (a.subcategory || "\uFFFF").toLowerCase();
          const fb = (b.subcategory || "\uFFFF").toLowerCase();
          if (fa !== fb) return fa.localeCompare(fb);
          const ma = a.manufacturer?.trim() || null;
          const mb = b.manufacturer?.trim() || null;
          if (ma !== mb) {
            if (!ma && mb) return 1;   // unbranded after branded
            if (ma && !mb) return -1;  // branded before unbranded
            return ma!.localeCompare(mb!);
          }
          const ta = a.detailType || "";
          const tb = b.detailType || "";
          if (ta !== tb) {
            const ka = detailTypeKey(ta);
            const kb = detailTypeKey(tb);
            if (ka !== kb) return ka - kb;
            return ta.toLowerCase().localeCompare(tb.toLowerCase());
          }
          const na = a.baseItemName || a.name || "";
          const nb = b.baseItemName || b.name || "";
          // Use drag-and-drop sort order if available; fall back to alphabetical
          const sa = itemGroupSortOrderMap.get(`${cat.id}:${na}`) ?? 1_000_000;
          const sb = itemGroupSortOrderMap.get(`${cat.id}:${nb}`) ?? 1_000_000;
          if (sa !== sb) return sa - sb;
          if (na.toLowerCase() !== nb.toLowerCase()) return na.toLowerCase().localeCompare(nb.toLowerCase());
          // Within same base: size small → large
          return exportSizeKey(a) - exportSizeKey(b);
        });

        // ── Group-row helper ──────────────────────────────────────────────────────
        // PHOTO col (col 1) is intentionally excluded from the merge so the
        // base-item image block can span it independently.
        const addGroupRow = (label: string, level: 1 | 2 | 3) => {
          // col 1 = PHOTO (blank), col 2 = label
          const gRow = ws.addRow(["", label]);
          if (level === 1) {
            gRow.height = 20;
            gRow.eachCell({ includeEmpty: true }, cell => {
              cell.font      = { bold: true, size: 11, color: { argb: C.white } };
              cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: C.l1Bg } };
              cell.alignment = { vertical: "middle", indent: 1 };
            });
          } else if (level === 2) {
            gRow.height = 18;
            gRow.eachCell({ includeEmpty: true }, cell => {
              cell.font      = { bold: true, size: 10, color: { argb: C.darkText } };
              cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: C.l2Bg } };
              cell.alignment = { vertical: "middle", indent: 2 };
            });
          } else {
            gRow.height = 16;
            gRow.eachCell({ includeEmpty: true }, cell => {
              cell.font      = { bold: true, size: 9, color: { argb: C.l3Text } };
              cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: C.l3Bg } };
              cell.alignment = { vertical: "middle", indent: 3 };
              cell.border    = { bottom: { style: "hair", color: { argb: "FFBFD4F0" } } };
            });
          }
          // Merge from col 2 (label column) to the last column; col 1 (PHOTO) stays separate
          ws.mergeCells(gRow.number, 2, gRow.number, totalCols + 1);
        };

        // ── Manufacturer brand header row ─────────────────────────────────────────
        // Emitted only when the item has a non-blank manufacturer value.
        // Uses a warm wheat/tan background to visually separate brand sections.
        const addMfrRow = (mfrName: string) => {
          const mRow = ws.addRow(["", mfrName]);
          mRow.height = 19;
          mRow.eachCell({ includeEmpty: true }, cell => {
            cell.font      = { bold: true, size: 10, color: { argb: C.mfrText } };
            cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: C.mfrBg } };
            cell.alignment = { vertical: "middle", indent: 1 };
            cell.border    = { top: { style: "thin", color: { argb: C.mfrBg } } };
          });
          ws.mergeCells(mRow.number, 2, mRow.number, totalCols + 1);
        };

        // ── Add grouped data rows ─────────────────────────────────────────────────
        const SENTINEL = "\x00__sentinel__";
        let lastManufacturer: string = SENTINEL;
        let lastFamily: string = SENTINEL;
        let lastType:   string = SENTINEL;
        let lastBase:   string = SENTINEL;

        // ── Base-block PHOTO merge tracking ──────────────────────────────────────
        // For each level-3 (baseItemName) block we merge PHOTO col (col 1) across
        // the level-3 header row + all item rows, then embed one representative image.
        let photoBaseStartRow: number | null = null;
        let photoBaseEndRow:   number        = 0;
        let photoBaseImageUrl: string | null = null;

        const finalizePhotoBlock = async () => {
          if (photoBaseStartRow === null) return;
          const startRow = photoBaseStartRow;
          const endRow   = photoBaseEndRow;
          // Merge PHOTO col vertically across the full block
          if (endRow >= startRow) {
            ws.mergeCells(startRow, 1, endRow, 1);
            const mc = ws.getCell(startRow, 1);
            mc.alignment = { vertical: "middle", horizontal: "center" };
          }
          // Embed representative image if one was found
          if (photoBaseImageUrl) {
            const srcUrl = photoBaseImageUrl;
            try {
              // ── Cache hit: reuse existing imageId without re-fetching ──────────
              const cachedId = imageIdCache.get(srcUrl);
              if (cachedId !== undefined) {
                ws.addImage(cachedId, {
                  tl: { col: 0, row: startRow - 1 },
                  br: { col: 1, row: endRow },
                  editAs: "oneCell",
                });
              } else {
                // ── Cache miss: fetch / decode, then store in cache ──────────────
                let buf: Buffer | null = null;
                let ext: "jpeg" | "png" | null = null;

                if (srcUrl.startsWith("data:image/")) {
                  // ── base64 data URI ───────────────────────────────────────────
                  const semicolon = srcUrl.indexOf(";");
                  const comma     = srcUrl.indexOf(",");
                  if (semicolon === -1 || comma === -1) {
                    console.warn("[export] PHOTO: malformed data URI, skipping:", srcUrl.slice(0, 60));
                  } else {
                    const mime    = srcUrl.slice("data:image/".length, semicolon).toLowerCase();
                    const rawExt  = mime === "jpg" || mime === "jpeg" ? "jpeg"
                                  : mime === "png" ? "png"
                                  : mime === "webp" ? "webp"
                                  : null;
                    if (!rawExt) {
                      console.warn("[export] PHOTO: unsupported data URI mime type:", mime, "— skipping");
                    } else {
                      ext = rawExt;
                      buf = Buffer.from(srcUrl.slice(comma + 1), "base64");
                    }
                  }
                } else if (srcUrl.startsWith("https://")) {
                  // ── remote https:// image — fetch with timeout + size cap ──────
                  try {
                    const controller = new AbortController();
                    const timer = setTimeout(() => controller.abort(), 5000);
                    const fetchRes = await fetch(srcUrl, {
                      signal: controller.signal,
                      headers: { "User-Agent": "VoltStock-Export/1.0" },
                    });
                    clearTimeout(timer);
                    if (fetchRes.ok) {
                      const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
                      const ct = fetchRes.headers.get("content-type") ?? "";
                      const remoteExt: "jpeg" | "png" | null =
                        ct.includes("png") ? "png" :
                        ct.includes("jpeg") || ct.includes("jpg") ? "jpeg" :
                        null;
                      if (remoteExt) {
                        const arrayBuf = await fetchRes.arrayBuffer();
                        if (arrayBuf.byteLength <= MAX_BYTES) {
                          buf = Buffer.from(arrayBuf);
                          ext = remoteExt;
                        } else {
                          console.warn("[export] PHOTO: remote image too large, skipping:", srcUrl.slice(0, 80));
                        }
                      } else {
                        // Try to infer extension from URL when Content-Type is generic
                        const urlLower = srcUrl.split("?")[0].toLowerCase();
                        const inferredExt: "jpeg" | "png" | null =
                          urlLower.endsWith(".png") ? "png" :
                          urlLower.endsWith(".jpg") || urlLower.endsWith(".jpeg") ? "jpeg" :
                          null;
                        if (inferredExt) {
                          const arrayBuf = await fetchRes.arrayBuffer();
                          if (arrayBuf.byteLength <= MAX_BYTES) {
                            buf = Buffer.from(arrayBuf);
                            ext = inferredExt;
                          }
                        } else {
                          // Default to jpeg for unknown types (Google thumbnails etc.)
                          const arrayBuf = await fetchRes.arrayBuffer();
                          if (arrayBuf.byteLength > 0 && arrayBuf.byteLength <= MAX_BYTES) {
                            buf = Buffer.from(arrayBuf);
                            ext = "jpeg";
                          }
                        }
                      }
                    } else {
                      console.warn("[export] PHOTO: remote fetch returned", fetchRes.status, "—", srcUrl.slice(0, 80));
                    }
                  } catch (fetchErr: any) {
                    console.warn("[export] PHOTO: remote fetch failed:", fetchErr?.message ?? fetchErr, "—", srcUrl.slice(0, 80));
                  }
                } else if (srcUrl.startsWith("/uploads/")) {
                  // ── local /uploads/ file ──────────────────────────────────────
                  const filename = srcUrl.slice("/uploads/".length);
                  const fsPath   = path.join(process.cwd(), "uploads", filename);
                  if (fs.existsSync(fsPath)) {
                    const raw = path.extname(fsPath).slice(1).toLowerCase();
                    const localExt = raw === "jpg" || raw === "jpeg" ? "jpeg" : raw === "png" ? "png" : null;
                    if (!localExt) {
                      console.warn("[export] PHOTO: unsupported local file extension", raw, "—", fsPath);
                    } else {
                      buf = fs.readFileSync(fsPath);
                      ext = localExt;
                    }
                  } else {
                    console.warn("[export] PHOTO: local file not found:", fsPath);
                  }
                } else {
                  console.warn("[export] PHOTO: unrecognised image source format, skipping:", srcUrl.slice(0, 80));
                }

                if (buf && ext) {
                  const imageId = wb.addImage({ buffer: buf, extension: ext });
                  imageIdCache.set(srcUrl, imageId);
                  ws.addImage(imageId, {
                    tl: { col: 0, row: startRow - 1 },
                    br: { col: 1, row: endRow },
                    editAs: "oneCell",
                  });
                }
              }
            } catch (err) {
              console.warn("[export] PHOTO: unexpected error embedding image from", srcUrl.slice(0, 80), "—", err);
            }
          }
          photoBaseStartRow = null;
          photoBaseImageUrl = null;
        };

        for (const item of sorted) {
          const mfr     = item.manufacturer?.trim() || null;
          const family  = item.subcategory ?? null;
          const type    = item.detailType  ?? null;
          const base    = item.baseItemName || item.name || null;
          const status  = itemStatus(item);
          const qty     = item.quantityOnHand ?? 0;

          const mfrKey    = mfr    ?? "";
          const familyKey = family ?? "";
          const typeKey   = type   ?? "";
          const baseKey   = base   ?? "";

          // Family (subcategory) header — outermost group; resets all inner sentinels
          if (familyKey !== lastFamily) {
            lastFamily       = familyKey;
            lastManufacturer = SENTINEL;
            lastType         = SENTINEL;
            lastBase         = SENTINEL;
            addGroupRow(family || "(No Family)", 1);
          }

          // Manufacturer brand header — sub-header within family; only emitted when mfr is set
          if (mfrKey !== lastManufacturer) {
            lastManufacturer = mfrKey;
            lastType         = SENTINEL;
            lastBase         = SENTINEL;
            if (mfr) addMfrRow(mfr);
          }
          if (typeKey !== lastType) {
            lastType = typeKey;
            lastBase = SENTINEL;
            if (type) addGroupRow(type, 2);
          }
          if (baseKey !== lastBase) {
            await finalizePhotoBlock();  // finish previous base-item block before starting new one
            lastBase = baseKey;
            if (base) {
              addGroupRow(base, 3);
              photoBaseStartRow = ws.rowCount;   // level-3 header row is included in the merged block
              photoBaseEndRow   = ws.rowCount;   // will advance as item rows are added
              // Priority 1: item_groups managed image; priority 2: first item image (collected below)
              photoBaseImageUrl = itemGroupImageMap.get(`${cat.id}:${baseKey}`) ?? null;
            } else {
              photoBaseStartRow = null;
            }
          }

          const updatedAt = item.updatedAt
            ? new Date(item.updatedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" })
            : "";

          const rowData: Record<string, any> = {
            matName:   cat.code === "CW" ? (item.name || "") : (item.baseItemName || item.name || ""),
            size:      item.sizeLabel   ?? "",
            mfr:       mfr              ?? "",
            family:    family           ?? "",
            type:      type             ?? "",
            qty,
            unit:      item.unitOfMeasure ?? "",
            status,
            updatedAt,
          };

          // Right-side reel breakdown — reel-eligible items only
          const itemReels = catReelEligibleSet.has(item.id)
            ? (catReelExportMap.get(item.id) ?? [])
            : null;

          if (catMaxReelCount > 0) {
            if (itemReels && itemReels.length > 0) {
              const totalFt = itemReels.reduce((s, r) => s + r.lengthFt, 0);
              rowData["reelQty"]   = totalFt;
              rowData["reelCount"] = itemReels.length;
              for (let n = 1; n <= catMaxReelCount; n++) {
                rowData[`reel${n}`] = itemReels[n - 1]?.lengthFt ?? "";
              }
            } else {
              rowData["reelQty"]   = "";
              rowData["reelCount"] = "";
              for (let n = 1; n <= catMaxReelCount; n++) rowData[`reel${n}`] = "";
            }
          }

          // Track the longest Material Name text on this sheet
          const matNameText = rowData.matName as string;
          if (matNameText.length > maxMatNameLen) maxMatNameLen = matNameText.length;

          const dataRow = ws.addRow(rowData);
          dataRow.height = 16;
          const matNameCell = dataRow.getCell("matName");
          matNameCell.alignment = {
            vertical: "middle",
            indent:   4,
            // wrapText when the name would overflow even the widest allowed column
            ...(matNameText.length > 56 ? { wrapText: true } : {}),
          };

          // ── PHOTO block: advance end-row + capture first available image ─────
          photoBaseEndRow = dataRow.number;
          if (!photoBaseImageUrl && item.imageUrl) {
            photoBaseImageUrl = item.imageUrl;
          }

          // Quantity: number format + red if 0
          const qtyCell = dataRow.getCell("qty");
          qtyCell.numFmt = "#,##0";
          qtyCell.alignment = { vertical: "middle", horizontal: "center" };
          if (qty === 0) {
            qtyCell.font = { bold: true, color: { argb: C.redText } };
            qtyCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.redBg } };
          }

          // Status: colour-coded
          const stCell = dataRow.getCell("status");
          stCell.alignment = { vertical: "middle", horizontal: "center" };
          if (status === "In Stock") {
            stCell.font = { color: { argb: C.greenText  } };
            stCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.greenBg  } };
          } else if (status === "Out of Stock") {
            stCell.font = { color: { argb: C.redText    } };
            stCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.redBg    } };
          } else {
            stCell.font = { color: { argb: C.orangeText } };
            stCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.orangeBg } };
          }

          // Right-side reel section styling
          if (catMaxReelCount > 0 && itemReels && itemReels.length > 0) {
            // Quantity (ft) summary cell
            const qtyFtCell = dataRow.getCell("reelQty");
            qtyFtCell.numFmt = "#,##0";
            qtyFtCell.alignment = { vertical: "middle", horizontal: "right" };
            qtyFtCell.font = { size: 10, bold: true, color: { argb: C.l3Text } };

            // Total Reels summary cell
            const cntCell = dataRow.getCell("reelCount");
            cntCell.numFmt = "#,##0";
            cntCell.alignment = { vertical: "middle", horizontal: "center" };
            cntCell.font = { size: 10, color: { argb: C.darkText } };

            // Individual reel ft cells
            for (let n = 1; n <= catMaxReelCount; n++) {
              const rc = dataRow.getCell(`reel${n}`);
              if (itemReels[n - 1] !== undefined) {
                rc.numFmt = "#,##0";
                rc.alignment = { vertical: "middle", horizontal: "center" };
                rc.font = { size: 9, color: { argb: C.darkText } };
              }
            }
          }
        }

        // ── Finalize the last base-item block for this sheet ─────────────────────
        await finalizePhotoBlock();

        // ── Apply dynamic Material Name column width ──────────────────────────────
        // min=28, max=60; +4 padding so text never sits flush against cell edge.
        ws.getColumn("matName").width = Math.min(Math.max(maxMatNameLen + 4, 28), 60);

        // ── Freeze pane: header row + PHOTO column frozen ────────────────────────
        ws.views = [{ state: "frozen", xSplit: 1, ySplit: 1, topLeftCell: "B2", activeCell: "B2" }];

        // ── Auto-filter on header row (all columns incl. PHOTO) ──────────────────
        ws.autoFilter = { from: "A1", to: `${colLetter(totalCols + 1)}1` };
      }

      // 5. Stream buffer to client
      const filename = buildExportFilename();
      const buffer   = await wb.xlsx.writeBuffer();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Length", buffer.byteLength);
      res.end(buffer);
    } catch (err: any) {
      console.error("[inventory-xlsx]", err);
      res.status(500).json({ message: err.message });
    }
  });

  // ─── Admin SKU Cleanup ───────────────────────────────────────────────────────

  // Returns every item that has a collision-suffix SKU (ends with -2 … -99),
  // grouped by category → family, together with every OTHER item in the same family
  // (so the UI can show the full picture per family).
  app.get("/api/admin/sku-issues", isAuthenticated, requireAdmin, async (_req, res) => {
    try {
      const { db } = await import("./db");
      const { eq, and, inArray, sql, asc } = await import("drizzle-orm");
      const { items: itemsTable, categories: categoriesTable } = await import("../shared/schema");

      // 1. Find all base_item_names whose family contains at least one collision-suffix SKU.
      //    Pattern: ends with {digits}-{1 or 2 digits} e.g. "CATRHO-12-2", "WIRE-12-10".
      //    Avoids false-positives like "CT-BC-12" (non-digit before the last -12).
      const collisionFamilies = await db
        .selectDistinct({ baseItemName: itemsTable.baseItemName })
        .from(itemsTable)
        .where(sql`${itemsTable.sku} ~ '[0-9]+-[0-9]{1,2}$' AND ${itemsTable.isActive} = true`);

      const familyNames = collisionFamilies
        .map(r => r.baseItemName)
        .filter((n): n is string => typeof n === "string" && n.length > 0);

      if (familyNames.length === 0) {
        return res.json({ categories: [] });
      }

      // 2. All items that belong to those families, with category info.
      const rows = await db
        .select({
          id: itemsTable.id,
          sku: itemsTable.sku,
          name: itemsTable.name,
          baseItemName: itemsTable.baseItemName,
          sizeLabel: itemsTable.sizeLabel,
          isActive: itemsTable.isActive,
          categoryId: itemsTable.categoryId,
          categoryName: categoriesTable.name,
          categoryCode: categoriesTable.code,
        })
        .from(itemsTable)
        .innerJoin(categoriesTable, eq(categoriesTable.id, itemsTable.categoryId))
        .where(and(inArray(itemsTable.baseItemName, familyNames), eq(itemsTable.isActive, true)))
        .orderBy(asc(itemsTable.categoryId), asc(itemsTable.baseItemName), asc(itemsTable.sizeLabel), asc(itemsTable.sku));

      // 3. Full set of ALL active SKUs in the DB (for collision checking)
      const allSkuRows = await db
        .select({ id: itemsTable.id, sku: itemsTable.sku })
        .from(itemsTable)
        .where(eq(itemsTable.isActive, true));
      const allSkuMap = new Map<string, number>(); // sku → item id
      for (const r of allSkuRows) allSkuMap.set(r.sku, r.id);

      type FamilyItem = { id: number; sku: string; name: string; sizeLabel: string | null; isActive: boolean };

      // 4. Group by category → family
      const catMap = new Map<number, {
        id: number; name: string; code: string | null;
        families: Map<string, FamilyItem[]>;
      }>();

      for (const r of rows) {
        const catId = r.categoryId ?? 0;
        let cat = catMap.get(catId);
        if (!cat) {
          cat = { id: catId, name: r.categoryName, code: r.categoryCode ?? null, families: new Map() };
          catMap.set(catId, cat);
        }
        const familyKey = r.baseItemName ?? "";
        const fam = cat.families.get(familyKey) ?? [];
        fam.push({ id: r.id, sku: r.sku, name: r.name, sizeLabel: r.sizeLabel ?? null, isActive: r.isActive ?? true });
        cat.families.set(familyKey, fam);
      }

      // 5. For each family, figure out which items have collision-suffix SKUs
      //    and whether their "clean" version (suffix removed) is available
      const COLLISION_RE = /[0-9]+-[0-9]{1,2}$/;
      const categories = [];
      for (const cat of catMap.values()) {
        const families = [];
        for (const [familyName, familyItems] of cat.families.entries()) {
          const hasCollision = familyItems.some(i => COLLISION_RE.test(i.sku));
          if (!hasCollision) continue;

          // sizeLabelCounts within the family
          const sizeLabelCount: Record<string, number> = {};
          for (const i of familyItems) {
            const k = i.sizeLabel ?? "";
            sizeLabelCount[k] = (sizeLabelCount[k] ?? 0) + 1;
          }

          const processedItems = familyItems.map((item: FamilyItem) => {
            const isCollision = COLLISION_RE.test(item.sku);
            // "clean" candidate = remove trailing -N (strip the last -digits suffix)
            const cleanCandidate = item.sku.replace(/-[0-9]{1,2}$/, "");
            const cleanConflictId = allSkuMap.get(cleanCandidate);
            const cleanConflict = cleanConflictId != null && cleanConflictId !== item.id
              ? cleanCandidate
              : null;

            return {
              ...item,
              isCollision,
              cleanCandidate: isCollision ? cleanCandidate : null,
              cleanConflict,
              sizeLabelCount: sizeLabelCount[item.sizeLabel ?? ""] ?? 1,
            };
          });

          families.push({ baseItemName: familyName, items: processedItems });
        }
        if (families.length) categories.push({ id: cat.id, name: cat.name, code: cat.code, families });
      }

      // Remove the Map object before serialising
      res.json({ categories: categories.map(c => ({ id: c.id, name: c.name, code: c.code, families: c.families })) });
    } catch (err: any) {
      console.error("[sku-issues]", err);
      res.status(500).json({ message: err.message });
    }
  });

  // ── Cable SKU normalisation helpers ────────────────────────────────────────

  function extractAwgSize(name: string): string | null {
    // Order matters: /0 first, then 3-digit kcmil, then 2-digit AWG, then 1-digit AWG
    const m1 = name.match(/#(\d)\/0/);
    if (m1) return `O${m1[1]}`;                    // 1/0 → O1, 2/0 → O2, etc.
    const m2 = name.match(/#(\d{3})/);
    if (m2) return m2[1];                           // 250, 350, 500, 600, 750
    const m3 = name.match(/#(\d{2})/);
    if (m3) return m3[1];                           // 10, 12
    const m4 = name.match(/#(\d)(?!\d)/);
    if (m4) return m4[1];                           // 1, 2, 4, 6, 8
    return null;
  }

  function extractWireColor(name: string): string | null {
    const colorMap: Record<string, string> = {
      black: "BLK", brown: "BRN", red: "RED", blue: "BLU", orange: "ORG",
      yellow: "YEL", grey: "GRY", gray: "GRY", white: "WHT", green: "GRN",
      purple: "PUR", pink: "PNK",
    };
    const m = name.match(/\(([^)]+)\)/i);
    if (!m) return null;
    const raw = m[1].toLowerCase().trim();
    return colorMap[raw] ?? null;
  }

  function extractCableConfig(name: string): string | null {
    const m = name.match(/\((\d+C(?:\+G)?)\)/i);
    if (!m) return null;
    const raw = m[1].toUpperCase();
    return raw.includes("+G") ? raw.replace("+G", "G") : raw; // 3C+G → 3CG
  }

  function normalizeCableSku(item: { sku: string; name: string }): {
    proposedSku: string | null;
    reason: string | null;
  } {
    const { sku, name } = item;
    const isWire = sku.startsWith("WIRE-");
    const isCable = sku.startsWith("CABLE-");
    const isGW = sku.startsWith("GW-");
    if (!isWire && !isCable && !isGW) return { proposedSku: null, reason: null };

    const size = extractAwgSize(name);
    if (!size) return { proposedSku: null, reason: "size not recognized" };

    if (isGW) {
      const proposed = `GW-${size}`;
      if (proposed === sku) return { proposedSku: proposed, reason: null };
      return { proposedSku: proposed, reason: `사이즈 표준화 (${sku} → ${proposed})` };
    }

    if (isWire) {
      const color = extractWireColor(name);
      const proposed = color ? `WIRE-${size}-${color}` : `WIRE-${size}`;
      if (proposed === sku) return { proposedSku: proposed, reason: null };
      return { proposedSku: proposed, reason: `사이즈/색상 표준화 (${sku} → ${proposed})` };
    }

    if (isCable) {
      const config = extractCableConfig(name);
      if (!config) return { proposedSku: null, reason: "config not recognized" };
      const proposed = `CABLE-${size}-${config}`;
      if (proposed === sku) return { proposedSku: proposed, reason: null };
      return { proposedSku: proposed, reason: `사이즈/구성 표준화 (${sku} → ${proposed})` };
    }

    return { proposedSku: null, reason: null };
  }

  // Returns proposed standard SKUs for all cable/wire/GW items (preview only, no writes)
  app.get("/api/admin/cable-sku-preview", isAuthenticated, requireAdmin, async (_req, res) => {
    try {
      const { db } = await import("./db");
      const { eq, and, sql } = await import("drizzle-orm");
      const { items: itemsTable } = await import("../shared/schema");

      const rows = await db
        .select({ id: itemsTable.id, sku: itemsTable.sku, name: itemsTable.name })
        .from(itemsTable)
        .where(and(
          eq(itemsTable.isActive, true),
          sql`${itemsTable.sku} ~ '^(WIRE-|CABLE-|GW-)'`,
        ));

      // Full active SKU map for conflict detection
      const allSkuRows = await db
        .select({ id: itemsTable.id, sku: itemsTable.sku })
        .from(itemsTable)
        .where(eq(itemsTable.isActive, true));
      const allSkuMap = new Map<string, number>();
      for (const r of allSkuRows) allSkuMap.set(r.sku, r.id);

      const results = rows.map(item => {
        const { proposedSku, reason } = normalizeCableSku(item);

        if (!proposedSku) {
          return {
            id: item.id,
            currentSku: item.sku,
            proposedSku: item.sku,
            name: item.name,
            reason: reason ?? "파싱 불가",
            hasConflict: false,
            alreadyClean: true,
            cannotParse: true,
          };
        }

        const alreadyClean = proposedSku === item.sku;
        const conflictId = allSkuMap.get(proposedSku);
        const hasConflict = !alreadyClean && conflictId != null && conflictId !== item.id;

        return {
          id: item.id,
          currentSku: item.sku,
          proposedSku,
          name: item.name,
          reason: reason ?? "이미 표준 형식",
          hasConflict,
          alreadyClean,
          cannotParse: false,
        };
      });

      // Sort: conflicts first, then items that need change, then clean
      results.sort((a, b) => {
        if (a.cannotParse !== b.cannotParse) return a.cannotParse ? 1 : -1;
        if (a.alreadyClean !== b.alreadyClean) return a.alreadyClean ? 1 : -1;
        if (a.hasConflict !== b.hasConflict) return a.hasConflict ? -1 : 1;
        return a.currentSku.localeCompare(b.currentSku);
      });

      res.json({ items: results });
    } catch (err: any) {
      console.error("[cable-sku-preview]", err);
      res.status(500).json({ message: err.message });
    }
  });

  // Atomically bulk-update SKUs inside a DB transaction.
  // Body: { updates: [{id: number, sku: string}] }
  app.put("/api/admin/sku-bulk", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const rawUpdates = req.body?.updates;
      if (!Array.isArray(rawUpdates) || rawUpdates.length === 0) {
        return res.status(400).json({ message: "updates array required" });
      }

      // Validate and normalise each entry
      const updates: { id: number; sku: string }[] = [];
      for (const u of rawUpdates) {
        const id = Number(u.id);
        if (!Number.isInteger(id) || id <= 0) {
          return res.status(400).json({ message: `유효하지 않은 아이템 ID: ${u.id}` });
        }
        const sku = typeof u.sku === "string" ? u.sku.trim().toUpperCase() : "";
        if (!sku || !/^[A-Z0-9/_. -]+$/.test(sku)) {
          return res.status(400).json({ message: `유효하지 않은 SKU 형식: ${u.sku}` });
        }
        updates.push({ id, sku });
      }

      // Check duplicates within the batch
      const skuSet = new Set<string>();
      for (const { sku } of updates) {
        if (skuSet.has(sku)) return res.status(400).json({ message: `배치 내 SKU 중복: ${sku}` });
        skuSet.add(sku);
      }

      const { db } = await import("./db");
      const { eq, inArray, notInArray, and } = await import("drizzle-orm");
      const { items: itemsTable } = await import("../shared/schema");

      const ids  = updates.map(u => u.id);
      const skus = updates.map(u => u.sku);

      // Check DB conflicts: find existing items (not in the update set) that already own one of the new SKUs
      const conflicting = await db
        .select({ sku: itemsTable.sku })
        .from(itemsTable)
        .where(and(inArray(itemsTable.sku, skus), notInArray(itemsTable.id, ids)));

      if (conflicting.length > 0) {
        return res.status(409).json({
          message: `이미 사용 중인 SKU: ${conflicting.map(r => r.sku).join(", ")}`,
        });
      }

      // Execute all updates inside a single DB transaction for atomicity.
      // Two-phase approach prevents unique constraint violations when SKUs are
      // being swapped or rotated within the batch (circular rename problem):
      // Phase 1 — rename to guaranteed-unique temp SKUs
      // Phase 2 — rename to the final target SKUs
      let updated = 0;
      await db.transaction(async (tx) => {
        for (const { id } of updates) {
          await tx.update(itemsTable).set({ sku: `__TEMP_${id}__` }).where(eq(itemsTable.id, id));
        }
        for (const { id, sku } of updates) {
          await tx.update(itemsTable).set({ sku }).where(eq(itemsTable.id, id));
          updated++;
        }
      });

      res.json({ updated });
    } catch (err: any) {
      console.error("[sku-bulk]", err);
      const code = err.code ?? err.cause?.code;
      if (code === "23505") return res.status(409).json({ message: "SKU 중복 오류가 발생했습니다." });
      res.status(500).json({ message: err.message });
    }
  });

  // ─── Admin Stock & Pricing ────────────────────────────────────────────────────

  app.get("/api/admin/stock-pricing", isAuthenticated, requireAdmin, async (_req, res) => {
    try {
      const data = await storage.getStockPricingOverview();
      res.json(data);
    } catch (err: any) {
      console.error("[stock-pricing]", err);
      res.status(500).json({ message: err.message });
    }
  });

  const stockSettingsSchema = z.object({
    reorderPoint: z.number().int().min(0),
    reorderQuantity: z.number().int().min(0),
    minimumStock: z.number().int().min(0),
  });

  app.patch("/api/admin/items/:id/stock-settings", isAuthenticated, requireAdmin, async (req, res) => {
    const id = parseIntParam(req.params.id, "id", res);
    if (id === null) return;
    const parsed = stockSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid stock settings", errors: parsed.error.errors });
    }
    try {
      const updated = await storage.updateItemStockSettings(id, parsed.data);
      if (!updated) return res.status(404).json({ message: "Item not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/items/:id/supplier-items", isAuthenticated, requireAdmin, async (req, res) => {
    const id = parseIntParam(req.params.id, "id", res);
    if (id === null) return;
    try {
      const rows = await storage.getSupplierItemsForItem(id);
      res.json({ items: rows });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  const supplierItemBodySchema = z.object({
    supplierId: z.number().int().positive(),
    supplierSku: z.string().trim().max(100).optional().nullable()
      .transform(v => (v == null || v === "") ? null : v.trim()),
    leadTimeDays: z.number().int().min(0).max(3650).optional().nullable(),
    preferredSupplier: z.boolean().optional(),
    lastUnitCost: z.union([z.number(), z.string()])
      .optional().nullable()
      .transform(v => (v === null || v === undefined || v === "") ? null : Number(v))
      .refine(v => v === null || (typeof v === "number" && isFinite(v) && v >= 0), {
        message: "Unit cost must be null or a non-negative finite number",
      }),
    note: z.string().trim().max(500).optional().nullable()
      .transform(v => (v == null || v === "") ? null : v.trim()),
  });

  // ─── Supplier View: by-supplier read + batch save + duplicates ────────────────

  app.get("/api/admin/stock-pricing/by-supplier/:supplierId", isAuthenticated, requireAdmin, async (req, res) => {
    const supplierId = parseIntParam(req.params.supplierId, "supplierId", res);
    if (supplierId === null) return;
    try {
      const data = await storage.getStockPricingBySupplier(supplierId);
      if (!data) return res.status(404).json({ message: "Supplier not found" });
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  const batchSupplierPricingItemSchema = z.object({
    supplierItemId: z.number().int().positive().optional().nullable(),
    itemId: z.number().int().positive(),
    supplierSku: z.string().trim().max(100).optional().nullable()
      .transform(v => (v == null || v === "") ? null : v.trim()),
    leadTimeDays: z.number().int().min(0).max(3650).optional().nullable(),
    preferredSupplier: z.boolean().default(false),
    lastUnitCost: z.union([z.number(), z.string()])
      .optional().nullable()
      .transform(v => (v === null || v === undefined || v === "") ? null : Number(v))
      .refine(v => v === null || (typeof v === "number" && isFinite(v) && v >= 0), {
        message: "Unit cost must be null or a non-negative finite number",
      }),
    note: z.string().trim().max(500).optional().nullable()
      .transform(v => (v == null || v === "") ? null : v.trim()),
  });

  app.patch("/api/admin/stock-pricing/by-supplier/:supplierId/batch", isAuthenticated, requireAdmin, async (req, res) => {
    const supplierId = parseIntParam(req.params.supplierId, "supplierId", res);
    if (supplierId === null) return;
    const parsed = z.object({ items: z.array(batchSupplierPricingItemSchema) }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid batch data", errors: parsed.error.errors });
    }
    try {
      await storage.batchUpsertSupplierItemsForSupplier(
        supplierId,
        parsed.data.items.map(item => ({
          supplierItemId: item.supplierItemId ?? null,
          itemId: item.itemId,
          supplierSku: item.supplierSku ?? null,
          lastUnitCost: item.lastUnitCost ?? null,
          leadTimeDays: item.leadTimeDays ?? null,
          preferredSupplier: item.preferredSupplier,
          note: item.note ?? null,
        }))
      );
      res.json({ ok: true, saved: parsed.data.items.length });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/admin/stock-pricing/supplier-items/duplicates", isAuthenticated, requireAdmin, async (_req, res) => {
    try {
      const duplicates = await storage.getSupplierItemDuplicates();
      res.json({ duplicates, count: duplicates.length });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/items/:id/supplier-items", isAuthenticated, requireAdmin, async (req, res) => {
    const id = parseIntParam(req.params.id, "id", res);
    if (id === null) return;
    const parsed = supplierItemBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid supplier item", errors: parsed.error.errors });
    }
    try {
      const created = await storage.createSupplierItem({
        itemId: id,
        supplierId: parsed.data.supplierId,
        supplierSku: parsed.data.supplierSku ?? null,
        leadTimeDays: parsed.data.leadTimeDays ?? null,
        preferredSupplier: parsed.data.preferredSupplier ?? false,
        lastUnitCost: parsed.data.lastUnitCost ?? null,
        note: parsed.data.note ?? null,
      });
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  const supplierItemPatchSchema = supplierItemBodySchema.partial();

  app.patch("/api/admin/items/:itemId/supplier-items/:id", isAuthenticated, requireAdmin, async (req, res) => {
    const itemId = parseIntParam(req.params.itemId, "itemId", res);
    if (itemId === null) return;
    const id = parseIntParam(req.params.id, "id", res);
    if (id === null) return;
    const parsed = supplierItemPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid supplier item", errors: parsed.error.errors });
    }
    try {
      const existing = await storage.getSupplierItemById(id);
      if (!existing) return res.status(404).json({ message: "Supplier item not found" });
      if (existing.itemId !== itemId) return res.status(404).json({ message: "Supplier item not found" });
      const updated = await storage.updateSupplierItem(id, parsed.data);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/admin/items/:itemId/supplier-items/:id", isAuthenticated, requireAdmin, async (req, res) => {
    const itemId = parseIntParam(req.params.itemId, "itemId", res);
    if (itemId === null) return;
    const id = parseIntParam(req.params.id, "id", res);
    if (id === null) return;
    try {
      const existing = await storage.getSupplierItemById(id);
      if (!existing) return res.status(404).json({ message: "Supplier item not found" });
      if (existing.itemId !== itemId) return res.status(404).json({ message: "Supplier item not found" });
      await storage.deleteSupplierItem(id);
      res.status(204).end();
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ─── Admin Inactive Items ─────────────────────────────────────────────────────

  // Returns all inactive (isActive = false) items with movement/transaction counts.
  app.get("/api/admin/inactive-items", isAuthenticated, requireAdmin, async (_req, res) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");

      const result = await db.execute(sql`
        SELECT
          i.id,
          i.sku,
          i.name,
          i.quantity_on_hand  AS "quantityOnHand",
          i.updated_at        AS "updatedAt",
          COUNT(DISTINCT m.id)::int AS "movementCount",
          COUNT(DISTINCT t.id)::int AS "txCount"
        FROM items i
        LEFT JOIN inventory_movements            m ON m.item_id = i.id
        LEFT JOIN project_material_transactions  t ON t.item_id = i.id
        WHERE i.is_active = false
        GROUP BY i.id, i.sku, i.name, i.quantity_on_hand, i.updated_at
        ORDER BY i.sku
      `);

      const items = (result.rows as any[]).map(r => ({
        id:              Number(r.id),
        sku:             r.sku as string,
        name:            r.name as string,
        quantityOnHand:  Number(r.quantityOnHand),
        updatedAt:       r.updatedAt as string,
        movementCount:   Number(r.movementCount),
        txCount:         Number(r.txCount),
        hasMoveHistory:  Number(r.movementCount) > 0 || Number(r.txCount) > 0,
      }));

      res.json({ items });
    } catch (err: any) {
      console.error("[inactive-items]", err);
      res.status(500).json({ message: err.message });
    }
  });

  // ─── Admin Supplier Cleanup ─────────────────────────────────────────────────
  // Returns items that have a supplier_id but zero inventory_movements records.
  // These were entered as initial stock and never ordered through the system.

  app.get("/api/admin/cleanup/supplier-unlink-preview", isAuthenticated, requireAdmin, async (_req, res) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");

      const result = await db.execute(sql`
        SELECT
          i.id,
          i.sku,
          i.name,
          i.quantity_on_hand   AS "quantityOnHand",
          i.unit_of_measure    AS "unitOfMeasure",
          s.id                 AS "supplierId",
          s.name               AS "supplierName"
        FROM items i
        JOIN suppliers s ON s.id = i.supplier_id
        WHERE i.is_active = true
          AND i.supplier_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM inventory_movements im WHERE im.item_id = i.id
          )
        ORDER BY s.name, i.name
      `);

      const items = (result.rows as any[]).map(r => ({
        id:            Number(r.id),
        sku:           r.sku as string,
        name:          r.name as string,
        quantityOnHand: Number(r.quantityOnHand),
        unitOfMeasure: r.unitOfMeasure as string,
        supplierId:    Number(r.supplierId),
        supplierName:  r.supplierName as string,
      }));

      res.json({ items, total: items.length });
    } catch (err: any) {
      console.error("[supplier-unlink-preview]", err);
      res.status(500).json({ message: err.message });
    }
  });

  // Executes the cleanup: sets supplier_id = NULL for all items with no movements.
  app.post("/api/admin/cleanup/supplier-unlink", isAuthenticated, requireAdmin, async (_req, res) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");

      const result = await db.execute(sql`
        UPDATE items
        SET supplier_id = NULL
        WHERE is_active = true
          AND supplier_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM inventory_movements im WHERE im.item_id = items.id
          )
        RETURNING id
      `);

      const unlinked = result.rows.length;
      res.json({ unlinked });
    } catch (err: any) {
      console.error("[supplier-unlink]", err);
      res.status(500).json({ message: err.message });
    }
  });

  // Preview suppliers that still have items linked (with or without movements).
  app.get("/api/admin/cleanup/supplier-remaining", isAuthenticated, requireAdmin, async (_req, res) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");

      const result = await db.execute(sql`
        SELECT
          s.id                 AS "supplierId",
          s.name               AS "supplierName",
          i.id,
          i.sku,
          i.name,
          i.quantity_on_hand   AS "quantityOnHand",
          i.unit_of_measure    AS "unitOfMeasure",
          COUNT(im.id)::int    AS "movementCount"
        FROM items i
        JOIN suppliers s ON s.id = i.supplier_id
        LEFT JOIN inventory_movements im ON im.item_id = i.id
        WHERE i.is_active = true
          AND i.supplier_id IS NOT NULL
        GROUP BY s.id, s.name, i.id, i.sku, i.name, i.quantity_on_hand, i.unit_of_measure
        ORDER BY s.name, i.name
      `);

      const items = (result.rows as any[]).map(r => ({
        supplierId:    Number(r.supplierId),
        supplierName:  r.supplierName as string,
        id:            Number(r.id),
        sku:           r.sku as string,
        name:          r.name as string,
        quantityOnHand: Number(r.quantityOnHand),
        unitOfMeasure: r.unitOfMeasure as string,
        movementCount: Number(r.movementCount),
      }));

      res.json({ items });
    } catch (err: any) {
      console.error("[supplier-remaining]", err);
      res.status(500).json({ message: err.message });
    }
  });

  // Unlinks supplier_id for ALL items belonging to the given supplier IDs,
  // regardless of whether they have movement history.
  app.post("/api/admin/cleanup/supplier-unlink-all", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const rawIds = req.body?.supplierIds;
      if (!Array.isArray(rawIds) || rawIds.length === 0) {
        return res.status(400).json({ message: "supplierIds 배열이 필요합니다." });
      }
      const ids: number[] = [...new Set(rawIds.map(Number).filter(n => Number.isInteger(n) && n > 0))];
      if (ids.length === 0) {
        return res.status(400).json({ message: "유효한 supplier ID가 없습니다." });
      }

      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");

      const idList = ids.join(",");
      const result = await db.execute(sql.raw(`
        UPDATE items
        SET supplier_id = NULL
        WHERE is_active = true
          AND supplier_id IN (${idList})
        RETURNING id
      `));

      res.json({ unlinked: result.rows.length });
    } catch (err: any) {
      console.error("[supplier-unlink-all]", err);
      res.status(500).json({ message: err.message });
    }
  });

  // Permanently hard-deletes inactive items.
  // Body: { ids: number[] }  — all IDs must have isActive=false and no movement history.
  app.delete("/api/admin/items/purge", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const rawIds = req.body?.ids;
      if (!Array.isArray(rawIds) || rawIds.length === 0) {
        return res.status(400).json({ message: "ids 배열이 필요합니다." });
      }
      // Deduplicate and normalise IDs
      const ids: number[] = [...new Set(rawIds.map(Number).filter(n => Number.isInteger(n) && n > 0))];
      if (ids.length === 0) {
        return res.status(400).json({ message: "유효한 ID가 없습니다." });
      }

      const { db } = await import("./db");
      const { inArray, sql } = await import("drizzle-orm");
      const {
        items: itemsTable,
        itemImages,
        inventoryLocationBalances,
        supplierItems,
        purchaseRecommendations,
        wireReels,
      } = await import("../shared/schema");

      // Fetch all matching items and validate they are all inactive
      const matchedItems = await db
        .select({ id: itemsTable.id, isActive: itemsTable.isActive })
        .from(itemsTable)
        .where(inArray(itemsTable.id, ids));

      const foundIds = new Set(matchedItems.map(r => r.id));
      const missingIds = ids.filter(id => !foundIds.has(id));
      if (missingIds.length > 0) {
        return res.status(400).json({ message: `존재하지 않는 아이템 ID: ${missingIds.join(", ")}` });
      }

      const stillActive = matchedItems.filter(r => r.isActive === true);
      if (stillActive.length > 0) {
        return res.status(400).json({
          message: `활성 아이템은 영구 삭제할 수 없습니다: ID ${stillActive.map(r => r.id).join(", ")}`,
        });
      }

      // Safety check: reject if any item has movement history.
      // IDs are already validated as positive integers above — safe to interpolate directly.
      const idList = ids.join(", ");
      const movementCheck = await db.execute(
        sql.raw(`SELECT item_id, COUNT(*) AS cnt FROM inventory_movements WHERE item_id IN (${idList}) GROUP BY item_id
            UNION ALL
            SELECT item_id, COUNT(*) AS cnt FROM project_material_transactions WHERE item_id IN (${idList}) GROUP BY item_id`)
      );
      const withHistory = (movementCheck.rows as any[]).filter(r => Number(r.cnt) > 0);
      if (withHistory.length > 0) {
        const blockedIds = [...new Set((withHistory as any[]).map(r => r.item_id))];
        return res.status(400).json({
          message: `이동 기록이 있는 아이템은 삭제할 수 없습니다: ID ${blockedIds.join(", ")}`,
        });
      }

      // Cascade delete related records, then hard-delete items; capture actual count
      let deleted = 0;
      await db.transaction(async (tx) => {
        await tx.delete(itemImages).where(inArray(itemImages.itemId, ids));
        await tx.delete(inventoryLocationBalances).where(inArray(inventoryLocationBalances.itemId, ids));
        await tx.delete(supplierItems).where(inArray(supplierItems.itemId, ids));
        await tx.delete(purchaseRecommendations).where(inArray(purchaseRecommendations.itemId, ids));
        await tx.delete(wireReels).where(inArray(wireReels.itemId, ids));
        const result = await tx.delete(itemsTable).where(inArray(itemsTable.id, ids)).returning({ id: itemsTable.id });
        deleted = result.length;
      });

      res.json({ deleted });
    } catch (err: any) {
      console.error("[items/purge]", err);
      res.status(500).json({ message: err.message });
    }
  });

  // ─── Admin Export (CSV) ──────────────────────────────────────────────────────
  app.get("/api/admin/export/:table", isAuthenticated, requireAdmin, async (req, res) => {
    const EXPORT_QUERIES: Record<string, string> = {
      categories:                  "SELECT * FROM categories LIMIT 50000",
      locations:                   "SELECT * FROM locations LIMIT 50000",
      suppliers:                   "SELECT * FROM suppliers LIMIT 50000",
      projects:                    "SELECT * FROM projects LIMIT 50000",
      items:                       "SELECT * FROM items LIMIT 50000",
      inventory_movements:         "SELECT * FROM inventory_movements LIMIT 50000",
      inventory_location_balances: "SELECT * FROM inventory_location_balances LIMIT 50000",
      item_groups:                 "SELECT * FROM item_groups LIMIT 50000",
      users:                       "SELECT * FROM users LIMIT 50000",
    };
    const table = req.params.table;
    const exportQuery = EXPORT_QUERIES[table];
    if (!exportQuery) {
      return res.status(400).json({ message: "Unknown table" });
    }
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const result = await db.execute(sql.raw(exportQuery));
      const rows: any[] = (result as any).rows ?? [];
      if (rows.length === 0) {
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename="${table}.csv"`);
        return res.send("");
      }
      const headers = Object.keys(rows[0]);
      const escape = (v: any) => {
        const s = v == null ? "" : String(v);
        return `"${s.replace(/"/g, '""')}"`;
      };
      const csv = [headers.join(","), ...rows.map(r => headers.map(h => escape(r[h])).join(","))].join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${table}.csv"`);
      res.send(csv);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ─── Wire Reels ─────────────────────────────────────────────────────────────

  app.get("/api/wire-reels/brands", isAuthenticated, async (req, res) => {
    try {
      const brands = await storage.getDistinctReelBrands();
      res.json(brands);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/wire-reels/:itemId/next-id", isAuthenticated, async (req, res) => {
    try {
      const itemId = parseInt(req.params.itemId);
      if (isNaN(itemId)) return res.status(400).json({ message: "Invalid item ID" });
      const nextSeq = await storage.getNextReelSeq(itemId);
      res.json({ nextSeq });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/wire-reels/:itemId", isAuthenticated, async (req, res) => {
    try {
      const itemId = parseInt(req.params.itemId);
      if (isNaN(itemId)) return res.status(400).json({ message: "Invalid item ID" });
      const reels = await storage.getWireReels(itemId);
      res.json(reels);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  const reelSchema = z.object({
    itemId: z.number().int().positive(),
    reelId: z.string().min(1),
    lengthFt: z.number().int().min(0),
    brand: z.string().optional().nullable(),
    locationId: z.number().int().optional().nullable(),
    status: z.enum(["new", "used"]).optional().nullable(),
  });

  app.post("/api/wire-reels/bulk", isAuthenticated, requireManager, async (req, res) => {
    try {
      const { reels } = z.object({ reels: z.array(reelSchema).min(1) }).parse(req.body);
      const created = [];
      for (const reel of reels) {
        const r = await storage.createWireReel(reel);
        created.push(r);
      }
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/wire-reels", isAuthenticated, requireManager, async (req, res) => {
    try {
      const data = reelSchema.parse(req.body);
      const reel = await storage.createWireReel(data);
      res.status(201).json(reel);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/wire-reels/:id", isAuthenticated, requireManager, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid reel ID" });
      const schema = z.object({
        reelId: z.string().min(1).optional(),
        lengthFt: z.number().int().min(0).optional(),
        brand: z.string().optional().nullable(),
        supplierId: z.number().int().optional().nullable(),
        locationId: z.number().int().optional().nullable(),
        status: z.enum(["new", "used"]).optional().nullable(),
        notes: z.string().optional().nullable(),
      });
      const data = schema.parse(req.body);
      const reel = await storage.updateWireReel(id, data);
      res.json(reel);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/wire-reels/:id/restore", isAuthenticated, requireManager, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid reel ID" });
      const reel = await storage.restoreWireReel(id);
      res.json(reel);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/wire-reels/:id", isAuthenticated, requireManager, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid reel ID" });
      await storage.deleteWireReel(id);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ─── TV Display Mode ────────────────────────────────────────────────────────

  app.get("/api/tv/today-manpower", isAuthenticated, async (_req, res) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const reports = await db.select().from(dailyReports).where(eq(dailyReports.reportDate, today));
      const map: Record<number, number> = {};
      for (const r of reports) {
        const fd = r.formData as any;
        const count = Array.isArray(fd?.manpower) ? fd.manpower.length : 0;
        map[r.projectId] = (map[r.projectId] ?? 0) + count;
      }
      res.json(Object.entries(map).map(([projectId, workerCount]) => ({
        projectId: Number(projectId), workerCount,
      })));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ─── Daily Reports ─────────────────────────────────────────────────────────

  app.get("/api/daily-reports", isAuthenticated, requireManager, async (req, res) => {
    try {
      const projectId = parseInt(req.query.projectId as string);
      if (isNaN(projectId)) return res.status(400).json({ message: "projectId is required" });
      const reports = await storage.getDailyReports(projectId);
      res.json(reports);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/daily-reports-summary", isAuthenticated, requireManager, async (_req, res) => {
    try {
      const summary = await storage.getDailyReportSummary();
      res.json(summary);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/daily-reports/:id", isAuthenticated, requireManager, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid report ID" });
      const report = await storage.getDailyReport(id);
      if (!report) return res.status(404).json({ message: "Report not found" });
      res.json(report);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/daily-reports", isAuthenticated, requireManager, async (req, res) => {
    try {
      const { projectId, reportDate, reportNumber, preparedBy, status, formData } = req.body;
      if (!projectId || !reportDate) {
        return res.status(400).json({ message: "projectId and reportDate are required" });
      }
      const report = await storage.createDailyReport({
        projectId: Number(projectId),
        reportDate,
        reportNumber: reportNumber ?? null,
        preparedBy: preparedBy ?? null,
        status: status ?? "draft",
        formData: formData ?? null,
        createdBy: (req.user as any)?.id ?? null,
      });
      res.status(201).json(report);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/daily-reports/:id", isAuthenticated, requireManager, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid report ID" });
      const { reportDate, reportNumber, preparedBy, status, formData } = req.body;
      const report = await storage.updateDailyReport(id, {
        ...(reportDate !== undefined && { reportDate }),
        ...(reportNumber !== undefined && { reportNumber }),
        ...(preparedBy !== undefined && { preparedBy }),
        ...(status !== undefined && { status }),
        ...(formData !== undefined && { formData }),
      });
      res.json(report);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/daily-reports/:id", isAuthenticated, requireManager, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid report ID" });
      const role = req.user?.role ?? "viewer";
      if (role !== "admin" && role !== "manager") {
        return res.status(403).json({ message: "Insufficient permissions" });
      }
      await storage.deleteDailyReport(id);
      res.status(204).end();
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ─── Workers ─────────────────────────────────────────────────────────────────

  app.get("/api/workers", isAuthenticated, requireManager, async (_req, res) => {
    res.json(await storage.getWorkers());
  });

  app.get("/api/workers/:id", isAuthenticated, requireManager, async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid worker ID" });
    const worker = await storage.getWorker(id);
    if (!worker) return res.status(404).json({ message: "Worker not found" });
    res.json(worker);
  });

  app.post("/api/workers", isAuthenticated, requireManager, async (req, res) => {
    try {
      const worker = await storage.createWorker(req.body);
      res.status(201).json(worker);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.put("/api/workers/:id", isAuthenticated, requireManager, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid worker ID" });
      const worker = await storage.updateWorker(id, req.body);
      res.json(worker);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/workers/:id", isAuthenticated, requireManager, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid worker ID" });
      await storage.deleteWorker(id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // ── Worker Attendance ──────────────────────────────────────────────────────
  app.get("/api/workers/:id/attendance", isAuthenticated, requireManager, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid worker ID" });
      const records = await storage.getWorkerAttendance(id);
      res.json(records);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/workers/:id/attendance", isAuthenticated, requireManager, async (req, res) => {
    try {
      const workerId = parseInt(req.params.id);
      if (isNaN(workerId)) return res.status(400).json({ message: "Invalid worker ID" });
      const record = await storage.createWorkerAttendance({ ...req.body, workerId });
      res.json(record);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/workers/:id/attendance/:recordId", isAuthenticated, requireManager, async (req, res) => {
    try {
      const recordId = parseInt(req.params.recordId);
      if (isNaN(recordId)) return res.status(400).json({ message: "Invalid record ID" });
      await storage.deleteWorkerAttendance(recordId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // ── Worker Evaluations (History) ───────────────────────────────────────────
  app.get("/api/workers/:id/evaluations", isAuthenticated, requireManager, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid worker ID" });
      const evals = await storage.getWorkerEvaluations(id);
      res.json(evals);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/workers/:id/evaluations", isAuthenticated, requireManager, async (req, res) => {
    try {
      const workerId = parseInt(req.params.id);
      if (isNaN(workerId)) return res.status(400).json({ message: "Invalid worker ID" });
      const evaluation = await storage.createWorkerEvaluation({ ...req.body, workerId });
      res.json(evaluation);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // ─── Project Scope Items ─────────────────────────────────────────────────────

  app.get("/api/projects/:id/progress", isAuthenticated, requireManager, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      if (isNaN(projectId)) return res.status(400).json({ message: "Invalid project ID" });
      const data = await storage.getProjectProgress(projectId);
      res.json(data);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/projects/:id/scope-items", isAuthenticated, requireManager, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      if (isNaN(projectId)) return res.status(400).json({ message: "Invalid project ID" });
      const items = await storage.getScopeItems(projectId);
      res.json(items);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/projects/:id/scope-items", isAuthenticated, requireManager, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      if (isNaN(projectId)) return res.status(400).json({ message: "Invalid project ID" });
      // Duplicate check: same project + itemName + unit
      const existing = await storage.getScopeItems(projectId);
      const dup = existing.find(
        (s) => s.itemName.trim().toLowerCase() === String(req.body.itemName ?? "").trim().toLowerCase()
             && s.unit.trim().toLowerCase() === String(req.body.unit ?? "").trim().toLowerCase()
      );
      if (dup) return res.status(409).json({ message: `A scope item "${req.body.itemName} / ${req.body.unit}" already exists for this project.` });
      const item = await storage.createScopeItem({ ...req.body, projectId });
      res.json(item);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/scope-items/:id", isAuthenticated, requireManager, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid scope item ID" });
      const existing = await storage.getScopeItem(id);
      if (!existing) return res.status(404).json({ message: "Scope item not found" });
      // Duplicate check (exclude self)
      if (req.body.itemName !== undefined || req.body.unit !== undefined) {
        const siblings = await storage.getScopeItems(existing.projectId);
        const newName = String(req.body.itemName ?? existing.itemName).trim().toLowerCase();
        const newUnit = String(req.body.unit ?? existing.unit).trim().toLowerCase();
        const dup = siblings.find(
          (s) => s.id !== id
              && s.itemName.trim().toLowerCase() === newName
              && s.unit.trim().toLowerCase() === newUnit
        );
        if (dup) return res.status(409).json({ message: `A scope item "${req.body.itemName ?? existing.itemName} / ${req.body.unit ?? existing.unit}" already exists for this project.` });
      }
      const updated = await storage.updateScopeItem(id, req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/scope-items/:id", isAuthenticated, requireManager, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid scope item ID" });
      await storage.deleteScopeItem(id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // ─── Equipment ───────────────────────────────────────────────────────────────
  // Accessible to admin + manager only (not field staff/viewer)

  app.get("/api/equipment", isAuthenticated, requireManager, async (_req, res) => {
    try {
      res.json(await storage.getEquipment());
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/equipment/:id", isAuthenticated, requireManager, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid equipment ID" });
      const item = await storage.getEquipmentItem(id);
      if (!item) return res.status(404).json({ message: "Equipment not found" });
      res.json(item);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/equipment", isAuthenticated, requireManager, async (req, res) => {
    try {
      // Only master data fields accepted from admin forms; live fields (status, assignedProjectId) are future auto-populated
      const { equipNo: equipNoRaw, name, equipType, serialNumber, sizeSpec, brand, location, ownershipType } = req.body;
      if (!String(name ?? "").trim()) return res.status(400).json({ message: "Name is required" });
      // Auto-assign EQ# if blank — finds next available EQ-NNN
      let equipNo = String(equipNoRaw ?? "").trim();
      if (!equipNo) {
        const all = await storage.getEquipment();
        const nums = all
          .map((e) => { const m = e.equipNo.match(/^EQ-(\d+)$/i); return m ? parseInt(m[1], 10) : 0; })
          .filter(Boolean);
        const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
        equipNo = `EQ-${String(next).padStart(3, "0")}`;
      }
      const created = await storage.createEquipment({
        equipNo,
        name: String(name).trim(),
        equipType: equipType ? String(equipType).trim() : null,
        serialNumber: serialNumber ? String(serialNumber).trim() : null,
        sizeSpec: sizeSpec ? String(sizeSpec).trim() : null,
        brand: brand ? String(brand).trim() : null,
        location: location ? String(location).trim() : null,
        ownershipType: ownershipType ? String(ownershipType).trim() : "Rental",
        isActive: true,
        status: "standby",
      });
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // PATCH is the preferred endpoint; PUT kept for backward compat
  async function handleEquipmentUpdate(req: any, res: any) {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid equipment ID" });
      // Verify record exists first
      const existing = await storage.getEquipmentItem(id);
      if (!existing) return res.status(404).json({ message: "Equipment not found" });
      // Only update master data fields
      const { equipNo, name, equipType, serialNumber, sizeSpec, brand, location, ownershipType } = req.body;
      const patch: Record<string, any> = {};
      if (equipNo       !== undefined) patch.equipNo       = String(equipNo).trim();
      if (name          !== undefined) patch.name          = String(name).trim();
      if (equipType     !== undefined) patch.equipType     = equipType ? String(equipType).trim() : null;
      if (serialNumber  !== undefined) patch.serialNumber  = serialNumber ? String(serialNumber).trim() : null;
      if (sizeSpec      !== undefined) patch.sizeSpec      = sizeSpec ? String(sizeSpec).trim() : null;
      if (brand         !== undefined) patch.brand         = brand ? String(brand).trim() : null;
      if (location      !== undefined) patch.location      = location ? String(location).trim() : null;
      if (ownershipType !== undefined) patch.ownershipType = ownershipType ? String(ownershipType).trim() : "Rental";
      const updated = await storage.updateEquipment(id, patch);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  }

  app.patch("/api/equipment/:id", isAuthenticated, requireManager, handleEquipmentUpdate);
  app.put("/api/equipment/:id", isAuthenticated, requireManager, handleEquipmentUpdate);

  app.delete("/api/equipment/:id", isAuthenticated, requireManager, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid equipment ID" });
      await storage.deleteEquipment(id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // ─── Material Requests ────────────────────────────────────────────────────
  // Field-submitted material requests (no inventory change until pickup).

  app.get("/api/field/requests", isAuthenticated, loadCurrentUser, async (req: any, res) => {
    try {
      const user = req.user;
      const isManagerPlus = user?.role === "manager" || user?.role === "admin";
      const requests = isManagerPlus
        ? await storage.getMaterialRequests()
        : await storage.getMaterialRequests(user?.id);
      res.json(requests);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/field/requests", isAuthenticated, loadCurrentUser, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user || user.role === "viewer") {
        return res.status(403).json({ message: "Viewers cannot create requests" });
      }
      const { itemsJson, notes, projectId, requesterName, requesterRole, requestType } = req.body;
      if (!itemsJson) return res.status(400).json({ message: "itemsJson is required" });

      const count = await storage.getMaterialRequests();
      const reqNumber = `REQ-${String(count.length + 1).padStart(4, "0")}`;

      const created = await storage.createMaterialRequest({
        requestNumber: reqNumber,
        itemsJson,
        requestType: requestType === "transfer" ? "transfer" : "issue",
        submittedBy: user?.id,
        submittedByName: user?.name || user?.username || "Unknown",
        notes: notes ?? null,
        projectId: projectId ? Number(projectId) : null,
        requesterName: requesterName ?? null,
        requesterRole: requesterRole ?? null,
      });
      res.json(created);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/field/requests/:id", isAuthenticated, loadCurrentUser, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user) return res.status(401).json({ message: "Authentication required" });

      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid request ID" });

      const request = await storage.getMaterialRequest(id);
      if (!request) return res.status(404).json({ message: "Request not found" });

      const isManagerPlus = user.role === "admin" || user.role === "manager";
      const isOwn = request.submittedBy === user.id;

      if (!isManagerPlus) {
        if (user.role === "viewer") return res.status(403).json({ message: "Viewers cannot edit requests" });
        if (!isOwn) return res.status(403).json({ message: "You can only edit your own requests" });
        if (request.status !== "requested") return res.status(403).json({ message: "Requests can only be edited while still in 'requested' status" });
      }
      if (isManagerPlus && request.status === "completed") {
        return res.status(403).json({ message: "Completed requests cannot be edited" });
      }

      const { itemsJson, notes, projectId, requesterName, requesterRole, requestType } = req.body;
      const updateData: Record<string, unknown> = {};
      if (itemsJson   !== undefined) updateData.itemsJson      = itemsJson;
      if (notes       !== undefined) updateData.notes          = notes ?? null;
      if (projectId   !== undefined) updateData.projectId      = projectId ? Number(projectId) : null;
      if (requesterName !== undefined) updateData.requesterName = requesterName ?? null;
      if (requesterRole !== undefined) updateData.requesterRole = requesterRole ?? null;
      if (requestType !== undefined) updateData.requestType    = requestType === "transfer" ? "transfer" : "issue";

      if (Object.keys(updateData).length === 0) return res.status(400).json({ message: "Nothing to update" });

      const updated = await storage.updateMaterialRequest(id, updateData as any);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/field/requests/:id", isAuthenticated, loadCurrentUser, async (req: any, res) => {
    try {
      const user = req.user;
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid request ID" });

      const isManagerPlus = user?.role === "admin" || user?.role === "manager";
      if (!isManagerPlus) return res.status(403).json({ message: "Only managers and admins can delete requests" });

      const request = await storage.getMaterialRequest(id);
      if (!request) return res.status(404).json({ message: "Request not found" });

      if (request.fulfilledMovementId != null) {
        return res.status(409).json({ message: "Cannot delete a fulfilled request — it has a linked movement" });
      }

      await storage.deleteMaterialRequest(id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/field/requests/:id/undo-complete", isAuthenticated, loadCurrentUser, async (req: any, res) => {
    try {
      const user = req.user;
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid request ID" });

      const isManagerPlus = user?.role === "admin" || user?.role === "manager";
      if (!isManagerPlus) return res.status(403).json({ message: "Only managers and admins can undo completion" });

      const request = await storage.getMaterialRequest(id);
      if (!request) return res.status(404).json({ message: "Request not found" });

      if (request.status !== "completed") {
        return res.status(409).json({ message: "Undo is no longer available — request is not in completed state" });
      }
      if (!request.fulfilledMovementId) {
        return res.status(409).json({ message: "Undo is not available — no fulfillment movement recorded" });
      }

      // Find all movements created by this fulfillment
      const movements = await storage.getMovementsByReference("material_request", String(id));
      if (movements.length === 0) {
        return res.status(409).json({ message: "Undo is no longer available — fulfillment movements not found" });
      }

      // Reverse all movements (restores inventory quantities)
      const errors: string[] = [];
      for (const m of movements) {
        try {
          await storage.deleteMovement(m.id);
        } catch (err: any) {
          errors.push(`Item ${m.itemId}: ${err.message}`);
        }
      }

      if (errors.length > 0) {
        return res.status(409).json({ message: `Undo blocked — ${errors.join("; ")}` });
      }

      // Reset request to "ready" and clear the fulfilled marker
      const restored = await storage.undoMaterialRequestCompletion(id);
      res.json(restored);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/field/requests/:id/status", isAuthenticated, loadCurrentUser, async (req: any, res) => {
    try {
      const user = req.user;
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid request ID" });
      const { status } = req.body;
      const valid = ["requested", "preparing", "ready", "completed", "cancelled"];
      if (!valid.includes(status)) return res.status(400).json({ message: "Invalid status" });

      // Role enforcement for warehouse-side statuses
      const warehouseStatuses = ["preparing", "ready", "completed", "cancelled"];
      const isManagerPlus = user?.role === "admin" || user?.role === "manager";
      if (warehouseStatuses.includes(status) && !isManagerPlus) {
        // Exception: staff can cancel their OWN request while it is still "requested"
        if (status === "cancelled" && user?.role !== "viewer") {
          const reqForCancel = await storage.getMaterialRequest(id);
          if (!reqForCancel) return res.status(404).json({ message: "Request not found" });
          const isOwn = reqForCancel.submittedBy === user?.id;
          if (!isOwn || reqForCancel.status !== "requested") {
            return res.status(403).json({ message: "You can only cancel your own pending requests" });
          }
          // Allow fall-through to status update below
        } else {
          return res.status(403).json({ message: "Only managers and admins can update this status" });
        }
      }

      // Completion path: create real inventory transactions
      if (status === "completed") {
        const request = await storage.getMaterialRequest(id);
        if (!request) return res.status(404).json({ message: "Request not found" });

        // Prevent duplicate fulfillment
        if (request.fulfilledMovementId) {
          return res.status(409).json({ message: "Request already fulfilled — transaction already recorded" });
        }

        // Parse cart items from the request
        let cartItems: Array<{ itemId: number; requestedQty: number; itemName?: string; locationName?: string | null }> = [];
        try { cartItems = JSON.parse(request.itemsJson || "[]"); } catch { cartItems = []; }

        const movementType = request.requestType === "transfer" ? "transfer" : "issue";
        let firstMovementId: number | null = null;

        // Build a name→id lookup for source location resolution
        const allLocations = await storage.getLocations();
        const locationIdByName = new Map(allLocations.map(l => [l.name.trim().toLowerCase(), l.id]));

        for (const cartItem of cartItems) {
          try {
            const dbItem = await storage.getItem(cartItem.itemId);
            if (!dbItem) continue;

            const qty = Number(cartItem.requestedQty);
            if (!qty || qty <= 0) continue;

            // Resolve source location from the cart item's recorded location name
            const sourceLocationId = cartItem.locationName
              ? (locationIdByName.get(cartItem.locationName.trim().toLowerCase()) ?? null)
              : null;

            // For issue: deduct from on-hand; for transfer: quantity unchanged
            const newQty = movementType === "issue"
              ? dbItem.quantityOnHand - qty
              : dbItem.quantityOnHand;

            const movement = await storage.createInventoryMovement({
              itemId: dbItem.id,
              movementType,
              quantity: qty,
              previousQuantity: dbItem.quantityOnHand,
              newQuantity: newQty,
              sourceLocationId,
              projectId: request.projectId ?? null,
              referenceType: "material_request",
              referenceId: String(id),
              note: `Fulfilled from ${request.requestNumber}${request.requesterName ? ` — ${request.requesterName}` : ""}`,
              createdBy: user?.id ?? null,
            });

            if (!firstMovementId) firstMovementId = movement.id;
          } catch (itemErr: any) {
            // Log but continue — don't fail the whole request for one item
            console.warn(`[fulfillRequest] Skipped item ${cartItem.itemId}:`, itemErr?.message);
          }
        }

        const fulfilled = await storage.fulfillMaterialRequest(id, firstMovementId ?? 0);
        return res.json(fulfilled);
      }

      const updated = await storage.updateMaterialRequestStatus(id, status);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // ── Tool Assets ─────────────────────────────────────────────────────────────
  // GET /api/items/:itemId/assets — list active assets for an item
  app.get("/api/items/:itemId/assets", isAuthenticated, async (req, res) => {
    try {
      const itemId = parseInt(req.params.itemId);
      if (isNaN(itemId)) return res.status(400).json({ message: "Invalid itemId" });
      const assets = await storage.getToolAssetsByItem(itemId);
      res.json(assets);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/items/:itemId/assets/generate-from-quantity — bulk-generate missing asset IDs
  app.post("/api/items/:itemId/assets/generate-from-quantity", isAuthenticated, requireManager, async (req, res) => {
    try {
      const itemId = parseInt(req.params.itemId);
      if (isNaN(itemId)) return res.status(400).json({ message: "Invalid itemId" });
      const item = await storage.getItem(itemId);
      if (!item) return res.status(404).json({ message: "Item not found" });
      if (item.trackingMode !== "asset") {
        return res.status(400).json({ message: "Item is not asset-tracked" });
      }
      const sku = (item.sku ?? "").trim();
      if (!sku) return res.status(400).json({ message: "Item must have a SKU to generate asset IDs" });
      const qty = item.quantityOnHand ?? 0;
      if (qty <= 0) return res.status(400).json({ message: "quantityOnHand must be a positive number" });
      const prefix = sku.toUpperCase().replace(/[^A-Z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
      const activeAssets = await storage.getToolAssetsByItem(itemId);
      const activeCount = activeAssets.length;
      const missingCount = qty - activeCount;
      if (missingCount <= 0) {
        return res.json({ created: [], summary: { targetCount: qty, activeCount, missingCount: 0, generated: 0 } });
      }
      const created = await storage.generateAssetsFromQuantity(itemId, prefix, missingCount);
      res.json({ created, summary: { targetCount: qty, activeCount, missingCount, generated: created.length } });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/items/:itemId/assets — create a new asset under an item
  app.post("/api/items/:itemId/assets", isAuthenticated, requireManager, async (req, res) => {
    try {
      const itemId = parseInt(req.params.itemId);
      if (isNaN(itemId)) return res.status(400).json({ message: "Invalid itemId" });

      const item = await storage.getItem(itemId);
      if (!item) return res.status(404).json({ message: "Item not found" });
      if (item.trackingMode !== "asset") {
        return res.status(400).json({ message: "Item is not asset-tracked. Only items with trackingMode='asset' can have assets." });
      }

      const { assetTag, status, condition, ...rest } = req.body;
      if (!assetTag || !String(assetTag).trim()) {
        return res.status(400).json({ message: "assetTag is required" });
      }

      const VALID_STATUSES = ["available", "in_use", "repair_needed", "under_repair", "out_of_service", "lost", "retired"];
      const VALID_CONDITIONS = ["good", "fair", "damaged", "needs_repair"];

      const resolvedStatus = status ?? "available";
      const resolvedCondition = condition ?? "good";

      if (!VALID_STATUSES.includes(resolvedStatus)) {
        return res.status(400).json({ message: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` });
      }
      if (resolvedCondition && !VALID_CONDITIONS.includes(resolvedCondition)) {
        return res.status(400).json({ message: `Invalid condition. Must be one of: ${VALID_CONDITIONS.join(", ")}` });
      }

      const tagStr = String(assetTag).trim();
      const existing = await storage.findToolAssetByTag(tagStr);
      if (existing) {
        return res.status(409).json({ message: `Asset tag '${tagStr}' already exists` });
      }

      const asset = await storage.createToolAsset({
        itemId,
        assetTag: tagStr,
        status: resolvedStatus,
        condition: resolvedCondition,
        ...rest,
      });
      res.status(201).json(asset);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // PATCH /api/tool-assets/:assetId — update an asset
  app.patch("/api/tool-assets/:assetId", isAuthenticated, requireManager, async (req, res) => {
    try {
      const assetId = parseInt(req.params.assetId);
      if (isNaN(assetId)) return res.status(400).json({ message: "Invalid assetId" });

      const VALID_STATUSES = ["available", "in_use", "repair_needed", "under_repair", "out_of_service", "lost", "retired"];
      const VALID_CONDITIONS = ["good", "fair", "damaged", "needs_repair"];

      const { status, condition, itemId: _itemId, createdAt: _c, updatedAt: _u, ...rest } = req.body;

      if (status !== undefined && !VALID_STATUSES.includes(status)) {
        return res.status(400).json({ message: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` });
      }
      if (condition !== undefined && condition !== null && !VALID_CONDITIONS.includes(condition)) {
        return res.status(400).json({ message: `Invalid condition. Must be one of: ${VALID_CONDITIONS.join(", ")}` });
      }

      const patch: Record<string, any> = { ...rest };
      if (status !== undefined) patch.status = status;
      if (condition !== undefined) patch.condition = condition;

      const updated = await storage.updateToolAsset(assetId, patch);
      res.json(updated);
    } catch (err: any) {
      if (err.message?.includes("not found")) return res.status(404).json({ message: err.message });
      if ((err.code ?? err.cause?.code) === "23505") {
        return res.status(409).json({ message: `Asset tag already exists` });
      }
      res.status(500).json({ message: err.message });
    }
  });

  // DELETE /api/tool-assets/:assetId — soft-delete (isActive = false)
  app.delete("/api/tool-assets/:assetId", isAuthenticated, requireManager, async (req, res) => {
    try {
      const assetId = parseInt(req.params.assetId);
      if (isNaN(assetId)) return res.status(400).json({ message: "Invalid assetId" });
      await storage.deactivateToolAsset(assetId);
      res.json({ success: true, message: "Asset deactivated" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Reel ID Cleanup ─────────────────────────────────────────────────────────
  app.get("/api/admin/reel-id-preview", isAuthenticated, requireAdmin, async (_req, res) => {
    try {
      const rows = await storage.getReelIdPreview();
      res.json({ rows });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/admin/reel-id-rename", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { reelIds } = req.body;
      if (!Array.isArray(reelIds) || reelIds.length === 0) {
        return res.status(400).json({ message: "reelIds must be a non-empty array" });
      }
      const ids = reelIds.map(Number).filter(n => !isNaN(n) && n > 0);
      if (ids.length === 0) return res.status(400).json({ message: "No valid reel IDs provided" });
      const result = await storage.renameReelIds(ids);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Monday.com Integration ───────────────────────────────────────────────────

  // GET /api/monday/status — check token + board config (admin only)
  app.get("/api/monday/status", isAuthenticated, requireAdmin, async (_req, res) => {
    try {
      const settings = await storage.getAppSettings(["monday_board_id", "monday_webhook_ids", "monday_board_name"]);
      const hasToken = !!process.env.MONDAY_API_TOKEN;
      let webhookCount = 0;
      try { webhookCount = JSON.parse(settings["monday_webhook_ids"] ?? "[]").length; } catch {}
      res.json({
        hasToken,
        boardId: settings["monday_board_id"],
        boardName: settings["monday_board_name"],
        webhookCount,
        isConnected: !!(settings["monday_board_id"] && settings["monday_webhook_ids"]),
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // GET /api/monday/board-id — returns boardId to all authenticated users (for deep-link badge)
  app.get("/api/monday/board-id", isAuthenticated, async (_req, res) => {
    try {
      const boardId = await storage.getAppSetting("monday_board_id");
      res.json({ boardId });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // GET /api/monday/boards — list boards (admin only)
  app.get("/api/monday/boards", isAuthenticated, requireAdmin, async (_req, res) => {
    try {
      const { fetchBoards } = await import("./services/monday");
      const boards = await fetchBoards();
      res.json({ boards });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // GET /api/monday/columns — fetch board column schema from Monday (admin only)
  app.get("/api/monday/columns", isAuthenticated, requireAdmin, async (_req, res) => {
    try {
      const boardId = await storage.getAppSetting("monday_board_id");
      if (!boardId) return res.status(400).json({ message: "No board configured" });
      const { fetchBoardColumns } = await import("./services/monday");
      const columns = await fetchBoardColumns(boardId);
      res.json({ columns });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // GET /api/monday/column-mapping — return saved mapping (admin only)
  app.get("/api/monday/column-mapping", isAuthenticated, requireAdmin, async (_req, res) => {
    try {
      const raw = await storage.getAppSetting("monday_column_mapping");
      const mapping = raw ? JSON.parse(raw) : null;
      res.json({ mapping });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/monday/column-mapping — validate and save mapping (admin only)
  app.post("/api/monday/column-mapping", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { mapping } = req.body;
      if (!mapping || typeof mapping !== "object") {
        return res.status(400).json({ message: "mapping object is required" });
      }
      // Validate that values are strings or null
      const allowed = ["projectNameColumnId", "statusColumnId", "contactColumnId", "timelineColumnId", "locationColumnId", "notesColumnId", "depositColumnId", "fileColumnIds"];
      const cleaned: Record<string, any> = {};
      for (const key of allowed) {
        if (key in mapping) cleaned[key] = mapping[key];
      }
      await storage.setAppSetting("monday_column_mapping", JSON.stringify(cleaned));
      const { isMappingComplete } = await import("./services/monday");
      res.json({ success: true, complete: isMappingComplete(cleaned) });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // GET /api/monday/mapping-preview — fetch up to 5 board items and map them with current mapping (admin only)
  app.get("/api/monday/mapping-preview", isAuthenticated, requireAdmin, async (_req, res) => {
    try {
      const boardIdRaw = await storage.getAppSetting("monday_board_id");
      if (!boardIdRaw) return res.status(400).json({ message: "Monday.com board not connected" });
      const mappingRaw = await storage.getAppSetting("monday_column_mapping");
      const columnMapping = mappingRaw ? JSON.parse(mappingRaw) : null;
      const { fetchBoardItems, mapMondayItemToProject, isMappingComplete } = await import("./services/monday");
      if (!isMappingComplete(columnMapping)) {
        return res.status(400).json({ message: "Column mapping is incomplete", mappingIncomplete: true });
      }
      const allItems = await fetchBoardItems(boardIdRaw);
      const samples = allItems.slice(0, 5);
      const preview = samples.map(item => ({
        mondayId: item.id,
        mondayName: item.name,
        group: item.group?.title ?? "",
        mapped: mapMondayItemToProject(item, columnMapping),
      }));
      res.json({ preview });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/monday/connect — save board_id, register webhooks, initial sync
  app.post("/api/monday/connect", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { boardId, boardName, webhookBaseUrl } = req.body;
      if (!boardId) return res.status(400).json({ message: "boardId is required" });

      const { registerWebhooks, deleteWebhooks, fetchBoardItems, fetchBoardColumns, mapMondayItemToProject, isMappingComplete, autoSuggestMapping } = await import("./services/monday");

      // If already connected, clean up old webhooks first
      const existingIdsRaw = await storage.getAppSetting("monday_webhook_ids");
      if (existingIdsRaw) {
        try {
          const oldIds = JSON.parse(existingIdsRaw).map((w: any) => String(w.id ?? w));
          await deleteWebhooks(oldIds);
        } catch {}
      }

      // Generate a random secret token for this connection — embedded in webhook URL
      const crypto = await import("crypto");
      const webhookSecret = crypto.randomBytes(24).toString("hex");

      // Save board config
      await storage.setAppSetting("monday_board_id", boardId);
      await storage.setAppSetting("monday_board_name", boardName || boardId);
      await storage.setAppSetting("monday_webhook_secret", webhookSecret);

      // Register webhooks — URL includes secret token for request verification
      // registerWebhooks throws if ANY required event fails (all-or-nothing)
      const webhookUrl = `${webhookBaseUrl}/api/webhooks/monday?secret=${webhookSecret}`;
      let webhookEntries: Array<{ id: string; event: string }>;
      try {
        webhookEntries = await registerWebhooks(boardId, webhookUrl);
      } catch (webhookErr: any) {
        // Roll back saved board settings so connection is not recorded as active
        await storage.setAppSetting("monday_board_id", null);
        await storage.setAppSetting("monday_board_name", null);
        await storage.setAppSetting("monday_webhook_secret", null);
        return res.status(502).json({ message: webhookErr.message });
      }
      await storage.setAppSetting("monday_webhook_ids", JSON.stringify(webhookEntries));

      // Auto-suggest column mapping from board columns if no mapping saved yet
      const existingMappingRaw = await storage.getAppSetting("monday_column_mapping");
      let columnMapping = existingMappingRaw ? JSON.parse(existingMappingRaw) : null;
      if (!columnMapping) {
        try {
          const columns = await fetchBoardColumns(boardId);
          columnMapping = autoSuggestMapping(columns);
          if (Object.keys(columnMapping).length > 0) {
            await storage.setAppSetting("monday_column_mapping", JSON.stringify(columnMapping));
          }
        } catch (colErr: any) {
          console.warn("[monday] failed to auto-suggest column mapping:", colErr.message);
        }
      }

      // Initial full sync — use mapping if complete, otherwise auto-detect fallback
      const items = await fetchBoardItems(boardId);
      const mappingForSync = isMappingComplete(columnMapping) ? columnMapping : null;

      // ── Conflict detection for initial connect (always runs, mapping-complete or fallback) ──
      const conflictCheckItems = items.map(item => {
        const mapped = mapMondayItemToProject(item, mappingForSync);
        return { mondayItemId: item.id, name: mapped.name, code: mapped.code, poNumber: mapped.poNumber };
      });
      const conflicts = await storage.detectMondaySyncConflicts(conflictCheckItems);
      if (conflicts.length > 0) {
        return res.json({
          success: true,
          conflicts,
          webhookCount: webhookEntries.length,
          mappingComplete: isMappingComplete(columnMapping),
          columnMapping,
        });
      }
      // ────────────────────────────────────────────────────────────────────────

      let synced = 0;
      for (const item of items) {
        const mapped = mapMondayItemToProject(item, mappingForSync);
        await storage.upsertProjectByMondayId(item.id, { ...mapped, mondayBoardId: boardId });
        synced++;
      }

      res.json({
        success: true,
        synced,
        webhookCount: webhookEntries.length,
        mappingComplete: isMappingComplete(columnMapping),
        columnMapping,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/monday/sync — manual full sync (admin only)
  // Returns 400 if required column mapping is incomplete.
  // Returns { conflicts } if PO conflicts detected — caller must resolve via /resolve-conflicts.
  app.post("/api/monday/sync", isAuthenticated, requireAdmin, async (_req, res) => {
    try {
      const boardId = await storage.getAppSetting("monday_board_id");
      if (!boardId) return res.status(400).json({ message: "No board configured" });

      const { fetchBoardItems, mapMondayItemToProject, isMappingComplete } = await import("./services/monday");

      // Load and validate column mapping
      const mappingRaw = await storage.getAppSetting("monday_column_mapping");
      const columnMapping = mappingRaw ? JSON.parse(mappingRaw) : null;
      if (!isMappingComplete(columnMapping)) {
        return res.status(400).json({
          message: "Column mapping is incomplete. Configure required mappings (Project Name, Status, Contact, Timeline, Location) before syncing.",
          mappingIncomplete: true,
        });
      }

      const items = await fetchBoardItems(boardId);

      // ── Conflict detection ───────────────────────────────────────────────────
      const conflictCheckItems = items.map(item => {
        const mapped = mapMondayItemToProject(item, columnMapping);
        return { mondayItemId: item.id, name: mapped.name, code: mapped.code, poNumber: mapped.poNumber };
      });
      const conflicts = await storage.detectMondaySyncConflicts(conflictCheckItems);
      if (conflicts.length > 0) {
        return res.json({ conflicts });
      }
      // ────────────────────────────────────────────────────────────────────────

      const liveItemIds = new Set(items.map(i => i.id));
      let synced = 0;
      for (const item of items) {
        const mapped = mapMondayItemToProject(item, columnMapping);
        await storage.upsertProjectByMondayId(item.id, { ...mapped, mondayBoardId: boardId });
        synced++;
      }

      // Archive Monday-sourced projects that no longer appear in the board
      let archived = 0;
      const mondayProjects = await storage.getMondayProjectsByBoardId(boardId);
      for (const p of mondayProjects) {
        if (p.mondayItemId && !liveItemIds.has(p.mondayItemId)) {
          await storage.deleteProjectByMondayId(p.mondayItemId);
          archived++;
        }
      }
      if (archived > 0) console.log(`[monday sync] archived ${archived} stale project(s) not found on board`);

      res.json({ success: true, synced, archived });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/monday/sync/resolve-conflicts — apply conflict resolutions + complete sync
  app.post("/api/monday/sync/resolve-conflicts", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { resolutions } = req.body;
      // resolutions: Array<{ mondayItemId: string, action: "link"|"create", existingProjectId?: number }>
      if (!Array.isArray(resolutions)) {
        return res.status(400).json({ message: "resolutions array is required" });
      }

      const boardId = await storage.getAppSetting("monday_board_id");
      if (!boardId) return res.status(400).json({ message: "No board configured" });

      const { fetchBoardItems, mapMondayItemToProject, isMappingComplete } = await import("./services/monday");
      const mappingRaw = await storage.getAppSetting("monday_column_mapping");
      const columnMapping = mappingRaw ? JSON.parse(mappingRaw) : null;
      // Use mapping if complete, otherwise fall back to auto-detect (same as connect endpoint)
      const mappingForSync = isMappingComplete(columnMapping) ? columnMapping : null;

      const items = await fetchBoardItems(boardId);
      const liveItemIds = new Set(items.map(i => i.id));
      const resolutionMap = new Map<string, { action: "link" | "skip"; existingProjectId?: number }>(
        resolutions.map((r: any) => [r.mondayItemId, { action: r.action, existingProjectId: r.existingProjectId }])
      );

      let synced = 0;
      for (const item of items) {
        const mapped = mapMondayItemToProject(item, mappingForSync);
        const resolution = resolutionMap.get(item.id);

        if (resolution) {
          if (resolution.action === "link" && resolution.existingProjectId) {
            await storage.forceLinkProjectToMonday(
              resolution.existingProjectId,
              item.id,
              { ...mapped, mondayBoardId: boardId }
            );
          }
          // "skip" — no-op: leave this item out of this sync cycle
        } else {
          // No conflict for this item — process normally
          await storage.upsertProjectByMondayId(item.id, { ...mapped, mondayBoardId: boardId });
        }
        synced++;
      }

      // Archive stale Monday-sourced projects
      let archived = 0;
      const mondayProjects = await storage.getMondayProjectsByBoardId(boardId);
      for (const p of mondayProjects) {
        if (p.mondayItemId && !liveItemIds.has(p.mondayItemId)) {
          await storage.deleteProjectByMondayId(p.mondayItemId);
          archived++;
        }
      }
      if (archived > 0) console.log(`[monday sync] archived ${archived} stale project(s) after conflict resolution`);

      res.json({ success: true, synced, archived });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/monday/disconnect — remove all webhooks + board config (admin only)
  app.post("/api/monday/disconnect", isAuthenticated, requireAdmin, async (_req, res) => {
    try {
      const { deleteWebhooks } = await import("./services/monday");
      const idsRaw = await storage.getAppSetting("monday_webhook_ids");
      if (idsRaw) {
        try {
          const entries = JSON.parse(idsRaw);
          const ids = entries.map((w: any) => String(w.id ?? w));
          await deleteWebhooks(ids);
        } catch {}
      }
      await storage.setAppSetting("monday_board_id", null);
      await storage.setAppSetting("monday_board_name", null);
      await storage.setAppSetting("monday_webhook_ids", null);
      await storage.setAppSetting("monday_webhook_secret", null);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/webhooks/monday — receives real-time events from Monday.com (PUBLIC — verified by secret token)
  app.post("/api/webhooks/monday", async (req, res) => {
    try {
      const body = req.body;

      // Step 1: Monday.com subscription challenge — respond immediately without secret check
      if (body.challenge) {
        return res.json({ challenge: body.challenge });
      }

      // Step 2: Verify secret token embedded in URL query param
      const incomingSecret = String(req.query.secret ?? "");
      const storedSecret = await storage.getAppSetting("monday_webhook_secret");
      if (!storedSecret || incomingSecret !== storedSecret) {
        console.warn("[monday webhook] rejected: invalid secret token");
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Step 3: Validate the event's boardId matches configured board
      const configuredBoardId = await storage.getAppSetting("monday_board_id");
      const eventBoardId = String(body.event?.boardId ?? body.event?.board_id ?? "");
      if (configuredBoardId && eventBoardId && eventBoardId !== configuredBoardId) {
        console.warn(`[monday webhook] rejected: boardId mismatch (got ${eventBoardId}, expected ${configuredBoardId})`);
        return res.status(200).json({ ok: true }); // Return 200 to avoid Monday retries
      }

      const { fetchSingleItem, mapMondayItemToProject } = await import("./services/monday");
      const event = body.event;
      if (!event) return res.status(200).json({ ok: true });

      // Load column mapping once for this webhook event
      const mappingRaw = await storage.getAppSetting("monday_column_mapping");
      const columnMapping = mappingRaw ? JSON.parse(mappingRaw) : null;

      const pulseId = String(event.pulseId ?? event.itemId ?? "");
      const type = String(event.type ?? "");

      if ((type === "create_pulse" || type === "create_item") && pulseId) {
        const fullItem = await fetchSingleItem(pulseId).catch(() => null);
        if (fullItem) {
          const mapped = mapMondayItemToProject(fullItem, columnMapping);
          await storage.upsertProjectByMondayId(pulseId, { ...mapped, mondayBoardId: configuredBoardId ?? undefined });
        } else {
          await storage.upsertProjectByMondayId(pulseId, {
            name: event.pulseName ?? `Monday Item ${pulseId}`,
            status: "active",
          });
        }
      } else if ((type === "delete_pulse" || type === "delete_item") && pulseId) {
        await storage.deleteProjectByMondayId(pulseId);
      } else if ((type === "change_column_value" || type === "update_column_value") && pulseId) {
        const fullItem = await fetchSingleItem(pulseId).catch(() => null);
        if (fullItem) {
          const mapped = mapMondayItemToProject(fullItem, columnMapping);
          await storage.upsertProjectByMondayId(pulseId, { ...mapped, mondayBoardId: configuredBoardId ?? undefined });
        }
      } else if ((type === "change_name" || type === "update_name") && pulseId) {
        const fullItem = await fetchSingleItem(pulseId).catch(() => null);
        if (fullItem) {
          const mapped = mapMondayItemToProject(fullItem, columnMapping);
          await storage.upsertProjectByMondayId(pulseId, { ...mapped, mondayBoardId: configuredBoardId ?? undefined });
        } else {
          const existing = await storage.getProjectByMondayId(pulseId);
          if (existing) {
            await storage.upsertProjectByMondayId(pulseId, {
              name: event.value?.name ?? event.value?.text ?? existing.name,
              status: existing.status,
            });
          }
        }
      } else if (
        (type === "move_pulse_into_board" || type === "move_pulse_into_group" || type === "move_item_to_group") && pulseId
      ) {
        // Item moved to a different group (customer) — re-fetch to capture updated group info
        const fullItem = await fetchSingleItem(pulseId).catch(() => null);
        if (fullItem) {
          const mapped = mapMondayItemToProject(fullItem, columnMapping);
          await storage.upsertProjectByMondayId(pulseId, { ...mapped, mondayBoardId: configuredBoardId ?? undefined });
          console.log(`[monday webhook] group-move synced: item ${pulseId} → group "${fullItem.group?.title}"`);
        }
      }

      res.json({ ok: true });
    } catch (err: any) {
      console.error("[monday webhook]", err.message);
      res.status(200).json({ ok: true }); // always 200 to Monday to prevent retries
    }
  });

  // ── Jibble Integration ────────────────────────────────────────────────────────

  /** Shared sync logic used by connect, manual sync, and periodic sync.
   *  Queries each mapped worker sequentially, merges with existing cache,
   *  and writes results + stats to storage.
   *  Returns `allFailed: true` when all retryable requests failed — caller
   *  should respond 503 and NOT overwrite cache in that case. */
  async function runJibbleSync(token: string) {
    const { fetchActiveTimeEntries } = await import("./services/jibble");

    const allWorkers = await storage.getWorkers();
    const personIds = allWorkers.map((w: any) => w.jibblePersonId).filter(Boolean) as string[];

    // Load existing cache so we can preserve entries for temp-failed workers
    const existingCacheRaw = await storage.getAppSetting("jibble_active_cache");
    const existingCache: { personId: string; firstIn: string; lastOut?: string }[] = (() => {
      try { return JSON.parse(existingCacheRaw ?? "[]"); } catch { return []; }
    })();
    const existingMap = new Map(existingCache.map((e) => [e.personId, e]));

    const result = await fetchActiveTimeEntries(token, personIds);

    // Merge: fresh data for updated, preserve cache for temp failures, drop invalids
    const newCache: { personId: string; firstIn: string; lastOut?: string }[] = [...result.updated];
    let preserved = 0;
    for (const pid of result.failed) {
      const existing = existingMap.get(pid);
      if (existing) { newCache.push(existing); preserved++; }
    }

    const success = personIds.length - result.failed.length - result.invalidIds.length;
    // "all failed" = every retryable request failed and there were no successes
    const allFailed = result.failed.length > 0 && success === 0 && result.invalidIds.length < personIds.length;

    const onSiteNow = result.updated.filter((e) => !e.lastOut).length;
    console.log(
      `[jibble-sync] total=${personIds.length} success=${success} onSite=${onSiteNow} todayAttendance=${result.updated.length}` +
      ` invalidPersonIds=${result.invalidIds.length} temporaryFailures=${result.failed.length} preserved=${preserved}`,
    );

    if (!allFailed) {
      // Accumulate invalid IDs into persistent store
      const existingInvalidRaw = await storage.getAppSetting("jibble_invalid_ids");
      const existingInvalid: string[] = (() => {
        try { return JSON.parse(existingInvalidRaw ?? "[]"); } catch { return []; }
      })();
      const mergedInvalid = Array.from(new Set([...existingInvalid, ...result.invalidIds]));

      await Promise.all([
        storage.setAppSetting("jibble_active_cache", JSON.stringify(newCache)),
        storage.setAppSetting("jibble_last_sync_at", new Date().toISOString()),
        storage.setAppSetting("jibble_invalid_ids", JSON.stringify(mergedInvalid)),
      ]);
    }

    return {
      total: personIds.length,
      success,
      punchedIn: result.updated.length,
      invalidPersonIds: result.invalidIds.length,
      temporaryFailures: result.failed.length,
      preserved,
      allFailed,
      newCache,
    };
  }

  // GET /api/jibble/status
  app.get("/api/jibble/status", isAuthenticated, requireManager, async (_req, res) => {
    try {
      const clientId = await storage.getAppSetting("jibble_client_id");
      if (!clientId) return res.json({ connected: false, activePunchIns: 0 });

      const lastSyncAt = await storage.getAppSetting("jibble_last_sync_at");
      const activeCacheRaw = await storage.getAppSetting("jibble_active_cache");
      let activePunchIns = 0;
      try {
        const cached = JSON.parse(activeCacheRaw ?? "[]");
        // Count only workers still on-site (firstIn set, no lastOut yet)
        activePunchIns = Array.isArray(cached) ? cached.filter((e: any) => !e.lastOut).length : 0;
      } catch {}

      const orgNameRaw = await storage.getAppSetting("jibble_org_name");
      res.json({ connected: true, orgName: orgNameRaw, lastSyncAt, activePunchIns });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/jibble/connect — save Client ID + Secret and test them
  app.post("/api/jibble/connect", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { clientId, clientSecret } = req.body;
      if (!clientId || typeof clientId !== "string") return res.status(400).json({ message: "clientId is required" });
      if (!clientSecret || typeof clientSecret !== "string") return res.status(400).json({ message: "clientSecret is required" });

      const { testJibbleCredentials, exchangeClientCredentials } = await import("./services/jibble");
      const result = await testJibbleCredentials(clientId.trim(), clientSecret.trim());
      if (!result.ok) {
        const detail = result.error ? ` (${result.error})` : "";
        return res.status(401).json({ message: `Jibble 인증 정보가 유효하지 않습니다. Client ID와 Secret을 다시 확인해주세요.${detail}` });
      }

      // Store credentials
      await storage.setAppSetting("jibble_client_id", clientId.trim());
      await storage.setAppSetting("jibble_client_secret", clientSecret.trim());
      if (result.orgName) await storage.setAppSetting("jibble_org_name", result.orgName);

      // Get a fresh token and cache it, then run an initial sync (best-effort)
      try {
        const { accessToken, expiresAt } = await exchangeClientCredentials(clientId.trim(), clientSecret.trim());
        await storage.setAppSetting("jibble_access_token", accessToken);
        await storage.setAppSetting("jibble_token_expires_at", String(expiresAt));
        await runJibbleSync(accessToken).catch(() => {/* best-effort on connect */});
      } catch {}

      res.json({ ok: true, orgName: result.orgName });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // DELETE /api/jibble/connect — remove credentials
  app.delete("/api/jibble/connect", isAuthenticated, requireAdmin, async (_req, res) => {
    try {
      await Promise.all([
        storage.setAppSetting("jibble_client_id", null),
        storage.setAppSetting("jibble_client_secret", null),
        storage.setAppSetting("jibble_access_token", null),
        storage.setAppSetting("jibble_token_expires_at", null),
        storage.setAppSetting("jibble_org_name", null),
        storage.setAppSetting("jibble_active_cache", null),
        storage.setAppSetting("jibble_last_sync_at", null),
      ]);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // GET /api/jibble/members — fetch members from Jibble
  app.get("/api/jibble/members", isAuthenticated, requireManager, async (_req, res) => {
    try {
      const { getJibbleToken, fetchJibbleMembers } = await import("./services/jibble");
      const token = await getJibbleToken(storage);
      const members = await fetchJibbleMembers(token);
      res.json({ members });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/jibble/sync — refresh active punch-ins cache
  app.post("/api/jibble/sync", isAuthenticated, requireManager, async (_req, res) => {
    try {
      const { getJibbleToken } = await import("./services/jibble");
      const token = await getJibbleToken(storage);
      const stats = await runJibbleSync(token);
      if (stats.allFailed) {
        return res.status(503).json({
          message: "모든 Jibble 요청이 일시적으로 실패했습니다. 기존 캐시가 유지됩니다.",
          ...stats,
        });
      }
      res.json({ ok: true, activePunchIns: stats.punchedIn, ...stats });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/jibble/map — map a Jibble person to a local worker
  app.post("/api/jibble/map", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { jibblePersonId, workerId } = req.body;
      if (!jibblePersonId) return res.status(400).json({ message: "jibblePersonId is required" });

      if (workerId === null || workerId === undefined) {
        // Unmap: clear jibblePersonId from any worker that had this Jibble person
        const allWorkers = await storage.getWorkers();
        const existing = allWorkers.find((w) => w.jibblePersonId === jibblePersonId);
        if (existing) await storage.updateWorker(existing.id, { jibblePersonId: null });
        return res.json({ ok: true });
      }

      // Validate personId exists in Jibble and fetch employee number
      let employeeNumber: string | undefined;
      let memberNotFound = false;
      try {
        const { getJibbleToken, fetchJibbleMembers } = await import("./services/jibble");
        const token = await getJibbleToken(storage);
        const members = await fetchJibbleMembers(token);
        const member = members.find((m) => (m.uid ?? m.id) === jibblePersonId);
        if (!member) {
          memberNotFound = true;
        } else {
          employeeNumber = member?.employeeCode ?? member?.employeeNumber;
          // Remove from invalid list if it was previously flagged
          const invalidRaw = await storage.getAppSetting("jibble_invalid_ids");
          const invalid: string[] = (() => { try { return JSON.parse(invalidRaw ?? "[]"); } catch { return []; } })();
          if (invalid.includes(jibblePersonId)) {
            await storage.setAppSetting("jibble_invalid_ids", JSON.stringify(invalid.filter((id) => id !== jibblePersonId)));
          }
        }
      } catch (fetchErr: any) {
        // Network/token error during validation — allow mapping but warn
        console.warn("[jibble] map validation fetch failed:", fetchErr.message);
      }
      if (memberNotFound) {
        return res.status(400).json({ message: "해당 Jibble 멤버를 찾을 수 없습니다. 멤버 목록을 새로고침하고 다시 시도해주세요." });
      }

      await storage.updateWorker(workerId, {
        jibblePersonId,
        ...(employeeNumber ? { employeeId: employeeNumber } : {}),
      });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  // DELETE /api/jibble/map/:workerId — remove Jibble mapping for a specific worker
  app.delete("/api/jibble/map/:workerId", isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const workerId = parseInt(req.params.workerId);
      if (isNaN(workerId)) return res.status(400).json({ message: "Invalid workerId" });
      const worker = await storage.getWorker(workerId);
      if (!worker) return res.status(404).json({ message: "Worker not found" });

      const prevPersonId = worker.jibblePersonId;
      await storage.updateWorker(workerId, { jibblePersonId: null });

      // Remove from invalid IDs list if present
      if (prevPersonId) {
        const invalidRaw = await storage.getAppSetting("jibble_invalid_ids");
        const invalid: string[] = (() => { try { return JSON.parse(invalidRaw ?? "[]"); } catch { return []; } })();
        if (invalid.includes(prevPersonId)) {
          await storage.setAppSetting("jibble_invalid_ids", JSON.stringify(invalid.filter((id) => id !== prevPersonId)));
        }
      }
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // GET /api/jibble/invalid-mappings — workers whose Jibble personId returned 404
  app.get("/api/jibble/invalid-mappings", isAuthenticated, requireManager, async (_req, res) => {
    try {
      const invalidRaw = await storage.getAppSetting("jibble_invalid_ids");
      const invalidIds: string[] = (() => { try { return JSON.parse(invalidRaw ?? "[]"); } catch { return []; } })();
      if (invalidIds.length === 0) return res.json({ invalidMappings: [] });

      const allWorkers = await storage.getWorkers();
      const invalidMappings = invalidIds
        .map((jibblePersonId) => {
          const worker = allWorkers.find((w) => w.jibblePersonId === jibblePersonId);
          if (!worker) return null;
          return { workerId: worker.id, workerName: worker.fullName, jibblePersonId };
        })
        .filter(Boolean);

      res.json({ invalidMappings });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // GET /api/jibble/active — currently punched-in workers (with local worker info)
  app.get("/api/jibble/active", isAuthenticated, requireManager, async (_req, res) => {
    try {
      const cacheRaw = await storage.getAppSetting("jibble_active_cache");
      const entries = JSON.parse(cacheRaw ?? "[]");
      const allWorkers = await storage.getWorkers();

      const result = (Array.isArray(entries) ? entries : []).map((entry: any) => {
        // TimeEntry schema uses personId (Guid); personUid kept as legacy fallback
        const worker = allWorkers.find((w) => w.jibblePersonId === (entry.personId ?? entry.personUid)) ?? null;
        return { entry, worker };
      });

      res.json({ active: result });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // GET /api/jibble/attendance/:workerId — Jibble attendance history for a worker
  app.get("/api/jibble/attendance/:workerId", isAuthenticated, requireManager, async (req, res) => {
    try {
      const workerId = parseInt(req.params.workerId);
      if (isNaN(workerId)) return res.status(400).json({ message: "Invalid worker ID" });

      const worker = await storage.getWorker(workerId);
      if (!worker) return res.status(404).json({ message: "Worker not found" });
      if (!worker.jibblePersonId) return res.json({ records: [], notLinked: true });

      const clientId = await storage.getAppSetting("jibble_client_id");
      if (!clientId) return res.json({ records: [], notConnected: true });

      const { getJibbleToken, fetchAttendance } = await import("./services/jibble");
      const token = await getJibbleToken(storage);
      const to   = new Date().toISOString().slice(0, 10);
      const from = new Date(Date.now() - 60 * 86400 * 1000).toISOString().slice(0, 10);
      const records = await fetchAttendance(token, { personId: worker.jibblePersonId, from, to });

      res.json({ records });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── Periodic Jibble sync (every 10 minutes) ───────────────────────────────────
  setInterval(async () => {
    try {
      const clientId = await storage.getAppSetting("jibble_client_id");
      if (!clientId) return;
      const { getJibbleToken } = await import("./services/jibble");
      const token = await getJibbleToken(storage);
      const stats = await runJibbleSync(token);
      if (stats.allFailed) {
        console.warn("[jibble] periodic sync: all requests failed — cache preserved");
      } else {
        console.log(`[jibble] periodic sync complete: ${stats.punchedIn} active punch-ins`);
      }
    } catch (err: any) {
      console.warn("[jibble] periodic sync failed:", err.message);
    }
  }, 10 * 60 * 1000);

  return httpServer;
}
