import { db } from "./db";
import { eq, desc, asc, like, and, or } from "drizzle-orm";
import {
  categories, locations, suppliers, projects, items, inventoryMovements, itemImages,
  type Category, type Location, type Supplier, type Project, type Item, type InventoryMovement,
  type CreateCategoryRequest, type UpdateCategoryRequest,
  type CreateLocationRequest, type UpdateLocationRequest,
  type CreateSupplierRequest, type UpdateSupplierRequest,
  type CreateProjectRequest, type UpdateProjectRequest,
  type CreateItemRequest, type UpdateItemRequest,
  type CreateInventoryMovementRequest,
  type ItemWithRelations, type InventoryMovementWithRelations
} from "@shared/schema";

export interface IStorage {
  // Categories
  getCategories(): Promise<Category[]>;
  createCategory(category: CreateCategoryRequest): Promise<Category>;
  updateCategory(id: number, category: UpdateCategoryRequest): Promise<Category>;

  // Locations
  getLocations(): Promise<Location[]>;
  createLocation(location: CreateLocationRequest): Promise<Location>;

  // Suppliers
  getSuppliers(): Promise<Supplier[]>;
  getSupplier(id: number): Promise<Supplier | undefined>;
  createSupplier(supplier: CreateSupplierRequest): Promise<Supplier>;
  updateSupplier(id: number, supplier: UpdateSupplierRequest): Promise<Supplier>;

  // Projects
  getProjects(): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  createProject(project: CreateProjectRequest): Promise<Project>;
  updateProject(id: number, project: UpdateProjectRequest): Promise<Project>;

  // Items
  getItems(filters?: { search?: string, categoryId?: number, locationId?: number, status?: string }): Promise<ItemWithRelations[]>;
  getItem(id: number): Promise<ItemWithRelations | undefined>;
  createItem(item: CreateItemRequest): Promise<Item>;
  updateItem(id: number, item: UpdateItemRequest): Promise<Item>;
  deleteItem(id: number): Promise<void>;

  // Inventory Movements
  getInventoryMovements(filters?: { itemId?: number, referenceId?: string, movementType?: string }): Promise<InventoryMovementWithRelations[]>;
  createInventoryMovement(movement: CreateInventoryMovementRequest): Promise<InventoryMovement>;

  // Dashboard Stats
  getDashboardStats(): Promise<{
    totalSkus: number,
    totalQuantity: number,
    totalValue: string,
    lowStockCount: number,
    outOfStockCount: number,
    pendingReorderCount: number,
    recentActivity: InventoryMovementWithRelations[]
  }>;
}

export class DatabaseStorage implements IStorage {
  // Categories
  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories).orderBy(categories.sortOrder, categories.name);
  }

  async createCategory(category: CreateCategoryRequest): Promise<Category> {
    const [created] = await db.insert(categories).values(category).returning();
    return created;
  }

  async updateCategory(id: number, category: UpdateCategoryRequest): Promise<Category> {
    const [updated] = await db.update(categories).set({ ...category, updatedAt: new Date() }).where(eq(categories.id, id)).returning();
    return updated;
  }

  // Locations
  async getLocations(): Promise<Location[]> {
    return await db.select().from(locations).orderBy(locations.name);
  }

  async createLocation(location: CreateLocationRequest): Promise<Location> {
    const [created] = await db.insert(locations).values(location).returning();
    return created;
  }

  // Suppliers
  async getSuppliers(): Promise<Supplier[]> {
    return await db.select().from(suppliers).orderBy(suppliers.name);
  }

  async getSupplier(id: number): Promise<Supplier | undefined> {
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, id));
    return supplier;
  }

  async createSupplier(supplier: CreateSupplierRequest): Promise<Supplier> {
    const [created] = await db.insert(suppliers).values(supplier).returning();
    return created;
  }

  async updateSupplier(id: number, supplier: UpdateSupplierRequest): Promise<Supplier> {
    const [updated] = await db.update(suppliers).set({ ...supplier, updatedAt: new Date() }).where(eq(suppliers.id, id)).returning();
    return updated;
  }

  // Projects
  async getProjects(): Promise<Project[]> {
    return await db.select().from(projects).orderBy(projects.name);
  }

  async getProject(id: number): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  async createProject(project: CreateProjectRequest): Promise<Project> {
    const [created] = await db.insert(projects).values(project).returning();
    return created;
  }

  async updateProject(id: number, project: UpdateProjectRequest): Promise<Project> {
    const [updated] = await db.update(projects).set({ ...project, updatedAt: new Date() }).where(eq(projects.id, id)).returning();
    return updated;
  }

  // Items
  async getItems(filters?: { search?: string, categoryId?: number, locationId?: number, status?: string }): Promise<ItemWithRelations[]> {
    let query = db.select({
      item: items,
      category: categories,
      location: locations,
      supplier: suppliers
    })
    .from(items)
    .leftJoin(categories, eq(items.categoryId, categories.id))
    .leftJoin(locations, eq(items.primaryLocationId, locations.id))
    .leftJoin(suppliers, eq(items.supplierId, suppliers.id));

    let conditions = [];

    if (filters?.search) {
      conditions.push(
        or(
          like(items.name, `%${filters.search}%`),
          like(items.sku, `%${filters.search}%`),
          like(items.description, `%${filters.search}%`)
        )
      );
    }
    if (filters?.categoryId) {
      conditions.push(eq(items.categoryId, filters.categoryId));
    }
    if (filters?.locationId) {
      conditions.push(eq(items.primaryLocationId, filters.locationId));
    }
    
    // Status filter requires calculated logic usually, but here we can check the status_override or basic quantity
    if (filters?.status) {
      if (filters.status === 'low_stock') {
        conditions.push(and(eq(items.isActive, true), sql`${items.quantityOnHand} <= ${items.reorderPoint}`, sql`${items.quantityOnHand} > 0`));
      } else if (filters.status === 'out_of_stock') {
        conditions.push(eq(items.quantityOnHand, 0));
      } else if (filters.status === 'in_stock') {
        conditions.push(sql`${items.quantityOnHand} > ${items.reorderPoint}`);
      } else if (filters.status === 'ordered') {
        conditions.push(eq(items.statusOverride, 'ORDERED'));
      }
    }

    if (conditions.length > 0) {
      query.where(and(...conditions)) as any;
    }

    const results = await query.orderBy(items.name);
    
    return results.map(row => ({
      ...row.item,
      category: row.category,
      location: row.location,
      supplier: row.supplier
    }));
  }

  async getItem(id: number): Promise<ItemWithRelations | undefined> {
    const results = await db.select({
      item: items,
      category: categories,
      location: locations,
      supplier: suppliers
    })
    .from(items)
    .leftJoin(categories, eq(items.categoryId, categories.id))
    .leftJoin(locations, eq(items.primaryLocationId, locations.id))
    .leftJoin(suppliers, eq(items.supplierId, suppliers.id))
    .where(eq(items.id, id));

    if (results.length === 0) return undefined;
    
    const row = results[0];
    const images = await db.select().from(itemImages).where(eq(itemImages.itemId, id)).orderBy(itemImages.sortOrder);
    const movements = await db.select().from(inventoryMovements).where(eq(inventoryMovements.itemId, id)).orderBy(desc(inventoryMovements.createdAt)).limit(10);

    return {
      ...row.item,
      category: row.category,
      location: row.location,
      supplier: row.supplier,
      images,
      movements
    };
  }

  async createItem(item: CreateItemRequest): Promise<Item> {
    const [created] = await db.insert(items).values(item).returning();
    return created;
  }

  async updateItem(id: number, item: UpdateItemRequest): Promise<Item> {
    const [updated] = await db.update(items).set({ ...item, updatedAt: new Date() }).where(eq(items.id, id)).returning();
    return updated;
  }

  async deleteItem(id: number): Promise<void> {
    // Soft delete
    await db.update(items).set({ isActive: false, updatedAt: new Date() }).where(eq(items.id, id));
  }

  // Inventory Movements
  async getInventoryMovements(filters?: { itemId?: number, referenceId?: string, movementType?: string }): Promise<InventoryMovementWithRelations[]> {
    let query = db.select({
      movement: inventoryMovements,
      item: items,
      sourceLocation: locations,
      destinationLocation: locations
    })
    .from(inventoryMovements)
    .leftJoin(items, eq(inventoryMovements.itemId, items.id))
    .leftJoin(locations, eq(inventoryMovements.sourceLocationId, locations.id))
    // Note: This second join to locations needs an alias or handles carefully in Drizzle.
    // For now we'll just join once and fetch the other if needed, or use a raw/complex join.
    // Simpler: fetch movements and map related data.
    
    let conditions = [];
    if (filters?.itemId) conditions.push(eq(inventoryMovements.itemId, filters.itemId));
    if (filters?.referenceId) conditions.push(eq(inventoryMovements.referenceId, filters.referenceId));
    if (filters?.movementType) conditions.push(eq(inventoryMovements.movementType, filters.movementType));

    if (conditions.length > 0) {
      query.where(and(...conditions)) as any;
    }

    const results = await query.orderBy(desc(inventoryMovements.createdAt));
    
    return results.map(row => ({
      ...row.movement,
      item: row.item,
      sourceLocation: row.sourceLocation
    }));
  }

  async createInventoryMovement(movement: CreateInventoryMovementRequest): Promise<InventoryMovement> {
    const [created] = await db.insert(inventoryMovements).values(movement).returning();
    
    // Update item quantity
    await db.update(items)
      .set({ 
        quantityOnHand: movement.newQuantity,
        updatedAt: new Date()
      })
      .where(eq(items.id, movement.itemId));

    return created;
  }

  // Dashboard Stats
  async getDashboardStats() {
    const allItems = await db.select().from(items).where(eq(items.isActive, true));
    
    const totalSkus = allItems.length;
    let totalQuantity = 0;
    let totalValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let pendingReorderCount = 0;

    for (const item of allItems) {
      totalQuantity += item.quantityOnHand;
      const cost = item.unitCost ? parseFloat(item.unitCost) : 0;
      totalValue += cost * item.quantityOnHand;
      
      if (item.quantityOnHand === 0) {
        outOfStockCount++;
      } else if (item.quantityOnHand <= item.reorderPoint) {
        lowStockCount++;
      }

      if (item.statusOverride === 'ORDERED') {
        pendingReorderCount++;
      }
    }

    const recentActivity = await this.getInventoryMovements();

    return {
      totalSkus,
      totalQuantity,
      totalValue: totalValue.toFixed(2),
      lowStockCount,
      outOfStockCount,
      pendingReorderCount,
      recentActivity: recentActivity.slice(0, 10)
    };
  }
}

export const storage = new DatabaseStorage();
