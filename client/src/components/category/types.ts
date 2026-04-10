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
  unitOfMeasure: string;
  status: string;
  imageUrl?: string | null;
  location?: { id?: number; name: string } | null;
  primaryLocationId?: number | null;
  supplier?: { name: string } | null;
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

export function parseSizeToNumber(size: string | null | undefined): number {
  if (!size) return Infinity;
  const s = size.trim();

  const compound = s.match(/^(\d+)[-\s]+(\d+)\s*\/\s*(\d+)/);
  if (compound) return +compound[1] + +compound[2] / +compound[3];

  const frac = s.match(/^(\d+)\s*\/\s*(\d+)/);
  if (frac) return +frac[1] / +frac[2];

  const hash = s.match(/^#\s*(\d+)/);
  if (hash) return +hash[1];

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
