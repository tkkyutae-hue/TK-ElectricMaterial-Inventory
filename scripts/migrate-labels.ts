import { db } from "../server/db";
import { items } from "../shared/schema";
import { eq } from "drizzle-orm";

function derivedFamily(sub: string|null|undefined, dt: string|null|undefined, name: string, base?: string|null): string {
  const s = sub || '', d = dt || '', n = name || '', b = base || n;
  if (s === 'Tray') return 'Cable Tray';
  if (s === 'Connectors') return 'Fittings';
  if (s === 'Covers') return 'Covers';
  if (s === 'EMT Conduit') return 'EMT';
  if (s === 'RMC/IMC Conduit') return 'Rigid';
  if (s === 'PVC Conduit') return 'PVC';
  if (s === 'Flex Conduit') return 'Flexible';
  if (s === 'Conduit Bodies') return 'Conduit Body';
  if (s === 'Supports') return 'Supports';
  if (s === 'THHN/THWN Single') return 'Single Conductor';
  if (!s && /\bStrap\b/i.test(b)) return 'Supports';
  if (s === 'Fittings') {
    if (d === 'General') return 'Bushing / Locknut';
    if (d === 'EMT' || (/\bEMT\b/i.test(n) && d !== 'Rigid' && d !== 'PVC')) return 'EMT';
    if (d === 'Rigid' || /\bRigid\b/i.test(n)) return 'Rigid';
    if (d === 'PVC' || /\bPVC\b/i.test(n)) return 'PVC';
    if (d === 'Flex' || /\bFlex\b|\bLiquidtight\b/i.test(n)) return 'Flexible';
    return 'Fittings';
  }
  return s;
}

function derivedType(sub: string|null|undefined, dt: string|null|undefined, base: string|null|undefined, name: string): string {
  const s = sub || '', d = dt || '', b = base || name || '';
  if (['EMT Conduit', 'RMC/IMC Conduit', 'PVC Conduit'].includes(s)) return d || 'Conduit';
  if (s === 'Flex Conduit') return /Liquidtight/i.test(b) ? 'Liquidtight Flexible' : 'Metal Flexible';
  if (s === 'Multi Conductor') {
    const m = b.match(/\((\d+C\+G)\)/i) || b.match(/(\d+C\+G)/i);
    return m ? m[1].toUpperCase() : (d || 'Multi Conductor');
  }
  if (s === 'Conduit Bodies') return 'Conduit Body';
  if (s === 'Supports' || (!s && /\bStrap\b/i.test(b))) {
    if (/One.Hole/i.test(b)) return 'One Hole Strap';
    if (/Two.Hole/i.test(b)) return 'Two Hole Strap';
    return 'Strap';
  }
  if (s === 'Conduit Support') {
    if (/One.Hole/i.test(b)) return 'One Hole Strap';
    if (/Two.Hole/i.test(b)) return 'Two Hole Strap';
    return d || 'Conduit Support';
  }
  if (s === 'Strut Channel') return d || 'Unistrut';
  if (s === 'Threaded Rod') return d || 'Threaded Rod';
  if (s === 'Beam Clamp') return 'Beam Clamp';
  if (s === 'Hardware/Accessories') return d || b;
  if (s === 'Fittings' && d === 'Elbow') return 'Horizontal Elbow';
  if (d === 'Vertical') return 'Vertical Elbow';
  if (/\bConnector\b/i.test(b)) return 'Connector';
  if (/\bCoupling\b/i.test(b)) return 'Coupling';
  if (/\bElbow\b/i.test(b)) return 'Elbow';
  if (/\bBushing\b/i.test(b)) return 'Bushing';
  if (/\bLocknut\b/i.test(b)) return 'Locknut';
  if (/\bNipple\b/i.test(b)) return 'Nipple';
  if (/\bStrap\b|\bClamp\b/i.test(b)) return 'Strap';
  return d || 'Other';
}

async function run() {
  const rows = await db.select({
    id: items.id, name: items.name, subcategory: items.subcategory,
    detailType: items.detailType, baseItemName: items.baseItemName,
  }).from(items).where(eq(items.isActive, true));

  let updated = 0;
  for (const row of rows) {
    const newSub = derivedFamily(row.subcategory, row.detailType, row.name, row.baseItemName) || null;
    const newDt  = derivedType(row.subcategory, row.detailType, row.baseItemName, row.name) || null;
    if (newSub !== row.subcategory || newDt !== row.detailType) {
      await db.update(items).set({ subcategory: newSub, detailType: newDt }).where(eq(items.id, row.id));
      updated++;
    }
  }
  console.log(`Done. Updated ${updated}/${rows.length} items.`);
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
