/**
 * Server-side fuzzy inventory matcher for BOQ extracted items.
 * AI handles extraction; this module handles matching against the full inventory.
 *
 * Uses token-level Jaccard similarity with electrical abbreviation expansion.
 * All Set iteration uses Array.from() for TS compatibility without downlevelIteration.
 */

// ── Abbreviation / synonym expansions ────────────────────────────────────────
// Keys are lower-case tokens found in BOQ or inventory names.
// Values are additional tokens to inject so both sides gain shared vocabulary.
const EXPANSIONS: Record<string, string[]> = {
  // Conduit types
  emt:          ["electrical", "metallic", "tubing", "conduit"],
  imc:          ["intermediate", "metallic", "conduit"],
  rmc:          ["rigid", "metal", "conduit"],
  grc:          ["galvanized", "rigid", "conduit"],
  pvc:          ["polyvinyl", "chloride", "conduit"],
  // Liquidtight — "LT" is the common BOQ abbreviation for liquidtight
  lt:           ["liquidtight", "liquid", "tight", "flexible", "conduit"],
  liquidtight:  ["liquid", "tight", "flexible", "conduit", "lt"],
  sealtight:    ["liquidtight", "liquid", "tight", "flexible"],
  // Cable
  mc:           ["metal", "clad", "cable"],
  thhn:         ["thermoplastic", "nylon", "wire", "cable"],
  xhhw:         ["cross", "linked", "polyethylene", "wire", "cable"],
  // Equipment shorthands
  xfmr:         ["transformer"],
  dist:         ["distribution"],
  panel:        ["distribution", "panelboard"],
  panelboard:   ["panel", "distribution"],
  switchboard:  ["panel", "distribution"],
  mcc:          ["motor", "control", "center"],
  vfd:          ["variable", "frequency", "drive"],
  ats:          ["automatic", "transfer", "switch"],
  // Protection devices
  gfi:          ["ground", "fault", "interrupter"],
  gfci:         ["ground", "fault", "circuit", "interrupter"],
  afci:         ["arc", "fault", "circuit", "interrupter"],
  cb:           ["circuit", "breaker"],
  // Materials
  cu:           ["copper"],
  al:           ["aluminum"],
  // Conduit schedule
  sch:          ["schedule"],
  // Generic
  flex:         ["flexible"],
  cond:         ["conduit"],
  conn:         ["connector"],
  fitt:         ["fitting"],
  jb:           ["junction", "box"],
};

// ── Fraction normalisation ────────────────────────────────────────────────────
// "3/4\"" → "0.75", "1-1/2\"" → "1.5", "2-1/2\"" → "2.5", "1\"" → "1"
function normalizeFraction(s: string): string {
  return s
    .replace(/(\d+)-(\d+)\/(\d+)/g, (_m, whole, num, den) =>
      String(parseInt(whole) + parseInt(num) / parseInt(den))
    )
    .replace(/(\d+)\/(\d+)/g, (_m, num, den) =>
      String(parseInt(num) / parseInt(den))
    );
}

// ── Tokenizer ─────────────────────────────────────────────────────────────────
function tokenize(s: string): Set<string> {
  const normalized = normalizeFraction(
    s.toLowerCase()
      .replace(/["""'']/g, "")
      .replace(/[()[\]{}]/g, " ")
      .replace(/[^a-z0-9./\s-]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );

  const words = normalized.split(/[\s/-]+/).filter(Boolean);
  const tokens = new Set<string>(words);

  // Expand abbreviations — use Array.from to avoid TS downlevelIteration requirement
  Array.from(tokens).forEach((word) => {
    const expansions = EXPANSIONS[word];
    if (expansions) {
      expansions.forEach((e) => tokens.add(e));
    }
  });

  return tokens;
}

// ── Stopwords ─────────────────────────────────────────────────────────────────
const STOPWORDS = new Set(["type", "or", "equivalent", "and", "for", "with", "of", "the", "a", "an", "no", "not"]);

function withoutStopwords(tokens: Set<string>): string[] {
  return Array.from(tokens).filter((t) => !STOPWORDS.has(t) && t.length > 1);
}

// ── Jaccard similarity ────────────────────────────────────────────────────────
function jaccard(aArr: string[], bSet: Set<string>): number {
  if (aArr.length === 0 && bSet.size === 0) return 0;
  let intersection = 0;
  aArr.forEach((t) => { if (bSet.has(t)) intersection++; });
  const union = aArr.length + bSet.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// ── Public API ────────────────────────────────────────────────────────────────
export interface InventoryCandidate {
  id: number;
  name: string;
}

/**
 * Given an extracted BOQ item (name + optional spec), find the best matching
 * inventory item from the provided list.
 *
 * Returns the matched item or null if no confident match is found.
 */
export function matchInventoryItem(
  extracted: { itemName: string; spec?: string | null },
  inventory: InventoryCandidate[],
  threshold = 0.30,
): InventoryCandidate | null {
  if (inventory.length === 0) return null;

  const queryRaw = [extracted.itemName, extracted.spec ?? ""].join(" ");
  const queryArr = withoutStopwords(tokenize(queryRaw));
  if (queryArr.length === 0) return null;

  let bestScore = 0;
  let bestItem: InventoryCandidate | null = null;

  inventory.forEach((inv) => {
    const invTokens = tokenize(inv.name);
    const invArr = withoutStopwords(invTokens);
    const invSet = new Set<string>(invArr);

    // Symmetric: score from query→inv and inv→query, take the max
    const score = Math.max(
      jaccard(queryArr, invSet),
      jaccard(invArr, new Set<string>(queryArr)),
    );

    if (score > bestScore) {
      bestScore = score;
      bestItem = inv;
    }
  });

  return bestScore >= threshold ? bestItem : null;
}

/**
 * Batch-match an array of extracted items against the full inventory.
 * Returns the same array enriched with inventoryItemId / inventoryItemName.
 */
export function batchMatch(
  items: Array<{ itemName: string; spec?: string | null; remarks?: string | null; [key: string]: any }>,
  inventory: InventoryCandidate[],
): Array<any> {
  return items.map((it) => {
    const match = matchInventoryItem(
      { itemName: it.itemName, spec: it.spec ?? it.remarks ?? null },
      inventory,
    );
    return {
      ...it,
      inventoryItemId: match?.id ?? null,
      inventoryItemName: match?.name ?? null,
    };
  });
}

// ── Self-test (runs once at import in dev, logs to console) ──────────────────
// Verifies the key abbreviation pairs mentioned in the task requirements.
if (process.env.NODE_ENV !== "production") {
  const testCases: Array<{ item: string; spec?: string; invName: string; shouldMatch: boolean }> = [
    { item: "ELECTRICAL METALLIC TUBING (EMT) (3/4\")", invName: "3/4\" EMT Conduit", shouldMatch: true },
    { item: "ELECTRICAL METALLIC TUBING (EMT) (1\")",  invName: "1\" EMT Conduit",   shouldMatch: true },
    { item: "FLEXIBLE CONDUIT (1\" LIQUIDTIGHT TYPE)", invName: "1\" Liquidtight Flexible Conduit", shouldMatch: true },
    { item: "LT FLEX CONDUIT 3/4\"",                  invName: "3/4\" Liquidtight Flexible Conduit", shouldMatch: true },
    { item: "IMC CONDUIT 1\"",                        invName: "1\" Intermediate Metallic Conduit", shouldMatch: true },
    { item: "POWER DISTRIBUTION PANEL",               invName: "3/4\" EMT Conduit", shouldMatch: false },
  ];

  let passed = 0;
  testCases.forEach(({ item, spec, invName, shouldMatch }) => {
    const result = matchInventoryItem(
      { itemName: item, spec: spec ?? null },
      [{ id: 1, name: invName }],
    );
    const matched = result !== null;
    const ok = matched === shouldMatch;
    if (ok) {
      passed++;
    } else {
      console.warn(`[inventoryMatcher] SELF-TEST FAIL: "${item}" vs "${invName}" — expected match=${shouldMatch}, got=${matched}`);
    }
  });
  console.log(`[inventoryMatcher] self-test ${passed}/${testCases.length} passed`);
}
