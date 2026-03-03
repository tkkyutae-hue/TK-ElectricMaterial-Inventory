import { sql } from "drizzle-orm";
import { pgTable, text, serial, integer, boolean, timestamp, numeric } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./models/auth";

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
});

export const locations = pgTable("locations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
});

export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  contactPerson: text("contact_person"),
  phone: text("phone"),
  email: text("email"),
  leadTime: integer("lead_time"),
  preferred: boolean("preferred").default(false),
  notes: text("notes"),
});

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  location: text("location"),
  active: boolean("active").default(true),
});

export const items = pgTable("items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sku: text("sku").notNull().unique(),
  categoryId: integer("category_id").references(() => categories.id),
  subcategory: text("subcategory"),
  description: text("description"),
  brand: text("brand"),
  unit: text("unit").notNull(),
  quantityOnHand: integer("quantity_on_hand").notNull().default(0),
  minStock: integer("min_stock").notNull().default(0),
  reorderPoint: integer("reorder_point").notNull().default(0),
  reorderQuantity: integer("reorder_quantity").notNull().default(0),
  locationId: integer("location_id").references(() => locations.id),
  bin: text("bin"),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  cost: numeric("cost", { precision: 10, scale: 2 }),
  status: text("status").notNull().default('in_stock'),
  notes: text("notes"),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").notNull().references(() => items.id),
  actionType: text("action_type").notNull(), // 'receive', 'issue', 'return', 'adjust', 'transfer'
  quantity: integer("quantity").notNull(),
  userId: text("user_id").references(() => users.id),
  sourceLocationId: integer("source_location_id").references(() => locations.id),
  destinationLocationId: integer("destination_location_id").references(() => locations.id),
  projectId: integer("project_id").references(() => projects.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Zod schemas
export const insertCategorySchema = createInsertSchema(categories).omit({ id: true });
export const insertLocationSchema = createInsertSchema(locations).omit({ id: true });
export const insertSupplierSchema = createInsertSchema(suppliers).omit({ id: true });
export const insertProjectSchema = createInsertSchema(projects).omit({ id: true });
export const insertItemSchema = createInsertSchema(items).omit({ id: true, lastUpdated: true }).extend({
  cost: z.union([z.string(), z.number()]).transform(val => String(val)).optional(),
});
export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, createdAt: true });

// Types
export type Category = typeof categories.$inferSelect;
export type Location = typeof locations.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Item = typeof items.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;

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

export type CreateTransactionRequest = z.infer<typeof insertTransactionSchema>;

export type ItemWithRelations = Item & {
  category?: Category | null;
  location?: Location | null;
  supplier?: Supplier | null;
};

export type TransactionWithRelations = Transaction & {
  item?: Item | null;
  user?: typeof users.$inferSelect | null;
  sourceLocation?: Location | null;
  destinationLocation?: Location | null;
  project?: Project | null;
};
