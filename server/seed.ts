import { db } from "./db";
import { categories, locations } from "@shared/schema";
import { users } from "@shared/models/auth";
import { sql, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

function seedLog(msg: string) {
  const t = new Date().toLocaleTimeString("en-US", { hour12: true, hour: "numeric", minute: "2-digit", second: "2-digit" });
  console.log(`${t} [seed] ${msg}`);
}

const DEFAULT_CATEGORIES = [
  { name: "Wire & Cable",         code: "WC", sortOrder: 1 },
  { name: "Conduit & Fittings",   code: "CF", sortOrder: 2 },
  { name: "Breakers & Panels",    code: "BP", sortOrder: 3 },
  { name: "Switches & Outlets",   code: "SO", sortOrder: 4 },
  { name: "Lighting",             code: "LT", sortOrder: 5 },
  { name: "Tools & Equipment",    code: "TE", sortOrder: 6 },
  { name: "Safety & PPE",         code: "SP", sortOrder: 7 },
  { name: "Connectors & Splices", code: "CS", sortOrder: 8 },
  { name: "Miscellaneous",        code: "MS", sortOrder: 9 },
];

const DEFAULT_LOCATIONS = [
  { name: "Main Warehouse", code: "WH",  locationType: "warehouse" },
  { name: "Yard Storage",   code: "YRD", locationType: "yard"      },
  { name: "Tool Room",      code: "TR",  locationType: "room"      },
  { name: "Job Trailer A",  code: "JTA", locationType: "trailer"   },
  { name: "Job Trailer B",  code: "JTB", locationType: "trailer"   },
];

async function countRows(table: string): Promise<number> {
  const result = await db.execute(sql.raw(`SELECT COUNT(*)::int AS cnt FROM ${table}`));
  const row = (result as any).rows?.[0] ?? (Array.isArray(result) ? result[0] : result);
  return Number(row?.cnt ?? row?.count ?? 0);
}

export async function runSeed() {
  seedLog("checking seed requirements…");

  // ── Categories
  const catCount = await countRows("categories");
  if (catCount === 0) {
    seedLog(`categories empty — inserting ${DEFAULT_CATEGORIES.length} defaults`);
    await db.insert(categories).values(DEFAULT_CATEGORIES.map(c => ({ ...c, isActive: true }))).onConflictDoNothing();
    seedLog(`inserted ${DEFAULT_CATEGORIES.length} categories`);
  } else {
    seedLog(`categories already seeded (${catCount} rows) — skipping`);
  }

  // ── Locations
  const locCount = await countRows("locations");
  if (locCount === 0) {
    seedLog(`locations empty — inserting ${DEFAULT_LOCATIONS.length} defaults`);
    await db.insert(locations).values(DEFAULT_LOCATIONS.map(l => ({ ...l, isActive: true }))).onConflictDoNothing();
    seedLog(`inserted ${DEFAULT_LOCATIONS.length} locations`);
  } else {
    seedLog(`locations already seeded (${locCount} rows) — skipping`);
  }

  // ── Default admin user
  const adminEmail = process.env.DEFAULT_ADMIN_EMAIL ?? "admin@tkelectric.com";
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD ?? "Admin1234";
  const [existing] = await db.select().from(users).where(eq(users.email, adminEmail));
  if (!existing) {
    seedLog(`creating default admin user (${adminEmail})`);
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await db.insert(users).values({
      email: adminEmail,
      passwordHash,
      name: "Admin",
      role: "admin",
      status: "active",
    }).onConflictDoNothing();
    seedLog(`default admin user created — email: ${adminEmail}`);
  } else if (!existing.passwordHash) {
    // Existing Replit-auth user needs password hash
    seedLog(`existing admin user found without password — setting default password`);
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await db.update(users).set({ passwordHash, name: existing.name ?? "Admin", role: "admin", status: "active" }).where(eq(users.email, adminEmail));
    seedLog(`admin user updated`);
  } else {
    seedLog(`admin user already exists (${adminEmail}) — skipping`);
  }

  seedLog("seed complete");
}
