import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { ShoppingCart, RefreshCw, CheckCircle, XCircle, Search, Filter, ChevronRight, ChevronDown, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { ItemStatusBadge } from "@/components/StatusBadge";
import { UsagePatternBadge } from "@/components/UsagePatternBadge";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { useLanguage } from "@/hooks/use-language";

async function fetchJson(url: string) {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

// Mirror backend item-status computation (server/storage.ts).
function computeItemStockStatus(item: any): "in_stock" | "low_stock" | "out_of_stock" | "ordered" {
  if (item?.statusOverride === "ORDERED") return "ordered";
  if ((item?.quantityOnHand ?? 0) === 0) return "out_of_stock";
  if ((item?.quantityOnHand ?? 0) <= (item?.minimumStock ?? 0)) return "low_stock";
  return "in_stock";
}

const DEFAULTS = {
  search: "",
  category: "all",
  status: "all",
  usagePattern: "all",
  needsReorderOnly: true,
};

const SS_OPEN_CATS = "reorder.openCats.v1";
const SS_OPEN_FAMS = "reorder.openFamilies.v1";

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

type Rec = any;
type Family = { name: string; items: Rec[] };
type CatGroup = { key: string; id: number | null; name: string; families: Family[] };

export default function Reorder() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const qc = useQueryClient();

  const [search, setSearch]                       = useState(DEFAULTS.search);
  const [categoryFilter, setCategoryFilter]       = useState(DEFAULTS.category);
  const [statusFilter, setStatusFilter]           = useState(DEFAULTS.status);
  const [usagePatternFilter, setUsagePatternFilter] = useState(DEFAULTS.usagePattern);
  const [needsReorderOnly, setNeedsReorderOnly]   = useState(DEFAULTS.needsReorderOnly);
  const [selectedIds, setSelectedIds]             = useState<Set<number>>(new Set());

  const [openCats, setOpenCats] = useState<Record<string, boolean>>(() => loadSession(SS_OPEN_CATS, {}));
  const [openFamilies, setOpenFamilies] = useState<Record<string, boolean>>(() => loadSession(SS_OPEN_FAMS, {}));
  useEffect(() => saveSession(SS_OPEN_CATS, openCats), [openCats]);
  useEffect(() => saveSession(SS_OPEN_FAMS, openFamilies), [openFamilies]);

  const resetFilters = () => {
    setSearch(DEFAULTS.search);
    setCategoryFilter(DEFAULTS.category);
    setStatusFilter(DEFAULTS.status);
    setUsagePatternFilter(DEFAULTS.usagePattern);
    setNeedsReorderOnly(DEFAULTS.needsReorderOnly);
  };

  const { data: recommendations, isLoading } = useQuery({
    queryKey: [api.reorder.recommendations.path],
    queryFn: () => fetchJson(api.reorder.recommendations.path),
  });

  const { data: categories } = useQuery({
    queryKey: ["/api/categories"],
    queryFn: () => fetchJson("/api/categories"),
  });

  // id → name map; only populated once categories arrive
  const categoryMap = useMemo<Record<number, string>>(() => {
    if (!categories) return {};
    return Object.fromEntries((categories as any[]).map((c: any) => [c.id, c.name]));
  }, [categories]);

  const generateMutation = useMutation({
    mutationFn: () => fetch('/api/reorder/generate', { method: 'POST', credentials: 'include' }).then(r => r.json()),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: [api.reorder.recommendations.path] });
      toast({ title: t.reorderGenerated, description: `${data.length} ${data.length !== 1 ? t.reorderItemPlural : t.reorderItemSingular} ${t.reorderNeedAttention}` });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await fetch(`/api/reorder/recommendations/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [api.reorder.recommendations.path] }),
  });

  // Categories that actually appear in current recommendations (deduped, sorted).
  const categoryOptions = useMemo(() => {
    if (!recommendations) return [];
    const seen = new Map<string, string>();
    for (const rec of recommendations as any[]) {
      const catId = rec.item?.categoryId;
      const key  = catId != null ? String(catId) : "__none__";
      const name = catId == null
        ? t.reorderUncategorized
        : (categoryMap[catId] ?? `${t.reorderUncategorized} #${catId}`);
      if (!seen.has(key)) seen.set(key, name);
    }
    return Array.from(seen.entries())
      .sort(([ka, na], [kb, nb]) => {
        if (ka === "__none__") return 1;
        if (kb === "__none__") return -1;
        return na.localeCompare(nb);
      })
      .map(([key, name]) => ({ key, name }));
  }, [recommendations, categoryMap, t]);

  // Single derived filtered list combining search + all filters (AND logic).
  const filtered = useMemo(() => {
    if (!recommendations) return [];
    const q = search.trim().toLowerCase();
    return (recommendations as any[]).filter((rec: any) => {
      const item = rec.item;
      if (!item) return false;

      if (categoryFilter !== "all") {
        const catId = item.categoryId;
        const key = catId != null ? String(catId) : "__none__";
        if (key !== categoryFilter) return false;
      }

      const stockStatus = computeItemStockStatus(item);
      if (statusFilter !== "all" && stockStatus !== statusFilter) return false;

      if (usagePatternFilter !== "all") {
        const c30 = rec.issueCount30d ?? 0;
        const c90 = rec.issueCount90d ?? c30;
        const pattern =
          c30 >= 8 ? "core"   :
          c30 >= 1 ? "normal" :
          c90 >= 1 ? "low"    :
                     "none";
        if (pattern !== usagePatternFilter) return false;
      }

      if (needsReorderOnly && stockStatus === "ordered") return false;

      if (q) {
        const catId = item.categoryId;
        const catName = (catId != null && categoryMap[catId]) ? categoryMap[catId] : "";
        const hay = [
          item.name ?? "",
          item.sku ?? "",
          item.sizeLabel ?? "",
          item.baseItemName ?? "",
          catName,
        ].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [recommendations, search, categoryFilter, statusFilter, usagePatternFilter, needsReorderOnly, categoryMap]);

  // Group filtered recommendations by Category → Family (baseItemName ?? name).
  const grouped = useMemo<CatGroup[]>(() => {
    const cats = new Map<string, { id: number | null; name: string; fams: Map<string, Rec[]> }>();
    for (const rec of filtered) {
      const item = rec.item;
      const catId = item?.categoryId ?? null;
      const key  = catId != null ? String(catId) : "__none__";
      const name = catId == null
        ? t.reorderUncategorized
        : (categoryMap[catId] ?? `${t.reorderUncategorized} #${catId}`);
      let cat = cats.get(key);
      if (!cat) {
        cat = { id: catId, name, fams: new Map() };
        cats.set(key, cat);
      }
      const famName: string = (item?.baseItemName && String(item.baseItemName).trim()) || item?.name || "—";
      let famArr = cat.fams.get(famName);
      if (!famArr) { famArr = []; cat.fams.set(famName, famArr); }
      famArr.push(rec);
    }

    return Array.from(cats.entries())
      .map(([key, c]) => ({
        key,
        id: c.id,
        name: c.name,
        families: Array.from(c.fams.entries())
          .map(([famName, recs]) => ({
            name: famName,
            items: recs.slice().sort((a, b) => {
              const sa = a.item?.sizeSortValue ?? 0;
              const sb = b.item?.sizeSortValue ?? 0;
              if (sa !== sb) return sa - sb;
              return String(a.item?.name ?? "").localeCompare(String(b.item?.name ?? ""));
            }),
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => {
        if (a.key === "__none__") return 1;
        if (b.key === "__none__") return -1;
        return a.name.localeCompare(b.name);
      });
  }, [filtered, categoryMap, t]);

  // Auto-expand all categories/families when an active search/filter is in use.
  const filtersActive =
    !!search.trim() ||
    statusFilter !== DEFAULTS.status ||
    usagePatternFilter !== DEFAULTS.usagePattern ||
    categoryFilter !== DEFAULTS.category ||
    needsReorderOnly !== DEFAULTS.needsReorderOnly;
  useEffect(() => {
    if (!filtersActive) return;
    const co: Record<string, boolean> = {};
    const fo: Record<string, boolean> = {};
    grouped.forEach(c => {
      co[c.key] = true;
      c.families.forEach(f => { fo[`${c.key}::${f.name}`] = true; });
    });
    setOpenCats(prev => ({ ...prev, ...co }));
    setOpenFamilies(prev => ({ ...prev, ...fo }));
  }, [filtersActive, grouped]);

  const toggleCat = (key: string) => setOpenCats(s => ({ ...s, [key]: !s[key] }));
  const toggleFam = (key: string) => setOpenFamilies(s => ({ ...s, [key]: !s[key] }));

  const hasRecommendations = (recommendations?.length ?? 0) > 0;
  const showFilteredEmpty  = hasRecommendations && filtered.length === 0;

  // Global select-all across every currently visible (filtered) row,
  // independent of which categories/families are expanded.
  const filteredIds = useMemo(() => filtered.map((r: any) => r.id), [filtered]);
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.has(id));
  const someFilteredSelected = !allFilteredSelected && filteredIds.some(id => selectedIds.has(id));
  const toggleAllFiltered = (on: boolean) => setSelectedIds(prev => {
    const n = new Set(prev);
    filteredIds.forEach(id => { if (on) n.add(id); else n.delete(id); });
    return n;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">{t.reorderTitle}</h1>
          <p className="text-slate-500 mt-1">{t.reorderSubtitle}</p>
        </div>
        <Button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="bg-brand-700 hover:bg-brand-800 text-white shadow-sm whitespace-nowrap shrink-0"
          data-testid="button-refresh-recommendations"
        >
          <RefreshCw className={`w-4 h-4 mr-2 flex-shrink-0 ${generateMutation.isPending ? 'animate-spin' : ''}`} />
          {t.reorderRefresh}
        </Button>
      </div>

      <div className="premium-card bg-white overflow-hidden">
        {/* Search + filter toolbar */}
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60 flex flex-col lg:flex-row gap-3 lg:items-center">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-600 shrink-0">
            <Filter className="w-4 h-4 text-slate-400" />
            <span>{t.invFilterItems}</span>
          </div>
          <div className="flex flex-wrap gap-2 flex-1 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input
                placeholder={t.reorderSearchPlaceholder}
                className="pl-8 h-9 bg-white border-slate-200 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-search"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="min-w-[160px] w-auto h-9 bg-white text-sm" data-testid="select-category-filter">
                <SelectValue placeholder={t.invCategory} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.invAllCategories}</SelectItem>
                {categoryOptions.map(c => (
                  <SelectItem key={c.key} value={c.key}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="min-w-[140px] w-auto h-9 bg-white text-sm" data-testid="select-status-filter">
                <SelectValue placeholder={t.invStatus} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.invAllStatuses}</SelectItem>
                <SelectItem value="in_stock">
                  <span className="inline-flex items-center"><span className="inline-block w-1.5 h-1.5 rounded-full mr-2 bg-emerald-500" aria-hidden="true" />{t.invStatusInStock}</span>
                </SelectItem>
                <SelectItem value="low_stock">
                  <span className="inline-flex items-center"><span className="inline-block w-1.5 h-1.5 rounded-full mr-2 bg-amber-500" aria-hidden="true" />{t.invStatusLowStock}</span>
                </SelectItem>
                <SelectItem value="out_of_stock">
                  <span className="inline-flex items-center"><span className="inline-block w-1.5 h-1.5 rounded-full mr-2 bg-rose-500" aria-hidden="true" />{t.invStatusOutOfStock}</span>
                </SelectItem>
                <SelectItem value="ordered">
                  <span className="inline-flex items-center"><span className="inline-block w-1.5 h-1.5 rounded-full mr-2 bg-sky-500" aria-hidden="true" />{t.invStatusOrdered}</span>
                </SelectItem>
              </SelectContent>
            </Select>
            <Select value={usagePatternFilter} onValueChange={setUsagePatternFilter}>
              <SelectTrigger className="min-w-[160px] w-auto h-9 bg-white text-sm" data-testid="select-usage-pattern-filter">
                <SelectValue placeholder={t.reorderColUsagePattern} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.reorderUsagePatternAll}</SelectItem>
                <SelectItem value="core">
                  <span className="inline-flex items-center"><span className="inline-block w-1.5 h-1.5 rounded-full mr-2 bg-emerald-500" aria-hidden="true" />{t.reorderUsagePatternCore}</span>
                </SelectItem>
                <SelectItem value="normal">
                  <span className="inline-flex items-center"><span className="inline-block w-1.5 h-1.5 rounded-full mr-2 bg-sky-500" aria-hidden="true" />{t.reorderUsagePatternNormal}</span>
                </SelectItem>
                <SelectItem value="low">
                  <span className="inline-flex items-center"><span className="inline-block w-1.5 h-1.5 rounded-full mr-2 bg-amber-500" aria-hidden="true" />{t.reorderUsagePatternLow}</span>
                </SelectItem>
                <SelectItem value="none">
                  <span className="inline-flex items-center"><span className="inline-block w-1.5 h-1.5 rounded-full mr-2 bg-slate-300" aria-hidden="true" />{t.reorderUsagePatternNone}</span>
                </SelectItem>
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 px-3 h-9 rounded-md border border-slate-200 bg-white text-sm text-slate-700 cursor-pointer select-none whitespace-nowrap">
              <Switch
                checked={needsReorderOnly}
                onCheckedChange={setNeedsReorderOnly}
                data-testid="switch-needs-reorder-only"
              />
              <span>{t.reorderNeedsReorderOnly}</span>
            </label>
          </div>
        </div>

        {/* Loading / empty states */}
        {isLoading ? (
          <div className="p-6 space-y-3" data-testid="text-loading">
            {[0, 1, 2].map(i => (
              <div key={i} className="border border-slate-200 rounded-lg p-4 animate-pulse">
                <div className="h-4 w-48 bg-slate-200 rounded mb-3" />
                <div className="space-y-2">
                  <div className="h-3 w-full bg-slate-100 rounded" />
                  <div className="h-3 w-5/6 bg-slate-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : !hasRecommendations ? (
          <div className="text-center py-16 text-slate-500">
            <ShoppingCart className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="font-semibold text-slate-900" data-testid="text-no-recommendations">{t.reorderNoneFound}</p>
            <p className="text-sm mt-1">{t.reorderAllAboveReorder}</p>
            <Button variant="outline" className="mt-4" onClick={() => generateMutation.mutate()} data-testid="button-check-now">
              {t.reorderCheckNow}
            </Button>
          </div>
        ) : showFilteredEmpty ? (
          <div className="text-center py-16 text-slate-500">
            <Search className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="font-semibold text-slate-900" data-testid="text-no-match">{t.reorderNoMatch}</p>
            <Button variant="outline" className="mt-4" onClick={resetFilters} data-testid="button-clear-filters">
              {t.reorderClearFilters}
            </Button>
          </div>
        ) : (
          <div className="p-3 space-y-3">
            <div className="flex items-center gap-3 px-3 py-2 bg-slate-50/80 border border-slate-200 rounded-md">
              <Checkbox
                className="h-4 w-4"
                aria-label="select all visible"
                checked={allFilteredSelected ? true : someFilteredSelected ? "indeterminate" : false}
                onCheckedChange={(v) => toggleAllFiltered(v === true)}
                data-testid="checkbox-select-all-visible"
              />
              <span className="text-sm text-slate-600">
                {selectedIds.size > 0
                  ? `${Array.from(selectedIds).filter(id => filteredIds.includes(id)).length} / ${filteredIds.length}`
                  : `${filteredIds.length}`}{" "}
                {t.stockPricingItemCountSuffix}
              </span>
            </div>
            {grouped.map(cat => {
              const catOpen = openCats[cat.key] ?? false;
              const totalItems = cat.families.reduce((s, f) => s + f.items.length, 0);
              return (
                <div key={cat.key} className="bg-white border border-slate-200 rounded-lg overflow-hidden" data-testid={`cat-${cat.key}`}>
                  <button
                    type="button"
                    onClick={() => toggleCat(cat.key)}
                    className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors"
                    data-testid={`button-toggle-cat-${cat.key}`}
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
                        const famKey = `${cat.key}::${fam.name}`;
                        const famOpen = openFamilies[famKey] ?? false;
                        return (
                          <div key={famKey} className="border border-slate-200 rounded-md bg-slate-50/40" data-testid={`fam-${cat.key}-${fam.name}`}>
                            <button
                              type="button"
                              onClick={() => toggleFam(famKey)}
                              className="w-full flex items-center justify-between px-4 py-2 hover:bg-slate-100/70 transition-colors"
                              data-testid={`button-toggle-fam-${cat.key}-${fam.name}`}
                            >
                              <div className="flex items-center gap-2">
                                {famOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                                <Package className="w-3.5 h-3.5 text-slate-400" />
                                <span className="font-medium text-slate-700 text-sm">{fam.name}</span>
                                <span className="text-xs text-slate-400">
                                  ({fam.items.length} {t.stockPricingItemCountSuffix})
                                </span>
                              </div>
                            </button>
                            {famOpen && (
                              <FamilyTable
                                items={fam.items}
                                selectedIds={selectedIds}
                                onToggleOne={(id, on) => setSelectedIds(prev => {
                                  const n = new Set(prev);
                                  if (on) n.add(id); else n.delete(id);
                                  return n;
                                })}
                                onToggleAll={(on) => setSelectedIds(prev => {
                                  const n = new Set(prev);
                                  fam.items.forEach((r: any) => { if (on) n.add(r.id); else n.delete(r.id); });
                                  return n;
                                })}
                                onMarkOrdered={(id) => updateStatusMutation.mutate({ id, status: 'ordered' })}
                                onDismiss={(id) => updateStatusMutation.mutate({ id, status: 'dismissed' })}
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
        )}
      </div>
    </div>
  );
}

// ─── Per-family Table ────────────────────────────────────────────────────────

function FamilyTable({
  items, selectedIds, onToggleOne, onToggleAll, onMarkOrdered, onDismiss,
}: {
  items: any[];
  selectedIds: Set<number>;
  onToggleOne: (id: number, on: boolean) => void;
  onToggleAll: (on: boolean) => void;
  onMarkOrdered: (id: number) => void;
  onDismiss: (id: number) => void;
}) {
  const { t } = useLanguage();
  const allSelected = items.length > 0 && items.every(r => selectedIds.has(r.id));
  const someSelected = !allSelected && items.some(r => selectedIds.has(r.id));

  return (
    <div className="overflow-x-auto bg-white border-t border-slate-200">
      <Table>
        <TableHeader className="bg-slate-50/80">
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-8 px-2">
              <Checkbox
                className="h-4 w-4"
                aria-label="select all"
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                onCheckedChange={(v) => onToggleAll(v === true)}
                disabled={items.length === 0}
              />
            </TableHead>
            <TableHead className="font-semibold text-slate-600 whitespace-nowrap">{t.invStatus}</TableHead>
            <TableHead className="font-semibold text-slate-600 w-12 text-center whitespace-nowrap">{t.reorderColPhoto}</TableHead>
            <TableHead className="font-semibold text-slate-600 whitespace-nowrap">{t.reorderColItem}</TableHead>
            <TableHead className="font-semibold text-slate-600 text-right whitespace-nowrap">{t.reorderColOnHand}</TableHead>
            <TableHead className="font-semibold text-slate-600 text-right whitespace-nowrap">{t.reorderColReorderPt}</TableHead>
            <TableHead className="font-semibold text-slate-600 text-right whitespace-nowrap">{t.reorderColOrderQty}</TableHead>
            <TableHead className="font-semibold text-slate-600 text-center w-[112px] whitespace-nowrap">{t.reorderColUsagePattern}</TableHead>
            <TableHead className="font-semibold text-slate-600 text-right whitespace-nowrap">{t.reorderColActions}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((rec: any) => (
            <TableRow key={rec.id} className="hover:bg-slate-50/50" data-testid={`row-rec-${rec.id}`}>
              <TableCell className="w-8 px-2">
                <Checkbox
                  className="h-4 w-4"
                  aria-label="select row"
                  data-testid={`checkbox-rec-${rec.id}`}
                  checked={selectedIds.has(rec.id)}
                  onCheckedChange={(v) => onToggleOne(rec.id, v === true)}
                />
              </TableCell>
              <TableCell><ItemStatusBadge status={computeItemStockStatus(rec.item)} /></TableCell>
              <TableCell className="py-2 pr-0">
                {rec.item?.imageUrl ? (
                  <img
                    src={rec.item.imageUrl}
                    alt=""
                    className="w-8 h-8 rounded object-cover bg-slate-100 flex-shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded bg-slate-100 flex-shrink-0" />
                )}
              </TableCell>
              <TableCell>
                <Link href={`/inventory/${rec.item?.id}`}>
                  <p className="font-medium text-slate-900 hover:text-brand-600">
                    {rec.item?.name}
                  </p>
                  {rec.item?.sizeLabel && (
                    <p className="text-xs text-slate-400">{rec.item.sizeLabel}</p>
                  )}
                </Link>
              </TableCell>
              <TableCell className="text-right">
                <span className={rec.item?.quantityOnHand === 0 ? 'text-rose-600 font-bold' : 'text-amber-600 font-semibold'}>
                  {rec.item?.quantityOnHand}
                </span>
                <span className="text-slate-400 text-xs ml-1">{rec.item?.unitOfMeasure}</span>
              </TableCell>
              <TableCell className="text-right text-slate-600">{rec.item?.reorderPoint}</TableCell>
              <TableCell className="text-right font-semibold text-brand-700">{rec.recommendedQuantity}</TableCell>
              <TableCell className="text-center">
                <UsagePatternBadge
                  issueCount30d={rec.issueCount30d ?? 0}
                  issueCount90d={rec.issueCount90d ?? rec.issueCount30d ?? 0}
                  lastIssueAt={rec.lastIssueAt}
                  testId={`chip-usage-pattern-${rec.id}`}
                />
              </TableCell>
              <TableCell>
                <div className="flex gap-1 justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs text-emerald-600 hover:bg-emerald-50 border-emerald-200"
                    onClick={() => onMarkOrdered(rec.id)}
                    data-testid={`button-mark-ordered-${rec.id}`}
                  >
                    <CheckCircle className="w-3 h-3 mr-1" />{t.reorderOrderedBtn}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs text-slate-400 hover:text-rose-500"
                    onClick={() => onDismiss(rec.id)}
                    data-testid={`button-dismiss-${rec.id}`}
                  >
                    <XCircle className="w-3 h-3" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
