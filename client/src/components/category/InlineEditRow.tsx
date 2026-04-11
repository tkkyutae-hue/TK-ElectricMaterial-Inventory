import { useState, useEffect, useRef } from "react";
import { ImageIcon, Trash2, X as XIcon } from "lucide-react";
import { TableRow, TableCell } from "@/components/ui/table";
import type { CategoryGroupedItem, EditDraft, NewRowDraft, ClassifyPreview } from "./types";
import { UOM_OPTIONS, generateAutoSku } from "./types";
import { LocationCombobox } from "./LocationCombobox";
import { isReelEligible } from "@/lib/reelEligibility";

// ── Tracking Mode Pills ───────────────────────────────────────────────────────
type TrackingModeValue = "standard" | "reel" | null;

function TrackingModePills({
  value,
  reelAllowed,
  error,
  onChange,
}: {
  value: TrackingModeValue;
  reelAllowed: boolean;
  error?: string;
  onChange: (mode: TrackingModeValue, err: string) => void;
}) {
  const options: { mode: TrackingModeValue; label: string }[] = [
    { mode: null,       label: "Auto"  },
    { mode: "standard", label: "Std"   },
    { mode: "reel",     label: "Reel"  },
  ];
  return (
    <div className="mt-1.5">
      <div className="flex items-center gap-1">
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mr-0.5">Mode</span>
        {options.map(({ mode, label }) => {
          const isActive = (value ?? null) === mode;
          const isInvalid = mode === "reel" && !reelAllowed;
          return (
            <button
              key={String(mode)}
              type="button"
              onClick={() => {
                const err = mode === "reel" && !reelAllowed
                  ? "This item type is not eligible for reel tracking"
                  : "";
                onChange(mode, err);
              }}
              className={`text-[10px] px-1.5 py-0.5 rounded font-medium transition-all
                ${isActive && isInvalid ? "bg-red-500 text-white" :
                  isActive ? "bg-brand-600 text-white" :
                  "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
              data-testid={`tracking-mode-${String(mode)}`}
            >
              {label}
            </button>
          );
        })}
      </div>
      {error && <p className="text-[10px] text-red-500 mt-0.5 leading-tight">{error}</p>}
    </div>
  );
}

// ── InlineEditRow ─────────────────────────────────────────────────────────────
interface InlineEditRowProps {
  item: CategoryGroupedItem;
  draft: EditDraft;
  locations: any[];
  onChange: (patch: Partial<EditDraft>) => void;
  onDelete: () => void;
}

export function InlineEditRow({ item, draft, locations, onChange, onDelete }: InlineEditRowProps) {
  const [showImageInput, setShowImageInput] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputCls = "w-full text-xs bg-white border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-400";

  if (draft._deleted) return null;

  return (
    <TableRow className="bg-amber-50/30 border-b border-amber-100" data-testid={`row-edit-item-${item.id}`}>
      <TableCell className="font-mono text-xs text-slate-400 py-2 px-2 text-center">{item.sku}</TableCell>
      <TableCell className="py-2">
        <div className="flex flex-col items-center gap-1">
          {draft.imageUrl ? (
            <img src={draft.imageUrl} alt="" className="w-8 h-8 object-cover rounded border border-slate-200 mx-auto block" onError={e => { e.currentTarget.style.opacity = "0.3"; }} />
          ) : (
            <div className="w-8 h-8 rounded border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center mx-auto">
              <ImageIcon className="w-3.5 h-3.5 text-slate-300" />
            </div>
          )}
          <button type="button" onClick={() => setShowImageInput(v => !v)} className="text-[9px] text-brand-600 hover:text-brand-800 leading-none" data-testid={`btn-edit-photo-${item.id}`}>
            {showImageInput ? "hide" : "edit"}
          </button>
          {showImageInput && (
            <input type="text" value={draft.imageUrl ?? ""} onChange={e => onChange({ imageUrl: e.target.value || null })} placeholder="Image URL…"
              className="w-20 text-[10px] border border-slate-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-brand-500" data-testid={`input-edit-photo-${item.id}`} />
          )}
        </div>
      </TableCell>
      <TableCell className="py-2">
        <input value={draft.sizeLabel} onChange={e => onChange({ sizeLabel: e.target.value })} className={inputCls} data-testid={`input-edit-size-${item.id}`} />
      </TableCell>
      <TableCell className="py-2">
        <input value={draft.name} onChange={e => onChange({ name: e.target.value })} className={`${inputCls} min-w-[140px]`} data-testid={`input-edit-name-${item.id}`} />
        <TrackingModePills
          value={(draft.trackingMode ?? null) as TrackingModeValue}
          reelAllowed={isReelEligible({ name: draft.name, sku: item.sku, subcategory: item.subcategory, detailType: item.detailType, baseItemName: item.baseItemName, unitOfMeasure: draft.unitOfMeasure })}
          error={draft.trackingModeError}
          onChange={(mode, err) => onChange({ trackingMode: mode, trackingModeError: err })}
        />
      </TableCell>
      <TableCell className="py-2 text-center">
        <input type="number" min="0" value={draft.quantityOnHand} onChange={e => onChange({ quantityOnHand: Number(e.target.value) })}
          className="w-full text-xs text-center bg-white border border-slate-300 rounded px-1 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-400" data-testid={`input-edit-qty-${item.id}`} />
      </TableCell>
      <TableCell className="py-2 text-center">
        <select value={draft.unitOfMeasure} onChange={e => onChange({ unitOfMeasure: e.target.value })}
          className="w-full text-xs text-center bg-white border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500" data-testid={`select-edit-unit-${item.id}`}>
          {UOM_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </TableCell>
      <TableCell className="py-2">
        <LocationCombobox value={draft.primaryLocationId} onChange={id => onChange({ primaryLocationId: id })} locations={locations} />
      </TableCell>
      <TableCell className="py-2 pr-5">
        <div className="flex items-center justify-center">
          {confirmDelete ? (
            <div className="flex gap-1 items-center">
              <button type="button" onClick={onDelete} className="text-[10px] text-red-600 font-semibold hover:text-red-800 whitespace-nowrap" data-testid={`btn-confirm-delete-${item.id}`}>Confirm</button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="text-[10px] text-slate-400 hover:text-slate-600">Cancel</button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all" title="Delete item" data-testid={`btn-delete-row-${item.id}`}>
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

// ── InlineNewRow ──────────────────────────────────────────────────────────────
interface InlineNewRowProps {
  draft: NewRowDraft;
  familyName: string;
  categoryId?: number;
  categoryCode?: string | null;
  existingItems: CategoryGroupedItem[];
  existingSkus: Set<string>;
  locations: any[];
  onChange: (patch: Partial<NewRowDraft>) => void;
  onRemove: () => void;
}

export function InlineNewRow({ draft, familyName, categoryId, existingItems, existingSkus, locations, onChange, onRemove }: InlineNewRowProps) {
  const [preview, setPreview] = useState<ClassifyPreview | null>(null);
  const [showOverride, setShowOverride] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const inputCls = (err?: string) =>
    `w-full text-xs bg-white border ${err ? "border-red-400 ring-1 ring-red-300" : "border-slate-300"} rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-400`;

  useEffect(() => {
    if (!draft.name.trim()) { setPreview(null); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/items/classify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name: draft.name.trim(),
            baseItemName: familyName,
            categoryId,
            sizeLabel: draft.sizeLabel,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setPreview(data);
        }
      } catch { /* ignore */ }
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [draft.name, draft.sizeLabel, familyName, categoryId]);

  function handleSizeChange(v: string) {
    const patch: Partial<NewRowDraft> = { sizeLabel: v };
    if (!draft.nameManuallyEdited && v.trim() && familyName.trim()) {
      patch.name = `${v.trim()} ${familyName.trim()}`;
    }
    if (!draft.skuManuallyEdited) {
      patch.sku = generateAutoSku(familyName, existingItems, v, existingSkus);
      patch.skuError = "";
    }
    onChange(patch);
  }

  function handleSkuChange(v: string) {
    onChange({ sku: v.toUpperCase(), skuManuallyEdited: true, skuError: "" });
  }

  function handleNameChange(v: string) {
    onChange({ name: v, nameManuallyEdited: true });
  }

  function validateSku(value: string): boolean {
    const up = value.trim().toUpperCase();
    if (!up) { onChange({ skuError: "Required" }); return false; }
    if (existingSkus.has(up)) { onChange({ skuError: "Duplicate SKU" }); return false; }
    onChange({ skuError: "" }); return true;
  }

  const skuIsAutoGenerated = !draft.skuManuallyEdited && !!draft.sku;
  const hasPreview = preview && (preview.family || preview.type);

  function statusLabel(qty: number): { label: string; cls: string } {
    if (qty === 0) return { label: "Out of Stock", cls: "text-red-600 bg-red-50" };
    return { label: "In Stock", cls: "text-green-700 bg-green-50" };
  }
  const { label: stLabel, cls: stCls } = statusLabel(draft.quantityOnHand);

  const reelAllowedForNew = isReelEligible({
    name: draft.name,
    subcategory: draft.subcategoryOverride || preview?.subcategory || null,
    detailType: draft.detailTypeOverride || preview?.detailType || null,
    baseItemName: familyName,
    unitOfMeasure: draft.unitOfMeasure,
  });

  return (
    <TableRow className="bg-brand-50/40 border-b border-brand-100" data-testid={`row-new-item-${draft.tmpId}`}>
      <TableCell className="pl-5 py-2 align-top">
        <input value={draft.sku} placeholder="SKU (auto)"
          onChange={e => handleSkuChange(e.target.value)}
          onBlur={e => validateSku(e.target.value)}
          className={inputCls(draft.skuError)} data-testid={`input-new-sku-${draft.tmpId}`} />
        {draft.skuError
          ? <p className="text-red-500 text-[10px] mt-0.5 font-medium">{draft.skuError}</p>
          : skuIsAutoGenerated && <p className="text-[10px] text-brand-500 mt-0.5">Auto-generated</p>
        }
      </TableCell>
      <TableCell className="py-2 align-middle">
        <div className="w-8 h-8 rounded border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center mx-auto">
          <ImageIcon className="w-3.5 h-3.5 text-slate-200" />
        </div>
      </TableCell>
      <TableCell className="py-2 align-top">
        <input value={draft.sizeLabel} placeholder='e.g. 3/4"' onChange={e => handleSizeChange(e.target.value)}
          className={inputCls()} data-testid={`input-new-size-${draft.tmpId}`} />
      </TableCell>
      <TableCell className="py-2 align-top" style={{ minWidth: 180 }}>
        <input value={draft.name} placeholder="Item name *" onChange={e => handleNameChange(e.target.value)}
          className={`${inputCls()} min-w-[140px]`} data-testid={`input-new-name-${draft.tmpId}`} />
        {!draft.nameManuallyEdited && draft.sizeLabel.trim() && !hasPreview && (
          <p className="text-[10px] text-brand-500 mt-0.5">Auto-suggested</p>
        )}
        {hasPreview && (
          <div className="mt-1 space-y-0.5">
            <div className="flex items-center gap-1 flex-wrap" data-testid={`classify-preview-${draft.tmpId}`}>
              {preview!.family && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-brand-700 bg-brand-50 border border-brand-200 rounded px-1.5 py-0.5">
                  {preview!.family}
                </span>
              )}
              {preview!.type && preview!.type !== preview!.family && (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-600 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">
                  {preview!.type}
                </span>
              )}
              {preview!.subcategoryDisplay && (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-500 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">
                  {preview!.subcategoryDisplay}
                </span>
              )}
              <button
                type="button"
                onClick={() => setShowOverride(v => !v)}
                className="text-[10px] text-slate-400 hover:text-brand-600 underline ml-0.5"
                data-testid={`btn-override-classify-${draft.tmpId}`}
                title="Override classification"
              >
                {showOverride ? "hide" : "override"}
              </button>
            </div>
            {showOverride && (
              <div className="flex items-center gap-1.5 mt-1 p-1.5 bg-amber-50 border border-amber-200 rounded" data-testid={`classify-override-${draft.tmpId}`}>
                <div className="flex-1">
                  <p className="text-[9px] font-semibold text-slate-400 uppercase mb-0.5">Subcategory</p>
                  <input
                    value={draft.subcategoryOverride ?? preview?.subcategory ?? ''}
                    onChange={e => onChange({ subcategoryOverride: e.target.value || null })}
                    placeholder={preview?.subcategory ?? 'e.g. EMT Conduit'}
                    className="w-full text-[11px] bg-white border border-slate-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    data-testid={`input-override-subcategory-${draft.tmpId}`}
                  />
                </div>
                <div className="flex-1">
                  <p className="text-[9px] font-semibold text-slate-400 uppercase mb-0.5">Detail Type</p>
                  <input
                    value={draft.detailTypeOverride ?? preview?.detailType ?? ''}
                    onChange={e => onChange({ detailTypeOverride: e.target.value || null })}
                    placeholder={preview?.detailType ?? 'e.g. Conduit'}
                    className="w-full text-[11px] bg-white border border-slate-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    data-testid={`input-override-detailtype-${draft.tmpId}`}
                  />
                </div>
                {(draft.subcategoryOverride || draft.detailTypeOverride) && (
                  <button
                    type="button"
                    onClick={() => onChange({ subcategoryOverride: null, detailTypeOverride: null })}
                    className="self-end mb-0.5 text-slate-400 hover:text-red-500"
                    title="Reset to auto"
                    data-testid={`btn-reset-classify-${draft.tmpId}`}
                  >
                    <XIcon className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        <TrackingModePills
          value={(draft.trackingMode ?? null) as TrackingModeValue}
          reelAllowed={reelAllowedForNew}
          error={draft.trackingModeError}
          onChange={(mode, err) => onChange({ trackingMode: mode, trackingModeError: err })}
        />
      </TableCell>
      <TableCell className="py-2 align-top text-center">
        <input type="number" min="0" value={draft.quantityOnHand}
          onChange={e => onChange({ quantityOnHand: Number(e.target.value) })}
          className="w-16 text-xs text-center bg-white border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500" data-testid={`input-new-qty-${draft.tmpId}`} />
      </TableCell>
      <TableCell className="py-2 align-top text-center">
        <select value={draft.unitOfMeasure} onChange={e => onChange({ unitOfMeasure: e.target.value })}
          className="w-full text-xs text-center bg-white border border-slate-300 rounded px-1.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500" data-testid={`select-new-unit-${draft.tmpId}`}>
          {UOM_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </TableCell>
      <TableCell className="py-2 align-top">
        <LocationCombobox value={draft.primaryLocationId} onChange={id => onChange({ primaryLocationId: id })} locations={locations} />
      </TableCell>
      <TableCell className="py-2 pr-5 align-top">
        <div className="flex flex-col items-center gap-1">
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${stCls}`} data-testid={`status-new-item-${draft.tmpId}`}>{stLabel}</span>
          <button type="button" onClick={onRemove} className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all" title="Remove row" data-testid={`btn-remove-new-row-${draft.tmpId}`}>
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </TableCell>
    </TableRow>
  );
}
