import { useState } from "react";
import { X, Trash2, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { type PendingRow, COMMON_UNITS, flexMatch } from "../types";
import { CATEGORY_ORDER } from "../categoryConfig";

export function InlineScopeRow({
  row, invItems, onChange, onRemove, rowIndex,
}: {
  row: PendingRow;
  invItems: any[];
  onChange: (updated: PendingRow) => void;
  onRemove: () => void;
  rowIndex: number;
}) {
  const [invSearch, setInvSearch] = useState(
    row.linkedInventoryItemId
      ? (invItems.find(it => it.id === row.linkedInventoryItemId)?.name ?? row.itemName)
      : row.itemName
  );
  const [invOpen, setInvOpen] = useState(false);

  const filtered = invItems.filter(it => flexMatch(invSearch, it.name)).slice(0, 12);

  function selectInv(it: any) {
    setInvSearch(it.name);
    setInvOpen(false);
    onChange({
      ...row,
      itemName: it.name,
      unit: it.unitOfMeasure ?? row.unit,
      linkedInventoryItemId: it.id,
      category: it.subcategory ?? row.category,
    });
  }

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3" data-testid={`inline-scope-row-${rowIndex}`}>
      <div className="flex items-start gap-2">

        {/* Item / inventory search */}
        <div className="flex-1 min-w-0 space-y-1">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Item / Description *</label>
          <div className="relative">
            <Input
              value={invSearch}
              placeholder="Search inventory or enter name…"
              onChange={(e) => {
                const val = e.target.value;
                setInvSearch(val);
                setInvOpen(true);
                if (row.linkedInventoryItemId && val !== invItems.find(it => it.id === row.linkedInventoryItemId)?.name) {
                  onChange({ ...row, itemName: val, linkedInventoryItemId: null });
                } else {
                  onChange({ ...row, itemName: val });
                }
              }}
              onFocus={() => setInvOpen(true)}
              onBlur={() => setTimeout(() => setInvOpen(false), 150)}
              className={`h-8 text-sm ${row.linkedInventoryItemId ? "border-emerald-300 bg-emerald-50/60" : ""}`}
              data-testid={`inline-scope-name-${rowIndex}`}
            />
            {row.linkedInventoryItemId && (
              <button type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                onClick={() => { setInvSearch(""); onChange({ ...row, itemName: "", linkedInventoryItemId: null }); }}>
                <X className="w-3 h-3" />
              </button>
            )}
            {invOpen && filtered.length > 0 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-white border border-slate-200 rounded-lg shadow-xl max-h-44 overflow-y-auto">
                {filtered.map(it => (
                  <button key={it.id} type="button"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => selectInv(it)}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between gap-2 hover:bg-slate-50 transition-colors ${row.linkedInventoryItemId === it.id ? "bg-emerald-50 text-emerald-800 font-semibold" : "text-slate-700"}`}>
                    <span className="truncate">{it.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono shrink-0">{it.unitOfMeasure ?? ""}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {row.linkedInventoryItemId && (
            <p className="text-[10px] text-emerald-700 flex items-center gap-1">
              <CheckCircle2 className="w-2.5 h-2.5" /> Inventory item linked
            </p>
          )}
        </div>

        {/* Unit */}
        <div className="w-20 space-y-1 shrink-0">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Unit *</label>
          <Input
            value={row.unit}
            placeholder="EA"
            onChange={e => onChange({ ...row, unit: e.target.value })}
            className="h-8 text-sm"
            list={`units-list-${rowIndex}`}
            data-testid={`inline-scope-unit-${rowIndex}`}
          />
          <datalist id={`units-list-${rowIndex}`}>
            {COMMON_UNITS.map(u => <option key={u} value={u} />)}
          </datalist>
        </div>

        {/* Est. Qty */}
        <div className="w-24 space-y-1 shrink-0">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Est. Qty *</label>
          <Input
            type="number" min="0" step="any"
            value={row.estimatedQty} placeholder="0"
            onChange={e => onChange({ ...row, estimatedQty: e.target.value })}
            className="h-8 text-sm"
            data-testid={`inline-scope-qty-${rowIndex}`}
          />
        </div>

        {/* Category */}
        <div className="w-32 space-y-1 shrink-0">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Category</label>
          <Input
            value={row.category}
            placeholder="e.g. Conduit"
            onChange={e => onChange({ ...row, category: e.target.value })}
            className="h-8 text-sm"
            list={`cat-list-${rowIndex}`}
            data-testid={`inline-scope-category-${rowIndex}`}
          />
          <datalist id={`cat-list-${rowIndex}`}>
            {CATEGORY_ORDER.map(c => <option key={c} value={c} />)}
          </datalist>
        </div>

        {/* Scope type */}
        <div className="w-28 space-y-1 shrink-0">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Scope Type</label>
          <select
            value={row.scopeType}
            onChange={e => onChange({ ...row, scopeType: e.target.value as "primary" | "support" })}
            className="h-8 w-full text-xs border border-slate-200 rounded-md px-2 bg-white text-slate-700"
            data-testid={`inline-scope-type-${rowIndex}`}
          >
            <option value="primary">Primary</option>
            <option value="support">Support</option>
          </select>
        </div>

        {/* Remove */}
        <button
          type="button" onClick={onRemove}
          className="mt-6 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
          data-testid={`inline-scope-remove-${rowIndex}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Remarks */}
      <Input
        value={row.remarks}
        placeholder="Remarks (optional)"
        onChange={e => onChange({ ...row, remarks: e.target.value })}
        className="h-7 text-xs text-slate-500 bg-white"
        data-testid={`inline-scope-remarks-${rowIndex}`}
      />
    </div>
  );
}
