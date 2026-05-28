// ── Shared types ──────────────────────────────────────────────────────────────

export type CategoryGroupedItem = {
  id: number;
  sku: string;
  name: string;
  sizeLabel?: string | null;
  sizeSortValue?: number | null;
  baseItemName?: string | null;
  subcategory?: string | null;
  detailType?: string | null;
  quantityOnHand: number;
  reorderPoint: number;
  reorderQuantity: number;
  minimumStock: number;
  unitOfMeasure: string;
  status: string;
  imageUrl?: string | null;
  location?: { id?: number; name: string } | null;
  primaryLocationId?: number | null;
  supplier?: { name: string } | null;
  trackingMode?: "standard" | "reel" | null;
  manufacturer?: string | null;
  issueCount30d?: number;
  issueCount90d?: number;
  lastIssueAt?: string | null;
};

export type ItemClassDraft = {
  name: string;
  subcategory: string;
  detailType: string;
  subType: string;
};

export type CategoryItemGroup = {
  baseItemName: string;
  items: CategoryGroupedItem[];
  representativeImage?: string | null;
  customImageUrl?: string | null;
};

export type CategoryGroupedDetail = {
  category: {
    id: number;
    name: string;
    description?: string | null;
    imageUrl?: string | null;
    code?: string | null;
  };
  skuCount: number;
  totalQuantity: number;
  lowStockCount: number;
  outOfStockCount: number;
  groups: CategoryItemGroup[];
};

export type EditDraft = {
  sizeLabel: string;
  name: string;
  quantityOnHand: number;
  unitOfMeasure: string;
  primaryLocationId: number | null;
  imageUrl: string | null;
  _deleted?: boolean;
  trackingMode?: "standard" | "reel" | null;
  trackingModeError?: string;
};

export type NewRowDraft = {
  tmpId: string;
  sku: string;
  sizeLabel: string;
  name: string;
  quantityOnHand: number;
  unitOfMeasure: string;
  primaryLocationId: number | null;
  imageUrl: string | null;
  skuError: string;
  nameManuallyEdited: boolean;
  skuManuallyEdited: boolean;
  subcategoryOverride: string | null;
  detailTypeOverride: string | null;
  trackingMode?: "standard" | "reel" | null;
  trackingModeError?: string;
};

export type ClassifyPreview = {
  family: string;
  type: string;
  subcategoryDisplay: string;
  subcategory: string | null;
  detailType: string | null;
};

export type DraftFamily = {
  name: string;
  imageUrl: string;
  showImageInput: boolean;
  confirmed: boolean;
};

// ── Constants ─────────────────────────────────────────────────────────────────

export const UOM_OPTIONS = ["EA", "FT", "LF", "PR", "PKG", "BOX", "CTN", "LB", "ROLL"];

const INCH_SIZE_CODES: Record<string, string> = {
  "1/2": "050",   "3/4": "075",   "1": "100",
  "1-1/4": "125", "1 1/4": "125",
  "1-1/2": "150", "1 1/2": "150",
  "2": "200",
  "2-1/2": "250", "2 1/2": "250",
  "3": "300",
  "3-1/2": "350", "3 1/2": "350",
  "4": "400",     "5": "500",     "6": "600",
  "1-5/8": "1625","1 5/8": "1625",
};

// ── Size helpers ──────────────────────────────────────────────────────────────

// U.S. electrical wire size ascending order (smallest → largest conductor).
// Mirrors WIRE_SORT_MAP in server/storage.ts — keep in sync.
const WIRE_SORT_MAP: Record<string, number> = {
  "#14": 100, "#12": 200, "#10": 300,
  "#8": 400,  "#6": 500,  "#4": 600,  "#3": 700, "#2": 800, "#1": 900,
  "1/0": 1000, "2/0": 1100, "3/0": 1200, "4/0": 1300,
  "250 KCMIL": 1400, "300 KCMIL": 1500, "350 KCMIL": 1600, "400 KCMIL": 1700,
  "500 KCMIL": 1800, "600 KCMIL": 1900, "750 KCMIL": 2000, "1000 KCMIL": 2100,
  "250 MCM": 1400, "300 MCM": 1500, "350 MCM": 1600, "400 MCM": 1700,
  "500 MCM": 1800, "600 MCM": 1900, "750 MCM": 2000, "1000 MCM": 2100,
};

export function parseSizeToNumber(size: string | null | undefined): number {
  if (!size) return Infinity;
  const s = size.trim().replace(/["""'']/g, "").trim();

  // ── AWG / KCMIL wire sizes ────────────────────────────────────────────────
  // Direct map lookup (fastest, most accurate)
  if (WIRE_SORT_MAP[s] !== undefined) return WIRE_SORT_MAP[s];

  // #N/0 format (e.g. "#1/0", "#2/0", "#3/0", "#4/0") — strip # then re-lookup
  const hashSlash = s.match(/^#\s*(\d+\/0)$/i);
  if (hashSlash && WIRE_SORT_MAP[hashSlash[1]] !== undefined) return WIRE_SORT_MAP[hashSlash[1]];

  // "#N AWG" variants
  const hashAwg = s.match(/^(#\d+)\s*AWG$/i);
  if (hashAwg && WIRE_SORT_MAP[hashAwg[1]] !== undefined) return WIRE_SORT_MAP[hashAwg[1]];

  // Bare N/0 without # (e.g. "1/0", "2/0") — already covered by map above via direct key
  // "N KCMIL" / "N MCM" without the exact spacing
  const kcmil = s.match(/^(\d+)\s*(KCMIL|MCM)$/i);
  if (kcmil) {
    const key = `${kcmil[1]} ${kcmil[2].toUpperCase()}`;
    if (WIRE_SORT_MAP[key] !== undefined) return WIRE_SORT_MAP[key];
  }

  // ── Conduit / inch sizes ──────────────────────────────────────────────────
  // Compound fraction: "1-1/4", "2-1/2", etc.
  const compound = s.match(/^(\d+)[-\s]+(\d+)\s*\/\s*(\d+)/);
  if (compound) return +compound[1] + +compound[2] / +compound[3];

  // Simple fraction: "1/2", "3/4" (not N/0 AWG — those were caught above)
  const frac = s.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) return +frac[1] / +frac[2];

  // Plain number: "1", "2", "3", etc.
  const num = s.match(/^(\d+\.?\d*)/);
  if (num) return parseFloat(num[1]);

  return Infinity;
}

export function sortItems(items: CategoryGroupedItem[], dir: "asc" | "desc"): CategoryGroupedItem[] {
  return [...items].sort((a, b) => {
    const mul = dir === "desc" ? -1 : 1;
    const aDb = (a.sizeSortValue != null && a.sizeSortValue !== 0 && a.sizeSortValue !== 9999) ? a.sizeSortValue : null;
    const bDb = (b.sizeSortValue != null && b.sizeSortValue !== 0 && b.sizeSortValue !== 9999) ? b.sizeSortValue : null;

    if (aDb !== null && bDb !== null) return mul * (aDb - bDb);

    const an = parseSizeToNumber(a.sizeLabel);
    const bn = parseSizeToNumber(b.sizeLabel);
    if (an === Infinity && bn === Infinity) return mul * (a.sizeLabel || "").localeCompare(b.sizeLabel || "");
    if (an === Infinity) return 1;
    if (bn === Infinity) return -1;
    return mul * (an - bn);
  });
}

function parseSizeToCode(size: string): string {
  const s = size.trim().replace(/["""'']/g, "").trim();

  if (INCH_SIZE_CODES[s])               return INCH_SIZE_CODES[s];
  if (INCH_SIZE_CODES[s.toLowerCase()]) return INCH_SIZE_CODES[s.toLowerCase()];

  const hash = s.match(/^#\s*(\d+)/);
  if (hash) return hash[1];

  const cable = s.match(/^(\d+)\/(\d+)([A-Za-z]*)/);
  if (cable) return `${cable[1]}${cable[2]}${cable[3].toUpperCase()}`;

  const dims = s.match(/^(\d+)\s*[xX×]\s*(\d+)/);
  if (dims) return `${dims[1]}X${dims[2]}`;

  return s.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6);
}

function getFamilyPrefix(familyName: string, existingItems: CategoryGroupedItem[]): string {
  for (const item of existingItems) {
    const parts = item.sku.split("-");
    if (parts.length >= 2) {
      const last = parts[parts.length - 1];
      if (/^\d$/.test(last) && parts.length >= 3) {
        return parts.slice(0, parts.length - 2).join("-");
      }
      return parts.slice(0, parts.length - 1).join("-");
    }
  }
  const words = familyName.trim().split(/\s+/).filter(w => w.length > 2);
  if (!words.length) return familyName.slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return words.slice(0, 3).map(w => w.slice(0, 2).toUpperCase()).join("").slice(0, 6);
}

export function generateAutoSku(
  familyName: string,
  existingItems: CategoryGroupedItem[],
  sizeLabel: string,
  allSkus: Set<string>,
): string {
  if (!sizeLabel.trim()) return "";
  const prefix = getFamilyPrefix(familyName, existingItems);
  const sizeCode = parseSizeToCode(sizeLabel);
  if (!prefix || !sizeCode) return "";
  const base = `${prefix}-${sizeCode}`;
  if (!allSkus.has(base)) return base;
  for (let i = 2; i <= 99; i++) {
    const candidate = `${base}-${i}`;
    if (!allSkus.has(candidate)) return candidate;
  }
  return base;
}
