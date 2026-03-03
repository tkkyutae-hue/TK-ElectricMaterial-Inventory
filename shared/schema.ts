import { sql } from "drizzle-orm";
import { pgTable, text, serial, integer, boolean, timestamp, numeric } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./models/auth";

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  code: text("code"),
  description: text("description"),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const locations = pgTable("locations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  code: text("code"),
  locationType: text("location_type"), // 'warehouse', 'yard', 'trailer', etc.
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
  leadTimeDays: integer("lead_time_days"),
  preferredVendor: boolean("preferred_vendor").default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  location: text("location"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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
  quantityOnHand: integer("quantity_on_hand").notNull().default(0),
  minimumStock: integer("minimum_stock").notNull().default(0),
  reorderPoint: integer("reorder_point").notNull().default(0),
  reorderQuantity: integer("reorder_quantity").notNull().default(0),
  unitCost: numeric("unit_cost", { precision: 12, scale: 2 }),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  primaryLocationId: integer("primary_location_id").references(() => locations.id),
  binLocation: text("bin_location"),
  statusOverride: text("status_override"), // e.g., 'ORDERED'
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

export const inventoryMovements = pgTable("inventory_movements", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").notNull().references(() => items.id),
  movementType: text("movement_type").notNull(), // 'receive', 'issue', 'return', 'adjust', 'transfer'
  quantity: integer("quantity").notNull(),
  previousQuantity: integer("previous_quantity").notNull(),
  newQuantity: integer("new_quantity").notNull(),
  sourceLocationId: integer("source_location_id").references(() => locations.id),
  destinationLocationId: integer("destination_location_id").references(() => locations.id),
  referenceType: text("reference_type"), // 'project', 'po', etc.
  referenceId: text("reference_id"),
  note: text("note"),
  createdBy: text("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Zod schemas
export const insertCategorySchema = createInsertSchema(categories).omit({ id: true, createdAt: true, updatedAt: true });
export const insertLocationSchema = createInsertSchema(locations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSupplierSchema = createInsertSchema(suppliers).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, createdAt: true, updatedAt: true });
export const insertItemSchema = createInsertSchema(items).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  unitCost: z.union([z.string(), z.number()]).transform(val => String(val)).optional(),
});
export const insertItemImageSchema = createInsertSchema(itemImages).omit({ id: true, createdAt: true });
export const insertInventoryMovementSchema = createInsertSchema(inventoryMovements).omit({ id: true, createdAt: true, previousQuantity: true, newQuantity: true, createdBy: true });
export const insertTransactionSchema = insertInventoryMovementSchema; // Alias for backward compatibility if needed

// Types
export type Category = typeof categories.$inferSelect;
export type Location = typeof locations.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Item = typeof items.$inferSelect;
export type ItemImage = typeof itemImages.$inferSelect;
export type InventoryMovement = typeof inventoryMovements.$inferSelect;

export type CreateCategoryRequest = z.infer<typeof insertCategorySchema>;
export type UpdateCategoryRequest = Partial<CreateCategoryRequest>;

export type CreateLocationRequest = z.infer<typeof insertLocationSchema>;
export type UpdateLocationRequest = Partial<CreateLocationRequest>;

export type CreateSupplierRequest = z.infer<typeof insertSupplierSchema>;
export type UpdateSupplierRequest = Partial<CreateSupplierRequest>;

export type CreateProjectRequest = z.infer<typeof insertProjectSchema>;
export type UpdateProjectRequest = Partial<CreateProjectRequest>;

export type CreateItemRequest = z.infer<typeof insertItemSchema>;
export type UpdateItemRequest = Partial<CreateItemRequest>;

export type CreateInventoryMovementRequest = z.infer<typeof insertInventoryMovementSchema>;

export type ItemWithRelations = Item & {
  category?: Category | null;
  location?: Location | null;
  supplier?: Supplier | null;
  images?: ItemImage[];
};

export type InventoryMovementWithRelations = InventoryMovement & {
  item?: Item | null;
  user?: typeof users.$inferSelect | null;
  sourceLocation?: Location | null;
  destinationLocation?: Location | null;
};
