import { useState, useMemo } from "react";
import { useItems } from "@/hooks/use-items";
import { useQuery } from "@tanstack/react-query";
import { useCategories, useLocations } from "@/hooks/use-reference-data";
import { ItemStatusBadge } from "@/components/StatusBadge";
import { Search, Filter, AlertTriangle, XCircle, Package, ChevronLeft, ChevronRight, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

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

const CATEGORY_GRADIENTS: Record<string, string> = {
  "CT": "from-sky-700 to-sky-900",
  "CF": "from-slate-600 to-slate-800",
  "CS": "from-zinc-600 to-zinc-800",
  "CW": "from-orange-600 to-orange-900",
  "DV": "from-violet-600 to-violet-900",
  "FH": "from-stone-600 to-stone-800",
  "BC": "from-brand-600 to-brand-900",
  "DP": "from-indigo-700 to-indigo-900",
  "GT": "from-teal-600 to-teal-900",
  "TM": "from-amber-600 to-amber-900",
};

function CategoryCard({ cat }: { cat: CategorySummary }) {
  const gradient = CATEGORY_GRADIENTS[cat.code || ""] || "from-slate-600 to-slate-800";

  return (
    <Link href={`/inventory/category/${cat.id}`}>
      <div
        className="relative rounded-xl overflow-hidden cursor-pointer group border border-slate-200/80 shadow-sm hover:shadow-lg hover:border-slate-300 transition-all duration-200 hover:-translate-y-0.5"
        data-testid={`card-category-${cat.id}`}
      >
        <div className="relative h-28 overflow-hidden bg-[#16202e]">
          {/* Blurred ambient fill — hides letterbox bars */}
          {cat.imageUrl && (
            <img
              src={cat.imageUrl}
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover scale-125 blur-2xl opacity-80 brightness-75 saturate-200 pointer-events-none"
            />
          )}
          {/* Primary sharp image */}
          {cat.imageUrl ? (
            <img
              src={cat.imageUrl}
              alt={cat.name}
              className="absolute inset-0 w-full h-full object-contain object-center z-10 group-hover:scale-[1.04] transition-transform duration-500 ease-out"
              onError={(e) => {
                const t = e.currentTarget;
                t.style.display = "none";
                (t.previousElementSibling as HTMLElement)?.style.setProperty("display", "none");
                t.parentElement?.querySelector(".fallback-grad")?.classList.remove("hidden");
              }}
            />
          ) : null}
          <div className={`fallback-grad ${cat.imageUrl ? "hidden" : ""} absolute inset-0 bg-gradient-to-br ${gradient}`} />
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
          <span className="text-[11px] text-slate-500">{cat.skuCount} SKUs</span>
          <span className="text-[11px] text-slate-500">{cat.totalQuantity.toLocaleString()} units</span>
        </div>
      </div>
    </Link>
  );
}

const PAGE_SIZE_OPTIONS = [25, 50, 100];

export default function Inventory() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [exporting, setExporting] = useState(false);

  const { isAdminRole } = useAuth();
  const { toast } = useToast();

  async function handleExportXlsx() {
    const date = new Date().toISOString().slice(0, 10);
    const filename = `TK_Electric_Inventory_${date}.xlsx`;
    setExporting(true);
    toast({
      title: "Preparing Excel file…",
      description: "Your browser will save it to your default Downloads folder.",
    });
    try {
      // Step 1: Validate the endpoint returns a real xlsx (preflight fetch)
      const resp = await fetch("/api/admin/export/inventory-xlsx", { credentials: "include" });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ message: `Server error ${resp.status}` }));
        throw new Error(err.message);
      }

      const contentType = resp.headers.get("content-type") ?? "";
      if (!contentType.includes("spreadsheetml") && !contentType.includes("octet-stream")) {
        throw new Error(`Unexpected response type: ${contentType || "unknown"}`);
      }

      const blob = await resp.blob();
      if (blob.size < 1024) {
        throw new Error("Export returned an empty or invalid file.");
      }

      // Step 2: Trigger download via blob URL.
      // If this page is embedded in a same-origin iframe (Replit preview),
      // attach the anchor to the top-level document so the browser's
      // native download mechanism fires correctly.  Fall back to the
      // current document when window.top is cross-origin (production).
      const blobUrl = URL.createObjectURL(blob);

      let targetDoc: Document;
      try {
        // Throws SecurityError when cross-origin
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

      // Defer cleanup — 2 s gives the browser time to queue the save
      setTimeout(() => {
        targetDoc.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }, 2000);

      toast({
        title: "Export complete",
        description: `${filename} saved to your Downloads folder.`,
      });
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }

  const { data: items, isLoading } = useItems({
    search: search || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    categoryId: categoryFilter !== "all" ? categoryFilter : undefined,
    locationId: locationFilter !== "all" ? locationFilter : undefined,
  });

  const { data: categories } = useCategories();
  const { data: locations } = useLocations();

  const { data: categorySummary } = useQuery<CategorySummary[]>({
    queryKey: ["/api/inventory/categories/summary"],
  });

  const totalLowStock = categorySummary?.reduce((s, c) => s + c.lowStockCount, 0) ?? 0;
  const totalOutOfStock = categorySummary?.reduce((s, c) => s + c.outOfStockCount, 0) ?? 0;

  const totalItems = items?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);

  const pageItems = useMemo(() => {
    if (!items) return [];
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  function handleFilterChange(setter: (v: string) => void) {
    return (v: string) => { setter(v); setPage(1); };
  }

  const startItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItem = Math.min(safePage * pageSize, totalItems);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Inventory</h1>
          <p className="text-slate-500 mt-1">Browse by category or search for specific materials and equipment.</p>
        </div>
        {isAdminRole && (
          <Button
            onClick={handleExportXlsx}
            disabled={exporting}
            variant="outline"
            className="gap-2 border-slate-300 text-slate-700 hover:bg-slate-50 shrink-0"
            data-testid="btn-export-inventory-xlsx"
          >
            <FileDown className="w-4 h-4" />
            {exporting ? "Generating…" : "Export to Excel"}
          </Button>
        )}
      </div>

      {/* Alert banner for stock issues */}
      {(totalOutOfStock > 0 || totalLowStock > 0) && (
        <div className="flex flex-wrap gap-3">
          {totalOutOfStock > 0 && (
            <Link href="/reorder">
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2.5 text-sm font-medium cursor-pointer hover:bg-red-100 transition-colors">
                <XCircle className="w-4 h-4 flex-shrink-0" />
                {totalOutOfStock} item{totalOutOfStock > 1 ? "s" : ""} out of stock — action needed
              </div>
            </Link>
          )}
          {totalLowStock > 0 && (
            <Link href="/reorder">
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-4 py-2.5 text-sm font-medium cursor-pointer hover:bg-amber-100 transition-colors">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {totalLowStock} item{totalLowStock > 1 ? "s" : ""} below reorder point
              </div>
            </Link>
          )}
        </div>
      )}

      {/* Category card grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-slate-700">Browse by Category</h2>
          <span className="text-sm text-slate-400">{categorySummary?.length ?? 0} categories</span>
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
            <span>Filter Items</span>
          </div>
          <div className="flex flex-wrap gap-2 flex-1">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input
                placeholder="Search by name, SKU, size…"
                className="pl-8 h-9 bg-white border-slate-200 text-sm"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                data-testid="input-search"
              />
            </div>
            <Select value={statusFilter} onValueChange={handleFilterChange(setStatusFilter)}>
              <SelectTrigger className="w-[140px] h-9 bg-white text-sm" data-testid="select-status-filter">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="in_stock">In Stock</SelectItem>
                <SelectItem value="low_stock">Low Stock</SelectItem>
                <SelectItem value="out_of_stock">Out of Stock</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={handleFilterChange(setCategoryFilter)}>
              <SelectTrigger className="w-[160px] h-9 bg-white text-sm" data-testid="select-category-filter">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories?.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={locationFilter} onValueChange={handleFilterChange(setLocationFilter)}>
              <SelectTrigger className="w-[150px] h-9 bg-white text-sm" data-testid="select-location-filter">
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locations?.map(l => <SelectItem key={l.id} value={l.id.toString()}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
              <SelectTrigger className="w-[110px] h-9 bg-white text-sm" data-testid="select-page-size">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map(n => (
                  <SelectItem key={n} value={String(n)}>{n} per page</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ tableLayout: "fixed", minWidth: 900 }}>
            <colgroup>
              <col style={{ width: "120px" }} /> {/* SKU */}
              <col style={{ width: "52px" }} />  {/* Photo */}
              <col style={{ width: "80px" }} />  {/* Size */}
              <col />                             {/* Item — widest */}
              <col style={{ width: "140px" }} /> {/* Category */}
              <col style={{ width: "110px" }} /> {/* Qty/Unit */}
              <col style={{ width: "130px" }} /> {/* Location */}
              <col style={{ width: "110px" }} /> {/* Status */}
            </colgroup>
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100">
                {[
                  { label: "SKU",       align: "left"   },
                  { label: "Photo",     align: "left"   },
                  { label: "Size",      align: "left"   },
                  { label: "Item",      align: "left"   },
                  { label: "Category",  align: "left"   },
                  { label: "Qty / Unit",align: "right"  },
                  { label: "Location",  align: "left"   },
                  { label: "Status",    align: "center" },
                ].map(col => (
                  <th
                    key={col.label}
                    className={`px-3 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wide align-middle whitespace-nowrap ${col.align === "center" ? "text-center" : col.align === "right" ? "text-right" : "text-left"}`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 7 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    {[1,2,3,4,5,6,7,8].map(j => (
                      <td key={j} className="px-3 py-3 align-middle">
                        <div className="h-4 bg-slate-100 animate-pulse rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items?.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-slate-500">
                    <Package className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                    <p className="text-base font-semibold text-slate-900">No items found</p>
                    <p className="text-sm mt-1">Try adjusting your search or filters.</p>
                  </td>
                </tr>
              ) : (
                pageItems.map((item) => (
                  <tr
                    key={item.id}
                    className={`border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors ${item.status === "out_of_stock" ? "bg-red-50/20" : item.status === "low_stock" ? "bg-amber-50/20" : ""}`}
                    data-testid={`row-item-${item.id}`}
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
                    <td className="px-3 py-3 align-middle">
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
                    {/* Location */}
                    <td className="px-3 py-3 align-middle">
                      <span className="text-xs text-slate-500 whitespace-nowrap">{item.location?.name || "—"}</span>
                    </td>
                    {/* Status */}
                    <td className="px-3 py-3 align-middle">
                      <div className="flex items-center justify-center">
                        <ItemStatusBadge status={item.status} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer: count + pagination */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/40 flex items-center justify-between gap-4 flex-wrap">
          <p className="text-xs text-slate-400">
            {totalItems === 0 ? "No items" : `Showing ${startItem}–${endItem} of ${totalItems} item${totalItems !== 1 ? "s" : ""}`}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                data-testid="button-prev-page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Prev
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
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
