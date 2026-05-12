/**
 * Field Mode Design Tokens
 *
 * Single source of truth for Field UI colors.
 * Used in inline style props throughout Field pages.
 *
 * F  = dark theme (default)
 * FL = light theme
 *
 * Color values are extracted from the existing Field UI palette — nothing invented.
 * Do NOT change values without updating ALL consumers via token reference.
 */

export const F = {
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

export const FL = {
  // ── Surfaces ──────────────────────────────────────────────────────────────
  bg:           "#f4f8f5",
  surface:      "#e8f0ea",
  surface2:     "#dde8df",

  // ── Borders ───────────────────────────────────────────────────────────────
  border:       "#c8d9cb",
  borderStrong: "#afc6b3",

  // ── Text ──────────────────────────────────────────────────────────────────
  text:         "#1a2e1d",
  textMuted:    "#3b6b42",
  textSub:      "#4d7a54",
  textDim:      "#7aab82",

  // ── Accent (green) ────────────────────────────────────────────────────────
  accent:       "#1ca84e",
  accentBg:     "rgba(28,168,78,0.10)",
  accentBorder: "rgba(28,168,78,0.30)",
  accentText:   "#ffffff",

  // ── Status ────────────────────────────────────────────────────────────────
  danger:       "#dc2626",
  dangerBg:     "rgba(220,38,38,0.08)",
  dangerBorder: "rgba(220,38,38,0.25)",

  warning:      "#c2790a",
  warningBg:    "rgba(194,121,10,0.10)",
  warningBorder:"rgba(194,121,10,0.30)",

  ordered:      "#0284c7",
  orderedBg:    "rgba(2,132,199,0.10)",
  orderedBorder:"rgba(2,132,199,0.25)",

  info:         "#2563eb",
  infoBg:       "rgba(37,99,235,0.10)",
  infoBorder:   "rgba(37,99,235,0.35)",
} as const;

export type FieldToken = typeof F;
export type FieldTheme = "dark" | "light";

export const F_DARK: FieldToken = F;
export const F_LIGHT: FieldToken = FL;
