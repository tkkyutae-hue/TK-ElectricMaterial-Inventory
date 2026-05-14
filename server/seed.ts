import { db } from "./db";
import { categories, locations, suppliers } from "@shared/schema";
import { count, eq } from "drizzle-orm";

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

// Suppliers that must exist for location linking to work
const REQUIRED_SUPPLIERS = [
  { name: "MPHUSKY", leadTimeDays: 3 },
  { name: "DWC",     leadTimeDays: 3 },
];

// location name → supplier name pairs to link (both sides looked up by name)
const LOCATION_SUPPLIER_LINKS: Array<{ locationName: string; supplierName: string }> = [
  { locationName: "C.E.S(City Electric Supply)", supplierName: "C.E.S(City Electric Supply)" },
  { locationName: "GraybaR",                     supplierName: "GraybaR"                     },
  { locationName: "KENDALL",                      supplierName: "KENDALL"                     },
  { locationName: "Home Depot",                   supplierName: "Home Depot"                  },
  { locationName: "MPHUSKY",                      supplierName: "MPHUSKY"                     },
  { locationName: "DWC",                          supplierName: "DWC"                         },
];

export async function runSeed() {
  seedLog("checking seed requirements…");

  const [{ cnt: catCount }] = await db.select({ cnt: count() }).from(categories);
  if (catCount === 0) {
    seedLog(`categories empty — inserting ${DEFAULT_CATEGORIES.length} defaults`);
    await db.insert(categories).values(DEFAULT_CATEGORIES.map(c => ({ ...c, isActive: true }))).onConflictDoNothing();
    seedLog(`inserted ${DEFAULT_CATEGORIES.length} categories`);
  } else {
    seedLog(`categories already seeded (${catCount} rows) — skipping`);
  }

  const [{ cnt: locCount }] = await db.select({ cnt: count() }).from(locations);
  if (locCount === 0) {
    seedLog(`locations empty — inserting ${DEFAULT_LOCATIONS.length} defaults`);
    await db.insert(locations).values(DEFAULT_LOCATIONS.map(l => ({ ...l, isActive: true }))).onConflictDoNothing();
    seedLog(`inserted ${DEFAULT_LOCATIONS.length} defaults`);
  } else {
    seedLog(`locations already seeded (${locCount} rows) — skipping`);
  }

  // ── Step 1: Rename "C.E.S" → "C.E.S(City Electric Supply)" ──────────────
  const [cesLoc] = await db.select().from(locations).where(eq(locations.name, "C.E.S"));
  if (cesLoc) {
    await db.update(locations)
      .set({ name: "C.E.S(City Electric Supply)", code: "C.E.S" })
      .where(eq(locations.id, cesLoc.id));
    seedLog(`renamed location "C.E.S" → "C.E.S(City Electric Supply)"`);
  }

  // ── Step 2: Ensure MPHUSKY and DWC suppliers exist ───────────────────────
  for (const sup of REQUIRED_SUPPLIERS) {
    const [existing] = await db.select().from(suppliers).where(eq(suppliers.name, sup.name));
    if (!existing) {
      await db.insert(suppliers).values({ name: sup.name, leadTimeDays: sup.leadTimeDays }).onConflictDoNothing();
      seedLog(`created supplier "${sup.name}"`);
    }
  }

  // ── Step 3: Link locations to suppliers by name ───────────────────────────
  const allLocations = await db.select().from(locations);
  const allSuppliers = await db.select().from(suppliers);

  let linked = 0;
  const missingLocations: string[] = [];
  const missingSuppliers: string[] = [];

  for (const { locationName, supplierName } of LOCATION_SUPPLIER_LINKS) {
    const loc = allLocations.find(l => l.name === locationName);
    const sup = allSuppliers.find(s => s.name === supplierName);
    if (!loc) { missingLocations.push(locationName); continue; }
    if (!sup) { missingSuppliers.push(supplierName); continue; }
    if (loc.supplierId === sup.id) { linked++; continue; }
    await db.update(locations).set({ supplierId: sup.id }).where(eq(locations.id, loc.id));
    seedLog(`linked location "${locationName}" → supplier "${supplierName}"`);
    linked++;
  }

  // ── Verification summary ──────────────────────────────────────────────────
  const [{ cnt: linkedCount }] = await db
    .select({ cnt: count() })
    .from(locations)
    .where(eq(locations.isActive, true));
  const linkedLocs = allLocations.filter(l => l.supplierId !== null);
  seedLog(`supplier-location links: ${linkedLocs.length} linked / ${linkedCount} active locations`);
  if (missingLocations.length > 0) {
    seedLog(`WARN: locations not found for linking: ${missingLocations.join(", ")}`);
  }
  if (missingSuppliers.length > 0) {
    seedLog(`WARN: suppliers not found for linking: ${missingSuppliers.join(", ")}`);
  }

  seedLog("seed complete");
}
