import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { ShoppingCart, RefreshCw, CheckCircle, XCircle, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ItemStatusBadge } from "@/components/StatusBadge";
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

// Bucketize last-30-day "issue" transaction count into a 3-tier label.
function classifyUsage(count: number): "high" | "mid" | "none" {
  if (count >= 8) return "high";
  if (count >= 1) return "mid";
  return "none";
}

const DEFAULTS = {
  search: "",
  category: "all",
  status: "all",
  usage: "all",
  needsReorderOnly: true,
};

export default function Reorder() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const qc = useQueryClient();

  const [search, setSearch]                       = useState(DEFAULTS.search);
  const [categoryFilter, setCategoryFilter]       = useState(DEFAULTS.category);
  const [statusFilter, setStatusFilter]           = useState(DEFAULTS.status);
  const [usageFilter, setUsageFilter]             = useState(DEFAULTS.usage);
  const [needsReorderOnly, setNeedsReorderOnly]   = useState(DEFAULTS.needsReorderOnly);

  const resetFilters = () => {
    setSearch(DEFAULTS.search);
    setCategoryFilter(DEFAULTS.category);
    setStatusFilter(DEFAULTS.status);
    setUsageFilter(DEFAULTS.usage);
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
      const resolvedName = (catId != null && categoryMap[catId]) ? categoryMap[catId] : null;
      const key  = resolvedName != null ? String(catId) : "__none__";
      const name = resolvedName ?? t.reorderUncategorized;
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

      // Category filter
      if (categoryFilter !== "all") {
        const catId = item.categoryId;
        const resolvedName = (catId != null && categoryMap[catId]) ? categoryMap[catId] : null;
        const key = resolvedName != null ? String(catId) : "__none__";
        if (key !== categoryFilter) return false;
      }

      // Item stock status filter
      const stockStatus = computeItemStockStatus(item);
      if (statusFilter !== "all" && stockStatus !== statusFilter) return false;

      // Usage frequency filter (high / mid / none, derived from last30dIssueCount)
      if (usageFilter !== "all") {
        const tier = classifyUsage(rec.last30dIssueCount ?? 0);
        if (tier !== usageFilter) return false;
      }

      // "Needs Reorder Only" — hides items whose stock status is "ordered"
      // (already on order, no further action needed).
      if (needsReorderOnly && stockStatus === "ordered") return false;

      // Search: item name, SKU, sizeLabel, category name (case-insensitive).
      if (q) {
        const catId = item.categoryId;
        const catName = (catId != null && categoryMap[catId]) ? categoryMap[catId] : "";
        const hay = [
          item.name ?? "",
          item.sku ?? "",
          item.sizeLabel ?? "",
          catName,
        ].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }, [recommendations, search, categoryFilter, statusFilter, usageFilter, needsReorderOnly, categoryMap]);

  const hasRecommendations = (recommendations?.length ?? 0) > 0;
  const showFilteredEmpty  = hasRecommendations && filtered.length === 0;

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
              <SelectTrigger className="w-[160px] h-9 bg-white text-sm" data-testid="select-category-filter">
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
              <SelectTrigger className="w-[140px] h-9 bg-white text-sm" data-testid="select-status-filter">
                <SelectValue placeholder={t.invStatus} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.invAllStatuses}</SelectItem>
                <SelectItem value="in_stock">{t.invStatusInStock}</SelectItem>
                <SelectItem value="low_stock">{t.invStatusLowStock}</SelectItem>
                <SelectItem value="out_of_stock">{t.invStatusOutOfStock}</SelectItem>
                <SelectItem value="ordered">{t.invStatusOrdered}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={usageFilter} onValueChange={setUsageFilter}>
              <SelectTrigger className="w-[140px] h-9 bg-white text-sm" data-testid="select-usage-filter">
                <SelectValue placeholder={t.reorderColUsage} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.invAllStatuses}</SelectItem>
                <SelectItem value="high">{t.reorderUsageHigh}</SelectItem>
                <SelectItem value="mid">{t.reorderUsageMid}</SelectItem>
                <SelectItem value="none">{t.reorderUsageNone}</SelectItem>
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

        <Table>
          <TableHeader className="bg-slate-50/80">
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-semibold text-slate-600">{t.invStatus}</TableHead>
              <TableHead className="font-semibold text-slate-600 w-12 text-center">{t.reorderColPhoto}</TableHead>
              <TableHead className="font-semibold text-slate-600">{t.reorderColItem}</TableHead>
              <TableHead className="font-semibold text-slate-600 text-right">{t.reorderColOnHand}</TableHead>
              <TableHead className="font-semibold text-slate-600 text-right">{t.reorderColReorderPt}</TableHead>
              <TableHead className="font-semibold text-slate-600 text-right">{t.reorderColOrderQty}</TableHead>
              <TableHead className="font-semibold text-slate-600 text-center">{t.reorderColUsage}</TableHead>
              <TableHead className="font-semibold text-slate-600 text-right">{t.reorderColActions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [1,2,3].map(i => (
                <TableRow key={i}>
                  {[...Array(8)].map((_, j) => (
                    <TableCell key={j}><div className="h-4 bg-slate-100 rounded animate-pulse" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : !hasRecommendations ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-16 text-slate-500">
                  <ShoppingCart className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="font-semibold text-slate-900" data-testid="text-no-recommendations">{t.reorderNoneFound}</p>
                  <p className="text-sm mt-1">{t.reorderAllAboveReorder}</p>
                  <Button variant="outline" className="mt-4" onClick={() => generateMutation.mutate()} data-testid="button-check-now">
                    {t.reorderCheckNow}
                  </Button>
                </TableCell>
              </TableRow>
            ) : showFilteredEmpty ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-16 text-slate-500">
                  <Search className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="font-semibold text-slate-900" data-testid="text-no-match">{t.reorderNoMatch}</p>
                  <Button variant="outline" className="mt-4" onClick={resetFilters} data-testid="button-clear-filters">
                    {t.reorderClearFilters}
                  </Button>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((rec: any) => (
                <TableRow key={rec.id} className="hover:bg-slate-50/50" data-testid={`row-rec-${rec.id}`}>
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
                      <p className="font-medium text-slate-900 hover:text-brand-600">{rec.item?.name}</p>
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
                    {(() => {
                      const n = rec.last30dIssueCount ?? 0;
                      const tier = classifyUsage(n);
                      const cls =
                        tier === "high" ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" :
                        tier === "mid"  ? "bg-slate-100 text-slate-700 ring-1 ring-slate-200" :
                                          "bg-slate-50 text-slate-400 ring-1 ring-slate-200";
                      const label =
                        tier === "high" ? t.reorderUsageHigh :
                        tier === "mid"  ? t.reorderUsageMid  :
                                          t.reorderUsageNone;
                      const tooltip = n === 0
                        ? t.reorderUsageTooltipNone
                        : t.reorderUsageTooltip.replace("{n}", String(n));
                      return (
                        <span
                          title={tooltip}
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}
                          data-testid={`badge-usage-${rec.id}`}
                        >
                          {label}
                        </span>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs text-emerald-600 hover:bg-emerald-50 border-emerald-200"
                        onClick={() => updateStatusMutation.mutate({ id: rec.id, status: 'ordered' })}
                        data-testid={`button-mark-ordered-${rec.id}`}
                      >
                        <CheckCircle className="w-3 h-3 mr-1" />{t.reorderOrderedBtn}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-slate-400 hover:text-rose-500"
                        onClick={() => updateStatusMutation.mutate({ id: rec.id, status: 'dismissed' })}
                        data-testid={`button-dismiss-${rec.id}`}
                      >
                        <XCircle className="w-3 h-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
