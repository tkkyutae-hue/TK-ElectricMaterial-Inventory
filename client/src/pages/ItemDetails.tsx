import { useRoute } from "wouter";
import { useItem, useDeleteItem, useUpdateItem } from "@/hooks/use-items";
import { useTransactions } from "@/hooks/use-transactions";
import { useCategories, useLocations, useSuppliers } from "@/hooks/use-reference-data";
import { ItemStatusBadge, TransactionTypeBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ArrowLeft, Edit, Trash2, Box, MapPin, Tag, Truck, Save, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

const editSchema = z.object({
  sku:               z.string().min(1, "SKU is required"),
  name:              z.string().min(1, "Name is required"),
  sizeLabel:         z.string().optional(),
  categoryId:        z.coerce.number().min(1, "Category is required"),
  supplierId:        z.coerce.number().optional(),
  primaryLocationId: z.coerce.number().optional(),
  quantityOnHand:    z.coerce.number().min(0),
  minimumStock:      z.coerce.number().min(0),
  reorderPoint:      z.coerce.number().min(0),
  reorderQuantity:   z.coerce.number().min(0),
  unitCost:          z.string().optional(),
  unitOfMeasure:     z.string().min(1),
  statusOverride:    z.string().optional(),
  notes:             z.string().optional(),
  brand:             z.string().optional(),
});

type EditFormData = z.infer<typeof editSchema>;

function EditItemDialog({ item, open, onClose }: { item: any; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const updateMutation = useUpdateItem();
  const { data: categories } = useCategories();
  const { data: locations } = useLocations();
  const { data: suppliers } = useSuppliers();

  const makeDefaults = (i: any): EditFormData => ({
    sku:               i.sku || "",
    name:              i.name || "",
    sizeLabel:         i.sizeLabel || "",
    categoryId:        i.categoryId || 0,
    supplierId:        i.supplierId || undefined,
    primaryLocationId: i.primaryLocationId || undefined,
    quantityOnHand:    i.quantityOnHand ?? 0,
    minimumStock:      i.minimumStock ?? 0,
    reorderPoint:      i.reorderPoint ?? 0,
    reorderQuantity:   i.reorderQuantity ?? 0,
    unitCost:          i.unitCost?.toString() || "",
    unitOfMeasure:     i.unitOfMeasure || "EA",
    statusOverride:    i.statusOverride || "auto",
    notes:             i.notes || "",
    brand:             i.brand || "",
  });

  const form = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: makeDefaults(item),
  });

  useEffect(() => {
    if (open) form.reset(makeDefaults(item));
  }, [open, item.id]);

  async function onSubmit(data: EditFormData) {
    try {
      await updateMutation.mutateAsync({
        id: item.id,
        ...data,
        supplierId:        data.supplierId || null,
        primaryLocationId: data.primaryLocationId || null,
        statusOverride:    (data.statusOverride && data.statusOverride !== "auto") ? data.statusOverride : null,
        notes:             data.notes || null,
        brand:             data.brand || null,
        sizeLabel:         data.sizeLabel || null,
      });
      toast({ title: "Item updated", description: `${data.name} has been saved.` });
      onClose();
    } catch (err: any) {
      toast({ title: "Error saving item", description: err.message, variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">Edit — {item.name}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-1">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="sku" render={({ field }) => (
                <FormItem>
                  <FormLabel>SKU</FormLabel>
                  <FormControl><Input {...field} data-testid="edit-sku" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Item Name</FormLabel>
                  <FormControl><Input {...field} data-testid="edit-name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="sizeLabel" render={({ field }) => (
                <FormItem>
                  <FormLabel>Size Label</FormLabel>
                  <FormControl><Input placeholder='e.g. 3/4", #12, 20A 1P' {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="brand" render={({ field }) => (
                <FormItem>
                  <FormLabel>Brand</FormLabel>
                  <FormControl><Input placeholder="e.g. Allied, Southwire" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="categoryId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value?.toString()}>
                    <FormControl><SelectTrigger data-testid="edit-category"><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {categories?.map((c: any) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="supplierId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Supplier</FormLabel>
                  <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value?.toString()}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {suppliers?.map((s: any) => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="primaryLocationId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value?.toString()}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {locations?.map((l: any) => <SelectItem key={l.id} value={l.id.toString()}>{l.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="unitOfMeasure" render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit of Measure</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {["EA","FT","LF","PR","PKG","BOX","CTN","LB","ROLL"].map(u => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="quantityOnHand" render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity on Hand</FormLabel>
                  <FormControl><Input type="number" min={0} {...field} data-testid="edit-qty" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="unitCost" render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit Cost ($)</FormLabel>
                  <FormControl><Input type="number" step="0.01" min={0} placeholder="0.00" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="minimumStock" render={({ field }) => (
                <FormItem>
                  <FormLabel>Min Stock</FormLabel>
                  <FormControl><Input type="number" min={0} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="reorderPoint" render={({ field }) => (
                <FormItem>
                  <FormLabel>Reorder Point</FormLabel>
                  <FormControl><Input type="number" min={0} {...field} data-testid="edit-reorder-point" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="reorderQuantity" render={({ field }) => (
                <FormItem>
                  <FormLabel>Reorder Qty</FormLabel>
                  <FormControl><Input type="number" min={0} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="statusOverride" render={({ field }) => (
              <FormItem>
                <FormLabel>Status Override</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || "auto"}>
                  <FormControl><SelectTrigger data-testid="edit-status"><SelectValue placeholder="Auto (based on stock)" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="auto">Auto (based on stock level)</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="discontinued">Discontinued</SelectItem>
                    <SelectItem value="on_order">On Order</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl><Textarea placeholder="Internal notes…" rows={2} className="resize-none" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={updateMutation.isPending}>
                <X className="w-4 h-4 mr-1" /> Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={updateMutation.isPending} data-testid="button-save-item">
                <Save className="w-4 h-4 mr-1" />
                {updateMutation.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function ItemDetails() {
  const [, params] = useRoute("/inventory/:id");
  const id = parseInt(params?.id || "0");
  const [_, setLocation] = useLocation();

  const { data: item, isLoading } = useItem(id);
  const deleteMutation = useDeleteItem();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const handleDelete = () => {
    deleteMutation.mutate(id, {
      onSuccess: () => setLocation("/inventory")
    });
  };

  if (isLoading) return <div className="p-8 text-center animate-pulse text-slate-500">Loading item details…</div>;
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
          <Button variant="outline" className="bg-white" onClick={() => setEditOpen(true)} data-testid="button-edit-item">
            <Edit className="w-4 h-4 mr-2" /> Edit
          </Button>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)} className="bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 border-none">
            <Trash2 className="w-4 h-4 mr-2" /> Delete
          </Button>
        </div>
      </div>

      <EditItemDialog item={item} open={editOpen} onClose={() => setEditOpen(false)} />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Item</DialogTitle></DialogHeader>
          <p className="text-slate-600 pt-4">Are you sure you want to delete <strong>{item.name}</strong>? This cannot be undone.</p>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending} data-testid="button-confirm-delete">
              {deleteMutation.isPending ? "Deleting…" : "Yes, Delete"}
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
              {item.sizeLabel && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-sm text-slate-500 mb-1">Size</p>
                  <p className="font-semibold text-slate-800">{item.sizeLabel}</p>
                </div>
              )}
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
                  <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors" data-testid={`history-row-${tx.id}`}>
                    <div>
                      <TransactionTypeBadge type={tx.movementType} />
                      <p className="text-sm text-slate-500 mt-1">{format(new Date(tx.createdAt), 'MMM d, yyyy h:mm a')}</p>
                      {tx.note && <p className="text-xs text-slate-400 mt-0.5 max-w-xs truncate">{tx.note}</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-900">
                        {tx.movementType === 'issue' ? '-' : '+'}{tx.quantity} {item.unitOfMeasure}
                      </p>
                      <p className="text-xs text-slate-400">{tx.newQuantity} on hand after</p>
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
                  {item.binLocation && <p className="text-xs text-slate-400 mt-0.5">Bin: {item.binLocation}</p>}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Truck className="w-5 h-5 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-sm text-slate-500">Preferred Supplier</p>
                  <p className="font-medium text-slate-900">{item.supplier?.name || 'None'}</p>
                </div>
              </div>
              {item.brand && (
                <div className="flex items-start gap-3">
                  <Box className="w-5 h-5 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-slate-500">Brand</p>
                    <p className="font-medium text-slate-900">{item.brand}</p>
                  </div>
                </div>
              )}
              {item.notes && (
                <div className="pt-4 border-t border-slate-100">
                  <p className="text-sm text-slate-500 mb-1">Notes</p>
                  <p className="text-sm text-slate-700">{item.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
