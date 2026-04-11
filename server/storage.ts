import { db } from "./db";
import { eq, desc, asc, like, and, or, sql, lt, lte, gte, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  categories, locations, suppliers, projects, items, inventoryMovements, itemImages, itemGroups,
  inventoryLocationBalances, projectMaterialTransactions, supplierItems, purchaseRecommendations,
  wireReels, movementDrafts, dailyReports, projectScopeItems,
  type Category, type Location, type Supplier, type Project, type Item, type InventoryMovement,
  type InventoryLocationBalance, type PurchaseRecommendation, type SupplierItem, type ItemGroup,
  type WireReel, type WireReelWithRelations, type CreateWireReelRequest, type UpdateWireReelRequest,
  type CreateCategoryRequest, type UpdateCategoryRequest,
  type CreateLocationRequest, type CreateSupplierRequest, type UpdateSupplierRequest,
  type CreateProjectRequest, type UpdateProjectRequest,
  type CreateItemRequest, type UpdateItemRequest,
  type CreateInventoryMovementRequest,
  type CreatePurchaseRecommendationRequest,
  type ItemWithRelations, type InventoryMovementWithRelations,
  type ProjectWithStats, type SupplierWithStats, type PurchaseRecommendationWithRelations,
  type MovementDraft, type MovementDraftWithRelations,
  type DailyReport, type CreateDailyReportRequest, type UpdateDailyReportRequest,
  type ProjectScopeItem, type CreateProjectScopeItemRequest, type UpdateProjectScopeItemRequest,
  workers, type Worker, type CreateWorkerRequest, type UpdateWorkerRequest,
  workerAttendance, type WorkerAttendance, type CreateWorkerAttendanceRequest,
  workerEvaluations, type WorkerEvaluation, type CreateWorkerEvaluationRequest,
  equipment, type Equipment, type EquipmentWithProject, type CreateEquipmentRequest, type UpdateEquipmentRequest,
  materialRequests, type MaterialRequest,
} from "@shared/schema";

export interface IStorage {
  getCategories(): Promise<Category[]>;
  createCategory(category: CreateCategoryRequest): Promise<Category>;

  getLocations(): Promise<Location[]>;
  createLocation(location: CreateLocationRequest): Promise<Location>;
  deleteLocation(id: number): Promise<void>;
  restoreLocation(id: number): Promise<void>;

  getSuppliers(): Promise<Supplier[]>;
  getSupplier(id: number): Promise<SupplierWithStats | undefined>;
  createSupplier(supplier: CreateSupplierRequest): Promise<Supplier>;
  updateSupplier(id: number, supplier: UpdateSupplierRequest): Promise<Supplier>;
  deleteSupplier(id: number): Promise<void>;

  getProjects(): Promise<Project[]>;
  getProject(id: number): Promise<ProjectWithStats | undefined>;
  createProject(project: CreateProjectRequest): Promise<Project>;
  updateProject(id: number, project: UpdateProjectRequest): Promise<Project>;
  deleteProject(id: number): Promise<void>;

  getItems(filters?: {
    search?: string;
    categoryId?: number;
    locationId?: number;
    status?: string;
    sort?: "name" | "sku" | "quantityOnHand" | "status";
    dir?: "asc" | "desc";
    page?: number;
    perPage?: number;
  }): Promise<{ items: ItemWithRelations[]; total: number }>;
  getItem(id: number): Promise<ItemWithRelations | undefined>;
  createItem(item: CreateItemRequest): Promise<Item>;
  createItemImage(itemId: number, imageUrl: string): Promise<void>;
  setItemImage(itemId: number, imageUrl: string | null): Promise<void>;
  updateItem(id: number, item: UpdateItemRequest): Promise<Item>;
  deleteItem(id: number): Promise<void>;
  upsertItemGroup(categoryId: number, baseItemName: string, data: { imageUrl?: string | null }): Promise<ItemGroup>;
  renameFamily(categoryId: number, oldName: string, newName: string): Promise<void>;
  moveFamilyItems(itemIds: number[], newBaseItemName: string): Promise<void>;
  bulkSoftDeleteItems(itemIds: number[]): Promise<void>;

  getInventoryMovements(filters?: { itemId?: number; projectId?: number; movementType?: string; locationId?: number }): Promise<InventoryMovementWithRelations[]>;
  createInventoryMovement(movement: CreateInventoryMovementRequest & { previousQuantity: number; newQuantity: number; createdBy?: string | null }): Promise<InventoryMovement>;
  getLocationBalances(locationId?: number): Promise<(InventoryLocationBalance & { item?: Item; location?: Location })[]>;

  getPurchaseRecommendations(): Promise<PurchaseRecommendationWithRelations[]>;
  generatePurchaseRecommendations(): Promise<PurchaseRecommendation[]>;
  updateRecommendationStatus(id: number, status: string): Promise<PurchaseRecommendation>;

  getCategorySummary(): Promise<any[]>;
  getCategoryGrouped(categoryId: number): Promise<any>;

  updateInventoryMovement(id: number, changes: { movementType: string; quantity: number; sourceLocationId?: number | null; destinationLocationId?: number | null; projectId?: number | null; note?: string | null; reason?: string | null; itemId?: number; transactionDate?: Date | null; editedBy?: string | null; editHistory?: any[] }): Promise<InventoryMovement>;
  undoMovementEdit(id: number): Promise<InventoryMovement>;
  deleteMovement(id: number): Promise<void>;
  bulkDeleteMovements(ids: number[]): Promise<{ deleted: number[]; errors: { id: number; message: string }[] }>;
  bulkRestoreMovements(snapshots: any[]): Promise<{ restored: number[] }>;
  getDashboardStats(): Promise<any>;
  getDashboardMonthlyTrend(): Promise<Array<{ label: string; value: number }>>;
  getReportLowStock(): Promise<any>;
  getReportByLocation(): Promise<any>;
  getReportValuation(): Promise<any>;
  getReportUsageByProject(): Promise<any>;

  getFieldFamilies(params: { categoryId?: number }): Promise<{ name: string; count: number }[]>;
  getFieldSizes(params: { categoryId?: number; family?: string; detailType?: string; subcategory?: string; status?: string; search?: string }): Promise<string[]>;
  getFieldTypes(params: { categoryId?: number; family?: string }): Promise<{ name: string; count: number }[]>;
  getFieldSubcategories(params: { categoryId?: number; family?: string; detailType?: string }): Promise<{ name: string; count: number }[]>;
  getFieldItems(params: {
    categoryId?: number;
    family?: string;
    detailType?: string;
    subcategory?: string;
    size?: string;
    status?: string;
    search?: string;
    page?: number;
    perPage?: number;
  }): Promise<{ items: (ItemWithRelations & { status: string; extractedSubcategory: string })[]; total: number }>;
  getClassificationOptions(categoryId: number): Promise<{ subcategories: string[]; detailTypes: string[]; subTypes: string[] }>;

  getWireReels(itemId: number): Promise<WireReelWithRelations[]>;
  getNextReelSeq(itemId: number): Promise<number>;
  getDistinctReelBrands(): Promise<string[]>;
  createWireReel(data: CreateWireReelRequest): Promise<WireReel>;
  updateWireReel(id: number, data: UpdateWireReelRequest): Promise<WireReel>;
  deleteWireReel(id: number): Promise<void>;
  restoreWireReel(id: number): Promise<WireReel>;

  getDrafts(): Promise<MovementDraftWithRelations[]>;
  getDraft(id: number): Promise<MovementDraftWithRelations | undefined>;
  createDraft(data: { movementType: string; sourceLocationId?: number | null; destinationLocationId?: number | null; projectId?: number | null; itemsJson: string; note?: string | null; savedBy?: string | null; savedByName?: string | null }): Promise<MovementDraft>;
  deleteDraft(id: number): Promise<void>;
  confirmDraft(id: number, performedBy: string | null): Promise<void>;

  getDailyReports(projectId: number): Promise<DailyReport[]>;
  getDailyReportSummary(): Promise<{ projectId: number; total: number; draft: number; submitted: number; lastDate: string | null }[]>;
  getDailyReport(id: number): Promise<DailyReport | undefined>;
  createDailyReport(data: CreateDailyReportRequest): Promise<DailyReport>;
  updateDailyReport(id: number, data: UpdateDailyReportRequest): Promise<DailyReport>;

  getWorkers(): Promise<Worker[]>;
  getWorker(id: number): Promise<Worker | undefined>;
  createWorker(data: CreateWorkerRequest): Promise<Worker>;
  updateWorker(id: number, data: UpdateWorkerRequest): Promise<Worker>;
  deleteWorker(id: number): Promise<void>;

  getWorkerAttendance(workerId: number): Promise<WorkerAttendance[]>;
  createWorkerAttendance(data: CreateWorkerAttendanceRequest): Promise<WorkerAttendance>;
  deleteWorkerAttendance(id: number): Promise<void>;

  getWorkerEvaluations(workerId: number): Promise<WorkerEvaluation[]>;
  createWorkerEvaluation(data: CreateWorkerEvaluationRequest): Promise<WorkerEvaluation>;

  getScopeItems(projectId: number): Promise<ProjectScopeItem[]>;
  getScopeItem(id: number): Promise<ProjectScopeItem | undefined>;
  createScopeItem(data: CreateProjectScopeItemRequest): Promise<ProjectScopeItem>;
  updateScopeItem(id: number, data: UpdateProjectScopeItemRequest): Promise<ProjectScopeItem>;
  deleteScopeItem(id: number): Promise<void>;
  getProjectProgress(projectId: number): Promise<{
    scopeItems: ProjectScopeItem[];
    progress: Record<number, { cumulative: number; remaining: number; pct: number; todayAdded: number; completedBeforeToday: number }>;
    drillDown: Record<number, { reportId: number; reportNumber: string | null; reportDate: string; preparedBy: string | null; qty: number; runningTotal: number }[]>;
    summary: { overallPct: number; estTotal: number; installed: number; remaining: number; todayAdded: number };
  }>;

  getEquipment(): Promise<EquipmentWithProject[]>;
  getEquipmentItem(id: number): Promise<EquipmentWithProject | undefined>;
  createEquipment(data: CreateEquipmentRequest): Promise<Equipment>;
  updateEquipment(id: number, data: UpdateEquipmentRequest): Promise<Equipment>;
  deleteEquipment(id: number): Promise<void>;

  getMaterialRequests(submittedBy?: string): Promise<MaterialRequest[]>;
  getMaterialRequest(id: number): Promise<MaterialRequest | undefined>;
  createMaterialRequest(data: { requestNumber: string; itemsJson: string; requestType?: string; submittedBy?: string; submittedByName?: string; notes?: string | null; projectId?: number | null; requesterName?: string | null; requesterRole?: string | null }): Promise<MaterialRequest>;
  updateMaterialRequest(id: number, data: Partial<{ itemsJson: string; notes: string | null; projectId: number | null; requesterName: string | null; requesterRole: string | null; requestType: string }>): Promise<MaterialRequest | undefined>;
  updateMaterialRequestStatus(id: number, status: string): Promise<MaterialRequest>;
  fulfillMaterialRequest(id: number, movementId: number): Promise<MaterialRequest>;
  deleteMaterialRequest(id: number): Promise<void>;
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

  async deleteLocation(id: number): Promise<void> {
    await db.update(locations).set({ isActive: false }).where(eq(locations.id, id));
  }

  async restoreLocation(id: number): Promise<void> {
    await db.update(locations).set({ isActive: true }).where(eq(locations.id, id));
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

  async deleteSupplier(id: number): Promise<void> {
    const referencedItems = await db.select({ id: items.id })
      .from(items)
      .where(and(eq(items.supplierId, id), eq(items.isActive, true)));
    if (referencedItems.length > 0) {
      throw new Error(`Cannot delete: ${referencedItems.length} active item(s) reference this supplier. Reassign them first.`);
    }
    await db.delete(supplierItems).where(eq(supplierItems.supplierId, id));
    await db.delete(suppliers).where(eq(suppliers.id, id));
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

  async deleteProject(id: number): Promise<void> {
    const referencedMovements = await db.select({ id: inventoryMovements.id })
      .from(inventoryMovements)
      .where(eq(inventoryMovements.projectId, id))
      .limit(1);
    if (referencedMovements.length > 0) {
      throw new Error(`Cannot delete: this project has logged inventory movements. Set the status to "Cancelled" instead.`);
    }
    await db.delete(projectMaterialTransactions).where(eq(projectMaterialTransactions.projectId, id));
    await db.delete(projects).where(eq(projects.id, id));
  }

  // ─── Items ────────────────────────────────────────────────────────────────────

  // ── Live reel quantities ────────────────────────────────────────────────────
  // For items with active reels the reel sum IS the quantity on hand.
  // This helper returns a Map<itemId, totalFt> for every item that has ≥1 active reel.
  private async liveReelQtyMap(itemIds: number[]): Promise<Map<number, number>> {
    if (itemIds.length === 0) return new Map();
    const rows = await db
      .select({
        itemId: wireReels.itemId,
        total: sql<number>`COALESCE(SUM(${wireReels.lengthFt}), 0)`,
      })
      .from(wireReels)
      .where(and(inArray(wireReels.itemId, itemIds), eq(wireReels.isActive, true)))
      .groupBy(wireReels.itemId);
    return new Map(rows.map(r => [r.itemId, Number(r.total)]));
  }

  // Apply live reel quantities to a list of plain item objects (mutates nothing, returns new array).
  private applyReelQty<T extends { id: number; quantityOnHand: number; minimumStock: number }>(
    items: T[],
    reelMap: Map<number, number>,
  ): T[] {
    return items.map(item => {
      if (!reelMap.has(item.id)) return item;
      const qty = reelMap.get(item.id)!;
      return { ...item, quantityOnHand: qty };
    });
  }

  async getItems(filters?: {
    search?: string;
    categoryId?: number;
    locationId?: number;
    status?: string;
    sort?: "name" | "sku" | "quantityOnHand" | "status";
    dir?: "asc" | "desc";
    page?: number;
    perPage?: number;
  }): Promise<{ items: ItemWithRelations[]; total: number }> {
    const sort = filters?.sort ?? "name";
    const dir  = filters?.dir  ?? "asc";

    // ── SQL-level WHERE conditions ─────────────────────────────────────────
    const conditions: any[] = [eq(items.isActive, true)];
    if (filters?.categoryId) conditions.push(eq(items.categoryId, filters.categoryId));
    if (filters?.locationId) conditions.push(eq(items.primaryLocationId, filters.locationId));

    // ── SQL-level ORDER BY (for DB columns; status sort handled in memory) ──
    const sortCol =
      sort === "sku"           ? items.sku            :
      sort === "quantityOnHand"? items.quantityOnHand :
      items.name;
    const sqlOrder = dir === "desc" ? desc(sortCol) : asc(sortCol);

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
    .where(conditions.length === 1 ? conditions[0] : and(...conditions))
    .orderBy(sqlOrder);

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

    // ── Reel qty override ─────────────────────────────────────────────────
    const reelMap = await this.liveReelQtyMap(itemIds);
    mapped = this.applyReelQty(mapped, reelMap) as typeof mapped;

    // ── Compute status on every row ───────────────────────────────────────
    mapped = mapped.map(i => {
      let status = "in_stock";
      if ((i as any).statusOverride === "ORDERED") status = "ordered";
      else if (i.quantityOnHand === 0) status = "out_of_stock";
      else if (i.quantityOnHand <= i.minimumStock) status = "low_stock";
      return { ...i, status };
    });

    // ── In-memory search filter (with relevance scoring) ──────────────────
    if (filters?.search) {
      const tokens = filters.search.toLowerCase().split(/\s+/).filter(t => t.length > 0);
      mapped = mapped.filter(i => {
        const haystack = [
          i.name,
          i.sku,
          (i as any).sizeLabel || '',
          (i as any).baseItemName || '',
          i.description || '',
          i.category?.name || '',
          i.supplier?.name || '',
        ].join(' ').toLowerCase();
        return tokens.every(token => haystack.includes(token));
      });

      const nameScore = (i: any) => {
        const nameLower  = (i.name || '').toLowerCase();
        const sizeLabel  = (i.sizeLabel || '').toLowerCase();
        const fullName   = `${nameLower} ${sizeLabel}`.trim();
        const skuLower   = (i.sku || '').toLowerCase();
        const baseLower  = (i.baseItemName || '').toLowerCase();
        let score = 0;
        for (const token of tokens) {
          if (fullName.includes(token)) score += 4;
          else if (baseLower.includes(token)) score += 3;
          else if (skuLower.includes(token)) score += 2;
        }
        return score;
      };

      mapped = mapped.sort((a, b) => {
        const diff = nameScore(b) - nameScore(a);
        if (diff !== 0) return diff;
        return (a.name || '').localeCompare(b.name || '');
      });
    }

    // ── Status filter (applied after status is computed) ──────────────────
    if (filters?.status) {
      if (filters.status === 'low_stock') {
        mapped = mapped.filter(i => i.status === 'low_stock');
      } else if (filters.status === 'out_of_stock') {
        mapped = mapped.filter(i => i.status === 'out_of_stock');
      } else if (filters.status === 'in_stock') {
        mapped = mapped.filter(i => i.status === 'in_stock');
      } else if (filters.status === 'ordered') {
        mapped = mapped.filter(i => i.status === 'ordered');
      }
    }

    // ── In-memory sort for status column (computed field) ─────────────────
    if (sort === "status" && !filters?.search) {
      const ORDER = { out_of_stock: 0, low_stock: 1, ordered: 2, in_stock: 3 };
      mapped = mapped.sort((a, b) => {
        const av = ORDER[(a as any).status as keyof typeof ORDER] ?? 99;
        const bv = ORDER[(b as any).status as keyof typeof ORDER] ?? 99;
        return dir === "asc" ? av - bv : bv - av;
      });
    }

    // ── Total count (after all in-memory filters) ──────────────────────────
    const total = mapped.length;

    // ── Pagination — only applied when page is explicitly requested ────────
    if (filters?.page === undefined) {
      return { items: mapped, total };
    }
    const page    = filters.page;
    const perPage = filters.perPage ?? 25;
    const start     = (page - 1) * perPage;
    const pageItems = mapped.slice(start, start + perPage);

    return { items: pageItems, total };
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

    // Override quantityOnHand with live reel sum for reel-tracked items
    const reelMap = await this.liveReelQtyMap([id]);
    const liveQty = reelMap.has(id) ? reelMap.get(id)! : row.item.quantityOnHand;

    return {
      ...row.item,
      quantityOnHand: liveQty,
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

  async createItemImage(itemId: number, imageUrl: string): Promise<void> {
    await db.insert(itemImages).values({ itemId, imageUrl, sortOrder: 0 });
  }

  async setItemImage(itemId: number, imageUrl: string | null): Promise<void> {
    await db.delete(itemImages).where(eq(itemImages.itemId, itemId));
    if (imageUrl) {
      await db.insert(itemImages).values({ itemId, imageUrl, sortOrder: 0 });
    }
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
    const srcLoc = alias(locations, "src_loc");
    const dstLoc = alias(locations, "dst_loc");
    const firstImg = alias(itemImages, "first_img");

    const rows = await db.select({
      movement: inventoryMovements,
      item: items,
      itemImageUrl: firstImg.imageUrl,
      project: projects,
      sourceLocation: srcLoc,
      destinationLocation: dstLoc,
    })
    .from(inventoryMovements)
    .leftJoin(items, eq(inventoryMovements.itemId, items.id))
    .leftJoin(firstImg, eq(items.id, firstImg.itemId))
    .leftJoin(projects, eq(inventoryMovements.projectId, projects.id))
    .leftJoin(srcLoc, eq(inventoryMovements.sourceLocationId, srcLoc.id))
    .leftJoin(dstLoc, eq(inventoryMovements.destinationLocationId, dstLoc.id))
    .orderBy(desc(inventoryMovements.createdAt), asc(firstImg.sortOrder));

    let result = rows.map(r => ({
      ...r.movement,
      item: r.item ? { ...r.item, imageUrl: r.itemImageUrl || null } : null,
      project: r.project,
      sourceLocation: r.sourceLocation,
      destinationLocation: r.destinationLocation,
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
    // receive/issue/return: external locations (supplier / jobsite), no internal balance update
    // transfer: moves between internal warehouse locations
    if (movement.movementType === 'transfer') {
      if (movement.sourceLocationId) {
        await this._adjustLocationBalance(movement.itemId, movement.sourceLocationId, -movement.quantity);
      }
      if (movement.destinationLocationId) {
        await this._adjustLocationBalance(movement.itemId, movement.destinationLocationId, movement.quantity);
      }
    } else if (movement.movementType === 'adjust') {
      const locId = movement.destinationLocationId ?? movement.sourceLocationId;
      if (locId) {
        const delta = movement.newQuantity - movement.previousQuantity;
        await this._adjustLocationBalance(movement.itemId, locId, delta);
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

  async updateInventoryMovement(id: number, changes: { movementType: string; quantity: number; sourceLocationId?: number | null; destinationLocationId?: number | null; projectId?: number | null; note?: string | null; reason?: string | null; itemId?: number; transactionDate?: Date | null; editedBy?: string | null; editHistory?: any[] }): Promise<InventoryMovement> {
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

    // Reverse old location balance impacts (transfer only; receive/issue/return are external)
    if (orig.movementType === "transfer") {
      if (orig.sourceLocationId) await this._adjustLocationBalance(orig.itemId, orig.sourceLocationId, orig.quantity);
      if (orig.destinationLocationId) await this._adjustLocationBalance(orig.itemId, orig.destinationLocationId, -orig.quantity);
    }

    // Apply new location balance impacts (transfer only)
    const newSrc = changes.sourceLocationId !== undefined ? changes.sourceLocationId : orig.sourceLocationId;
    const newDst = changes.destinationLocationId !== undefined ? changes.destinationLocationId : orig.destinationLocationId;
    if (changes.movementType === "transfer") {
      if (newSrc) await this._adjustLocationBalance(effectiveItemId, newSrc, -changes.quantity);
      if (newDst) await this._adjustLocationBalance(effectiveItemId, newDst, changes.quantity);
    }

    // Update item quantity
    await db.update(items).set({ quantityOnHand: updatedQty, updatedAt: new Date() }).where(eq(items.id, effectiveItemId));

    // Build edit history entry
    const now = new Date();
    const prevHistory: any[] = Array.isArray(orig.editHistory) ? (orig.editHistory as any[]) : [];
    const changedFields: Record<string, { old: any; new: any }> = {};
    if (changes.movementType !== orig.movementType) changedFields.movementType = { old: orig.movementType, new: changes.movementType };
    if (changes.quantity !== orig.quantity) changedFields.quantity = { old: orig.quantity, new: changes.quantity };
    if (changes.sourceLocationId !== undefined && changes.sourceLocationId !== orig.sourceLocationId) changedFields.sourceLocationId = { old: orig.sourceLocationId, new: changes.sourceLocationId };
    if (changes.destinationLocationId !== undefined && changes.destinationLocationId !== orig.destinationLocationId) changedFields.destinationLocationId = { old: orig.destinationLocationId, new: changes.destinationLocationId };
    if (changes.projectId !== undefined && changes.projectId !== orig.projectId) changedFields.projectId = { old: orig.projectId, new: changes.projectId };
    if (changes.note !== undefined && changes.note !== orig.note) changedFields.note = { old: orig.note, new: changes.note };
    if (changes.transactionDate !== undefined && String(changes.transactionDate) !== String(orig.transactionDate)) changedFields.transactionDate = { old: orig.transactionDate, new: changes.transactionDate };

    const newHistoryEntry = {
      editedBy: changes.editedBy ?? null,
      editedAt: now.toISOString(),
      changedFields,
      previousValues: {
        movementType: orig.movementType,
        quantity: orig.quantity,
        sourceLocationId: orig.sourceLocationId,
        destinationLocationId: orig.destinationLocationId,
        projectId: orig.projectId,
        note: orig.note,
        transactionDate: orig.transactionDate,
      },
    };

    const newHistory = [...prevHistory, newHistoryEntry];

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
      transactionDate: changes.transactionDate !== undefined ? changes.transactionDate : orig.transactionDate,
      editedBy: changes.editedBy ?? orig.editedBy,
      editedAt: now,
      editHistory: newHistory as any,
    }).where(eq(inventoryMovements.id, id)).returning();

    return updated;
  }

  async undoMovementEdit(id: number): Promise<InventoryMovement> {
    const [orig] = await db.select().from(inventoryMovements).where(eq(inventoryMovements.id, id));
    if (!orig) throw new Error("Movement not found");
    const history: any[] = Array.isArray(orig.editHistory) ? (orig.editHistory as any[]) : [];
    if (history.length === 0) throw new Error("No edit history to undo");

    const lastEntry = history[history.length - 1];
    const prev = lastEntry.previousValues;

    // Revert the stock using the same logic as updateInventoryMovement
    const [itemRow] = await db.select().from(items).where(eq(items.id, orig.itemId));
    if (!itemRow) throw new Error("Item not found");

    let curDelta = 0;
    if (orig.movementType === "receive" || orig.movementType === "return") curDelta = orig.quantity;
    else if (orig.movementType === "issue") curDelta = -orig.quantity;

    let prevDelta = 0;
    if (prev.movementType === "receive" || prev.movementType === "return") prevDelta = prev.quantity;
    else if (prev.movementType === "issue") prevDelta = -prev.quantity;

    const netChange = prevDelta - curDelta;
    const revertedQty = itemRow.quantityOnHand + netChange;

    await db.update(items).set({ quantityOnHand: revertedQty, updatedAt: new Date() }).where(eq(items.id, orig.itemId));

    const newHistory = history.slice(0, -1);
    const [updated] = await db.update(inventoryMovements).set({
      movementType: prev.movementType ?? orig.movementType,
      quantity: prev.quantity ?? orig.quantity,
      sourceLocationId: prev.sourceLocationId ?? null,
      destinationLocationId: prev.destinationLocationId ?? null,
      projectId: prev.projectId ?? null,
      note: prev.note ?? null,
      transactionDate: prev.transactionDate ?? null,
      newQuantity: revertedQty,
      previousQuantity: itemRow.quantityOnHand,
      editedAt: newHistory.length > 0 ? new Date(newHistory[newHistory.length - 1].editedAt) : null,
      editedBy: newHistory.length > 0 ? newHistory[newHistory.length - 1].editedBy : null,
      editHistory: newHistory.length > 0 ? (newHistory as any) : null,
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

    // Reverse location balance impacts (transfer only; receive/issue/return are external)
    if (orig.movementType === "transfer") {
      if (orig.sourceLocationId) await this._adjustLocationBalance(orig.itemId, orig.sourceLocationId, orig.quantity);
      if (orig.destinationLocationId) await this._adjustLocationBalance(orig.itemId, orig.destinationLocationId, -orig.quantity);
    }

    // Update item quantity
    await db.update(items).set({ quantityOnHand: newQty, updatedAt: new Date() }).where(eq(items.id, orig.itemId));

    // Delete dependent project_material_transactions first (FK constraint), then the movement
    await db.delete(projectMaterialTransactions).where(eq(projectMaterialTransactions.movementId, id));
    await db.delete(inventoryMovements).where(eq(inventoryMovements.id, id));
  }

  async bulkDeleteMovements(ids: number[]): Promise<{ deleted: number[]; errors: { id: number; message: string }[] }> {
    const deleted: number[] = [];
    const errors: { id: number; message: string }[] = [];
    for (const id of ids) {
      try {
        await this.deleteMovement(id);
        deleted.push(id);
      } catch (err: any) {
        errors.push({ id, message: err.message });
      }
    }
    return { deleted, errors };
  }

  async bulkRestoreMovements(snapshots: any[]): Promise<{ restored: number[] }> {
    const restored: number[] = [];
    for (const snap of snapshots) {
      // Re-apply inventory delta
      let delta = 0;
      if (snap.movementType === "receive" || snap.movementType === "return") delta = snap.quantity;
      else if (snap.movementType === "issue") delta = -snap.quantity;

      const [itemRow] = await db.select().from(items).where(eq(items.id, snap.itemId));
      if (itemRow) {
        const newQty = Math.max(0, itemRow.quantityOnHand + delta);
        await db.update(items).set({ quantityOnHand: newQty, updatedAt: new Date() }).where(eq(items.id, snap.itemId));
      }

      // Re-apply location balances for transfers
      if (snap.movementType === "transfer") {
        if (snap.sourceLocationId) await this._adjustLocationBalance(snap.itemId, snap.sourceLocationId, -snap.quantity);
        if (snap.destinationLocationId) await this._adjustLocationBalance(snap.itemId, snap.destinationLocationId, snap.quantity);
      }

      // Re-insert movement with original data
      const [inserted] = await db.insert(inventoryMovements).values({
        itemId: snap.itemId,
        movementType: snap.movementType,
        quantity: snap.quantity,
        previousQuantity: snap.previousQuantity ?? 0,
        newQuantity: snap.newQuantity ?? 0,
        sourceLocationId: snap.sourceLocationId ?? null,
        destinationLocationId: snap.destinationLocationId ?? null,
        projectId: snap.projectId ?? null,
        unitCostSnapshot: snap.unitCostSnapshot ?? null,
        referenceType: snap.referenceType ?? null,
        referenceId: snap.referenceId ?? null,
        note: snap.note ?? null,
        reason: snap.reason ?? null,
        createdBy: snap.createdBy ?? null,
        createdAt: snap.createdAt ? new Date(snap.createdAt) : new Date(),
      }).returning();

      restored.push(inserted.id);
    }
    return { restored };
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

    // Load item group metadata (custom representative images)
    const groupRecords = await db.select().from(itemGroups).where(eq(itemGroups.categoryId, categoryId));
    const groupImageMap = new Map<string, string | null>();
    for (const g of groupRecords) {
      groupImageMap.set(g.baseItemName, g.imageUrl ?? null);
    }

    // Override quantityOnHand with live reel sum for reel-tracked items
    const reelMap = await this.liveReelQtyMap(itemIds);

    const enriched = rows.map(r => {
      const i = r.item;
      const firstImage = allImages.find(img => img.itemId === i.id);
      const liveQty = reelMap.has(i.id) ? reelMap.get(i.id)! : i.quantityOnHand;
      let status = "in_stock";
      if (liveQty === 0) status = "out_of_stock";
      else if (liveQty <= i.minimumStock) status = "low_stock";
      return { ...i, quantityOnHand: liveQty, location: r.location, supplier: r.supplier, status, imageUrl: firstImage?.imageUrl || null };
    });

    // Group by baseItemName (fall back to name if not set)
    const groupMap = new Map<string, { items: typeof enriched, representativeImage: string | null }>();
    for (const item of enriched) {
      const key = item.baseItemName || item.name;
      if (!groupMap.has(key)) {
        // Priority: custom group image, then first item image
        const customImage = groupImageMap.get(key) ?? null;
        groupMap.set(key, { items: [], representativeImage: customImage });
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
      customImageUrl: groupImageMap.get(baseItemName) ?? null,
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

  // ─── Item Groups (family metadata) ────────────────────────────────────────────

  async upsertItemGroup(categoryId: number, baseItemName: string, data: { imageUrl?: string | null }): Promise<ItemGroup> {
    const [existing] = await db.select().from(itemGroups)
      .where(and(eq(itemGroups.categoryId, categoryId), eq(itemGroups.baseItemName, baseItemName)));
    if (existing) {
      const [updated] = await db.update(itemGroups)
        .set({ imageUrl: data.imageUrl ?? null, updatedAt: new Date() })
        .where(eq(itemGroups.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(itemGroups)
      .values({ categoryId, baseItemName, imageUrl: data.imageUrl ?? null })
      .returning();
    return created;
  }

  async renameFamily(categoryId: number, oldName: string, newName: string): Promise<void> {
    await db.update(items)
      .set({ baseItemName: newName, updatedAt: new Date() })
      .where(and(eq(items.categoryId, categoryId), eq(items.baseItemName, oldName), eq(items.isActive, true)));
    const [existing] = await db.select().from(itemGroups)
      .where(and(eq(itemGroups.categoryId, categoryId), eq(itemGroups.baseItemName, oldName)));
    if (existing) {
      await db.update(itemGroups)
        .set({ baseItemName: newName, updatedAt: new Date() })
        .where(eq(itemGroups.id, existing.id));
    }
  }

  async moveFamilyItems(itemIds: number[], newBaseItemName: string): Promise<void> {
    if (itemIds.length === 0) return;
    await db.update(items)
      .set({ baseItemName: newBaseItemName, updatedAt: new Date() })
      .where(inArray(items.id, itemIds));
  }

  async bulkSoftDeleteItems(itemIds: number[]): Promise<void> {
    if (itemIds.length === 0) return;
    await db.update(items)
      .set({ isActive: false, updatedAt: new Date() })
      .where(inArray(items.id, itemIds));
  }

  // ─── Dashboard Stats ──────────────────────────────────────────────────────────

  async getDashboardStats(): Promise<any> {
    // Single SQL aggregation replaces full table fetch + in-memory loop
    const [kpi] = await db.select({
      totalSkus:       sql<string>`COUNT(*)`,
      totalQuantity:   sql<string>`COALESCE(SUM(${items.quantityOnHand}), 0)`,
      totalValue:      sql<string>`COALESCE(SUM(CAST(${items.unitCost} AS NUMERIC) * ${items.quantityOnHand}), 0)`,
      outOfStockCount: sql<string>`COUNT(*) FILTER (WHERE ${items.quantityOnHand} = 0)`,
      // lowStock: quantity > 0 AND quantity <= reorderPoint (preserves original KPI meaning)
      lowStockCount:   sql<string>`COUNT(*) FILTER (WHERE ${items.quantityOnHand} > 0 AND ${items.quantityOnHand} <= ${items.reorderPoint})`,
    }).from(items).where(eq(items.isActive, true));

    // COUNT(*) in SQL rather than fetching all pending rows
    const [recRow] = await db.select({
      cnt: sql<string>`COUNT(*)`,
    }).from(purchaseRecommendations).where(eq(purchaseRecommendations.status, 'pending'));

    // Already SQL-efficient: join + ORDER BY + LIMIT 10
    const movementRows = await db.select({ movement: inventoryMovements, item: items })
      .from(inventoryMovements)
      .leftJoin(items, eq(inventoryMovements.itemId, items.id))
      .orderBy(desc(inventoryMovements.createdAt))
      .limit(10);

    const recentActivity = movementRows.map(r => ({ ...r.movement, item: r.item }));

    return {
      totalSkus:           Number(kpi.totalSkus),
      totalQuantity:       Number(kpi.totalQuantity),
      totalValue:          parseFloat(kpi.totalValue).toFixed(2),
      lowStockCount:       Number(kpi.lowStockCount),
      outOfStockCount:     Number(kpi.outOfStockCount),
      pendingReorderCount: Number(recRow.cnt),
      recentActivity,
    };
  }

  async getDashboardMonthlyTrend(): Promise<Array<{ label: string; value: number }>> {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    // Build the 12-month label/bucket array
    const months: Array<{ year: number; month: number; label: string; netValueDelta: number }> = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
      months.push({ year: d.getFullYear(), month: d.getMonth(), label, netValueDelta: 0 });
    }

    // Move per-row iteration to a SQL GROUP BY — returns at most 12 rows instead of N movements
    const buckets = await db.select({
      yr:       sql<number>`EXTRACT(YEAR FROM ${inventoryMovements.createdAt})::int`,
      // 0-indexed month to match JS Date.getMonth()
      mo:       sql<number>`(EXTRACT(MONTH FROM ${inventoryMovements.createdAt}) - 1)::int`,
      netDelta: sql<string>`
        COALESCE(SUM(CASE WHEN ${inventoryMovements.movementType} IN ('receive', 'return')
                         THEN CAST(${items.unitCost} AS NUMERIC) * ${inventoryMovements.quantity}
                         ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN ${inventoryMovements.movementType} = 'issue'
                            THEN CAST(${items.unitCost} AS NUMERIC) * ${inventoryMovements.quantity}
                            ELSE 0 END), 0)
      `,
    }).from(inventoryMovements)
      .leftJoin(items, eq(inventoryMovements.itemId, items.id))
      .where(gte(inventoryMovements.createdAt, startDate))
      .groupBy(
        sql`EXTRACT(YEAR FROM ${inventoryMovements.createdAt})`,
        sql`EXTRACT(MONTH FROM ${inventoryMovements.createdAt})`,
      );

    for (const b of buckets) {
      const bucket = months.find(m => m.year === Number(b.yr) && m.month === Number(b.mo));
      if (bucket) bucket.netValueDelta = parseFloat(String(b.netDelta));
    }

    // Current inventory value via SQL aggregation (no full-table fetch + reduce)
    const [valueRow] = await db.select({
      currentValue: sql<string>`COALESCE(SUM(CAST(${items.unitCost} AS NUMERIC) * ${items.quantityOnHand}), 0)`,
    }).from(items).where(eq(items.isActive, true));

    const currentValue = parseFloat(valueRow.currentValue);

    // Backward-calculate month values — only 12 iterations, same logic as before
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

  // ─── Field Inventory ─────────────────────────────────────────────────────────

  async getFieldFamilies(params: { categoryId?: number }): Promise<{ name: string; count: number }[]> {
    const allItems = await db.select({
      name: items.name,
      subcategory: items.subcategory,
      detailType: items.detailType,
      baseItemName: items.baseItemName,
      categoryId: items.categoryId,
    }).from(items).where(eq(items.isActive, true));

    const filtered = params.categoryId
      ? allItems.filter(i => i.categoryId === params.categoryId)
      : allItems;

    const counts: Record<string, number> = {};
    for (const i of filtered) {
      const fam = derivedFamily(i.subcategory, i.detailType, i.name || '', i.baseItemName);
      if (fam) counts[fam] = (counts[fam] || 0) + 1;
    }

    const entries = Object.entries(counts).map(([name, count]) => ({ name, count }));

    // Apply category-specific ordering if we know the category code
    if (params.categoryId) {
      const catRow = await db.select({ code: categories.code })
        .from(categories).where(eq(categories.id, params.categoryId)).limit(1);
      const code = catRow[0]?.code || '';
      if (code === 'CT') return applyOrder(entries, CT_FAMILY_ORDER);
      if (code === 'CF') return applyOrder(entries, CF_FAMILY_ORDER);
      if (code === 'CS') return applyOrder(entries, CS_FAMILY_ORDER);
    }

    return entries.sort((a, b) => b.count - a.count);
  }

  async getFieldSizes(params: {
    categoryId?: number;
    family?: string;
    type?: string;
    subcategory?: string;
    status?: string;
    search?: string;
  }): Promise<string[]> {
    const allItems = await db.select({
      sizeLabel: items.sizeLabel,
      sizeSortValue: items.sizeSortValue,
      categoryId: items.categoryId,
      subcategory: items.subcategory,
      detailType: items.detailType,
      subType: items.subType,
      baseItemName: items.baseItemName,
      name: items.name,
      quantityOnHand: items.quantityOnHand,
      reorderPoint: items.reorderPoint,
      statusOverride: items.statusOverride,
    }).from(items).where(eq(items.isActive, true));

    let filtered = allItems as any[];
    if (params.categoryId) filtered = filtered.filter(i => i.categoryId === params.categoryId);
    if (params.family) filtered = filtered.filter(i =>
      derivedFamily(i.subcategory, i.detailType, i.name || '', i.baseItemName) === params.family
    );
    if (params.type) filtered = filtered.filter(i =>
      derivedType(i.subcategory, i.detailType, i.baseItemName, i.name || '') === params.type
    );
    if (params.subcategory) {
      filtered = filtered.filter(i => {
        const sc = i.subType?.trim() || extractSubcategory(i.name || '', i.detailType, i.subcategory, i.baseItemName);
        return sc === params.subcategory;
      });
    }
    if (params.search) {
      const tokens = params.search.toLowerCase().split(/\s+/).filter(t => t.length > 0);
      filtered = filtered.filter(i => {
        const hay = (i.name || '').toLowerCase();
        return tokens.every((t: string) => hay.includes(t));
      });
    }
    if (params.status && params.status !== "all") {
      filtered = filtered.filter(i => {
        let st = "in_stock";
        if (i.statusOverride === "ORDERED") st = "ordered";
        else if (i.quantityOnHand === 0) st = "out_of_stock";
        else if (i.quantityOnHand <= i.minimumStock) st = "low_stock";
        return st === params.status;
      });
    }

    const seen = new Set<string>();
    const result: { label: string; sortVal: number | null }[] = [];
    for (const i of filtered) {
      if (i.sizeLabel && !seen.has(i.sizeLabel)) {
        seen.add(i.sizeLabel);
        result.push({ label: i.sizeLabel, sortVal: i.sizeSortValue ?? null });
      }
    }
    result.sort((a, b) => {
      const aEff = (a.sortVal !== null && a.sortVal > 0) ? a.sortVal : parseSizeLabelForSort(a.label);
      const bEff = (b.sortVal !== null && b.sortVal > 0) ? b.sortVal : parseSizeLabelForSort(b.label);
      return aEff - bEff;
    });
    return result.map(r => r.label);
  }

  async getFieldTypes(params: { categoryId?: number; family?: string }): Promise<{ name: string; count: number }[]> {
    const allItems = await db.select({
      name: items.name,
      detailType: items.detailType,
      subcategory: items.subcategory,
      baseItemName: items.baseItemName,
      categoryId: items.categoryId,
    }).from(items).where(eq(items.isActive, true));

    let filtered = allItems;
    if (params.categoryId) filtered = filtered.filter(i => i.categoryId === params.categoryId);
    if (params.family) {
      filtered = filtered.filter(i =>
        derivedFamily(i.subcategory, i.detailType, i.name || '', i.baseItemName) === params.family
      );
    }

    const counts: Record<string, number> = {};
    for (const i of filtered) {
      const t = derivedType(i.subcategory, i.detailType, i.baseItemName, i.name || '');
      if (t) counts[t] = (counts[t] || 0) + 1;
    }

    const entries = Object.entries(counts).map(([name, count]) => ({ name, count }));

    // Apply CF type ordering for conduit/fittings families
    const cfFamilies = new Set(['EMT', 'Rigid', 'PVC', 'Bushing / Locknut', 'Conduit Body']);
    if (params.family && cfFamilies.has(params.family)) {
      return applyOrder(entries, CF_TYPE_ORDER);
    }

    // Flexible conduit: Metal Flexible before Liquidtight Flexible
    if (params.family === 'Flexible') return applyOrder(entries, CF_FLEXIBLE_TYPE_ORDER);

    // CT Fittings type ordering
    if (params.family === 'Fittings') return applyOrder(entries, CT_FITTINGS_TYPE_ORDER);

    // Cable / Wire type ordering
    if (params.family === 'Multi Conductor') return applyOrder(entries, CW_MULTI_CONDUCTOR_TYPE_ORDER);

    // Apply CS type ordering per family
    if (params.family === 'Conduit Support') return applyOrder(entries, CS_CONDUIT_SUPPORT_TYPE_ORDER);
    if (params.family === 'Strut Channel')   return applyOrder(entries, CS_STRUT_CHANNEL_TYPE_ORDER);
    if (params.family === 'Threaded Rod')    return applyOrder(entries, CS_THREADED_ROD_TYPE_ORDER);

    if (params.categoryId) {
      const catRow = await db.select({ code: categories.code })
        .from(categories).where(eq(categories.id, params.categoryId)).limit(1);
      if (catRow[0]?.code === 'CF') return applyOrder(entries, CF_TYPE_ORDER);
    }

    return entries.sort((a, b) => b.count - a.count);
  }

  async getFieldSubcategories(params: {
    categoryId?: number;
    family?: string;
    type?: string;
  }): Promise<{ name: string; count: number }[]> {
    const allItems = await db.select({
      name: items.name,
      detailType: items.detailType,
      subcategory: items.subcategory,
      subType: items.subType,
      baseItemName: items.baseItemName,
      categoryId: items.categoryId,
    }).from(items).where(eq(items.isActive, true));

    let filtered = allItems;
    if (params.categoryId) filtered = filtered.filter(i => i.categoryId === params.categoryId);
    if (params.family) {
      filtered = filtered.filter(i =>
        derivedFamily(i.subcategory, i.detailType, i.name || '', i.baseItemName) === params.family
      );
    }
    if (params.type) {
      filtered = filtered.filter(i =>
        derivedType(i.subcategory, i.detailType, i.baseItemName, i.name || '') === params.type
      );
    }

    const counts: Record<string, number> = {};
    for (const i of filtered) {
      const sc = i.subType?.trim() || extractSubcategory(i.name || '', i.detailType, i.subcategory, i.baseItemName);
      if (sc) counts[sc] = (counts[sc] || 0) + 1;
    }
    const entries = Object.entries(counts).map(([name, count]) => ({ name, count }));

    // EMT / Rigid: Set Screw before Compression, etc.
    if (params.family === 'EMT' || params.family === 'Rigid') {
      return applyOrder(entries, CF_SUBCAT_ORDER);
    }
    // Flexible conduit subcategories: Conduit → Connector → Coupling
    if (params.type === 'Metal Flexible' || params.type === 'Liquidtight Flexible') {
      return applyOrder(entries, CF_FLEX_SUBCAT_ORDER);
    }
    // CS Conduit Support straps / pipe clamps: EMT → Rigid
    if (
      params.type === 'One Hole Strap' ||
      params.type === 'Two Hole Strap' ||
      params.type === 'Unistrut Pipe Clamp'
    ) {
      return applyOrder(entries, CS_SUPPORT_SUBCAT_ORDER);
    }

    return entries.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getClassificationOptions(categoryId: number): Promise<{ subcategories: string[]; detailTypes: string[]; subTypes: string[] }> {
    const rows = await db
      .select({ subcategory: items.subcategory, detailType: items.detailType, subType: items.subType })
      .from(items)
      .where(and(eq(items.categoryId, categoryId), eq(items.isActive, true)));

    const subcategories = [...new Set(
      rows.map(r => r.subcategory).filter((s): s is string => !!s && s.trim() !== '')
    )].sort();
    const detailTypes = [...new Set(
      rows.map(r => r.detailType).filter((s): s is string => !!s && s.trim() !== '')
    )].sort();
    const subTypes = [...new Set(
      rows.map(r => r.subType).filter((s): s is string => !!s && s.trim() !== '')
    )].sort();

    return { subcategories, detailTypes, subTypes };
  }

  async getFieldItems(params: {
    categoryId?: number;
    family?: string;
    type?: string;
    subcategory?: string;
    size?: string;
    status?: string;
    search?: string;
    page?: number;
    perPage?: number;
  }): Promise<{ items: (ItemWithRelations & { status: string; extractedSubcategory: string; derivedFamilyName: string; derivedTypeName: string })[]; total: number }> {
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

    // Override quantityOnHand with live reel sum for reel-tracked items
    const reelMap = await this.liveReelQtyMap(itemIds);

    let mapped = results.map(row => {
      const firstImage = allImages.find(img => img.itemId === row.item.id);
      const it = row.item as any;
      const famName = derivedFamily(it.subcategory, it.detailType, it.name || '', it.baseItemName);
      const typeName = derivedType(it.subcategory, it.detailType, it.baseItemName, it.name || '');
      const sc = it.subType?.trim() || extractSubcategory(it.name || '', it.detailType, it.subcategory, it.baseItemName);
      const liveQty = reelMap.has(row.item.id) ? reelMap.get(row.item.id)! : row.item.quantityOnHand;
      return {
        ...row.item,
        quantityOnHand: liveQty,
        category: row.category,
        location: row.location,
        supplier: row.supplier,
        imageUrl: firstImage?.imageUrl || null,
        extractedSubcategory: sc,
        derivedFamilyName: famName,
        derivedTypeName: typeName,
      };
    });

    if (params.categoryId) {
      mapped = mapped.filter(i => i.categoryId === params.categoryId);
    }
    if (params.family) {
      mapped = mapped.filter(i => i.derivedFamilyName === params.family);
    }
    if (params.type) {
      mapped = mapped.filter(i => i.derivedTypeName === params.type);
    }
    if (params.subcategory) {
      mapped = mapped.filter(i => i.extractedSubcategory === params.subcategory);
    }
    if (params.size) {
      mapped = mapped.filter(i => (i as any).sizeLabel === params.size);
    }
    if (params.search) {
      const tokens = params.search.toLowerCase().split(/\s+/).filter(t => t.length > 0);
      mapped = mapped.filter(i => {
        const haystack = [
          i.name, i.sku,
          (i as any).sizeLabel || '',
          (i as any).baseItemName || '',
          i.description || '',
          i.category?.name || '',
          i.supplier?.name || '',
        ].join(' ').toLowerCase();
        return tokens.every(token => haystack.includes(token));
      });
    }

    const withStatus = mapped.map(i => {
      let status = "in_stock";
      if ((i as any).statusOverride === "ORDERED") status = "ordered";
      else if (i.quantityOnHand === 0) status = "out_of_stock";
      else if (i.quantityOnHand <= i.minimumStock) status = "low_stock";
      return { ...i, status };
    });

    let statusFiltered = withStatus;
    if (params.status && params.status !== "all") {
      statusFiltered = withStatus.filter(i => i.status === params.status);
    }

    // Sort by sizeSortValue (correct electrical wire order) then by name alphabetically.
    // When sizeSortValue=0 (unset), fall back to parseSizeLabelForSort so that any
    // wire-sized items (AWG, KCMIL, mixed ranges) still sort correctly even if the
    // DB value wasn't precomputed.
    statusFiltered.sort((a, b) => {
      const aDbVal = (a as any).sizeSortValue ?? 0;
      const bDbVal = (b as any).sizeSortValue ?? 0;
      const aEff = aDbVal !== 0 ? aDbVal : parseSizeLabelForSort((a as any).sizeLabel || '');
      const bEff = bDbVal !== 0 ? bDbVal : parseSizeLabelForSort((b as any).sizeLabel || '');
      if (aEff !== bEff) return aEff - bEff;
      return (a.name || '').localeCompare(b.name || '');
    });

    const total = statusFiltered.length;
    const page = Math.max(1, params.page || 1);
    const perPage = Math.min(100, Math.max(1, params.perPage || 10));
    const start = (page - 1) * perPage;
    const pageItems = statusFiltered.slice(start, start + perPage);

    return { items: pageItems, total };
  }

  // ─── Wire Reels ───────────────────────────────────────────────────────────────

  async getDistinctReelBrands(): Promise<string[]> {
    const rows = await db
      .selectDistinct({ brand: wireReels.brand })
      .from(wireReels)
      .where(sql`brand IS NOT NULL AND brand <> ''`)
      .orderBy(asc(wireReels.brand));
    return rows.map(r => r.brand!).filter(Boolean);
  }

  async getNextReelSeq(itemId: number): Promise<number> {
    const allReels = await db.select({ reelId: wireReels.reelId }).from(wireReels).where(eq(wireReels.itemId, itemId));
    let maxNum = 0;
    for (const r of allReels) {
      const match = r.reelId.match(/R(\d+)$/i);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maxNum) maxNum = n;
      }
    }
    return maxNum + 1;
  }

  async getWireReels(itemId: number): Promise<WireReelWithRelations[]> {
    const rows = await db
      .select()
      .from(wireReels)
      .leftJoin(suppliers, eq(wireReels.supplierId, suppliers.id))
      .leftJoin(locations, eq(wireReels.locationId, locations.id))
      .where(and(eq(wireReels.itemId, itemId), eq(wireReels.isActive, true)))
      .orderBy(asc(wireReels.createdAt));
    return rows.map(r => ({
      ...r.wire_reels,
      supplier: r.suppliers ?? null,
      location: r.locations ?? null,
    }));
  }

  private async syncItemQtyFromReels(itemId: number): Promise<void> {
    const result = await db
      .select({ total: sql<number>`coalesce(sum(${wireReels.lengthFt}), 0)` })
      .from(wireReels)
      .where(and(eq(wireReels.itemId, itemId), eq(wireReels.isActive, true)));
    const total = Number(result[0]?.total ?? 0);
    await db.update(items).set({ quantityOnHand: total, updatedAt: new Date() }).where(eq(items.id, itemId));
  }

  async createWireReel(data: CreateWireReelRequest): Promise<WireReel> {
    const [reel] = await db.insert(wireReels).values({ ...data, updatedAt: new Date() }).returning();
    await this.syncItemQtyFromReels(data.itemId);
    return reel;
  }

  async updateWireReel(id: number, data: UpdateWireReelRequest): Promise<WireReel> {
    const [reel] = await db.update(wireReels).set({ ...data, updatedAt: new Date() }).where(eq(wireReels.id, id)).returning();
    if (!reel) throw new Error("Wire reel not found");
    await this.syncItemQtyFromReels(reel.itemId);
    return reel;
  }

  async deleteWireReel(id: number): Promise<void> {
    const [reel] = await db.update(wireReels).set({ isActive: false, updatedAt: new Date() }).where(eq(wireReels.id, id)).returning();
    if (reel) await this.syncItemQtyFromReels(reel.itemId);
  }

  async restoreWireReel(id: number): Promise<WireReel> {
    const [reel] = await db.update(wireReels).set({ isActive: true, updatedAt: new Date() }).where(eq(wireReels.id, id)).returning();
    if (!reel) throw new Error("Wire reel not found");
    await this.syncItemQtyFromReels(reel.itemId);
    return reel;
  }

  // ─── Movement Drafts ─────────────────────────────────────────────────────────

  async getDrafts(): Promise<MovementDraftWithRelations[]> {
    const srcLoc = alias(locations, "src_loc");
    const dstLoc = alias(locations, "dst_loc");
    const rows = await db
      .select()
      .from(movementDrafts)
      .leftJoin(srcLoc, eq(movementDrafts.sourceLocationId, srcLoc.id))
      .leftJoin(dstLoc, eq(movementDrafts.destinationLocationId, dstLoc.id))
      .leftJoin(projects, eq(movementDrafts.projectId, projects.id))
      .where(eq(movementDrafts.status, "draft"))
      .orderBy(desc(movementDrafts.savedAt));
    return rows.map(r => ({
      ...r.movement_drafts,
      sourceLocation: (r as any).src_loc ?? null,
      destinationLocation: (r as any).dst_loc ?? null,
      project: r.projects ?? null,
    }));
  }

  async getDraft(id: number): Promise<MovementDraftWithRelations | undefined> {
    const srcLoc = alias(locations, "src_loc");
    const dstLoc = alias(locations, "dst_loc");
    const rows = await db
      .select()
      .from(movementDrafts)
      .leftJoin(srcLoc, eq(movementDrafts.sourceLocationId, srcLoc.id))
      .leftJoin(dstLoc, eq(movementDrafts.destinationLocationId, dstLoc.id))
      .leftJoin(projects, eq(movementDrafts.projectId, projects.id))
      .where(eq(movementDrafts.id, id))
      .limit(1);
    if (!rows[0]) return undefined;
    const r = rows[0];
    return {
      ...r.movement_drafts,
      sourceLocation: (r as any).src_loc ?? null,
      destinationLocation: (r as any).dst_loc ?? null,
      project: r.projects ?? null,
    };
  }

  async createDraft(data: { movementType: string; sourceLocationId?: number | null; destinationLocationId?: number | null; projectId?: number | null; itemsJson: string; note?: string | null; savedBy?: string | null; savedByName?: string | null }): Promise<MovementDraft> {
    const [draft] = await db.insert(movementDrafts).values({ ...data, status: "draft", savedAt: new Date() }).returning();
    return draft;
  }

  async deleteDraft(id: number): Promise<void> {
    await db.delete(movementDrafts).where(eq(movementDrafts.id, id));
  }

  async confirmDraft(id: number, performedBy: string | null): Promise<void> {
    const draft = await this.getDraft(id);
    if (!draft) throw new Error("Draft not found");

    const draftItems: Array<{ itemId: number; qty: number; reelSelections?: Record<string, number> }> = JSON.parse(draft.itemsJson || "[]");

    for (const di of draftItems) {
      const item = await this.getItem(di.itemId);
      if (!item) continue;

      const qty = di.qty;
      const movementType = draft.movementType;
      let newQty = item.quantityOnHand;

      if (movementType === "receive" || movementType === "return") newQty += qty;
      else if (movementType === "issue") newQty = Math.max(0, newQty - qty);
      else if (movementType === "adjust") newQty = qty;

      await this.createInventoryMovement({
        itemId: item.id,
        movementType,
        quantity: qty,
        previousQuantity: item.quantityOnHand,
        newQuantity: newQty,
        sourceLocationId: draft.sourceLocationId ?? null,
        destinationLocationId: draft.destinationLocationId ?? null,
        projectId: draft.projectId ?? null,
        unitCostSnapshot: item.unitCost,
        note: draft.note ?? null,
        reason: null,
        referenceType: "draft",
        referenceId: String(id),
        createdBy: performedBy,
      });

      if (di.reelSelections) {
        for (const [reelIdStr, ftUsed] of Object.entries(di.reelSelections)) {
          if (!ftUsed) continue;
          const reelId = Number(reelIdStr);
          const [reelRow] = await db.select().from(wireReels).where(eq(wireReels.id, reelId)).limit(1);
          if (!reelRow) continue;
          const newLength = reelRow.lengthFt - ftUsed;
          if (newLength <= 0) {
            await this.deleteWireReel(reelId);
          } else {
            await this.updateWireReel(reelId, { lengthFt: newLength, status: "used" });
          }
        }
      }
    }

    await db.delete(movementDrafts).where(eq(movementDrafts.id, id));
  }

  // ─── Daily Reports ───────────────────────────────────────────────────────────

  async getDailyReports(projectId: number): Promise<DailyReport[]> {
    return db
      .select()
      .from(dailyReports)
      .where(eq(dailyReports.projectId, projectId))
      .orderBy(desc(dailyReports.updatedAt));
  }

  async getDailyReportSummary(): Promise<{ projectId: number; total: number; draft: number; submitted: number; lastDate: string | null }[]> {
    const rows = await db
      .select({
        projectId: dailyReports.projectId,
        total:     sql<number>`count(*)::int`,
        draft:     sql<number>`count(*) filter (where status = 'draft')::int`,
        submitted: sql<number>`count(*) filter (where status = 'submitted')::int`,
        lastDate:  sql<string | null>`max(report_date)`,
      })
      .from(dailyReports)
      .groupBy(dailyReports.projectId);
    return rows;
  }

  async getDailyReport(id: number): Promise<DailyReport | undefined> {
    const [row] = await db.select().from(dailyReports).where(eq(dailyReports.id, id));
    return row;
  }

  async createDailyReport(data: CreateDailyReportRequest): Promise<DailyReport> {
    const [row] = await db.insert(dailyReports).values(data).returning();
    return row;
  }

  async updateDailyReport(id: number, data: UpdateDailyReportRequest): Promise<DailyReport> {
    const [row] = await db
      .update(dailyReports)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(dailyReports.id, id))
      .returning();
    if (!row) throw new Error("Daily report not found");
    return row;
  }

  async deleteDailyReport(id: number): Promise<void> {
    await db.delete(dailyReports).where(eq(dailyReports.id, id));
  }

  // ─── Workers ─────────────────────────────────────────────────────────────────

  async getWorkers(): Promise<Worker[]> {
    return await db.select().from(workers).orderBy(asc(workers.fullName));
  }

  async getWorker(id: number): Promise<Worker | undefined> {
    const [row] = await db.select().from(workers).where(eq(workers.id, id));
    return row;
  }

  async createWorker(data: CreateWorkerRequest): Promise<Worker> {
    const [row] = await db.insert(workers).values(data).returning();
    return row;
  }

  async updateWorker(id: number, data: UpdateWorkerRequest): Promise<Worker> {
    const [row] = await db
      .update(workers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(workers.id, id))
      .returning();
    if (!row) throw new Error("Worker not found");
    return row;
  }

  async deleteWorker(id: number): Promise<void> {
    await db.delete(workers).where(eq(workers.id, id));
  }

  async getWorkerAttendance(workerId: number): Promise<WorkerAttendance[]> {
    return await db
      .select()
      .from(workerAttendance)
      .where(eq(workerAttendance.workerId, workerId))
      .orderBy(desc(workerAttendance.date));
  }

  async createWorkerAttendance(data: CreateWorkerAttendanceRequest): Promise<WorkerAttendance> {
    const [row] = await db.insert(workerAttendance).values(data).returning();
    return row;
  }

  async deleteWorkerAttendance(id: number): Promise<void> {
    await db.delete(workerAttendance).where(eq(workerAttendance.id, id));
  }

  async getWorkerEvaluations(workerId: number): Promise<WorkerEvaluation[]> {
    return await db
      .select()
      .from(workerEvaluations)
      .where(eq(workerEvaluations.workerId, workerId))
      .orderBy(desc(workerEvaluations.evaluationDate));
  }

  async createWorkerEvaluation(data: CreateWorkerEvaluationRequest): Promise<WorkerEvaluation> {
    const [row] = await db.insert(workerEvaluations).values(data).returning();
    return row;
  }

  // ─── Project Scope Items ────────────────────────────────────────────────────

  async getScopeItems(projectId: number): Promise<ProjectScopeItem[]> {
    return await db
      .select()
      .from(projectScopeItems)
      .where(eq(projectScopeItems.projectId, projectId))
      .orderBy(asc(projectScopeItems.id));
  }

  async getScopeItem(id: number): Promise<ProjectScopeItem | undefined> {
    const [row] = await db.select().from(projectScopeItems).where(eq(projectScopeItems.id, id));
    return row;
  }

  async createScopeItem(data: CreateProjectScopeItemRequest): Promise<ProjectScopeItem> {
    const [row] = await db.insert(projectScopeItems).values(data).returning();
    return row;
  }

  async updateScopeItem(id: number, data: UpdateProjectScopeItemRequest): Promise<ProjectScopeItem> {
    const [row] = await db
      .update(projectScopeItems)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(projectScopeItems.id, id))
      .returning();
    return row;
  }

  async deleteScopeItem(id: number): Promise<void> {
    await db.delete(projectScopeItems).where(eq(projectScopeItems.id, id));
  }

  async getProjectProgress(projectId: number): Promise<{
    scopeItems: ProjectScopeItem[];
    progress: Record<number, { cumulative: number; remaining: number; pct: number; todayAdded: number; completedBeforeToday: number }>;
    drillDown: Record<number, { reportId: number; reportNumber: string | null; reportDate: string; preparedBy: string | null; qty: number; runningTotal: number }[]>;
    summary: { overallPct: number; estTotal: number; installed: number; remaining: number; todayAdded: number };
  }> {
    const scopes = await this.getScopeItems(projectId);
    const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD in UTC

    const submittedReports = await db
      .select()
      .from(dailyReports)
      .where(and(eq(dailyReports.projectId, projectId), eq(dailyReports.status, "submitted")))
      .orderBy(asc(dailyReports.reportDate), asc(dailyReports.createdAt));

    // Build per-scope drillDown entries (sorted chronologically)
    const rawEntries: Record<number, { reportId: number; reportNumber: string | null; reportDate: string; preparedBy: string | null; qty: number }[]> = {};
    for (const report of submittedReports) {
      const fd = report.formData as any;
      const materials: any[] = fd?.materials ?? [];
      const reportDate = report.reportDate ?? (report.createdAt ? new Date(report.createdAt).toISOString().slice(0, 10) : "");
      const preparedBy = fd?.preparedBy ?? report.preparedBy ?? null;
      for (const mat of materials) {
        const sid = mat.scopeItemId;
        const qty = typeof mat.qty === "number" ? mat.qty : parseFloat(mat.qty ?? "0") || 0;
        if (sid && qty > 0) {
          if (!rawEntries[sid]) rawEntries[sid] = [];
          rawEntries[sid].push({ reportId: report.id, reportNumber: report.reportNumber, reportDate, preparedBy, qty });
        }
      }
    }

    // Build drillDown with running totals
    const drillDown: Record<number, { reportId: number; reportNumber: string | null; reportDate: string; preparedBy: string | null; qty: number; runningTotal: number }[]> = {};
    for (const [sidStr, entries] of Object.entries(rawEntries)) {
      const sid = Number(sidStr);
      let running = 0;
      drillDown[sid] = entries.map(e => {
        running += e.qty;
        return { ...e, runningTotal: running };
      });
    }

    const actuals: Record<number, number> = {};
    const todayAddedByScope: Record<number, number> = {};
    for (const [sidStr, entries] of Object.entries(drillDown)) {
      const sid = Number(sidStr);
      actuals[sid] = entries[entries.length - 1]?.runningTotal ?? 0;
      todayAddedByScope[sid] = entries
        .filter(e => e.reportDate === todayStr)
        .reduce((s, e) => s + e.qty, 0);
    }

    let estTotal = 0;
    let installed = 0;
    let totalTodayAdded = 0;
    const progress: Record<number, { cumulative: number; remaining: number; pct: number; todayAdded: number; completedBeforeToday: number }> = {};

    for (const scope of scopes) {
      const estQty = parseFloat(String(scope.estimatedQty)) || 0;
      const cumulative = actuals[scope.id] ?? 0;
      const todayAdded = todayAddedByScope[scope.id] ?? 0;
      const completedBeforeToday = Math.max(0, cumulative - todayAdded);
      const remaining = Math.max(0, estQty - cumulative);
      const pct = estQty > 0 ? Math.min(100, Math.round((cumulative / estQty) * 1000) / 10) : 0;
      progress[scope.id] = { cumulative, remaining, pct, todayAdded, completedBeforeToday };
      estTotal += estQty;
      installed += cumulative;
      totalTodayAdded += todayAdded;
    }

    const overallPct = estTotal > 0 ? Math.min(100, Math.round((installed / estTotal) * 1000) / 10) : 0;
    const remaining = Math.max(0, estTotal - installed);

    return { scopeItems: scopes, progress, drillDown, summary: { overallPct, estTotal, installed, remaining, todayAdded: totalTodayAdded } };
  }

  // ─── Equipment ───────────────────────────────────────────────────────────────

  async getEquipment(): Promise<EquipmentWithProject[]> {
    const rows = await db
      .select()
      .from(equipment)
      .leftJoin(projects, eq(equipment.assignedProjectId, projects.id))
      .where(eq(equipment.isActive, true))
      .orderBy(asc(equipment.equipNo));

    return rows.map((r) => ({
      ...r.equipment,
      project: r.projects ?? null,
    }));
  }

  async getEquipmentItem(id: number): Promise<EquipmentWithProject | undefined> {
    const [r] = await db
      .select()
      .from(equipment)
      .leftJoin(projects, eq(equipment.assignedProjectId, projects.id))
      .where(eq(equipment.id, id));

    if (!r) return undefined;
    return { ...r.equipment, project: r.projects ?? null };
  }

  async createEquipment(data: CreateEquipmentRequest): Promise<Equipment> {
    const [row] = await db.insert(equipment).values(data).returning();
    return row;
  }

  async updateEquipment(id: number, data: UpdateEquipmentRequest): Promise<Equipment> {
    const [row] = await db
      .update(equipment)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(equipment.id, id))
      .returning();
    return row;
  }

  async deleteEquipment(id: number): Promise<void> {
    await db.update(equipment).set({ isActive: false, updatedAt: new Date() }).where(eq(equipment.id, id));
  }

  async getMaterialRequests(submittedBy?: string): Promise<MaterialRequest[]> {
    const q = db.select().from(materialRequests);
    if (submittedBy) {
      return q.where(eq(materialRequests.submittedBy, submittedBy)).orderBy(desc(materialRequests.submittedAt));
    }
    return q.orderBy(desc(materialRequests.submittedAt));
  }

  async getMaterialRequest(id: number): Promise<MaterialRequest | undefined> {
    const [row] = await db.select().from(materialRequests).where(eq(materialRequests.id, id));
    return row;
  }

  async createMaterialRequest(data: { requestNumber: string; itemsJson: string; requestType?: string; submittedBy?: string; submittedByName?: string; notes?: string | null; projectId?: number | null; requesterName?: string | null; requesterRole?: string | null }): Promise<MaterialRequest> {
    const [created] = await db.insert(materialRequests).values(data).returning();
    return created;
  }

  async updateMaterialRequest(id: number, data: Partial<{ itemsJson: string; notes: string | null; projectId: number | null; requesterName: string | null; requesterRole: string | null; requestType: string }>): Promise<MaterialRequest | undefined> {
    const [updated] = await db.update(materialRequests)
      .set(data)
      .where(eq(materialRequests.id, id))
      .returning();
    return updated;
  }

  async updateMaterialRequestStatus(id: number, status: string): Promise<MaterialRequest> {
    const [updated] = await db.update(materialRequests)
      .set({ status })
      .where(eq(materialRequests.id, id))
      .returning();
    return updated;
  }

  async fulfillMaterialRequest(id: number, movementId: number): Promise<MaterialRequest> {
    const [updated] = await db.update(materialRequests)
      .set({ status: "completed", fulfilledMovementId: movementId })
      .where(eq(materialRequests.id, id))
      .returning();
    return updated;
  }

  async deleteMaterialRequest(id: number): Promise<void> {
    await db.delete(materialRequests).where(eq(materialRequests.id, id));
  }
}

// ─── Field data extraction helpers ───────────────────────────────────────────
//
// Category-specific family ordering constants.
// Items that exist in the data are shown in this order; missing ones are skipped.
//
const CT_FAMILY_ORDER = ['Cable Tray', 'Fittings', 'Covers'];
const CT_FITTINGS_TYPE_ORDER = ['Reducer', 'Tee', 'Cross', 'Horizontal Elbow', 'Vertical Elbow', 'Connector'];
const CF_FAMILY_ORDER = ['EMT', 'Rigid', 'Flexible', 'PVC', 'Bushing / Locknut', 'Conduit Body'];
const CF_TYPE_ORDER = ['Conduit', 'Coupling', 'Connector', 'Elbow'];
const CF_FLEXIBLE_TYPE_ORDER = ['Metal Flexible', 'Liquidtight Flexible'];
const CF_SUBCAT_ORDER = ['Set Screw', 'Compression', 'Rain Tight', 'Threaded', '90°', 'Straight', 'Standard'];

// Conduit Supports & Strut System (CS) ordering
const CS_FAMILY_ORDER = ['Conduit Support', 'Hardware/Accessories', 'Strut Channel', 'Threaded Rod', 'Beam Clamp'];
const CS_CONDUIT_SUPPORT_TYPE_ORDER = ['Conduit Clamp', 'Unistrut Pipe Clamp', 'One Hole Strap', 'Two Hole Strap'];
const CS_STRUT_CHANNEL_TYPE_ORDER = ['Unistrut', 'Column Support', 'Post Base', 'Corner Angle', 'Joiner'];
const CS_THREADED_ROD_TYPE_ORDER = ['Threaded Rod', 'Rod Coupling'];
const CS_SUPPORT_SUBCAT_ORDER = ['EMT', 'Rigid'];
const CF_FLEX_SUBCAT_ORDER = ['Conduit', 'Connector', 'Coupling'];

// Cable/Wire (CW) ordering
const CW_MULTI_CONDUCTOR_TYPE_ORDER = ['2C+G', '3C+G', '4C+G'];

// ── Cable size sort helper ───────────────────────────────────────────────────
// U.S. electrical wire size ascending order (smallest → largest conductor):
// #14 → #12 → #10 → #8 → #6 → #4 → #3 → #2 → #1 → 1/0 → 2/0 → 3/0 → 4/0
// → 250 KCMIL → 300 KCMIL → 350 KCMIL → 400 KCMIL → 500 KCMIL → 600 KCMIL → 750 KCMIL → 1000 KCMIL
const CABLE_SIZE_ORDER = ['14','12','10','8','6','4','3','2','1','1/0','2/0','3/0','4/0','250','300','350','400','500','600','750','1000'];

// Maps each AWG/KCMIL size label to its canonical sort value (100-step spacing).
// Matches what is stored in DB size_sort_value for category_id=4 items.
const WIRE_SORT_MAP: Record<string, number> = {
  '#14': 100, '#12': 200, '#10': 300,
  '#8': 400, '#6': 500, '#4': 600, '#3': 700, '#2': 800, '#1': 900,
  '1/0': 1000, '2/0': 1100, '3/0': 1200, '4/0': 1300,
  '250 KCMIL': 1400, '300 KCMIL': 1500, '350 KCMIL': 1600, '400 KCMIL': 1700,
  '500 KCMIL': 1800, '600 KCMIL': 1900, '750 KCMIL': 2000, '1000 KCMIL': 2100,
};

function parseSizeLabelForSort(label: string): number {
  if (!label) return 999999;
  const s = label.trim();

  // Direct lookup (exact known wire size like "#12", "1/0", "250 KCMIL")
  if (WIRE_SORT_MAP[s] !== undefined) return WIRE_SORT_MAP[s];

  // ── Mixed wire range patterns (sort by primary / largest conductor) ──────

  // Pattern: N/0-M  or  N/0-MAWG  (e.g. "1/0-14AWG", "2/0-14AWG", "4/0-14")
  const slashORange = s.match(/^(\d+\/0)-/);
  if (slashORange) {
    const v = WIRE_SORT_MAP[slashORange[1]];
    if (v !== undefined) return v;
  }

  // Pattern: NNNMCM-MAWG  (e.g. "250MCM-6AWG", "500MCM-4AWG", "600MCM-2AWG")
  const mcmRange = s.match(/^(\d+)MCM-/i);
  if (mcmRange) {
    const key = `${mcmRange[1]} KCMIL`;
    if (WIRE_SORT_MAP[key] !== undefined) return WIRE_SORT_MAP[key];
    // Extrapolate for sizes outside the map (e.g. 800 MCM)
    return 2000 + (parseInt(mcmRange[1]) - 750) / 5;
  }

  // Pattern: N-MMMKCMIL or N-MMMCM (e.g. "1000-500MCM", "800-300MCM")
  const kcmilSuffix = s.match(/^(\d+)-\d+(MCM|KCMIL)/i);
  if (kcmilSuffix) {
    const key = `${kcmilSuffix[1]} KCMIL`;
    if (WIRE_SORT_MAP[key] !== undefined) return WIRE_SORT_MAP[key];
    return 2000 + (parseInt(kcmilSuffix[1]) - 750) / 5;
  }

  // Pattern: N-MAWG  or  N-M  where N is AWG gauge (e.g. "2-14AWG", "4-14AWG", "2-14")
  // Primary conductor = first number (#N)
  const awgRange = s.match(/^(\d+)-(\d+)(AWG)?$/i);
  if (awgRange) {
    const first = parseInt(awgRange[1]);
    if (first >= 200) {
      // Large first number → KCMIL range like "250-6"
      const key = `${first} KCMIL`;
      if (WIRE_SORT_MAP[key] !== undefined) return WIRE_SORT_MAP[key];
      return 2000 + (first - 750) / 5;
    }
    // Small first number → AWG gauge like "2-14" (primary is #2)
    const v = WIRE_SORT_MAP[`#${first}`];
    if (v !== undefined) return v;
  }

  // ── Simple wire size patterns ─────────────────────────────────────────────

  // Starts with # (AWG gauge), contains KCMIL, or plain N/0
  if (s.startsWith('#') || /kcmil/i.test(s) || /^\d+\/0$/.test(s)) {
    const core = s.replace(/^#/, '').replace(/\s*kcmil\s*/i, '').trim();
    const idx = CABLE_SIZE_ORDER.indexOf(core);
    return idx >= 0 ? (idx + 1) * 100 : 9999;
  }

  // ── Conduit / inch-based size ─────────────────────────────────────────────
  const clean = s.replace(/['"]/g, '').trim();
  // compound fraction: 1-1/4, 1-1/2
  const compound = clean.match(/^(\d+)[-\s](\d+)\/(\d+)$/);
  if (compound) return (+compound[1] + +compound[2] / +compound[3]) * 1000;
  // simple fraction: 1/2, 3/4
  const frac = clean.match(/^(\d+)\/(\d+)$/);
  if (frac) return (+frac[1] / +frac[2]) * 1000;
  // plain number
  const num = parseFloat(clean);
  if (!isNaN(num)) return num * 1000;
  return 999999;
}

// Applies a predefined sort order to a list of { name, count } entries.
// Items not in the order list are appended alphabetically at the end.
function applyOrder(entries: { name: string; count: number }[], order: string[]): { name: string; count: number }[] {
  const ordered = order
    .map(n => entries.find(e => e.name === n))
    .filter((e): e is { name: string; count: number } => e !== undefined);
  const rest = entries
    .filter(e => !order.includes(e.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  return [...ordered, ...rest];
}

// ── derivedFamily ─────────────────────────────────────────────────────────────
// Maps DB subcategory + detailType + name → display family name.
//
// Cable Tray (CT):
//   sub="Tray"       → "Cable Tray"
//   sub="Connectors" → "Fittings"   (merged into Fittings)
//   sub="Fittings"   → "Fittings"
//   sub="Covers"     → "Covers"
//
// Conduit/Fittings (CF):
//   sub="EMT Conduit"              → "EMT"
//   sub="RMC/IMC Conduit"          → "Rigid"
//   sub="PVC Conduit"              → "PVC"
//   sub="Flex Conduit"             → "Flexible"
//   sub="Conduit Bodies"           → "Conduit Body"
//   sub="Supports" or Strap items  → "Supports"
//   sub="Fittings", dt="EMT"       → "EMT"
//   sub="Fittings", dt="Rigid"     → "Rigid"
//   sub="Fittings", dt="PVC"       → "PVC"
//   sub="Fittings", dt="Flexible"  → "Flexible"
//   sub="Fittings", dt="General"   → "Bushing / Locknut"
export function derivedFamily(
  subcategory: string | null | undefined,
  detailType: string | null | undefined,
  name: string,
  baseItemName?: string | null
): string {
  const sub = subcategory || '';
  const dt = detailType || '';
  const n = name || '';
  const base = baseItemName || n;

  // ── Cable Tray ──
  if (sub === 'Tray') return 'Cable Tray';
  if (sub === 'Connectors') return 'Fittings';
  if (sub === 'Covers') return 'Covers';

  // ── Conduit / Fittings ──
  if (sub === 'EMT Conduit') return 'EMT';
  if (sub === 'RMC/IMC Conduit') return 'Rigid';
  if (sub === 'PVC Conduit') return 'PVC';
  if (sub === 'Flex Conduit') return 'Flexible';
  if (sub === 'Conduit Bodies') return 'Conduit Body';
  if (sub === 'Supports') return 'Supports';

  // ── Cable / Wire ──
  if (sub === 'THHN/THWN Single') return 'Single Conductor';

  // Unclassified strap items (no subcategory in DB)
  if (!sub && /\bStrap\b/i.test(base)) return 'Supports';

  if (sub === 'Fittings') {
    if (dt === 'General') return 'Bushing / Locknut';
    if (dt === 'EMT' || (/\bEMT\b/i.test(n) && dt !== 'Rigid' && dt !== 'PVC')) return 'EMT';
    if (dt === 'Rigid' || /\bRigid\b/i.test(n)) return 'Rigid';
    if (dt === 'PVC' || /\bPVC\b/i.test(n)) return 'PVC';
    if (dt === 'Flex' || /\bFlex\b|\bLiquidtight\b/i.test(n)) return 'Flexible';
    return 'Fittings';
  }

  return sub;
}

// ── derivedType ───────────────────────────────────────────────────────────────
// Maps DB fields → product type string.
//
// Conduit family subcategories → detailType (Conduit, Elbow, Connector…)
// Fittings subcategory → parse base_item_name
// Supports → One Hole Strap / Two Hole Strap from base_item_name
// CT Fittings → detailType (Reducer, Tee, Cross…)
export function derivedType(
  subcategory: string | null | undefined,
  detailType: string | null | undefined,
  baseItemName: string | null | undefined,
  name: string
): string {
  const sub = subcategory || '';
  const dt = detailType || '';
  const base = baseItemName || name || '';

  if (['EMT Conduit', 'RMC/IMC Conduit', 'PVC Conduit'].includes(sub)) {
    return dt || 'Conduit';
  }
  if (sub === 'Flex Conduit') {
    if (/Liquidtight/i.test(base)) return 'Liquidtight Flexible';
    return 'Metal Flexible';
  }
  // After migration subcategory is stored as the derived family name ("Flexible").
  // detailType already holds the correct type: "Metal Flexible" or "Liquidtight Flexible".
  if (sub === 'Flexible') return dt || 'Metal Flexible';

  // ── Cable / Wire ──
  if (sub === 'Multi Conductor') {
    const coreMatch = base.match(/\((\d+C\+G)\)/i) || base.match(/(\d+C\+G)/i);
    if (coreMatch) return coreMatch[1].toUpperCase();
    return dt || 'Multi Conductor';
  }
  if (sub === 'Conduit Bodies') return 'Conduit Body';

  // Supports / Straps (legacy CF): subdivide by One Hole vs Two Hole
  if (sub === 'Supports' || (!sub && /\bStrap\b/i.test(base))) {
    if (/One.Hole/i.test(base)) return 'One Hole Strap';
    if (/Two.Hole/i.test(base)) return 'Two Hole Strap';
    return 'Strap';
  }

  // ── Conduit Supports & Strut System (CS) ─────────────────────────────────
  // These subcategory values are unique to CS — handle before generic fallbacks
  // to prevent "Rod Coupling" from matching /Coupling/ etc.
  if (sub === 'Conduit Support') {
    if (/One.Hole/i.test(base)) return 'One Hole Strap';
    if (/Two.Hole/i.test(base)) return 'Two Hole Strap';
    return dt || 'Conduit Support';
  }
  if (sub === 'Strut Channel') return dt || 'Unistrut';
  if (sub === 'Threaded Rod')   return dt || 'Threaded Rod';
  if (sub === 'Beam Clamp')     return 'Beam Clamp';
  if (sub === 'Hardware/Accessories') return dt || base;

  // CT Fittings: Elbow → Horizontal Elbow, Vertical → Vertical Elbow
  if (sub === 'Fittings' && dt === 'Elbow') return 'Horizontal Elbow';
  if (dt === 'Vertical') return 'Vertical Elbow';

  if (/\bConnector\b/i.test(base)) return 'Connector';
  if (/\bCoupling\b/i.test(base)) return 'Coupling';
  if (/\bElbow\b/i.test(base)) return 'Elbow';
  if (/\bBushing\b/i.test(base)) return 'Bushing';
  if (/\bLocknut\b/i.test(base)) return 'Locknut';
  if (/\bNipple\b/i.test(base)) return 'Nipple';
  if (/\bStrap\b|\bClamp\b/i.test(base)) return 'Strap';

  return dt || 'Other';
}

// ── extractSubcategory ────────────────────────────────────────────────────────
// Derives the subcategory string from item name + derived type context.
//
//   Connector  → Compression | Set Screw | Rain Tight | Threaded | 90° | Straight | Standard
//   Coupling   → Compression | Set Screw | Rain Tight | Threaded | Standard
//   Elbow/Tee  → Horizontal | Vertical
//   Conduit Body → LB | C | T | X | etc.
//   Bushing    → Ground | Plastic | Standard
//   Cable Tray → uppercase suffix code (RC, RL, RR…) | In | Out
export function extractSubcategory(
  name: string,
  detailType: string | null | undefined,
  subcategory?: string | null,
  baseItemName?: string | null
): string {
  if (!name) return '';
  const type = derivedType(subcategory || null, detailType || null, baseItemName || null, name);

  // ── CS Strut Channel subtypes ──────────────────────────────────────────────
  if (type === 'Unistrut') {
    if (/\bSlotted\b/i.test(name)) return 'Slotted';
    if (/\bSolid\b/i.test(name)) return 'Solid Strut';
    return '';
  }
  if (type === 'Corner Angle') {
    if (/\b2\s*Hole\b/i.test(name)) return '2 Hole';
    if (/\b4\s*Hole\b/i.test(name)) return '4 Hole';
    return '';
  }
  if (type === 'Joiner') {
    if (/\bElbow\b/i.test(name)) return 'Elbow';
    if (/\bTee\b/i.test(name)) return 'Tee';
    if (/\bStraight\b/i.test(name)) return 'Straight';
    return '';
  }

  // ── CS Conduit Support: EMT vs Rigid for straps & pipe clamps ──────────────
  if (type === 'One Hole Strap' || type === 'Two Hole Strap' || type === 'Unistrut Pipe Clamp') {
    const b = baseItemName || name;
    if (/\bEMT\b/i.test(b)) return 'EMT';
    if (/\bRigid\b/i.test(b)) return 'Rigid';
    return '';
  }

  // ── Flexible Conduit: Conduit / Connector / Coupling subcategory ───────────
  if (type === 'Metal Flexible' || type === 'Liquidtight Flexible') {
    if (/\bConnector\b/i.test(name)) return 'Connector';
    if (/\bCoupling\b/i.test(name)) return 'Coupling';
    return 'Conduit';
  }

  if (type === 'Connector') {
    if (/\bCompression\b/i.test(name)) return 'Compression';
    if (/\bSet\s*Screw\b/i.test(name)) return 'Set Screw';
    if (/\bRain\s*Tight\b/i.test(name)) return 'Rain Tight';
    if (/\bThreaded\b/i.test(name)) return 'Threaded';
    if (/\b90[°º]?\b/.test(name) || /\b90\s*deg/i.test(name)) return '90°';
    if (/\bStraight\b/i.test(name)) return 'Straight';
    return 'Standard';
  }

  if (type === 'Coupling') {
    if (/\bCompression\b/i.test(name)) return 'Compression';
    if (/\bSet\s*Screw\b/i.test(name)) return 'Set Screw';
    if (/\bRain\s*Tight\b/i.test(name)) return 'Rain Tight';
    if (/\bThreaded\b/i.test(name)) return 'Threaded';
    return 'Standard';
  }

  if (type === 'Elbow' || detailType === 'Tee') {
    if (/\bHorizontal\b/i.test(name)) return 'Horizontal';
    if (/\bVertical\b/i.test(name)) return 'Vertical';
    if (detailType === 'Tee') return 'Horizontal';
    return '';
  }

  if (type === 'Conduit Body') {
    const bodyCode = name.match(/\b(LB|LL|LR|TB|CB|T|C|X)\b/);
    if (bodyCode) return bodyCode[1];
    return '';
  }

  if (type === 'Bushing') {
    if (/\bGround\b/i.test(name)) return 'Ground';
    if (/\bPlastic\b/i.test(name)) return 'Plastic';
    return 'Standard';
  }

  // Cable Tray: trailing uppercase code (RC, RL, RR…)
  const shortCode = name.match(/\s([A-Z]{2,3})$/);
  if (shortCode) return shortCode[1];

  // Cable Tray covers: In / Out
  const inOut = name.match(/\s(In|Out)$/i);
  if (inOut) return inOut[1].charAt(0).toUpperCase() + inOut[1].slice(1).toLowerCase();

  return '';
}

export const storage = new DatabaseStorage();
