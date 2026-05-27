export interface WireConfig {
  coreTypeLabel: string | null;
  sizeLabel: string | null;
  conductorColorLabel: string | null;
}

/**
 * Parses item name / sizeLabel to derive human-readable wire config labels.
 * Read-only — never modifies any data or DB values.
 * All results are best-effort; falls back to null gracefully.
 */
export function parseWireConfig(item: {
  name?: string | null;
  sizeLabel?: string | null;
  baseItemName?: string | null;
}): WireConfig {
  const name = item.name || "";

  // ── Size display ──────────────────────────────────────────────────────────
  let sizeDisplay: string | null = null;
  const raw = (item.sizeLabel || "").trim();
  if (raw) {
    if (/^#/.test(raw)) {
      sizeDisplay = raw;
    } else if (/^\d+\/0$/.test(raw)) {
      sizeDisplay = `#${raw}`;
    } else if (/^\d+$/.test(raw)) {
      const n = parseInt(raw, 10);
      sizeDisplay = n >= 250 ? `${raw} kcmil` : `#${raw}`;
    } else {
      sizeDisplay = raw;
    }
  }

  // ── Multi-core detection ──────────────────────────────────────────────────
  const mcPatterns: RegExp[] = [
    /\((\d+C\+G)\)/i,
    /\((\d+C)\)/i,
    /\b(\d+C\+G)\b/i,
    /\b(\d+C)\b/i,
  ];
  for (const pattern of mcPatterns) {
    const m = name.match(pattern);
    if (m) {
      return {
        coreTypeLabel: "Multi Core",
        sizeLabel: sizeDisplay,
        conductorColorLabel: m[1].toUpperCase(),
      };
    }
  }

  // ── Single-core color detection ───────────────────────────────────────────
  const colorMap: [RegExp, string][] = [
    [/\b(green|grn|ground)\b/i, "Green"],
    [/\b(black|blk)\b/i, "Black"],
    [/\b(white|wht)\b/i, "White"],
    [/\b(red)\b/i, "Red"],
    [/\b(blue|blu)\b/i, "Blue"],
    [/\b(brown)\b/i, "Brown"],
    [/\b(orange)\b/i, "Orange"],
    [/\b(yellow|yel)\b/i, "Yellow"],
    [/\b(gray|grey)\b/i, "Gray"],
  ];
  let colorLabel: string | null = null;
  for (const [pattern, label] of colorMap) {
    if (pattern.test(name)) {
      colorLabel = label;
      break;
    }
  }

  return {
    coreTypeLabel: "Single Core",
    sizeLabel: sizeDisplay,
    conductorColorLabel: colorLabel,
  };
}
