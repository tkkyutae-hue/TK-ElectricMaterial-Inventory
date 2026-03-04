import { useState, useMemo } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Package, AlertTriangle, XCircle, CheckCircle2, ChevronRight, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type CategoryGroupedItem = {
  id: number;
  sku: string;
  name: string;
  sizeLabel?: string | null;
  baseItemName?: string | null;
  quantityOnHand: number;
  reorderPoint: number;
  unitOfMeasure: string;
  status: string;
  location?: { name: string } | null;
  supplier?: { name: string } | null;
};

type CategoryItemGroup = {
  baseItemName: string;
  items: CategoryGroupedItem[];
  representativeImage?: string | null;
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

function StatusBadge({ status }: { status: string }) {
  if (status === "out_of_stock") return <Badge className="bg-red-50 text-red-700 border-red-200 border font-medium whitespace-nowrap">Out of Stock</Badge>;
  if (status === "low_stock") return <Badge className="bg-amber-50 text-amber-700 border-amber-200 border font-medium whitespace-nowrap">Low Stock</Badge>;
  return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 border font-medium whitespace-nowrap">In Stock</Badge>;
}

const CATEGORY_FALLBACK_COLORS: Record<string, string> = {
  "CT": "from-sky-600 to-sky-800",
  "CF": "from-slate-600 to-slate-800",
  "CS": "from-zinc-600 to-zinc-800",
  "CW": "from-orange-600 to-orange-800",
  "DV": "from-violet-600 to-violet-800",
  "FH": "from-stone-600 to-stone-800",
  "BC": "from-blue-600 to-blue-800",
  "DP": "from-indigo-600 to-indigo-800",
  "GT": "from-teal-600 to-teal-800",
};

export default function CategoryDetail() {
  const { id } = useParams<{ id: string }>();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [familyFilter, setFamilyFilter] = useState("all");

  const { data, isLoading, isError } = useQuery<CategoryGroupedDetail>({
    queryKey: ["/api/inventory/category", id, "grouped"],
    queryFn: () => fetch(`/api/inventory/category/${id}/grouped`).then(r => r.json()),
    enabled: !!id,
  });

  const filteredGroups = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();

    return data.groups
      .filter(group => familyFilter === "all" || group.baseItemName === familyFilter)
      .map(group => {
        const filteredItems = group.items.filter(item => {
          const matchesSearch = !q || (
            item.sku.toLowerCase().includes(q) ||
            item.name.toLowerCase().includes(q) ||
            (item.sizeLabel || "").toLowerCase().includes(q) ||
            group.baseItemName.toLowerCase().includes(q)
          );
          const matchesStatus = statusFilter === "all" || item.status === statusFilter;
          return matchesSearch && matchesStatus;
        });
        return { ...group, items: filteredItems };
      })
      .filter(group => group.items.length > 0);
  }, [data, search, statusFilter, familyFilter]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
        <div className="h-12 bg-slate-100 rounded-xl animate-pulse" />
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-40 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="text-center py-20 text-slate-500">
        <XCircle className="w-12 h-12 mx-auto mb-3 text-red-300" />
        <p className="text-lg font-medium text-slate-900">Category not found</p>
        <Link href="/inventory">
          <Button variant="outline" className="mt-4">← Back to Inventory</Button>
        </Link>
      </div>
    );
  }

  const { category, skuCount, totalQuantity, lowStockCount, outOfStockCount, groups } = data;
  const gradientClass = CATEGORY_FALLBACK_COLORS[category.code || ""] || "from-slate-600 to-slate-800";
  const hasActiveFilters = search.trim() !== "" || statusFilter !== "all" || familyFilter !== "all";

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/inventory" className="hover:text-blue-600 transition-colors">Inventory</Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-slate-900 font-medium">{category.name}</span>
      </div>

      {/* Category hero */}
      <div className="relative rounded-2xl overflow-hidden h-56 shadow-lg">
        {category.imageUrl ? (
          <img
            src={category.imageUrl}
            alt={category.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              const t = e.currentTarget;
              t.style.display = "none";
              t.nextElementSibling?.classList.remove("hidden");
            }}
          />
        ) : null}
        <div className={`${category.imageUrl ? "hidden" : ""} absolute inset-0 bg-gradient-to-br ${gradientClass}`} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <Link href="/inventory" className="inline-flex items-center gap-1.5 text-white/70 hover:text-white text-sm mb-2 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Inventory
          </Link>
          <h1 className="text-2xl font-display font-bold text-white">{category.name}</h1>
          {category.description && (
            <p className="text-white/70 text-sm mt-0.5 max-w-2xl">{category.description}</p>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Package className="w-4 h-4 text-blue-600" />
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">SKUs</span>
          </div>
          <p className="text-2xl font-bold text-slate-900" data-testid="stat-sku-count">{skuCount}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Total Qty</span>
          </div>
          <p className="text-2xl font-bold text-slate-900" data-testid="stat-total-qty">{totalQuantity.toLocaleString()}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Low Stock</span>
          </div>
          <p className="text-2xl font-bold text-amber-600" data-testid="stat-low-stock">{lowStockCount}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="w-4 h-4 text-red-500" />
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Out of Stock</span>
          </div>
          <p className="text-2xl font-bold text-red-600" data-testid="stat-out-of-stock">{outOfStockCount}</p>
        </div>
      </div>

      {/* Search + filter bar */}
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input
            placeholder="Search by SKU, name, size, or family…"
            className="pl-8 h-9 bg-slate-50 border-slate-200 text-sm focus:bg-white"
            value={search}
            onChange={e => setSearch(e.target.value)}
            data-testid="input-category-search"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-9 text-sm bg-slate-50 border-slate-200" data-testid="select-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="in_stock">In Stock</SelectItem>
            <SelectItem value="low_stock">Low Stock</SelectItem>
            <SelectItem value="out_of_stock">Out of Stock</SelectItem>
          </SelectContent>
        </Select>
        <Select value={familyFilter} onValueChange={setFamilyFilter}>
          <SelectTrigger className="w-[200px] h-9 text-sm bg-slate-50 border-slate-200" data-testid="select-family-filter">
            <SelectValue placeholder="Family" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Families</SelectItem>
            {groups.map(g => (
              <SelectItem key={g.baseItemName} value={g.baseItemName}>{g.baseItemName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <button
            onClick={() => { setSearch(""); setStatusFilter("all"); setFamilyFilter("all"); }}
            className="text-xs text-slate-500 hover:text-blue-600 transition-colors whitespace-nowrap"
            data-testid="button-clear-filters"
          >
            Clear filters
          </button>
        )}
        <span className="text-xs text-slate-400 ml-auto whitespace-nowrap">
          {filteredGroups.reduce((n, g) => n + g.items.length, 0)} items
          {hasActiveFilters ? " matching" : ""}
        </span>
      </div>

      {/* Grouped inventory sections */}
      {filteredGroups.length === 0 ? (
        <div className="text-center py-16 text-slate-500 bg-white border border-slate-200 rounded-xl">
          <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          {hasActiveFilters ? (
            <>
              <p className="text-base font-semibold text-slate-900">No items match your search</p>
              <p className="text-sm mt-1">Try different keywords or clear the filters.</p>
            </>
          ) : (
            <p className="text-base font-semibold text-slate-900">No items in this category</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredGroups.map((group) => {
            const groupLowStock = group.items.filter(i => i.status === "low_stock").length;
            const groupOutOfStock = group.items.filter(i => i.status === "out_of_stock").length;
            return (
              <div key={group.baseItemName} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                {/* Group header — fixed height, consistent alignment */}
                <div className="flex items-center justify-between px-5 border-b border-slate-200 bg-slate-50/80 min-h-[60px]">
                  <div className="flex items-center gap-3 py-3">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-white border border-slate-200 flex items-center justify-center shrink-0">
                      {group.representativeImage ? (
                        <img src={group.representativeImage} alt={group.baseItemName} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-5 h-5 text-slate-300" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-900 text-sm leading-snug truncate">{group.baseItemName}</h3>
                      <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider leading-none mt-0.5">
                        {group.items.length} {group.items.length === 1 ? "size" : "sizes"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 pl-3">
                    {groupOutOfStock > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-full px-2.5 py-0.5 whitespace-nowrap">
                        <XCircle className="w-3 h-3" />
                        {groupOutOfStock} out of stock
                      </span>
                    )}
                    {groupLowStock > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5 whitespace-nowrap">
                        <AlertTriangle className="w-3 h-3" />
                        {groupLowStock} low
                      </span>
                    )}
                  </div>
                </div>

                {/* Group table — no Reorder Point column */}
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent bg-transparent border-b border-slate-100">
                        <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-2 pl-5">SKU</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-2">Size</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-2">Item Name</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-2 text-right">Qty</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-2">Unit</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-2">Location</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-2">Supplier</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-2 pr-5">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.items.map((item) => (
                        <TableRow
                          key={item.id}
                          className={`hover:bg-slate-50/70 transition-colors ${item.status === "out_of_stock" ? "bg-red-50/20" : item.status === "low_stock" ? "bg-amber-50/20" : ""}`}
                          data-testid={`row-item-${item.id}`}
                        >
                          <TableCell className="font-mono text-xs text-slate-500 py-2.5 pl-5">{item.sku}</TableCell>
                          <TableCell className="font-semibold text-slate-800 text-sm py-2.5 whitespace-nowrap">{item.sizeLabel || "—"}</TableCell>
                          <TableCell className="text-slate-700 text-sm py-2.5">
                            <Link href={`/inventory/${item.id}`} className="hover:text-blue-600 transition-colors">{item.name}</Link>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-slate-900 py-2.5 tabular-nums">
                            {item.quantityOnHand.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-slate-500 text-sm py-2.5">{item.unitOfMeasure}</TableCell>
                          <TableCell className="text-slate-600 text-sm py-2.5 whitespace-nowrap">{item.location?.name || "—"}</TableCell>
                          <TableCell className="text-slate-600 text-sm py-2.5 whitespace-nowrap">{item.supplier?.name || "—"}</TableCell>
                          <TableCell className="py-2.5 pr-5"><StatusBadge status={item.status} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
