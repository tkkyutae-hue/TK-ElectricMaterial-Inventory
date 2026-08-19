import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { extractBoqRowsFromXlsx, extractXlsxTextPreview } from "../server/services/boqXlsx";
import { resolveScopeReportTarget } from "../shared/scopeReportTarget";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const boqFiles = [
  "attached_assets/TKM101026_POD_INSPECTION_R2_1787171280500.xlsx",
  "attached_assets/TKM101026_POD_INSPECTION_R2_boq_1787172015800.xlsx",
];

for (const relativePath of boqFiles) {
  test(`${path.basename(relativePath)} extracts all 74 BOQ items`, async () => {
    const rows = extractBoqRowsFromXlsx(await readFile(path.join(workspaceRoot, relativePath)));
    assert.ok(rows);
    assert.equal(rows.length, 74);
    assert.deepEqual(rows.map((row) => row.sortOrder), Array.from({ length: 74 }, (_, index) => index + 1));

    const equipment = rows.filter((row) => resolveScopeReportTarget(row) === "equipment");
    const materials = rows.filter((row) => resolveScopeReportTarget(row) === "material");
    assert.equal(materials.length, 71);
    assert.deepEqual(
      equipment.map((row) => row.itemName),
      ["SCISSRO LIFT", "BOOM LIFT", "EXCAVATOR"],
    );
    assert.ok(equipment.every((row) => row.section === "RENTAL EQUIPMENT"));
  });
}

test("a workbook without B.O.Q keeps the spreadsheet preview fallback", async () => {
  const buffer = await readFile(
    path.join(workspaceRoot, "attached_assets/items_rev10_concise_sku_with_descriptions_1772641231006.xlsx"),
  );
  assert.equal(extractBoqRowsFromXlsx(buffer), null);
  assert.ok(extractXlsxTextPreview(buffer).split("\n").length > 1);
});