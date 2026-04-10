/**
 * shared/reelEligibility.ts
 *
 * Canonical reel-eligibility rule — imported by both server and client.
 *
 * Classification order (exclusion-first, default → false):
 *   A. Hard exclusion    – accessory / fitting / hardware → false
 *   B. Conduit guardrail – rigid conduit / EMT / cable tray / wireway → false
 *   C. Positive match    – wire / cable / flexible conduit body → true
 *   D. Default           – false
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

// ── Normalization ─────────────────────────────────────────────────────────────

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
 * Returns true when the item should use reel inventory management.
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

/**
 * Returns a human-readable reason why an item is NOT reel-eligible.
 * Returns null if the item IS eligible.
 */
export function getReelIneligibilityReason(
  item: ReelEligibilityInput | null | undefined,
): string | null {
  if (!item) return "Unknown item";
  if (isReelEligible(item)) return null;

  const text = buildText(item);

  if (anyMatch(text, ACCESSORY_EXCLUSION_TERMS)) {
    if (text.includes("connector")) return "Accessory — connector";
    if (text.includes("coupling")) return "Accessory — coupling";
    if (text.includes("bushing")) return "Accessory — bushing";
    if (text.includes(" fitting")) return "Accessory — fitting";
    if (text.includes("locknut")) return "Accessory — locknut";
    if (text.includes(" clamp")) return "Accessory — clamp";
    if (text.includes(" strap")) return "Accessory — strap";
    return "Accessory / fitting / hardware";
  }

  if (anyMatch(text, NON_REEL_CONDUIT_TERMS)) {
    if (text.includes(" emt ") || text.includes("electrical metallic tubing"))
      return "EMT family";
    if (
      text.includes("rigid conduit") ||
      text.includes("rigid metal conduit") ||
      text.includes(" rmc ")
    )
      return "Non-flex conduit (Rigid/RMC)";
    if (text.includes(" imc ")) return "Non-flex conduit (IMC)";
    if (text.includes("pvc conduit") || text.includes("rigid pvc"))
      return "PVC conduit";
    if (text.includes("cable tray") || text.includes("cable ladder"))
      return "Cable Tray item";
    if (text.includes("wireway") || text.includes("wire duct"))
      return "Wireway";
    if (text.includes("strut channel") || text.includes("unistrut"))
      return "Strut / channel";
    return "Non-reel conduit / structure";
  }

  return "No reel-eligible characteristics found";
}
