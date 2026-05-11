import { useState, useMemo, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronRight, ChevronDown, ChevronsUpDown, ChevronsDownUp, Plus, Trash2, Search, AlertTriangle, Package, DollarSign, Star, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import type { Translations } from "@/lib/i18n";
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
  pricedSupplierCount: number;
  bestPrice: number | null;
  averagePrice: number | null;
};
type Family = { name: string; items: StockItem[] };
type Cat = { id: number; name: string; code: string | null; itemCount: number; families: Family[] };
type Overview = { categories: Cat[] };

type SupplierViewRow = {
  supplierItemId: number | null;
  itemId: number;
  sku: string;
  name: string;
  sizeLabel: string | null;
  unitOfMeasure: string;
  imageUrl: string | null;
  categoryId: number | null;
  categoryName: string | null;
  familyName: string | null;
  quantityOnHand: number;
  reorderPoint: number;
  supplierSku: string | null;
  lastUnitCost: number | null;
  leadTimeDays: number | null;
  preferredSupplier: boolean;
  note: string | null;
  updatedAt: string | null;
};
type SupplierViewData = { supplierId: number; supplierName: string; items: SupplierViewRow[] };
type RowEdit = { lastUnitCost: string; leadTimeDays: string; note: string };

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

  const [activeTab, setActiveTab] = useState<string>("summary");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [missingPrice, setMissingPrice] = useState(false);
  const [missingReorder, setMissingReorder] = useState(false);
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const [openCats, setOpenCats] = useState<Record<number, boolean>>(() => loadSession(SS_OPEN_CATS, {}));
  const [openFamilies, setOpenFamilies] = useState<Record<string, boolean>>(() => loadSession(SS_OPEN_FAMS, {}));
  useEffect(() => saveSession(SS_OPEN_CATS, openCats), [openCats]);
  useEffect(() => saveSession(SS_OPEN_FAMS, openFamilies), [openFamilies]);

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
            if (missingPrice && it.pricedSupplierCount > 0) return false;
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

  // Expand/collapse every family within a single category in one click.
  const toggleCatFamilies = (catId: number, families: { name: string }[], open: boolean) => {
    setOpenFamilies(prev => {
      const next = { ...prev };
      families.forEach(f => { next[`${catId}::${f.name}`] = open; });
      return next;
    });
  };

  return (
    <div className="p-6 pb-40 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900" data-testid="text-page-title">{t.stockPricingTitle}</h1>
        <p className="text-sm text-slate-500 mt-1">{t.stockPricingSubtitle}</p>
        <div className="mt-4 flex gap-0.5 border-b border-slate-200 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("summary")}
            className={`px-4 py-2 text-sm font-medium transition-colors rounded-t border-b-2 whitespace-nowrap ${activeTab === "summary" ? "border-brand-500 text-brand-600 bg-brand-50/50" : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"}`}
            data-testid="tab-summary"
          >
            {t.stockPricingTabSummary}
          </button>
          {suppliers.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveTab(String(s.id))}
              className={`px-4 py-2 text-sm font-medium transition-colors rounded-t border-b-2 whitespace-nowrap ${activeTab === String(s.id) ? "border-brand-500 text-brand-600 bg-brand-50/50" : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"}`}
              data-testid={`tab-supplier-${s.id}`}
            >
              {s.name}
            </button>
          ))}
        </div>
      </header>

      {activeTab !== "summary" && (() => {
        const sup = suppliers.find(s => String(s.id) === activeTab);
        return sup ? <SupplierView key={sup.id} supplierId={sup.id} supplierName={sup.name} /> : null;
      })()}

      {activeTab === "summary" && isLoading && (
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

      {activeTab === "summary" && isError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700 flex items-center justify-between" data-testid="text-error">
          <span>{(error as Error)?.message ?? t.stockPricingSaveFailed}</span>
          <Button size="sm" variant="outline" onClick={() => refetch()} data-testid="button-retry">{t.stockPricingRetry}</Button>
        </div>
      )}

      {activeTab === "summary" && !isLoading && !isError && filtered.length === 0 && (
        <div className="text-center py-12 text-slate-400" data-testid="text-empty">
          {t.stockPricingEmpty}
        </div>
      )}

      {activeTab === "summary" && <div className="space-y-3">
        {filtered.map(cat => {
          const catOpen = openCats[cat.id] ?? false;
          const totalItems = cat.families.reduce((s, f) => s + f.items.length, 0);
          const hasFamilies = cat.families.length > 0;
          const allFamiliesOpen = hasFamilies && cat.families.every(
            f => openFamilies[`${cat.id}::${f.name}`] ?? false
          );
          return (
            <div key={cat.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden" data-testid={`cat-${cat.id}`}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => toggleCat(cat.id)}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleCat(cat.id);
                  }
                }}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors cursor-pointer"
                data-testid={`button-toggle-cat-${cat.id}`}
              >
                <div className="flex items-center gap-3">
                  {catOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  <h2 className="font-semibold text-slate-900 text-base">{cat.name}</h2>
                  <Badge variant="secondary" className="text-xs">{totalItems} {t.stockPricingItemCountSuffix}</Badge>
                </div>
                {hasFamilies && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 bg-white text-xs whitespace-nowrap"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCatFamilies(cat.id, cat.families, !allFamiliesOpen);
                    }}
                    data-testid={`button-toggle-cat-families-${cat.id}`}
                  >
                    {allFamiliesOpen ? (
                      <>
                        <ChevronsDownUp className="w-3.5 h-3.5 mr-1.5" />
                        {t.reorderCollapseAll}
                      </>
                    ) : (
                      <>
                        <ChevronsUpDown className="w-3.5 h-3.5 mr-1.5" />
                        {t.reorderExpandAll}
                      </>
                    )}
                  </Button>
                )}
              </div>

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
                                const noPrice = fam.items.filter(i => i.pricedSupplierCount === 0).length;
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
                          <FamilyTable items={fam.items} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>}

      {activeTab === "summary" && typeof document !== "undefined" && createPortal(
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-3xl pointer-events-none">
          <div
            className="bg-white border border-slate-200 rounded-2xl p-3 space-y-2 shadow-xl pointer-events-auto"
            data-testid="toolbar-stock-pricing"
          >
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={t.stockPricingSearchPlaceholder}
                  className="pl-8 h-9"
                  data-testid="input-search"
                />
              </div>
              <div className="min-w-[180px]">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="h-9" data-testid="select-category">
                    <SelectValue placeholder={t.stockPricingCategoryLabel} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t.stockPricingAllCategories}</SelectItem>
                    {data?.categories.map(c => (
                      <SelectItem key={c.id} value={String(c.id)} data-testid={`select-cat-${c.id}`}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 px-1">
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <Switch checked={missingPrice} onCheckedChange={setMissingPrice} data-testid="switch-missing-price" />
                {t.stockPricingFilterMissingPrice}
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <Switch checked={missingReorder} onCheckedChange={setMissingReorder} data-testid="switch-missing-reorder" />
                {t.stockPricingFilterMissingReorder}
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <Switch checked={lowStockOnly} onCheckedChange={setLowStockOnly} data-testid="switch-low-stock-only" />
                {t.stockPricingFilterLowStock}
              </label>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ─── Family Table ───────────────────────────────────────────────────────────

function FamilyTable({ items }: { items: StockItem[] }) {
  const { t } = useLanguage();
  return (
    <div className="overflow-x-auto bg-white">
      <Table style={{ minWidth: "1160px" }}>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-b border-slate-200">
            <TableHead className="w-16 px-2">{t.stockPricingColPhoto}</TableHead>
            <TableHead className="text-xs uppercase tracking-wide text-slate-500 whitespace-nowrap w-24">{t.stockPricingColSize}</TableHead>
            <TableHead className="text-xs uppercase tracking-wide text-slate-500 whitespace-nowrap">{t.stockPricingColName}</TableHead>
            <TableHead className="text-xs uppercase tracking-wide text-slate-500 whitespace-nowrap text-right">{t.stockPricingColOnHand}</TableHead>
            <TableHead className="text-xs uppercase tracking-wide text-slate-500 whitespace-nowrap text-center w-28">{t.stockPricingColReorderPoint}</TableHead>
            <TableHead className="text-xs uppercase tracking-wide text-slate-500 whitespace-nowrap text-center w-28">{t.stockPricingColReorderQty}</TableHead>
            <TableHead className="text-xs uppercase tracking-wide text-slate-500 whitespace-nowrap text-center w-28">{t.stockPricingColMinStock}</TableHead>
            <TableHead className="text-xs uppercase tracking-wide text-slate-500 whitespace-nowrap text-right">{t.stockPricingColAveragePrice}</TableHead>
            <TableHead className="text-xs uppercase tracking-wide text-slate-500 whitespace-nowrap text-right">{t.stockPricingColLowestPrice}</TableHead>
            <TableHead className="text-xs uppercase tracking-wide text-slate-500 whitespace-nowrap text-center">{t.stockPricingColSupplierCount}</TableHead>
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map(item => (
            <ItemRow key={item.id} item={item} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Item Row (editable: Reorder Pt / Reorder Qt / Min Stock) ───────────────

type StockDraft = { reorderPoint: string; reorderQuantity: string; minimumStock: string };

function normInt(s: string) { return Math.max(0, parseInt(s || "0", 10) || 0); }

function ItemRow({ item }: { item: StockItem }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [draft, setDraft] = useState<StockDraft | null>(null);

  const isEditing = draft !== null;
  const isDirty = draft !== null && (
    normInt(draft.reorderPoint) !== item.reorderPoint ||
    normInt(draft.reorderQuantity) !== item.reorderQuantity ||
    normInt(draft.minimumStock) !== item.minimumStock
  );

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!draft) return;
      const body = {
        reorderPoint: normInt(draft.reorderPoint),
        reorderQuantity: normInt(draft.reorderQuantity),
        minimumStock: normInt(draft.minimumStock),
      };
      await apiRequest("PATCH", `/api/admin/items/${item.id}/stock-settings`, body);
    },
    onSuccess: () => {
      setDraft(null);
      queryClient.invalidateQueries({ queryKey: QK_OVERVIEW });
      toast({ title: t.stockPricingSaved });
    },
    onError: () => toast({ title: t.stockPricingSaveFailed, variant: "destructive" }),
  });

  const startDraft = () => {
    if (draft) return;
    setDraft({
      reorderPoint: item.reorderPoint > 0 ? String(item.reorderPoint) : "",
      reorderQuantity: item.reorderQuantity > 0 ? String(item.reorderQuantity) : "",
      minimumStock: item.minimumStock > 0 ? String(item.minimumStock) : "",
    });
  };

  const statusCls = isDirty ? "bg-amber-50/40" :
    item.status === "out_of_stock" ? "bg-red-50/40" :
    item.status === "low_stock" ? "bg-amber-50/30" : "";

  return (
    <TableRow className={`${statusCls} border-b border-slate-100`} data-testid={`row-item-${item.id}`}>
      <TableCell className="w-16 px-2">
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
      <TableCell className="w-24 text-xs text-slate-500 tabular-nums" data-testid={`text-size-${item.id}`}>
        {item.sizeLabel || ""}
      </TableCell>
      <TableCell>
        <div className="text-sm font-medium text-slate-800" data-testid={`text-name-${item.id}`}>{item.name}</div>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        <span className="font-semibold text-slate-900 text-sm" data-testid={`text-on-hand-${item.id}`}>{item.quantityOnHand.toLocaleString()}</span>
        <span className="text-slate-400 text-[11px] ml-1">{item.unitOfMeasure}</span>
      </TableCell>
      <TableCell className="text-center tabular-nums w-28 px-2">
        {draft ? (
          <Input
            type="number" min="0" step="1"
            value={draft.reorderPoint}
            onChange={e => setDraft(d => d ? { ...d, reorderPoint: e.target.value } : d)}
            className="h-7 text-xs w-full text-center"
            data-testid={`input-reorder-point-${item.id}`}
          />
        ) : (
          <button
            type="button"
            onClick={startDraft}
            className="w-full text-center text-sm text-slate-700 hover:text-brand-600 rounded px-1 py-0.5 hover:bg-brand-50 transition-colors"
            data-testid={`text-reorder-point-${item.id}`}
          >
            {item.reorderPoint > 0 ? item.reorderPoint.toLocaleString() : <span className="text-slate-300">—</span>}
          </button>
        )}
      </TableCell>
      <TableCell className="text-center tabular-nums w-28 px-2">
        {draft ? (
          <Input
            type="number" min="0" step="1"
            value={draft.reorderQuantity}
            onChange={e => setDraft(d => d ? { ...d, reorderQuantity: e.target.value } : d)}
            className="h-7 text-xs w-full text-center"
            data-testid={`input-reorder-qty-${item.id}`}
          />
        ) : (
          <button
            type="button"
            onClick={startDraft}
            className="w-full text-center text-sm text-slate-700 hover:text-brand-600 rounded px-1 py-0.5 hover:bg-brand-50 transition-colors"
            data-testid={`text-reorder-qty-${item.id}`}
          >
            {item.reorderQuantity > 0 ? item.reorderQuantity.toLocaleString() : <span className="text-slate-300">—</span>}
          </button>
        )}
      </TableCell>
      <TableCell className="text-center tabular-nums w-28 px-2">
        {draft ? (
          <Input
            type="number" min="0" step="1"
            value={draft.minimumStock}
            onChange={e => setDraft(d => d ? { ...d, minimumStock: e.target.value } : d)}
            className="h-7 text-xs w-full text-center"
            data-testid={`input-min-stock-${item.id}`}
          />
        ) : (
          <button
            type="button"
            onClick={startDraft}
            className="w-full text-center text-sm text-slate-700 hover:text-brand-600 rounded px-1 py-0.5 hover:bg-brand-50 transition-colors"
            data-testid={`text-min-stock-${item.id}`}
          >
            {item.minimumStock > 0 ? item.minimumStock.toLocaleString() : <span className="text-slate-300">—</span>}
          </button>
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        <span className={`text-sm ${item.averagePrice == null ? "text-slate-300" : "text-slate-700"}`} data-testid={`text-average-price-${item.id}`}>
          {formatPrice(item.averagePrice)}
        </span>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        <span className={`text-sm font-medium ${item.bestPrice == null ? "text-slate-300" : "text-slate-800"}`} data-testid={`text-lowest-price-${item.id}`}>
          {formatPrice(item.bestPrice)}
        </span>
      </TableCell>
      <TableCell className="text-center">
        <Badge
          variant={item.pricedSupplierCount === 0 ? "outline" : "secondary"}
          className={item.pricedSupplierCount === 0 ? "text-amber-700 border-amber-300 bg-amber-50" : ""}
          data-testid={`badge-supplier-count-${item.id}`}
        >
          {item.pricedSupplierCount === 0 && <AlertTriangle className="w-3 h-3 mr-1" />}
          {item.supplierCount}
        </Badge>
      </TableCell>
      <TableCell className="w-20 px-1">
        {isEditing && (
          <div className="flex items-center gap-0.5 justify-end">
            {isDirty && (
              <button
                type="button"
                onClick={() => saveMut.mutate()}
                disabled={saveMut.isPending}
                className="p-1.5 rounded text-green-600 hover:bg-green-50 transition-colors disabled:opacity-50"
                data-testid={`button-save-stock-${item.id}`}
                aria-label="Save"
              >
                <Check className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setDraft(null)}
              disabled={saveMut.isPending}
              className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
              data-testid={`button-cancel-stock-${item.id}`}
              aria-label="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </TableCell>
    </TableRow>
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

// ─── Supplier View ───────────────────────────────────────────────────────────

type SvGroup = { catName: string; families: { famName: string; items: SupplierViewRow[] }[] };

function SupplierView({ supplierId, supplierName }: { supplierId: number; supplierName: string }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [edits, setEdits] = useState<Record<number, RowEdit>>({});
  const [svSearch, setSvSearch] = useState("");

  const SS_SV_CATS = `supplierView.openCats.${supplierId}.v1`;
  const SS_SV_FAMS = `supplierView.openFams.${supplierId}.v1`;
  const [openCats, setOpenCats] = useState<Record<string, boolean>>(() => loadSession(SS_SV_CATS, {}));
  const [openFams, setOpenFams] = useState<Record<string, boolean>>(() => loadSession(SS_SV_FAMS, {}));
  useEffect(() => saveSession(SS_SV_CATS, openCats), [openCats]);
  useEffect(() => saveSession(SS_SV_FAMS, openFams), [openFams]);

  const { data, isLoading } = useQuery<SupplierViewData>({
    queryKey: ["/api/admin/stock-pricing/by-supplier", supplierId],
  });

  const rows = data?.items ?? [];
  const isDirty = Object.keys(edits).length > 0;

  const groups = useMemo<SvGroup[]>(() => {
    const catMap = new Map<string, Map<string, SupplierViewRow[]>>();
    for (const row of rows) {
      const catName = row.categoryName ?? t.cmnUnknown;
      const famName = row.familyName ?? row.name;
      if (!catMap.has(catName)) catMap.set(catName, new Map());
      const famMap = catMap.get(catName)!;
      if (!famMap.has(famName)) famMap.set(famName, []);
      famMap.get(famName)!.push(row);
    }
    return Array.from(catMap.entries()).map(([catName, famMap]) => ({
      catName,
      families: Array.from(famMap.entries()).map(([famName, items]) => ({ famName, items })),
    }));
  }, [rows, t.cmnUnknown]);

  const filteredGroups = useMemo<SvGroup[]>(() => {
    const raw = svSearch.trim().toLowerCase();
    if (!raw) return groups;
    const tokens = raw.split(/\s+/).filter(Boolean);
    const matches = (r: SupplierViewRow) => {
      const target = `${r.sku} ${r.name} ${r.sizeLabel ?? ""}`.toLowerCase();
      return tokens.every(tok => target.includes(tok));
    };
    return groups
      .map(g => ({
        ...g,
        families: g.families
          .map(f => ({ ...f, items: f.items.filter(matches) }))
          .filter(f => f.items.length > 0),
      }))
      .filter(g => g.families.length > 0);
  }, [groups, svSearch]);

  useEffect(() => {
    if (!svSearch.trim()) return;
    const co: Record<string, boolean> = {};
    const fo: Record<string, boolean> = {};
    filteredGroups.forEach(g => {
      co[g.catName] = true;
      g.families.forEach(f => { fo[`${g.catName}::${f.famName}`] = true; });
    });
    setOpenCats(prev => ({ ...prev, ...co }));
    setOpenFams(prev => ({ ...prev, ...fo }));
  }, [svSearch, filteredGroups]);

  const toggleSvCatFamilies = (catName: string, families: { famName: string }[], open: boolean) => {
    setOpenFams(prev => {
      const next = { ...prev };
      families.forEach(f => { next[`${catName}::${f.famName}`] = open; });
      return next;
    });
  };

  const getField = useCallback((row: SupplierViewRow, field: keyof RowEdit) => {
    const e = edits[row.itemId];
    if (e !== undefined) return e[field];
    if (field === "lastUnitCost") return row.lastUnitCost != null ? String(row.lastUnitCost) : "";
    if (field === "leadTimeDays") return row.leadTimeDays != null ? String(row.leadTimeDays) : "";
    if (field === "note") return row.note ?? "";
    return "";
  }, [edits]);

  const updateField = useCallback((row: SupplierViewRow, field: keyof RowEdit, value: string) => {
    setEdits(prev => {
      const origCost = row.lastUnitCost != null ? parseFloat(String(row.lastUnitCost)) : null;
      const origNote = (row.note ?? "").trim();
      const origLead = row.leadTimeDays != null ? String(row.leadTimeDays) : "";

      const orig: RowEdit = {
        lastUnitCost: row.lastUnitCost != null ? String(row.lastUnitCost) : "",
        leadTimeDays: origLead,
        note: origNote,
      };
      const current = prev[row.itemId] ?? orig;
      const next: RowEdit = { ...current, [field]: value };

      const nextCostStr = (next.lastUnitCost as string).trim();
      const nextCost = nextCostStr !== "" ? parseFloat(nextCostStr) : null;
      const costSame = origCost === null && nextCost === null
        ? true
        : origCost !== null && nextCost !== null
        ? Math.abs(origCost - nextCost) < 0.00001
        : false;

      const isReverted =
        costSame &&
        (next.note as string).trim() === origNote;

      if (isReverted) {
        const { [row.itemId]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [row.itemId]: next };
    });
  }, []);

  const batchMutation = useMutation({
    mutationFn: async () => {
      const dirtyRows = rows.filter(r => edits[r.itemId] !== undefined);
      if (dirtyRows.length === 0) return;
      const items = dirtyRows.map(r => {
        const e = edits[r.itemId];
        return {
          supplierItemId: r.supplierItemId ?? null,
          itemId: r.itemId,
          supplierSku: r.supplierSku ?? null,
          lastUnitCost: e.lastUnitCost !== "" ? parseFloat(e.lastUnitCost) : null,
          leadTimeDays: e.leadTimeDays !== "" ? parseInt(e.leadTimeDays, 10) : (r.leadTimeDays ?? null),
          preferredSupplier: r.preferredSupplier,
          note: e.note || null,
        };
      });
      await apiRequest("PATCH", `/api/admin/stock-pricing/by-supplier/${supplierId}/batch`, { items });
    },
    onSuccess: () => {
      setEdits({});
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stock-pricing/by-supplier", supplierId] });
      queryClient.invalidateQueries({ queryKey: QK_OVERVIEW });
      toast({ title: t.stockPricingBatchSaved });
    },
    onError: () => toast({ title: t.stockPricingSaveFailed, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="space-y-2 mt-4" data-testid="text-supplier-view-loading">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  const linkedCount = rows.filter(r => r.supplierItemId != null).length;

  return (
    <div className="mt-4 space-y-3" data-testid={`supplier-view-${supplierId}`}>
      {/* Header bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-slate-500">
          <span className="font-semibold text-slate-800">{supplierName}</span>
          <span className="ml-2">·</span>
          <span className="ml-2">{rows.length} {t.stockPricingItemCountSuffix}</span>
          <span className="ml-2">·</span>
          <span className="ml-2 text-brand-600">{linkedCount} {t.stockPricingLinkedCount}</span>
        </div>
        {isDirty && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-amber-600 font-medium" data-testid="text-unsaved-changes">
              {t.stockPricingUnsavedChanges}
            </span>
            <Button size="sm" onClick={() => batchMutation.mutate()} disabled={batchMutation.isPending} data-testid="button-batch-save">
              <Check className="w-3.5 h-3.5 mr-1.5" />
              {batchMutation.isPending ? t.cmnSaving : t.stockPricingBatchSave}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEdits({})} disabled={batchMutation.isPending} data-testid="button-batch-discard">
              <X className="w-3.5 h-3.5 mr-1.5" />
              {t.stockPricingBatchDiscard}
            </Button>
          </div>
        )}
      </div>

      {rows.length === 0 && (
        <div className="text-center py-12 text-slate-400" data-testid="text-supplier-view-no-items">
          {t.stockPricingEmpty}
        </div>
      )}

      {/* Category → Family → Item accordion */}
      {filteredGroups.map(group => {
        const catOpen = openCats[group.catName] ?? false;
        const totalItems = group.families.reduce((s, f) => s + f.items.length, 0);
        const allFamiliesOpen = group.families.length > 0 && group.families.every(
          f => openFams[`${group.catName}::${f.famName}`] ?? false
        );
        return (
          <div key={group.catName} className="bg-white border border-slate-200 rounded-lg overflow-hidden" data-testid={`sv-cat-${group.catName}`}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => setOpenCats(s => ({ ...s, [group.catName]: !s[group.catName] }))}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenCats(s => ({ ...s, [group.catName]: !s[group.catName] })); } }}
              className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors cursor-pointer"
              data-testid={`sv-toggle-cat-${group.catName}`}
            >
              <div className="flex items-center gap-3">
                {catOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                <h2 className="font-semibold text-slate-900 text-base">{group.catName}</h2>
                <Badge variant="secondary" className="text-xs">{totalItems} {t.stockPricingItemCountSuffix}</Badge>
              </div>
              {group.families.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 bg-white text-xs whitespace-nowrap"
                  onClick={e => { e.stopPropagation(); toggleSvCatFamilies(group.catName, group.families, !allFamiliesOpen); }}
                  data-testid={`sv-button-toggle-cat-families-${group.catName}`}
                >
                  {allFamiliesOpen ? (
                    <><ChevronsDownUp className="w-3.5 h-3.5 mr-1.5" />{t.reorderCollapseAll}</>
                  ) : (
                    <><ChevronsUpDown className="w-3.5 h-3.5 mr-1.5" />{t.reorderExpandAll}</>
                  )}
                </Button>
              )}
            </div>

            {catOpen && (
              <div className="px-3 pb-3 space-y-2">
                {group.families.map(fam => {
                  const famKey = `${group.catName}::${fam.famName}`;
                  const famOpen = openFams[famKey] ?? false;
                  const dirtyInFam = fam.items.filter(r => edits[r.itemId] !== undefined).length;
                  return (
                    <div key={famKey} className="border border-slate-200 rounded-md bg-slate-50/40" data-testid={`sv-fam-${famKey}`}>
                      <button
                        type="button"
                        onClick={() => setOpenFams(s => ({ ...s, [famKey]: !s[famKey] }))}
                        className="w-full flex items-center justify-between px-4 py-2 hover:bg-slate-100/70 transition-colors"
                        data-testid={`sv-toggle-fam-${famKey}`}
                      >
                        <div className="flex items-center gap-2">
                          {famOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                          <Package className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-medium text-slate-700 text-sm">{fam.famName}</span>
                          <span className="text-xs text-slate-400">({fam.items.length} {t.stockPricingItemCountSuffix})</span>
                          {dirtyInFam > 0 && (
                            <span className="text-[10px] bg-amber-100 text-amber-700 rounded px-1.5 py-0.5 font-semibold">{dirtyInFam} {t.stockPricingUnsavedChanges}</span>
                          )}
                        </div>
                      </button>
                      {famOpen && (
                        <SvFamilyTable
                          rows={fam.items}
                          edits={edits}
                          getField={getField}
                          updateField={updateField}
                          t={t}
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

      {typeof document !== "undefined" && createPortal(
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-xl pointer-events-none">
          <div
            className="bg-white border border-slate-200 rounded-2xl p-3 shadow-xl pointer-events-auto"
            data-testid="toolbar-supplier-view"
          >
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={svSearch}
                onChange={e => setSvSearch(e.target.value)}
                placeholder={t.stockPricingSearchPlaceholder}
                className="pl-8 h-9"
                data-testid="input-sv-search"
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ─── Supplier View Family Table ───────────────────────────────────────────────

function SvFamilyTable({
  rows, edits, getField, updateField, t,
}: {
  rows: SupplierViewRow[];
  edits: Record<number, RowEdit>;
  getField: (row: SupplierViewRow, field: keyof RowEdit) => string;
  updateField: (row: SupplierViewRow, field: keyof RowEdit, value: string) => void;
  t: Translations;
}) {
  return (
    <div className="overflow-x-auto bg-white">
      <Table style={{ minWidth: "760px" }}>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-b border-slate-200">
            <TableHead className="w-16 pl-2 pr-4">{t.stockPricingColPhoto}</TableHead>
            <TableHead className="text-xs uppercase tracking-wide text-slate-500 whitespace-nowrap w-20">{t.stockPricingColSize}</TableHead>
            <TableHead className="text-xs uppercase tracking-wide text-slate-500 whitespace-nowrap">{t.stockPricingColName}</TableHead>
            <TableHead className="text-xs uppercase tracking-wide text-slate-500 whitespace-nowrap text-right w-28">{t.stockPricingColOnHand}</TableHead>
            <TableHead className="text-xs uppercase tracking-wide text-slate-500 whitespace-nowrap w-44">{t.stockPricingUnitCost}</TableHead>
            <TableHead className="text-xs uppercase tracking-wide text-slate-500 whitespace-nowrap">{t.stockPricingNote}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(row => {
            const dirty = edits[row.itemId] !== undefined;
            const isLinked = row.supplierItemId != null;
            return (
              <TableRow
                key={row.itemId}
                className={`${dirty ? "bg-amber-50/60" : isLinked ? "hover:bg-slate-50" : "bg-slate-50/30 hover:bg-slate-50"} border-b border-slate-100`}
                data-testid={`sv-row-${row.itemId}`}
              >
                <TableCell className="w-16 pl-2 pr-4 align-middle">
                  {row.imageUrl ? (
                    <img src={row.imageUrl} alt="" className="w-8 h-8 rounded object-cover border border-slate-200 bg-slate-50" loading="lazy" data-testid={`sv-img-${row.itemId}`} />
                  ) : (
                    <div className="w-8 h-8 rounded border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-slate-300">
                      <Package className="w-3.5 h-3.5" />
                    </div>
                  )}
                </TableCell>
                <TableCell className="w-20 text-xs text-slate-500 tabular-nums align-middle" data-testid={`sv-size-${row.itemId}`}>
                  {row.sizeLabel || ""}
                </TableCell>
                <TableCell className="align-middle">
                  <div className="flex items-center gap-2">
                    {!isLinked && (
                      <span className="text-[10px] bg-slate-200 text-slate-500 rounded px-1 py-0.5 uppercase font-semibold tracking-wide">{t.stockPricingNewBadge}</span>
                    )}
                    <span className={`text-sm font-medium ${isLinked ? "text-slate-800" : "text-slate-500"}`} data-testid={`sv-name-${row.itemId}`}>
                      {row.name}{row.sizeLabel ? ` — ${row.sizeLabel}` : ""}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums w-28 align-middle">
                  <span className="text-sm text-slate-700" data-testid={`sv-onhand-${row.itemId}`}>{row.quantityOnHand.toLocaleString()}</span>
                  <span className="text-slate-400 text-[11px] ml-1">{row.unitOfMeasure}</span>
                </TableCell>
                <TableCell className="w-44 align-middle">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-slate-500 shrink-0">$</span>
                    <Input
                      type="number" min="0" step="0.01"
                      value={getField(row, "lastUnitCost")}
                      onChange={e => updateField(row, "lastUnitCost", e.target.value)}
                      className="h-7 text-xs flex-1 text-right"
                      placeholder="0.00"
                      data-testid={`input-sv-cost-${row.itemId}`}
                    />
                    <span className="text-[11px] text-slate-400 shrink-0 whitespace-nowrap">/ {row.unitOfMeasure}</span>
                  </div>
                </TableCell>
                <TableCell className="align-middle">
                  <Input
                    value={getField(row, "note")}
                    onChange={e => updateField(row, "note", e.target.value)}
                    className="h-7 text-xs w-full"
                    placeholder={t.stockPricingNotePlaceholder}
                    data-testid={`input-sv-note-${row.itemId}`}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
