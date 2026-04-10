import { z } from "zod";

export const statusConfig: Record<string, { label: string; className: string }> = {
  active:    { label: "Active",    className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  completed: { label: "Completed", className: "bg-slate-100 text-slate-600 border-slate-200" },
  on_hold:   { label: "On Hold",   className: "bg-amber-100 text-amber-700 border-amber-200" },
  cancelled: { label: "Cancelled", className: "bg-rose-100 text-rose-700 border-rose-200" },
};

export const editSchema = z.object({
  name:         z.string().min(1, "Project name is required"),
  customerName: z.string().optional(),
  ownerName:    z.string().optional(),
  jobLocation:  z.string().optional(),
  poNumber:     z.string().optional(),
  status:       z.string().min(1),
  startDate:    z.string().optional(),
  endDate:      z.string().optional(),
  notes:        z.string().optional(),
});
export type EditFormData = z.infer<typeof editSchema>;

export function cleanFormData(data: EditFormData) {
  const clean: any = { ...data };
  const optionalFields: (keyof EditFormData)[] = [
    "customerName", "ownerName", "jobLocation", "poNumber", "startDate", "endDate", "notes",
  ];
  optionalFields.forEach(f => { if (clean[f] === "") clean[f] = null; });
  return clean;
}

export const scopeItemSchema = z.object({
  itemName:              z.string().min(1, "Item name is required"),
  unit:                  z.string().min(1, "Unit is required"),
  estimatedQty:          z.string().min(1, "Qty is required"),
  category:              z.string().optional(),
  remarks:               z.string().optional(),
  isActive:              z.boolean().default(true),
  linkedInventoryItemId: z.number().nullable().optional(),
  scopeType:             z.enum(["primary", "support"]).default("primary"),
  progressCountingMode:  z.enum(["exact", "family", "manual"]).default("exact"),
});
export type ScopeItemFormData = z.infer<typeof scopeItemSchema>;

export const COMMON_UNITS = ["LF", "EA", "FT", "SF", "CY", "LB", "HR", "DAY", "GAL", "TON"];

export function flexMatch(query: string, name: string): boolean {
  if (!query) return true;
  const nameLow = name.toLowerCase();
  const words   = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  return words.every(w => nameLow.includes(w));
}

export type BundleTemplateItem = {
  itemName: string;
  unit: string;
  category: string;
  scopeType: "primary" | "support";
  searchWords: string[];
};

export type PendingRow = {
  localId: string;
  itemName: string;
  unit: string;
  estimatedQty: string;
  category: string;
  linkedInventoryItemId: number | null;
  remarks: string;
  scopeType: "primary" | "support";
};

export type BundleRow = {
  localId: string;
  itemName: string;
  unit: string;
  estimatedQty: string;
  category: string;
  scopeType: "primary" | "support";
  checked: boolean;
  linkedInventoryItemId?: number | null;
};

export function newBundleRow(): BundleRow {
  return {
    localId: Math.random().toString(36).slice(2),
    itemName: "", unit: "EA", estimatedQty: "",
    category: "Other", scopeType: "primary",
    checked: true, linkedInventoryItemId: null,
  };
}

export function newPendingRow(): PendingRow {
  return {
    localId: Math.random().toString(36).slice(2),
    itemName: "", unit: "", estimatedQty: "",
    category: "", linkedInventoryItemId: null, remarks: "",
    scopeType: "primary",
  };
}
