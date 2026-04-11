import { useState, useMemo, useRef, useEffect, Fragment } from "react";
import { createPortal } from "react-dom";
import { X, Trash2, Plus, Save, CheckCircle2, AlertCircle, Layers, Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BundleRow } from "../types";
import { newBundleRow, flexMatch } from "../types";
import { CATEGORY_ORDER } from "../categoryConfig";
import {
  getEMTTemplate, getRigidTemplate, getFlexibleTemplate,
  BUNDLE_DEFINITIONS, BUNDLE_SIZES,
} from "../bundleTemplates";

function BundleScopeRow({
  row, invItems, onChange, onRemove, rowIndex, bundleType, isDuplicate,
}: {
  row: BundleRow;
  invItems: any[];
  onChange: (updated: BundleRow) => void;
  onRemove: () => void;
  rowIndex: number;
  bundleType?: string;
  bundleSize?: string;
  isDuplicate?: boolean;
}) {
  const [invSearch, setInvSearch] = useState(
    row.linkedInventoryItemId
      ? (invItems.find(it => it.id === row.linkedInventoryItemId)?.name ?? row.itemName)
      : row.itemName
  );
  const [invOpen, setInvOpen] = useState(false);
  const [dropRect, setDropRect] = useState<DOMRect | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const prevLinkedId = useRef(row.linkedInventoryItemId);
  const prevItemName = useRef(row.itemName);
  useEffect(() => {
    const idChanged = row.linkedInventoryItemId !== prevLinkedId.current;
    const nameChanged = row.itemName !== prevItemName.current;
    if (idChanged) {
      if (row.linkedInventoryItemId) {
        const item = invItems.find(it => it.id === row.linkedInventoryItemId);
        if (item) setInvSearch(item.name);
      } else {
        setInvSearch(row.itemName);
      }
      prevLinkedId.current = row.linkedInventoryItemId;
    } else if (nameChanged && !row.linkedInventoryItemId) {
      setInvSearch(row.itemName);
    }
    prevItemName.current = row.itemName;
  }, [row.itemName, row.linkedInventoryItemId, invItems]);

  const filtered = useMemo(() => {
    const query = invSearch.trim();
    let pool = invItems;
    if (!query && bundleType) {
      const bt = bundleType.toLowerCase();
      pool = invItems.filter(it => {
        const n = it.name.toLowerCase();
        if (bt.includes("emt conduit")) return n.includes("emt");
        if (bt.includes("rigid conduit")) return n.includes("rigid") && !n.includes("flexible") && !n.includes("liquidtight");
        if (bt.includes("flexible conduit")) return n.includes("flexible") || n.includes("liquidtight");
        if (bt.includes("cable tray")) return n.includes("cable tray") || n.includes("tray");
        if (bt.includes("box") || bt.includes("device")) {
          return n.includes("box") || n.includes("receptacle") || n.includes("switch") || n.includes("plate") || n.includes("duplex") || n.includes("device");
        }
        if (bt.includes("grounding")) return n.includes("ground");
        return true;
      });
    }
    if (!query) return pool.slice(0, 10);
    return pool.filter(it => flexMatch(query, it.name)).slice(0, 10);
  }, [invSearch, invItems, bundleType]);

  function openDrop() {
    if (!row.checked) return;
    if (inputRef.current) setDropRect(inputRef.current.getBoundingClientRect());
    setInvOpen(true);
  }

  function selectInv(it: any) {
    setInvSearch(it.name);
    setInvOpen(false);
    onChange({ ...row, itemName: it.name, unit: it.unitOfMeasure ?? row.unit, linkedInventoryItemId: it.id });
  }

  const dropdownPortal = invOpen && row.checked && filtered.length > 0 && dropRect
    ? createPortal(
        <div style={{ position: "fixed", top: dropRect.bottom + 2, left: dropRect.left, width: dropRect.width, zIndex: 9999 }}
          className="bg-white border border-slate-200 rounded-lg shadow-2xl max-h-44 overflow-y-auto">
          {filtered.map(it => (
            <button key={it.id} type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => selectInv(it)}
              className={`w-full text-left px-3 py-1.5 text-[11px] flex items-center justify-between gap-2 hover:bg-slate-50 ${row.linkedInventoryItemId === it.id ? "bg-emerald-50 text-emerald-800 font-semibold" : "text-slate-700"}`}>
              <span className="truncate">{it.name}</span>
              <span className="text-[10px] text-slate-400 shrink-0">{it.unitOfMeasure}</span>
            </button>
          ))}
        </div>,
        document.body
      )
    : null;

  return (
    <Fragment>
      <tr className={`transition-colors border-t border-slate-100 ${!row.checked ? "opacity-40 bg-slate-50/50" : isDuplicate ? "bg-red-50 border-red-200" : "bg-white"}`}
        data-testid={`bundle-row-${rowIndex}`}>
        <td className="px-3 py-2">
          <input type="checkbox" checked={row.checked}
            onChange={e => onChange({ ...row, checked: e.target.checked })}
            className="rounded" data-testid={`bundle-row-check-${rowIndex}`} />
        </td>
        <td className="px-2 py-2">
          <div className="relative">
            <Input
              ref={inputRef}
              value={invSearch}
              placeholder="Search inventory…"
              disabled={!row.checked}
              onChange={e => {
                const val = e.target.value;
                setInvSearch(val);
                if (inputRef.current) setDropRect(inputRef.current.getBoundingClientRect());
                setInvOpen(true);
                if (row.linkedInventoryItemId && val !== invItems.find(it => it.id === row.linkedInventoryItemId)?.name) {
                  onChange({ ...row, itemName: val, linkedInventoryItemId: null });
                } else {
                  onChange({ ...row, itemName: val });
                }
              }}
              onFocus={openDrop}
              onBlur={() => setTimeout(() => setInvOpen(false), 200)}
              className={`h-7 text-xs ${row.linkedInventoryItemId ? "border-emerald-300 bg-emerald-50/60" : ""}`}
              data-testid={`bundle-row-name-${rowIndex}`}
            />
            {row.checked && row.linkedInventoryItemId && (
              <button type="button"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                onClick={() => { setInvSearch(""); onChange({ ...row, itemName: "", linkedInventoryItemId: null }); }}>
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          {row.checked && row.linkedInventoryItemId && (
            <p className="text-[9px] text-emerald-600 mt-0.5 flex items-center gap-0.5">
              <CheckCircle2 className="w-2 h-2" /> linked
            </p>
          )}
        </td>
        <td className="px-2 py-2 w-14">
          <Input value={row.unit} disabled={!row.checked}
            onChange={e => onChange({ ...row, unit: e.target.value })}
            className="h-7 text-xs w-14" data-testid={`bundle-row-unit-${rowIndex}`} />
        </td>
        <td className="px-2 py-2 w-20">
          <Input type="number" min="0" step="any" value={row.estimatedQty} placeholder="0"
            disabled={!row.checked}
            onChange={e => onChange({ ...row, estimatedQty: e.target.value })}
            className="h-7 text-xs w-20" data-testid={`bundle-row-qty-${rowIndex}`} />
        </td>
        <td className="px-2 py-2 w-28">
          <Input value={row.category} disabled={!row.checked}
            onChange={e => onChange({ ...row, category: e.target.value })}
            className="h-7 text-xs w-28"
            list={`bundle-cat-list-${rowIndex}`}
            data-testid={`bundle-row-cat-${rowIndex}`} />
          <datalist id={`bundle-cat-list-${rowIndex}`}>
            {CATEGORY_ORDER.map(c => <option key={c} value={c} />)}
            <option value="EMT Support" />
            <option value="Rigid Support" />
          </datalist>
        </td>
        <td className="px-2 py-2 w-20">
          <select value={row.scopeType} disabled={!row.checked}
            onChange={e => onChange({ ...row, scopeType: e.target.value as "primary" | "support" })}
            className="h-7 text-[11px] border border-slate-200 rounded px-1 bg-white w-20"
            data-testid={`bundle-row-type-${rowIndex}`}>
            <option value="primary">Primary</option>
            <option value="support">Support</option>
          </select>
        </td>
        <td className="px-2 py-2 w-8">
          <button type="button" onClick={onRemove}
            className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
            data-testid={`bundle-row-delete-${rowIndex}`}>
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </td>
      </tr>
      {dropdownPortal}
    </Fragment>
  );
}

export function BundleSelector({
  onSave, onClose, invItems,
}: {
  onSave: (rows: Omit<BundleRow, "localId" | "checked">[]) => void;
  onClose: () => void;
  invItems: any[];
}) {
  const [phase, setPhase] = useState<"select" | "configure">("select");
  const [selectedBundle, setSelectedBundle] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [flexibleType, setFlexibleType] = useState<string>("Metal Flexible");
  const [bundleRows, setBundleRows] = useState<BundleRow[]>([]);

  const availableSizes = selectedBundle ? (BUNDLE_SIZES[selectedBundle] ?? []) : [];

  function normSize(s: string): string {
    return s.replace(/(\d)-(\d)/g, "$1 $2");
  }

  function resolveInvMatch(searchWords: string[], sizeNorm: string) {
    return sizeNorm
      ? invItems.find(inv => {
          const n = inv.name.toLowerCase();
          const nNorm = normSize(n.replace(/['"#]/g, "").trim());
          const normSz = normSize(sizeNorm);
          const sizeMatch = nNorm.startsWith(normSz + " ") || nNorm === normSz;
          return sizeMatch && searchWords.every(w => n.includes(w));
        })
      : invItems.find(inv => {
          const n = inv.name.toLowerCase();
          return searchWords.every(w => n.includes(w));
        });
  }

  function buildRows(bundleName: string, size: string, flexType?: string): BundleRow[] {
    let templateItems;
    if (bundleName === "EMT Conduit Bundle") {
      templateItems = getEMTTemplate(size);
    } else if (bundleName === "Rigid Conduit Bundle") {
      templateItems = getRigidTemplate(size);
    } else if (bundleName === "Flexible Conduit Bundle") {
      templateItems = getFlexibleTemplate(flexType ?? flexibleType);
    } else {
      templateItems = BUNDLE_DEFINITIONS[bundleName] ?? [];
    }
    const sizeNorm = size ? size.toLowerCase().replace(/['"#]/g, "").trim() : "";
    return templateItems.map(it => {
      const match = resolveInvMatch(it.searchWords, sizeNorm);
      return {
        localId: Math.random().toString(36).slice(2),
        itemName: match ? match.name : it.itemName,
        unit: match ? (match.unitOfMeasure || it.unit) : it.unit,
        estimatedQty: "",
        category: it.category,
        scopeType: it.scopeType,
        checked: true,
        linkedInventoryItemId: match ? match.id : null,
      };
    });
  }

  function pickBundle(name: string) {
    const defaultSize = BUNDLE_SIZES[name]?.[0] ?? "";
    const defaultFlexType = "Metal Flexible";
    setSelectedBundle(name);
    setSelectedSize(defaultSize);
    if (name === "Flexible Conduit Bundle") setFlexibleType(defaultFlexType);
    setBundleRows(buildRows(name, defaultSize, defaultFlexType));
    setPhase("configure");
  }

  function handleSizeChange(size: string) {
    setSelectedSize(size);
    if (!selectedBundle) return;
    setBundleRows(buildRows(selectedBundle, size, flexibleType));
  }

  function handleFlexTypeChange(flexType: string) {
    setFlexibleType(flexType);
    if (selectedBundle !== "Flexible Conduit Bundle") return;
    setBundleRows(buildRows("Flexible Conduit Bundle", selectedSize, flexType));
  }

  function addManualRow() {
    setBundleRows(prev => [...prev, newBundleRow()]);
  }

  function updateRow(localId: string, updated: BundleRow) {
    setBundleRows(prev => prev.map(r => r.localId === localId ? updated : r));
  }

  function removeRow(localId: string) {
    setBundleRows(prev => prev.filter(r => r.localId !== localId));
  }

  const duplicateInvIds: Set<number> = useMemo(() => {
    const checked = bundleRows.filter(r => r.checked && r.linkedInventoryItemId);
    const idCounts = new Map<number, number>();
    checked.forEach(r => {
      const id = r.linkedInventoryItemId!;
      idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
    });
    const dups = new Set<number>();
    idCounts.forEach((count, id) => { if (count > 1) dups.add(id); });
    return dups;
  }, [bundleRows]);

  const hasDuplicates = duplicateInvIds.size > 0;

  function handleSave() {
    if (hasDuplicates) return;
    const toSave = bundleRows
      .filter(r => r.checked && r.itemName.trim())
      .map(({ localId: _l, checked: _c, ...rest }) => rest);
    onSave(toSave);
  }

  const checkedCount = bundleRows.filter(r => r.checked && r.itemName.trim()).length;

  if (phase === "select") {
    return (
      <div className="premium-card bg-white overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-brand-50/40">
          <div>
            <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
              <Boxes className="w-4 h-4 text-brand-600" /> Add by Bundle
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Select a bundle template — then pick a size and confirm items</p>
          </div>
          <Button size="sm" variant="outline" onClick={onClose} data-testid="button-cancel-bundle">Cancel</Button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { name: "EMT Conduit Bundle",      count: 7 },
            { name: "Rigid Conduit Bundle",    count: 6 },
            { name: "Flexible Conduit Bundle", count: 3 },
            { name: "Cable Tray Bundle",        count: (BUNDLE_DEFINITIONS["Cable Tray Bundle"] ?? []).length },
            { name: "Box / Device Bundle",     count: (BUNDLE_DEFINITIONS["Box / Device Bundle"] ?? []).length },
            { name: "Grounding Bundle",        count: (BUNDLE_DEFINITIONS["Grounding Bundle"] ?? []).length },
          ].map(({ name, count }) => (
            <button
              key={name} type="button"
              onClick={() => pickBundle(name)}
              className="text-left p-4 border border-slate-200 rounded-xl hover:border-brand-300 hover:bg-brand-50/30 transition-all group"
              data-testid={`bundle-card-${name.replace(/\s+/g, "-")}`}
            >
              <div className="flex items-start gap-2.5">
                <div className="p-1.5 bg-brand-50 border border-brand-100 rounded-lg group-hover:bg-brand-100 transition-colors shrink-0">
                  <Layers className="w-3.5 h-3.5 text-brand-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-800 leading-snug">{name}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{count} items · click to configure</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="premium-card bg-white overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-brand-50/40">
        <div>
          <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
            <Layers className="w-4 h-4 text-brand-600" /> {selectedBundle}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">Check items to include · search inventory · fill quantities</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setPhase("select")} className="text-xs">← Back</Button>
          <Button size="sm" variant="outline" onClick={onClose} className="text-xs">Cancel</Button>
        </div>
      </div>

      {selectedBundle === "Flexible Conduit Bundle" && (
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-600 shrink-0">Flexible Type</span>
          <div className="flex gap-1.5">
            {["Metal Flexible", "Liquidtight Flexible"].map(ft => (
              <button
                key={ft} type="button"
                onClick={() => handleFlexTypeChange(ft)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                  flexibleType === ft
                    ? "bg-brand-700 text-white border-brand-700"
                    : "border-slate-200 text-slate-600 hover:border-brand-300 hover:bg-brand-50"
                }`}
                data-testid={`bundle-flex-type-${ft.replace(/\s+/g, "-").toLowerCase()}`}
              >
                {ft}
              </button>
            ))}
          </div>
        </div>
      )}

      {availableSizes.length > 0 && (
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-600 shrink-0">Size</span>
          <div className="flex flex-wrap gap-1.5">
            {availableSizes.map(sz => (
              <button
                key={sz} type="button"
                onClick={() => handleSizeChange(sz)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                  selectedSize === sz
                    ? "bg-brand-700 text-white border-brand-700"
                    : "border-slate-200 text-slate-600 hover:border-brand-300 hover:bg-brand-50"
                }`}
                data-testid={`bundle-size-${sz.replace(/[^a-z0-9]/gi, "-")}`}
              >
                {sz}
              </button>
            ))}
          </div>
          <span className="text-[10px] text-slate-400 ml-1">Applies to item names automatically</span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/80">
            <tr>
              <th className="px-3 py-2.5 w-8"></th>
              <th className="text-left px-2 py-2.5 font-semibold text-slate-600 text-xs">Item (search inventory)</th>
              <th className="text-left px-2 py-2.5 font-semibold text-slate-600 text-xs w-14">Unit</th>
              <th className="text-left px-2 py-2.5 font-semibold text-slate-600 text-xs w-20">Est. Qty</th>
              <th className="text-left px-2 py-2.5 font-semibold text-slate-600 text-xs w-28">Category</th>
              <th className="text-left px-2 py-2.5 font-semibold text-slate-600 text-xs w-20">Type</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {bundleRows.map((row, i) => (
              <BundleScopeRow
                key={row.localId}
                row={row}
                invItems={invItems}
                rowIndex={i}
                onChange={updated => updateRow(row.localId, updated)}
                onRemove={() => removeRow(row.localId)}
                bundleType={selectedBundle ?? undefined}
                bundleSize={selectedSize}
                isDuplicate={!!(row.linkedInventoryItemId && duplicateInvIds.has(row.linkedInventoryItemId))}
              />
            ))}
          </tbody>
        </table>
      </div>

      {hasDuplicates && (
        <div className="px-5 py-2.5 bg-red-50 border-t border-red-200">
          <p className="text-xs text-red-700 font-medium flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            Duplicate inventory items detected — highlighted rows share the same item. Remove duplicates before saving.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">{checkedCount} item{checkedCount !== 1 ? "s" : ""} will be added</span>
          <Button size="sm" variant="outline" className="text-xs border-slate-200 text-slate-600 hover:bg-slate-50" onClick={addManualRow}
            data-testid="button-bundle-add-row">
            <Plus className="w-3 h-3 mr-1" /> Add Row
          </Button>
        </div>
        <Button className="bg-brand-700 hover:bg-brand-800 text-white" onClick={handleSave}
          disabled={checkedCount === 0 || hasDuplicates} data-testid="button-save-bundle">
          <Save className="w-4 h-4 mr-1.5" />
          Add {checkedCount} Item{checkedCount !== 1 ? "s" : ""} to Scope
        </Button>
      </div>
    </div>
  );
}
