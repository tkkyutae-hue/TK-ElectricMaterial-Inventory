// Quick verification of new TimeEntries-based sync — delete after use
import { storage } from "../server/storage";
import { getJibbleToken, fetchActiveTimeEntries } from "../server/services/jibble";

async function main() {
  const token = await getJibbleToken(storage);
  console.log("Got token:", token.slice(0, 20) + "...");

  const allWorkers = await storage.getWorkers();
  const personIds = (allWorkers as any[]).map((w) => w.jibblePersonId).filter(Boolean) as string[];
  console.log("Mapped personIds:", personIds.length, personIds);

  const result = await fetchActiveTimeEntries(token, personIds);
  console.log("\nResult:");
  console.log("  updated:", result.updated.length, result.updated);
  console.log("  invalidIds:", result.invalidIds);
  console.log("  failed:", result.failed);
}

main().catch(e => { console.error(e); process.exit(1); });
