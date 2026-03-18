import { sql } from "drizzle-orm";
import { pgTable, text, serial, integer, boolean, timestamp, numeric, date, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./models/auth";

// ─── Reference Tables ────────────────────────────────────────────────────────

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  code: text("code"),
  description: text("description"),
  imageUrl: text("image_url"),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const locations = pgTable("locations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  code: text("code"),
  locationType: text("location_type"),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  contactName: text("contact_name"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  website: text("website"),
  accountNumber: text("account_number"),
  leadTimeDays: integer("lead_time_days"),
  preferredVendor: boolean("preferred_vendor").default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Projects ────────────────────────────────────────────────────────────────

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  customerName: text("customer_name"),
  addressLine1: text("address_line_1"),
  addressLine2: text("address_line_2"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  status: text("status").notNull().default("active"), // active, completed, on_hold, cancelled
  poNumber: text("po_number"),
  ownerName: text("owner_name"),
  jobLocation: text("job_location"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Items ───────────────────────────────────────────────────────────────────

export const items = pgTable("items", {
  id: serial("id").primaryKey(),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  categoryId: integer("category_id").references(() => categories.id),
  subcategory: text("subcategory"),
  detailType: text("detail_type"),
  subType: text("sub_type"),
  description: text("description"),
  brand: text("brand"),
  manufacturer: text("manufacturer"),
  unitOfMeasure: text("unit_of_measure").notNull(),
  // quantity_on_hand is maintained as a total across all location balances
  quantityOnHand: integer("quantity_on_hand").notNull().default(0),
  minimumStock: integer("minimum_stock").notNull().default(0),
  reorderPoint: integer("reorder_point").notNull().default(0),
  reorderQuantity: integer("reorder_quantity").notNull().default(0),
  unitCost: numeric("unit_cost", { precision: 12, scale: 2 }),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  primaryLocationId: integer("primary_location_id").references(() => locations.id),
  baseItemName: text("base_item_name"),
  sizeLabel: text("size_label"),
  sizeSortValue: integer("size_sort_value").default(0),
  binLocation: text("bin_location"),
  statusOverride: text("status_override"),
  isActive: boolean("is_active").default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const itemImages = pgTable("item_images", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").notNull().references(() => items.id),
  imageUrl: text("image_url").notNull(),
  altText: text("alt_text"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── Item Groups (grouped family / subcategory metadata) ─────────────────────
// Stores per-family metadata: custom image URL for the group header
export const itemGroups = pgTable("item_groups", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").notNull().references(() => categories.id),
  baseItemName: text("base_item_name").notNull(),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Inventory Location Balances ──────────────────────────────────────────────
// Source of truth for per-location stock levels
export const inventoryLocationBalances = pgTable("inventory_location_balances", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").notNull().references(() => items.id),
  locationId: integer("location_id").notNull().references(() => locations.id),
  quantityOnHand: integer("quantity_on_hand").notNull().default(0),
  minimumStock: integer("minimum_stock").default(0),
  reorderPoint: integer("reorder_point").default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Inventory Movements ──────────────────────────────────────────────────────
export const inventoryMovements = pgTable("inventory_movements", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").notNull().references(() => items.id),
  movementType: text("movement_type").notNull(), // receive, issue, return, adjust, transfer
  quantity: integer("quantity").notNull(),
  previousQuantity: integer("previous_quantity").notNull(),
  newQuantity: integer("new_quantity").notNull(),
  sourceLocationId: integer("source_location_id").references(() => locations.id),
  destinationLocationId: integer("destination_location_id").references(() => locations.id),
  projectId: integer("project_id").references(() => projects.id),
  unitCostSnapshot: numeric("unit_cost_snapshot", { precision: 12, scale: 2 }),
  referenceType: text("reference_type"),
  referenceId: text("reference_id"),
  note: text("note"),
  reason: text("reason"),
  createdBy: text("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  transactionDate: timestamp("transaction_date"),
  editedBy: text("edited_by"),
  editedAt: timestamp("edited_at"),
  editHistory: jsonb("edit_history"),
});

// ─── Project Material Transactions ────────────────────────────────────────────
export const projectMaterialTransactions = pgTable("project_material_transactions", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id),
  itemId: integer("item_id").notNull().references(() => items.id),
  movementId: integer("movement_id").references(() => inventoryMovements.id),
  transactionType: text("transaction_type").notNull(), // issue, return
  quantity: integer("quantity").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── Supplier Items ───────────────────────────────────────────────────────────
export const supplierItems = pgTable("supplier_items", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplier_id").notNull().references(() => suppliers.id),
  itemId: integer("item_id").notNull().references(() => items.id),
  supplierSku: text("supplier_sku"),
  leadTimeDays: integer("lead_time_days"),
  preferredSupplier: boolean("preferred_supplier").default(false),
  lastUnitCost: numeric("last_unit_cost", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Purchase Recommendations ─────────────────────────────────────────────────
export const purchaseRecommendations = pgTable("purchase_recommendations", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").notNull().references(() => items.id),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  recommendedQuantity: integer("recommended_quantity").notNull(),
  priorityLevel: text("priority_level").notNull().default("medium"), // critical, high, medium, low
  reason: text("reason"),
  status: text("status").notNull().default("pending"), // pending, ordered, dismissed
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Wire Reels ───────────────────────────────────────────────────────────────
// Reel-level tracking for wire/cable items (unitOfMeasure = "FT")
export const wireReels = pgTable("wire_reels", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").notNull().references(() => items.id),
  reelId: text("reel_id").notNull(),
  lengthFt: integer("length_ft").notNull().default(0),
  brand: text("brand"),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  locationId: integer("location_id").references(() => locations.id),
  status: text("status").default("full"), // "full" | "partial" | "opened"
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Movement Drafts ──────────────────────────────────────────────────────────
// Stores unsaved movement form state for later confirmation
export const movementDrafts = pgTable("movement_drafts", {
  id: serial("id").primaryKey(),
  movementType: text("movement_type").notNull(),
  sourceLocationId: integer("source_location_id").references(() => locations.id),
  destinationLocationId: integer("destination_location_id").references(() => locations.id),
  projectId: integer("project_id").references(() => projects.id),
  itemsJson: text("items_json").notNull().default("[]"),
  note: text("note"),
  savedBy: text("saved_by").references(() => users.id),
  savedByName: text("saved_by_name"),
  status: text("status").notNull().default("draft"),
  savedAt: timestamp("saved_at").defaultNow(),
});

// ─── Zod Insert Schemas ───────────────────────────────────────────────────────

export const insertCategorySchema = createInsertSchema(categories).omit({ id: true, createdAt: true, updatedAt: true });
export const insertLocationSchema = createInsertSchema(locations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSupplierSchema = createInsertSchema(suppliers).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, createdAt: true, updatedAt: true });
export const insertItemSchema = createInsertSchema(items).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  unitCost: z.union([z.string(), z.number()]).transform(val => String(val)).optional(),
});
export const insertItemImageSchema = createInsertSchema(itemImages).omit({ id: true, createdAt: true });
export const insertItemGroupSchema = createInsertSchema(itemGroups).omit({ id: true, createdAt: true, updatedAt: true });
export const insertInventoryMovementSchema = createInsertSchema(inventoryMovements).omit({
  id: true, createdAt: true, previousQuantity: true, newQuantity: true, createdBy: true
});
export const insertTransactionSchema = insertInventoryMovementSchema;
export const insertPurchaseRecommendationSchema = createInsertSchema(purchaseRecommendations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSupplierItemSchema = createInsertSchema(supplierItems).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWireReelSchema = createInsertSchema(wireReels).omit({ id: true, createdAt: true, updatedAt: true });

// ─── TypeScript Types ─────────────────────────────────────────────────────────

export type Category = typeof categories.$inferSelect;
export type Location = typeof locations.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Item = typeof items.$inferSelect;
export type ItemImage = typeof itemImages.$inferSelect;
export type InventoryMovement = typeof inventoryMovements.$inferSelect;
export type InventoryLocationBalance = typeof inventoryLocationBalances.$inferSelect;
export type ProjectMaterialTransaction = typeof projectMaterialTransactions.$inferSelect;
export type SupplierItem = typeof supplierItems.$inferSelect;
export type PurchaseRecommendation = typeof purchaseRecommendations.$inferSelect;
export type ItemGroup = typeof itemGroups.$inferSelect;
export type WireReel = typeof wireReels.$inferSelect;
export type WireReelWithRelations = WireReel & {
  supplier?: Supplier | null;
  location?: Location | null;
};
export type CreateWireReelRequest = z.infer<typeof insertWireReelSchema>;
export type UpdateWireReelRequest = Partial<CreateWireReelRequest>;

export type CreateCategoryRequest = z.infer<typeof insertCategorySchema>;
export type UpdateCategoryRequest = Partial<CreateCategoryRequest>;
export type CreateLocationRequest = z.infer<typeof insertLocationSchema>;
export type CreateSupplierRequest = z.infer<typeof insertSupplierSchema>;
export type UpdateSupplierRequest = Partial<CreateSupplierRequest>;
export type CreateProjectRequest = z.infer<typeof insertProjectSchema>;
export type UpdateProjectRequest = Partial<CreateProjectRequest>;
export type CreateItemRequest = z.infer<typeof insertItemSchema>;
export type UpdateItemRequest = Partial<CreateItemRequest>;
export type CreateInventoryMovementRequest = z.infer<typeof insertInventoryMovementSchema>;
export type CreatePurchaseRecommendationRequest = z.infer<typeof insertPurchaseRecommendationSchema>;

export type ItemWithRelations = Item & {
  category?: Category | null;
  location?: Location | null;
  supplier?: Supplier | null;
  images?: ItemImage[];
  movements?: InventoryMovement[];
  status?: string;
};

export type InventoryMovementWithRelations = InventoryMovement & {
  item?: Item | null;
  sourceLocation?: Location | null;
  destinationLocation?: Location | null;
  project?: Project | null;
};

export type ProjectWithStats = Project & {
  totalIssued?: number;
  totalReturned?: number;
  recentActivity?: InventoryMovementWithRelations[];
};

export type SupplierWithStats = Supplier & {
  itemCount?: number;
  lowStockCount?: number;
  items?: Item[];
};

export type PurchaseRecommendationWithRelations = PurchaseRecommendation & {
  item?: Item | null;
  supplier?: Supplier | null;
};

export type CategorySummary = Category & {
  skuCount: number;
  totalQuantity: number;
  lowStockCount: number;
  outOfStockCount: number;
};

export type CategoryGroupedItem = Item & {
  location?: Location | null;
  supplier?: Supplier | null;
  status: string;
};

export type CategoryItemGroup = {
  baseItemName: string;
  items: CategoryGroupedItem[];
};

export type CategoryGroupedDetail = {
  category: Category;
  skuCount: number;
  totalQuantity: number;
  lowStockCount: number;
  outOfStockCount: number;
  groups: CategoryItemGroup[];
};

export type MovementDraft = typeof movementDrafts.$inferSelect;
export type MovementDraftWithRelations = MovementDraft & {
  sourceLocation?: Location | null;
  destinationLocation?: Location | null;
  project?: Project | null;
};

export type DraftItem = {
  itemId: number;
  itemName: string;
  sku: string;
  qty: number;
  unit: string;
  reelIds?: number[];
  reelSelections?: Record<string, number>;
};

// ─── Project Scope Items ──────────────────────────────────────────────────────
// Baseline quantities for each project — used as the reference for progress tracking

export const projectScopeItems = pgTable("project_scope_items", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  itemName: text("item_name").notNull(),
  unit: text("unit").notNull(),
  estimatedQty: numeric("estimated_qty", { precision: 12, scale: 2 }).notNull().default("0"),
  category: text("category"),
  remarks: text("remarks"),
  linkedInventoryItemId: integer("linked_inventory_item_id").references(() => items.id, { onDelete: "set null" }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertProjectScopeItemSchema = createInsertSchema(projectScopeItems).omit({
  id: true, createdAt: true, updatedAt: true,
});

export type ProjectScopeItem = typeof projectScopeItems.$inferSelect;
export type CreateProjectScopeItemRequest = z.infer<typeof insertProjectScopeItemSchema>;
export type UpdateProjectScopeItemRequest = Partial<CreateProjectScopeItemRequest>;

// ─── Daily Reports ────────────────────────────────────────────────────────────

export const dailyReports = pgTable("daily_reports", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  reportDate: text("report_date").notNull(),
  reportNumber: text("report_number"),
  preparedBy: text("prepared_by"),
  status: text("status").notNull().default("draft"),
  formData: jsonb("form_data"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertDailyReportSchema = createInsertSchema(dailyReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type DailyReport = typeof dailyReports.$inferSelect;
export type CreateDailyReportRequest = z.infer<typeof insertDailyReportSchema>;
export type UpdateDailyReportRequest = Partial<CreateDailyReportRequest>;

// ─── Workers ──────────────────────────────────────────────────────────────────

export const workers = pgTable("workers", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  trade: text("trade"),
  photoUrl: text("photo_url"),
  isActive: boolean("is_active").notNull().default(true),
  // Profile fields
  gender: text("gender"),
  nationality: text("nationality"),
  workerState: text("worker_state"),
  dateOfTk: date("date_of_tk"),
  project: text("project"),
  // Evaluation fields
  skill: integer("skill"),
  control: integer("control"),
  attitude: integer("attitude"),
  specialAbility: text("special_ability"),
  skillBoard: text("skill_board"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertWorkerSchema = createInsertSchema(workers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Worker = typeof workers.$inferSelect;
export type CreateWorkerRequest = z.infer<typeof insertWorkerSchema>;
export type UpdateWorkerRequest = Partial<CreateWorkerRequest>;

// ─── Worker Attendance ────────────────────────────────────────────────────────

export const workerAttendance = pgTable("worker_attendance", {
  id: serial("id").primaryKey(),
  workerId: integer("worker_id").notNull().references(() => workers.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  status: text("status").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertWorkerAttendanceSchema = createInsertSchema(workerAttendance).omit({
  id: true, createdAt: true,
});

export type WorkerAttendance = typeof workerAttendance.$inferSelect;
export type CreateWorkerAttendanceRequest = z.infer<typeof insertWorkerAttendanceSchema>;

// ─── Worker Evaluations (History) ────────────────────────────────────────────

export const workerEvaluations = pgTable("worker_evaluations", {
  id: serial("id").primaryKey(),
  workerId: integer("worker_id").notNull().references(() => workers.id, { onDelete: "cascade" }),
  evaluationDate: date("evaluation_date").notNull(),
  evaluatorName: text("evaluator_name"),
  project: text("project"),
  skill: integer("skill"),
  control: integer("control"),
  attitude: integer("attitude"),
  attendance: integer("attendance"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertWorkerEvaluationSchema = createInsertSchema(workerEvaluations).omit({
  id: true, createdAt: true,
});

export type WorkerEvaluation = typeof workerEvaluations.$inferSelect;
export type CreateWorkerEvaluationRequest = z.infer<typeof insertWorkerEvaluationSchema>;
