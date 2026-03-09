import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Package, AlertTriangle, XCircle, CheckCircle2, ChevronRight,
  Search, Plus, Pencil, Trash2, MoveRight, Check, X as XIcon, ImageIcon, Save,
  ChevronDown, ArrowUpDown, ArrowUp, ArrowDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useLocations, useCreateLocation } from "@/hooks/use-reference-data";
import { apiRequest } from "@/lib/queryClient";

// ── Types ─────────────────────────────────────────────────────────────────────
type CategoryGroupedItem = {
  id: number;
  sku: string;
  name: string;
  sizeLabel?: string | null;
  baseItemName?: string | null;
  subcategory?: string | null;
  detailType?: string | null;
  quantityOnHand: number;
  reorderPoint: number;
  unitOfMeasure: string;
  status: string;
  imageUrl?: string | null;
  location?: { id?: number; name: string } | null;
  primaryLocationId?: number | null;
  supplier?: { name: string } | null;
};

type ItemClassDraft = {
  name: string;
  subcategory: string;
  detailType: string;
  subType: string;
};

type CategoryItemGroup = {
  baseItemName: string;
  items: CategoryGroupedItem[];
  representativeImage?: string | null;
  customImageUrl?: string | null;
};

type CategoryGroupedDetail = {
  category: {
    id: number;
    name: string;
    description?: string | null;
    imageUrl?: string | null;
    code?: string | null;
  };
  skuCount: number;
  totalQuantity: number;
  lowStockCount: number;
  outOfStockCount: number;
  groups: CategoryItemGroup[];
};

type EditDraft = {
  sizeLabel: string;
  name: string;
  quantityOnHand: number;
  unitOfMeasure: string;
  primaryLocationId: number | null;
  imageUrl: string | null;
  _deleted?: boolean;
};

type NewRowDraft = {
  tmpId: string;
  sku: string;
  sizeLabel: string;
  name: string;
  quantityOnHand: number;
  unitOfMeasure: string;
  primaryLocationId: number | null;
  imageUrl: string | null;
  skuError: string;
  nameManuallyEdited: boolean;
  skuManuallyEdited: boolean;
  subcategoryOverride: string | null;
  detailTypeOverride: string | null;
};

type ClassifyPreview = {
  family: string;
  type: string;
  subcategoryDisplay: string;
  subcategory: string | null;
  detailType: string | null;
};

type DraftFamily = {
  name: string;
  imageUrl: string;
  showImageInput: boolean;
  confirmed: boolean;
};

// ── Size parser / sorter ──────────────────────────────────────────────────────
function parseSizeToNumber(size: string | null | undefined): number {
  if (!size) return Infinity;
  const s = size.trim();

  // compound fraction: 1-1/4, 1-1/2 (handles dashes and spaces)
  const compound = s.match(/^(\d+)[-\s]+(\d+)\s*\/\s*(\d+)/);
  if (compound) return +compound[1] + +compound[2] / +compound[3];

  // simple fraction: 1/2, 3/4
  const frac = s.match(/^(\d+)\s*\/\s*(\d+)/);
  if (frac) return +frac[1] / +frac[2];

  // #10 or #12 style
  const hash = s.match(/^#\s*(\d+)/);
  if (hash) return +hash[1];

  // leading number (strips units like ", ft, mm…)
  const num = s.match(/^(\d+\.?\d*)/);
  if (num) return parseFloat(num[1]);

  return Infinity; // fallback: sort alphabetically at end
}

function sortItems(items: CategoryGroupedItem[], dir: "asc" | "desc"): CategoryGroupedItem[] {
  return [...items].sort((a, b) => {
    const an = parseSizeToNumber(a.sizeLabel);
    const bn = parseSizeToNumber(b.sizeLabel);
    const mul = dir === "desc" ? -1 : 1;
    if (an === Infinity && bn === Infinity) {
      return mul * (a.sizeLabel || "").localeCompare(b.sizeLabel || "");
    }
    if (an === Infinity) return 1;
    if (bn === Infinity) return -1;
    return mul * (an - bn);
  });
}

// ── SKU auto-generation ───────────────────────────────────────────────────────

// Inch-size → 3–4 digit code mapping (thousandths-of-inch representation)
const INCH_SIZE_CODES: Record<string, string> = {
  "1/2": "050",   "3/4": "075",   "1": "100",
  "1-1/4": "125", "1 1/4": "125",
  "1-1/2": "150", "1 1/2": "150",
  "2": "200",
  "2-1/2": "250", "2 1/2": "250",
  "3": "300",
  "3-1/2": "350", "3 1/2": "350",
  "4": "400",     "5": "500",     "6": "600",
  "1-5/8": "1625","1 5/8": "1625",
};

function parseSizeToCode(size: string): string {
  // Strip inch marks and surrounding whitespace
  const s = size.trim().replace(/["""'']/g, "").trim();

  // Exact match in inch-size table (try original and lowercase)
  if (INCH_SIZE_CODES[s])           return INCH_SIZE_CODES[s];
  if (INCH_SIZE_CODES[s.toLowerCase()]) return INCH_SIZE_CODES[s.toLowerCase()];

  // #10, #12 AWG → "10", "12"
  const hash = s.match(/^#\s*(\d+)/);
  if (hash) return hash[1];

  // 12/2C, 14/3G cable → "122C", "143G"
  const cable = s.match(/^(\d+)\/(\d+)([A-Za-z]*)/);
  if (cable) return `${cable[1]}${cable[2]}${cable[3].toUpperCase()}`;

  // 18 x 12, 18" x 12" → "18X12"
  const dims = s.match(/^(\d+)\s*[xX×]\s*(\d+)/);
  if (dims) return `${dims[1]}X${dims[2]}`;

  // Fallback: strip special chars, uppercase, max 6 chars
  return s.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6);
}

/**
 * Extracts the family SKU prefix from existing items in that family.
 * Strategy: take the first item's SKU and strip the trailing size-code segment.
 * Falls back to generating initials from the family name.
 */
function getFamilyPrefix(familyName: string, existingItems: CategoryGroupedItem[]): string {
  for (const item of existingItems) {
    const parts = item.sku.split("-");
    if (parts.length >= 2) {
      const last = parts[parts.length - 1];
      // If last segment is a pure number suffix (-2, -3) skip it and take one more off
      if (/^\d$/.test(last) && parts.length >= 3) {
        return parts.slice(0, parts.length - 2).join("-");
      }
      return parts.slice(0, parts.length - 1).join("-");
    }
  }
  // Derive from family name: first 1–2 letters of each significant word
  const words = familyName.trim().split(/\s+/).filter(w => w.length > 2);
  if (!words.length) return familyName.slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return words.slice(0, 3).map(w => w.slice(0, 2).toUpperCase()).join("").slice(0, 6);
}

function generateAutoSku(
  familyName: string,
  existingItems: CategoryGroupedItem[],
  sizeLabel: string,
  allSkus: Set<string>,
): string {
  if (!sizeLabel.trim()) return "";
  const prefix = getFamilyPrefix(familyName, existingItems);
  const sizeCode = parseSizeToCode(sizeLabel);
  if (!prefix || !sizeCode) return "";
  const base = `${prefix}-${sizeCode}`;
  if (!allSkus.has(base)) return base;
  for (let i = 2; i <= 99; i++) {
    const candidate = `${base}-${i}`;
    if (!allSkus.has(candidate)) return candidate;
  }
  return base;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const CATEGORY_FALLBACK_COLORS: Record<string, string> = {
  "CT": "from-sky-600 to-sky-800",
  "CF": "from-slate-600 to-slate-800",
  "CS": "from-zinc-600 to-zinc-800",
  "CW": "from-orange-600 to-orange-800",
  "DV": "from-violet-600 to-violet-800",
  "FH": "from-stone-600 to-stone-800",
  "BC": "from-brand-600 to-brand-800",
  "DP": "from-indigo-600 to-indigo-800",
  "GT": "from-teal-600 to-teal-800",
};

const UOM_OPTIONS = ["EA", "FT", "LF", "PR", "PKG", "BOX", "CTN", "LB", "ROLL"];

function StatusBadge({ status }: { status: string }) {
  if (status === "out_of_stock") return <Badge className="bg-red-50 text-red-700 border-red-200 border font-medium whitespace-nowrap">Out of Stock</Badge>;
  if (status === "low_stock") return <Badge className="bg-amber-50 text-amber-700 border-amber-200 border font-medium whitespace-nowrap">Low Stock</Badge>;
  return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 border font-medium whitespace-nowrap">In Stock</Badge>;
}

// ── LocationCombobox ──────────────────────────────────────────────────────────
function LocationCombobox({ value, onChange, locations }: {
  value: number | null;
  onChange: (id: number | null) => void;
  locations: any[];
}) {
  const { toast } = useToast();
  const createLocation = useCreateLocation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = locations.find(l => l.id === value);
  const filtered = search.trim() ? locations.filter(l => l.name.toLowerCase().includes(search.toLowerCase())) : locations;
  const showCreate = search.trim().length > 0 && !locations.some(l => l.name.trim().toLowerCase() === search.trim().toLowerCase());

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 40); }, [open]);

  async function handleCreate() {
    try {
      const loc = await createLocation.mutateAsync(search.trim());
      onChange(loc.id); setSearch(""); setOpen(false);
      toast({ title: "Location created", description: `"${loc.name}" added.` });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  }

  return (
    <div ref={ref} className="relative min-w-[120px]">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between text-xs border border-slate-300 rounded px-2 py-1.5 bg-white hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-brand-500 text-left min-h-[30px]"
        data-testid="inline-location-trigger">
        <span className={selected ? "text-slate-900 truncate" : "text-slate-400"}>{selected ? selected.name : "Select…"}</span>
        <ChevronDown className="w-3 h-3 text-slate-400 shrink-0 ml-1" />
      </button>
      {open && (
        <div className="absolute z-50 mt-0.5 w-52 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
          <div className="p-1.5 border-b border-slate-100 flex items-center gap-1.5 bg-slate-50">
            <Search className="w-3 h-3 text-slate-400 shrink-0" />
            <input ref={inputRef} type="text" placeholder="Filter or create…" value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 text-xs outline-none bg-transparent text-slate-900 placeholder:text-slate-400" />
          </div>
          <div className="max-h-40 overflow-y-auto">
            {value != null && (
              <button type="button" onClick={() => { onChange(null); setSearch(""); setOpen(false); }}
                className="w-full text-left px-2.5 py-1.5 text-xs text-slate-400 hover:bg-slate-50 italic border-b border-slate-100">Clear</button>
            )}
            {filtered.map(l => (
              <button key={l.id} type="button" onClick={() => { onChange(l.id); setSearch(""); setOpen(false); }}
                className={`w-full text-left px-2.5 py-1.5 text-xs hover:bg-brand-50 ${l.id === value ? "bg-brand-50 font-medium" : "text-slate-800"}`}>
                {l.name}
              </button>
            ))}
            {filtered.length === 0 && !showCreate && <p className="text-center text-xs text-slate-400 py-2">No locations</p>}
            {showCreate && (
              <button type="button" onClick={handleCreate} disabled={createLocation.isPending}
                className="w-full text-left px-2.5 py-1.5 text-xs text-brand-700 font-medium flex items-center gap-1 hover:bg-brand-50 border-t border-slate-100">
                <Plus className="w-3 h-3" />{createLocation.isPending ? "Creating…" : `Create "${search.trim()}"`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── InlineEditRow (editing existing items in Edit Mode) ───────────────────────
function InlineEditRow({ item, draft, locations, onChange, onDelete }: {
  item: CategoryGroupedItem;
  draft: EditDraft;
  locations: any[];
  onChange: (patch: Partial<EditDraft>) => void;
  onDelete: () => void;
}) {
  const [showImageInput, setShowImageInput] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputCls = "w-full text-xs bg-white border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-400";

  if (draft._deleted) return null;

  return (
    <TableRow className="bg-amber-50/30 border-b border-amber-100" data-testid={`row-edit-item-${item.id}`}>
      <TableCell className="font-mono text-xs text-slate-400 py-2 pl-5 whitespace-nowrap">{item.sku}</TableCell>
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
      </TableCell>
      <TableCell className="py-2 text-right">
        <input type="number" min="0" value={draft.quantityOnHand} onChange={e => onChange({ quantityOnHand: Number(e.target.value) })}
          className="w-16 text-xs text-right bg-white border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-400" data-testid={`input-edit-qty-${item.id}`} />
      </TableCell>
      <TableCell className="py-2">
        <select value={draft.unitOfMeasure} onChange={e => onChange({ unitOfMeasure: e.target.value })}
          className="text-xs bg-white border border-slate-300 rounded px-1.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500" data-testid={`select-edit-unit-${item.id}`}>
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

// ── InlineNewRow (adding new items inside Edit Mode) ─────────────────────────
function InlineNewRow({ draft, familyName, categoryId, categoryCode, existingItems, existingSkus, locations, onChange, onRemove }: {
  draft: NewRowDraft;
  familyName: string;
  categoryId?: number;
  categoryCode?: string | null;
  existingItems: CategoryGroupedItem[];
  existingSkus: Set<string>;
  locations: any[];
  onChange: (patch: Partial<NewRowDraft>) => void;
  onRemove: () => void;
}) {
  const [preview, setPreview] = useState<ClassifyPreview | null>(null);
  const [showOverride, setShowOverride] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const inputCls = (err?: string) =>
    `w-full text-xs bg-white border ${err ? "border-red-400 ring-1 ring-red-300" : "border-slate-300"} rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-400`;

  // Fetch classification preview when name / size changes
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
        {/* Classification preview */}
        {hasPreview && (
          <div className="mt-1 space-y-0.5">
            <div className="flex items-center gap-1 flex-wrap" data-testid={`classify-preview-${draft.tmpId}`}>
              {preview.family && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-brand-700 bg-brand-50 border border-brand-200 rounded px-1.5 py-0.5">
                  {preview.family}
                </span>
              )}
              {preview.type && preview.type !== preview.family && (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-600 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">
                  {preview.type}
                </span>
              )}
              {preview.subcategoryDisplay && (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-500 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">
                  {preview.subcategoryDisplay}
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
      </TableCell>
      <TableCell className="py-2 align-top text-right">
        <input type="number" min="0" value={draft.quantityOnHand}
          onChange={e => onChange({ quantityOnHand: Number(e.target.value) })}
          className="w-16 text-xs text-right bg-white border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500" data-testid={`input-new-qty-${draft.tmpId}`} />
      </TableCell>
      <TableCell className="py-2 align-top">
        <select value={draft.unitOfMeasure} onChange={e => onChange({ unitOfMeasure: e.target.value })}
          className="text-xs bg-white border border-slate-300 rounded px-1.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500" data-testid={`select-new-unit-${draft.tmpId}`}>
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

// Shared column layout for the Family Settings item table.
// Single source of truth — change here and it applies to every category's dialog.
// Columns: checkbox | SKU | Name (editable) | Family (editable) | Type (editable) | Subcategory (editable) | Status
const FAMILY_TABLE_COLS = "1.2rem 4.5rem 2fr 1fr 1fr 1fr 6.5rem";

// ── FamilyEditDialog (family-level settings) ──────────────────────────────────
function FamilyEditDialog({ open, onClose, categoryId, group, allFamilies }: {
  open: boolean;
  onClose: () => void;
  categoryId: number;
  group: CategoryItemGroup;
  allFamilies: string[];
}) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: classOptions } = useQuery<{ subcategories: string[]; detailTypes: string[]; subTypes: string[] }>({
    queryKey: ["/api/inventory/category", String(categoryId), "classification-options"],
    enabled: open,
  });

  const [familyName, setFamilyName] = useState(group.baseItemName);
  const [imageUrl, setImageUrl] = useState(group.representativeImage ?? "");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [moveTarget, setMoveTarget] = useState("");
  const [showMoveInput, setShowMoveInput] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [itemDrafts, setItemDrafts] = useState<Record<number, ItemClassDraft>>({});

  useEffect(() => {
    if (open) {
      setFamilyName(group.baseItemName);
      setImageUrl(group.representativeImage ?? "");
      setSelectedIds(new Set());
      setShowMoveInput(false);
      setConfirmDelete(false);
      const drafts: Record<number, ItemClassDraft> = {};
      for (const item of group.items) {
        drafts[item.id] = {
          name: item.name,
          subcategory: item.subcategory ?? "",
          detailType: item.detailType ?? "",
          subType: (item as any).subType ?? "",
        };
      }
      setItemDrafts(drafts);
    }
  }, [open, group.baseItemName, group.items]);

  // When subcategory (Family) or detailType (Type) changes for one item, sync the
  // same value to every other item in this group that currently shares the same
  // original value.  This keeps all related items in the same filter bucket in
  // Field Mode so no item is left stranded under the old family/type after a save.
  const patchDraft = (id: number, patch: Partial<ItemClassDraft>) => {
    setItemDrafts(prev => {
      const next = { ...prev };
      next[id] = { ...next[id], ...patch };

      if ('subcategory' in patch || 'detailType' in patch) {
        // Find the original value for the changed field on the item being edited
        const targetItem = group.items.find(i => i.id === id);
        if (targetItem) {
          const origSub = targetItem.subcategory ?? "";
          const origDt  = targetItem.detailType ?? "";

          // Propagate to sibling items that share the same original classification
          for (const sibling of group.items) {
            if (sibling.id === id) continue;
            const sibSub = sibling.subcategory ?? "";
            const sibDt  = sibling.detailType  ?? "";
            if ('subcategory' in patch && sibSub === origSub) {
              next[sibling.id] = { ...next[sibling.id], subcategory: patch.subcategory! };
            }
            if ('detailType' in patch && sibDt === origDt) {
              next[sibling.id] = { ...next[sibling.id], detailType: patch.detailType! };
            }
          }
        }
      }

      return next;
    });
  };

  // Invalidate all queries that depend on item classification so every view
  // (Field Mode item list, filters, sizes) reflects the saved changes immediately.
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["/api/inventory/category", String(categoryId), "grouped"] });
    qc.invalidateQueries({ queryKey: ["/api/inventory/categories/summary"] });
    qc.invalidateQueries({ queryKey: ["/api/inventory"] });
    qc.invalidateQueries({ queryKey: ["/api/field/families"] });
    qc.invalidateQueries({ queryKey: ["/api/field/types"] });
    qc.invalidateQueries({ queryKey: ["/api/field/subcategories"] });
    qc.invalidateQueries({ queryKey: ["/api/field/items"] });
    qc.invalidateQueries({ queryKey: ["/api/field/sizes"] });
  };

  const saveMeta = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", `/api/inventory/category/${categoryId}/item-groups`, {
        baseItemName: group.baseItemName, imageUrl: imageUrl || null,
        newName: familyName !== group.baseItemName ? familyName : undefined,
      });
      // Save every item whose draft differs from the DB value.  Because patchDraft
      // already propagated subcategory/detailType changes to siblings, the full
      // group ends up consistent after one save — no item is left behind.
      const changedItems = group.items.filter(item => {
        const d = itemDrafts[item.id];
        if (!d) return false;
        return d.name !== item.name ||
          d.subcategory !== (item.subcategory ?? "") ||
          d.detailType !== (item.detailType ?? "") ||
          d.subType !== ((item as any).subType ?? "");
      });
      if (changedItems.length > 0) {
        await Promise.all(changedItems.map(item => {
          const d = itemDrafts[item.id];
          return apiRequest("PUT", `/api/items/${item.id}`, {
            name: d.name,
            subcategory: d.subcategory || null,
            detailType: d.detailType || null,
            subType: d.subType || null,
          }).then(r => r.json());
        }));
      }
      await qc.refetchQueries({ queryKey: ["/api/inventory/category", String(categoryId), "grouped"] });
    },
    onSuccess: () => {
      toast({ title: "Settings saved" });
      qc.invalidateQueries({ queryKey: ["/api/inventory/categories/summary"] });
      qc.invalidateQueries({ queryKey: ["/api/inventory"] });
      qc.invalidateQueries({ queryKey: ["/api/field/families"] });
      qc.invalidateQueries({ queryKey: ["/api/field/types"] });
      qc.invalidateQueries({ queryKey: ["/api/field/subcategories"] });
      qc.invalidateQueries({ queryKey: ["/api/field/items"] });
      qc.invalidateQueries({ queryKey: ["/api/field/sizes"] });
      onClose();
    },
    onError: (err: any) => toast({ title: "Failed to save", description: err.message, variant: "destructive" }),
  });

  const moveItems = useMutation({
    mutationFn: () => apiRequest("POST", `/api/inventory/items/move-family`, { itemIds: [...selectedIds], newBaseItemName: moveTarget.trim() }),
    onSuccess: () => {
      toast({ title: `${selectedIds.size} item(s) moved to "${moveTarget}"` });
      invalidate(); setSelectedIds(new Set()); setShowMoveInput(false); setMoveTarget(""); onClose();
    },
    onError: (err: any) => toast({ title: "Move failed", description: err.message, variant: "destructive" }),
  });

  const deleteItems = useMutation({
    mutationFn: () => apiRequest("POST", `/api/inventory/items/bulk-delete`, { itemIds: [...selectedIds] }),
    onSuccess: () => {
      toast({ title: `${selectedIds.size} item(s) removed` });
      invalidate(); setSelectedIds(new Set()); setConfirmDelete(false); onClose();
    },
    onError: (err: any) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
  });

  const toggleItem = (id: number) => setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = () => { if (selectedIds.size === group.items.length) setSelectedIds(new Set()); else setSelectedIds(new Set(group.items.map(i => i.id))); };
  const otherFamilies = allFamilies.filter(f => f !== group.baseItemName);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[860px] w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Family Settings — {group.baseItemName}</DialogTitle></DialogHeader>
        <div className="space-y-5 pt-1">

          {/* Family meta */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Family Name</label>
              <Input value={familyName} onChange={e => setFamilyName(e.target.value)} placeholder="e.g. EMT Conduit" data-testid="input-family-name" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Representative Image URL</label>
              <Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://…" data-testid="input-family-image-url" />
            </div>
          </div>
          {imageUrl && (
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg p-2">
              <img src={imageUrl} alt="preview" className="w-14 h-14 object-cover rounded-md border border-slate-200" onError={e => { e.currentTarget.style.opacity = "0.3"; }} />
              <span className="text-xs text-slate-500">Image preview</span>
            </div>
          )}

          {/* Item classification table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            {/* Table header */}
            <div className="grid gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200"
              style={{ gridTemplateColumns: FAMILY_TABLE_COLS }}>
              <div className="flex items-center justify-center">
                <input type="checkbox" checked={selectedIds.size === group.items.length && group.items.length > 0}
                  onChange={toggleAll} className="rounded border-slate-300" data-testid="checkbox-select-all" />
              </div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide self-center text-center">SKU</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide self-center text-center">Name</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide self-center text-center">Family</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide self-center text-center">Type</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide self-center text-center">Subcategory</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide self-center text-center">Status</span>
            </div>

            {/* Item rows */}
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
              {group.items.map(item => {
                const d = itemDrafts[item.id] ?? { name: item.name, subcategory: item.subcategory ?? "", detailType: item.detailType ?? "", subType: (item as any).subType ?? "" };
                const isChanged = d.name !== item.name || d.subcategory !== (item.subcategory ?? "") || d.detailType !== (item.detailType ?? "") || d.subType !== ((item as any).subType ?? "");
                return (
                  <div key={item.id}
                    className={`grid gap-2 px-3 py-2 items-center hover:bg-slate-50 ${selectedIds.has(item.id) ? "bg-brand-50/30" : ""} ${isChanged ? "bg-amber-50/50" : ""}`}
                    style={{ gridTemplateColumns: FAMILY_TABLE_COLS }}
                    data-testid={`row-family-item-${item.id}`}>
                    <div className="flex items-center justify-center">
                      <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleItem(item.id)}
                        className="rounded border-slate-300" onClick={e => e.stopPropagation()} />
                    </div>
                    <span className="text-xs text-slate-500 font-mono truncate text-center" title={item.sku}>{item.sku}</span>
                    <input
                      className="min-w-0 text-xs border border-slate-200 rounded px-1.5 py-1 w-full focus:outline-none focus:border-brand-400 bg-white"
                      value={d.name}
                      onChange={e => patchDraft(item.id, { name: e.target.value })}
                      data-testid={`input-item-name-${item.id}`}
                    />
                    <input
                      className="min-w-0 text-xs border border-slate-200 rounded px-1.5 py-1 w-full focus:outline-none focus:border-brand-400 bg-white"
                      value={d.subcategory}
                      onChange={e => patchDraft(item.id, { subcategory: e.target.value })}
                      placeholder="e.g. EMT Conduit"
                      list={`dl-subcategory-${categoryId}`}
                      data-testid={`input-item-family-${item.id}`}
                    />
                    <input
                      className="min-w-0 text-xs border border-slate-200 rounded px-1.5 py-1 w-full focus:outline-none focus:border-brand-400 bg-white"
                      value={d.detailType}
                      onChange={e => patchDraft(item.id, { detailType: e.target.value })}
                      placeholder="e.g. Connector"
                      list={`dl-detailtype-${categoryId}`}
                      data-testid={`input-item-type-${item.id}`}
                    />
                    <input
                      className="min-w-0 text-xs border border-slate-200 rounded px-1.5 py-1 w-full focus:outline-none focus:border-brand-400 bg-white"
                      value={d.subType}
                      onChange={e => patchDraft(item.id, { subType: e.target.value })}
                      placeholder="e.g. Set Screw"
                      list={`dl-subtype-${categoryId}`}
                      data-testid={`input-item-subtype-${item.id}`}
                    />
                    <div className="flex justify-center">
                      <StatusBadge status={item.status} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected count footer */}
            {selectedIds.size > 0 && (
              <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 flex items-center gap-2">
                <span className="text-xs text-brand-600 font-medium">{selectedIds.size} selected</span>
              </div>
            )}
          </div>

          {/* Datalists for Family, Type, and Subcategory autocomplete — declared once, shared by all row inputs */}
          <datalist id={`dl-subcategory-${categoryId}`}>
            {classOptions?.subcategories.map(s => <option key={s} value={s}>{s}</option>)}
          </datalist>
          <datalist id={`dl-detailtype-${categoryId}`}>
            {classOptions?.detailTypes.map(s => <option key={s} value={s}>{s}</option>)}
          </datalist>
          <datalist id={`dl-subtype-${categoryId}`}>
            {classOptions?.subTypes.map(s => <option key={s} value={s}>{s}</option>)}
          </datalist>

          {/* Bulk actions */}
          {selectedIds.size > 0 && (
            <div className="border border-slate-200 rounded-xl p-3 space-y-3 bg-slate-50/60">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions for {selectedIds.size} selected item{selectedIds.size !== 1 ? "s" : ""}</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" className="text-brand-600 border-brand-200 hover:bg-brand-50" onClick={() => { setShowMoveInput(!showMoveInput); setConfirmDelete(false); }} data-testid="button-move-items">
                  <MoveRight className="w-3.5 h-3.5 mr-1.5" />Move to family…
                </Button>
                <Button type="button" size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => { setConfirmDelete(!confirmDelete); setShowMoveInput(false); }} data-testid="button-delete-items">
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />Remove selected
                </Button>
              </div>
              {showMoveInput && (
                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1">
                    <label className="text-xs text-slate-600 font-medium">Target family name</label>
                    <Input value={moveTarget} onChange={e => setMoveTarget(e.target.value)} placeholder="Existing or new family name…" list="move-target-suggestions" data-testid="input-move-target" />
                    <datalist id="move-target-suggestions">{otherFamilies.map(f => <option key={f} value={f} />)}</datalist>
                  </div>
                  <Button type="button" size="sm" className="bg-brand-700 hover:bg-brand-800" onClick={() => moveItems.mutate()} disabled={!moveTarget.trim() || moveItems.isPending} data-testid="button-confirm-move">
                    {moveItems.isPending ? "Moving…" : "Move"}
                  </Button>
                </div>
              )}
              {confirmDelete && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-2.5">
                  <span className="text-sm text-red-700 flex-1">Remove {selectedIds.size} item(s) from inventory permanently?</span>
                  <Button type="button" size="sm" variant="destructive" onClick={() => deleteItems.mutate()} disabled={deleteItems.isPending} data-testid="button-confirm-delete">
                    {deleteItems.isPending ? "Removing…" : "Confirm"}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-1 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={onClose} disabled={saveMeta.isPending}>Cancel</Button>
            <Button type="button" className="bg-brand-700 hover:bg-brand-800" onClick={() => saveMeta.mutate()} disabled={saveMeta.isPending || !familyName.trim()} data-testid="button-save-family">
              {saveMeta.isPending ? "Saving…" : "Save Settings"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CategoryDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: locations } = useLocations();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [familyFilter, setFamilyFilter] = useState("all");
  const [editingGroup, setEditingGroup] = useState<CategoryItemGroup | null>(null);
  const [draftFamily, setDraftFamily] = useState<DraftFamily | null>(null);

  // Per-family size sort direction (default: asc = small → large)
  const [familySortDir, setFamilySortDir] = useState<Record<string, "asc" | "desc">>({});

  // Inline edit state
  const [inlineEditFamily, setInlineEditFamily] = useState<string | null>(null);
  const [editDrafts, setEditDrafts] = useState<Record<number, EditDraft>>({});
  const [editNewRows, setEditNewRows] = useState<NewRowDraft[]>([]);
  const [savingInline, setSavingInline] = useState(false);

  const { data, isLoading, isError } = useQuery<CategoryGroupedDetail>({
    queryKey: ["/api/inventory/category", id, "grouped"],
    queryFn: () => fetch(`/api/inventory/category/${id}/grouped`).then(r => r.json()),
    enabled: !!id,
  });

  useEffect(() => {
    if (draftFamily?.confirmed && data) {
      const exists = data.groups.some(g => g.baseItemName === draftFamily.name);
      if (exists) setDraftFamily(null);
    }
  }, [data, draftFamily]);

  const allSkus = useMemo(() => {
    if (!data) return new Set<string>();
    const s = new Set<string>();
    data.groups.forEach(g => g.items.forEach(i => s.add(i.sku.toUpperCase())));
    return s;
  }, [data]);

  const filteredGroups = useMemo(() => {
    if (!data) return [];
    const tokens = search.trim().toLowerCase().split(/\s+/).filter(t => t.length > 0);
    return data.groups
      .filter(g => familyFilter === "all" || g.baseItemName === familyFilter)
      .map(g => ({
        ...g,
        items: g.items.filter(item => {
          const matchesStatus = statusFilter === "all" || item.status === statusFilter;
          if (!matchesStatus) return false;
          if (tokens.length === 0) return true;
          const haystack = [item.sku, item.name, item.sizeLabel || "", g.baseItemName, item.location?.name || ""].join(" ").toLowerCase();
          return tokens.every(t => haystack.includes(t));
        }),
      }))
      .filter(g => g.items.length > 0 || inlineEditFamily === g.baseItemName);
  }, [data, search, statusFilter, familyFilter, inlineEditFamily]);

  const displayGroups = useMemo(() => {
    if (!draftFamily?.confirmed) return filteredGroups;
    const draftInReal = filteredGroups.some(g => g.baseItemName === draftFamily.name);
    if (draftInReal) return filteredGroups;
    return [
      { baseItemName: draftFamily.name, items: [], representativeImage: draftFamily.imageUrl || null, customImageUrl: null },
      ...filteredGroups,
    ];
  }, [filteredGroups, draftFamily]);

  const handleConfirmDraftFamily = useCallback(() => {
    if (!draftFamily?.name.trim()) return;
    const trimmed = draftFamily.name.trim();
    if (data?.groups.some(g => g.baseItemName === trimmed)) {
      toast({ title: "Family already exists", description: `"${trimmed}" already exists. Click Edit in that family to add items.`, variant: "destructive" });
      return;
    }
    setDraftFamily(prev => prev ? { ...prev, name: trimmed, confirmed: true } : null);
  }, [draftFamily, data, toast]);

  const handleSaveDraftFamilyImage = useCallback(async (familyName: string, imageUrl: string) => {
    if (!imageUrl || !id) return;
    try {
      await apiRequest("PUT", `/api/inventory/category/${id}/item-groups`, { baseItemName: familyName, imageUrl });
      qc.invalidateQueries({ queryKey: ["/api/inventory/category", id, "grouped"] });
    } catch (_) {}
  }, [id, qc]);

  // ── Inline Edit handlers ──────────────────────────────────────────────────
  const enterInlineEdit = useCallback((group: CategoryItemGroup) => {
    const drafts: Record<number, EditDraft> = {};
    group.items.forEach(item => {
      const locId = (item as any).primaryLocationId
        ? (item as any).primaryLocationId
        : locations?.find((l: any) => l.name === item.location?.name)?.id ?? null;
      drafts[item.id] = {
        sizeLabel: item.sizeLabel ?? "",
        name: item.name,
        quantityOnHand: item.quantityOnHand,
        unitOfMeasure: item.unitOfMeasure,
        primaryLocationId: locId,
        imageUrl: item.imageUrl ?? null,
      };
    });
    setEditDrafts(drafts);
    setEditNewRows([]);
    setInlineEditFamily(group.baseItemName);
  }, [locations]);

  const cancelInlineEdit = useCallback(() => {
    setInlineEditFamily(null);
    setEditDrafts({});
    setEditNewRows([]);
  }, []);

  const updateDraft = useCallback((itemId: number, patch: Partial<EditDraft>) => {
    setEditDrafts(prev => ({ ...prev, [itemId]: { ...prev[itemId], ...patch } }));
  }, []);

  const deleteRow = useCallback((itemId: number) => {
    setEditDrafts(prev => ({ ...prev, [itemId]: { ...prev[itemId], _deleted: true } }));
  }, []);

  const addNewRow = useCallback(() => {
    setEditNewRows(prev => [...prev, {
      tmpId: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sku: "", sizeLabel: "", name: "", quantityOnHand: 0,
      unitOfMeasure: "EA", primaryLocationId: null, imageUrl: null,
      skuError: "", nameManuallyEdited: false, skuManuallyEdited: false,
      subcategoryOverride: null, detailTypeOverride: null,
    }]);
  }, []);

  const updateNewRow = useCallback((tmpId: string, patch: Partial<NewRowDraft>) => {
    setEditNewRows(prev => prev.map(r => r.tmpId === tmpId ? { ...r, ...patch } : r));
  }, []);

  const removeNewRow = useCallback((tmpId: string) => {
    setEditNewRows(prev => prev.filter(r => r.tmpId !== tmpId));
  }, []);

  const saveInlineEdits = useCallback(async (group: CategoryItemGroup) => {
    // Collect all active SKUs for duplicate check
    const allCurrentSkus = new Set(allSkus);

    // Validate existing item edits
    const activeItems = group.items.filter(item => !editDrafts[item.id]?._deleted);
    for (const item of activeItems) {
      const d = editDrafts[item.id];
      if (!d) continue;
      if (!d.name.trim()) { toast({ title: "Validation error", description: `Item name required for ${item.sku}`, variant: "destructive" }); return; }
      if (d.quantityOnHand < 0) { toast({ title: "Validation error", description: `Qty must be ≥ 0 for ${item.sku}`, variant: "destructive" }); return; }
    }

    // Validate new rows
    const newSkusSeen = new Set<string>();
    for (const row of editNewRows) {
      const sku = row.sku.trim().toUpperCase();
      if (!sku) { toast({ title: "Validation error", description: "SKU is required for all new items", variant: "destructive" }); return; }
      if (!row.name.trim()) { toast({ title: "Validation error", description: `Item name required for ${sku}`, variant: "destructive" }); return; }
      if (!row.sizeLabel.trim()) { toast({ title: "Validation error", description: `Size required for ${sku}`, variant: "destructive" }); return; }
      if (allCurrentSkus.has(sku) || newSkusSeen.has(sku)) { toast({ title: "Duplicate SKU", description: `${sku} already exists`, variant: "destructive" }); return; }
      newSkusSeen.add(sku);
    }

    setSavingInline(true);
    try {
      const promises: Promise<any>[] = [];

      // Update / delete existing items
      for (const item of group.items) {
        const d = editDrafts[item.id];
        if (!d) continue;
        if (d._deleted) {
          promises.push(fetch(`/api/items/${item.id}`, { method: "DELETE", credentials: "include" }));
          continue;
        }
        const changed = d.name !== item.name || d.sizeLabel !== (item.sizeLabel ?? "") ||
          d.quantityOnHand !== item.quantityOnHand || d.unitOfMeasure !== item.unitOfMeasure ||
          d.primaryLocationId !== ((item as any).primaryLocationId ?? null);
        if (changed) {
          promises.push(fetch(`/api/items/${item.id}`, {
            method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
            body: JSON.stringify({ name: d.name.trim(), sizeLabel: d.sizeLabel || null, quantityOnHand: d.quantityOnHand, unitOfMeasure: d.unitOfMeasure, primaryLocationId: d.primaryLocationId || null }),
          }));
        }
        if (d.imageUrl !== (item.imageUrl ?? null)) {
          promises.push(fetch(`/api/inventory/${item.id}/image`, {
            method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
            body: JSON.stringify({ imageUrl: d.imageUrl }),
          }));
        }
      }

      // Create new rows
      for (const row of editNewRows) {
        promises.push(fetch("/api/items", {
          method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
          body: JSON.stringify({
            sku: row.sku.trim().toUpperCase(),
            name: row.name.trim(),
            baseItemName: group.baseItemName,
            sizeLabel: row.sizeLabel.trim() || null,
            categoryId: data?.category.id,
            unitOfMeasure: row.unitOfMeasure,
            quantityOnHand: row.quantityOnHand,
            primaryLocationId: row.primaryLocationId || null,
            subcategory: row.subcategoryOverride || null,
            detailType: row.detailTypeOverride || null,
            reorderPoint: 0, reorderQuantity: 0, minimumStock: 0, unitCost: "0.00",
          }),
        }));
      }

      await Promise.all(promises);
      await qc.invalidateQueries({ queryKey: ["/api/inventory/category", id, "grouped"] });
      await qc.invalidateQueries({ queryKey: ["/api/inventory/categories/summary"] });
      await qc.invalidateQueries({ queryKey: ["/api/inventory"] });

      // Save draft family image if applicable
      const isDraftConfirmed = draftFamily?.confirmed && draftFamily.name === group.baseItemName;
      if (isDraftConfirmed && draftFamily?.imageUrl) {
        await handleSaveDraftFamilyImage(group.baseItemName, draftFamily.imageUrl);
      }

      const deletedCount = group.items.filter(i => editDrafts[i.id]?._deleted).length;
      const updatedCount = group.items.length - deletedCount;
      const createdCount = editNewRows.length;
      toast({
        title: "Changes saved",
        description: [
          updatedCount > 0 && `${updatedCount} updated`,
          createdCount > 0 && `${createdCount} added`,
          deletedCount > 0 && `${deletedCount} removed`,
        ].filter(Boolean).join(", ") + ".",
      });

      setInlineEditFamily(null);
      setEditDrafts({});
      setEditNewRows([]);
    } catch (err: any) {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    } finally {
      setSavingInline(false);
    }
  }, [editDrafts, editNewRows, allSkus, id, qc, toast, data, draftFamily, handleSaveDraftFamilyImage]);

  // ── Toggle size sort for a family ─────────────────────────────────────────
  const toggleFamilySort = useCallback((familyName: string) => {
    setFamilySortDir(prev => ({ ...prev, [familyName]: prev[familyName] === "desc" ? "asc" : "desc" }));
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
        <div className="h-12 bg-slate-100 rounded-xl animate-pulse" />
        <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-40 bg-slate-100 rounded-xl animate-pulse" />)}</div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="text-center py-20 text-slate-500">
        <XCircle className="w-12 h-12 mx-auto mb-3 text-red-300" />
        <p className="text-lg font-medium text-slate-900">Category not found</p>
        <Link href="/inventory"><Button variant="outline" className="mt-4">← Back to Inventory</Button></Link>
      </div>
    );
  }

  const { category, skuCount, totalQuantity, lowStockCount, outOfStockCount, groups } = data;
  const gradientClass = CATEGORY_FALLBACK_COLORS[category.code || ""] || "from-slate-600 to-slate-800";
  const hasActiveFilters = search.trim() !== "" || statusFilter !== "all" || familyFilter !== "all";
  const existingFamilies = groups.map(g => g.baseItemName).filter(Boolean) as string[];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/inventory" className="hover:text-brand-600 transition-colors">Inventory</Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-slate-900 font-medium">{category.name}</span>
      </div>

      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden shadow-xl bg-[#16202e]" style={{ height: "210px" }}>
        {/* Blurred ambient fill */}
        {category.imageUrl && (
          <img src={category.imageUrl} aria-hidden className="absolute inset-0 w-full h-full object-cover scale-125 blur-2xl opacity-80 brightness-70 saturate-200 pointer-events-none" />
        )}
        {/* Primary sharp image */}
        {category.imageUrl ? (
          <img src={category.imageUrl} alt={category.name} className="absolute inset-0 w-full h-full object-contain object-center z-10"
            onError={(e) => { e.currentTarget.style.display = "none"; (e.currentTarget.previousElementSibling as HTMLElement)?.style.setProperty("display","none"); (e.currentTarget.nextElementSibling as HTMLElement)?.classList.remove("hidden"); }} />
        ) : null}
        <div className={`${category.imageUrl ? "hidden" : ""} absolute inset-0 bg-gradient-to-br ${gradientClass}`} />
        {/* Left vignette for text area contrast */}
        <div className="absolute inset-0 z-20 bg-gradient-to-r from-black/70 via-black/20 to-transparent pointer-events-none" />
        {/* Bottom gradient for legibility */}
        <div className="absolute inset-0 z-20 bg-gradient-to-t from-black/75 via-black/20 to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 z-30 p-6">
          <Link href="/inventory" className="inline-flex items-center gap-1.5 text-white/65 hover:text-white text-xs font-medium mb-2 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />Back to Inventory
          </Link>
          <h1 className="text-2xl font-display font-bold text-white" style={{ textShadow: "0 1px 6px rgba(0,0,0,0.6)" }}>{category.name}</h1>
          {category.description && <p className="text-white/65 text-sm mt-1 max-w-2xl leading-relaxed">{category.description}</p>}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: <Package className="w-4 h-4 text-brand-600" />, label: "SKUs", value: skuCount, cls: "text-slate-900", testid: "stat-sku-count" },
          { icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />, label: "Total Qty", value: totalQuantity.toLocaleString(), cls: "text-slate-900", testid: "stat-total-qty" },
          { icon: <AlertTriangle className="w-4 h-4 text-amber-500" />, label: "Low Stock", value: lowStockCount, cls: "text-amber-600", testid: "stat-low-stock" },
          { icon: <XCircle className="w-4 h-4 text-red-500" />, label: "Out of Stock", value: outOfStockCount, cls: "text-red-600", testid: "stat-out-of-stock" },
        ].map(card => (
          <div key={card.label} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">{card.icon}<span className="text-xs text-slate-500 font-medium uppercase tracking-wide">{card.label}</span></div>
            <p className={`text-2xl font-bold ${card.cls}`} data-testid={card.testid}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input placeholder="Search by SKU, name, size, or family…" className="pl-8 h-9 bg-slate-50 border-slate-200 text-sm focus:bg-white"
            value={search} onChange={e => setSearch(e.target.value)} data-testid="input-category-search" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-9 text-sm bg-slate-50 border-slate-200" data-testid="select-status-filter"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="in_stock">In Stock</SelectItem>
            <SelectItem value="low_stock">Low Stock</SelectItem>
            <SelectItem value="out_of_stock">Out of Stock</SelectItem>
          </SelectContent>
        </Select>
        <Select value={familyFilter} onValueChange={setFamilyFilter}>
          <SelectTrigger className="w-[200px] h-9 text-sm bg-slate-50 border-slate-200" data-testid="select-family-filter"><SelectValue placeholder="Family" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Families</SelectItem>
            {groups.map(g => <SelectItem key={g.baseItemName} value={g.baseItemName}>{g.baseItemName}</SelectItem>)}
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <button onClick={() => { setSearch(""); setStatusFilter("all"); setFamilyFilter("all"); }} className="text-xs text-slate-500 hover:text-brand-600 transition-colors whitespace-nowrap" data-testid="button-clear-filters">
            Clear filters
          </button>
        )}
        <span className="text-xs text-slate-400 whitespace-nowrap">
          {filteredGroups.reduce((n, g) => n + g.items.length, 0)} items{hasActiveFilters ? " matching" : ""}
        </span>
        <Button
          onClick={() => { if (!draftFamily) setDraftFamily({ name: "", imageUrl: "", showImageInput: false, confirmed: false }); }}
          className="ml-auto bg-brand-700 hover:bg-brand-800 text-white h-9 text-sm shrink-0"
          disabled={!!draftFamily && !draftFamily.confirmed}
          data-testid="button-new-family"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />New Family
        </Button>
      </div>

      {/* Draft family card (unconfirmed) */}
      {draftFamily && !draftFamily.confirmed && (
        <div className="bg-white border-2 border-brand-300 border-dashed rounded-xl overflow-hidden shadow-sm" data-testid="draft-family-card">
          <div className="flex items-start gap-3 px-5 py-4 bg-brand-50/30">
            <div className="w-11 h-11 rounded-lg overflow-hidden bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center shrink-0 mt-0.5">
              {draftFamily.imageUrl ? <img src={draftFamily.imageUrl} alt="" className="w-full h-full object-cover" onError={e => { e.currentTarget.style.opacity = "0.3"; }} /> : <Package className="w-5 h-5 text-slate-300" />}
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <input autoFocus value={draftFamily.name}
                onChange={e => setDraftFamily(prev => prev ? { ...prev, name: e.target.value } : null)}
                placeholder="Enter family name…"
                className="w-full font-semibold text-slate-900 bg-transparent border-b-2 border-brand-300 focus:border-brand-500 focus:outline-none py-0.5 text-sm placeholder-slate-400"
                data-testid="input-draft-family-name"
                onKeyDown={e => { if (e.key === "Enter") handleConfirmDraftFamily(); if (e.key === "Escape") setDraftFamily(null); }}
              />
              {!draftFamily.showImageInput ? (
                <button className="flex items-center gap-1 text-xs text-brand-500 hover:text-brand-700 transition-colors" onClick={() => setDraftFamily(prev => prev ? { ...prev, showImageInput: true } : null)} data-testid="button-add-image-link">
                  <ImageIcon className="w-3 h-3" />Add image link
                </button>
              ) : (
                <input autoFocus value={draftFamily.imageUrl} onChange={e => setDraftFamily(prev => prev ? { ...prev, imageUrl: e.target.value } : null)}
                  placeholder="https://… (image URL)" className="w-full text-xs bg-white border border-brand-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500" data-testid="input-draft-family-image" />
              )}
            </div>
            <div className="flex gap-2 shrink-0 mt-0.5">
              <Button size="sm" className="bg-brand-700 hover:bg-brand-800 text-white h-7 text-xs gap-1" onClick={handleConfirmDraftFamily} disabled={!draftFamily.name.trim()} data-testid="button-confirm-draft-family">
                <Check className="w-3 h-3" />Confirm
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-500 hover:text-slate-800" onClick={() => setDraftFamily(null)} data-testid="button-cancel-draft-family">
                <XIcon className="w-3 h-3 mr-1" />Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Family groups */}
      {displayGroups.length === 0 && !draftFamily ? (
        <div className="text-center py-16 text-slate-500 bg-white border border-slate-200 rounded-xl">
          <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          {hasActiveFilters ? (
            <><p className="text-base font-semibold text-slate-900">No items match your search</p><p className="text-sm mt-1">Try different keywords or clear the filters.</p></>
          ) : (
            <><p className="text-base font-semibold text-slate-900">No items in this category</p>
              <p className="text-sm mt-1"><button onClick={() => setDraftFamily({ name: "", imageUrl: "", showImageInput: false, confirmed: false })} className="text-brand-600 hover:underline">Create the first family</button></p></>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {displayGroups.map((group) => {
            const groupLowStock = group.items.filter(i => i.status === "low_stock").length;
            const groupOutOfStock = group.items.filter(i => i.status === "out_of_stock").length;
            const isDraftConfirmed = draftFamily?.confirmed && draftFamily.name === group.baseItemName;
            const isEditingThis = inlineEditFamily === group.baseItemName;
            const sortDir = familySortDir[group.baseItemName] ?? "asc";
            const sortedItems = sortItems(group.items, sortDir);

            // Collect all SKUs for duplicate check in new rows (existing + other new rows within this session)
            const skusForNewRowCheck = new Set(allSkus);
            editNewRows.forEach(r => { if (r.sku.trim()) skusForNewRowCheck.add(r.sku.trim().toUpperCase()); });

            return (
              <div
                key={group.baseItemName}
                className={`bg-white border rounded-xl overflow-hidden shadow-sm ${isDraftConfirmed ? "border-brand-300 border-2" : isEditingThis ? "border-amber-300 border-2" : "border-slate-200"}`}
                data-testid={`family-card-${group.baseItemName.replace(/\s+/g, "-")}`}
              >
                {/* Family card header */}
                <div className={`flex items-center justify-between px-5 border-b min-h-[60px] ${isEditingThis ? "bg-amber-50/60 border-amber-200" : "border-slate-200 bg-slate-50/80"}`}>
                  <div className="flex items-center gap-3 py-3 flex-1 min-w-0">
                    <div className="w-11 h-11 rounded-lg overflow-hidden bg-white border border-slate-200 flex items-center justify-center shrink-0">
                      {group.representativeImage ? <img src={group.representativeImage} alt={group.baseItemName} className="w-full h-full object-cover" /> : <Package className="w-5 h-5 text-slate-300" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-slate-900 text-sm leading-snug truncate">{group.baseItemName}</h3>
                      <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider leading-none mt-0.5">
                        {group.items.length} {group.items.length === 1 ? "size" : "sizes"}
                        {isDraftConfirmed && <span className="ml-2 text-brand-500 normal-case tracking-normal">New family</span>}
                        {isEditingThis && <span className="ml-2 text-amber-600 normal-case tracking-normal font-semibold">● Editing</span>}
                      </p>
                    </div>
                  </div>

                  {/* Header buttons */}
                  <div className="flex items-center gap-2 shrink-0 pl-3">
                    {!isEditingThis && (
                      <>
                        {groupOutOfStock > 0 && (
                          <span className="hidden sm:inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-full px-2.5 py-0.5 whitespace-nowrap">
                            <XCircle className="w-3 h-3" />{groupOutOfStock} out of stock
                          </span>
                        )}
                        {groupLowStock > 0 && (
                          <span className="hidden sm:inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5 whitespace-nowrap">
                            <AlertTriangle className="w-3 h-3" />{groupLowStock} low
                          </span>
                        )}
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 gap-1"
                          onClick={() => setEditingGroup(group)} data-testid={`button-family-settings-${group.baseItemName.replace(/\s+/g, "-")}`} title="Family settings">
                          <Pencil className="w-3 h-3" />Settings
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-amber-600 bg-amber-50 hover:bg-amber-100 border border-amber-200 gap-1"
                          onClick={() => enterInlineEdit(group)} disabled={!!inlineEditFamily} data-testid={`button-edit-family-${group.baseItemName.replace(/\s+/g, "-")}`}>
                          <Pencil className="w-3 h-3" />Edit
                        </Button>
                      </>
                    )}
                    {isEditingThis && (
                      <>
                        <Button variant="outline" size="sm" className="h-7 px-2 text-xs text-brand-600 border-brand-200 hover:bg-brand-50 gap-1"
                          onClick={addNewRow} disabled={savingInline} data-testid={`button-add-row-${group.baseItemName.replace(/\s+/g, "-")}`}>
                          <Plus className="w-3 h-3" />Add Row
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 px-3 text-xs text-slate-600 hover:bg-slate-100"
                          onClick={cancelInlineEdit} disabled={savingInline} data-testid={`button-cancel-edit-${group.baseItemName.replace(/\s+/g, "-")}`}>
                          <XIcon className="w-3 h-3 mr-1" />Cancel
                        </Button>
                        <Button size="sm" className="h-7 px-3 text-xs bg-brand-700 hover:bg-brand-800 gap-1"
                          onClick={() => saveInlineEdits(group)} disabled={savingInline} data-testid={`button-save-edit-${group.baseItemName.replace(/\s+/g, "-")}`}>
                          <Save className="w-3 h-3" />{savingInline ? "Saving…" : "Save Changes"}
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Items table */}
                <div className="overflow-x-auto">
                  <Table style={{ tableLayout: "fixed", width: "100%", minWidth: "760px" }}>
                    <colgroup>
                      <col style={{ width: "140px" }} />
                      <col style={{ width: "56px" }} />
                      <col style={{ width: "110px" }} />
                      <col />
                      <col style={{ width: "90px" }} />
                      <col style={{ width: "70px" }} />
                      <col style={{ width: "170px" }} />
                      <col style={{ width: "110px" }} />
                    </colgroup>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent bg-transparent border-b border-slate-100">
                        <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-2 pl-5">SKU</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-2 text-center">Photo</TableHead>
                        <TableHead className="py-2">
                          <button
                            onClick={() => toggleFamilySort(group.baseItemName)}
                            className="flex items-center gap-1 text-xs font-semibold text-slate-400 uppercase tracking-wide hover:text-slate-600 transition-colors group"
                            title={sortDir === "asc" ? "Sorted small→large (click for large→small)" : "Sorted large→small (click for small→large)"}
                            data-testid={`button-sort-size-${group.baseItemName.replace(/\s+/g, "-")}`}
                          >
                            Size
                            {sortDir === "asc"
                              ? <ArrowUp className="w-3 h-3 text-brand-500" />
                              : <ArrowDown className="w-3 h-3 text-brand-500" />}
                          </button>
                        </TableHead>
                        <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-2">Item Name</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-2 text-right">Qty</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-2 text-center">Unit</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-2">Location</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-2 pr-5 text-center">
                          {isEditingThis ? "Delete" : "Status"}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* Existing items (sorted) */}
                      {sortedItems.map(item => {
                        if (isEditingThis && editDrafts[item.id]) {
                          if (editDrafts[item.id]._deleted) return null;
                          return (
                            <InlineEditRow key={item.id} item={item} draft={editDrafts[item.id]}
                              locations={locations || []} onChange={patch => updateDraft(item.id, patch)} onDelete={() => deleteRow(item.id)} />
                          );
                        }
                        return (
                          <TableRow key={item.id}
                            className={`hover:bg-slate-50/70 transition-colors ${item.status === "out_of_stock" ? "bg-red-50/20" : item.status === "low_stock" ? "bg-amber-50/20" : ""}`}
                            data-testid={`row-item-${item.id}`}>
                            <TableCell className="font-mono text-xs text-slate-500 py-2.5 pl-5 overflow-hidden text-ellipsis whitespace-nowrap">{item.sku}</TableCell>
                            <TableCell className="py-2.5">
                              <div className="flex items-center justify-center">
                                {item.imageUrl ? (
                                  <img src={item.imageUrl} alt="" className="w-8 h-8 object-cover rounded border border-slate-200 block"
                                    onError={e => { e.currentTarget.style.display = "none"; (e.currentTarget.nextElementSibling as HTMLElement)?.classList.remove("hidden"); }} />
                                ) : null}
                                <div className={`w-8 h-8 rounded border border-slate-100 bg-slate-50 flex items-center justify-center ${item.imageUrl ? "hidden" : ""}`}>
                                  <ImageIcon className="w-3.5 h-3.5 text-slate-300" />
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="font-semibold text-slate-800 text-sm py-2.5 overflow-hidden text-ellipsis whitespace-nowrap">{item.sizeLabel || "—"}</TableCell>
                            <TableCell className="text-slate-700 text-sm py-2.5 overflow-hidden" style={{ maxWidth: 0 }}>
                              <Link href={`/inventory/${item.id}`} className="hover:text-brand-600 hover:underline transition-colors block truncate" data-testid={`link-item-name-${item.id}`} title={item.name}>{item.name}</Link>
                            </TableCell>
                            <TableCell className="text-right font-semibold text-slate-900 py-2.5 tabular-nums">{item.quantityOnHand.toLocaleString()}</TableCell>
                            <TableCell className="text-slate-500 text-sm py-2.5 text-center">{item.unitOfMeasure}</TableCell>
                            <TableCell className="text-slate-600 text-sm py-2.5 overflow-hidden text-ellipsis whitespace-nowrap">{item.location?.name || "—"}</TableCell>
                            <TableCell className="py-2.5 pr-5">
                              <div className="flex items-center justify-center"><StatusBadge status={item.status} /></div>
                            </TableCell>
                          </TableRow>
                        );
                      })}

                      {/* New blank rows (only in Edit Mode) */}
                      {isEditingThis && editNewRows.map(row => (
                        <InlineNewRow
                          key={row.tmpId}
                          draft={row}
                          familyName={group.baseItemName}
                          categoryId={data?.category.id}
                          categoryCode={data?.category.code}
                          existingItems={group.items}
                          existingSkus={skusForNewRowCheck}
                          locations={locations || []}
                          onChange={patch => updateNewRow(row.tmpId, patch)}
                          onRemove={() => removeNewRow(row.tmpId)}
                        />
                      ))}

                      {/* Empty state */}
                      {group.items.length === 0 && !(isEditingThis && editNewRows.length > 0) && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-6 text-slate-400 text-sm">
                            {isEditingThis
                              ? <span>Click <strong>Add Row</strong> above to add items to this family.</span>
                              : <span>No items yet. <button className="text-brand-600 hover:underline" onClick={() => enterInlineEdit(group)} data-testid={`link-add-first-item-${group.baseItemName.replace(/\s+/g, "-")}`}>Click Edit to add items.</button></span>
                            }
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Family Settings dialog */}
      {editingGroup && (
        <FamilyEditDialog open={!!editingGroup} onClose={() => setEditingGroup(null)} categoryId={data.category.id} group={editingGroup} allFamilies={existingFamilies} />
      )}
    </div>
  );
}
