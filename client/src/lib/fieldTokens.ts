/**
 * Field Mode Design Tokens
 *
 * Single source of truth for Field UI colors.
 * Used in inline style props throughout Field pages.
 *
 * F_DARK  = dark theme (canonical)
 * F_LIGHT = light theme (canonical)
 * F  = legacy alias for F_DARK
 * FL = legacy alias for F_LIGHT
 *
 * Color values are extracted from the existing Field UI palette — nothing invented.
 * Do NOT change values without updating ALL consumers via token reference.
 */

export const F_DARK = {
  // ── Surfaces ──────────────────────────────────────────────────────────────
  bg:           "#0d1410",  // page bg, drawer bg, sticky panel bg
  surface:      "#1c2b1f",  // inputs, row hover, inactive pills, secondary buttons
  surface2:     "#162019",  // card/panel inset, photo cells, reel rows, table rows

  // ── Borders ───────────────────────────────────────────────────────────────
  border:       "#1e2e21",  // subtle dividers, row separators
  borderStrong: "#2a4030",  // card edges, input borders, section separators

  // ── Text ──────────────────────────────────────────────────────────────────
  text:         "#e2f0e5",  // primary: headers, item names, values
  textMuted:    "#7aab82",  // secondary: SKUs, categories, metadata
  textSub:      "#9abda2",  // sub-primary: readable "from" location, size labels
  textDim:      "#4a7052",  // labels, placeholder icons, disabled / faint text

  // ── Accent (green) ────────────────────────────────────────────────────────
  accent:       "#2ddb6f",  // CTA buttons, active pills, in-stock qty, checkbox fill
  accentBg:     "rgba(45,219,111,0.10)",  // selected row / active pill tint
  accentBorder: "rgba(45,219,111,0.25)",  // soft accent border / badge ring
  accentText:   "#0d1410",  // text ON accent button (same hue as bg for contrast)

  // ── Status ────────────────────────────────────────────────────────────────
  danger:       "#ff5050",  // out-of-stock, issue movement
  dangerBg:     "rgba(255,80,80,0.10)",
  dangerBorder: "rgba(255,80,80,0.25)",

  warning:      "#f5a623",  // low-stock, adjust movement, drafts tab
  warningBg:    "rgba(245,166,35,0.10)",
  warningBorder:"rgba(245,166,35,0.25)",

  ordered:      "#38bdf8",  // ordered status badge
  orderedBg:    "rgba(56,189,248,0.10)",
  orderedBorder:"rgba(56,189,248,0.25)",

  info:         "#5b9cf6",  // transfer movement type
  infoBg:       "rgba(91,156,246,0.13)",
  infoBorder:   "rgba(91,156,246,0.40)",
} as const;

export const F_LIGHT = {
  // ── Surfaces ──────────────────────────────────────────────────────────────
  bg:           "#f6faf6",
  surface:      "#ffffff",
  surface2:     "#f8fbf8",

  // ── Borders ───────────────────────────────────────────────────────────────
  border:       "#d5e5d5",
  borderStrong: "#a9c8ad",

  // ── Text ──────────────────────────────────────────────────────────────────
  text:         "#0f1f17",
  textMuted:    "#315f3b",
  textSub:      "#3f704a",
  textDim:      "#647a68",

  // ── Accent (green) ────────────────────────────────────────────────────────
  accent:       "#16a34a",
  accentBg:     "rgba(22,163,74,0.10)",
  accentBorder: "rgba(22,163,74,0.28)",
  accentText:   "#ffffff",

  // ── Status ────────────────────────────────────────────────────────────────
  danger:       "#c0392b",
  dangerBg:     "rgba(192,57,43,0.08)",
  dangerBorder: "rgba(192,57,43,0.22)",

  warning:      "#b7770d",
  warningBg:    "rgba(183,119,13,0.08)",
  warningBorder:"rgba(183,119,13,0.22)",

  ordered:      "#0369a1",
  orderedBg:    "rgba(3,105,161,0.08)",
  orderedBorder:"rgba(3,105,161,0.22)",

  info:         "#1d4ed8",
  infoBg:       "rgba(29,78,216,0.08)",
  infoBorder:   "rgba(29,78,216,0.30)",
} as const;

export type FieldToken = {
  readonly [K in keyof typeof F_DARK]: typeof F_DARK[K] | typeof F_LIGHT[K];
};
export type FieldTheme = "dark" | "light";

// Legacy aliases — prefer F_DARK / F_LIGHT in new code
export const F: FieldToken = F_DARK;
export const FL: FieldToken = F_LIGHT;
