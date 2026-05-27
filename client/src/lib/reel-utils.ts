export const BRAND_ABBREV: Record<string, string> = {
  "southwire": "SW", "southwire company": "SW",
  "ideal": "IDEAL", "ideal industries": "IDEAL",
  "hubbell": "HUB", "leviton": "LEV",
  "siemens": "SIE", "square d": "SQD",
  "eaton": "ETN", "greenlee": "GRL",
  "milwaukee": "MIL", "klein": "KLN",
  "grainger": "GRG", "3m": "3M",
  "panduit": "PAN", "burndy": "BRN",
  "ilsco": "ILS", "nvent": "NVT",
  "thomas & betts": "TB", "abb": "ABB",
};

export function abbreviateWord(str: string): string {
  const s = str.trim();
  if (!s) return "XX";
  if (/^[A-Z0-9#/\-]+$/.test(s)) return s;
  const words = s.split(/\s+/);
  if (words.length > 1) {
    return words.map(w => (w[0] || "").toUpperCase()).join("").replace(/[^A-Z0-9]/g, "");
  }
  const upper = s.toUpperCase();
  const vowels = new Set(["A","E","I","O","U"]);
  const initials: string[] = [upper[0]];
  let afterVowel = vowels.has(upper[0]);
  let consecutiveConsonants = 0;
  for (let i = 1; i < upper.length; i++) {
    const ch = upper[i];
    if (!/[A-Z0-9]/.test(ch)) { afterVowel = false; consecutiveConsonants = 0; continue; }
    const isVowel = vowels.has(ch);
    if (!isVowel) {
      if (afterVowel && consecutiveConsonants === 0) {
        initials.push(ch);
        if (initials.length >= 4) break;
      }
      consecutiveConsonants++;
    } else {
      consecutiveConsonants = 0;
    }
    afterVowel = isVowel || (afterVowel && consecutiveConsonants <= 1);
  }
  return initials.slice(0, 3).join("");
}

// ── Size normalization ─────────────────────────────────────────────────────
// Converts sizeLabel to a 3-char code: #8 → 008, 1/0 → 10, 250 → 250 (as-is)
function normalizeSizeCode(sizeLabel: string | null | undefined): string {
  const raw = (sizeLabel || "").trim();
  if (!raw) return "UNK";
  const cleaned = raw.replace(/^#/, "").replace(/\s+/g, "").replace(/["']/g, "");
  if (cleaned === "1/0") return "10";
  if (cleaned === "2/0") return "20";
  if (cleaned === "3/0") return "30";
  if (cleaned === "4/0") return "40";
  if (/^\d+$/.test(cleaned)) {
    const n = parseInt(cleaned, 10);
    return n >= 250 ? String(n) : String(n).padStart(3, "0");
  }
  const safe = cleaned.replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 6);
  return safe || "UNK";
}

// ── Config code extraction ─────────────────────────────────────────────────
// MC: 4C+G → 4CG, 3C+G → 3CG, etc.
// SC: color word → 3-letter code, unknown → UNK
function extractConfigCode(name: string): { coreCode: "MC" | "SC"; configCode: string } {
  const mcMatch = name.match(/\b(4C\+G|3C\+G|2C\+G|4C|3C|2C)\b/i);
  if (mcMatch) {
    const raw = mcMatch[1].toUpperCase();
    const mcMap: Record<string, string> = {
      "4C+G": "4CG", "3C+G": "3CG", "2C+G": "2CG",
      "4C": "4C", "3C": "3C", "2C": "2C",
    };
    return { coreCode: "MC", configCode: mcMap[raw] || "UNK" };
  }
  const colorMap: [RegExp, string][] = [
    [/\b(green|grn|ground)\b/i, "GRN"],
    [/\b(black|blk)\b/i, "BLK"],
    [/\b(white|wht)\b/i, "WHT"],
    [/\b(red)\b/i, "RED"],
    [/\b(blue|blu)\b/i, "BLU"],
    [/\b(brown)\b/i, "BRN"],
    [/\b(orange)\b/i, "ORG"],
    [/\b(yellow|yel)\b/i, "YEL"],
    [/\b(gray|grey)\b/i, "GRY"],
  ];
  for (const [pattern, code] of colorMap) {
    if (pattern.test(name)) return { coreCode: "SC", configCode: code };
  }
  return { coreCode: "SC", configCode: "UNK" };
}

// ── New Reel ID generator ──────────────────────────────────────────────────
// Format: R-{SC|MC}-{SIZE}-{CONFIG}-{SEQ}   e.g. R-MC-008-4CG-001
// `brand` param is kept for API compatibility but is not used in new format.
export function generateReelId(
  item: { baseItemName?: string | null; name?: string | null; sizeLabel?: string | null },
  brand: string,
  seqNum: number,
): string {
  const name = (item.name || item.baseItemName || "").trim();
  const { coreCode, configCode } = extractConfigCode(name);
  const sizeCode = normalizeSizeCode(item.sizeLabel);
  const seq = String(seqNum).padStart(3, "0");
  return `R-${coreCode}-${sizeCode}-${configCode}-${seq}`;
}
