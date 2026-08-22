/**
 * Field Ticket design tokens — Daily Report visual identity
 * Import these constants into NewReportTab.tsx for consistent theming.
 */

export const FT = {
  INK:         "var(--daily-report-ink, #1C1C1E)",   // primary text / emphasis borders
  PAPER:       "var(--daily-report-paper, #F7F5EF)",   // page / card background
  PAPER_MUTED: "var(--daily-report-paper-muted, #EFEBDF)",   // nav bar + action bar background
  RULE:        "var(--daily-report-rule, #D8D3C4)",   // default hairline borders
  TEXT_MUTED:  "var(--daily-report-text-muted, #6B675C)",   // secondary / label text
  ACCENT:      "var(--daily-report-accent, #E85D04)",   // safety-orange — active nav, section rule, CTA
  SUCCESS:     "var(--daily-report-success, #3D8B37)",   // completed / attend / operational
  DANGER:      "var(--daily-report-danger, #A3321C)",   // blocked / delayed / broken
  FONT:        "'Barlow Condensed', sans-serif",
} as const;

/** Solid-fill chip style helper */
export function solidChip(bg: string, border?: string): { color: string; bg: string; border: string } {
  return { color: "#ffffff", bg, border: border ?? bg };
}

/** Solid-fill chip styles for TASK_STATUS_CFG */
export const TASK_BADGE = {
  "not-started": { badgeBg: "transparent",   badgeBorder: FT.INK,    badgeText: FT.INK    },
  "in-progress":  { badgeBg: FT.ACCENT,       badgeBorder: FT.ACCENT,  badgeText: "#fff"    },
  "completed":    { badgeBg: FT.SUCCESS,      badgeBorder: FT.SUCCESS, badgeText: "#fff"    },
  "delayed":      { badgeBg: FT.DANGER,       badgeBorder: FT.DANGER,  badgeText: "#fff"    },
  "blocked":      { badgeBg: FT.DANGER,       badgeBorder: FT.DANGER,  badgeText: "#fff"    },
} as const;

/** Solid-fill styles for STATUS_COLOR_CFG (attendance) */
export const ATTENDANCE_CHIP: Record<string, { color: string; bg: string; border: string }> = {
  "ATTEND":      { color: "#fff", bg: FT.SUCCESS,      border: "#2d6b29" },
  "PTO":         { color: "#fff", bg: "#0f766e",        border: "#0d605a" },
  "SICK":        { color: "#fff", bg: FT.DANGER,        border: "#8a2a17" },
  "ABSENT":      { color: "#fff", bg: FT.DANGER,        border: "#8a2a17" },
  "OFF":         { color: "#fff", bg: FT.TEXT_MUTED,    border: "#57534a" },
  "LATE":        { color: "#fff", bg: FT.ACCENT,        border: "#c44e00" },
  "EARLY_LEAVE": { color: "#fff", bg: FT.DANGER,        border: "#8a2a17" },
  "WFH":         { color: "#fff", bg: FT.INK,           border: "#111"    },
  "TRAINING":    { color: "#fff", bg: "#0369a1",        border: "#025f8f" },
  "SUSPENDED":   { color: "#fff", bg: "#7c3aed",        border: "#6d2fd6" },
  "TERMINATED":  { color: "#fff", bg: FT.DANGER,        border: "#8a2a17" },
};
