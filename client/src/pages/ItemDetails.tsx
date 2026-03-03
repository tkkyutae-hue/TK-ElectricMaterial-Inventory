import { useRoute } from "wouter";
import { useItem, useDeleteItem, useUpdateItem } from "@/hooks/use-items";
import { useTransactions } from "@/hooks/use-transactions";
import { ItemStatusBadge, TransactionTypeBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit, Trash2, Box, MapPin, Tag, Truck } from "lucide-react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export default function ItemDetails() {
  const [, params] = useRoute("/inventory/:id");
  const id = parseInt(params?.id || "0");
  const [_, setLocation] = useLocation();
  
  const { data: item, isLoading } = useItem(id);
  const { data: transactions } = useTransactions({ itemId: id.toString() });
  const deleteMutation = useDeleteItem();
  
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleDelete = () => {
    deleteMutation.mutate(id, {
      onSuccess: () => setLocation("/inventory")
    });
  };

  if (isLoading) return <div className="p-8 text-center animate-pulse text-slate-500">Loading item details...</div>;
  if (!item) return <div className="p-8 text-center text-red-500">Item not found.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/inventory" className="p-2 hover:bg-white rounded-full text-slate-500 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-display font-bold text-slate-900">{item.name}</h1>
            <ItemStatusBadge status={item.status} />
          </div>
          <p className="font-mono text-slate-500 mt-1">SKU: {item.sku}</p>
        </div>
        <div className="flex gap-2">
          {/* Edit button would open a form similar to create, omitted for brevity but UI is present */}
          <Button variant="outline" className="bg-white"><Edit className="w-4 h-4 mr-2"/> Edit</Button>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)} className="bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 border-none">
            <Trash2 className="w-4 h-4 mr-2"/> Delete
          </Button>
        </div>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Item</DialogTitle>
          </DialogHeader>
          <p className="text-slate-600 pt-4">Are you sure you want to delete {item.name}? This action cannot be undone.</p>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting..." : "Yes, Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="premium-card border-none">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 rounded-t-2xl pb-4">
              <CardTitle className="text-lg font-display text-slate-900">Stock Information</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Quantity on Hand</p>
                  <p className="text-3xl font-display font-bold text-slate-900">{item.quantityOnHand} <span className="text-lg font-normal text-slate-400">{item.unitOfMeasure}</span></p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Min Stock Level</p>
                  <p className="text-xl font-semibold text-slate-700">{item.minimumStock}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Reorder Point</p>
                  <p className="text-xl font-semibold text-slate-700">{item.reorderPoint}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Unit Cost</p>
                  <p className="text-xl font-semibold text-slate-700">${item.unitCost || '0.00'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="premium-card border-none">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 rounded-t-2xl pb-4">
              <CardTitle className="text-lg font-display text-slate-900">Recent History</CardTitle>
            </CardHeader>
            <div className="divide-y divide-slate-100">
              {!item.movements || item.movements.length === 0 ? (
                <div className="p-8 text-center text-slate-500">No transaction history found.</div>
              ) : (
                item.movements.map((tx: any) => (
                  <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div>
                      <TransactionTypeBadge type={tx.movementType} />
                      <p className="text-sm text-slate-500 mt-1">{format(new Date(tx.createdAt), 'MMM d, yyyy h:mm a')}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-900">{tx.movementType === 'issue' ? '-' : '+'}{tx.quantity} {item.unitOfMeasure}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="premium-card border-none">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 rounded-t-2xl pb-4">
              <CardTitle className="text-lg font-display text-slate-900">Details</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <Tag className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm text-slate-500">Category</p>
                  <p className="font-medium text-slate-900">{item.category?.name || 'Uncategorized'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm text-slate-500">Location</p>
                  <p className="font-medium text-slate-900">{item.location?.name || 'Unassigned'}</p>
                  {item.bin && <p className="text-xs text-slate-400 mt-0.5">Bin: {item.bin}</p>}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Truck className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm text-slate-500">Preferred Supplier</p>
                  <p className="font-medium text-slate-900">{item.supplier?.name || 'None'}</p>
                </div>
              </div>
              {item.description && (
                <div className="pt-4 border-t border-slate-100">
                  <p className="text-sm text-slate-500 mb-1">Description</p>
                  <p className="text-sm text-slate-700">{item.description}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
