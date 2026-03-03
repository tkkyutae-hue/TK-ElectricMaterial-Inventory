import { sql } from "drizzle-orm";
import { pgTable, text, serial, integer, boolean, timestamp, numeric, date } from "drizzle-orm/pg-core";
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

// ─── Zod Insert Schemas ───────────────────────────────────────────────────────

export const insertCategorySchema = createInsertSchema(categories).omit({ id: true, createdAt: true, updatedAt: true });
export const insertLocationSchema = createInsertSchema(locations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSupplierSchema = createInsertSchema(suppliers).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, createdAt: true, updatedAt: true });
export const insertItemSchema = createInsertSchema(items).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  unitCost: z.union([z.string(), z.number()]).transform(val => String(val)).optional(),
});
export const insertItemImageSchema = createInsertSchema(itemImages).omit({ id: true, createdAt: true });
export const insertInventoryMovementSchema = createInsertSchema(inventoryMovements).omit({
  id: true, createdAt: true, previousQuantity: true, newQuantity: true, createdBy: true
});
export const insertTransactionSchema = insertInventoryMovementSchema;
export const insertPurchaseRecommendationSchema = createInsertSchema(purchaseRecommendations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSupplierItemSchema = createInsertSchema(supplierItems).omit({ id: true, createdAt: true, updatedAt: true });

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
