import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Package, AlertTriangle, XCircle, CheckCircle2, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  if (status === "out_of_stock") return <Badge className="bg-red-50 text-red-700 border-red-200 border font-medium">Out of Stock</Badge>;
  if (status === "low_stock") return <Badge className="bg-amber-50 text-amber-700 border-amber-200 border font-medium">Low Stock</Badge>;
  return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 border font-medium">In Stock</Badge>;
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

  const { data, isLoading, isError } = useQuery<CategoryGroupedDetail>({
    queryKey: ["/api/inventory/category", id, "grouped"],
    queryFn: () => fetch(`/api/inventory/category/${id}/grouped`).then(r => r.json()),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
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

  return (
    <div className="space-y-6">
      {/* Header nav */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/inventory" className="hover:text-blue-600 transition-colors">Inventory</Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-slate-900 font-medium">{category.name}</span>
      </div>

      {/* Category hero */}
      <div className="relative rounded-2xl overflow-hidden h-64 shadow-lg">
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
        <div className="absolute bottom-0 left-0 right-0 p-8">
          <Link href="/inventory" className="inline-flex items-center gap-1.5 text-white/70 hover:text-white text-sm mb-3 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Inventory
          </Link>
          <h1 className="text-3xl font-display font-bold text-white mb-1">{category.name}</h1>
          {category.description && (
            <p className="text-white/75 text-sm max-w-2xl">{category.description}</p>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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

      {/* Grouped inventory sections */}
      {groups.length === 0 ? (
        <div className="text-center py-16 text-slate-500 bg-white border border-slate-200 rounded-xl">
          <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="text-lg font-medium text-slate-900">No items in this category</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => {
            const groupLowStock = group.items.filter(i => i.status === "low_stock").length;
            const groupOutOfStock = group.items.filter(i => i.status === "out_of_stock").length;
            return (
              <div key={group.baseItemName} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50 border-b border-slate-200">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-sm">
                      {group.representativeImage ? (
                        <img src={group.representativeImage} alt={group.baseItemName} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-6 h-6 text-slate-300" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 leading-tight">{group.baseItemName}</h3>
                      <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider mt-0.5">{group.items.length} sizes</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {groupOutOfStock > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-full px-2.5 py-0.5">
                        <XCircle className="w-3 h-3" />
                        {groupOutOfStock} out of stock
                      </span>
                    )}
                    {groupLowStock > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5">
                        <AlertTriangle className="w-3 h-3" />
                        {groupLowStock} low stock
                      </span>
                    )}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent bg-transparent">
                        <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">SKU</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Size</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Item Name</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Qty</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Unit</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Location</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Supplier</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Reorder Pt.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.items.map((item) => (
                        <TableRow
                          key={item.id}
                          className={`transition-colors group ${item.status === "out_of_stock" ? "bg-red-50/30" : item.status === "low_stock" ? "bg-amber-50/30" : ""}`}
                          data-testid={`row-item-${item.id}`}
                        >
                          <TableCell className="font-mono text-xs text-slate-500">{item.sku}</TableCell>
                          <TableCell className="font-semibold text-slate-800">{item.sizeLabel || "—"}</TableCell>
                          <TableCell className="text-slate-700">
                            <Link href={`/inventory/${item.id}`} className="hover:text-blue-600 transition-colors">{item.name}</Link>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-slate-900">
                            {item.quantityOnHand.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-slate-500 text-sm">{item.unitOfMeasure}</TableCell>
                          <TableCell className="text-slate-600 text-sm">{item.location?.name || "—"}</TableCell>
                          <TableCell className="text-slate-600 text-sm">{item.supplier?.name || "—"}</TableCell>
                          <TableCell><StatusBadge status={item.status} /></TableCell>
                          <TableCell className="text-right text-slate-500 text-sm">{item.reorderPoint.toLocaleString()}</TableCell>
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
