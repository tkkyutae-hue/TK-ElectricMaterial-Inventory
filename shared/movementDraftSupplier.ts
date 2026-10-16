/**
 * Supplier snapshot travels with the existing JSON draft rows, not a new column.
 * Missing legacy values mean unknown; never infer from item/vendor defaults.
 */
export function draftSupplierId(rows: Array<{ supplierId?: number | null }>): number | null {
  const ids = rows.map(row => row.supplierId ?? null);
  if (ids.some(id => id !== null && (!Number.isSafeInteger(id) || id <= 0))) {
    throw new Error("Invalid draft supplier");
  }
  if (ids.some(id => id !== ids[0])) throw new Error("Draft contains conflicting suppliers");
  return ids[0] ?? null;
}
