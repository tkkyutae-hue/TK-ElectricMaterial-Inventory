import { useState, useMemo } from "react";
import { useItems } from "@/hooks/use-items";
import { useLocations } from "@/hooks/use-reference-data";
import { ItemStatusBadge } from "@/components/StatusBadge";
import { Search, Package } from "lucide-react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function FieldInventory() {
  const [search, setSearch]     = useState("");
  const [locFilter, setLoc]     = useState("all");
  const [statusFilter, setStatus] = useState("all");

  const { data: items, isLoading } = useItems();
  const { data: locations }        = useLocations();

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return (items ?? []).filter(item => {
      if (q && !item.name.toLowerCase().includes(q) && !item.sku.toLowerCase().includes(q)) return false;
      if (locFilter !== "all" && String(item.primaryLocationId) !== locFilter) return false;
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      return true;
    });
  }, [items, search, locFilter, statusFilter]);

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Package className="w-5 h-5 text-brand-700" />
          <h1 className="text-2xl font-display font-bold text-slate-900">Inventory</h1>
        </div>
        <p className="text-slate-500 text-sm">Search and view stock levels (read-only).</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search by name or SKU…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
            data-testid="field-inv-search"
          />
        </div>
        <Select value={locFilter} onValueChange={setLoc}>
          <SelectTrigger className="w-44 h-9 text-sm" data-testid="field-inv-location-filter">
            <SelectValue placeholder="Location" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All locations</SelectItem>
            {(locations ?? []).map(l => (
              <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatus}>
          <SelectTrigger className="w-36 h-9 text-sm" data-testid="field-inv-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="in_stock">In Stock</SelectItem>
            <SelectItem value="low_stock">Low Stock</SelectItem>
            <SelectItem value="out_of_stock">Out of Stock</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="premium-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 border-b border-slate-200">
                <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-2 pl-5">SKU</TableHead>
                <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-2">Item</TableHead>
                <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-2">Location</TableHead>
                <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-2 text-right">Qty</TableHead>
                <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-2 text-center pr-5">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-slate-400">Loading…</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-slate-400">
                    {search ? "No items match your search." : "No items found."}
                  </TableCell>
                </TableRow>
              ) : filtered.map(item => (
                <TableRow key={item.id} className="hover:bg-slate-50/60 transition-colors" data-testid={`field-inv-row-${item.id}`}>
                  <TableCell className="py-2.5 pl-5 font-mono text-xs text-slate-500">{item.sku}</TableCell>
                  <TableCell className="py-2.5">
                    <p className="text-sm font-medium text-slate-800">{item.name}</p>
                    {item.sizeLabel && (
                      <p className="text-xs text-slate-400">{item.sizeLabel}</p>
                    )}
                  </TableCell>
                  <TableCell className="py-2.5 text-sm text-slate-600">
                    {item.location?.name ?? "—"}
                  </TableCell>
                  <TableCell className="py-2.5 text-right font-semibold text-slate-900 tabular-nums">
                    {item.quantityOnHand.toLocaleString()}
                  </TableCell>
                  <TableCell className="py-2.5 pr-5">
                    <div className="flex justify-center">
                      <ItemStatusBadge status={item.status} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {filtered.length > 0 && (
          <div className="px-5 py-2.5 border-t border-slate-100 text-xs text-slate-400">
            Showing {filtered.length.toLocaleString()} item{filtered.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
}
