/**
 * Shared reel-eligibility helper — single source of truth.
 *
 * Reel-based UI is available ONLY for:
 *   • Cable / Wire items (category.name === "Cable / Wire")
 *   • Flexible Conduit items (subcategory === "Flex Conduit")
 *
 * All other categories — EMT, Rigid, PVC Conduit, Cable Tray, etc. —
 * are NOT reel-eligible, regardless of unit-of-measure or legacy reel records.
 */

type ReelEligibilityInput = {
  category?: { name?: string | null } | null;
  subcategory?: string | null;
};

export function isReelEligibleItem(item: ReelEligibilityInput): boolean {
  const categoryName = (item.category?.name ?? "").trim();
  const subcategory  = (item.subcategory ?? "").trim();

  if (categoryName === "Cable / Wire") return true;
  if (subcategory === "Flex Conduit")  return true;

  return false;
}
