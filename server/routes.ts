import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { derivedFamily, derivedType, extractSubcategory } from "./storage";
import { classifyInventoryItem } from "../shared/classifyItem";
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
    const search = req.query.search as string;
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
    const locationId = req.query.locationId ? Number(req.query.locationId) : undefined;
    const status = req.query.status as string;
    res.json(await storage.getItems({ search, categoryId, locationId, status }));
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
      await storage.confirmDraft(Number(req.params.id), getUserId(req));
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
        role: ["admin", "staff", "viewer"],
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
      if (role && ["admin", "staff", "viewer"].includes(role)) update.role = role;
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

  return httpServer;
}
