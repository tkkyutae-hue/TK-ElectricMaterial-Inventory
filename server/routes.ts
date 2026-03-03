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

  app.post(api.categories.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.categories.create.input.parse(req.body);
      const data = await storage.createCategory(input);
      res.status(201).json(data);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get(api.locations.list.path, isAuthenticated, async (req, res) => {
    const data = await storage.getLocations();
    res.json(data);
  });

  app.post(api.locations.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.locations.create.input.parse(req.body);
      const data = await storage.createLocation(input);
      res.status(201).json(data);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get(api.suppliers.list.path, isAuthenticated, async (req, res) => {
    const data = await storage.getSuppliers();
    res.json(data);
  });

  app.get(api.suppliers.get.path, isAuthenticated, async (req, res) => {
    const data = await storage.getSupplier(Number(req.params.id));
    if (!data) return res.status(404).json({ message: "Not found" });
    res.json(data);
  });

  app.post(api.suppliers.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.suppliers.create.input.parse(req.body);
      const data = await storage.createSupplier(input);
      res.status(201).json(data);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get(api.projects.list.path, isAuthenticated, async (req, res) => {
    const data = await storage.getProjects();
    res.json(data);
  });

  app.post(api.projects.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.projects.create.input.parse(req.body);
      const data = await storage.createProject(input);
      res.status(201).json(data);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal error" });
    }
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
      // Coerce numeric fields from strings if they arrive as such from FormData or simple JSON
      const bodySchema = api.items.create.input.extend({
        categoryId: z.coerce.number().optional(),
        locationId: z.coerce.number().optional(),
        supplierId: z.coerce.number().optional(),
        quantityOnHand: z.coerce.number().default(0),
        minStock: z.coerce.number().default(0),
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
        locationId: z.coerce.number().optional(),
        supplierId: z.coerce.number().optional(),
        quantityOnHand: z.coerce.number().optional(),
        minStock: z.coerce.number().optional(),
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

  app.get(api.transactions.list.path, isAuthenticated, async (req, res) => {
    const itemId = req.query.itemId ? Number(req.query.itemId) : undefined;
    const projectId = req.query.projectId ? Number(req.query.projectId) : undefined;
    const actionType = req.query.actionType as string;

    const data = await storage.getTransactions({ itemId, projectId, actionType });
    res.json(data);
  });

  app.post(api.transactions.create.path, isAuthenticated, async (req, res) => {
    try {
      const bodySchema = api.transactions.create.input.extend({
        itemId: z.coerce.number(),
        quantity: z.coerce.number(),
        sourceLocationId: z.coerce.number().optional(),
        destinationLocationId: z.coerce.number().optional(),
        projectId: z.coerce.number().optional(),
      });
      
      const input = bodySchema.parse(req.body);
      // Ensure we record the user making the transaction
      const user = (req as any).user;
      if (user && user.claims) {
        input.userId = user.claims.sub;
      }
      
      const data = await storage.createTransaction(input);
      res.status(201).json(data);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Internal error" });
    }
  });

  return httpServer;
}
