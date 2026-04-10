import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { derivedFamily, derivedType, extractSubcategory } from "./storage";
import { classifyInventoryItem } from "../shared/classifyItem";
import { isReelEligible, getReelIneligibilityReason } from "../shared/reelEligibility";
import { validateNewMovement, validateDraftForConfirmation } from "./services/inventory/movement-validation";
import { z } from "zod";
import { registerAuthRoutes, authStorage } from "./replit_integrations/auth";
import { isAuthenticated } from "./replit_integrations/auth/replitAuth";
import multer from "multer";
import path from "path";
import fs from "fs";
import express from "express";
import crypto from "crypto";

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
      const dbUrl = process.env.DATABASE_URL ?? "";
      const dbName = dbUrl.split("/").pop()?.split("?")[0] ?? "unknown";
      res.json({ ok: true, db: "ok", dbName, env: process.env.NODE_ENV ?? "development", ts: new Date().toISOString() });
    } catch (err: any) {
      res.status(503).json({ ok: false, db: "error", error: err.message });
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

  app.post("/api/locations", isAuthenticated, async (req, res) => {
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

  app.delete("/api/locations/:id", isAuthenticated, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ ok: false, error: "Invalid id" });
      await storage.deleteLocation(id);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ ok: false, error: err.message });
    }
  });

  app.post("/api/locations/:id/restore", isAuthenticated, async (req, res) => {
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

  app.post("/api/suppliers", isAuthenticated, async (req, res) => {
    try {
      const data = await storage.createSupplier(req.body);
      res.status(201).json(data);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.put("/api/suppliers/:id", isAuthenticated, async (req, res) => {
    try {
      const data = await storage.updateSupplier(Number(req.params.id), req.body);
      res.json(data);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/suppliers/:id", isAuthenticated, async (req, res) => {
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

  app.post("/api/projects", isAuthenticated, async (req, res) => {
    try {
      const data = await storage.createProject(req.body);
      res.status(201).json(data);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.put("/api/projects/:id", isAuthenticated, async (req, res) => {
    try {
      const data = await storage.updateProject(Number(req.params.id), req.body);
      res.json(data);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/projects/:id", isAuthenticated, async (req, res) => {
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
      page: pageParam ?? 1,
      perPage,
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
  app.post("/api/items/classify", isAuthenticated, async (req, res) => {
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

  app.post("/api/items", isAuthenticated, async (req, res) => {
    try {
      const { imageUrl, ...rest } = req.body;
      const catId = rest.categoryId ? Number(rest.categoryId) : undefined;

      // Auto-classify subcategory/detailType when not explicitly provided
      const autoFields = (!rest.subcategory || !rest.detailType)
        ? await autoClassify(rest.name || '', rest.baseItemName, catId)
        : {};

      const body = {
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
      const created = await storage.createItem(body);
      if (imageUrl && typeof imageUrl === "string" && imageUrl.trim()) {
        await storage.createItemImage(created.id, imageUrl.trim());
      }
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.put("/api/items/:id", isAuthenticated, async (req, res) => {
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

  app.delete("/api/items/:id", isAuthenticated, async (req, res) => {
    await storage.deleteItem(Number(req.params.id));
    res.status(204).end();
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
  app.post("/api/movements", isAuthenticated, async (req, res) => {
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
    app.post(`/api/movements/${type}`, isAuthenticated, async (req, res) => {
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
  app.post("/api/items/movements", isAuthenticated, async (req, res) => {
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

  app.put("/api/movements/:id", isAuthenticated, async (req, res) => {
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

  app.post("/api/movements/:id/undo", isAuthenticated, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const reverted = await storage.undoMovementEdit(id);
      res.json(reverted);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/movements/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteMovement(Number(req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/movements/bulk-delete", isAuthenticated, async (req, res) => {
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

  app.post("/api/movements/bulk-restore", isAuthenticated, async (req, res) => {
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
  app.put("/api/inventory/category/:categoryId/item-groups", isAuthenticated, async (req, res) => {
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

  app.post("/api/inventory/items/move-family", isAuthenticated, async (req, res) => {
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

  app.post("/api/inventory/items/bulk-delete", isAuthenticated, async (req, res) => {
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

  app.post("/api/reorder/generate", isAuthenticated, async (_req, res) => {
    const data = await storage.generatePurchaseRecommendations();
    res.json(data);
  });

  app.put("/api/reorder/recommendations/:id/status", isAuthenticated, async (req, res) => {
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

  app.post("/api/drafts", isAuthenticated, async (req, res) => {
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

  app.delete("/api/drafts/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteDraft(Number(req.params.id));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/drafts/:id/confirm", isAuthenticated, async (req, res) => {
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

  app.post("/api/upload/item-image", isAuthenticated, upload.single("file"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No file or unsupported file type. Allowed: jpg, jpeg, png, webp (max 8 MB)." });
    }
    res.json({ url: `/uploads/${req.file.filename}` });
  });

  app.patch("/api/inventory/:id/image", isAuthenticated, async (req, res) => {
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

  // Admin Tools only (User Approvals, Export)
  const requireAdmin   = (req: any, res: any, next: any) => requireRole("admin", req, res, next);
  // Normal admin operations (inventory CRUD, suppliers, projects, reports, etc.)
  const requireManager = (req: any, res: any, next: any) => requireRole(["admin", "manager"], req, res, next);
  // Field operations (movements, transactions)
  const requireStaff   = (req: any, res: any, next: any) => requireRole(["admin", "manager", "staff"], req, res, next);

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
        headerBg:  "FF1A2E44",  // dark navy  – header row
        l1Bg:      "FF2D3748",  // dark slate – level-1 group (대분류)
        l2Bg:      "FFF0E6D3",  // light beige – level-2 group (중분류)
        white:     "FFFFFFFF",
        darkText:  "FF1A1A1A",
        greenText: "FF1D6B3B",  greenBg: "FFD6F5E3",  // In Stock
        redText:   "FF9B1C1C",  redBg:   "FFFDE8E8",  // Out of Stock
        orangeText:"FF92400E",  orangeBg:"FFFEF3C7",  // Low Stock
      } as const;

      // ── 8 export columns ──────────────────────────────────────────────────────────
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
      const NUM_COLS = COLS.length;
      const lastColLetter = String.fromCharCode(64 + NUM_COLS); // "H"

      // ── Build one worksheet per category ─────────────────────────────────────────
      for (const cat of allCategories) {
        const catItems = byCategoryId.get(cat.id);
        if (!catItems || catItems.length === 0) continue;

        const ws = wb.addWorksheet(toSheetName(cat.name));
        ws.columns = COLS.map(c => ({ key: c.key, width: c.width }));

        // ── Header row ────────────────────────────────────────────────────────────
        const headerRow = ws.addRow(COLS.map(c => c.header));
        headerRow.height = 22;
        headerRow.eachCell({ includeEmpty: true }, cell => {
          cell.font      = { bold: true, size: 11, color: { argb: C.white } };
          cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: C.headerBg } };
          cell.alignment = { vertical: "middle", horizontal: "center" };
          cell.border    = { bottom: { style: "thin", color: { argb: C.white } } };
        });

        // ── Sort: subcategory → detailType → baseItemName → sizeSortValue ─────────
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
          return (a.sizeSortValue ?? 0) - (b.sizeSortValue ?? 0);
        });

        // ── Group-row helper ──────────────────────────────────────────────────────
        const addGroupRow = (label: string, level: 1 | 2) => {
          const gRow = ws.addRow([label]);
          gRow.height = level === 1 ? 20 : 18;
          const isL1 = level === 1;
          gRow.eachCell({ includeEmpty: true }, cell => {
            cell.font      = { bold: true, size: isL1 ? 11 : 10, color: { argb: isL1 ? C.white : C.darkText } };
            cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: isL1 ? C.l1Bg : C.l2Bg } };
            cell.alignment = { vertical: "middle", indent: isL1 ? 1 : 2 };
          });
          ws.mergeCells(gRow.number, 1, gRow.number, NUM_COLS);
        };

        // ── Add grouped data rows ─────────────────────────────────────────────────
        const SENTINEL = "\x00__sentinel__";
        let lastFamily: string = SENTINEL;
        let lastType:   string = SENTINEL;

        for (const item of sorted) {
          const family  = item.subcategory ?? null;
          const type    = item.detailType  ?? null;
          const status  = itemStatus(item);
          const qty     = item.quantityOnHand ?? 0;

          const familyKey = family ?? "";
          const typeKey   = type   ?? "";

          if (familyKey !== lastFamily) {
            lastFamily = familyKey;
            lastType   = SENTINEL;
            addGroupRow(family || "(No Family)", 1);
          }
          if (typeKey !== lastType) {
            lastType = typeKey;
            if (type) addGroupRow(type, 2);
          }

          const updatedAt = item.updatedAt
            ? new Date(item.updatedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" })
            : "";

          const dataRow = ws.addRow({
            matName:   item.baseItemName || item.name || "",
            size:      item.sizeLabel   ?? "",
            family:    family           ?? "",
            type:      type             ?? "",
            qty,
            unit:      item.unitOfMeasure ?? "",
            status,
            updatedAt,
          });

          dataRow.height = 16;
          dataRow.getCell("matName").alignment = { vertical: "middle", indent: 3 };

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
        }

        // ── Freeze pane at A2 ────────────────────────────────────────────────────
        ws.views = [{ state: "frozen", xSplit: 0, ySplit: 1, topLeftCell: "A2", activeCell: "A2" }];

        // ── Auto-filter on header row ────────────────────────────────────────────
        ws.autoFilter = { from: "A1", to: `${lastColLetter}1` };
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

  // ─── Admin Export (CSV) ──────────────────────────────────────────────────────
  app.get("/api/admin/export/:table", isAuthenticated, requireAdmin, async (req, res) => {
    const ALLOWED = ["categories", "locations", "suppliers", "projects", "items", "inventory_movements", "inventory_location_balances", "item_groups", "users"];
    const table = req.params.table;
    if (!ALLOWED.includes(table)) {
      return res.status(400).json({ message: "Unknown table" });
    }
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const result = await db.execute(sql.raw(`SELECT * FROM ${table} LIMIT 50000`));
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

  // ─── Admin Reel Audit ────────────────────────────────────────────────────────
  // Read-only: items that have legacy reel records but are no longer eligible
  app.get("/api/admin/reel-audit", isAuthenticated, requireAdmin, async (_req, res) => {
    try {
      const { db } = await import("./db");
      const { sql: drizzleSql, eq: drizzleEq, asc: drizzleAsc } = await import("drizzle-orm");
      const { items: itemsTable, wireReels: wireReelsTable, categories: categoriesTable } = await import("../shared/schema");

      // Fetch all items that have at least one wire_reel row (active or deleted)
      const rows = await db
        .select({
          id:           itemsTable.id,
          name:         itemsTable.name,
          sku:          itemsTable.sku,
          subcategory:  itemsTable.subcategory,
          detailType:   itemsTable.detailType,
          baseItemName: itemsTable.baseItemName,
          unitOfMeasure:itemsTable.unitOfMeasure,
          quantityOnHand: itemsTable.quantityOnHand,
          categoryId:   itemsTable.categoryId,
          categoryName: categoriesTable.name,
          categoryCode: categoriesTable.code,
          reelCount:    drizzleSql<number>`cast(count(${wireReelsTable.id}) as int)`,
        })
        .from(wireReelsTable)
        .innerJoin(itemsTable, drizzleEq(wireReelsTable.itemId, itemsTable.id))
        .leftJoin(categoriesTable, drizzleEq(itemsTable.categoryId, categoriesTable.id))
        .groupBy(
          itemsTable.id, itemsTable.name, itemsTable.sku,
          itemsTable.subcategory, itemsTable.detailType, itemsTable.baseItemName,
          itemsTable.unitOfMeasure, itemsTable.quantityOnHand, itemsTable.categoryId,
          categoriesTable.name, categoriesTable.code,
        )
        .orderBy(drizzleAsc(itemsTable.name));

      // Filter to only non-eligible items and annotate with reason
      const auditRows = rows
        .filter(row => !isReelEligible({
          name: row.name,
          sku: row.sku,
          subcategory: row.subcategory,
          detailType: row.detailType,
          baseItemName: row.baseItemName,
          category: { name: row.categoryName, code: row.categoryCode },
        }))
        .map(row => ({
          id:            row.id,
          name:          row.name,
          sku:           row.sku,
          category:      row.categoryName ?? "—",
          subcategory:   row.subcategory ?? "—",
          unitOfMeasure: row.unitOfMeasure,
          quantityOnHand:row.quantityOnHand,
          reelCount:     row.reelCount,
          reelEligible:  false,
          reason:        getReelIneligibilityReason({
            name: row.name,
            sku: row.sku,
            subcategory: row.subcategory,
            detailType: row.detailType,
            baseItemName: row.baseItemName,
            category: { name: row.categoryName, code: row.categoryCode },
          }) ?? "Non-eligible item",
        }));

      res.json({ rows: auditRows, total: auditRows.length });
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

  app.post("/api/wire-reels/bulk", isAuthenticated, async (req, res) => {
    try {
      const { reels } = z.object({ reels: z.array(reelSchema).min(1) }).parse(req.body);

      // Validate reel eligibility for every unique itemId in this batch
      const uniqueItemIds = [...new Set(reels.map(r => r.itemId))];
      for (const itemId of uniqueItemIds) {
        const item = await storage.getItem(itemId);
        if (!item) {
          return res.status(400).json({
            message: "Item not found",
            errors: [{ field: "itemId", message: `Item ${itemId} does not exist` }],
          });
        }
        if (!isReelEligible(item)) {
          return res.status(400).json({
            message: "Reel operations are not allowed for this item type",
            errors: [{ field: "itemId", message: "This item is not reel-eligible" }],
          });
        }
      }

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

  app.post("/api/wire-reels", isAuthenticated, async (req, res) => {
    try {
      const data = reelSchema.parse(req.body);

      // Validate reel eligibility before creating
      const item = await storage.getItem(data.itemId);
      if (!item) {
        return res.status(400).json({
          message: "Item not found",
          errors: [{ field: "itemId", message: "Item does not exist" }],
        });
      }
      if (!isReelEligible(item)) {
        return res.status(400).json({
          message: "Reel operations are not allowed for this item type",
          errors: [{ field: "itemId", message: "This item is not reel-eligible" }],
        });
      }

      const reel = await storage.createWireReel(data);
      res.status(201).json(reel);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/wire-reels/:id", isAuthenticated, async (req, res) => {
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

  app.post("/api/wire-reels/:id/restore", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid reel ID" });
      const reel = await storage.restoreWireReel(id);
      res.json(reel);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/wire-reels/:id", isAuthenticated, async (req, res) => {
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

  app.post("/api/daily-reports", isAuthenticated, async (req, res) => {
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

  app.patch("/api/daily-reports/:id", isAuthenticated, async (req, res) => {
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

  app.delete("/api/daily-reports/:id", isAuthenticated, async (req: any, res) => {
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

  app.post("/api/workers", isAuthenticated, async (req, res) => {
    try {
      const worker = await storage.createWorker(req.body);
      res.status(201).json(worker);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.put("/api/workers/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid worker ID" });
      const worker = await storage.updateWorker(id, req.body);
      res.json(worker);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/workers/:id", isAuthenticated, async (req, res) => {
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

  app.post("/api/workers/:id/attendance", isAuthenticated, async (req, res) => {
    try {
      const workerId = parseInt(req.params.id);
      if (isNaN(workerId)) return res.status(400).json({ message: "Invalid worker ID" });
      const record = await storage.createWorkerAttendance({ ...req.body, workerId });
      res.json(record);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/workers/:id/attendance/:recordId", isAuthenticated, async (req, res) => {
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

  app.post("/api/workers/:id/evaluations", isAuthenticated, async (req, res) => {
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

  app.post("/api/projects/:id/scope-items", isAuthenticated, async (req, res) => {
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

  app.patch("/api/scope-items/:id", isAuthenticated, async (req, res) => {
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

  app.delete("/api/scope-items/:id", isAuthenticated, async (req, res) => {
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

  return httpServer;
}
