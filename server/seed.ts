import { db } from "./db";
import { categories, locations } from "@shared/schema";
import { count } from "drizzle-orm";

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
    seedLog(`inserted ${DEFAULT_LOCATIONS.length} locations`);
  } else {
    seedLog(`locations already seeded (${locCount} rows) — skipping`);
  }

  seedLog("seed complete");
}
