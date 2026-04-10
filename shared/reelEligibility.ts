/**
 * shared/reelEligibility.ts
 *
 * Canonical reel-eligibility classifier shared between the frontend and
 * server-side audit endpoint.  Never import the client-only version of this
 * file (client/src/lib/reelEligibility.ts) from the server — use this module.
 *
 * Classification order — exclusion-first, default → false:
 *   A. Hard exclusion     – accessory / fitting / hardware terms in the ITEM's
 *                           own fields only (name, baseItemName, subcategory,
 *                           detailType). Category name is intentionally excluded
 *                           from step A so that a category called
 *                           "CONDUIT & FITTINGS" does not incorrectly exclude
 *                           the conduit body items it contains.
 *   B. Conduit guardrail  – rigid conduit / EMT / cable tray / wireway in ALL
 *                           fields including category → false
 *   C. Positive match     – wire / cable / flexible conduit body in ALL fields
 *                           → true
 *   D. Default            – false
 *
 * Metal Flexible Conduit and Liquidtight Flexible Conduit are explicitly
 * eligible in step C via "flexible conduit", "liquidtight", and
 * "metal flexible".  Their accessory counterparts (connectors, couplings,
 * clamps, etc.) are still excluded in step A.
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

export interface ReelClassification {
  eligible: boolean;
  /** Short machine-readable rule tag: "EXCLUDED", "NON_REEL", "POSITIVE", "DEFAULT" */
  rule: "EXCLUDED" | "NON_REEL" | "POSITIVE" | "DEFAULT";
  /** The specific term that triggered the rule, or "none" */
  matchedTerm: string;
}

// ── Text normalization ────────────────────────────────────────────────────────

function normalize(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .trim()
    .replace(/[-–—]/g, " ")
    .replace(/\//g, " ")
    .replace(/\s+/g, " ");
}

/** Item-level fields only — used for Step A (accessory exclusion).
 *  Category name is intentionally omitted here. */
function buildItemText(item: ReelEligibilityInput): string {
  const raw = [
    item.name,
    item.baseItemName,
    item.subcategory,
    item.detailType,
  ]
    .map(normalize)
    .filter(Boolean)
    .join(" ");
  return " " + raw + " ";
}

/** All classification fields including category — used for Steps B and C. */
function buildAllText(item: ReelEligibilityInput): string {
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

function firstMatch(text: string, terms: readonly string[]): string | null {
  for (const t of terms) {
    if (text.includes(t)) return t;
  }
  return null;
}

// ── Step A: Accessory / fitting / hardware exclusion ─────────────────────────
// Checked against item-specific text only (NOT category.name) so that a
// category named "CONDUIT & FITTINGS" does not block the conduit body products.

const ACCESSORY_EXCLUSION_TERMS = [
  "connector",
  "coupling",
  "bushing",
  "anti short",
  "antishort",
  " strap ",
  " clamp ",
  "locknut",
  " fitting ",
  "hardware",
  "accessory",
  "end cap",
  " adapter ",
  " reducer ",
  " nipple ",
  " elbow ",
  " tee ",
  "staple",
  "fastener",
] as const;

// ── Step B: Non-reel conduit / structure guardrail ───────────────────────────
// Rigid conduit, EMT, cable tray, wireways — never reel-managed.
// Flexible conduit is NOT in this list; it belongs to the positive side.

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
// " wire " is space-padded so that "wireway" (caught in step B) cannot slip
// through here even if step B somehow misses it.
//
// Metal Flexible Conduit and Liquidtight Flexible Conduit are explicitly
// covered by "flexible conduit", "liquidtight", and the new "metal flexible"
// term which matches when only detailType = "Metal Flexible" is present.

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
  "metal flexible",
  "flex conduit",
  " flx ",
] as const;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Full classification with reason for audit / debugging.
 * Never throws — returns DEFAULT:false when input is null/undefined.
 */
export function classifyReel(
  item: ReelEligibilityInput | null | undefined,
): ReelClassification {
  if (!item) {
    return { eligible: false, rule: "DEFAULT", matchedTerm: "none" };
  }

  const itemText = buildItemText(item);
  const allText  = buildAllText(item);

  const exclusionHit = firstMatch(itemText, ACCESSORY_EXCLUSION_TERMS);
  if (exclusionHit !== null) {
    return { eligible: false, rule: "EXCLUDED", matchedTerm: exclusionHit.trim() };
  }

  const conduitHit = firstMatch(allText, NON_REEL_CONDUIT_TERMS);
  if (conduitHit !== null) {
    return { eligible: false, rule: "NON_REEL", matchedTerm: conduitHit.trim() };
  }

  const positiveHit = firstMatch(allText, REEL_POSITIVE_TERMS);
  if (positiveHit !== null) {
    return { eligible: true, rule: "POSITIVE", matchedTerm: positiveHit.trim() };
  }

  return { eligible: false, rule: "DEFAULT", matchedTerm: "none" };
}

/**
 * Convenience wrapper — returns true when the item should display reel UI.
 * Safe to call with null / undefined (returns false).
 */
export function isReelEligible(
  item: ReelEligibilityInput | null | undefined,
): boolean {
  return classifyReel(item).eligible;
}
