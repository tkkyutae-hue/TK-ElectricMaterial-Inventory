/**
 * Tests for scope-report-target routing.
 *
 * Covers:
 *  1. resolveScopeReportTarget – explicit flag, legacy text inference
 *  2. normalizeScopeReportTarget – server-side validation rules
 *  3. Material / Equipment tab filtering + scopeItemId dedup (client logic)
 *  4. reportTarget round-trips through extract-files / bundle payloads
 */

import assert from "assert";
import { resolveScopeReportTarget, type ScopeReportTarget } from "../shared/scopeReportTarget";

// ─── 1. resolveScopeReportTarget ─────────────────────────────────────────────

function test1_explicitEquipment() {
  const result = resolveScopeReportTarget({ reportTarget: "equipment" });
  assert.strictEqual(result, "equipment", "explicit equipment flag → equipment");
}

function test2_explicitMaterial() {
  const result = resolveScopeReportTarget({ reportTarget: "material" });
  assert.strictEqual(result, "material", "explicit material flag → material");
}

function test3_legacyRentalEquipmentSection() {
  const result = resolveScopeReportTarget({ section: "Rental Equipment" });
  assert.strictEqual(result, "equipment", "section 'Rental Equipment' → equipment");
}

function test4_legacyRentalEquipmentCategoryLower() {
  const result = resolveScopeReportTarget({ category: "rental equipment" });
  assert.strictEqual(result, "equipment", "lowercase category 'rental equipment' → equipment");
}

function test5_legacyRentalEquipmentMixedCase() {
  const result = resolveScopeReportTarget({ section: "RENTAL EQUIPMENT" });
  assert.strictEqual(result, "equipment", "UPPERCASE section 'RENTAL EQUIPMENT' → equipment");
}

function test6_legacyOtherSectionDefaultsMaterial() {
  const result = resolveScopeReportTarget({ section: "Civil Works", category: "Concrete" });
  assert.strictEqual(result, "material", "non-equipment section defaults to material");
}

function test7_emptySectionDefaultsMaterial() {
  const result = resolveScopeReportTarget({});
  assert.strictEqual(result, "material", "no fields → material");
}

function test8_explicitEquipmentOverridesSection() {
  // Even if section says 'rental equipment', explicit flag wins
  const result = resolveScopeReportTarget({
    reportTarget: "material",
    section: "Rental Equipment",
  });
  assert.strictEqual(result, "material", "explicit material overrides rental-equipment section");
}

function test9_explicitMaterialOverridesEquipmentSection() {
  const result = resolveScopeReportTarget({
    reportTarget: "equipment",
    section: "Civil Works",
  });
  assert.strictEqual(result, "equipment", "explicit equipment overrides non-equipment section");
}

function test10_unknownExplicitReportTargetFallsThrough() {
  // An invalid explicit value (e.g. "other") is not "equipment" or "material",
  // so the guard is skipped and text inference runs on section/category.
  const result = resolveScopeReportTarget({
    reportTarget: "other",
    section: "Rental Equipment",
  });
  assert.strictEqual(result, "equipment", "invalid reportTarget falls through to text inference");
}

function test11_unknownExplicitReportTargetFallsToMaterial() {
  const result = resolveScopeReportTarget({
    reportTarget: "other",
    section: "Civil Works",
  });
  assert.strictEqual(result, "material", "invalid reportTarget + non-equipment section → material");
}

function test12_rentalEquipmentInCombinedText() {
  // section + category are concatenated; either can carry the keyword.
  const result = resolveScopeReportTarget({ section: "Site", category: "Rental Equipment" });
  assert.strictEqual(result, "equipment", "keyword in category with generic section → equipment");
}

// ─── 2. normalizeScopeReportTarget (replicated from server/routes.ts) ─────────
//
// The private server function applies one extra validation layer on top of
// resolveScopeReportTarget.  We replicate the logic here so we can test it
// without importing the entire server module.

function normalizeScopeReportTarget(
  value: unknown,
  section?: unknown,
  category?: unknown,
): ScopeReportTarget {
  if (value !== undefined) {
    if (value === "material" || value === "equipment") return value;
    throw new Error("reportTarget must be either material or equipment");
  }
  return resolveScopeReportTarget({ reportTarget: value, section, category });
}

function test13_normalizeAcceptsEquipment() {
  assert.strictEqual(normalizeScopeReportTarget("equipment"), "equipment");
}

function test14_normalizeAcceptsMaterial() {
  assert.strictEqual(normalizeScopeReportTarget("material"), "material");
}

function test15_normalizeThrowsOnInvalidExplicit() {
  assert.throws(
    () => normalizeScopeReportTarget("other"),
    /reportTarget must be either material or equipment/,
    "invalid explicit value must throw",
  );
}

function test16_normalizeThrowsOnNumericValue() {
  assert.throws(() => normalizeScopeReportTarget(42), /reportTarget must be either material or equipment/);
}

function test17_normalizeUndefinedFallsBackToInference() {
  // undefined → falls back to resolveScopeReportTarget with section/category
  assert.strictEqual(
    normalizeScopeReportTarget(undefined, "Rental Equipment", undefined),
    "equipment",
    "undefined value with rental-equipment section → equipment via inference",
  );
}

function test18_normalizeUndefinedDefaultsMaterial() {
  assert.strictEqual(
    normalizeScopeReportTarget(undefined, "Civil Works", "Concrete"),
    "material",
  );
}

function test19_normalizeNullTreatedAsInvalidExplicit() {
  // null !== undefined so it is treated as an explicit (invalid) value
  assert.throws(() => normalizeScopeReportTarget(null), /reportTarget must be either material or equipment/);
}

// ─── 3. Material / Equipment tab filtering + scopeItemId dedup ────────────────
//
// Replicates the pure logic from NewReportTab.tsx without importing React.

interface ScopeItem {
  id: number;
  itemName: string;
  reportTarget?: string;
  section?: string;
  category?: string;
  isActive: boolean;
  unit?: string;
  remarks?: string;
}

interface MaterialRow { scopeItemId: number | null; description: string }
interface EquipmentRow { scopeItemId: number | null; name: string }

function importMaterials(
  scopeItems: ScopeItem[],
  existing: MaterialRow[],
): MaterialRow[] {
  const active = scopeItems.filter(s => s.isActive && resolveScopeReportTarget(s) === "material");
  const existingScopeIds = new Set(existing.map(r => r.scopeItemId).filter(Boolean));
  return active
    .filter(s => !existingScopeIds.has(s.id))
    .map(s => ({ scopeItemId: s.id, description: s.itemName }));
}

function importEquipment(
  scopeItems: ScopeItem[],
  existing: EquipmentRow[],
): EquipmentRow[] {
  const active = scopeItems.filter(s => s.isActive && resolveScopeReportTarget(s) === "equipment");
  const existingScopeIds = new Set(existing.map(r => r.scopeItemId).filter(Boolean));
  return active
    .filter(s => !existingScopeIds.has(s.id))
    .map(s => ({ scopeItemId: s.id, name: s.itemName }));
}

const scopeFixtures: ScopeItem[] = [
  { id: 1, itemName: "Concrete Mix",  reportTarget: "material",  isActive: true, section: "Civil Works" },
  { id: 2, itemName: "Excavator 20T", reportTarget: "equipment", isActive: true, section: "Civil Works" },
  { id: 3, itemName: "Tower Crane",   section: "Rental Equipment", isActive: true },  // legacy inference
  { id: 4, itemName: "Rebar",         section: "Structure",         isActive: true },  // default material
  { id: 5, itemName: "Inactive",      reportTarget: "material",  isActive: false },
];

function test20_importMaterialsExcludesEquipment() {
  const added = importMaterials(scopeFixtures, []);
  const ids = added.map(r => r.scopeItemId);
  assert.ok(!ids.includes(2), "equipment-tagged item must NOT appear in material import");
  assert.ok(!ids.includes(3), "rental-equipment inference must NOT appear in material import");
  assert.ok(ids.includes(1), "material-tagged item must appear");
  assert.ok(ids.includes(4), "default-material (no explicit target) must appear");
}

function test21_importEquipmentExcludesMaterial() {
  const added = importEquipment(scopeFixtures, []);
  const ids = added.map(r => r.scopeItemId);
  assert.ok(!ids.includes(1), "material-tagged item must NOT appear in equipment import");
  assert.ok(!ids.includes(4), "default-material item must NOT appear in equipment import");
  assert.ok(ids.includes(2), "equipment-tagged item must appear");
  assert.ok(ids.includes(3), "rental-equipment-inferred item must appear");
}

function test22_importMaterialsSkipsInactive() {
  const added = importMaterials(scopeFixtures, []);
  assert.ok(!added.some(r => r.scopeItemId === 5), "inactive items must be excluded");
}

function test23_materialImportDeduplicatesByScopeItemId() {
  const existing: MaterialRow[] = [{ scopeItemId: 1, description: "Concrete Mix" }];
  const added = importMaterials(scopeFixtures, existing);
  assert.ok(!added.some(r => r.scopeItemId === 1), "already-imported scopeItemId must be skipped");
}

function test24_equipmentImportDeduplicatesByScopeItemId() {
  const existing: EquipmentRow[] = [{ scopeItemId: 2, name: "Excavator 20T" }];
  const added = importEquipment(scopeFixtures, existing);
  assert.ok(!added.some(r => r.scopeItemId === 2), "already-imported equipment scopeItemId must be skipped");
}

function test25_nullScopeIdRowsDoNotBlockImport() {
  // Rows with scopeItemId === null (extra / copy-from-previous rows) must not
  // count as "already imported" and block a real scope item from being added.
  const existing: MaterialRow[] = [{ scopeItemId: null, description: "Manual entry" }];
  const added = importMaterials(scopeFixtures, existing);
  assert.ok(added.some(r => r.scopeItemId === 1), "null scopeItemId rows must not prevent real imports");
}

function test26_rentalEquipmentNeverEntersMaterialTab() {
  // The regression: Rental Equipment was appearing in the Material tab.
  const rentalOnly: ScopeItem[] = [
    { id: 10, itemName: "Crane Hire", section: "Rental Equipment", isActive: true },
  ];
  const materials = importMaterials(rentalOnly, []);
  assert.strictEqual(materials.length, 0, "Rental Equipment scope items must never be imported into Material tab");
}

function test27_explicitEquipmentNeverEntersMaterialTab() {
  const equipOnly: ScopeItem[] = [
    { id: 11, itemName: "Forklift", reportTarget: "equipment", isActive: true },
  ];
  const materials = importMaterials(equipOnly, []);
  assert.strictEqual(materials.length, 0, "explicit equipment target must never be imported into Material tab");
}

// ─── 4. reportTarget preserved in payload round-trips ─────────────────────────
//
// Simulates the payload construction that auto-population and save use so we
// can assert the target field survives serialization.

function buildScopeItemPayload(
  itemName: string,
  opts: { reportTarget?: string; section?: string; category?: string },
) {
  return {
    itemName,
    reportTarget: normalizeScopeReportTarget(opts.reportTarget, opts.section, opts.category),
    section: opts.section ?? null,
    category: opts.category ?? null,
  };
}

function test28_payloadPreservesExplicitEquipment() {
  const payload = buildScopeItemPayload("Excavator", { reportTarget: "equipment" });
  assert.strictEqual(payload.reportTarget, "equipment", "explicit equipment survives payload build");
}

function test29_payloadPreservesExplicitMaterial() {
  const payload = buildScopeItemPayload("Rebar", { reportTarget: "material" });
  assert.strictEqual(payload.reportTarget, "material", "explicit material survives payload build");
}

function test30_payloadInfersEquipmentFromSection() {
  const payload = buildScopeItemPayload("Tower Crane", { section: "Rental Equipment" });
  assert.strictEqual(payload.reportTarget, "equipment", "rental-equipment section inferred to equipment in payload");
}

function test31_payloadInfersMaterialFallback() {
  const payload = buildScopeItemPayload("Concrete", { section: "Structure" });
  assert.strictEqual(payload.reportTarget, "material", "non-equipment section inferred to material in payload");
}

function test32_payloadRejectsInvalidExplicit() {
  assert.throws(
    () => buildScopeItemPayload("Unknown", { reportTarget: "supplies" }),
    /reportTarget must be either material or equipment/,
    "invalid explicit reportTarget must throw before reaching the DB",
  );
}

// ─── runner ──────────────────────────────────────────────────────────────────

const tests: Array<[string, () => void]> = [
  ["1  – explicit equipment flag", test1_explicitEquipment],
  ["2  – explicit material flag", test2_explicitMaterial],
  ["3  – legacy section 'Rental Equipment'", test3_legacyRentalEquipmentSection],
  ["4  – legacy category lowercase", test4_legacyRentalEquipmentCategoryLower],
  ["5  – legacy section UPPERCASE", test5_legacyRentalEquipmentMixedCase],
  ["6  – other section → material", test6_legacyOtherSectionDefaultsMaterial],
  ["7  – empty item → material", test7_emptySectionDefaultsMaterial],
  ["8  – explicit material overrides rental section", test8_explicitEquipmentOverridesSection],
  ["9  – explicit equipment overrides civil section", test9_explicitMaterialOverridesEquipmentSection],
  ["10 – unknown explicit falls to text inference → equipment", test10_unknownExplicitReportTargetFallsThrough],
  ["11 – unknown explicit falls to text inference → material", test11_unknownExplicitReportTargetFallsToMaterial],
  ["12 – keyword in category + generic section", test12_rentalEquipmentInCombinedText],
  ["13 – normalize accepts 'equipment'", test13_normalizeAcceptsEquipment],
  ["14 – normalize accepts 'material'", test14_normalizeAcceptsMaterial],
  ["15 – normalize throws on 'other'", test15_normalizeThrowsOnInvalidExplicit],
  ["16 – normalize throws on numeric", test16_normalizeThrowsOnNumericValue],
  ["17 – normalize undefined → inference equipment", test17_normalizeUndefinedFallsBackToInference],
  ["18 – normalize undefined → inference material", test18_normalizeUndefinedDefaultsMaterial],
  ["19 – normalize null is invalid explicit", test19_normalizeNullTreatedAsInvalidExplicit],
  ["20 – material import excludes equipment items", test20_importMaterialsExcludesEquipment],
  ["21 – equipment import excludes material items", test21_importEquipmentExcludesMaterial],
  ["22 – material import skips inactive", test22_importMaterialsSkipsInactive],
  ["23 – material import deduplicates by scopeItemId", test23_materialImportDeduplicatesByScopeItemId],
  ["24 – equipment import deduplicates by scopeItemId", test24_equipmentImportDeduplicatesByScopeItemId],
  ["25 – null scopeItemId rows do not block imports", test25_nullScopeIdRowsDoNotBlockImport],
  ["26 – Rental Equipment never enters Material tab (regression)", test26_rentalEquipmentNeverEntersMaterialTab],
  ["27 – explicit equipment never enters Material tab (regression)", test27_explicitEquipmentNeverEntersMaterialTab],
  ["28 – payload preserves explicit equipment", test28_payloadPreservesExplicitEquipment],
  ["29 – payload preserves explicit material", test29_payloadPreservesExplicitMaterial],
  ["30 – payload infers equipment from section", test30_payloadInfersEquipmentFromSection],
  ["31 – payload infers material fallback", test31_payloadInfersMaterialFallback],
  ["32 – payload rejects invalid explicit", test32_payloadRejectsInvalidExplicit],
];

let passed = 0;
let failed = 0;

for (const [name, fn] of tests) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ✗ ${name}`);
    console.error(`      ${err?.message ?? err}`);
    failed++;
  }
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
