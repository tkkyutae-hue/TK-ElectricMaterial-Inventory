import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { registerAuthRoutes } from "./replit_integrations/auth";
import { isAuthenticated } from "./replit_integrations/auth/replitAuth";
import multer from "multer";
import path from "path";
import fs from "fs";
import express from "express";

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
  return req.user?.claims?.sub ?? null;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  registerAuthRoutes(app);

  app.use("/uploads", express.static(uploadsDir));

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

  // ─── Locations ──────────────────────────────────────────────────────────────
  app.get("/api/locations", isAuthenticated, async (_req, res) => {
    res.json(await storage.getLocations());
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

  app.post("/api/items", isAuthenticated, async (req, res) => {
    try {
      const { imageUrl, ...rest } = req.body;
      const body = {
        ...rest,
        categoryId: rest.categoryId ? Number(rest.categoryId) : undefined,
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
      const { movementType, quantity, sourceLocationId, destinationLocationId, projectId, note, reason, itemId } = req.body;
      if (!movementType || !quantity) return res.status(400).json({ message: "movementType and quantity are required" });
      const updated = await storage.updateInventoryMovement(id, {
        movementType, quantity: Number(quantity),
        sourceLocationId: sourceLocationId ? Number(sourceLocationId) : null,
        destinationLocationId: destinationLocationId ? Number(destinationLocationId) : null,
        projectId: projectId ? Number(projectId) : null,
        note: note ?? null,
        reason: reason ?? null,
        itemId: itemId ? Number(itemId) : undefined,
      });
      res.json(updated);
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

  return httpServer;
}
