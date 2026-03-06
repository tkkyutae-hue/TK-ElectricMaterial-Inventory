import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useItems } from "@/hooks/use-items";
import { ItemStatusBadge } from "@/components/StatusBadge";
import { Search, Package, X, ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

type CategorySummary = {
  id: number;
  name: string;
  code?: string | null;
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

const PAGE_SIZE_OPTIONS = [10, 15, 20, 25];

type Item = {
  id: number;
  sku: string;
  name: string;
  sizeLabel?: string | null;
  quantityOnHand: number;
  unitOfMeasure: string;
  status: string;
  reorderPoint: number;
  categoryId?: number | null;
  subcategory?: string | null;
  imageUrl?: string | null;
  location?: { name: string } | null;
  category?: { name: string } | null;
  supplier?: { name: string } | null;
};

function PhotoCell({ imageUrl, name }: { imageUrl?: string | null; name: string }) {
  if (!imageUrl) {
    return (
      <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center flex-shrink-0">
        <ImageOff className="w-4 h-4 text-slate-300" />
      </div>
    );
  }
  return (
    <img
      src={imageUrl}
      alt={name}
      className="w-8 h-8 rounded-md object-cover flex-shrink-0 border border-slate-100"
      onError={(e) => {
        const t = e.currentTarget;
        t.style.display = "none";
        const fallback = t.nextElementSibling as HTMLElement;
        if (fallback) fallback.style.display = "flex";
      }}
    />
  );
}

function ItemDetailDialog({ item, onClose }: { item: Item; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">{item.name}</DialogTitle>
        </DialogHeader>
        {item.imageUrl && (
          <img src={item.imageUrl} alt={item.name} className="w-full h-32 object-cover rounded-xl mb-2" />
        )}
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">SKU</span>
            <span className="font-mono font-medium">{item.sku}</span>
          </div>
          {item.sizeLabel && (
            <div className="flex justify-between">
              <span className="text-slate-500">Size</span>
              <span>{item.sizeLabel}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Status</span>
            <ItemStatusBadge status={item.status} />
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Qty on Hand</span>
            <span className="font-bold text-slate-900">{item.quantityOnHand.toLocaleString()} {item.unitOfMeasure}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Reorder Point</span>
            <span>{item.reorderPoint.toLocaleString()}</span>
          </div>
          {item.subcategory && (
            <div className="flex justify-between">
              <span className="text-slate-500">Family</span>
              <span>{item.subcategory}</span>
            </div>
          )}
          {item.location && (
            <div className="flex justify-between">
              <span className="text-slate-500">Location</span>
              <span>{item.location.name}</span>
            </div>
          )}
          {item.category && (
            <div className="flex justify-between">
              <span className="text-slate-500">Category</span>
              <span>{item.category.name}</span>
            </div>
          )}
          {item.supplier && (
            <div className="flex justify-between">
              <span className="text-slate-500">Supplier</span>
              <span>{item.supplier.name}</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function FieldInventory() {
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const [selectedCatName, setSelectedCatName] = useState<string>("");
  const [selectedFamily, setSelectedFamily] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  const { data: items, isLoading } = useItems();
  const { data: categorySummary } = useQuery<CategorySummary[]>({
    queryKey: ["/api/inventory/categories/summary"],
  });

  const catFiltered = useMemo(() => {
    if (!items) return [];
    return (items as Item[]).filter(item =>
      selectedCat === null || item.categoryId === selectedCat
    );
  }, [items, selectedCat]);

  const families = useMemo(() => {
    const set = new Set<string>();
    catFiltered.forEach(item => {
      if (item.subcategory) set.add(item.subcategory);
    });
    return Array.from(set).sort();
  }, [catFiltered]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return catFiltered.filter(item => {
      if (selectedFamily !== "all" && item.subcategory !== selectedFamily) return false;
      if (q && !item.name.toLowerCase().includes(q) && !item.sku.toLowerCase().includes(q) && !(item.sizeLabel ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [catFiltered, search, selectedFamily]);

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  function handleCategoryClick(cat: CategorySummary) {
    if (selectedCat === cat.id) {
      setSelectedCat(null);
      setSelectedCatName("");
    } else {
      setSelectedCat(cat.id);
      setSelectedCatName(cat.name);
      setSelectedFamily("all");
      setPage(1);
    }
  }

  function handleSearch(v: string) {
    setSearch(v);
    setPage(1);
  }

  const showFamilyFilter = selectedCat !== null && families.length > 0;

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Package className="w-5 h-5 text-[#0A6B24]" />
          <h1 className="text-2xl font-display font-bold text-slate-900">Inventory</h1>
        </div>
        <p className="text-[#64748B] text-sm">Browse categories or search items (read-only).</p>
      </div>

      {/* Category grid */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold text-[#64748B] uppercase tracking-wide">Browse by Category</h2>
          {selectedCat !== null && (
            <button
              onClick={() => { setSelectedCat(null); setSelectedCatName(""); setSelectedFamily("all"); setPage(1); }}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition-colors"
              data-testid="btn-clear-category"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
        {!categorySummary ? (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {[1,2,3,4,5].map(i => <div key={i} className="h-24 rounded-xl bg-slate-100 animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {categorySummary.map(cat => {
              const gradient = CATEGORY_GRADIENTS[cat.code || ""] || "from-slate-600 to-slate-800";
              const isActive = selectedCat === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryClick(cat)}
                  data-testid={`card-category-${cat.id}`}
                  className={`relative rounded-xl overflow-hidden border-2 transition-all duration-200 ${
                    isActive
                      ? "border-[#0A6B24] ring-2 ring-[#0A6B24]/30 shadow-md"
                      : "border-transparent hover:border-[#D9E7DD] hover:shadow-md"
                  }`}
                >
                  {/* Fixed-ratio container: 16:9 approximation → padding-bottom trick */}
                  <div className="relative w-full" style={{ paddingBottom: "62.5%" }}>
                    <div className="absolute inset-0">
                      {cat.imageUrl ? (
                        <img
                          src={cat.imageUrl}
                          alt={cat.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const t = e.currentTarget;
                            t.style.display = "none";
                            const fallback = t.parentElement?.querySelector(".fallback-grad") as HTMLElement;
                            if (fallback) fallback.style.display = "block";
                          }}
                        />
                      ) : null}
                      <div
                        className={`fallback-grad ${cat.imageUrl ? "hidden" : ""} absolute inset-0 bg-gradient-to-br ${gradient}`}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 px-2 pb-1.5">
                        <p className="text-white font-semibold text-[10px] sm:text-xs leading-tight line-clamp-2 drop-shadow">
                          {cat.name}
                        </p>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Active filters display */}
      {selectedCat !== null && (
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-[#EAF7EE] text-[#0A6B24] border-[#D9E7DD] gap-1 pl-2 pr-1 py-1">
            {selectedCatName}
            <button
              onClick={() => { setSelectedCat(null); setSelectedCatName(""); setSelectedFamily("all"); setPage(1); }}
              className="ml-1 hover:text-red-500 rounded-full"
            >
              <X className="w-3 h-3" />
            </button>
          </Badge>
          {selectedFamily !== "all" && (
            <Badge variant="outline" className="text-slate-600 gap-1 pl-2 pr-1 py-1">
              {selectedFamily}
              <button onClick={() => { setSelectedFamily("all"); setPage(1); }} className="ml-1 hover:text-red-500">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          <span className="text-xs text-[#64748B]">{totalItems} item{totalItems !== 1 ? "s" : ""}</span>
        </div>
      )}

      {/* Search + Family filter + Page size */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input
            placeholder="Search name, SKU, size…"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            className="pl-8 h-9 text-sm bg-white border-[#D9E7DD] focus-visible:ring-[#0A6B24]/30"
            data-testid="field-inv-search"
          />
        </div>
        {showFamilyFilter && (
          <Select value={selectedFamily} onValueChange={v => { setSelectedFamily(v); setPage(1); }}>
            <SelectTrigger className="w-36 h-9 text-sm bg-white border-[#D9E7DD]" data-testid="field-inv-family-filter">
              <SelectValue placeholder="All Families" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Families</SelectItem>
              {families.map(f => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setPage(1); }}>
          <SelectTrigger className="w-28 h-9 text-sm bg-white border-[#D9E7DD]" data-testid="field-inv-page-size">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map(n => (
              <SelectItem key={n} value={String(n)}>{n} / page</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Item table */}
      <div className="bg-white border border-[#D9E7DD] rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#F6F7F9] border-b border-[#D9E7DD]">
                <TableHead className="text-[10px] font-bold text-[#64748B] uppercase tracking-wide py-2.5 pl-4 w-20">SKU</TableHead>
                <TableHead className="text-[10px] font-bold text-[#64748B] uppercase tracking-wide py-2.5 w-10 text-center">Photo</TableHead>
                <TableHead className="text-[10px] font-bold text-[#64748B] uppercase tracking-wide py-2.5">Item</TableHead>
                <TableHead className="text-[10px] font-bold text-[#64748B] uppercase tracking-wide py-2.5 hidden sm:table-cell">Category</TableHead>
                <TableHead className="text-[10px] font-bold text-[#64748B] uppercase tracking-wide py-2.5 hidden md:table-cell">Location</TableHead>
                <TableHead className="text-[10px] font-bold text-[#64748B] uppercase tracking-wide py-2.5 text-right">Qty</TableHead>
                <TableHead className="text-[10px] font-bold text-[#64748B] uppercase tracking-wide py-2.5 text-center pr-4">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-[#64748B]">Loading…</TableCell>
                </TableRow>
              ) : pageItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-[#64748B]">
                    {search || selectedCat !== null ? "No items match your search." : "No items found."}
                  </TableCell>
                </TableRow>
              ) : pageItems.map((item: Item) => (
                <TableRow
                  key={item.id}
                  className="hover:bg-[#EAF7EE]/40 transition-colors cursor-pointer border-b border-slate-50 last:border-0"
                  onClick={() => setSelectedItem(item)}
                  data-testid={`field-inv-row-${item.id}`}
                >
                  <TableCell className="py-2.5 pl-4">
                    <span className="font-mono text-[11px] text-[#64748B]">{item.sku}</span>
                  </TableCell>
                  <TableCell className="py-2.5">
                    <div className="flex items-center justify-center">
                      <PhotoCell imageUrl={item.imageUrl} name={item.name} />
                    </div>
                  </TableCell>
                  <TableCell className="py-2.5">
                    <p className="text-sm font-medium text-slate-800">{item.name}</p>
                    {item.sizeLabel && <p className="text-xs text-[#64748B]">{item.sizeLabel}</p>}
                  </TableCell>
                  <TableCell className="py-2.5 hidden sm:table-cell text-sm text-[#64748B]">
                    {item.category?.name ?? "—"}
                  </TableCell>
                  <TableCell className="py-2.5 hidden md:table-cell text-sm text-[#64748B]">
                    {item.location?.name ?? "—"}
                  </TableCell>
                  <TableCell className="py-2.5 text-right">
                    <span className="font-semibold text-slate-900 tabular-nums text-sm">
                      {item.quantityOnHand.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell className="py-2.5 pr-4">
                    <div className="flex justify-center">
                      <ItemStatusBadge status={item.status} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination footer */}
        {totalItems > 0 && (
          <div className="px-4 py-2.5 border-t border-[#D9E7DD] flex items-center justify-between">
            <span className="text-xs text-[#64748B]">
              {totalItems === 0 ? "0" : `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, totalItems)}`} of {totalItems.toLocaleString()} items
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:bg-[#EAF7EE] hover:text-[#0A6B24]"
                disabled={safePage <= 1}
                onClick={() => setPage(p => p - 1)}
                data-testid="btn-prev-page"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="px-2 text-xs text-slate-600 font-medium min-w-[80px] text-center">
                Page {safePage} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:bg-[#EAF7EE] hover:text-[#0A6B24]"
                disabled={safePage >= totalPages}
                onClick={() => setPage(p => p + 1)}
                data-testid="btn-next-page"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Item detail dialog */}
      {selectedItem && (
        <ItemDetailDialog item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  );
}
