import { useLanguage } from "@/hooks/use-language";
import { classifyUsagePattern, USAGE_PATTERN_STYLES, type UsagePattern } from "@/lib/usagePattern";

export function UsagePatternBadge({
  issueCount30d,
  issueCount90d,
  lastIssueAt,
  testId,
}: {
  issueCount30d: number;
  issueCount90d: number;
  lastIssueAt?: string | Date | null;
  testId?: string;
}) {
  const { t } = useLanguage();

  const c30 = issueCount30d ?? 0;
  const c90 = issueCount90d ?? c30;
  const pattern: UsagePattern = classifyUsagePattern(c30, c90);
  const styles = USAGE_PATTERN_STYLES[pattern];

  const label =
    pattern === "core"   ? t.reorderUsagePatternCore   :
    pattern === "normal" ? t.reorderUsagePatternNormal :
    pattern === "low"    ? t.reorderUsagePatternLow    :
                           t.reorderUsagePatternNone;

  const lastLine = lastIssueAt
    ? "\n" + t.reorderUsagePatternLastUsed.replace(
        "{date}",
        new Date(lastIssueAt).toISOString().slice(0, 10),
      )
    : c90 === 0
      ? "\n" + t.reorderUsagePatternNoRecent
      : "";

  const tooltip = t.reorderUsagePatternTooltip
    .replace("{n30}", String(c30))
    .replace("{n90}", String(c90)) + lastLine;

  return (
    <span
      title={tooltip}
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles.chip}`}
      data-testid={testId}
    >
      <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${styles.dot}`} aria-hidden="true" />
      {label}
    </span>
  );
}
