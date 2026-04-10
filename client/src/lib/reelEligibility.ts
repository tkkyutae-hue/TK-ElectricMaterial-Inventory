/**
 * reelEligibility.ts
 *
 * Single source of truth for deciding whether an inventory item is
 * managed via wire reels (rather than simple quantity counts).
 *
 * Classification order — exclusion-first, default → false:
 *   A. Hard exclusion    – accessory / fitting / hardware → false
 *   B. Conduit guardrail – rigid conduit / EMT / cable tray / wireway → false
 *   C. Positive match    – wire / cable / flexible conduit body → true
 *   D. Default           – false
 *
 * The input type is intentionally loose so the function can accept the
 * FieldItem, CategoryGroupedItem, full inventory item, or any object from
 * the items API without casting.
 */

export interface ReelEligibilityInput {
  name?: string | null;
  sku?: string | null;
  subcategory?: string | null;
  detailType?: string | null;
  baseItemName?: string | null;
  unitOfMeasure?: string | null;
  category?: { name?: string | null; code?: string | null } | null;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function normalize(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .trim()
    .replace(/[-–—]/g, " ")
    .replace(/\//g, " ")
    .replace(/\s+/g, " ");
}

function anyMatch(paddedText: string, terms: readonly string[]): boolean {
  return terms.some((t) => paddedText.includes(t));
}

/** Joins all classification text into one space-padded string. */
function buildText(item: ReelEligibilityInput): string {
  const raw = [
    item.name,
    item.baseItemName,
    item.subcategory,
    item.detailType,
    item.category?.name,
  ]
    .map(normalize)
    .filter(Boolean)
    .join(" ");
  return " " + raw + " ";
}

// ── Step A: Accessory / fitting / hardware exclusion ─────────────────────────
// Any item whose description contains these terms is NOT reel-managed.

const ACCESSORY_EXCLUSION_TERMS = [
  "connector",
  "coupling",
  "bushing",
  "anti short",
  "antishort",
  " strap",
  " clamp",
  "locknut",
  " fitting",
  "hardware",
  "accessory",
  "end cap",
  " adapter",
  " reducer",
  " nipple",
  " elbow",
  " tee ",
  "staple",
  "fastener",
] as const;

// ── Step B: Non-reel conduit / structure guardrail ───────────────────────────
// Rigid conduit, EMT, cable tray, and wireways are never reel-managed.
// These run BEFORE the positive check so "wireway" cannot match " wire ".

const NON_REEL_CONDUIT_TERMS = [
  " emt ",
  "rigid conduit",
  "rigid metal conduit",
  " rmc ",
  " imc ",
  "pvc conduit",
  "rigid pvc",
  "cable tray",
  "cable ladder",
  "wireway",
  "wire duct",
  "strut channel",
  "unistrut",
  "electrical metallic tubing",
] as const;

// ── Step C: Positive reel-eligibility terms ───────────────────────────────────
// An item must match at least one of these to be considered reel-managed.
// Note: " wire " uses surrounding spaces so "wireway" (step B) never falls through.

const REEL_POSITIVE_TERMS = [
  "cable",
  " wire ",
  "thhn",
  "thwn",
  "xhhw",
  "use 2",
  "use2",
  "nm b",
  "nm-b",
  "romex",
  "soow",
  "sjoow",
  " conductor",
  "grounding",
  "mc cable",
  "multi conductor",
  "multiconductor",
  "control cable",
  "tray cable",
  "flexible conduit",
  "liquidtight",
  "liquid tight",
  "flex conduit",
] as const;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns true when the item should display reel inventory UI.
 * Safe to call with null / undefined (returns false).
 */
export function isReelEligible(
  item: ReelEligibilityInput | null | undefined,
): boolean {
  if (!item) return false;

  const text = buildText(item);

  if (anyMatch(text, ACCESSORY_EXCLUSION_TERMS)) return false;
  if (anyMatch(text, NON_REEL_CONDUIT_TERMS)) return false;
  if (anyMatch(text, REEL_POSITIVE_TERMS)) return true;

  return false;
}
