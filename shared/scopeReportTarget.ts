export type ScopeReportTarget = "material" | "equipment";

export function resolveScopeReportTarget(scopeItem: {
  reportTarget?: unknown;
  section?: unknown;
  category?: unknown;
}): ScopeReportTarget {
  if (scopeItem.reportTarget === "equipment") return "equipment";
  if (scopeItem.reportTarget === "material") return "material";

  const classificationText = `${String(scopeItem.section ?? "")} ${String(scopeItem.category ?? "")}`
    .trim()
    .toLowerCase();
  return classificationText.includes("rental equipment") ? "equipment" : "material";
}