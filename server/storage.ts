import { db } from "./db";
import { eq, desc, asc, like, and, or } from "drizzle-orm";
import {
  categories, locations, suppliers, projects, items, transactions,
  type Category, type Location, type Supplier, type Project, type Item, type Transaction,
  type CreateCategoryRequest, type UpdateCategoryRequest,
  type CreateLocationRequest, type UpdateLocationRequest,
  type CreateSupplierRequest, type UpdateSupplierRequest,
  type CreateProjectRequest, type UpdateProjectRequest,
  type CreateItemRequest, type UpdateItemRequest,
  type CreateTransactionRequest,
  type ItemWithRelations, type TransactionWithRelations
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

  // Transactions
  getTransactions(filters?: { itemId?: number, projectId?: number, actionType?: string }): Promise<TransactionWithRelations[]>;
  createTransaction(transaction: CreateTransactionRequest): Promise<Transaction>;

  // Dashboard Stats
  getDashboardStats(): Promise<{
    totalSkus: number,
    totalValue: string,
    lowStockCount: number,
    outOfStockCount: number,
    recentTransactions: TransactionWithRelations[]
  }>;
}

export class DatabaseStorage implements IStorage {
  // Categories
  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories).orderBy(categories.name);
  }

  async createCategory(category: CreateCategoryRequest): Promise<Category> {
    const [created] = await db.insert(categories).values(category).returning();
    return created;
  }

  async updateCategory(id: number, category: UpdateCategoryRequest): Promise<Category> {
    const [updated] = await db.update(categories).set(category).where(eq(categories.id, id)).returning();
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
    const [updated] = await db.update(suppliers).set(supplier).where(eq(suppliers.id, id)).returning();
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
    const [updated] = await db.update(projects).set(project).where(eq(projects.id, id)).returning();
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
    .leftJoin(locations, eq(items.locationId, locations.id))
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
      conditions.push(eq(items.locationId, filters.locationId));
    }
    if (filters?.status) {
      conditions.push(eq(items.status, filters.status));
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
    .leftJoin(locations, eq(items.locationId, locations.id))
    .leftJoin(suppliers, eq(items.supplierId, suppliers.id))
    .where(eq(items.id, id));

    if (results.length === 0) return undefined;
    
    const row = results[0];
    return {
      ...row.item,
      category: row.category,
      location: row.location,
      supplier: row.supplier
    };
  }

  async createItem(item: CreateItemRequest): Promise<Item> {
    const [created] = await db.insert(items).values(item).returning();
    return created;
  }

  async updateItem(id: number, item: UpdateItemRequest): Promise<Item> {
    const [updated] = await db.update(items).set({ ...item, lastUpdated: new Date() }).where(eq(items.id, id)).returning();
    return updated;
  }

  async deleteItem(id: number): Promise<void> {
    await db.delete(items).where(eq(items.id, id));
  }

  // Transactions
  async getTransactions(filters?: { itemId?: number, projectId?: number, actionType?: string }): Promise<TransactionWithRelations[]> {
    let query = db.select({
      transaction: transactions,
      item: items,
      project: projects
    })
    .from(transactions)
    .leftJoin(items, eq(transactions.itemId, items.id))
    .leftJoin(projects, eq(transactions.projectId, projects.id));

    let conditions = [];

    if (filters?.itemId) {
      conditions.push(eq(transactions.itemId, filters.itemId));
    }
    if (filters?.projectId) {
      conditions.push(eq(transactions.projectId, filters.projectId));
    }
    if (filters?.actionType) {
      conditions.push(eq(transactions.actionType, filters.actionType));
    }

    if (conditions.length > 0) {
      query.where(and(...conditions)) as any;
    }

    const results = await query.orderBy(desc(transactions.createdAt));
    
    return results.map(row => ({
      ...row.transaction,
      item: row.item,
      project: row.project
    }));
  }

  async createTransaction(transaction: CreateTransactionRequest): Promise<Transaction> {
    // We should also update the item quantity based on transaction type
    const item = await db.select().from(items).where(eq(items.id, transaction.itemId)).then(res => res[0]);
    
    if (item) {
      let newQuantity = item.quantityOnHand;
      
      switch (transaction.actionType) {
        case 'receive':
        case 'return':
          newQuantity += transaction.quantity;
          break;
        case 'issue':
          newQuantity -= transaction.quantity;
          break;
        case 'adjust':
          newQuantity = transaction.quantity; // Adjust sets the exact quantity
          break;
      }

      // Determine new status
      let newStatus = 'in_stock';
      if (newQuantity === 0) {
        newStatus = 'out_of_stock';
      } else if (newQuantity <= item.reorderPoint) {
        newStatus = 'low_stock';
      }

      // Update item quantity
      await db.update(items)
        .set({ 
          quantityOnHand: newQuantity, 
          status: newStatus,
          lastUpdated: new Date() 
        })
        .where(eq(items.id, item.id));
    }

    const [created] = await db.insert(transactions).values(transaction).returning();
    return created;
  }

  // Dashboard Stats
  async getDashboardStats() {
    const allItems = await db.select().from(items);
    
    const totalSkus = allItems.length;
    let totalValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const item of allItems) {
      const cost = item.cost ? parseFloat(item.cost) : 0;
      totalValue += cost * item.quantityOnHand;
      
      if (item.quantityOnHand === 0) {
        outOfStockCount++;
      } else if (item.quantityOnHand <= item.reorderPoint) {
        lowStockCount++;
      }
    }

    const recentTxs = await this.getTransactions();

    return {
      totalSkus,
      totalValue: totalValue.toFixed(2),
      lowStockCount,
      outOfStockCount,
      recentTransactions: recentTxs.slice(0, 5) // Last 5 transactions
    };
  }
}

export const storage = new DatabaseStorage();
