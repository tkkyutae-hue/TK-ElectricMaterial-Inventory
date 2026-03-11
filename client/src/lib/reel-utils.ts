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

export function generateReelId(
  item: { baseItemName?: string | null; name?: string | null; sizeLabel?: string | null },
  brand: string,
  seqNum: number,
): string {
  const familyName = (item.baseItemName || item.name || "").trim();
  const itemAbbr = abbreviateWord(familyName).replace(/[^A-Z0-9]/gi, "");
  const size = (item.sizeLabel || "").replace(/[^A-Za-z0-9#\/]/g, "");
  const brandKey = (brand || "").toLowerCase().trim();
  const brandAbbr = BRAND_ABBREV[brandKey] || abbreviateWord(brand).replace(/[^A-Z0-9]/gi, "") || "XX";
  const seq = String(seqNum).padStart(3, "0");
  return `${itemAbbr}-${size}-${brandAbbr}-R${seq}`;
}
