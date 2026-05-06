import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import { execSync } from "child_process";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

/**
 * Synchronously scan the local subnet for a host listening on port 5432.
 * Used as a fallback when the "helium" hostname fails to resolve via DNS.
 * Derives the subnet prefix from /etc/hosts (host.docker.internal entry).
 */
function findPostgresIpSync(): string | null {
  let base = "172.31.80.";
  try {
    const hosts = execSync("cat /etc/hosts", { encoding: "utf8", timeout: 1000 });
    const match = hosts.match(/(\d+\.\d+\.\d+)\.\d+\s+host\.docker\.internal/);
    if (match) base = match[1] + ".";
  } catch { /* use default */ }

  const scanScript = [
    "const net=require('net'),base='" + base + "',ips=[];",
    "for(let c=1;c<254;c++)ips.push(base+c);",
    "let d=0,f=false;",
    "function chk(){if(++d===ips.length&&!f)process.exit(1);}",
    "ips.forEach(ip=>{",
    "const s=new net.Socket();s.setTimeout(450);",
    "s.on('connect',()=>{if(!f){f=true;process.stdout.write(ip);process.exit(0);}s.destroy();});",
    "s.on('error',chk);s.on('timeout',()=>{s.destroy();chk();});",
    "s.connect(5432,ip);});",
  ].join("");

  try {
    const ip = execSync(`node -e "${scanScript}"`, { timeout: 8000, encoding: "utf8" });
    return ip.trim() || null;
  } catch {
    return null;
  }
}

export function resolvedDbUrl(): string {
  const url = process.env.DATABASE_URL!;
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "helium") return url;

    // Fast path: check if DNS already resolves helium
    try {
      execSync("getent hosts helium", { timeout: 1000, stdio: "pipe" });
      return url;
    } catch { /* DNS failed — fall through to port scan */ }

    console.log("[db] helium DNS not found — scanning subnet for PostgreSQL…");
    const ip = findPostgresIpSync();
    if (ip) {
      console.log(`[db] PostgreSQL found at ${ip}`);
      parsed.hostname = ip;
      return parsed.toString();
    }
    console.warn("[db] PostgreSQL not found on subnet — trying original URL");
  } catch { /* URL parse error — return as-is */ }
  return url;
}

export const pool = new Pool({ connectionString: resolvedDbUrl() });
export const db = drizzle(pool, { schema });
