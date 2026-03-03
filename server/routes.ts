import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { registerAuthRoutes } from "./replit_integrations/auth";
import { isAuthenticated } from "./replit_integrations/auth/replitAuth";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  registerAuthRoutes(app);

  app.get(api.dashboard.stats.path, isAuthenticated, async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  app.get(api.categories.list.path, isAuthenticated, async (req, res) => {
    const data = await storage.getCategories();
    res.json(data);
  });

  app.get(api.locations.list.path, isAuthenticated, async (req, res) => {
    const data = await storage.getLocations();
    res.json(data);
  });

  app.get(api.suppliers.list.path, isAuthenticated, async (req, res) => {
    const data = await storage.getSuppliers();
    res.json(data);
  });

  app.get(api.items.list.path, isAuthenticated, async (req, res) => {
    const search = req.query.search as string;
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
    const locationId = req.query.locationId ? Number(req.query.locationId) : undefined;
    const status = req.query.status as string;

    const data = await storage.getItems({ search, categoryId, locationId, status });
    res.json(data);
  });

  app.get(api.items.get.path, isAuthenticated, async (req, res) => {
    const data = await storage.getItem(Number(req.params.id));
    if (!data) return res.status(404).json({ message: "Not found" });
    res.json(data);
  });

  app.post(api.items.create.path, isAuthenticated, async (req, res) => {
    try {
      const bodySchema = api.items.create.input.extend({
        categoryId: z.coerce.number().optional(),
        primaryLocationId: z.coerce.number().optional(),
        supplierId: z.coerce.number().optional(),
        quantityOnHand: z.coerce.number().default(0),
        minimumStock: z.coerce.number().default(0),
        reorderPoint: z.coerce.number().default(0),
        reorderQuantity: z.coerce.number().default(0),
      });

      const input = bodySchema.parse(req.body);
      const data = await storage.createItem(input);
      res.status(201).json(data);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.put(api.items.update.path, isAuthenticated, async (req, res) => {
    try {
      const bodySchema = api.items.update.input.extend({
        categoryId: z.coerce.number().optional(),
        primaryLocationId: z.coerce.number().optional(),
        supplierId: z.coerce.number().optional(),
        quantityOnHand: z.coerce.number().optional(),
        minimumStock: z.coerce.number().optional(),
        reorderPoint: z.coerce.number().optional(),
        reorderQuantity: z.coerce.number().optional(),
      });
      const input = bodySchema.parse(req.body);
      const data = await storage.updateItem(Number(req.params.id), input);
      res.json(data);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.delete(api.items.delete.path, isAuthenticated, async (req, res) => {
    await storage.deleteItem(Number(req.params.id));
    res.status(204).end();
  });

  app.get(`${api.items.list.path}/movements`, isAuthenticated, async (req, res) => {
    const itemId = req.query.itemId ? Number(req.query.itemId) : undefined;
    const movementType = req.query.movementType as string;

    const data = await storage.getInventoryMovements({ itemId, movementType });
    res.json(data);
  });

  app.post(`${api.items.list.path}/movements`, isAuthenticated, async (req, res) => {
    try {
      const item = await storage.getItem(Number(req.body.itemId));
      if (!item) return res.status(404).json({ message: "Item not found" });

      const qty = Number(req.body.quantity);
      let newQty = item.quantityOnHand;
      if (req.body.movementType === 'receive' || req.body.movementType === 'return') newQty += qty;
      else if (req.body.movementType === 'issue') newQty -= qty;
      else if (req.body.movementType === 'adjust') newQty = qty;

      const movement = await storage.createInventoryMovement({
        itemId: item.id,
        movementType: req.body.movementType,
        quantity: qty,
        previousQuantity: item.quantityOnHand,
        newQuantity: newQty,
        sourceLocationId: req.body.sourceLocationId ? Number(req.body.sourceLocationId) : null,
        destinationLocationId: req.body.destinationLocationId ? Number(req.body.destinationLocationId) : null,
        note: req.body.note,
        createdBy: (req as any).user?.claims?.sub,
        referenceType: req.body.referenceType,
        referenceId: req.body.referenceId
      });
      res.status(201).json(movement);
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  return httpServer;
}
