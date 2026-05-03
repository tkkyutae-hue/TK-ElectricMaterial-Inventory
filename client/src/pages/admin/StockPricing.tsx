import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronRight, ChevronDown, Plus, Trash2, Search, AlertTriangle, Package, DollarSign, Star, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import { apiRequest, queryClient } from "@/lib/queryClient";

type StockItem = {
  id: number;
  sku: string;
  name: string;
  sizeLabel: string | null;
  unitOfMeasure: string;
  imageUrl: string | null;
  quantityOnHand: number;
  reorderPoint: number;
  reorderQuantity: number;
  minimumStock: number;
  status: string;
  supplierCount: number;
  bestPrice: number | null;
};
type Family = { name: string; items: StockItem[] };
type Cat = { id: number; name: string; code: string | null; itemCount: number; families: Family[] };
type Overview = { categories: Cat[] };

type Supplier = { id: number; name: string };
type SupplierItem = {
  id: number;
  itemId: number;
  supplierId: number;
  supplierSku: string | null;
  leadTimeDays: number | null;
  preferredSupplier: boolean;
  lastUnitCost: number | null;
  note: string | null;
  updatedAt: string | null;
  supplier: { id: number; name: string } | null;
};

function loadSession<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch { return fallback; }
}
function saveSession<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try { window.sessionStorage.setItem(key, JSON.stringify(value)); } catch {}
}
const SS_OPEN_CATS = "stockPricing.openCats.v1";
const SS_OPEN_FAMS = "stockPricing.openFamilies.v1";

const QK_OVERVIEW = ["/api/admin/stock-pricing"] as const;

function formatPrice(v: number | null) {
  if (v == null) return "—";
  return `$${v.toFixed(2)}`;
}

export default function StockPricing() {
  const { t } = useLanguage();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [missingPrice, setMissingPrice] = useState(false);
  const [missingReorder, setMissingReorder] = useState(false);
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const [openCats, setOpenCats] = useState<Record<number, boolean>>(() => loadSession(SS_OPEN_CATS, {}));
  const [openFamilies, setOpenFamilies] = useState<Record<string, boolean>>(() => loadSession(SS_OPEN_FAMS, {}));
  useEffect(() => saveSession(SS_OPEN_CATS, openCats), [openCats]);
  useEffect(() => saveSession(SS_OPEN_FAMS, openFamilies), [openFamilies]);
  const [expandedItem, setExpandedItem] = useState<number | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery<Overview>({ queryKey: QK_OVERVIEW });
  const { data: suppliersData } = useQuery<Supplier[]>({ queryKey: ["/api/suppliers"] });
  const suppliers = suppliersData ?? [];

  const filtered = useMemo<Cat[]>(() => {
    if (!data?.categories) return [];
    const q = search.trim().toLowerCase();
    return data.categories
      .filter(c => categoryFilter === "all" || String(c.id) === categoryFilter)
      .map(c => ({
        ...c,
        families: c.families.map(f => ({
          ...f,
          items: f.items.filter(it => {
            if (q) {
              const hay = `${it.sku} ${it.name} ${it.sizeLabel ?? ""}`.toLowerCase();
              if (!hay.includes(q)) return false;
            }
            if (missingPrice && it.supplierCount > 0) return false;
            if (missingReorder && it.reorderPoint > 0 && it.reorderQuantity > 0) return false;
            if (lowStockOnly && !(it.quantityOnHand <= it.reorderPoint)) return false;
            return true;
          }),
        })).filter(f => f.items.length > 0),
      }))
      .filter(c => c.families.length > 0);
  }, [data, search, categoryFilter, missingPrice, missingReorder, lowStockOnly]);

  useEffect(() => {
    if (search.trim() || missingPrice || missingReorder || lowStockOnly) {
      const co: Record<number, boolean> = {};
      const fo: Record<string, boolean> = {};
      filtered.forEach(c => { co[c.id] = true; c.families.forEach(f => { fo[`${c.id}::${f.name}`] = true; }); });
      setOpenCats(prev => ({ ...prev, ...co }));
      setOpenFamilies(prev => ({ ...prev, ...fo }));
    }
  }, [search, missingPrice, missingReorder, lowStockOnly, filtered]);

  const toggleCat = (id: number) => setOpenCats(s => ({ ...s, [id]: !s[id] }));
  const toggleFam = (key: string) => setOpenFamilies(s => ({ ...s, [key]: !s[key] }));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900" data-testid="text-page-title">{t.stockPricingTitle}</h1>
        <p className="text-sm text-slate-500 mt-1">{t.stockPricingSubtitle}</p>
      </header>

      <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4 space-y-3 sticky top-0 z-10 shadow-sm" data-testid="toolbar-stock-pricing">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs font-semibold text-slate-500 mb-1">{t.stockPricingSearchLabel}</label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t.stockPricingSearchPlaceholder}
                className="pl-8"
                data-testid="input-search"
              />
            </div>
          </div>
          <div className="min-w-[200px]">
            <label className="block text-xs font-semibold text-slate-500 mb-1">{t.stockPricingCategoryLabel}</label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger data-testid="select-category"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.stockPricingAllCategories}</SelectItem>
                {data?.categories.map(c => (
                  <SelectItem key={c.id} value={String(c.id)} data-testid={`select-cat-${c.id}`}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <Switch checked={missingPrice} onCheckedChange={setMissingPrice} data-testid="switch-missing-price" />
            {t.stockPricingFilterMissingPrice}
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <Switch checked={missingReorder} onCheckedChange={setMissingReorder} data-testid="switch-missing-reorder" />
            {t.stockPricingFilterMissingReorder}
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <Switch checked={lowStockOnly} onCheckedChange={setLowStockOnly} data-testid="switch-low-stock-only" />
            {t.stockPricingFilterLowStock}
          </label>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-3" data-testid="text-loading">
          {[0, 1, 2].map(i => (
            <div key={i} className="bg-white border border-slate-200 rounded-lg p-4 animate-pulse">
              <div className="h-4 w-48 bg-slate-200 rounded mb-3" />
              <div className="space-y-2">
                <div className="h-3 w-full bg-slate-100 rounded" />
                <div className="h-3 w-5/6 bg-slate-100 rounded" />
                <div className="h-3 w-4/6 bg-slate-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {isError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700 flex items-center justify-between" data-testid="text-error">
          <span>{(error as Error)?.message ?? t.stockPricingSaveFailed}</span>
          <Button size="sm" variant="outline" onClick={() => refetch()} data-testid="button-retry">{t.stockPricingRetry}</Button>
        </div>
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        <div className="text-center py-12 text-slate-400" data-testid="text-empty">
          {t.stockPricingEmpty}
        </div>
      )}

      <div className="space-y-3">
        {filtered.map(cat => {
          const catOpen = openCats[cat.id] ?? false;
          const totalItems = cat.families.reduce((s, f) => s + f.items.length, 0);
          return (
            <div key={cat.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden" data-testid={`cat-${cat.id}`}>
              <button
                type="button"
                onClick={() => toggleCat(cat.id)}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors"
                data-testid={`button-toggle-cat-${cat.id}`}
              >
                <div className="flex items-center gap-3">
                  {catOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  <h2 className="font-semibold text-slate-900 text-base">{cat.name}</h2>
                  <Badge variant="secondary" className="text-xs">{totalItems} {t.stockPricingItemCountSuffix}</Badge>
                </div>
              </button>

              {catOpen && (
                <div className="px-3 pb-3 space-y-2">
                  {cat.families.map(fam => {
                    const famKey = `${cat.id}::${fam.name}`;
                    const famOpen = openFamilies[famKey] ?? false;
                    return (
                      <div key={famKey} className="border border-slate-200 rounded-md bg-slate-50/40" data-testid={`fam-${cat.id}-${fam.name}`}>
                        <button
                          type="button"
                          onClick={() => toggleFam(famKey)}
                          className="w-full flex items-center justify-between px-4 py-2 hover:bg-slate-100/70 transition-colors"
                          data-testid={`button-toggle-fam-${cat.id}-${fam.name}`}
                        >
                          <div className="flex items-center gap-2">
                            {famOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                            <Package className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-medium text-slate-700 text-sm">{fam.name}</span>
                            <span className="text-xs text-slate-400">
                              ({fam.items.length} {t.stockPricingItemCountSuffix}
                              {(() => {
                                const low = fam.items.filter(i => i.quantityOnHand <= i.reorderPoint).length;
                                const noPrice = fam.items.filter(i => i.supplierCount === 0).length;
                                const parts: string[] = [];
                                if (low > 0) parts.push(`${low} ${t.stockPricingFilterLowStock.toLowerCase()}`);
                                if (noPrice > 0) parts.push(`${noPrice} ${t.stockPricingFilterMissingPrice.toLowerCase()}`);
                                return parts.length ? ` · ${parts.join(" · ")}` : "";
                              })()}
                              )
                            </span>
                          </div>
                        </button>
                        {famOpen && (
                          <FamilyTable
                            items={fam.items}
                            suppliers={suppliers}
                            expandedItem={expandedItem}
                            onToggleExpand={(id) => setExpandedItem(prev => prev === id ? null : id)}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Family Table ───────────────────────────────────────────────────────────

function FamilyTable({
  items, suppliers, expandedItem, onToggleExpand,
}: {
  items: StockItem[];
  suppliers: Supplier[];
  expandedItem: number | null;
  onToggleExpand: (id: number) => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="overflow-x-auto bg-white">
      <Table style={{ minWidth: "1000px" }}>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-b border-slate-200">
            <TableHead className="w-8" />
            <TableHead className="w-12" />
            <TableHead className="text-xs uppercase tracking-wide text-slate-500">{t.stockPricingColSku}</TableHead>
            <TableHead className="text-xs uppercase tracking-wide text-slate-500">{t.stockPricingColName}</TableHead>
            <TableHead className="text-xs uppercase tracking-wide text-slate-500 text-right">{t.stockPricingColOnHand}</TableHead>
            <TableHead className="text-xs uppercase tracking-wide text-slate-500 text-center w-28">{t.stockPricingColReorderPoint}</TableHead>
            <TableHead className="text-xs uppercase tracking-wide text-slate-500 text-center w-28">{t.stockPricingColReorderQty}</TableHead>
            <TableHead className="text-xs uppercase tracking-wide text-slate-500 text-center w-28">{t.stockPricingColMinStock}</TableHead>
            <TableHead className="text-xs uppercase tracking-wide text-slate-500 text-right">{t.stockPricingColBestPrice}</TableHead>
            <TableHead className="text-xs uppercase tracking-wide text-slate-500 text-center">{t.stockPricingColSupplierCount}</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map(item => (
            <ItemRow
              key={item.id}
              item={item}
              suppliers={suppliers}
              expanded={expandedItem === item.id}
              onToggleExpand={() => onToggleExpand(item.id)}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Item Row + inline edit ─────────────────────────────────────────────────

function ItemRow({
  item, suppliers, expanded, onToggleExpand,
}: {
  item: StockItem;
  suppliers: Supplier[];
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [draft, setDraft] = useState({
    reorderPoint: item.reorderPoint,
    reorderQuantity: item.reorderQuantity,
    minimumStock: item.minimumStock,
  });

  useEffect(() => {
    setDraft({
      reorderPoint: item.reorderPoint,
      reorderQuantity: item.reorderQuantity,
      minimumStock: item.minimumStock,
    });
  }, [item.reorderPoint, item.reorderQuantity, item.minimumStock]);

  const saveMutation = useMutation({
    mutationFn: async (patch: { reorderPoint: number; reorderQuantity: number; minimumStock: number }) => {
      const res = await apiRequest("PATCH", `/api/admin/items/${item.id}/stock-settings`, patch);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t.stockPricingSaved });
      queryClient.invalidateQueries({ queryKey: QK_OVERVIEW });
    },
    onError: (err: any) => {
      setDraft({ reorderPoint: item.reorderPoint, reorderQuantity: item.reorderQuantity, minimumStock: item.minimumStock });
      toast({ title: t.stockPricingSaveFailed, description: err?.message ?? "", variant: "destructive" });
    },
  });

  const setField = useCallback((field: "reorderPoint" | "reorderQuantity" | "minimumStock", raw: string) => {
    const v = Math.max(0, Math.floor(Number(raw) || 0));
    setDraft(prev => ({ ...prev, [field]: v }));
  }, []);

  const isDirty =
    draft.reorderPoint !== item.reorderPoint ||
    draft.reorderQuantity !== item.reorderQuantity ||
    draft.minimumStock !== item.minimumStock;

  const handleSaveRow = () => { if (isDirty) saveMutation.mutate(draft); };
  const handleCancelRow = () => setDraft({
    reorderPoint: item.reorderPoint,
    reorderQuantity: item.reorderQuantity,
    minimumStock: item.minimumStock,
  });
  const handleEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); handleSaveRow(); }
    else if (e.key === "Escape") { e.preventDefault(); handleCancelRow(); }
  };

  const statusCls =
    item.status === "out_of_stock" ? "bg-red-50/40" :
    item.status === "low_stock" ? "bg-amber-50/40" : "";

  return (
    <>
      <TableRow className={`${statusCls} border-b border-slate-100`} data-testid={`row-item-${item.id}`}>
        <TableCell className="w-8 px-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onToggleExpand}
              className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
              data-testid={`button-expand-${item.id}`}
              aria-label={expanded ? t.stockPricingHideSuppliers : t.stockPricingShowSuppliers}
            >
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {(item.status === "low_stock" || item.status === "out_of_stock") && (
              <span
                className={`w-2 h-2 rounded-full ${item.status === "out_of_stock" ? "bg-red-500" : "bg-amber-500"}`}
                data-testid={`dot-low-stock-${item.id}`}
                title={t.stockPricingFilterLowStock}
              />
            )}
          </div>
        </TableCell>
        <TableCell className="w-12 px-2">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt=""
              className="w-9 h-9 rounded object-cover border border-slate-200 bg-slate-50"
              data-testid={`img-item-${item.id}`}
              loading="lazy"
            />
          ) : (
            <div className="w-9 h-9 rounded border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-slate-300">
              <Package className="w-4 h-4" />
            </div>
          )}
        </TableCell>
        <TableCell className="font-mono text-xs text-slate-500" data-testid={`text-sku-${item.id}`}>{item.sku}</TableCell>
        <TableCell>
          <div className="text-sm font-medium text-slate-800" data-testid={`text-name-${item.id}`}>{item.name}</div>
          {item.sizeLabel && <div className="text-xs text-slate-400" data-testid={`text-size-${item.id}`}>{item.sizeLabel}</div>}
        </TableCell>
        <TableCell className="text-right tabular-nums">
          <span className="font-semibold text-slate-900 text-sm" data-testid={`text-on-hand-${item.id}`}>{item.quantityOnHand.toLocaleString()}</span>
          <span className="text-slate-400 text-[11px] ml-1">{item.unitOfMeasure}</span>
        </TableCell>
        <TableCell className="text-center">
          <Input
            type="number" min="0" step="1"
            value={String(draft.reorderPoint)}
            disabled={saveMutation.isPending}
            onChange={e => setField("reorderPoint", e.target.value)}
            onKeyDown={handleEnter}
            className={`w-20 h-8 text-center text-sm tabular-nums mx-auto ${isDirty ? "border-amber-400 ring-1 ring-amber-200" : ""}`}
            data-testid={`input-reorder-point-${item.id}`}
          />
        </TableCell>
        <TableCell className="text-center">
          <Input
            type="number" min="0" step="1"
            value={String(draft.reorderQuantity)}
            disabled={saveMutation.isPending}
            onChange={e => setField("reorderQuantity", e.target.value)}
            onKeyDown={handleEnter}
            className={`w-20 h-8 text-center text-sm tabular-nums mx-auto ${isDirty ? "border-amber-400 ring-1 ring-amber-200" : ""}`}
            data-testid={`input-reorder-qty-${item.id}`}
          />
        </TableCell>
        <TableCell className="text-center">
          <Input
            type="number" min="0" step="1"
            value={String(draft.minimumStock)}
            disabled={saveMutation.isPending}
            onChange={e => setField("minimumStock", e.target.value)}
            onKeyDown={handleEnter}
            className={`w-20 h-8 text-center text-sm tabular-nums mx-auto ${isDirty ? "border-amber-400 ring-1 ring-amber-200" : ""}`}
            data-testid={`input-min-stock-${item.id}`}
          />
        </TableCell>
        <TableCell className="text-right tabular-nums">
          <span className={`text-sm font-medium ${item.bestPrice == null ? "text-slate-300" : "text-slate-800"}`} data-testid={`text-best-price-${item.id}`}>
            {formatPrice(item.bestPrice)}
          </span>
        </TableCell>
        <TableCell className="text-center">
          <Badge
            variant={item.supplierCount === 0 ? "outline" : "secondary"}
            className={item.supplierCount === 0 ? "text-amber-700 border-amber-300 bg-amber-50" : ""}
            data-testid={`badge-supplier-count-${item.id}`}
          >
            {item.supplierCount === 0 && <AlertTriangle className="w-3 h-3 mr-1" />}
            {item.supplierCount}
          </Badge>
        </TableCell>
        <TableCell className="w-24">
          {isDirty && (
            <div className="flex items-center gap-1 justify-end" data-testid={`row-actions-${item.id}`}>
              <Button
                size="sm" variant="default"
                className="h-7 px-2"
                onClick={handleSaveRow}
                disabled={saveMutation.isPending}
                data-testid={`button-save-row-${item.id}`}
                aria-label={t.cmnSave}
                title={t.cmnSave}
              >
                {saveMutation.isPending ? <span className="text-xs">…</span> : <Check className="w-3.5 h-3.5" />}
              </Button>
              <Button
                size="sm" variant="ghost"
                className="h-7 px-2"
                onClick={handleCancelRow}
                disabled={saveMutation.isPending}
                data-testid={`button-cancel-row-${item.id}`}
                aria-label={t.cmnCancel}
                title={t.cmnCancel}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow className="bg-slate-50/60 border-b border-slate-200" data-testid={`row-suppliers-${item.id}`}>
          <TableCell colSpan={11} className="p-0">
            <SupplierPanel itemId={item.id} suppliers={suppliers} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ─── Supplier Panel ─────────────────────────────────────────────────────────

function SupplierPanel({ itemId, suppliers }: { itemId: number; suppliers: Supplier[] }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const qk = ["/api/admin/items", itemId, "supplier-items"] as const;
  const { data, isLoading } = useQuery<{ items: SupplierItem[] }>({
    queryKey: qk,
    queryFn: async () => {
      const res = await fetch(`/api/admin/items/${itemId}/supplier-items`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });
  const rows = data?.items ?? [];

  const [adding, setAdding] = useState(false);
  const [newRow, setNewRow] = useState<{ supplierId: string; lastUnitCost: string; supplierSku: string; leadTimeDays: string; preferredSupplier: boolean; note: string }>({
    supplierId: "", lastUnitCost: "", supplierSku: "", leadTimeDays: "", preferredSupplier: false, note: "",
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: qk });
    queryClient.invalidateQueries({ queryKey: QK_OVERVIEW });
  };

  const createMut = useMutation({
    mutationFn: async (body: any) => {
      const res = await apiRequest("POST", `/api/admin/items/${itemId}/supplier-items`, body);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t.stockPricingSupplierAdded });
      setAdding(false);
      setNewRow({ supplierId: "", lastUnitCost: "", supplierSku: "", leadTimeDays: "", preferredSupplier: false, note: "" });
      invalidate();
    },
    onError: (err: any) => toast({ title: t.stockPricingSaveFailed, description: err?.message ?? "", variant: "destructive" }),
  });

  const patchMut = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: any }) => {
      const res = await apiRequest("PATCH", `/api/admin/items/${itemId}/supplier-items/${id}`, body);
      return res.json();
    },
    onSuccess: () => { toast({ title: t.stockPricingSaved }); invalidate(); },
    onError: (err: any) => toast({ title: t.stockPricingSaveFailed, description: err?.message ?? "", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/admin/items/${itemId}/supplier-items/${id}`); },
    onSuccess: () => { toast({ title: t.stockPricingSupplierDeleted }); invalidate(); },
    onError: (err: any) => toast({ title: t.stockPricingSaveFailed, description: err?.message ?? "", variant: "destructive" }),
  });

  const usedSupplierIds = new Set(rows.map(r => r.supplierId));
  const availableSuppliers = suppliers.filter(s => !usedSupplierIds.has(s.id));

  const handleAdd = () => {
    if (!newRow.supplierId) {
      toast({ title: t.stockPricingSupplierRequired, variant: "destructive" });
      return;
    }
    createMut.mutate({
      supplierId: Number(newRow.supplierId),
      lastUnitCost: newRow.lastUnitCost === "" ? null : Number(newRow.lastUnitCost),
      supplierSku: newRow.supplierSku || null,
      leadTimeDays: newRow.leadTimeDays === "" ? null : Number(newRow.leadTimeDays),
      preferredSupplier: newRow.preferredSupplier,
      note: newRow.note.trim() || null,
    });
  };

  return (
    <div className="px-6 py-4 border-l-4 border-brand-300 bg-white" data-testid={`supplier-panel-${itemId}`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-brand-500" />
          {t.stockPricingSupplierPanelTitle}
        </h4>
        {!adding && availableSuppliers.length > 0 && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)} data-testid={`button-add-supplier-${itemId}`}>
            <Plus className="w-3.5 h-3.5 mr-1" />{t.stockPricingAddSupplier}
          </Button>
        )}
      </div>

      {isLoading && <div className="text-sm text-slate-400 py-2">{t.cmnLoading}</div>}

      {!isLoading && rows.length === 0 && !adding && (
        <div className="text-sm text-slate-400 py-3 text-center bg-slate-50 rounded border border-dashed border-slate-200">
          {t.stockPricingNoSuppliers}
        </div>
      )}

      {(rows.length > 0 || adding) && (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs text-slate-500">{t.stockPricingSupplier}</TableHead>
              <TableHead className="text-xs text-slate-500">{t.stockPricingSupplierSku}</TableHead>
              <TableHead className="text-xs text-slate-500 text-right">{t.stockPricingUnitCost}</TableHead>
              <TableHead className="text-xs text-slate-500 text-center">{t.stockPricingLeadTime}</TableHead>
              <TableHead className="text-xs text-slate-500 text-center">{t.stockPricingPreferred}</TableHead>
              <TableHead className="text-xs text-slate-500">{t.stockPricingNote}</TableHead>
              <TableHead className="text-xs text-slate-500 text-right whitespace-nowrap">{t.stockPricingUpdated}</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(row => (
              <SupplierRow
                key={row.id}
                row={row}
                onPatch={(body) => patchMut.mutate({ id: row.id, body })}
                onDelete={() => deleteMut.mutate(row.id)}
                disabled={patchMut.isPending || deleteMut.isPending}
              />
            ))}
            {adding && (
              <TableRow className="bg-brand-50/40" data-testid={`row-new-supplier-${itemId}`}>
                <TableCell>
                  <Select value={newRow.supplierId} onValueChange={v => setNewRow(r => ({ ...r, supplierId: v }))}>
                    <SelectTrigger className="h-8 text-sm" data-testid={`select-new-supplier-${itemId}`}>
                      <SelectValue placeholder={t.stockPricingChooseSupplier} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSuppliers.map(s => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input className="h-8 text-sm" value={newRow.supplierSku} onChange={e => setNewRow(r => ({ ...r, supplierSku: e.target.value }))} placeholder="—" data-testid={`input-new-supplier-sku-${itemId}`} />
                </TableCell>
                <TableCell>
                  <Input type="number" min="0" step="0.01" className="h-8 text-sm text-right" value={newRow.lastUnitCost} onChange={e => setNewRow(r => ({ ...r, lastUnitCost: e.target.value }))} placeholder="0.00" data-testid={`input-new-cost-${itemId}`} />
                </TableCell>
                <TableCell>
                  <Input type="number" min="0" step="1" className="h-8 text-sm text-center" value={newRow.leadTimeDays} onChange={e => setNewRow(r => ({ ...r, leadTimeDays: e.target.value }))} placeholder="—" data-testid={`input-new-lead-${itemId}`} />
                </TableCell>
                <TableCell className="text-center">
                  <Switch checked={newRow.preferredSupplier} onCheckedChange={v => setNewRow(r => ({ ...r, preferredSupplier: v }))} data-testid={`switch-new-preferred-${itemId}`} />
                </TableCell>
                <TableCell>
                  <Input className="h-8 text-sm" value={newRow.note} onChange={e => setNewRow(r => ({ ...r, note: e.target.value }))} placeholder={t.stockPricingNotePlaceholder} data-testid={`input-new-note-${itemId}`} />
                </TableCell>
                <TableCell />
                <TableCell>
                  <div className="flex items-center gap-1 justify-end">
                    <Button size="sm" variant="ghost" onClick={() => { setAdding(false); }} data-testid={`button-cancel-add-${itemId}`}>{t.cmnCancel}</Button>
                    <Button size="sm" onClick={handleAdd} disabled={createMut.isPending} data-testid={`button-save-add-${itemId}`}>
                      {createMut.isPending ? t.cmnSaving : t.cmnSave}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function SupplierRow({ row, onPatch, onDelete, disabled }: {
  row: SupplierItem;
  onPatch: (body: any) => void;
  onDelete: () => void;
  disabled?: boolean;
}) {
  const { t } = useLanguage();
  const [cost, setCost] = useState(row.lastUnitCost == null ? "" : String(row.lastUnitCost));
  const [sku, setSku] = useState(row.supplierSku ?? "");
  const [lead, setLead] = useState(row.leadTimeDays == null ? "" : String(row.leadTimeDays));
  const [note, setNote] = useState(row.note ?? "");
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => { setCost(row.lastUnitCost == null ? "" : String(row.lastUnitCost)); }, [row.lastUnitCost]);
  useEffect(() => { setSku(row.supplierSku ?? ""); }, [row.supplierSku]);
  useEffect(() => { setLead(row.leadTimeDays == null ? "" : String(row.leadTimeDays)); }, [row.leadTimeDays]);
  useEffect(() => { setNote(row.note ?? ""); }, [row.note]);

  const commitCost = () => {
    const v = cost === "" ? null : Number(cost);
    if ((row.lastUnitCost ?? null) === v) return;
    onPatch({ lastUnitCost: v });
  };
  const commitSku = () => {
    const v = sku.trim() || null;
    if ((row.supplierSku ?? null) === v) return;
    onPatch({ supplierSku: v });
  };
  const commitLead = () => {
    const v = lead === "" ? null : Math.max(0, Math.floor(Number(lead) || 0));
    if ((row.leadTimeDays ?? null) === v) return;
    onPatch({ leadTimeDays: v });
  };
  const commitNote = () => {
    const v = note.trim() || null;
    if ((row.note ?? null) === v) return;
    onPatch({ note: v });
  };

  return (
    <TableRow data-testid={`row-supplier-${row.id}`}>
      <TableCell className="font-medium text-sm text-slate-800" data-testid={`text-supplier-name-${row.id}`}>
        <div className="flex items-center gap-1.5">
          {row.preferredSupplier && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
          {row.supplier?.name ?? "—"}
        </div>
      </TableCell>
      <TableCell>
        <Input
          className="h-8 text-sm"
          value={sku}
          disabled={disabled}
          onChange={e => setSku(e.target.value)}
          onBlur={commitSku}
          onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          data-testid={`input-supplier-sku-${row.id}`}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number" min="0" step="0.01"
          className="h-8 text-sm text-right"
          value={cost}
          disabled={disabled}
          onChange={e => setCost(e.target.value)}
          onBlur={commitCost}
          onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          data-testid={`input-cost-${row.id}`}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number" min="0" step="1"
          className="h-8 text-sm text-center"
          value={lead}
          disabled={disabled}
          onChange={e => setLead(e.target.value)}
          onBlur={commitLead}
          onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          data-testid={`input-lead-${row.id}`}
        />
      </TableCell>
      <TableCell className="text-center">
        <Switch
          checked={row.preferredSupplier}
          disabled={disabled}
          onCheckedChange={v => onPatch({ preferredSupplier: v })}
          data-testid={`switch-preferred-${row.id}`}
        />
      </TableCell>
      <TableCell>
        <Input
          className="h-8 text-sm"
          value={note}
          disabled={disabled}
          onChange={e => setNote(e.target.value)}
          onBlur={commitNote}
          onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          placeholder={t.stockPricingNotePlaceholder}
          data-testid={`input-supplier-note-${row.id}`}
        />
      </TableCell>
      <TableCell className="text-right text-xs text-slate-400 whitespace-nowrap" data-testid={`text-supplier-updated-${row.id}`}>
        {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : "—"}
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end">
          {confirmDel ? (
            <div className="flex items-center gap-1">
              <Button size="sm" variant="destructive" onClick={() => { setConfirmDel(false); onDelete(); }} data-testid={`button-confirm-delete-${row.id}`}>{t.cmnDelete}</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDel(false)} data-testid={`button-cancel-delete-${row.id}`}>{t.cmnCancel}</Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDel(true)}
              className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
              data-testid={`button-delete-supplier-${row.id}`}
              aria-label={t.cmnDelete}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
