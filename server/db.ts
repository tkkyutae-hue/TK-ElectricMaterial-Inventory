import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Replit's internal DB hostname "helium" can fail to resolve after container
// restarts or deployments. When that happens, fall back to the known LAN IP.
const HELIUM_FALLBACK_IP = "172.31.80.35";
export function resolvedDbUrl(): string {
  const url = process.env.DATABASE_URL!;
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "helium") {
      // Test if helium is already in /etc/hosts or resolves — we just apply
      // the fallback unconditionally when the hostname is the bare word "helium".
      parsed.hostname = HELIUM_FALLBACK_IP;
      return parsed.toString();
    }
  } catch {
    // If URL parsing fails, return as-is
  }
  return url;
}

export const pool = new Pool({ connectionString: resolvedDbUrl() });
export const db = drizzle(pool, { schema });
