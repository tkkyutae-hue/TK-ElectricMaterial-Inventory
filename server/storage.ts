import { db } from "./db";
import { eq, desc, asc, like, and, or, sql, lt, lte, gte, inArray } from "drizzle-orm";
import {
  categories, locations, suppliers, projects, items, inventoryMovements, itemImages,
  inventoryLocationBalances, projectMaterialTransactions, supplierItems, purchaseRecommendations,
  type Category, type Location, type Supplier, type Project, type Item, type InventoryMovement,
  type InventoryLocationBalance, type PurchaseRecommendation, type SupplierItem,
  type CreateCategoryRequest, type UpdateCategoryRequest,
  type CreateLocationRequest, type CreateSupplierRequest, type UpdateSupplierRequest,
  type CreateProjectRequest, type UpdateProjectRequest,
  type CreateItemRequest, type UpdateItemRequest,
  type CreateInventoryMovementRequest,
  type CreatePurchaseRecommendationRequest,
  type ItemWithRelations, type InventoryMovementWithRelations,
  type ProjectWithStats, type SupplierWithStats, type PurchaseRecommendationWithRelations
} from "@shared/schema";

export interface IStorage {
  getCategories(): Promise<Category[]>;
  createCategory(category: CreateCategoryRequest): Promise<Category>;

  getLocations(): Promise<Location[]>;
  createLocation(location: CreateLocationRequest): Promise<Location>;

  getSuppliers(): Promise<Supplier[]>;
  getSupplier(id: number): Promise<SupplierWithStats | undefined>;
  createSupplier(supplier: CreateSupplierRequest): Promise<Supplier>;
  updateSupplier(id: number, supplier: UpdateSupplierRequest): Promise<Supplier>;

  getProjects(): Promise<Project[]>;
  getProject(id: number): Promise<ProjectWithStats | undefined>;
  createProject(project: CreateProjectRequest): Promise<Project>;
  updateProject(id: number, project: UpdateProjectRequest): Promise<Project>;

  getItems(filters?: { search?: string; categoryId?: number; locationId?: number; status?: string }): Promise<ItemWithRelations[]>;
  getItem(id: number): Promise<ItemWithRelations | undefined>;
  createItem(item: CreateItemRequest): Promise<Item>;
  updateItem(id: number, item: UpdateItemRequest): Promise<Item>;
  deleteItem(id: number): Promise<void>;

  getInventoryMovements(filters?: { itemId?: number; projectId?: number; movementType?: string; locationId?: number }): Promise<InventoryMovementWithRelations[]>;
  createInventoryMovement(movement: CreateInventoryMovementRequest & { previousQuantity: number; newQuantity: number; createdBy?: string | null }): Promise<InventoryMovement>;
  getLocationBalances(locationId?: number): Promise<(InventoryLocationBalance & { item?: Item; location?: Location })[]>;

  getPurchaseRecommendations(): Promise<PurchaseRecommendationWithRelations[]>;
  generatePurchaseRecommendations(): Promise<PurchaseRecommendation[]>;
  updateRecommendationStatus(id: number, status: string): Promise<PurchaseRecommendation>;

  getCategorySummary(): Promise<any[]>;
  getCategoryGrouped(categoryId: number): Promise<any>;

  updateInventoryMovement(id: number, changes: { movementType: string; quantity: number; sourceLocationId?: number | null; destinationLocationId?: number | null; projectId?: number | null; note?: string | null; reason?: string | null; itemId?: number }): Promise<InventoryMovement>;
  deleteMovement(id: number): Promise<void>;
  getDashboardStats(): Promise<any>;
  getDashboardMonthlyTrend(): Promise<Array<{ label: string; value: number }>>;
  getReportLowStock(): Promise<any>;
  getReportByLocation(): Promise<any>;
  getReportValuation(): Promise<any>;
  getReportUsageByProject(): Promise<any>;
}

export class DatabaseStorage implements IStorage {

  // ─── Categories ──────────────────────────────────────────────────────────────

  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name));
  }

  async createCategory(category: CreateCategoryRequest): Promise<Category> {
    const [created] = await db.insert(categories).values(category).returning();
    return created;
  }

  // ─── Locations ───────────────────────────────────────────────────────────────

  async getLocations(): Promise<Location[]> {
    return await db.select().from(locations).where(eq(locations.isActive, true)).orderBy(asc(locations.name));
  }

  async createLocation(location: CreateLocationRequest): Promise<Location> {
    const [created] = await db.insert(locations).values(location).returning();
    return created;
  }

  // ─── Suppliers ───────────────────────────────────────────────────────────────

  async getSuppliers(): Promise<Supplier[]> {
    return await db.select().from(suppliers).orderBy(asc(suppliers.name));
  }

  async getSupplier(id: number): Promise<SupplierWithStats | undefined> {
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, id));
    if (!supplier) return undefined;

    const supplierItemRows = await db.select({ item: items })
      .from(supplierItems)
      .leftJoin(items, eq(supplierItems.itemId, items.id))
      .where(eq(supplierItems.supplierId, id));

    const linkedItems = supplierItemRows.map(r => r.item).filter(Boolean) as Item[];
    const lowStockCount = linkedItems.filter(i => i && i.quantityOnHand <= i.reorderPoint).length;

    // Also get items where this supplier is the primary
    const primaryItems = await db.select().from(items)
      .where(and(eq(items.supplierId, id), eq(items.isActive, true)));

    const allItems = [...primaryItems];

    return {
      ...supplier,
      itemCount: allItems.length,
      lowStockCount,
      items: allItems
    };
  }

  async createSupplier(supplier: CreateSupplierRequest): Promise<Supplier> {
    const [created] = await db.insert(suppliers).values(supplier).returning();
    return created;
  }

  async updateSupplier(id: number, supplier: UpdateSupplierRequest): Promise<Supplier> {
    const [updated] = await db.update(suppliers).set({ ...supplier, updatedAt: new Date() }).where(eq(suppliers.id, id)).returning();
    return updated;
  }

  // ─── Projects ─────────────────────────────────────────────────────────────────

  async getProjects(): Promise<Project[]> {
    return await db.select().from(projects).orderBy(asc(projects.name));
  }

  async getProject(id: number): Promise<ProjectWithStats | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    if (!project) return undefined;

    const movements = await db.select({
      movement: inventoryMovements,
      item: items,
      sourceLocation: locations,
    })
    .from(inventoryMovements)
    .leftJoin(items, eq(inventoryMovements.itemId, items.id))
    .leftJoin(locations, eq(inventoryMovements.sourceLocationId, locations.id))
    .where(eq(inventoryMovements.projectId, id))
    .orderBy(desc(inventoryMovements.createdAt))
    .limit(50);

    const recentActivity = movements.map(r => ({
      ...r.movement,
      item: r.item,
      sourceLocation: r.sourceLocation,
    }));

    const totalIssued = movements
      .filter(r => r.movement.movementType === 'issue')
      .reduce((sum, r) => sum + r.movement.quantity, 0);

    const totalReturned = movements
      .filter(r => r.movement.movementType === 'return')
      .reduce((sum, r) => sum + r.movement.quantity, 0);

    return { ...project, totalIssued, totalReturned, recentActivity };
  }

  async createProject(project: CreateProjectRequest): Promise<Project> {
    const [created] = await db.insert(projects).values(project).returning();
    return created;
  }

  async updateProject(id: number, project: UpdateProjectRequest): Promise<Project> {
    const [updated] = await db.update(projects).set({ ...project, updatedAt: new Date() }).where(eq(projects.id, id)).returning();
    return updated;
  }

  // ─── Items ────────────────────────────────────────────────────────────────────

  async getItems(filters?: { search?: string; categoryId?: number; locationId?: number; status?: string }): Promise<ItemWithRelations[]> {
    const results = await db.select({
      item: items,
      category: categories,
      location: locations,
      supplier: suppliers,
    })
    .from(items)
    .leftJoin(categories, eq(items.categoryId, categories.id))
    .leftJoin(locations, eq(items.primaryLocationId, locations.id))
    .leftJoin(suppliers, eq(items.supplierId, suppliers.id))
    .where(eq(items.isActive, true))
    .orderBy(asc(items.name));

    const itemIds = results.map(r => r.item.id);
    const allImages = itemIds.length > 0 
      ? await db.select().from(itemImages).where(inArray(itemImages.itemId, itemIds)).orderBy(asc(itemImages.sortOrder))
      : [];

    let mapped = results.map(row => {
      const firstImage = allImages.find(img => img.itemId === row.item.id);
      return {
        ...row.item,
        category: row.category,
        location: row.location,
        supplier: row.supplier,
        imageUrl: firstImage?.imageUrl || null,
      };
    });

    if (filters?.search) {
      const s = filters.search.toLowerCase();
      mapped = mapped.filter(i =>
        i.name.toLowerCase().includes(s) ||
        i.sku.toLowerCase().includes(s) ||
        (i.description || '').toLowerCase().includes(s)
      );
    }
    if (filters?.categoryId) {
      mapped = mapped.filter(i => i.categoryId === filters.categoryId);
    }
    if (filters?.locationId) {
      mapped = mapped.filter(i => i.primaryLocationId === filters.locationId);
    }
    if (filters?.status) {
      if (filters.status === 'low_stock') {
        mapped = mapped.filter(i => i.quantityOnHand > 0 && i.quantityOnHand <= i.reorderPoint);
      } else if (filters.status === 'out_of_stock') {
        mapped = mapped.filter(i => i.quantityOnHand === 0);
      } else if (filters.status === 'in_stock') {
        mapped = mapped.filter(i => i.quantityOnHand > i.reorderPoint);
      } else if (filters.status === 'ordered') {
        mapped = mapped.filter(i => i.statusOverride === 'ORDERED');
      }
    }

    return mapped.map(i => {
      let status = "in_stock";
      if (i.statusOverride === "ORDERED") status = "ordered";
      else if (i.quantityOnHand === 0) status = "out_of_stock";
      else if (i.quantityOnHand <= i.reorderPoint) status = "low_stock";
      return { ...i, status };
    });
  }

  async getItem(id: number): Promise<ItemWithRelations | undefined> {
    const results = await db.select({
      item: items,
      category: categories,
      location: locations,
      supplier: suppliers,
    })
    .from(items)
    .leftJoin(categories, eq(items.categoryId, categories.id))
    .leftJoin(locations, eq(items.primaryLocationId, locations.id))
    .leftJoin(suppliers, eq(items.supplierId, suppliers.id))
    .where(eq(items.id, id));

    if (!results.length) return undefined;

    const row = results[0];
    const images = await db.select().from(itemImages).where(eq(itemImages.itemId, id)).orderBy(asc(itemImages.sortOrder));
    const movementRows = await db.select({
      movement: inventoryMovements,
      item: items,
      sourceLocation: locations,
    })
    .from(inventoryMovements)
    .leftJoin(items, eq(inventoryMovements.itemId, items.id))
    .leftJoin(locations, eq(inventoryMovements.sourceLocationId, locations.id))
    .where(eq(inventoryMovements.itemId, id))
    .orderBy(desc(inventoryMovements.createdAt))
    .limit(20);

    return {
      ...row.item,
      category: row.category,
      location: row.location,
      supplier: row.supplier,
      images,
      movements: movementRows.map(r => ({ ...r.movement, sourceLocation: r.sourceLocation })) as any,
    };
  }

  async createItem(item: CreateItemRequest): Promise<Item> {
    const [created] = await db.insert(items).values(item).returning();

    // Create initial location balance if primaryLocationId is set
    if (created.primaryLocationId && created.quantityOnHand > 0) {
      await this._upsertLocationBalance(created.id, created.primaryLocationId, created.quantityOnHand);
    }

    return created;
  }

  async updateItem(id: number, item: UpdateItemRequest): Promise<Item> {
    const [updated] = await db.update(items).set({ ...item, updatedAt: new Date() }).where(eq(items.id, id)).returning();
    return updated;
  }

  async deleteItem(id: number): Promise<void> {
    await db.update(items).set({ isActive: false, updatedAt: new Date() }).where(eq(items.id, id));
  }

  // ─── Inventory Movements ─────────────────────────────────────────────────────

  async getInventoryMovements(filters?: {
    itemId?: number; projectId?: number; movementType?: string; locationId?: number
  }): Promise<InventoryMovementWithRelations[]> {
    const allMovements = await db.select({
      movement: inventoryMovements,
      item: items,
      project: projects,
    })
    .from(inventoryMovements)
    .leftJoin(items, eq(inventoryMovements.itemId, items.id))
    .leftJoin(projects, eq(inventoryMovements.projectId, projects.id))
    .orderBy(desc(inventoryMovements.createdAt));

    let result = allMovements.map(r => ({
      ...r.movement,
      item: r.item,
      project: r.project,
      sourceLocation: null as any,
      destinationLocation: null as any,
    }));

    if (filters?.itemId) result = result.filter(r => r.itemId === filters.itemId);
    if (filters?.projectId) result = result.filter(r => r.projectId === filters.projectId);
    if (filters?.movementType) result = result.filter(r => r.movementType === filters.movementType);

    return result;
  }

  async createInventoryMovement(
    movement: CreateInventoryMovementRequest & { previousQuantity: number; newQuantity: number; createdBy?: string | null }
  ): Promise<InventoryMovement> {
    const [created] = await db.insert(inventoryMovements).values({
      itemId: movement.itemId,
      movementType: movement.movementType,
      quantity: movement.quantity,
      previousQuantity: movement.previousQuantity,
      newQuantity: movement.newQuantity,
      sourceLocationId: movement.sourceLocationId ?? null,
      destinationLocationId: movement.destinationLocationId ?? null,
      projectId: movement.projectId ?? null,
      unitCostSnapshot: movement.unitCostSnapshot ?? null,
      note: movement.note ?? null,
      reason: movement.reason ?? null,
      referenceType: movement.referenceType ?? null,
      referenceId: movement.referenceId ?? null,
      createdBy: movement.createdBy ?? null,
    }).returning();

    // Update item's total quantity_on_hand
    await db.update(items)
      .set({ quantityOnHand: movement.newQuantity, updatedAt: new Date() })
      .where(eq(items.id, movement.itemId));

    // Update location balances
    if (movement.movementType === 'receive' && movement.destinationLocationId) {
      await this._adjustLocationBalance(movement.itemId, movement.destinationLocationId, movement.quantity);
    } else if (movement.movementType === 'issue' && movement.sourceLocationId) {
      await this._adjustLocationBalance(movement.itemId, movement.sourceLocationId, -movement.quantity);
    } else if (movement.movementType === 'return' && movement.destinationLocationId) {
      await this._adjustLocationBalance(movement.itemId, movement.destinationLocationId, movement.quantity);
    } else if (movement.movementType === 'adjust') {
      const locId = movement.destinationLocationId ?? movement.sourceLocationId;
      if (locId) {
        const delta = movement.newQuantity - movement.previousQuantity;
        await this._adjustLocationBalance(movement.itemId, locId, delta);
      }
    } else if (movement.movementType === 'transfer') {
      if (movement.sourceLocationId) {
        await this._adjustLocationBalance(movement.itemId, movement.sourceLocationId, -movement.quantity);
      }
      if (movement.destinationLocationId) {
        await this._adjustLocationBalance(movement.itemId, movement.destinationLocationId, movement.quantity);
      }
    }

    // Log project material transaction if project is linked
    if (movement.projectId && (movement.movementType === 'issue' || movement.movementType === 'return')) {
      await db.insert(projectMaterialTransactions).values({
        projectId: movement.projectId,
        itemId: movement.itemId,
        movementId: created.id,
        transactionType: movement.movementType,
        quantity: movement.quantity,
        note: movement.note ?? null,
      });
    }

    return created;
  }

  async updateInventoryMovement(id: number, changes: { movementType: string; quantity: number; sourceLocationId?: number | null; destinationLocationId?: number | null; projectId?: number | null; note?: string | null; reason?: string | null; itemId?: number }): Promise<InventoryMovement> {
    const [orig] = await db.select().from(inventoryMovements).where(eq(inventoryMovements.id, id));
    if (!orig) throw new Error("Movement not found");

    const effectiveItemId = changes.itemId ?? orig.itemId;

    // Get current item quantity
    const [itemRow] = await db.select().from(items).where(eq(items.id, effectiveItemId));
    if (!itemRow) throw new Error("Item not found");

    // Calculate old delta (what was applied to stock)
    let oldDelta = 0;
    if (orig.movementType === "receive" || orig.movementType === "return") oldDelta = orig.quantity;
    else if (orig.movementType === "issue") oldDelta = -orig.quantity;

    // Calculate new delta (what we want to apply)
    let newDelta = 0;
    if (changes.movementType === "receive" || changes.movementType === "return") newDelta = changes.quantity;
    else if (changes.movementType === "issue") newDelta = -changes.quantity;

    const netChange = newDelta - oldDelta;
    const updatedQty = itemRow.quantityOnHand + netChange;
    if (updatedQty < 0) throw new Error(`Insufficient stock. Cannot edit: would result in ${updatedQty} units.`);

    // Reverse old location balance impacts
    if (orig.movementType === "receive" || orig.movementType === "return") {
      if (orig.destinationLocationId) await this._adjustLocationBalance(orig.itemId, orig.destinationLocationId, -orig.quantity);
    } else if (orig.movementType === "issue") {
      if (orig.sourceLocationId) await this._adjustLocationBalance(orig.itemId, orig.sourceLocationId, orig.quantity);
    } else if (orig.movementType === "transfer") {
      if (orig.sourceLocationId) await this._adjustLocationBalance(orig.itemId, orig.sourceLocationId, orig.quantity);
      if (orig.destinationLocationId) await this._adjustLocationBalance(orig.itemId, orig.destinationLocationId, -orig.quantity);
    }

    // Apply new location balance impacts
    const newSrc = changes.sourceLocationId !== undefined ? changes.sourceLocationId : orig.sourceLocationId;
    const newDst = changes.destinationLocationId !== undefined ? changes.destinationLocationId : orig.destinationLocationId;
    if (changes.movementType === "receive" || changes.movementType === "return") {
      if (newDst) await this._adjustLocationBalance(effectiveItemId, newDst, changes.quantity);
    } else if (changes.movementType === "issue") {
      if (newSrc) await this._adjustLocationBalance(effectiveItemId, newSrc, -changes.quantity);
    } else if (changes.movementType === "transfer") {
      if (newSrc) await this._adjustLocationBalance(effectiveItemId, newSrc, -changes.quantity);
      if (newDst) await this._adjustLocationBalance(effectiveItemId, newDst, changes.quantity);
    }

    // Update item quantity
    await db.update(items).set({ quantityOnHand: updatedQty, updatedAt: new Date() }).where(eq(items.id, effectiveItemId));

    // Update movement record
    const [updated] = await db.update(inventoryMovements).set({
      movementType: changes.movementType,
      itemId: effectiveItemId,
      quantity: changes.quantity,
      newQuantity: updatedQty,
      previousQuantity: itemRow.quantityOnHand,
      sourceLocationId: newSrc ?? null,
      destinationLocationId: newDst ?? null,
      projectId: changes.projectId !== undefined ? changes.projectId : orig.projectId,
      note: changes.note !== undefined ? changes.note : orig.note,
      reason: changes.reason !== undefined ? changes.reason : orig.reason,
    }).where(eq(inventoryMovements.id, id)).returning();

    return updated;
  }

  async deleteMovement(id: number): Promise<void> {
    const [orig] = await db.select().from(inventoryMovements).where(eq(inventoryMovements.id, id));
    if (!orig) throw new Error("Movement not found");

    // Reverse the stock impact on the item
    const [itemRow] = await db.select().from(items).where(eq(items.id, orig.itemId));
    if (!itemRow) throw new Error("Item not found");

    let delta = 0;
    if (orig.movementType === "receive" || orig.movementType === "return") delta = -orig.quantity;
    else if (orig.movementType === "issue") delta = orig.quantity;

    const newQty = itemRow.quantityOnHand + delta;
    if (newQty < 0) throw new Error(`Cannot delete: would result in negative stock (${newQty}).`);

    // Reverse location balance impacts
    if (orig.movementType === "receive" || orig.movementType === "return") {
      if (orig.destinationLocationId) await this._adjustLocationBalance(orig.itemId, orig.destinationLocationId, -orig.quantity);
    } else if (orig.movementType === "issue") {
      if (orig.sourceLocationId) await this._adjustLocationBalance(orig.itemId, orig.sourceLocationId, orig.quantity);
    } else if (orig.movementType === "transfer") {
      if (orig.sourceLocationId) await this._adjustLocationBalance(orig.itemId, orig.sourceLocationId, orig.quantity);
      if (orig.destinationLocationId) await this._adjustLocationBalance(orig.itemId, orig.destinationLocationId, -orig.quantity);
    }

    // Update item quantity
    await db.update(items).set({ quantityOnHand: newQty, updatedAt: new Date() }).where(eq(items.id, orig.itemId));

    // Delete the movement record
    await db.delete(inventoryMovements).where(eq(inventoryMovements.id, id));
  }

  private async _upsertLocationBalance(itemId: number, locationId: number, qty: number) {
    const [existing] = await db.select().from(inventoryLocationBalances)
      .where(and(eq(inventoryLocationBalances.itemId, itemId), eq(inventoryLocationBalances.locationId, locationId)));

    if (existing) {
      await db.update(inventoryLocationBalances)
        .set({ quantityOnHand: qty, updatedAt: new Date() })
        .where(eq(inventoryLocationBalances.id, existing.id));
    } else {
      await db.insert(inventoryLocationBalances).values({ itemId, locationId, quantityOnHand: qty });
    }
  }

  private async _adjustLocationBalance(itemId: number, locationId: number, delta: number) {
    const [existing] = await db.select().from(inventoryLocationBalances)
      .where(and(eq(inventoryLocationBalances.itemId, itemId), eq(inventoryLocationBalances.locationId, locationId)));

    if (existing) {
      const newQty = Math.max(0, existing.quantityOnHand + delta);
      await db.update(inventoryLocationBalances)
        .set({ quantityOnHand: newQty, updatedAt: new Date() })
        .where(eq(inventoryLocationBalances.id, existing.id));
    } else if (delta > 0) {
      await db.insert(inventoryLocationBalances).values({ itemId, locationId, quantityOnHand: delta });
    }
  }

  // ─── Location Balances ────────────────────────────────────────────────────────

  async getLocationBalances(locationId?: number): Promise<(InventoryLocationBalance & { item?: Item; location?: Location })[]> {
    const rows = await db.select({
      balance: inventoryLocationBalances,
      item: items,
      location: locations,
    })
    .from(inventoryLocationBalances)
    .leftJoin(items, eq(inventoryLocationBalances.itemId, items.id))
    .leftJoin(locations, eq(inventoryLocationBalances.locationId, locations.id))
    .orderBy(asc(items.name));

    let result = rows.map(r => ({ ...r.balance, item: r.item ?? undefined, location: r.location ?? undefined }));
    if (locationId) result = result.filter(r => r.locationId === locationId);

    return result;
  }

  // ─── Purchase Recommendations ─────────────────────────────────────────────────

  async getPurchaseRecommendations(): Promise<PurchaseRecommendationWithRelations[]> {
    const rows = await db.select({
      rec: purchaseRecommendations,
      item: items,
      supplier: suppliers,
    })
    .from(purchaseRecommendations)
    .leftJoin(items, eq(purchaseRecommendations.itemId, items.id))
    .leftJoin(suppliers, eq(purchaseRecommendations.supplierId, suppliers.id))
    .where(eq(purchaseRecommendations.status, 'pending'))
    .orderBy(
      sql`CASE ${purchaseRecommendations.priorityLevel} WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END`
    );

    return rows.map(r => ({ ...r.rec, item: r.item, supplier: r.supplier }));
  }

  async generatePurchaseRecommendations(): Promise<PurchaseRecommendation[]> {
    // Clear old pending recommendations
    await db.delete(purchaseRecommendations).where(eq(purchaseRecommendations.status, 'pending'));

    // Get all active items
    const allItems = await db.select().from(items).where(eq(items.isActive, true));

    const created: PurchaseRecommendation[] = [];

    for (const item of allItems) {
      let priority: string | null = null;
      let reason: string | null = null;

      if (item.quantityOnHand === 0) {
        priority = 'critical';
        reason = 'Out of stock';
      } else if (item.quantityOnHand <= item.reorderPoint * 0.5) {
        priority = 'high';
        reason = `Critically low: ${item.quantityOnHand} ${item.unitOfMeasure} remaining`;
      } else if (item.quantityOnHand <= item.reorderPoint) {
        priority = 'medium';
        reason = `Below reorder point: ${item.quantityOnHand} of ${item.reorderPoint} ${item.unitOfMeasure}`;
      }

      if (priority) {
        const [rec] = await db.insert(purchaseRecommendations).values({
          itemId: item.id,
          supplierId: item.supplierId ?? null,
          recommendedQuantity: item.reorderQuantity || Math.max(item.reorderPoint * 2, 10),
          priorityLevel: priority,
          reason,
          status: 'pending',
        }).returning();
        created.push(rec);
      }
    }

    return created;
  }

  async updateRecommendationStatus(id: number, status: string): Promise<PurchaseRecommendation> {
    const [updated] = await db.update(purchaseRecommendations)
      .set({ status, updatedAt: new Date() })
      .where(eq(purchaseRecommendations.id, id))
      .returning();
    return updated;
  }

  // ─── Category Summary & Grouped ──────────────────────────────────────────────

  async getCategorySummary(): Promise<any[]> {
    const allCategories = await db.select().from(categories)
      .where(eq(categories.isActive, true))
      .orderBy(asc(categories.sortOrder), asc(categories.name));

    const allItems = await db.select().from(items).where(eq(items.isActive, true));

    return allCategories.map(cat => {
      const catItems = allItems.filter(i => i.categoryId === cat.id);
      const totalQuantity = catItems.reduce((s, i) => s + i.quantityOnHand, 0);
      const lowStockCount = catItems.filter(i => i.quantityOnHand > 0 && i.quantityOnHand <= i.reorderPoint).length;
      const outOfStockCount = catItems.filter(i => i.quantityOnHand === 0).length;
      return {
        ...cat,
        skuCount: catItems.length,
        totalQuantity,
        lowStockCount,
        outOfStockCount,
      };
    });
  }

  async getCategoryGrouped(categoryId: number): Promise<any> {
    const [cat] = await db.select().from(categories).where(eq(categories.id, categoryId));
    if (!cat) return null;

    const rows = await db.select({
      item: items,
      location: locations,
      supplier: suppliers,
    })
    .from(items)
    .leftJoin(locations, eq(items.primaryLocationId, locations.id))
    .leftJoin(suppliers, eq(items.supplierId, suppliers.id))
    .where(and(eq(items.categoryId, categoryId), eq(items.isActive, true)))
    .orderBy(asc(items.baseItemName), asc(items.sizeSortValue), asc(items.name));

    const itemIds = rows.map(r => r.item.id);
    const allImages = itemIds.length > 0
      ? await db.select().from(itemImages).where(inArray(itemImages.itemId, itemIds)).orderBy(asc(itemImages.sortOrder))
      : [];

    const enriched = rows.map(r => {
      const i = r.item;
      const firstImage = allImages.find(img => img.itemId === i.id);
      let status = "in_stock";
      if (i.quantityOnHand === 0) status = "out_of_stock";
      else if (i.quantityOnHand <= i.reorderPoint) status = "low_stock";
      return { ...i, location: r.location, supplier: r.supplier, status, imageUrl: firstImage?.imageUrl || null };
    });

    // Group by baseItemName (fall back to name if not set)
    const groupMap = new Map<string, { items: typeof enriched, representativeImage: string | null }>();
    for (const item of enriched) {
      const key = item.baseItemName || item.name;
      if (!groupMap.has(key)) {
        groupMap.set(key, { items: [], representativeImage: null });
      }
      const group = groupMap.get(key)!;
      group.items.push(item);
      if (!group.representativeImage && item.imageUrl) {
        group.representativeImage = item.imageUrl;
      }
    }

    const groups = Array.from(groupMap.entries()).map(([baseItemName, data]) => ({
      baseItemName,
      items: data.items,
      representativeImage: data.representativeImage,
    }));

    const totalQuantity = enriched.reduce((s, i) => s + i.quantityOnHand, 0);
    const lowStockCount = enriched.filter(i => i.status === "low_stock").length;
    const outOfStockCount = enriched.filter(i => i.status === "out_of_stock").length;

    return {
      category: cat,
      skuCount: enriched.length,
      totalQuantity,
      lowStockCount,
      outOfStockCount,
      groups,
    };
  }

  // ─── Dashboard Stats ──────────────────────────────────────────────────────────

  async getDashboardStats(): Promise<any> {
    const allItems = await db.select().from(items).where(eq(items.isActive, true));

    let totalQuantity = 0;
    let totalValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const item of allItems) {
      totalQuantity += item.quantityOnHand;
      const cost = item.unitCost ? parseFloat(item.unitCost) : 0;
      totalValue += cost * item.quantityOnHand;
      if (item.quantityOnHand === 0) outOfStockCount++;
      else if (item.quantityOnHand <= item.reorderPoint) lowStockCount++;
    }

    const pendingRecs = await db.select().from(purchaseRecommendations).where(eq(purchaseRecommendations.status, 'pending'));

    const movementRows = await db.select({ movement: inventoryMovements, item: items })
      .from(inventoryMovements)
      .leftJoin(items, eq(inventoryMovements.itemId, items.id))
      .orderBy(desc(inventoryMovements.createdAt))
      .limit(10);

    const recentActivity = movementRows.map(r => ({ ...r.movement, item: r.item }));

    return {
      totalSkus: allItems.length,
      totalQuantity,
      totalValue: totalValue.toFixed(2),
      lowStockCount,
      outOfStockCount,
      pendingReorderCount: pendingRecs.length,
      recentActivity,
    };
  }

  async getDashboardMonthlyTrend(): Promise<Array<{ label: string; value: number }>> {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const allMovementsRaw = await db
      .select({
        movementType: inventoryMovements.movementType,
        quantity: inventoryMovements.quantity,
        createdAt: inventoryMovements.createdAt,
        unitCost: items.unitCost,
      })
      .from(inventoryMovements)
      .leftJoin(items, eq(inventoryMovements.itemId, items.id))
      .where(gte(inventoryMovements.createdAt, startDate));

    const allItems = await db.select({ unitCost: items.unitCost, quantityOnHand: items.quantityOnHand })
      .from(items).where(eq(items.isActive, true));

    const currentValue = allItems.reduce((s, i) => s + parseFloat(i.unitCost || '0') * i.quantityOnHand, 0);

    const months: Array<{ year: number; month: number; label: string; netValueDelta: number }> = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
      months.push({ year: d.getFullYear(), month: d.getMonth(), label, netValueDelta: 0 });
    }

    for (const m of allMovementsRaw) {
      const cost = parseFloat(m.unitCost || '0');
      const valueChange = cost * m.quantity;
      const d = new Date(m.createdAt);
      const bucket = months.find(b => b.year === d.getFullYear() && b.month === d.getMonth());
      if (bucket) {
        if (m.movementType === 'receive' || m.movementType === 'return') bucket.netValueDelta += valueChange;
        else if (m.movementType === 'issue') bucket.netValueDelta -= valueChange;
      }
    }

    const monthValues: number[] = new Array(12).fill(0);
    monthValues[11] = currentValue;
    for (let i = 10; i >= 0; i--) {
      monthValues[i] = monthValues[i + 1] - months[i + 1].netValueDelta;
    }

    return months.map((m, i) => ({ label: m.label, value: Math.max(0, Math.round(monthValues[i])) }));
  }

  // ─── Reports ──────────────────────────────────────────────────────────────────

  async getReportLowStock(): Promise<any> {
    const allItems = await db.select({
      item: items,
      category: categories,
      location: locations,
      supplier: suppliers,
    })
    .from(items)
    .leftJoin(categories, eq(items.categoryId, categories.id))
    .leftJoin(locations, eq(items.primaryLocationId, locations.id))
    .leftJoin(suppliers, eq(items.supplierId, suppliers.id))
    .where(eq(items.isActive, true))
    .orderBy(asc(items.quantityOnHand));

    const outOfStock = allItems
      .filter(r => r.item.quantityOnHand === 0)
      .map(r => ({ ...r.item, category: r.category, location: r.location, supplier: r.supplier }));

    const lowStock = allItems
      .filter(r => r.item.quantityOnHand > 0 && r.item.quantityOnHand <= r.item.reorderPoint)
      .map(r => ({ ...r.item, category: r.category, location: r.location, supplier: r.supplier }));

    return { outOfStock, lowStock };
  }

  async getReportByLocation(): Promise<any> {
    const allLocations = await db.select().from(locations).where(eq(locations.isActive, true));
    const result = [];

    for (const loc of allLocations) {
      const balances = await db.select({
        balance: inventoryLocationBalances,
        item: items,
      })
      .from(inventoryLocationBalances)
      .leftJoin(items, eq(inventoryLocationBalances.itemId, items.id))
      .where(eq(inventoryLocationBalances.locationId, loc.id));

      const itemCount = balances.filter(b => b.balance.quantityOnHand > 0).length;
      const totalValue = balances.reduce((sum, b) => {
        const cost = b.item?.unitCost ? parseFloat(b.item.unitCost) : 0;
        return sum + cost * b.balance.quantityOnHand;
      }, 0);

      result.push({
        location: loc,
        itemCount,
        totalValue: totalValue.toFixed(2),
        balances: balances.map(b => ({ ...b.balance, item: b.item })),
      });
    }

    return result;
  }

  async getReportValuation(): Promise<any> {
    const allItems = await db.select({
      item: items,
      category: categories,
    })
    .from(items)
    .leftJoin(categories, eq(items.categoryId, categories.id))
    .where(eq(items.isActive, true))
    .orderBy(desc(sql`CAST(${items.unitCost} AS DECIMAL) * ${items.quantityOnHand}`));

    let totalValue = 0;
    const byCategory: Record<string, { name: string; count: number; value: number }> = {};

    const itemList = allItems.map(r => {
      const cost = r.item.unitCost ? parseFloat(r.item.unitCost) : 0;
      const value = cost * r.item.quantityOnHand;
      totalValue += value;

      const catName = r.category?.name || 'Uncategorized';
      if (!byCategory[catName]) byCategory[catName] = { name: catName, count: 0, value: 0 };
      byCategory[catName].count++;
      byCategory[catName].value += value;

      return { ...r.item, category: r.category, totalValue: value.toFixed(2) };
    });

    return {
      totalValue: totalValue.toFixed(2),
      byCategory: Object.values(byCategory).sort((a, b) => b.value - a.value),
      items: itemList,
    };
  }

  async getReportUsageByProject(): Promise<any> {
    const allProjects = await db.select().from(projects).orderBy(asc(projects.name));
    const result = [];

    for (const proj of allProjects) {
      const movements = await db.select({
        movement: inventoryMovements,
        item: items,
      })
      .from(inventoryMovements)
      .leftJoin(items, eq(inventoryMovements.itemId, items.id))
      .where(eq(inventoryMovements.projectId, proj.id));

      const issued = movements.filter(r => r.movement.movementType === 'issue');
      const returned = movements.filter(r => r.movement.movementType === 'return');

      const totalIssued = issued.reduce((s, r) => s + r.movement.quantity, 0);
      const totalReturned = returned.reduce((s, r) => s + r.movement.quantity, 0);
      const totalValue = issued.reduce((s, r) => {
        const cost = r.item?.unitCost ? parseFloat(r.item.unitCost) : 0;
        return s + cost * r.movement.quantity;
      }, 0);

      result.push({
        project: proj,
        totalIssued,
        totalReturned,
        netUsage: totalIssued - totalReturned,
        totalValue: totalValue.toFixed(2),
        movementCount: movements.length,
      });
    }

    return result.filter(r => r.movementCount > 0 || true);
  }
}

export const storage = new DatabaseStorage();
