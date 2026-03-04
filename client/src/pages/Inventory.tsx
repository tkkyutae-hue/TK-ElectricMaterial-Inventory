import { useState } from "react";
import { useItems, useCreateItem } from "@/hooks/use-items";
import { useQuery } from "@tanstack/react-query";
import { useCategories, useLocations, useSuppliers } from "@/hooks/use-reference-data";
import { ItemStatusBadge } from "@/components/StatusBadge";
import { Plus, Search, Filter, AlertTriangle, XCircle, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertItemSchema } from "@shared/schema";
import { Link } from "wouter";

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
  "BC": "from-blue-600 to-blue-900",
  "DP": "from-indigo-700 to-indigo-900",
  "GT": "from-teal-600 to-teal-900",
};

function CategoryCard({ cat }: { cat: CategorySummary }) {
  const gradient = CATEGORY_GRADIENTS[cat.code || ""] || "from-slate-600 to-slate-800";

  return (
    <Link href={`/inventory/category/${cat.id}`}>
      <div
        className="relative rounded-xl overflow-hidden cursor-pointer group border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
        data-testid={`card-category-${cat.id}`}
      >
        <div className="relative h-40 overflow-hidden">
          {cat.imageUrl ? (
            <img
              src={cat.imageUrl}
              alt={cat.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={(e) => {
                const t = e.currentTarget;
                t.style.display = "none";
                t.parentElement?.querySelector(".fallback-grad")?.classList.remove("hidden");
              }}
            />
          ) : null}
          <div className={`fallback-grad ${cat.imageUrl ? "hidden" : ""} absolute inset-0 bg-gradient-to-br ${gradient}`} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 px-3 pb-3">
            <p className="text-white font-semibold text-sm leading-tight drop-shadow">{cat.name}</p>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function Inventory() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");

  const { data: items, isLoading } = useItems({
    search: search || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    categoryId: categoryFilter !== "all" ? Number(categoryFilter) : undefined,
    locationId: locationFilter !== "all" ? Number(locationFilter) : undefined,
  });

  const { data: categories } = useCategories();
  const { data: locations } = useLocations();
  const { data: suppliers } = useSuppliers();

  const { data: categorySummary } = useQuery<CategorySummary[]>({
    queryKey: ["/api/inventory/categories/summary"],
  });

  const createMutation = useCreateItem();
  const [dialogOpen, setDialogOpen] = useState(false);

  const form = useForm<z.infer<typeof insertItemSchema>>({
    resolver: zodResolver(insertItemSchema),
    defaultValues: {
      name: "", sku: "", unitOfMeasure: "EA", quantityOnHand: 0, minimumStock: 0, reorderPoint: 0, reorderQuantity: 0, unitCost: "0.00"
    }
  });

  function onSubmit(data: z.infer<typeof insertItemSchema>) {
    createMutation.mutate(data, {
      onSuccess: () => {
        setDialogOpen(false);
        form.reset();
      }
    });
  }

  const totalLowStock = categorySummary?.reduce((s, c) => s + c.lowStockCount, 0) ?? 0;
  const totalOutOfStock = categorySummary?.reduce((s, c) => s + c.outOfStockCount, 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Inventory</h1>
          <p className="text-slate-500 mt-1">Browse by category or search for specific materials and equipment.</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-item" className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
              <Plus className="w-4 h-4 mr-2" />
              Add New Item
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Inventory Item</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem className="col-span-2"><FormLabel>Item Name</FormLabel><FormControl><Input placeholder='e.g. 1" EMT Conduit' data-testid="input-item-name" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="sku" render={({ field }) => (
                    <FormItem><FormLabel>SKU / Part Number</FormLabel><FormControl><Input placeholder="EMT-100" data-testid="input-item-sku" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="unitOfMeasure" render={({ field }) => (
                    <FormItem><FormLabel>Unit of Measure</FormLabel><FormControl><Input placeholder="FT, EA, ROLL" data-testid="input-item-uom" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="categoryId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString()}>
                        <FormControl><SelectTrigger data-testid="select-item-category"><SelectValue placeholder="Select Category" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {categories?.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="primaryLocationId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString()}>
                        <FormControl><SelectTrigger data-testid="select-item-location"><SelectValue placeholder="Select Location" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {locations?.map(l => <SelectItem key={l.id} value={l.id.toString()}>{l.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="quantityOnHand" render={({ field }) => (
                    <FormItem><FormLabel>Initial Quantity</FormLabel><FormControl><Input type="number" data-testid="input-item-qty" {...field} onChange={e => field.onChange(parseInt(e.target.value))} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="unitCost" render={({ field }) => (
                    <FormItem><FormLabel>Unit Cost ($)</FormLabel><FormControl><Input type="number" step="0.01" data-testid="input-item-cost" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-item" className="bg-blue-600 hover:bg-blue-700">
                    {createMutation.isPending ? "Creating..." : "Save Item"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
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
                placeholder="Search by SKU or Name..."
                className="pl-8 h-9 bg-white border-slate-200 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-search"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
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
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[160px] h-9 bg-white text-sm" data-testid="select-category-filter">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories?.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-[150px] h-9 bg-white text-sm" data-testid="select-location-filter">
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locations?.map(l => <SelectItem key={l.id} value={l.id.toString()}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">SKU</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Photo</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Item Name</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Size</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Category</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Quantity</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Unit</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Location</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">Reorder Pt.</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [1,2,3,4,5,6,7].map(i => (
                  <TableRow key={i}>
                    {[1,2,3,4,5,6,7,8,9,10,11].map(j => (
                      <TableCell key={j}><div className="h-4 bg-slate-100 rounded animate-pulse w-full max-w-[120px]"></div></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : items?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-16 text-slate-500">
                    <Package className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                    <p className="text-base font-semibold text-slate-900">No items found</p>
                    <p className="text-sm mt-1">Try adjusting your search or filters.</p>
                  </TableCell>
                </TableRow>
              ) : (
                items?.map((item) => (
                  <TableRow
                    key={item.id}
                    className={`hover:bg-slate-50/60 transition-colors group ${item.status === "out_of_stock" ? "bg-red-50/20" : item.status === "low_stock" ? "bg-amber-50/20" : ""}`}
                    data-testid={`row-item-${item.id}`}
                  >
                    <TableCell className="font-mono text-xs text-slate-500 font-medium">{item.sku}</TableCell>
                    <TableCell>
                      <div className="w-10 h-10 rounded-md overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-5 h-5 text-slate-300" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold text-slate-900 max-w-[200px] truncate">{item.name}</TableCell>
                    <TableCell className="text-slate-600 text-sm">{(item as any).sizeLabel || "—"}</TableCell>
                    <TableCell className="text-slate-500 text-sm">{item.category?.name || "—"}</TableCell>
                    <TableCell className="text-right font-semibold text-slate-900">
                      {item.quantityOnHand.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm">{item.unitOfMeasure}</TableCell>
                    <TableCell className="text-slate-500 text-sm">{item.location?.name || "—"}</TableCell>
                    <TableCell><ItemStatusBadge status={item.status} /></TableCell>
                    <TableCell className="text-right text-slate-500 text-sm">{item.reorderPoint.toLocaleString()}</TableCell>
                    <TableCell>
                      <Link href={`/inventory/${item.id}`} className="text-xs font-medium text-blue-600 hover:underline opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        Details →
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {items && items.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400 bg-slate-50/40">
            Showing {items.length} item{items.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
}
