import { db } from "./db";
import { eq, desc, asc, like, and, or, sql, lt, lte, gte, inArray, isNull, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { users } from "@shared/models/auth";
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
  rmsExportHistory, rmsExportHistoryItems,
  type RmsExportHistory, type RmsExportHistoryItem, type RmsExportHistoryWithLines,
  type CreateRmsExportHistory, type CreateRmsExportHistoryItem,
  wireReelMovementLines,
} from "@shared/schema";

// ── Reel ID Cleanup types ──────────────────────────────────────────────────
export type ReelIdPreviewRow = {
  reelDbId: number;
  currentReelId: string;
  proposedReelId: string;
  itemId: number;
  itemName: string;
  sizeLabel: string | null;
  coreCode: "MC" | "SC";
  sizeCode: string;
  configCode: string;
  sequence: number | null;
  status: "ready" | "already_new_format" | "ambiguous" | "conflict" | "invalid_sequence" | "missing_item";
  reason: string;
};

export interface IStorage {
  getCategories(): Promise<Category[]>;
  createCategory(category: CreateCategoryRequest): Promise<Category>;

  getLocations(): Promise<Location[]>;
  createLocation(location: CreateLocationRequest): Promise<Location>;
  deleteLocation(id: number): Promise<void>;
  restoreLocation(id: number): Promise<void>;
  linkLocationToSupplier(locationId: number, supplierId: number): Promise<Location>;
  unlinkLocationFromSupplier(locationId: number): Promise<Location>;

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
    usagePattern?: "core" | "normal" | "low" | "none";
    sort?: "name" | "sku" | "quantityOnHand" | "status";
    dir?: "asc" | "desc";
    page?: number;
    perPage?: number;
  }): Promise<{ items: ItemWithRelations[]; total: number }>;
  getItem(id: number): Promise<ItemWithRelations | undefined>;
  createItem(item: CreateItemRequest): Promise<Item>;
  createItemImage(itemId: number, imageUrl: string): Promise<void>;
  setItemImage(itemId: number, imageUrl: string | null): Promise<void>;
  getItemImages(itemId: number): Promise<ItemImage[]>;
  appendItemImage(itemId: number, imageUrl: string, altText?: string | null): Promise<ItemImage[]>;
  deleteItemImage(itemId: number, imageId: number): Promise<ItemImage[]>;
  setItemImagePrimary(itemId: number, imageId: number): Promise<ItemImage[]>;
  reorderItemImages(itemId: number, imageIds: number[]): Promise<ItemImage[]>;
  updateItem(id: number, item: UpdateItemRequest): Promise<Item>;
  deleteItem(id: number): Promise<void>;
  restoreItems(ids: number[]): Promise<void>;
  upsertItemGroup(categoryId: number, baseItemName: string, manufacturerName: string | null, data: { imageUrl?: string | null }): Promise<ItemGroup>;
  updateFamilyGroupOrder(categoryId: number, orders: { baseItemName: string; manufacturerName: string | null; sortOrder: number }[]): Promise<void>;
  renameFamily(categoryId: number, oldName: string, newName: string, manufacturerName?: string | null): Promise<void>;
  moveFamilyItems(itemIds: number[], newBaseItemName: string): Promise<void>;
  bulkSoftDeleteItems(itemIds: number[]): Promise<void>;

  getInventoryMovements(filters?: { itemId?: number; projectId?: number; movementType?: string; locationId?: number }): Promise<InventoryMovementWithRelations[]>;
  createInventoryMovement(movement: CreateInventoryMovementRequest & { previousQuantity: number; newQuantity: number; createdBy?: string | null }, txClient?: any): Promise<InventoryMovement>;
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
  bulkRestoreMovements(snapshots: any[]): Promise<{ restored: number[]; errors: { id: number; message: string }[] }>;
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
  getWireReelsByItemIds(itemIds: number[]): Promise<Map<number, string[]>>;
  getWireReelExportData(itemIds: number[]): Promise<Map<number, Array<{ reelId: string; lengthFt: number }>>>;
  getItemGroupImages(): Promise<Map<string, string>>;
  getItemGroupSortOrders(): Promise<Map<string, number>>;
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
  confirmDraft(id: number, performedBy: string | null): Promise<number[]>;

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
  getMovementsByReference(referenceType: string, referenceId: string): Promise<InventoryMovement[]>;
  undoMaterialRequestCompletion(id: number): Promise<MaterialRequest>;

  createRmsExportHistory(header: CreateRmsExportHistory, lines: Omit<CreateRmsExportHistoryItem, "historyId">[]): Promise<RmsExportHistory>;
  listRmsExportHistory(limit?: number): Promise<RmsExportHistory[]>;
  getRmsExportHistoryDetail(id: number): Promise<RmsExportHistoryWithLines | undefined>;
  updateRmsExportHistory(id: number, patch: Partial<Pick<CreateRmsExportHistory, "requestFrom" | "poNumber" | "projectName" | "completionDate" | "deliveryTo">>): Promise<RmsExportHistory | undefined>;
  updateRmsExportHistoryItems(historyId: number, updates: Array<{ id: number; qty: number; sortOrder: number }>): Promise<void>;
  addRmsExportHistoryItem(historyId: number, item: Omit<CreateRmsExportHistoryItem, "historyId" | "sortOrder">): Promise<RmsExportHistoryWithLines>;
  addRmsExportHistoryItems(historyId: number, items: Omit<CreateRmsExportHistoryItem, "historyId" | "sortOrder">[]): Promise<RmsExportHistoryWithLines>;
  deleteRmsExportHistoryItem(historyId: number, itemId: number): Promise<void>;
  updateRmsExportHistoryStatus(id: number, status: string): Promise<RmsExportHistory | undefined>;
  deleteRmsExportHistory(ids: number[]): Promise<number>;
  getNextRmsSeq(poNumber: string | null | undefined): Promise<number>;
  // Reel ID Cleanup
  getReelIdPreview(): Promise<ReelIdPreviewRow[]>;
  renameReelIds(reelIds: number[]): Promise<{ updated: number; skipped: number; errors: string[] }>;
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

  async linkLocationToSupplier(locationId: number, supplierId: number): Promise<Location> {
    const [existing] = await db.select().from(locations).where(eq(locations.id, locationId));
    if (!existing) throw new Error("Location not found");
    if (existing.supplierId !== null && existing.supplierId !== supplierId) {
      throw new Error("Location is already linked to another supplier. Unlink it first.");
    }
    const [updated] = await db.update(locations).set({ supplierId }).where(eq(locations.id, locationId)).returning();
    return updated;
  }

  async unlinkLocationFromSupplier(locationId: number): Promise<Location> {
    const [updated] = await db.update(locations).set({ supplierId: null }).where(eq(locations.id, locationId)).returning();
    return updated;
  }

  // ─── Suppliers ───────────────────────────────────────────────────────────────

  async getSuppliers(): Promise<Supplier[]> {
    return await db.select().from(suppliers).orderBy(asc(suppliers.name));
  }

  async getSupplier(id: number): Promise<SupplierWithStats | undefined> {
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, id));
    if (!supplier) return undefined;

    // Get locations linked to this supplier
    const linkedLocations = await db.select().from(locations)
      .where(eq(locations.supplierId, id))
      .orderBy(asc(locations.name));

    // Get items where this supplier is the primary
    const primaryItems = await db.select().from(items)
      .where(and(eq(items.supplierId, id), eq(items.isActive, true)));

    // Get distinct items ever received from this supplier via movements (supplierId on movement)
    const receivedItemIds = await db.selectDistinct({ itemId: inventoryMovements.itemId })
      .from(inventoryMovements)
      .where(and(
        eq(inventoryMovements.supplierId, id),
        eq(inventoryMovements.movementType, 'receive')
      ));

    // Also get distinct items received from linked locations
    let locationReceivedItemIds: { itemId: number | null }[] = [];
    if (linkedLocations.length > 0) {
      const linkedLocationIds = linkedLocations.map(l => l.id);
      locationReceivedItemIds = await db.selectDistinct({ itemId: inventoryMovements.itemId })
        .from(inventoryMovements)
        .where(and(
          inArray(inventoryMovements.sourceLocationId, linkedLocationIds),
          eq(inventoryMovements.movementType, 'receive')
        ));
    }

    const primaryIds = new Set(primaryItems.map(i => i.id));
    const allReceivedIds = [
      ...receivedItemIds.map(r => r.itemId),
      ...locationReceivedItemIds.map(r => r.itemId),
    ].filter(iid => iid !== null && !primaryIds.has(iid as number)) as number[];
    const newIds = [...new Set(allReceivedIds)];

    let receivedOnlyItems: Item[] = [];
    if (newIds.length > 0) {
      receivedOnlyItems = await db.select().from(items)
        .where(and(inArray(items.id, newIds), eq(items.isActive, true)));
    }

    const allItems = [...primaryItems, ...receivedOnlyItems];

    // Build receipt rows: union of movements by supplierId + movements from linked locations
    const linkedLocationIds = linkedLocations.map(l => l.id);

    const receiptConditions = linkedLocationIds.length > 0
      ? or(
          and(eq(inventoryMovements.supplierId, id), eq(inventoryMovements.movementType, 'receive')),
          and(inArray(inventoryMovements.sourceLocationId, linkedLocationIds), eq(inventoryMovements.movementType, 'receive'))
        )
      : and(eq(inventoryMovements.supplierId, id), eq(inventoryMovements.movementType, 'receive'));

    const recentReceiptRows = await db.select({
      id: inventoryMovements.id,
      itemId: inventoryMovements.itemId,
      sku: items.sku,
      itemName: items.name,
      unitOfMeasure: items.unitOfMeasure,
      quantity: inventoryMovements.quantity,
      createdAt: inventoryMovements.createdAt,
      createdBy: inventoryMovements.createdBy,
    })
    .from(inventoryMovements)
    .leftJoin(items, eq(inventoryMovements.itemId, items.id))
    .where(receiptConditions)
    .orderBy(desc(inventoryMovements.createdAt))
    .limit(50);

    const lowStockCount = allItems.filter(i => i.quantityOnHand <= i.reorderPoint).length;

    return {
      ...supplier,
      itemCount: allItems.length,
      lowStockCount,
      items: allItems,
      recentReceipts: recentReceiptRows,
      linkedLocations,
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
    await db.update(purchaseRecommendations)
      .set({ supplierId: null })
      .where(eq(purchaseRecommendations.supplierId, id));
    await db.update(wireReels)
      .set({ supplierId: null })
      .where(eq(wireReels.supplierId, id));
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
    usagePattern?: "core" | "normal" | "low" | "none";
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

    // Issue usage counts per item over 30/90-day windows. Single 90-day scan
    // with conditional aggregation, plus MAX(createdAt) for last-issue date.
    // Mirrors getPurchaseRecommendations() so /api/items can render the
    // 사용패턴 chip and support the usagePattern filter.
    const now = Date.now();
    const since90 = new Date(now - 90 * 24 * 60 * 60 * 1000);
    const since30 = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const usageRows = itemIds.length > 0
      ? await db.select({
          itemId: inventoryMovements.itemId,
          cnt30: sql<string>`SUM(CASE WHEN ${inventoryMovements.createdAt} >= ${since30} THEN 1 ELSE 0 END)`,
          cnt90: sql<string>`COUNT(*)`,
          lastAt: sql<Date | string | null>`MAX(${inventoryMovements.createdAt})`,
        })
        .from(inventoryMovements)
        .where(and(
          inArray(inventoryMovements.itemId, itemIds),
          eq(inventoryMovements.movementType, 'issue'),
          gte(inventoryMovements.createdAt, since90),
        ))
        .groupBy(inventoryMovements.itemId)
      : [];
    const usageMap = new Map<number, { c30: number; c90: number; last: Date | null }>(
      usageRows.map(r => [r.itemId, {
        c30: Number(r.cnt30) || 0,
        c90: Number(r.cnt90) || 0,
        last: r.lastAt ? new Date(r.lastAt) : null,
      }])
    );

    let mapped = results.map(row => {
      const firstImage = allImages.find(img => img.itemId === row.item.id);
      const u = usageMap.get(row.item.id);
      const c30 = u?.c30 ?? 0;
      const c90 = u?.c90 ?? 0;
      const last = u?.last ?? null;
      return {
        ...row.item,
        category: row.category,
        location: row.location,
        supplier: row.supplier,
        imageUrl: firstImage?.imageUrl || null,
        issueCount30d: c30,
        issueCount90d: c90,
        lastIssueAt: last ? last.toISOString() : null,
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

    // ── Usage pattern filter (core ≥8/30d, normal ≥1/30d, low ≥1/90d, none 0)
    if (filters?.usagePattern) {
      const target = filters.usagePattern;
      mapped = mapped.filter(i => {
        const c30 = i.issueCount30d ?? 0;
        const c90 = i.issueCount90d ?? c30;
        const pattern: "core" | "normal" | "low" | "none" =
          c30 >= 8 ? 'core'   :
          c30 >= 1 ? 'normal' :
          c90 >= 1 ? 'low'    :
                     'none';
        return pattern === target;
      });
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
    // Always compute sizeSortValue from sizeLabel so new items are immediately
    // sorted correctly. A value of 999999 (unparseable) is stored as 0.
    const raw = parseSizeLabelForSort(item.sizeLabel ?? '');
    const sizeSortValue = raw < 999999 ? raw : 0;

    const [created] = await db.insert(items).values({ ...item, sizeSortValue }).returning();

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

  async getItemImages(itemId: number): Promise<ItemImage[]> {
    return db.select().from(itemImages)
      .where(eq(itemImages.itemId, itemId))
      .orderBy(asc(itemImages.sortOrder), asc(itemImages.id));
  }

  private async _normalizeItemImageSortOrder(tx: typeof db, itemId: number): Promise<void> {
    const rows = await tx.select({ id: itemImages.id })
      .from(itemImages)
      .where(eq(itemImages.itemId, itemId))
      .orderBy(asc(itemImages.sortOrder), asc(itemImages.id));
    for (let i = 0; i < rows.length; i++) {
      await tx.update(itemImages).set({ sortOrder: i }).where(eq(itemImages.id, rows[i].id));
    }
  }

  async appendItemImage(itemId: number, imageUrl: string, altText?: string | null): Promise<ItemImage[]> {
    const existing = await this.getItemImages(itemId);
    if (existing.length >= 4) throw new Error("이미지는 아이템당 최대 4장까지 등록할 수 있습니다.");
    const nextOrder = existing.length > 0 ? Math.max(...existing.map(i => i.sortOrder ?? 0)) + 1 : 0;
    await db.insert(itemImages).values({ itemId, imageUrl, altText: altText ?? null, sortOrder: nextOrder });
    return this.getItemImages(itemId);
  }

  async deleteItemImage(itemId: number, imageId: number): Promise<ItemImage[]> {
    const [img] = await db.select().from(itemImages).where(eq(itemImages.id, imageId)).limit(1);
    if (!img || img.itemId !== itemId) throw new Error("이미지를 찾을 수 없습니다.");
    await db.delete(itemImages).where(eq(itemImages.id, imageId));
    await this._normalizeItemImageSortOrder(db, itemId);
    return this.getItemImages(itemId);
  }

  async setItemImagePrimary(itemId: number, imageId: number): Promise<ItemImage[]> {
    const [img] = await db.select().from(itemImages).where(eq(itemImages.id, imageId)).limit(1);
    if (!img || img.itemId !== itemId) throw new Error("이미지를 찾을 수 없습니다.");
    await db.update(itemImages).set({ sortOrder: -1 }).where(eq(itemImages.id, imageId));
    await this._normalizeItemImageSortOrder(db, itemId);
    return this.getItemImages(itemId);
  }

  async reorderItemImages(itemId: number, imageIds: number[]): Promise<ItemImage[]> {
    const existing = await this.getItemImages(itemId);
    const existingIds = new Set(existing.map(i => i.id));
    if (!imageIds.every(id => existingIds.has(id))) throw new Error("유효하지 않은 이미지 ID가 포함되어 있습니다.");
    for (let i = 0; i < imageIds.length; i++) {
      await db.update(itemImages).set({ sortOrder: i }).where(eq(itemImages.id, imageIds[i]));
    }
    return this.getItemImages(itemId);
  }

  async updateItem(id: number, item: UpdateItemRequest): Promise<Item> {
    // If sizeLabel is explicitly included in the payload, recompute sizeSortValue.
    // Only triggers when sizeLabel key is present (not every unrelated update).
    const extra: { sizeSortValue?: number } = {};
    if ('sizeLabel' in item) {
      const raw = parseSizeLabelForSort(item.sizeLabel ?? '');
      extra.sizeSortValue = raw < 999999 ? raw : 0;
    }

    const [updated] = await db.update(items).set({ ...item, ...extra, updatedAt: new Date() }).where(eq(items.id, id)).returning();
    return updated;
  }

  async deleteItem(id: number): Promise<void> {
    await db.update(items).set({ isActive: false, updatedAt: new Date() }).where(eq(items.id, id));
  }

  async restoreItems(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    await db.update(items).set({ isActive: true, updatedAt: new Date() }).where(inArray(items.id, ids));
  }

  // ─── Inventory Movements ─────────────────────────────────────────────────────

  async getInventoryMovements(filters?: {
    itemId?: number; projectId?: number; movementType?: string; locationId?: number
  }): Promise<InventoryMovementWithRelations[]> {
    const srcLoc = alias(locations, "src_loc");
    const dstLoc = alias(locations, "dst_loc");
    const firstImg = alias(itemImages, "first_img");
    const movSup = alias(suppliers, "mov_sup");
    const createdByUser = alias(users, "created_by_user");

    const rows = await db.select({
      movement: inventoryMovements,
      item: items,
      itemImageUrl: firstImg.imageUrl,
      project: projects,
      sourceLocation: srcLoc,
      destinationLocation: dstLoc,
      supplierName: movSup.name,
      userName: createdByUser.name,
      userFirstName: createdByUser.firstName,
      userLastName: createdByUser.lastName,
      userEmail: createdByUser.email,
    })
    .from(inventoryMovements)
    .leftJoin(items, eq(inventoryMovements.itemId, items.id))
    .leftJoin(firstImg, eq(items.id, firstImg.itemId))
    .leftJoin(projects, eq(inventoryMovements.projectId, projects.id))
    .leftJoin(srcLoc, eq(inventoryMovements.sourceLocationId, srcLoc.id))
    .leftJoin(dstLoc, eq(inventoryMovements.destinationLocationId, dstLoc.id))
    .leftJoin(movSup, eq(inventoryMovements.supplierId, movSup.id))
    .leftJoin(createdByUser, eq(inventoryMovements.createdBy, createdByUser.id))
    .orderBy(desc(inventoryMovements.createdAt), asc(firstImg.sortOrder));

    let result = rows.map(r => {
      const u = r.userName || (r.userFirstName && r.userLastName ? `${r.userFirstName} ${r.userLastName}` : null) || r.userEmail || null;
      return {
        ...r.movement,
        item: r.item ? { ...r.item, imageUrl: r.itemImageUrl || null } : null,
        project: r.project,
        sourceLocation: r.sourceLocation,
        destinationLocation: r.destinationLocation,
        supplierName: r.supplierName ?? null,
        createdByName: u,
      };
    });

    if (filters?.itemId) result = result.filter(r => r.itemId === filters.itemId);
    if (filters?.projectId) result = result.filter(r => r.projectId === filters.projectId);
    if (filters?.movementType) result = result.filter(r => r.movementType === filters.movementType);

    // Batch-fetch wire reel movement lines for all returned movements
    const movementIds = result.map(r => r.id);
    const reelLinesByMovement: Record<number, { reelIdText: string; quantityFt: number; actionType: string; manufacturerSnapshot: string | null }[]> = {};
    if (movementIds.length > 0) {
      const lines = await db.select({
        movementId: wireReelMovementLines.movementId,
        reelIdText: wireReelMovementLines.reelIdText,
        quantityFt: wireReelMovementLines.quantityFt,
        actionType: wireReelMovementLines.actionType,
        manufacturerSnapshot: wireReelMovementLines.manufacturerSnapshot,
      })
      .from(wireReelMovementLines)
      .where(inArray(wireReelMovementLines.movementId, movementIds));

      for (const line of lines) {
        if (!reelLinesByMovement[line.movementId]) reelLinesByMovement[line.movementId] = [];
        reelLinesByMovement[line.movementId].push({
          reelIdText: line.reelIdText,
          quantityFt: line.quantityFt,
          actionType: line.actionType,
          manufacturerSnapshot: line.manufacturerSnapshot,
        });
      }
    }

    return result.map(r => ({ ...r, reelLines: reelLinesByMovement[r.id] ?? [] }));
  }

  async createInventoryMovement(
    movement: CreateInventoryMovementRequest & { previousQuantity: number; newQuantity: number; createdBy?: string | null },
    txClient?: any
  ): Promise<InventoryMovement> {
    const run = async (client: any): Promise<InventoryMovement> => {
      const [created] = await client.insert(inventoryMovements).values({
        itemId: movement.itemId,
        movementType: movement.movementType,
        quantity: movement.quantity,
        previousQuantity: movement.previousQuantity,
        newQuantity: movement.newQuantity,
        sourceLocationId: movement.sourceLocationId ?? null,
        destinationLocationId: movement.destinationLocationId ?? null,
        supplierId: movement.supplierId ?? null,
        projectId: movement.projectId ?? null,
        unitCostSnapshot: movement.unitCostSnapshot ?? null,
        note: movement.note ?? null,
        reason: movement.reason ?? null,
        referenceType: movement.referenceType ?? null,
        referenceId: movement.referenceId ?? null,
        createdBy: movement.createdBy ?? null,
      }).returning();

      // Update item's total quantity_on_hand
      await client.update(items)
        .set({ quantityOnHand: movement.newQuantity, updatedAt: new Date() })
        .where(eq(items.id, movement.itemId));

      // Update location balances
      // receive/issue/return: external locations (supplier / jobsite), no internal balance update
      // transfer: moves between internal warehouse locations
      if (movement.movementType === 'transfer') {
        if (movement.sourceLocationId) {
          await this._adjustLocationBalance(movement.itemId, movement.sourceLocationId, -movement.quantity, client);
        }
        if (movement.destinationLocationId) {
          await this._adjustLocationBalance(movement.itemId, movement.destinationLocationId, movement.quantity, client);
        }
      } else if (movement.movementType === 'adjust') {
        const locId = movement.destinationLocationId ?? movement.sourceLocationId;
        if (locId) {
          const delta = movement.newQuantity - movement.previousQuantity;
          await this._adjustLocationBalance(movement.itemId, locId, delta, client);
        }
      }

      // Log project material transaction if project is linked
      if (movement.projectId && (movement.movementType === 'issue' || movement.movementType === 'return')) {
        await client.insert(projectMaterialTransactions).values({
          projectId: movement.projectId,
          itemId: movement.itemId,
          movementId: created.id,
          transactionType: movement.movementType,
          quantity: movement.quantity,
          note: movement.note ?? null,
        });
      }

      return created;
    };

    if (txClient) {
      return run(txClient);
    }
    return db.transaction(run);
  }

  async updateInventoryMovement(id: number, changes: { movementType: string; quantity: number; sourceLocationId?: number | null; destinationLocationId?: number | null; projectId?: number | null; note?: string | null; reason?: string | null; itemId?: number; transactionDate?: Date | null; editedBy?: string | null; editHistory?: any[] }): Promise<InventoryMovement> {
    return db.transaction(async (tx) => {
      const [orig] = await tx.select().from(inventoryMovements).where(eq(inventoryMovements.id, id));
      if (!orig) throw new Error("Movement not found");

      const effectiveItemId = changes.itemId ?? orig.itemId;

      // Get current item quantity
      const [itemRow] = await tx.select().from(items).where(eq(items.id, effectiveItemId));
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
        if (orig.sourceLocationId) await this._adjustLocationBalance(orig.itemId, orig.sourceLocationId, orig.quantity, tx);
        if (orig.destinationLocationId) await this._adjustLocationBalance(orig.itemId, orig.destinationLocationId, -orig.quantity, tx);
      }

      // Apply new location balance impacts (transfer only)
      const newSrc = changes.sourceLocationId !== undefined ? changes.sourceLocationId : orig.sourceLocationId;
      const newDst = changes.destinationLocationId !== undefined ? changes.destinationLocationId : orig.destinationLocationId;
      if (changes.movementType === "transfer") {
        if (newSrc) await this._adjustLocationBalance(effectiveItemId, newSrc, -changes.quantity, tx);
        if (newDst) await this._adjustLocationBalance(effectiveItemId, newDst, changes.quantity, tx);
      }

      // Update item quantity
      await tx.update(items).set({ quantityOnHand: updatedQty, updatedAt: new Date() }).where(eq(items.id, effectiveItemId));

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
      const [updated] = await tx.update(inventoryMovements).set({
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
    });
  }

  async undoMovementEdit(id: number): Promise<InventoryMovement> {
    return db.transaction(async (tx) => {
      const [orig] = await tx.select().from(inventoryMovements).where(eq(inventoryMovements.id, id));
      if (!orig) throw new Error("Movement not found");
      const history: any[] = Array.isArray(orig.editHistory) ? (orig.editHistory as any[]) : [];
      if (history.length === 0) throw new Error("No edit history to undo");

      const lastEntry = history[history.length - 1];
      const prev = lastEntry.previousValues;

      // Revert the stock using the same logic as updateInventoryMovement
      const [itemRow] = await tx.select().from(items).where(eq(items.id, orig.itemId));
      if (!itemRow) throw new Error("Item not found");

      let curDelta = 0;
      if (orig.movementType === "receive" || orig.movementType === "return") curDelta = orig.quantity;
      else if (orig.movementType === "issue") curDelta = -orig.quantity;

      let prevDelta = 0;
      if (prev.movementType === "receive" || prev.movementType === "return") prevDelta = prev.quantity;
      else if (prev.movementType === "issue") prevDelta = -prev.quantity;

      const netChange = prevDelta - curDelta;
      const revertedQty = itemRow.quantityOnHand + netChange;

      // Reverse current transfer location balance impacts (if current state is transfer)
      if (orig.movementType === "transfer") {
        if (orig.sourceLocationId) await this._adjustLocationBalance(orig.itemId, orig.sourceLocationId, orig.quantity, tx);
        if (orig.destinationLocationId) await this._adjustLocationBalance(orig.itemId, orig.destinationLocationId, -orig.quantity, tx);
      }
      // Re-apply previous transfer location balance impacts (if previous state was transfer)
      if (prev.movementType === "transfer") {
        if (prev.sourceLocationId) await this._adjustLocationBalance(orig.itemId, prev.sourceLocationId, -(prev.quantity), tx);
        if (prev.destinationLocationId) await this._adjustLocationBalance(orig.itemId, prev.destinationLocationId, prev.quantity, tx);
      }

      await tx.update(items).set({ quantityOnHand: revertedQty, updatedAt: new Date() }).where(eq(items.id, orig.itemId));

      const newHistory = history.slice(0, -1);
      const [updated] = await tx.update(inventoryMovements).set({
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
    });
  }

  async deleteMovement(id: number): Promise<void> {
    return db.transaction(async (tx) => {
      const [orig] = await tx.select().from(inventoryMovements).where(eq(inventoryMovements.id, id));
      if (!orig) throw new Error("Movement not found");

      // Reverse the stock impact on the item
      const [itemRow] = await tx.select().from(items).where(eq(items.id, orig.itemId));
      if (!itemRow) throw new Error("Item not found");

      let delta = 0;
      if (orig.movementType === "receive" || orig.movementType === "return") delta = -orig.quantity;
      else if (orig.movementType === "issue") delta = orig.quantity;

      const newQty = itemRow.quantityOnHand + delta;
      if (newQty < 0) throw new Error(`Cannot delete: would result in negative stock (${newQty}).`);

      // Reverse location balance impacts (transfer only; receive/issue/return are external)
      if (orig.movementType === "transfer") {
        if (orig.sourceLocationId) await this._adjustLocationBalance(orig.itemId, orig.sourceLocationId, orig.quantity, tx);
        if (orig.destinationLocationId) await this._adjustLocationBalance(orig.itemId, orig.destinationLocationId, -orig.quantity, tx);
      }

      // Update item quantity
      await tx.update(items).set({ quantityOnHand: newQty, updatedAt: new Date() }).where(eq(items.id, orig.itemId));

      // Delete dependent project_material_transactions first (FK constraint), then the movement
      await tx.delete(projectMaterialTransactions).where(eq(projectMaterialTransactions.movementId, id));
      await tx.delete(inventoryMovements).where(eq(inventoryMovements.id, id));
    });
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

  async bulkRestoreMovements(snapshots: any[]): Promise<{ restored: number[]; errors: { id: number; message: string }[] }> {
    const restored: number[] = [];
    const errors: { id: number; message: string }[] = [];
    for (const snap of snapshots) {
      try {
        // Pre-validate before entering transaction
        let delta = 0;
        if (snap.movementType === "receive" || snap.movementType === "return") delta = snap.quantity;
        else if (snap.movementType === "issue") delta = -snap.quantity;

        const [itemRow] = await db.select().from(items).where(eq(items.id, snap.itemId));
        if (!itemRow) {
          errors.push({ id: snap.id ?? 0, message: `아이템 ${snap.itemId} 없음 — 복원 건너뜀` });
          continue;
        }

        const newQty = itemRow.quantityOnHand + delta;
        if (newQty < 0) {
          errors.push({ id: snap.id ?? 0, message: `아이템 ${snap.itemId} 재고 부족 — 복원 시 ${newQty}가 됨` });
          continue;
        }

        // Wrap all writes for this snapshot in a single transaction
        const insertedId = await db.transaction(async (tx) => {
          await tx.update(items).set({ quantityOnHand: newQty, updatedAt: new Date() }).where(eq(items.id, snap.itemId));

          // Re-apply location balances for transfers
          if (snap.movementType === "transfer") {
            if (snap.sourceLocationId) await this._adjustLocationBalance(snap.itemId, snap.sourceLocationId, -snap.quantity, tx);
            if (snap.destinationLocationId) await this._adjustLocationBalance(snap.itemId, snap.destinationLocationId, snap.quantity, tx);
          }

          // Re-insert movement with original data
          const [inserted] = await tx.insert(inventoryMovements).values({
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
          return inserted.id;
        });

        restored.push(insertedId);
      } catch (err: any) {
        errors.push({ id: snap.id ?? 0, message: err.message });
      }
    }
    return { restored, errors };
  }

  private async _upsertLocationBalance(itemId: number, locationId: number, qty: number, client: any = db) {
    const [existing] = await client.select().from(inventoryLocationBalances)
      .where(and(eq(inventoryLocationBalances.itemId, itemId), eq(inventoryLocationBalances.locationId, locationId)));

    if (existing) {
      await client.update(inventoryLocationBalances)
        .set({ quantityOnHand: qty, updatedAt: new Date() })
        .where(eq(inventoryLocationBalances.id, existing.id));
    } else {
      await client.insert(inventoryLocationBalances).values({ itemId, locationId, quantityOnHand: qty });
    }
  }

  private async _adjustLocationBalance(itemId: number, locationId: number, delta: number, client: any = db) {
    const [existing] = await client.select().from(inventoryLocationBalances)
      .where(and(eq(inventoryLocationBalances.itemId, itemId), eq(inventoryLocationBalances.locationId, locationId)));

    if (existing) {
      const newQty = existing.quantityOnHand + delta;
      if (newQty < 0) {
        throw new Error(`위치 잔량 음수 오류: 아이템 ${itemId}, 위치 ${locationId} — 현재 ${existing.quantityOnHand}, 변화량 ${delta} = ${newQty}`);
      }
      await client.update(inventoryLocationBalances)
        .set({ quantityOnHand: newQty, updatedAt: new Date() })
        .where(eq(inventoryLocationBalances.id, existing.id));
    } else if (delta > 0) {
      await client.insert(inventoryLocationBalances).values({ itemId, locationId, quantityOnHand: delta });
    } else if (delta < 0) {
      throw new Error(`위치 잔량 오류: 아이템 ${itemId}, 위치 ${locationId} — 잔량 없음에서 차감 시도 (delta=${delta})`);
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
    // Return one row per ACTIVE item (not just items with a pending recommendation),
    // so the Purchasing & Reorder page can show in-stock items alongside items that
    // need reorder. Items without a pending recommendation get a synthetic negative
    // id (= -item.id) so the frontend Set<number> selection key stays unique and
    // never collides with real recommendation rows.
    const rows = await db.select({
      rec: purchaseRecommendations,
      item: items,
      supplier: suppliers,
    })
    .from(items)
    .leftJoin(
      purchaseRecommendations,
      and(
        eq(purchaseRecommendations.itemId, items.id),
        eq(purchaseRecommendations.status, 'pending'),
      ),
    )
    .leftJoin(suppliers, eq(suppliers.id, items.supplierId))
    .where(eq(items.isActive, true))
    .orderBy(
      sql`CASE ${purchaseRecommendations.priorityLevel} WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END`,
      asc(items.name),
    );

    const itemIds = rows.map(r => r.item?.id).filter((id): id is number => id != null);
    const allImages = itemIds.length > 0
      ? await db.select().from(itemImages).where(inArray(itemImages.itemId, itemIds)).orderBy(asc(itemImages.sortOrder))
      : [];

    // Issue usage counts per item over 30/90-day windows (used by Reorder UI
    // to render 사용빈도 chip and the new 사용패턴 chip/filter). Single 90-day
    // scan with conditional aggregation, plus MAX(createdAt) for last-issue.
    const now = Date.now();
    const since90 = new Date(now - 90 * 24 * 60 * 60 * 1000);
    const since30 = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const usageRows = itemIds.length > 0
      ? await db.select({
          itemId: inventoryMovements.itemId,
          cnt30: sql<string>`SUM(CASE WHEN ${inventoryMovements.createdAt} >= ${since30} THEN 1 ELSE 0 END)`,
          cnt90: sql<string>`COUNT(*)`,
          lastAt: sql<Date | string | null>`MAX(${inventoryMovements.createdAt})`,
        })
        .from(inventoryMovements)
        .where(and(
          inArray(inventoryMovements.itemId, itemIds),
          eq(inventoryMovements.movementType, 'issue'),
          gte(inventoryMovements.createdAt, since90),
        ))
        .groupBy(inventoryMovements.itemId)
      : [];
    const usageMap = new Map<number, { c30: number; c90: number; last: Date | null }>(
      usageRows.map(r => [r.itemId, {
        c30: Number(r.cnt30) || 0,
        c90: Number(r.cnt90) || 0,
        last: r.lastAt ? new Date(r.lastAt) : null,
      }])
    );

    return rows.map(r => {
      const firstImage = r.item ? allImages.find(img => img.itemId === r.item!.id) : undefined;
      const u = r.item ? usageMap.get(r.item.id) : undefined;
      const c30 = u?.c30 ?? 0;
      const c90 = u?.c90 ?? 0;
      const last = u?.last ?? null;
      // Synthesize a recommendation row for items without a pending one so the
      // frontend can render them in the same table. Synthetic id is negative to
      // stay unique vs real recommendation ids; mark/dismiss buttons hide on it.
      const rec: PurchaseRecommendation = (r.rec && r.rec.id != null) ? r.rec : {
        id: r.item ? -r.item.id : 0,
        itemId: r.item?.id ?? 0,
        supplierId: r.item?.supplierId ?? null,
        recommendedQuantity: r.item?.reorderQuantity ?? 0,
        priorityLevel: 'none',
        reason: null,
        status: 'pending',
        createdAt: null,
        updatedAt: null,
      };
      return {
        ...rec,
        item: r.item ? { ...r.item, imageUrl: firstImage?.imageUrl || null } : null,
        supplier: r.supplier,
        issueCount30d: c30,
        issueCount90d: c90,
        lastIssueAt: last ? last.toISOString() : null,
      };
    });
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

    // Load item group metadata (custom representative images + sort order)
    const groupRecords = await db.select().from(itemGroups).where(eq(itemGroups.categoryId, categoryId));
    const groupImageMap = new Map<string, string | null>();
    const groupSortOrderMap = new Map<string, number>();
    for (const g of groupRecords) {
      const gKey = g.manufacturerName ? `${g.manufacturerName}::${g.baseItemName}` : g.baseItemName;
      groupImageMap.set(gKey, g.imageUrl ?? null);
      groupSortOrderMap.set(gKey, g.sortOrder ?? 0);
    }

    // Override quantityOnHand with live reel sum for reel-tracked items
    const reelMap = await this.liveReelQtyMap(itemIds);

    // Issue usage counts per item over 30/90-day windows (mirrors getItems
    // and getPurchaseRecommendations). Single 90-day scan with conditional
    // aggregation + MAX(createdAt) for last-issue date.
    const now = Date.now();
    const since90 = new Date(now - 90 * 24 * 60 * 60 * 1000);
    const since30 = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const usageRows = itemIds.length > 0
      ? await db.select({
          itemId: inventoryMovements.itemId,
          cnt30: sql<string>`SUM(CASE WHEN ${inventoryMovements.createdAt} >= ${since30} THEN 1 ELSE 0 END)`,
          cnt90: sql<string>`COUNT(*)`,
          lastAt: sql<Date | string | null>`MAX(${inventoryMovements.createdAt})`,
        })
        .from(inventoryMovements)
        .where(and(
          inArray(inventoryMovements.itemId, itemIds),
          eq(inventoryMovements.movementType, 'issue'),
          gte(inventoryMovements.createdAt, since90),
        ))
        .groupBy(inventoryMovements.itemId)
      : [];
    const usageMap = new Map<number, { c30: number; c90: number; last: Date | null }>(
      usageRows.map(r => [r.itemId, {
        c30: Number(r.cnt30) || 0,
        c90: Number(r.cnt90) || 0,
        last: r.lastAt ? new Date(r.lastAt) : null,
      }])
    );

    const enriched = rows.map(r => {
      const i = r.item;
      const firstImage = allImages.find(img => img.itemId === i.id);
      const liveQty = reelMap.has(i.id) ? reelMap.get(i.id)! : i.quantityOnHand;
      let status = "in_stock";
      if (liveQty === 0) status = "out_of_stock";
      else if (liveQty <= i.minimumStock) status = "low_stock";
      const u = usageMap.get(i.id);
      const c30 = u?.c30 ?? 0;
      const c90 = u?.c90 ?? 0;
      const last = u?.last ?? null;
      return {
        ...i,
        quantityOnHand: liveQty,
        location: r.location,
        supplier: r.supplier,
        status,
        imageUrl: firstImage?.imageUrl || null,
        issueCount30d: c30,
        issueCount90d: c90,
        lastIssueAt: last ? last.toISOString() : null,
      };
    });

    // Group by manufacturer + baseItemName so items with the same family name
    // but different manufacturers appear as separate groups.
    const groupMap = new Map<string, { items: typeof enriched, representativeImage: string | null, baseItemName: string, manufacturerName: string }>();
    for (const item of enriched) {
      const mfr  = (item.manufacturer || "").trim();
      const base = item.baseItemName || item.name;
      const key  = mfr ? `${mfr}::${base}` : base;
      if (!groupMap.has(key)) {
        // Priority: custom group image keyed by composite key, then first item image
        const customImage = groupImageMap.get(key) ?? null;
        groupMap.set(key, { items: [], representativeImage: customImage, baseItemName: base, manufacturerName: mfr });
      }
      const group = groupMap.get(key)!;
      group.items.push(item);
      if (!group.representativeImage && item.imageUrl) {
        group.representativeImage = item.imageUrl;
      }
    }

    // Clean up orphaned item_groups rows (families whose items were all
    // soft-deleted or moved to another family / category since last save).
    const activeGroupKeys = new Set(groupMap.keys());
    const orphanedGroupIds = groupRecords
      .filter(g => {
        const gKey = g.manufacturerName ? `${g.manufacturerName}::${g.baseItemName}` : g.baseItemName;
        return !activeGroupKeys.has(gKey);
      })
      .map(g => g.id);
    if (orphanedGroupIds.length > 0) {
      await db.delete(itemGroups).where(inArray(itemGroups.id, orphanedGroupIds));
    }

    const groups = Array.from(groupMap.entries())
      .map(([key, data]) => ({
        baseItemName: data.baseItemName,
        manufacturerName: data.manufacturerName || null,
        items: data.items,
        representativeImage: data.representativeImage,
        customImageUrl: groupImageMap.get(key) ?? null,
        sortOrder: groupSortOrderMap.has(key) ? groupSortOrderMap.get(key)! : 1_000_000,
      }))
      .sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        const aKey = a.manufacturerName ? `${a.manufacturerName} ${a.baseItemName}` : a.baseItemName;
        const bKey = b.manufacturerName ? `${b.manufacturerName} ${b.baseItemName}` : b.baseItemName;
        return aKey.localeCompare(bKey);
      });

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

  // ─── Stock & Pricing (admin overview) ────────────────────────────────────────

  async getStockPricingOverview(): Promise<any> {
    const allCats = await db.select().from(categories)
      .where(eq(categories.isActive, true))
      .orderBy(asc(categories.sortOrder), asc(categories.name));

    const allItems = await db.select().from(items)
      .where(eq(items.isActive, true))
      .orderBy(asc(items.baseItemName), asc(items.sizeSortValue), asc(items.name));

    const itemIds = allItems.map(i => i.id);
    const reelMap = await this.liveReelQtyMap(itemIds);

    const imgRows = itemIds.length > 0
      ? await db.select({ itemId: itemImages.itemId, imageUrl: itemImages.imageUrl, sortOrder: itemImages.sortOrder })
          .from(itemImages)
          .where(inArray(itemImages.itemId, itemIds))
          .orderBy(asc(itemImages.sortOrder))
      : [];
    const imgMap = new Map<number, string>();
    for (const r of imgRows) {
      if (!imgMap.has(r.itemId)) imgMap.set(r.itemId, r.imageUrl);
    }

    const aggRows = itemIds.length > 0
      ? await db.select({
          itemId: supplierItems.itemId,
          cnt:       sql<string>`COUNT(*)`,
          pricedCnt: sql<string>`COUNT(*) FILTER (WHERE ${supplierItems.lastUnitCost} IS NOT NULL)`,
          best: sql<string | null>`MIN(${supplierItems.lastUnitCost})`,
          avg:  sql<string | null>`AVG(${supplierItems.lastUnitCost})`,
        })
        .from(supplierItems)
        .where(inArray(supplierItems.itemId, itemIds))
        .groupBy(supplierItems.itemId)
      : [];
    const aggMap = new Map<number, { count: number; pricedCount: number; bestPrice: number | null; averagePrice: number | null }>(
      aggRows.map(r => [r.itemId, {
        count: Number(r.cnt) || 0,
        pricedCount: Number(r.pricedCnt) || 0,
        bestPrice: r.best != null ? Number(r.best) : null,
        averagePrice: r.avg != null ? Math.round(Number(r.avg) * 100) / 100 : null,
      }])
    );

    type FamilyAcc = { name: string; items: any[] };
    type CatAcc = { category: any; families: Map<string, FamilyAcc>; itemCount: number };
    const catMap = new Map<number, CatAcc>();
    for (const c of allCats) catMap.set(c.id, { category: c, families: new Map(), itemCount: 0 });

    for (const it of allItems) {
      if (it.categoryId == null) continue;
      const cat = catMap.get(it.categoryId);
      if (!cat) continue;
      const famKey = it.baseItemName || it.name;
      let fam = cat.families.get(famKey);
      if (!fam) { fam = { name: famKey, items: [] }; cat.families.set(famKey, fam); }
      const liveQty = reelMap.has(it.id) ? reelMap.get(it.id)! : it.quantityOnHand;
      let status = "in_stock";
      if (liveQty === 0) status = "out_of_stock";
      else if (liveQty <= it.reorderPoint) status = "low_stock";
      const agg = aggMap.get(it.id);
      fam.items.push({
        id: it.id,
        sku: it.sku,
        name: it.name,
        sizeLabel: it.sizeLabel,
        sizeSortValue: it.sizeSortValue ?? 0,
        unitOfMeasure: it.unitOfMeasure,
        imageUrl: imgMap.get(it.id) ?? null,
        quantityOnHand: liveQty,
        reorderPoint: it.reorderPoint,
        reorderQuantity: it.reorderQuantity,
        minimumStock: it.minimumStock,
        status,
        supplierCount: agg?.count ?? 0,
        pricedSupplierCount: agg?.pricedCount ?? 0,
        bestPrice: agg?.bestPrice ?? null,
        averagePrice: agg?.averagePrice ?? null,
      });
      cat.itemCount++;
    }

    const result = Array.from(catMap.values())
      .filter(c => c.itemCount > 0)
      .map(c => ({
        id: c.category.id,
        name: c.category.name,
        code: c.category.code ?? null,
        itemCount: c.itemCount,
        families: Array.from(c.families.values())
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(f => ({
            ...f,
            items: f.items.slice().sort((a: { sizeSortValue: number; sizeLabel: string | null; name: string }, b: { sizeSortValue: number; sizeLabel: string | null; name: string }) => {
              const aDb = (a.sizeSortValue !== 0 && a.sizeSortValue !== 9999) ? a.sizeSortValue : null;
              const bDb = (b.sizeSortValue !== 0 && b.sizeSortValue !== 9999) ? b.sizeSortValue : null;
              if (aDb !== null && bDb !== null) return aDb - bDb;
              const aEff = aDb ?? parseSizeLabelForSort(a.sizeLabel || '');
              const bEff = bDb ?? parseSizeLabelForSort(b.sizeLabel || '');
              if (aEff !== bEff) return aEff - bEff;
              return a.name.localeCompare(b.name);
            }),
          })),
      }));

    return { categories: result };
  }

  async updateItemStockSettings(id: number, data: { reorderPoint: number; reorderQuantity: number; minimumStock: number }): Promise<Item> {
    const [updated] = await db.update(items)
      .set({
        reorderPoint: data.reorderPoint,
        reorderQuantity: data.reorderQuantity,
        minimumStock: data.minimumStock,
        updatedAt: new Date(),
      })
      .where(eq(items.id, id))
      .returning();
    return updated;
  }

  async getSupplierItemsForItem(itemId: number): Promise<any[]> {
    const rows = await db.select({
      si: supplierItems,
      supplier: suppliers,
    })
    .from(supplierItems)
    .leftJoin(suppliers, eq(supplierItems.supplierId, suppliers.id))
    .where(eq(supplierItems.itemId, itemId))
    .orderBy(desc(supplierItems.preferredSupplier), asc(supplierItems.lastUnitCost));
    return rows.map(r => ({
      ...r.si,
      lastUnitCost: r.si.lastUnitCost != null ? Number(r.si.lastUnitCost) : null,
      supplier: r.supplier ? { id: r.supplier.id, name: r.supplier.name } : null,
    }));
  }

  async createSupplierItem(data: { itemId: number; supplierId: number; supplierSku?: string | null; leadTimeDays?: number | null; preferredSupplier?: boolean; lastUnitCost?: string | number | null; note?: string | null }): Promise<SupplierItem> {
    const costStr = data.lastUnitCost != null ? String(data.lastUnitCost) : null;
    const wantPreferred = data.preferredSupplier ?? false;

    // Application-level duplicate prevention: upsert instead of blind insert
    const [existing] = await db.select().from(supplierItems)
      .where(and(eq(supplierItems.itemId, data.itemId), eq(supplierItems.supplierId, data.supplierId)))
      .limit(1);

    let row: SupplierItem;
    if (existing) {
      const [updated] = await db.update(supplierItems).set({
        supplierSku: data.supplierSku ?? null,
        leadTimeDays: data.leadTimeDays ?? null,
        preferredSupplier: wantPreferred,
        lastUnitCost: costStr,
        note: data.note ?? null,
        updatedAt: new Date(),
      }).where(eq(supplierItems.id, existing.id)).returning();
      row = updated;
    } else {
      const [created] = await db.insert(supplierItems).values({
        itemId: data.itemId,
        supplierId: data.supplierId,
        supplierSku: data.supplierSku ?? null,
        leadTimeDays: data.leadTimeDays ?? null,
        preferredSupplier: wantPreferred,
        lastUnitCost: costStr,
        note: data.note ?? null,
      }).returning();
      row = created;
    }

    // One preferred per item: unset all other rows for same itemId
    if (wantPreferred) {
      await db.update(supplierItems)
        .set({ preferredSupplier: false, updatedAt: new Date() })
        .where(and(eq(supplierItems.itemId, data.itemId), ne(supplierItems.id, row.id)));
    }

    return row;
  }

  async updateSupplierItem(id: number, data: {
    supplierId?: number;
    supplierSku?: string | null;
    leadTimeDays?: number | null;
    preferredSupplier?: boolean;
    lastUnitCost?: string | number | null;
    note?: string | null;
  }): Promise<SupplierItem | undefined> {
    const patch: Partial<typeof supplierItems.$inferInsert> & { updatedAt: Date } = { updatedAt: new Date() };
    if (data.supplierId !== undefined) patch.supplierId = data.supplierId;
    if (data.supplierSku !== undefined) patch.supplierSku = data.supplierSku;
    if (data.leadTimeDays !== undefined) patch.leadTimeDays = data.leadTimeDays;
    if (data.preferredSupplier !== undefined) patch.preferredSupplier = data.preferredSupplier;
    if (data.lastUnitCost !== undefined) patch.lastUnitCost = data.lastUnitCost != null ? String(data.lastUnitCost) : null;
    if (data.note !== undefined) patch.note = data.note;
    const [updated] = await db.update(supplierItems).set(patch).where(eq(supplierItems.id, id)).returning();

    // One preferred per item: when setting preferredSupplier=true, unset all others for same itemId
    if (data.preferredSupplier === true && updated) {
      await db.update(supplierItems)
        .set({ preferredSupplier: false, updatedAt: new Date() })
        .where(and(eq(supplierItems.itemId, updated.itemId), ne(supplierItems.id, id)));
    }

    return updated;
  }

  // ─── Supplier View: all items for one supplier ────────────────────────────────

  async getStockPricingBySupplier(supplierId: number): Promise<any | null> {
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, supplierId)).limit(1);
    if (!supplier) return null;

    const rows = await db.select({
      si: supplierItems,
      item: items,
      cat: categories,
    })
    .from(items)
    .leftJoin(supplierItems, and(eq(supplierItems.itemId, items.id), eq(supplierItems.supplierId, supplierId)))
    .leftJoin(categories, eq(items.categoryId, categories.id))
    .where(eq(items.isActive, true))
    .orderBy(asc(categories.name), asc(items.baseItemName), asc(items.sizeSortValue), asc(items.name));

    const itemIds = rows.map(r => r.item.id);
    const imgRows = itemIds.length > 0
      ? await db.select({ itemId: itemImages.itemId, imageUrl: itemImages.imageUrl, sortOrder: itemImages.sortOrder })
          .from(itemImages).where(inArray(itemImages.itemId, itemIds)).orderBy(asc(itemImages.sortOrder))
      : [];
    const imgMap = new Map<number, string>();
    for (const r of imgRows) if (!imgMap.has(r.itemId)) imgMap.set(r.itemId, r.imageUrl);

    return {
      supplierId: supplier.id,
      supplierName: supplier.name,
      items: rows.map(r => ({
        supplierItemId: r.si?.id ?? null,
        itemId: r.item.id,
        sku: r.item.sku,
        name: r.item.name,
        sizeLabel: r.item.sizeLabel ?? null,
        unitOfMeasure: r.item.unitOfMeasure,
        imageUrl: imgMap.get(r.item.id) ?? null,
        categoryId: r.cat?.id ?? null,
        categoryName: r.cat?.name ?? null,
        familyName: r.item.baseItemName ?? r.item.name,
        quantityOnHand: r.item.quantityOnHand,
        reorderPoint: r.item.reorderPoint,
        supplierSku: r.si?.supplierSku ?? null,
        lastUnitCost: r.si?.lastUnitCost != null ? Number(r.si.lastUnitCost) : null,
        leadTimeDays: r.si?.leadTimeDays ?? null,
        preferredSupplier: r.si?.preferredSupplier ?? false,
        note: r.si?.note ?? null,
        updatedAt: r.si?.updatedAt ? r.si.updatedAt.toISOString() : null,
      })),
    };
  }

  // ─── Batch upsert supplier items from Supplier View ───────────────────────────

  async batchUpsertSupplierItemsForSupplier(
    supplierId: number,
    items_: Array<{
      supplierItemId?: number | null;
      itemId: number;
      supplierSku: string | null;
      lastUnitCost: number | null;
      leadTimeDays: number | null;
      preferredSupplier: boolean;
      note: string | null;
    }>
  ): Promise<void> {
    for (const item of items_) {
      const costStr = item.lastUnitCost != null ? String(item.lastUnitCost) : null;

      // Find canonical row for this (itemId, supplierId)
      const existing = await db.select().from(supplierItems)
        .where(and(eq(supplierItems.itemId, item.itemId), eq(supplierItems.supplierId, supplierId)))
        .orderBy(
          desc(supplierItems.preferredSupplier),
          sql`${supplierItems.lastUnitCost} IS NOT NULL desc`,
          desc(supplierItems.updatedAt),
          asc(supplierItems.id)
        )
        .limit(1);

      let rowId: number;
      if (existing.length > 0) {
        const [updated] = await db.update(supplierItems).set({
          supplierSku: item.supplierSku,
          lastUnitCost: costStr,
          leadTimeDays: item.leadTimeDays,
          preferredSupplier: item.preferredSupplier,
          note: item.note,
          updatedAt: new Date(),
        }).where(eq(supplierItems.id, existing[0].id)).returning();
        rowId = updated.id;
      } else {
        const [created] = await db.insert(supplierItems).values({
          itemId: item.itemId,
          supplierId,
          supplierSku: item.supplierSku,
          lastUnitCost: costStr,
          leadTimeDays: item.leadTimeDays,
          preferredSupplier: item.preferredSupplier,
          note: item.note,
        }).returning();
        rowId = created.id;
      }

      // One preferred per item
      if (item.preferredSupplier) {
        await db.update(supplierItems)
          .set({ preferredSupplier: false, updatedAt: new Date() })
          .where(and(eq(supplierItems.itemId, item.itemId), ne(supplierItems.id, rowId)));
      }
    }
  }

  // ─── Duplicate scan (admin utility) ──────────────────────────────────────────
  // TODO: After duplicate scan and cleanup are verified, add a DB-level unique
  //       constraint on supplier_items(item_id, supplier_id) using a proper
  //       migration or controlled SQL migration.

  async getSupplierItemDuplicates(): Promise<any[]> {
    const dupeGroups = await db.execute(sql`
      SELECT item_id, supplier_id, COUNT(*) as cnt
      FROM supplier_items
      GROUP BY item_id, supplier_id
      HAVING COUNT(*) > 1
    `);

    if (!dupeGroups.rows.length) return [];

    const results: any[] = [];
    for (const g of dupeGroups.rows) {
      const itemId = Number(g.item_id);
      const supplierId = Number(g.supplier_id);
      const rows = await db.select().from(supplierItems)
        .where(and(eq(supplierItems.itemId, itemId), eq(supplierItems.supplierId, supplierId)))
        .orderBy(desc(supplierItems.preferredSupplier), desc(supplierItems.updatedAt), asc(supplierItems.id));

      const sorted = [...rows].sort((a, b) => {
        if (a.preferredSupplier && !b.preferredSupplier) return -1;
        if (!a.preferredSupplier && b.preferredSupplier) return 1;
        if (a.lastUnitCost != null && b.lastUnitCost == null) return -1;
        if (a.lastUnitCost == null && b.lastUnitCost != null) return 1;
        const ad = a.updatedAt?.getTime() ?? 0;
        const bd = b.updatedAt?.getTime() ?? 0;
        if (ad !== bd) return bd - ad;
        return a.id - b.id;
      });

      results.push({
        itemId,
        supplierId,
        count: Number(g.cnt),
        recommendedKeepId: sorted[0]?.id ?? null,
        rows: rows.map(r => ({
          id: r.id,
          itemId: r.itemId,
          supplierId: r.supplierId,
          supplierSku: r.supplierSku ?? null,
          lastUnitCost: r.lastUnitCost != null ? Number(r.lastUnitCost) : null,
          preferredSupplier: r.preferredSupplier ?? false,
          updatedAt: r.updatedAt?.toISOString() ?? null,
          createdAt: r.createdAt?.toISOString() ?? null,
        })),
      });
    }
    return results;
  }

  async deleteSupplierItem(id: number): Promise<void> {
    await db.delete(supplierItems).where(eq(supplierItems.id, id));
  }

  async getSupplierItemById(id: number): Promise<SupplierItem | undefined> {
    const [row] = await db.select().from(supplierItems).where(eq(supplierItems.id, id));
    return row;
  }

  // ─── Item Groups (family metadata) ────────────────────────────────────────────

  async upsertItemGroup(categoryId: number, baseItemName: string, manufacturerName: string | null, data: { imageUrl?: string | null }): Promise<ItemGroup> {
    const conditions = manufacturerName
      ? and(eq(itemGroups.categoryId, categoryId), eq(itemGroups.baseItemName, baseItemName), eq(itemGroups.manufacturerName, manufacturerName))
      : and(eq(itemGroups.categoryId, categoryId), eq(itemGroups.baseItemName, baseItemName), isNull(itemGroups.manufacturerName));
    const [existing] = await db.select().from(itemGroups).where(conditions);
    if (existing) {
      const [updated] = await db.update(itemGroups)
        .set({ imageUrl: data.imageUrl ?? null, updatedAt: new Date() })
        .where(eq(itemGroups.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(itemGroups)
      .values({ categoryId, baseItemName, manufacturerName, imageUrl: data.imageUrl ?? null, sortOrder: 999_999 })
      .returning();
    return created;
  }

  async updateFamilyGroupOrder(categoryId: number, orders: { baseItemName: string; manufacturerName: string | null; sortOrder: number }[]): Promise<void> {
    const existing = await db.select().from(itemGroups).where(eq(itemGroups.categoryId, categoryId));
    for (const { baseItemName, manufacturerName, sortOrder } of orders) {
      const rec = existing.find(g =>
        g.baseItemName === baseItemName &&
        (manufacturerName ? g.manufacturerName === manufacturerName : !g.manufacturerName)
      );
      if (rec) {
        await db.update(itemGroups)
          .set({ sortOrder, updatedAt: new Date() })
          .where(eq(itemGroups.id, rec.id));
      } else {
        await db.insert(itemGroups)
          .values({ categoryId, baseItemName, manufacturerName, sortOrder, imageUrl: null });
      }
    }
  }

  async renameFamily(categoryId: number, oldName: string, newName: string, manufacturerName?: string | null): Promise<void> {
    const itemWhere = manufacturerName
      ? and(eq(items.categoryId, categoryId), eq(items.baseItemName, oldName), eq(items.isActive, true), eq(items.manufacturer, manufacturerName))
      : and(eq(items.categoryId, categoryId), eq(items.baseItemName, oldName), eq(items.isActive, true));
    await db.update(items)
      .set({ baseItemName: newName, updatedAt: new Date() })
      .where(itemWhere);
    const groupWhere = manufacturerName
      ? and(eq(itemGroups.categoryId, categoryId), eq(itemGroups.baseItemName, oldName), eq(itemGroups.manufacturerName, manufacturerName))
      : and(eq(itemGroups.categoryId, categoryId), eq(itemGroups.baseItemName, oldName), isNull(itemGroups.manufacturerName));
    const [existing] = await db.select().from(itemGroups).where(groupWhere);
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

  async familyExistsInCategory(categoryId: number, baseItemName: string): Promise<boolean> {
    const [row] = await db.select({ id: items.id }).from(items)
      .where(and(eq(items.categoryId, categoryId), eq(items.baseItemName, baseItemName), eq(items.isActive, true)))
      .limit(1);
    return !!row;
  }

  async moveFamilyToCategory(fromCategoryId: number, baseItemName: string, toCategoryId: number): Promise<number> {
    const result = await db.update(items)
      .set({ categoryId: toCategoryId, updatedAt: new Date() })
      .where(and(eq(items.categoryId, fromCategoryId), eq(items.baseItemName, baseItemName), eq(items.isActive, true)))
      .returning({ id: items.id });
    const [existing] = await db.select().from(itemGroups)
      .where(and(eq(itemGroups.categoryId, fromCategoryId), eq(itemGroups.baseItemName, baseItemName)));
    if (existing) {
      await db.update(itemGroups)
        .set({ categoryId: toCategoryId, updatedAt: new Date() })
        .where(eq(itemGroups.id, existing.id));
    }
    return result.length;
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
      // Support both new format (R-MC-008-4CG-001 → last 3 digits after dash)
      // and old format (ITEM-SIZE-BRAND-R12 → digits after R at end)
      const newFmtMatch = r.reelId.match(/-(\d{3})$/);
      const oldFmtMatch = r.reelId.match(/R(\d+)$/i);
      const match = newFmtMatch || oldFmtMatch;
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

  async getWireReelsByItemIds(itemIds: number[]): Promise<Map<number, string[]>> {
    if (itemIds.length === 0) return new Map();
    const rows = await db
      .select({ itemId: wireReels.itemId, reelId: wireReels.reelId })
      .from(wireReels)
      .where(and(inArray(wireReels.itemId, itemIds), eq(wireReels.isActive, true)))
      .orderBy(asc(wireReels.createdAt));
    const result = new Map<number, string[]>();
    for (const row of rows) {
      const list = result.get(row.itemId) ?? [];
      list.push(row.reelId);
      result.set(row.itemId, list);
    }
    return result;
  }

  async getWireReelExportData(itemIds: number[]): Promise<Map<number, Array<{ reelId: string; lengthFt: number }>>> {
    if (itemIds.length === 0) return new Map();
    const rows = await db
      .select({ itemId: wireReels.itemId, reelId: wireReels.reelId, lengthFt: wireReels.lengthFt })
      .from(wireReels)
      .where(and(inArray(wireReels.itemId, itemIds), eq(wireReels.isActive, true)))
      .orderBy(asc(wireReels.createdAt));
    const result = new Map<number, Array<{ reelId: string; lengthFt: number }>>();
    for (const row of rows) {
      const list = result.get(row.itemId) ?? [];
      list.push({ reelId: row.reelId, lengthFt: Number(row.lengthFt ?? 0) });
      result.set(row.itemId, list);
    }
    return result;
  }

  async getItemGroupImages(): Promise<Map<string, string>> {
    const rows = await db
      .select({ categoryId: itemGroups.categoryId, baseItemName: itemGroups.baseItemName, imageUrl: itemGroups.imageUrl })
      .from(itemGroups);
    const map = new Map<string, string>();
    for (const row of rows) {
      if (row.imageUrl) map.set(`${row.categoryId}:${row.baseItemName}`, row.imageUrl);
    }
    return map;
  }

  async getItemGroupSortOrders(): Promise<Map<string, number>> {
    const rows = await db
      .select({ categoryId: itemGroups.categoryId, baseItemName: itemGroups.baseItemName, sortOrder: itemGroups.sortOrder })
      .from(itemGroups);
    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(`${row.categoryId}:${row.baseItemName}`, row.sortOrder ?? 1_000_000);
    }
    return map;
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

  async confirmDraft(id: number, performedBy: string | null): Promise<number[]> {
    const draft = await this.getDraft(id);
    if (!draft) throw new Error("Draft not found");

    const draftItems: Array<{ itemId: number; qty: number; reelSelections?: Record<string, number>; newReels?: Array<{ reelId: string; lengthFt: number; brand?: string | null; locationId?: number | null; status?: string }> }> = JSON.parse(draft.itemsJson || "[]");

    const createdMovementIds: number[] = [];

    await db.transaction(async (tx) => {
      for (const di of draftItems) {
        // Use tx so we see uncommitted writes from earlier iterations in this loop
        const [itemRow] = await tx
          .select()
          .from(items)
          .where(eq(items.id, di.itemId))
          .limit(1);
        if (!itemRow) throw new Error(`아이템 ${di.itemId}을(를) 찾을 수 없습니다 — 출고 확정 취소`);

        const qty = di.qty;
        const movementType = draft.movementType;
        let newQty = itemRow.quantityOnHand;

        if (movementType === "receive" || movementType === "return") newQty += qty;
        else if (movementType === "issue") {
          newQty -= qty;
          if (newQty < 0) throw new Error(`재고 부족: ${itemRow.name} (현재 ${itemRow.quantityOnHand}, 요청 ${qty}) — 출고 확정 취소`);
        }
        else if (movementType === "adjust") newQty = qty;

        const created = await this.createInventoryMovement({
          itemId: itemRow.id,
          movementType,
          quantity: qty,
          previousQuantity: itemRow.quantityOnHand,
          newQuantity: newQty,
          sourceLocationId: draft.sourceLocationId ?? null,
          destinationLocationId: draft.destinationLocationId ?? null,
          projectId: draft.projectId ?? null,
          unitCostSnapshot: itemRow.unitCost,
          note: draft.note ?? null,
          reason: null,
          referenceType: "draft",
          referenceId: String(id),
          createdBy: performedBy,
        }, tx);
        createdMovementIds.push(created.id);

        if (movementType === "issue" && di.reelSelections) {
          for (const [reelIdStr, ftUsed] of Object.entries(di.reelSelections)) {
            if (!ftUsed) continue;
            const reelId = Number(reelIdStr);
            const [reelRow] = await tx.select().from(wireReels).where(eq(wireReels.id, reelId)).limit(1);
            if (!reelRow) continue;
            const newLength = reelRow.lengthFt - ftUsed;
            if (newLength <= 0) {
              await tx.delete(wireReels).where(eq(wireReels.id, reelId));
            } else {
              await tx.update(wireReels).set({ lengthFt: newLength, status: "used", updatedAt: new Date() }).where(eq(wireReels.id, reelId));
            }
            // Record reel-level movement line (snapshot at time of issue)
            await tx.insert(wireReelMovementLines).values({
              movementId: created.id,
              itemId: itemRow.id,
              wireReelId: reelId,
              reelIdText: reelRow.reelId,
              actionType: "issue",
              quantityFt: ftUsed,
              manufacturerSnapshot: reelRow.brand ?? null,
              supplierId: null,
              projectId: draft.projectId ?? null,
              fromLocationId: draft.sourceLocationId ?? null,
              toLocationId: draft.destinationLocationId ?? null,
            });
          }
        }
        if ((movementType === "receive" || movementType === "return") && di.newReels?.length) {
          for (const nr of di.newReels) {
            const destLocationId = nr.locationId ?? draft.destinationLocationId ?? draft.sourceLocationId ?? null;
            const [insertedReel] = await tx.insert(wireReels).values({
              itemId: itemRow.id,
              reelId: nr.reelId,
              lengthFt: nr.lengthFt,
              brand: nr.brand ?? null,
              locationId: destLocationId,
              status: (nr.status ?? "full") as any,
            }).returning();
            // Record reel-level movement line
            await tx.insert(wireReelMovementLines).values({
              movementId: created.id,
              itemId: itemRow.id,
              wireReelId: insertedReel?.id ?? null,
              reelIdText: nr.reelId,
              actionType: movementType, // "receive" or "return"
              quantityFt: nr.lengthFt,
              manufacturerSnapshot: nr.brand ?? null,
              supplierId: null, // draft does not carry supplierId; stored on wire_reels.supplierId per reel
              projectId: movementType === "return" ? (draft.projectId ?? null) : null,
              fromLocationId: movementType === "return" ? (draft.sourceLocationId ?? null) : null,
              toLocationId: destLocationId,
            });
          }
        }
      }

      await tx.delete(movementDrafts).where(eq(movementDrafts.id, id));
    });

    return createdMovementIds;
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

  async getMovementsByReference(referenceType: string, referenceId: string): Promise<InventoryMovement[]> {
    return db.select().from(inventoryMovements)
      .where(and(eq(inventoryMovements.referenceType, referenceType), eq(inventoryMovements.referenceId, referenceId)));
  }

  async undoMaterialRequestCompletion(id: number): Promise<MaterialRequest> {
    const [updated] = await db.update(materialRequests)
      .set({ status: "ready", fulfilledMovementId: null })
      .where(eq(materialRequests.id, id))
      .returning();
    return updated;
  }

  // ─── RMS Export History ────────────────────────────────────────────────────
  async createRmsExportHistory(
    header: CreateRmsExportHistory,
    lines: Omit<CreateRmsExportHistoryItem, "historyId">[],
  ): Promise<RmsExportHistory> {
    return await db.transaction(async (tx) => {
      // Serialise concurrent exports for the same PO with a pg advisory lock
      // so poSeq is always unique per PO even under parallel requests.
      const lockKey = header.poNumber ?? "";
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`);
      const poFilter = header.poNumber
        ? eq(rmsExportHistory.poNumber, header.poNumber)
        : isNull(rmsExportHistory.poNumber);
      const [{ maxSeq }] = await tx
        .select({ maxSeq: sql<number | null>`max(po_seq)` })
        .from(rmsExportHistory)
        .where(poFilter);
      const headerWithSeq = { ...header, poSeq: (maxSeq ?? 0) + 1 };
      const [created] = await tx.insert(rmsExportHistory).values(headerWithSeq).returning();
      if (lines.length > 0) {
        await tx.insert(rmsExportHistoryItems).values(
          lines.map((l, i) => ({ ...l, historyId: created.id, sortOrder: l.sortOrder ?? i })),
        );
      }
      return created;
    });
  }

  async getNextRmsSeq(poNumber: string | null | undefined): Promise<number> {
    const poFilter = poNumber
      ? eq(rmsExportHistory.poNumber, poNumber)
      : isNull(rmsExportHistory.poNumber);
    const [{ maxSeq }] = await db
      .select({ maxSeq: sql<number | null>`max(po_seq)` })
      .from(rmsExportHistory)
      .where(poFilter);
    return (maxSeq ?? 0) + 1;
  }

  async listRmsExportHistory(limit = 200): Promise<RmsExportHistory[]> {
    return await db.select().from(rmsExportHistory).orderBy(desc(rmsExportHistory.exportedAt)).limit(limit);
  }

  async getRmsExportHistoryDetail(id: number): Promise<RmsExportHistoryWithLines | undefined> {
    const [header] = await db.select().from(rmsExportHistory).where(eq(rmsExportHistory.id, id));
    if (!header) return undefined;
    const rawLines = await db.select().from(rmsExportHistoryItems)
      .where(eq(rmsExportHistoryItems.historyId, id))
      .orderBy(asc(rmsExportHistoryItems.sortOrder), asc(rmsExportHistoryItems.id));
    const itemIds = Array.from(new Set(rawLines.map((l) => l.itemId).filter((v): v is number => v != null)));
    const imageRows = itemIds.length
      ? await db.select({ itemId: itemImages.itemId, imageUrl: itemImages.imageUrl, sortOrder: itemImages.sortOrder })
          .from(itemImages)
          .where(inArray(itemImages.itemId, itemIds))
          .orderBy(asc(itemImages.sortOrder), asc(itemImages.id))
      : [];
    const firstImageByItem = new Map<number, string>();
    for (const img of imageRows) {
      if (!firstImageByItem.has(img.itemId)) firstImageByItem.set(img.itemId, img.imageUrl);
    }
    const lines = rawLines.map((l) => ({
      ...l,
      itemImageUrl: l.itemId != null ? firstImageByItem.get(l.itemId) ?? null : null,
    }));
    return { ...header, lines };
  }

  async updateRmsExportHistory(
    id: number,
    patch: Partial<Pick<CreateRmsExportHistory, "requestFrom" | "poNumber" | "projectName" | "completionDate" | "deliveryTo">>,
  ): Promise<RmsExportHistory | undefined> {
    if (Object.keys(patch).length === 0) {
      const [existing] = await db.select().from(rmsExportHistory).where(eq(rmsExportHistory.id, id));
      return existing;
    }
    const [updated] = await db.update(rmsExportHistory)
      .set(patch)
      .where(eq(rmsExportHistory.id, id))
      .returning();
    return updated;
  }

  async updateRmsExportHistoryItems(
    historyId: number,
    updates: Array<{ id: number; qty: number; sortOrder: number }>,
  ): Promise<void> {
    if (updates.length === 0) return;
    await db.transaction(async (tx) => {
      for (const u of updates) {
        await tx.update(rmsExportHistoryItems)
          .set({ qty: u.qty, sortOrder: u.sortOrder })
          .where(and(eq(rmsExportHistoryItems.id, u.id), eq(rmsExportHistoryItems.historyId, historyId)));
      }
    });
  }

  async addRmsExportHistoryItem(
    historyId: number,
    item: Omit<CreateRmsExportHistoryItem, "historyId" | "sortOrder">,
  ): Promise<RmsExportHistoryWithLines> {
    return this.addRmsExportHistoryItems(historyId, [item]);
  }

  async addRmsExportHistoryItems(
    historyId: number,
    items: Omit<CreateRmsExportHistoryItem, "historyId" | "sortOrder">[],
  ): Promise<RmsExportHistoryWithLines> {
    if (items.length === 0) {
      const detail = await this.getRmsExportHistoryDetail(historyId);
      if (!detail) throw new Error("History record not found");
      return detail;
    }
    const [{ maxSort }] = await db
      .select({ maxSort: sql<number | null>`max(sort_order)` })
      .from(rmsExportHistoryItems)
      .where(eq(rmsExportHistoryItems.historyId, historyId));
    const base = (maxSort ?? -1) + 1;
    await db.insert(rmsExportHistoryItems).values(
      items.map((item, i) => ({ ...item, historyId, sortOrder: base + i })),
    );
    const detail = await this.getRmsExportHistoryDetail(historyId);
    if (!detail) throw new Error("History record not found after insert");
    return detail;
  }

  async deleteRmsExportHistoryItem(historyId: number, itemId: number): Promise<void> {
    await db.delete(rmsExportHistoryItems)
      .where(and(eq(rmsExportHistoryItems.id, itemId), eq(rmsExportHistoryItems.historyId, historyId)));
  }

  async updateRmsExportHistoryStatus(id: number, status: string): Promise<RmsExportHistory | undefined> {
    const [updated] = await db.update(rmsExportHistory)
      .set({ status })
      .where(eq(rmsExportHistory.id, id))
      .returning();
    return updated;
  }

  async deleteRmsExportHistory(ids: number[]): Promise<number> {
    if (ids.length === 0) return 0;
    const deleted = await db.delete(rmsExportHistory)
      .where(inArray(rmsExportHistory.id, ids))
      .returning({ id: rmsExportHistory.id });
    return deleted.length;
  }

  async getReelIdPreview(): Promise<ReelIdPreviewRow[]> {
    const rows = await db
      .select({
        reelId: wireReels.reelId,
        reelDbId: wireReels.id,
        itemId: wireReels.itemId,
        reelNotes: wireReels.notes,
        itemName: items.name,
        sizeLabel: items.sizeLabel,
        isActive: wireReels.isActive,
      })
      .from(wireReels)
      .leftJoin(items, eq(wireReels.itemId, items.id))
      .where(eq(wireReels.isActive, true));

    type IntermRow = ReelIdPreviewRow & { _proposed: string };
    const interim: IntermRow[] = [];

    for (const row of rows) {
      const currentReelId = row.reelId;

      if (NEW_REEL_FORMAT.test(currentReelId)) {
        interim.push({
          reelDbId: row.reelDbId,
          currentReelId,
          proposedReelId: currentReelId,
          itemId: row.itemId ?? 0,
          itemName: row.itemName ?? "(missing)",
          sizeLabel: row.sizeLabel ?? null,
          coreCode: "SC", sizeCode: "", configCode: "",
          sequence: _extractSeqFromReelId(currentReelId),
          status: "already_new_format",
          reason: "Already matches new format",
          _proposed: currentReelId,
        });
        continue;
      }

      if (!row.itemName) {
        interim.push({
          reelDbId: row.reelDbId,
          currentReelId,
          proposedReelId: currentReelId,
          itemId: row.itemId ?? 0,
          itemName: "(missing)", sizeLabel: null,
          coreCode: "SC", sizeCode: "UNK", configCode: "UNK",
          sequence: null,
          status: "missing_item",
          reason: "Item record not found",
          _proposed: currentReelId,
        });
        continue;
      }

      const seq = _extractSeqFromReelId(currentReelId);
      if (seq === null) {
        interim.push({
          reelDbId: row.reelDbId,
          currentReelId,
          proposedReelId: currentReelId,
          itemId: row.itemId ?? 0,
          itemName: row.itemName,
          sizeLabel: row.sizeLabel ?? null,
          coreCode: "SC", sizeCode: "UNK", configCode: "UNK",
          sequence: null,
          status: "invalid_sequence",
          reason: "Cannot extract sequence number from current Reel ID",
          _proposed: currentReelId,
        });
        continue;
      }

      const { coreCode, sizeCode, configCode } = _deriveReelIdParts(row.itemName, row.sizeLabel ?? null);
      const seqStr = String(seq).padStart(3, "0");
      const proposed = `R-${coreCode}-${sizeCode}-${configCode}-${seqStr}`;
      const hasUnk = sizeCode === "UNK" || configCode === "UNK";
      interim.push({
        reelDbId: row.reelDbId,
        currentReelId,
        proposedReelId: proposed,
        itemId: row.itemId ?? 0,
        itemName: row.itemName,
        sizeLabel: row.sizeLabel ?? null,
        coreCode, sizeCode, configCode,
        sequence: seq,
        status: hasUnk ? "ambiguous" : "ready",
        reason: hasUnk
          ? `Unknown ${sizeCode === "UNK" ? "size" : ""}${sizeCode === "UNK" && configCode === "UNK" ? " + " : ""}${configCode === "UNK" ? "config/color" : ""} — review required`
          : `Will rename to ${proposed}`,
        _proposed: proposed,
      });
    }

    // Fetch ALL reel IDs globally (active + inactive) for complete conflict detection
    const allReelIdRows = await db.select({ id: wireReels.id, reelId: wireReels.reelId }).from(wireReels);
    const globalReelIds = new Map<string, number>(); // reelId → dbId
    for (const r of allReelIdRows) globalReelIds.set(r.reelId, r.id);

    const proposedCount = new Map<string, number>();
    for (const r of interim) {
      if (r.status === "ready" || r.status === "ambiguous") {
        proposedCount.set(r._proposed, (proposedCount.get(r._proposed) ?? 0) + 1);
      }
    }

    return interim.map(r => {
      if (r.status !== "ready" && r.status !== "ambiguous") {
        const { _proposed, ...rest } = r; return rest;
      }
      const dupCount = proposedCount.get(r._proposed) ?? 1;
      const existingDbId = globalReelIds.get(r._proposed);
      const conflictsWithExisting = existingDbId !== undefined && existingDbId !== r.reelDbId;
      if (dupCount > 1 || conflictsWithExisting) {
        const { _proposed, ...rest } = r;
        return { ...rest, status: "conflict" as const,
          reason: conflictsWithExisting
            ? `Proposed ID conflicts with existing reel: ${r._proposed}`
            : `Multiple reels would get the same ID: ${r._proposed}` };
      }
      const { _proposed, ...rest } = r;
      return rest;
    });
  }

  async renameReelIds(reelIds: number[]): Promise<{ updated: number; skipped: number; errors: string[] }> {
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];
    const today = new Date().toISOString().slice(0, 10);

    type PendingRename = {
      reelDbId: number;
      currentId: string;
      proposed: string;
      notes: string | null;
    };

    await db.transaction(async (tx) => {
      // ── Phase 1: classify all submitted reels (mirrors preview "ready" logic) ──
      const pending: PendingRename[] = [];
      const proposalCount = new Map<string, number>(); // proposed ID → count within batch

      for (const reelDbId of reelIds) {
        const [reel] = await tx
          .select()
          .from(wireReels)
          .leftJoin(items, eq(wireReels.itemId, items.id))
          .where(eq(wireReels.id, reelDbId));

        if (!reel) { errors.push(`Reel #${reelDbId} not found`); skipped++; continue; }
        const currentId = reel.wire_reels.reelId;
        const itemName = reel.items?.name ?? "";
        const sizeLabel = reel.items?.sizeLabel ?? null;

        if (NEW_REEL_FORMAT.test(currentId)) { skipped++; continue; }
        if (!itemName) { errors.push(`${currentId}: item record not found — cannot rename`); skipped++; continue; }

        const seq = _extractSeqFromReelId(currentId);
        if (seq === null) { errors.push(`${currentId}: cannot extract sequence`); skipped++; continue; }

        const { coreCode, sizeCode, configCode } = _deriveReelIdParts(itemName, sizeLabel);
        if (sizeCode === "UNK" || configCode === "UNK") {
          errors.push(`${currentId}: ambiguous (size or config unknown) — skipped`);
          skipped++; continue;
        }

        const seqStr = String(seq).padStart(3, "0");
        const proposed = `R-${coreCode}-${sizeCode}-${configCode}-${seqStr}`;
        pending.push({ reelDbId, currentId, proposed, notes: reel.wire_reels.notes });
        proposalCount.set(proposed, (proposalCount.get(proposed) ?? 0) + 1);
      }

      // ── Phase 2: apply renames (skip batch dups + global conflicts) ──
      for (const { reelDbId, currentId, proposed, notes } of pending) {
        if ((proposalCount.get(proposed) ?? 1) > 1) {
          errors.push(`${currentId}: proposed ${proposed} conflicts with another reel in this batch — skipped`);
          skipped++; continue;
        }

        const [existing] = await tx
          .select({ id: wireReels.id })
          .from(wireReels)
          .where(and(eq(wireReels.reelId, proposed), ne(wireReels.id, reelDbId)));
        if (existing) { errors.push(`${currentId}: proposed ${proposed} already in use`); skipped++; continue; }

        const existingNotes = (notes || "").trim();
        const note = `Reel ID renamed from ${currentId} to ${proposed} on ${today}.`;
        const newNotes = existingNotes ? `${existingNotes}\n${note}` : note;

        await tx
          .update(wireReels)
          .set({ reelId: proposed, notes: newNotes })
          .where(eq(wireReels.id, reelDbId));

        updated++;
      }
    });

    return { updated, skipped, errors };
  }
}

// ─── One-time sizeSortValue backfill ─────────────────────────────────────────
// Computes and stores sizeSortValue for every active item that currently has
// sizeSortValue=0 and a non-empty sizeLabel.  Idempotent: items whose value is
// already set (≠ 0) are skipped.  Items whose sizeLabel can't be parsed to a
// meaningful sort number (result = 999999) are also skipped so we don't write
// a useless sentinel into the DB.
// Called once at server startup; subsequent calls are near-zero-cost because
// the WHERE clause matches nothing once all items are backfilled.
export async function backfillSizeSortValues(): Promise<void> {
  const rows = await db
    .select({ id: items.id, sizeLabel: items.sizeLabel })
    .from(items)
    .where(
      and(
        eq(items.isActive, true),
        or(eq(items.sizeSortValue, 0), sql`${items.sizeSortValue} IS NULL`),
        sql`${items.sizeLabel} IS NOT NULL AND trim(${items.sizeLabel}) <> ''`,
      ),
    );

  if (rows.length === 0) return;

  const updates: { id: number; val: number }[] = [];
  for (const row of rows) {
    const val = parseSizeLabelForSort(row.sizeLabel!);
    if (val !== 999999) updates.push({ id: row.id, val });
  }

  if (updates.length === 0) return;

  // Batch into chunks of 200 to stay well under any parameter-count limits.
  const CHUNK = 200;
  for (let i = 0; i < updates.length; i += CHUNK) {
    const chunk = updates.slice(i, i + CHUNK);
    await Promise.all(
      chunk.map(({ id, val }) =>
        db.update(items)
          .set({ sizeSortValue: val })
          .where(eq(items.id, id)),
      ),
    );
  }

  console.log(`[backfill] sizeSortValue set for ${updates.length} item(s) (${rows.length - updates.length} skipped — unparseable label)`);
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

// ── Reel ID cleanup helpers ────────────────────────────────────────────────

const NEW_REEL_FORMAT = /^R-(MC|SC)-[A-Z0-9]+-[A-Z0-9]+-\d{3}$/;

function _normalizeSizeCode(sizeLabel: string | null | undefined): string {
  const raw = (sizeLabel || "").trim();
  if (!raw) return "UNK";
  const cleaned = raw.replace(/^#/, "").replace(/\s+/g, "").replace(/["']/g, "");
  if (cleaned === "1/0") return "10";
  if (cleaned === "2/0") return "20";
  if (cleaned === "3/0") return "30";
  if (cleaned === "4/0") return "40";
  if (/^\d+$/.test(cleaned)) {
    const n = parseInt(cleaned, 10);
    return n >= 250 ? String(n) : String(n).padStart(3, "0");
  }
  const safe = cleaned.replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 6);
  return safe || "UNK";
}

function _deriveReelIdParts(itemName: string, sizeLabel: string | null): {
  coreCode: "MC" | "SC"; sizeCode: string; configCode: string;
} {
  const name = (itemName || "").trim();
  const mcMatch = name.match(/\b(4C\+G|3C\+G|2C\+G|4C|3C|2C)\b/i);
  if (mcMatch) {
    const raw = mcMatch[1].toUpperCase();
    const mcMap: Record<string, string> = {
      "4C+G": "4CG", "3C+G": "3CG", "2C+G": "2CG",
      "4C": "4C", "3C": "3C", "2C": "2C",
    };
    return { coreCode: "MC", sizeCode: _normalizeSizeCode(sizeLabel), configCode: mcMap[raw] || "UNK" };
  }
  const colorMap: [RegExp, string][] = [
    [/\b(green|grn|ground)\b/i, "GRN"],
    [/\b(black|blk)\b/i, "BLK"],
    [/\b(white|wht)\b/i, "WHT"],
    [/\b(red)\b/i, "RED"],
    [/\b(blue|blu)\b/i, "BLU"],
    [/\b(brown)\b/i, "BRN"],
    [/\b(orange)\b/i, "ORG"],
    [/\b(yellow|yel)\b/i, "YEL"],
    [/\b(gray|grey)\b/i, "GRY"],
  ];
  const sizeCode = _normalizeSizeCode(sizeLabel);
  for (const [pattern, code] of colorMap) {
    if (pattern.test(name)) return { coreCode: "SC", sizeCode, configCode: code };
  }
  return { coreCode: "SC", sizeCode, configCode: "UNK" };
}

function _extractSeqFromReelId(reelId: string): number | null {
  const newFmt = reelId.match(/-(\d{3})$/);
  if (newFmt) return parseInt(newFmt[1], 10);
  const oldFmt = reelId.match(/R(\d+)$/i);
  if (oldFmt) return parseInt(oldFmt[1], 10);
  return null;
}
export const storage = new DatabaseStorage();
