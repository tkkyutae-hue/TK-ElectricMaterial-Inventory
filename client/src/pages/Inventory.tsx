import { useState } from "react";
import { useItems } from "@/hooks/use-items";
import { useQuery } from "@tanstack/react-query";
import { useCategories } from "@/hooks/use-reference-data";
import { ItemStatusBadge } from "@/components/StatusBadge";
import { UsageBadge, classifyUsage } from "@/components/UsageBadge";
import { Search, Filter, AlertTriangle, XCircle, Package, ChevronLeft, ChevronRight, FileDown, ChevronsUpDown, ChevronUp, ChevronDown, Rows3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { getCategoryGradient } from "@/lib/categoryUtils";
import { PageHeader } from "@/components/shared/PageHeader";
import { useLanguage } from "@/hooks/use-language";

type CategorySummary = {
  id: number;
  name: string;
  code?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  skuCount: number;
  totalQuantity: number;
  lowStockCount: number;
  outOfStockCount: number;
};

function CategoryCard({ cat }: { cat: CategorySummary }) {
  const { t } = useLanguage();
  const gradient = getCategoryGradient(cat.code);
  const [imgError, setImgError] = useState(false);
  const showImage = !!cat.imageUrl && !imgError;

  return (
    <Link href={`/inventory/category/${cat.id}`}>
      <div
        className="relative rounded-xl overflow-hidden cursor-pointer group border border-slate-200/80 shadow-sm hover:shadow-lg hover:border-slate-300 transition-all duration-200 hover:-translate-y-0.5"
        data-testid={`card-category-${cat.id}`}
      >
        <div className="relative h-28 overflow-hidden bg-[#16202e]">
          {/* Blurred ambient fill — hides letterbox bars */}
          {showImage && (
            <img
              src={cat.imageUrl!}
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover scale-125 blur-2xl opacity-80 brightness-75 saturate-200 pointer-events-none"
            />
          )}
          {/* Primary sharp image */}
          {showImage && (
            <img
              src={cat.imageUrl!}
              alt={cat.name}
              className="absolute inset-0 w-full h-full object-contain object-center z-10 group-hover:scale-[1.04] transition-transform duration-500 ease-out"
              onError={() => setImgError(true)}
            />
          )}
          <div className={`absolute inset-0 bg-gradient-to-br ${gradient} ${showImage ? "hidden" : ""}`} />
          {/* Gradient for text legibility */}
          <div className="absolute inset-0 z-20 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
          {/* Bottom text */}
          <div className="absolute bottom-0 left-0 right-0 z-30 px-3 pb-3 pt-6">
            <p className="text-white font-semibold text-sm leading-snug" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.7)" }}>{cat.name}</p>
            {cat.code && (
              <p className="text-white/55 text-[10px] font-medium tracking-widest uppercase mt-0.5">{cat.code}</p>
            )}
          </div>
        </div>
        {/* Stock status strip */}
        <div className="flex items-center justify-between px-3 py-2 bg-white border-t border-slate-100">
          <span className="text-[11px] text-slate-500">{cat.skuCount} {t.invSkusSuffix}</span>
          <div className="flex items-center gap-1">
            {cat.outOfStockCount > 0 && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 leading-none">
                {cat.outOfStockCount} {t.invOutBadge}
              </span>
            )}
            {cat.lowStockCount > 0 && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 leading-none">
                {cat.lowStockCount} {t.invLowBadge}
              </span>
            )}
            {cat.outOfStockCount === 0 && cat.lowStockCount === 0 && (
              <span className="text-[11px] text-slate-500">{cat.totalQuantity.toLocaleString()} {t.invUnitsSuffix}</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

const PAGE_SIZE_OPTIONS = [5, 10, 15];

type SortKey = "name" | "sku" | "quantityOnHand" | "status";
type SortDir = "asc" | "desc";

function SortableHeader({
  label,
  sortKey,
  active,
  dir,
  align = "left",
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  active: boolean;
  dir: SortDir;
  align?: "left" | "right" | "center";
  onSort: (key: SortKey) => void;
}) {
  const Icon = active ? (dir === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown;
  return (
    <th
      className={`px-3 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wide align-middle whitespace-nowrap ${align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left"}`}
    >
      <button
        className={`inline-flex items-center gap-0.5 hover:text-slate-700 transition-colors ${active ? "text-slate-700" : ""}`}
        onClick={() => onSort(sortKey)}
        data-testid={`sort-${sortKey}`}
      >
        {label}
        <Icon className="w-3 h-3 flex-shrink-0" />
      </button>
    </th>
  );
}

export default function Inventory() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [usageFilter, setUsageFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [exporting, setExporting] = useState(false);
  const [previewItem, setPreviewItem] = useState<any>(null);

  const { isAdminRole } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [, navigate] = useLocation();

  async function handleExportXlsx() {
    setExporting(true);
    toast({
      title: t.invPreparingExcel,
      description: t.invSavedToDownloads,
    });
    try {
      // Step 1: Validate the endpoint returns a real xlsx (preflight fetch)
      const resp = await fetch("/api/admin/export/inventory-xlsx", { credentials: "include" });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ message: `${t.invServerError} ${resp.status}` }));
        throw new Error(err.message);
      }

      const contentType = resp.headers.get("content-type") ?? "";
      if (!contentType.includes("spreadsheetml") && !contentType.includes("octet-stream")) {
        throw new Error(`${t.invUnexpectedResponse}: ${contentType || "unknown"}`);
      }

      // Read filename from server Content-Disposition header
      const disposition = resp.headers.get("content-disposition") ?? "";
      const fnMatch = disposition.match(/filename="([^"]+)"/);
      const now = new Date();
      const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const filename = fnMatch?.[1] ?? `GA WAREHOUSE MATERIAL STATUS-${ym}(1).xlsx`;

      const blob = await resp.blob();
      if (blob.size < 1024) {
        throw new Error("Export returned an empty or invalid file.");
      }

      // Step 2: Trigger download via blob URL.
      // If embedded in a same-origin iframe (Replit preview), use the top-level
      // document so the browser's download mechanism fires correctly.
      // Falls back to the current document when cross-origin (production).
      const blobUrl = URL.createObjectURL(blob);

      let targetDoc: Document;
      try {
        targetDoc = (window.top ?? window).document;
      } catch {
        targetDoc = document;
      }

      const a = targetDoc.createElement("a");
      a.style.display = "none";
      a.href = blobUrl;
      a.download = filename;
      targetDoc.body.appendChild(a);
      a.click();

      setTimeout(() => {
        targetDoc.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }, 2000);

      toast({
        title: t.invExportComplete,
        description: `${filename} ${t.invExportSavedSuffix}`,
      });
    } catch (err: any) {
      toast({ title: t.invExportFailed, description: err.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }

  const { data: pagedData, isLoading } = useItems({
    search: search || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    categoryId: categoryFilter !== "all" ? categoryFilter : undefined,
    usage: usageFilter !== "all" ? (usageFilter as "high" | "mid" | "none") : undefined,
    page,
    perPage: pageSize,
    sort: sortKey,
    dir: sortDir,
  });

  const pageItems: any[] = (pagedData as any)?.items ?? [];
  const totalItems: number = (pagedData as any)?.total ?? 0;

  const { data: categories } = useCategories();

  const { data: categorySummary } = useQuery<CategorySummary[]>({
    queryKey: ["/api/inventory/categories/summary"],
  });

  const totalLowStock = categorySummary?.reduce((s, c) => s + c.lowStockCount, 0) ?? 0;
  const totalOutOfStock = categorySummary?.reduce((s, c) => s + c.outOfStockCount, 0) ?? 0;

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);

  function handleFilterChange(setter: (v: string) => void) {
    return (v: string) => { setter(v); setPage(1); };
  }

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  }

  const startItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItem = Math.min(safePage * pageSize, totalItems);

  return (
    <div className="space-y-6">
      <PageHeader size="lg" title={t.invTitle} subtitle={t.invSubtitle} className="flex-col sm:flex-row sm:items-center">
        {isAdminRole && (
          <Button
            onClick={handleExportXlsx}
            disabled={exporting}
            variant="outline"
            className="gap-2 border-slate-300 text-slate-700 hover:bg-slate-50 shrink-0 whitespace-nowrap"
            data-testid="btn-export-inventory-xlsx"
          >
            <FileDown className="w-4 h-4 flex-shrink-0" />
            {exporting ? t.invExportGenerating : t.invExportToExcel}
          </Button>
        )}
      </PageHeader>

      {/* Alert banner for stock issues */}
      {(totalOutOfStock > 0 || totalLowStock > 0) && (
        <div className="flex flex-wrap gap-3">
          {totalOutOfStock > 0 && (
            <Link href="/reorder">
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2.5 text-sm font-medium cursor-pointer hover:bg-red-100 transition-colors break-words">
                <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{totalOutOfStock} {totalOutOfStock > 1 ? t.invItemsPlural : t.invItemSingular} {t.invItemsOutBanner}</span>
              </div>
            </Link>
          )}
          {totalLowStock > 0 && (
            <Link href="/reorder">
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-4 py-2.5 text-sm font-medium cursor-pointer hover:bg-amber-100 transition-colors break-words">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{totalLowStock} {totalLowStock > 1 ? t.invItemsPlural : t.invItemSingular} {t.invItemsLowBanner}</span>
              </div>
            </Link>
          )}
        </div>
      )}

      {/* Category card grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-slate-700">{t.invBrowseByCategory}</h2>
          <span className="text-sm text-slate-400">{categorySummary?.length ?? 0} {t.invCategoriesCount}</span>
        </div>
        {!categorySummary ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {[1,2,3,4,5,6,7,8,9].map(i => (
              <div key={i} className="rounded-xl overflow-hidden border border-slate-200">
                <div className="h-36 bg-slate-100 animate-pulse" />
                <div className="bg-white p-3 h-12 animate-pulse" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {categorySummary.map(cat => <CategoryCard key={cat.id} cat={cat} />)}
          </div>
        )}
      </div>

      {/* Inventory table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3 bg-slate-50/60">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
            <Filter className="w-4 h-4 text-slate-400" />
            <span>{t.invFilterItems}</span>
          </div>
          <div className="flex flex-wrap gap-2 flex-1">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input
                placeholder={t.invSearchPlaceholder}
                className="pl-8 h-9 bg-white border-slate-200 text-sm"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                data-testid="input-search"
              />
            </div>
            <Select value={categoryFilter} onValueChange={handleFilterChange(setCategoryFilter)}>
              <SelectTrigger className="min-w-[160px] w-auto h-9 bg-white text-sm" data-testid="select-category-filter">
                <SelectValue placeholder={t.invCategory} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.invAllCategories}</SelectItem>
                {categories?.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={handleFilterChange(setStatusFilter)}>
              <SelectTrigger className="min-w-[140px] w-auto h-9 bg-white text-sm" data-testid="select-status-filter">
                <SelectValue placeholder={t.invStatus} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.invAllStatuses}</SelectItem>
                <SelectItem value="in_stock">{t.invInStockOpt}</SelectItem>
                <SelectItem value="low_stock">{t.invLowStockOpt}</SelectItem>
                <SelectItem value="out_of_stock">{t.invOutOfStockOpt}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={usageFilter} onValueChange={handleFilterChange(setUsageFilter)}>
              <SelectTrigger className="min-w-[140px] w-auto h-9 bg-white text-sm" data-testid="select-usage-filter">
                <SelectValue placeholder={t.reorderColUsage} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.reorderAllUsage}</SelectItem>
                <SelectItem value="high">
                  <span className="inline-flex items-center"><span className="inline-block w-1.5 h-1.5 rounded-full mr-2 bg-emerald-500" aria-hidden="true" />{t.reorderUsageHigh}</span>
                </SelectItem>
                <SelectItem value="mid">
                  <span className="inline-flex items-center"><span className="inline-block w-1.5 h-1.5 rounded-full mr-2 bg-slate-400" aria-hidden="true" />{t.reorderUsageMid}</span>
                </SelectItem>
                <SelectItem value="none">
                  <span className="inline-flex items-center"><span className="inline-block w-1.5 h-1.5 rounded-full mr-2 bg-slate-300" aria-hidden="true" />{t.reorderUsageNone}</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ tableLayout: "fixed", minWidth: 1000 }}>
            <colgroup>
              <col style={{ width: "120px" }} /> {/* SKU */}
              <col style={{ width: "52px" }} />  {/* Photo */}
              <col style={{ width: "80px" }} />  {/* Size */}
              <col />                             {/* Item — widest */}
              <col style={{ width: "140px" }} /> {/* Category */}
              <col style={{ width: "110px" }} /> {/* Qty/Unit */}
              <col style={{ width: "100px" }} /> {/* Usage */}
              <col style={{ width: "110px" }} /> {/* Status */}
              <col style={{ width: "32px" }} />  {/* Row affordance */}
            </colgroup>
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100">
                <SortableHeader label="SKU"      sortKey="sku"            active={sortKey === "sku"}           dir={sortDir} onSort={handleSort} />
                <th className="px-3 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wide align-middle whitespace-nowrap text-left">{t.invPhotoCol}</th>
                <th className="px-3 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wide align-middle whitespace-nowrap text-left">{t.invSizeCol}</th>
                <SortableHeader label={t.invItemCol}     sortKey="name"           active={sortKey === "name"}          dir={sortDir} onSort={handleSort} />
                <th className="px-3 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wide align-middle whitespace-nowrap text-left">{t.invCategoryCol}</th>
                <SortableHeader label={t.invQtyUnitCol} sortKey="quantityOnHand" active={sortKey === "quantityOnHand"} dir={sortDir} onSort={handleSort} align="right" />
                <th className="px-3 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wide align-middle whitespace-nowrap text-center">{t.reorderColUsage}</th>
                <SortableHeader label={t.invStatusCol}   sortKey="status"         active={sortKey === "status"}        dir={sortDir} onSort={handleSort} align="center" />
                <th aria-hidden />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 7 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    {[1,2,3,4,5,6,7,8,9].map(j => (
                      <td key={j} className="px-3 py-3 align-middle">
                        <div className="h-4 bg-slate-100 animate-pulse rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-16 text-slate-500">
                    <Package className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                    <p className="text-base font-semibold text-slate-900">{t.invNoItemsFound}</p>
                    <p className="text-sm mt-1">{t.invTryAdjustingFilters}</p>
                  </td>
                </tr>
              ) : (
                pageItems.map((item) => (
                  <tr
                    key={`${item.id}-${item.quantityOnHand}`}
                    className={`group border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors cursor-pointer ${item.status === "out_of_stock" ? "bg-red-50/20" : item.status === "low_stock" ? "bg-amber-50/20" : ""}`}
                    data-testid={`row-item-${item.id}`}
                    onClick={() => setPreviewItem(item)}
                  >
                    {/* SKU */}
                    <td className="px-3 py-3 align-middle">
                      <span className="font-mono text-[11px] text-slate-500 whitespace-nowrap">{item.sku}</span>
                    </td>
                    {/* Photo */}
                    <td className="px-3 py-3 align-middle">
                      <div className="w-9 h-9 rounded-md overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-4 h-4 text-slate-300" />
                        )}
                      </div>
                    </td>
                    {/* Size */}
                    <td className="px-3 py-3 align-middle">
                      <span className="text-xs font-medium text-slate-700 whitespace-nowrap">{(item as any).sizeLabel || "—"}</span>
                    </td>
                    {/* Item */}
                    <td className="px-3 py-3 align-middle" onClick={e => e.stopPropagation()}>
                      <Link
                        href={`/inventory/${item.id}`}
                        className="text-sm font-semibold text-slate-900 hover:text-brand-600 hover:underline transition-colors leading-snug"
                        data-testid={`link-item-name-${item.id}`}
                      >
                        {item.name}
                      </Link>
                    </td>
                    {/* Category */}
                    <td className="px-3 py-3 align-middle">
                      <span className="text-xs text-slate-500 leading-snug">{item.category?.name || "—"}</span>
                    </td>
                    {/* Qty / Unit */}
                    <td className="px-3 py-3 align-middle text-right whitespace-nowrap">
                      <span className="font-semibold text-sm text-slate-900 tabular-nums">{item.quantityOnHand.toLocaleString()}</span>
                      <span className="ml-1 text-xs font-normal text-slate-400">{item.unitOfMeasure}</span>
                    </td>
                    {/* Usage */}
                    <td className="px-3 py-3 align-middle">
                      <div className="flex items-center justify-center">
                        <UsageBadge
                          tier={classifyUsage(item.last30dIssueCount ?? 0)}
                          count={item.last30dIssueCount ?? 0}
                          testId={`badge-usage-${item.id}`}
                        />
                      </div>
                    </td>
                    {/* Status */}
                    <td className="px-3 py-3 align-middle">
                      <div className="flex items-center justify-center">
                        <ItemStatusBadge status={item.status} />
                      </div>
                    </td>
                    {/* Row affordance */}
                    <td className="pr-2 align-middle" aria-hidden>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer: count (left) + [page-size · pagination] inline group (right). Select sits to the left of the pagination buttons on the same line. */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/40 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="text-xs text-slate-400">
            {totalItems === 0 ? t.invNoItemsLabel : `${t.invShowing} ${startItem}–${endItem} ${t.invOf} ${totalItems} ${totalItems !== 1 ? t.invItemsSuffix : t.invItemSingular}`}
          </p>
          <div className="flex items-center gap-2 ml-auto">
            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
              <SelectTrigger
                className="w-auto h-7 px-2 gap-1 bg-white text-xs [&>svg:last-child]:hidden"
                data-testid="select-page-size"
                aria-label={t.invPerPageSuffix}
                title={`${pageSize} ${t.invPerPageSuffix}`}
              >
                <Rows3 className="w-3.5 h-3.5 text-slate-500" />
                <span className="tabular-nums font-medium">{pageSize}</span>
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map(n => (
                  <SelectItem key={n} value={String(n)}>{n} {t.invPerPageSuffix}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {totalPages > 1 && (
            <div className="flex items-center gap-1 flex-wrap justify-end">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                data-testid="button-prev-page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                {t.invPrevBtn}
              </Button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 7) {
                  pageNum = i + 1;
                } else if (safePage <= 4) {
                  pageNum = i + 1;
                  if (i === 6) pageNum = totalPages;
                } else if (safePage >= totalPages - 3) {
                  pageNum = totalPages - 6 + i;
                } else {
                  const mid = [safePage - 2, safePage - 1, safePage, safePage + 1, safePage + 2];
                  const pages = [1, ...mid, totalPages];
                  pageNum = pages[i];
                }
                return (
                  <Button
                    key={pageNum}
                    variant={safePage === pageNum ? "default" : "outline"}
                    size="sm"
                    className={`h-7 w-7 p-0 text-xs ${safePage === pageNum ? "bg-brand-700 hover:bg-brand-800 text-white" : ""}`}
                    onClick={() => setPage(pageNum)}
                    data-testid={`button-page-${pageNum}`}
                  >
                    {pageNum}
                  </Button>
                );
              })}
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                data-testid="button-next-page"
              >
                {t.invNextBtn}
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Quick View Drawer ── */}
      <Sheet open={!!previewItem} onOpenChange={open => { if (!open) setPreviewItem(null); }}>
        <SheetContent
          side="right"
          className="w-full sm:w-[400px] p-0 flex flex-col gap-0 overflow-y-auto"
          data-testid="inventory-quick-drawer"
        >
          {previewItem && (
            <>
              {/* Header */}
              <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-slate-100 sticky top-0 bg-white z-10">
                <div className="min-w-0 flex-1 pr-3">
                  <h2 className="text-base font-bold text-slate-900 leading-snug truncate" data-testid="drawer-item-name">
                    {previewItem.name}
                  </h2>
                  <p className="text-[11px] font-mono text-slate-400 mt-0.5" data-testid="drawer-item-sku">
                    {previewItem.sku}
                  </p>
                </div>
                <div className="flex-shrink-0 pr-8">
                  <ItemStatusBadge status={previewItem.status} />
                </div>
              </div>

              {/* Photo */}
              {previewItem.imageUrl && (
                <div className="mx-5 mt-4 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 h-36 flex items-center justify-center">
                  <img
                    src={previewItem.imageUrl}
                    alt={previewItem.name}
                    className="max-w-full max-h-full object-contain p-2"
                  />
                </div>
              )}

              {/* 2×3 stat grid */}
              <div className="px-5 mt-4 grid grid-cols-2 gap-2.5">
                {[
                  { label: t.invQtyOnHandLabel,     value: previewItem.quantityOnHand?.toLocaleString() ?? "—", testid: "drawer-qty" },
                  { label: t.invUnitOfMeasureLabel, value: previewItem.unitOfMeasure || "—",                    testid: "drawer-uom" },
                  { label: t.invSizeLabel,          value: previewItem.sizeLabel || "—",                        testid: "drawer-size" },
                  { label: t.invCategory,           value: previewItem.category?.name || "—",                   testid: "drawer-category" },
                  { label: t.invLocation,           value: previewItem.location?.name || "—",                   testid: "drawer-location" },
                  { label: t.invSupplierLabel,      value: previewItem.supplier?.name || "—",                   testid: "drawer-supplier" },
                ].map(({ label, value, testid }) => (
                  <div key={label} className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2.5">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                    <p className="text-sm font-semibold text-slate-800 truncate" data-testid={testid}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Reorder section */}
              <div className="px-5 mt-3 grid grid-cols-2 gap-2.5">
                {[
                  { label: t.invReorderPointLabel, value: previewItem.reorderPoint != null ? `${previewItem.reorderPoint} ${previewItem.unitOfMeasure}` : "—", testid: "drawer-reorder" },
                  { label: t.invMinStockLabel,     value: previewItem.minimumStock != null ? `${previewItem.minimumStock} ${previewItem.unitOfMeasure}` : "—", testid: "drawer-minstock" },
                ].map(({ label, value, testid }) => (
                  <div key={label} className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5">
                    <p className="text-[9px] font-bold text-amber-500 uppercase tracking-widest mb-1">{label}</p>
                    <p className="text-sm font-semibold text-amber-800 truncate" data-testid={testid}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Footer actions */}
              <div className="mt-auto px-5 py-4 border-t border-slate-100 flex gap-3 sticky bottom-0 bg-white">
                <Button
                  className="flex-1 bg-brand-700 hover:bg-brand-800 text-white"
                  onClick={() => navigate(`/inventory/${previewItem.id}`)}
                  data-testid="drawer-btn-edit-item"
                >
                  {t.invEditItemBtn}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-slate-300 text-slate-700 hover:bg-slate-50"
                  onClick={() => { setPreviewItem(null); navigate("/transactions"); }}
                  data-testid="drawer-btn-log-movement"
                >
                  {t.invLogMovementBtn}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
