import { useLanguage } from "@/hooks/use-language";

export type UsageTier = "high" | "mid" | "none";

export function classifyUsage(count: number): UsageTier {
  if (count >= 8) return "high";
  if (count >= 1) return "mid";
  return "none";
}

export function UsageBadge({
  tier,
  count,
  testId,
}: {
  tier: UsageTier;
  count?: number;
  testId?: string;
}) {
  const { t } = useLanguage();

  const cls =
    tier === "high" ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" :
    tier === "mid"  ? "bg-slate-100 text-slate-700 ring-1 ring-slate-200" :
                      "bg-slate-50 text-slate-400 ring-1 ring-slate-200";
  const dotCls =
    tier === "high" ? "bg-emerald-500" :
    tier === "mid"  ? "bg-slate-400"   :
                      "bg-slate-300";
  const label =
    tier === "high" ? t.reorderUsageHigh :
    tier === "mid"  ? t.reorderUsageMid  :
                      t.reorderUsageNone;
  const n = count ?? 0;
  const tooltip = n === 0
    ? t.reorderUsageTooltipNone
    : t.reorderUsageTooltip.replace("{n}", String(n));

  return (
    <span
      title={tooltip}
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}
      data-testid={testId}
    >
      <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${dotCls}`} aria-hidden="true" />
      {label}
    </span>
  );
}
