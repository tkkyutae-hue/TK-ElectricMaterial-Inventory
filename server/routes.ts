import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { derivedFamily, derivedType, extractSubcategory } from "./storage";
import { classifyInventoryItem } from "../shared/classifyItem";
import { classifyReel, resolveReelMode } from "../shared/reelEligibility";
import { insertItemSchema } from "../shared/schema";
import { validateNewMovement, validateDraftForConfirmation } from "./services/inventory/movement-validation";
import { z } from "zod";
import { registerAuthRoutes, authStorage } from "./replit_integrations/auth";
import { isAuthenticated } from "./replit_integrations/auth/replitAuth";
import multer from "multer";
import path from "path";
import fs from "fs";
import express from "express";
import crypto from "crypto";

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
const requireAdmin   = (req: any, res: any, next: any) => requireRole("admin", req, res, next);
// Normal admin operations (inventory CRUD, suppliers, projects, reports, etc.)
const requireManager = (req: any, res: any, next: any) => requireRole(["admin", "manager"], req, res, next);
// Field operations (movements, transactions, drafts)
const requireStaff   = (req: any, res: any, next: any) => requireRole(["admin", "manager", "staff"], req, res, next);

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    cb(null, allowed.includes(file.mimetype));
  },
});

function getUserId(req: any): string | null {
  return (req.session as any)?.userId ?? null;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  registerAuthRoutes(app);

  app.use("/uploads", express.static(uploadsDir));

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
    res.json(await storage.getFieldTypes({ categoryId, family }));
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
    const type = req.query.type as string | undefined;
    const subcategory = req.query.subcategory as string | undefined;
    const size = req.query.size as string | undefined;
    const status = req.query.status as string | undefined;
    const search = req.query.q as string | undefined;
    const page = req.query.page ? Number(req.query.page) : 1;
    const perPage = req.query.perPage ? Number(req.query.perPage) : 10;
    res.json(await storage.getFieldItems({ categoryId, family, type, subcategory, size, status, search, page, perPage }));
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
  app.get("/api/projects", isAuthenticated, async (_req, res) => {
    res.json(await storage.getProjects());
  });

  app.get("/api/projects/:id", isAuthenticated, async (req, res) => {
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

  // ─── Items ──────────────────────────────────────────────────────────────────
  app.get("/api/items", isAuthenticated, async (req, res) => {
    const search     = req.query.search as string | undefined;
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
    const locationId = req.query.locationId ? Number(req.query.locationId) : undefined;
    const status     = req.query.status as string | undefined;

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
      search, categoryId, locationId, status,
      sort, dir,
      ...(pageParam !== undefined ? { page: pageParam, perPage } : {}),
    });

    if (pageParam === undefined) {
      return res.json(result.items);
    }

    res.json({ items: result.items, total: result.total });
  });

  app.get("/api/items/:id", isAuthenticated, async (req, res) => {
    const data = await storage.getItem(Number(req.params.id));
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
      const body = {
        ...req.body,
        categoryId: req.body.categoryId ? Number(req.body.categoryId) : undefined,
        primaryLocationId: req.body.primaryLocationId ? Number(req.body.primaryLocationId) : undefined,
        supplierId: req.body.supplierId ? Number(req.body.supplierId) : undefined,
      };
      res.json(await storage.updateItem(Number(req.params.id), body));
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/items/:id", isAuthenticated, requireManager, async (req, res) => {
    await storage.deleteItem(Number(req.params.id));
    res.status(204).end();
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
      if (isNaN(qty) || qty <= 0) return res.status(400).json({ message: "quantity must be a positive number" });

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
        projectId: body.projectId ? Number(body.projectId) : null,
        unitCostSnapshot: item.unitCost,
        note: body.note ?? null,
        reason: body.reason ?? null,
        referenceType: body.referenceType ?? null,
        referenceId: body.referenceId ?? null,
        createdBy: getUserId(req),
      });

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
          projectId: req.body.projectId ? Number(req.body.projectId) : null,
          unitCostSnapshot: item.unitCost,
          note: req.body.note ?? null,
          reason: req.body.reason ?? null,
          createdBy: getUserId(req),
        });

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
      else if (movementType === 'issue') newQty -= qty;
      else if (movementType === 'adjust') newQty = qty;

      const movement = await storage.createInventoryMovement({
        itemId: item.id,
        movementType,
        quantity: qty,
        previousQuantity: item.quantityOnHand,
        newQuantity: newQty,
        sourceLocationId: req.body.sourceLocationId ? Number(req.body.sourceLocationId) : null,
        destinationLocationId: req.body.destinationLocationId ? Number(req.body.destinationLocationId) : null,
        note: req.body.note ?? null,
        createdBy: getUserId(req),
      });
      res.status(201).json(movement);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Internal error" });
    }
  });

  app.put("/api/movements/:id", isAuthenticated, requireManager, async (req, res) => {
    try {
      const id = Number(req.params.id);
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
      const id = Number(req.params.id);
      const reverted = await storage.undoMovementEdit(id);
      res.json(reverted);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/movements/:id", isAuthenticated, requireManager, async (req, res) => {
    try {
      await storage.deleteMovement(Number(req.params.id));
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
      const { baseItemName, imageUrl, newName } = req.body;
      if (!baseItemName) return res.status(400).json({ message: "baseItemName is required" });
      if (newName && newName !== baseItemName) {
        await storage.renameFamily(categoryId, baseItemName, newName);
        await storage.upsertItemGroup(categoryId, newName, { imageUrl: imageUrl ?? null });
        return res.json({ success: true });
      }
      const updated = await storage.upsertItemGroup(categoryId, baseItemName, { imageUrl: imageUrl ?? null });
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/inventory/items/move-family", isAuthenticated, requireManager, async (req, res) => {
    try {
      const { itemIds, newBaseItemName } = req.body;
      if (!Array.isArray(itemIds) || itemIds.length === 0) return res.status(400).json({ message: "itemIds required" });
      if (!newBaseItemName) return res.status(400).json({ message: "newBaseItemName required" });
      await storage.moveFamilyItems(itemIds.map(Number), newBaseItemName);
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
  app.get("/api/reorder/recommendations", isAuthenticated, async (_req, res) => {
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

  // ─── Reports ─────────────────────────────────────────────────────────────────
  app.get("/api/reports/low-stock", isAuthenticated, async (_req, res) => {
    res.json(await storage.getReportLowStock());
  });

  app.get("/api/reports/by-location", isAuthenticated, async (_req, res) => {
    res.json(await storage.getReportByLocation());
  });

  app.get("/api/reports/valuation", isAuthenticated, async (_req, res) => {
    res.json(await storage.getReportValuation());
  });

  app.get("/api/reports/usage-by-project", isAuthenticated, async (_req, res) => {
    res.json(await storage.getReportUsageByProject());
  });

  // ─── Movement Drafts ─────────────────────────────────────────────────────────

  app.get("/api/drafts", isAuthenticated, async (_req, res) => {
    try {
      res.json(await storage.getDrafts());
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/drafts/:id", isAuthenticated, async (req, res) => {
    try {
      const draft = await storage.getDraft(Number(req.params.id));
      if (!draft) return res.status(404).json({ message: "Draft not found" });
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

  app.delete("/api/drafts/:id", isAuthenticated, requireStaff, async (req, res) => {
    try {
      await storage.deleteDraft(Number(req.params.id));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/drafts/:id/confirm", isAuthenticated, requireStaff, async (req, res) => {
    try {
      const draftId = Number(req.params.id);
      const draft = await storage.getDraft(draftId);
      if (!draft) return res.status(404).json({ message: "Draft not found" });

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

      await storage.confirmDraft(draftId, getUserId(req));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/upload/item-image", isAuthenticated, requireManager, upload.single("file"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No file or unsupported file type. Allowed: jpg, jpeg, png, webp (max 8 MB)." });
    }
    res.json({ url: `/uploads/${req.file.filename}` });
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
        role: ["admin", "manager", "staff", "viewer"],
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
      if (role && ["admin", "manager", "staff", "viewer"].includes(role)) update.role = role;
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

      // ── Helper: export filename (sequence is extensible for future deduplication) ──
      const buildExportFilename = (seq: number = 1): string => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        return `GA WAREHOUSE MATERIAL STATUS-${year}-${month}(${seq}).xlsx`;
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
        l2Bg:      "FFF0E6D3",  // light beige – level-2 group (detailType)
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
      function exportSizeKey(item: any): number {
        const label = (item.sizeLabel ?? "").trim();
        if (!label) return 999999;
        // AWG/KCMIL lookup takes priority (standardised wire-size sort order)
        if (EXPORT_AWG_MAP[label] !== undefined) return EXPORT_AWG_MAP[label];
        // Strip leading # and retry (e.g. "#1/0" → "1/0")
        const stripped = label.replace(/^#/, "");
        if (EXPORT_AWG_MAP[stripped] !== undefined) return EXPORT_AWG_MAP[stripped];
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

      // ── 8 base export columns ─────────────────────────────────────────────────────
      const COLS = [
        { key: "matName",   header: "Material Name", width: 36 },
        { key: "size",      header: "Size",          width: 14 },
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

        // ── Sort: subcategory → detailType → baseItemName → exportSizeKey ───────────
        const sorted = [...catItems].sort((a, b) => {
          const fa = (a.subcategory  || "\uFFFF").toLowerCase();
          const fb = (b.subcategory  || "\uFFFF").toLowerCase();
          if (fa !== fb) return fa.localeCompare(fb);
          const ta = (a.detailType   || "\uFFFF").toLowerCase();
          const tb = (b.detailType   || "\uFFFF").toLowerCase();
          if (ta !== tb) return ta.localeCompare(tb);
          const na = (a.baseItemName || a.name || "").toLowerCase();
          const nb = (b.baseItemName || b.name || "").toLowerCase();
          if (na !== nb) return na.localeCompare(nb);
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

        // ── Add grouped data rows ─────────────────────────────────────────────────
        const SENTINEL = "\x00__sentinel__";
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
              let buf: Buffer | null = null;
              let ext: "jpeg" | "png" | null = null;

              if (srcUrl.startsWith("data:image/")) {
                // ── base64 data URI ─────────────────────────────────────────────
                const semicolon = srcUrl.indexOf(";");
                const comma     = srcUrl.indexOf(",");
                if (semicolon === -1 || comma === -1) {
                  console.warn("[export] PHOTO: malformed data URI, skipping:", srcUrl.slice(0, 60));
                } else {
                  const mime    = srcUrl.slice("data:image/".length, semicolon).toLowerCase();
                  const rawExt  = mime === "jpg" || mime === "jpeg" ? "jpeg" : mime === "png" ? "png" : null;
                  if (!rawExt) {
                    console.warn("[export] PHOTO: unsupported data URI mime type:", mime, "— skipping");
                  } else {
                    ext = rawExt;
                    buf = Buffer.from(srcUrl.slice(comma + 1), "base64");
                  }
                }
              } else if (srcUrl.startsWith("https://") || srcUrl.startsWith("http://")) {
                // ── remote HTTP(S) URL ──────────────────────────────────────────
                const resp = await fetch(srcUrl);
                if (!resp.ok) {
                  console.warn("[export] PHOTO: HTTP fetch failed (status", resp.status, ") for:", srcUrl);
                } else {
                  const ct = (resp.headers.get("content-type") ?? "").toLowerCase();
                  const rawExt = ct.includes("jpeg") || ct.includes("jpg") ? "jpeg"
                               : ct.includes("png")  ? "png"
                               : null;
                  if (!rawExt) {
                    console.warn("[export] PHOTO: unsupported content-type", ct, "for:", srcUrl);
                  } else {
                    ext = rawExt;
                    buf = Buffer.from(await resp.arrayBuffer());
                  }
                }
              } else if (srcUrl.startsWith("/uploads/")) {
                // ── local /uploads/ file ────────────────────────────────────────
                const filename = srcUrl.slice("/uploads/".length);
                const fsPath   = path.join(process.cwd(), "uploads", filename);
                if (fs.existsSync(fsPath)) {
                  buf = fs.readFileSync(fsPath);
                  const raw = path.extname(fsPath).slice(1).toLowerCase();
                  ext = (raw === "jpg" ? "jpeg" : raw) as "jpeg" | "png";
                } else {
                  console.warn("[export] PHOTO: local file not found:", fsPath);
                }
              } else {
                console.warn("[export] PHOTO: unrecognised image source format, skipping:", srcUrl.slice(0, 80));
              }

              if (buf && ext) {
                const imageId = wb.addImage({ buffer: buf, extension: ext });
                ws.addImage(imageId, {
                  tl: { col: 0, row: startRow - 1 },
                  br: { col: 1, row: endRow },
                  editAs: "oneCell",
                });
              }
            } catch (err) {
              console.warn("[export] PHOTO: unexpected error embedding image from", srcUrl.slice(0, 80), "—", err);
            }
          }
          photoBaseStartRow = null;
          photoBaseImageUrl = null;
        };

        for (const item of sorted) {
          const family  = item.subcategory ?? null;
          const type    = item.detailType  ?? null;
          const base    = item.baseItemName || item.name || null;
          const status  = itemStatus(item);
          const qty     = item.quantityOnHand ?? 0;

          const familyKey = family ?? "";
          const typeKey   = type   ?? "";
          const baseKey   = base   ?? "";

          if (familyKey !== lastFamily) {
            lastFamily = familyKey;
            lastType   = SENTINEL;
            lastBase   = SENTINEL;
            addGroupRow(family || "(No Family)", 1);
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
            matName:   item.baseItemName || item.name || "",
            size:      item.sizeLabel   ?? "",
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

          const dataRow = ws.addRow(rowData);
          dataRow.height = 16;
          dataRow.getCell("matName").alignment = { vertical: "middle", indent: 4 };

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

        // ── Freeze pane: header row + PHOTO column frozen ────────────────────────
        ws.views = [{ state: "frozen", xSplit: 1, ySplit: 1, topLeftCell: "B2", activeCell: "B2" }];

        // ── Auto-filter on header row (all columns incl. PHOTO) ──────────────────
        ws.autoFilter = { from: "A1", to: `${colLetter(totalCols + 1)}1` };
      }

      // 5. Stream buffer to client
      const filename = buildExportFilename(1);
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

  // ─── Daily Reports ─────────────────────────────────────────────────────────

  app.get("/api/daily-reports", isAuthenticated, async (req, res) => {
    try {
      const projectId = parseInt(req.query.projectId as string);
      if (isNaN(projectId)) return res.status(400).json({ message: "projectId is required" });
      const reports = await storage.getDailyReports(projectId);
      res.json(reports);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/daily-reports-summary", isAuthenticated, async (_req, res) => {
    try {
      const summary = await storage.getDailyReportSummary();
      res.json(summary);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/daily-reports/:id", isAuthenticated, async (req, res) => {
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

  app.get("/api/workers", isAuthenticated, async (_req, res) => {
    res.json(await storage.getWorkers());
  });

  app.get("/api/workers/:id", isAuthenticated, async (req, res) => {
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
  app.get("/api/workers/:id/attendance", isAuthenticated, async (req, res) => {
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
  app.get("/api/workers/:id/evaluations", isAuthenticated, async (req, res) => {
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

  app.get("/api/projects/:id/progress", isAuthenticated, async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      if (isNaN(projectId)) return res.status(400).json({ message: "Invalid project ID" });
      const data = await storage.getProjectProgress(projectId);
      res.json(data);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/projects/:id/scope-items", isAuthenticated, async (req, res) => {
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

  return httpServer;
}
