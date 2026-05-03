export type UsagePattern = "core" | "normal" | "low" | "none";

export function classifyUsagePattern(
  issueCount30d: number,
  issueCount90d: number,
): UsagePattern {
  if (issueCount30d >= 8) return "core";
  if (issueCount30d >= 1) return "normal";
  if (issueCount90d >= 1) return "low";
  return "none";
}

export const USAGE_PATTERN_STYLES: Record<UsagePattern, { chip: string; dot: string }> = {
  core:   { chip: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200", dot: "bg-emerald-500" },
  normal: { chip: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",             dot: "bg-sky-500"     },
  low:    { chip: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",       dot: "bg-amber-500"   },
  none:   { chip: "bg-slate-50 text-slate-400 ring-1 ring-slate-200",       dot: "bg-slate-300"   },
};
