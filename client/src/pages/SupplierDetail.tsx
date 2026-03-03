import { useState } from "react";
import { useRoute } from "wouter";
import { useSupplier } from "@/hooks/use-reference-data";
import { ArrowLeft, Truck, Phone, Mail, Globe, Star, Package, AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ItemStatusBadge } from "@/components/StatusBadge";

function computeStatus(item: any): string {
  if (item.quantityOnHand === 0) return "out_of_stock";
  if (item.quantityOnHand <= item.reorderPoint) return "low_stock";
  return "in_stock";
}

export default function SupplierDetail() {
  const [, params] = useRoute("/suppliers/:id");
  const id = Number(params?.id || "0");
  const { data: supplier, isLoading } = useSupplier(id);

  if (isLoading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-slate-200 w-64 rounded" />
      <div className="h-48 bg-slate-200 rounded-2xl" />
    </div>
  );
  if (!supplier) return <div className="p-8 text-center text-slate-500">Supplier not found.</div>;

  const lowStockItems = supplier.items?.filter(i => computeStatus(i) !== 'in_stock') || [];

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Link href="/suppliers" className="p-2 hover:bg-white rounded-full text-slate-500 transition-colors mt-1">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
              <Truck className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-display font-bold text-slate-900">{supplier.name}</h1>
                {supplier.preferredVendor && (
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200 border gap-1 text-xs">
                    <Star className="w-3 h-3" />Preferred Vendor
                  </Badge>
                )}
              </div>
              {supplier.contactName && <p className="text-slate-500 mt-0.5">{supplier.contactName}</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {lowStockItems.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <p className="font-semibold text-amber-900">{lowStockItems.length} item{lowStockItems.length !== 1 ? 's' : ''} need reorder from this supplier</p>
              </div>
              <div className="space-y-2">
                {lowStockItems.slice(0, 5).map(item => (
                  <div key={item.id} className="flex justify-between items-center text-sm">
                    <Link href={`/inventory/${item.id}`} className="text-amber-800 font-medium hover:underline">{item.name}</Link>
                    <span className="text-amber-700">{item.quantityOnHand} {item.unitOfMeasure} remaining</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Card className="premium-card border-none">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-slate-900">
                  <Package className="w-4 h-4 inline mr-2 text-slate-400" />
                  Stocked Items ({supplier.items?.length || 0})
                </CardTitle>
              </div>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/80">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-semibold text-slate-600">SKU</TableHead>
                    <TableHead className="font-semibold text-slate-600">Name</TableHead>
                    <TableHead className="font-semibold text-slate-600 text-right">On Hand</TableHead>
                    <TableHead className="font-semibold text-slate-600 text-right">Unit Cost</TableHead>
                    <TableHead className="font-semibold text-slate-600">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!supplier.items?.length ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-slate-500">No items linked to this supplier.</TableCell>
                    </TableRow>
                  ) : supplier.items.map(item => (
                    <TableRow key={item.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-mono text-xs text-slate-400">{item.sku}</TableCell>
                      <TableCell>
                        <Link href={`/inventory/${item.id}`} className="font-medium text-slate-900 hover:text-blue-600">{item.name}</Link>
                      </TableCell>
                      <TableCell className="text-right font-medium">{item.quantityOnHand} <span className="text-slate-400 text-xs">{item.unitOfMeasure}</span></TableCell>
                      <TableCell className="text-right text-slate-600">{item.unitCost ? `$${parseFloat(item.unitCost).toFixed(2)}` : '—'}</TableCell>
                      <TableCell><ItemStatusBadge status={computeStatus(item)} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>

        <div>
          <Card className="premium-card border-none">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
              <CardTitle className="text-sm font-semibold text-slate-700">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4 text-sm">
              {supplier.phone && (
                <a href={`tel:${supplier.phone}`} className="flex items-center gap-3 text-slate-600 hover:text-blue-600">
                  <Phone className="w-4 h-4 text-slate-400" />{supplier.phone}
                </a>
              )}
              {supplier.email && (
                <a href={`mailto:${supplier.email}`} className="flex items-center gap-3 text-slate-600 hover:text-blue-600">
                  <Mail className="w-4 h-4 text-slate-400" />{supplier.email}
                </a>
              )}
              {supplier.website && (
                <a href={supplier.website} target="_blank" rel="noopener" className="flex items-center gap-3 text-slate-600 hover:text-blue-600">
                  <Globe className="w-4 h-4 text-slate-400" />{supplier.website}
                </a>
              )}
              {supplier.address && (
                <div className="flex items-start gap-3 text-slate-600">
                  <Truck className="w-4 h-4 text-slate-400 mt-0.5" />{supplier.address}
                </div>
              )}
              {supplier.accountNumber && (
                <div className="pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-400 mb-1">Account Number</p>
                  <p className="font-mono text-slate-700">{supplier.accountNumber}</p>
                </div>
              )}
              <div className="pt-3 border-t border-slate-100">
                <p className="text-xs text-slate-400 mb-1">Lead Time</p>
                <p className="font-semibold text-slate-900">{supplier.leadTimeDays != null ? `${supplier.leadTimeDays} days` : 'Unknown'}</p>
              </div>
              {supplier.notes && (
                <div className="pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-400 mb-1">Notes</p>
                  <p className="text-slate-600">{supplier.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
