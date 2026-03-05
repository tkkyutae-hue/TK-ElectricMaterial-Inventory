import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { useSupplier, useUpdateSupplier } from "@/hooks/use-reference-data";
import { ArrowLeft, Truck, Phone, Mail, Globe, Star, Package, AlertTriangle, Pencil } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ItemStatusBadge } from "@/components/StatusBadge";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";

function computeStatus(item: any): string {
  if (item.quantityOnHand === 0) return "out_of_stock";
  if (item.quantityOnHand <= item.reorderPoint) return "low_stock";
  return "in_stock";
}

const editSchema = z.object({
  name:           z.string().min(1, "Supplier name is required"),
  contactName:    z.string().optional(),
  phone:          z.string().optional(),
  email:          z.string().optional(),
  address:        z.string().optional(),
  leadTimeDays:   z.coerce.number().min(0).optional(),
  preferredVendor: z.boolean().optional(),
  notes:          z.string().optional(),
});

type EditFormData = z.infer<typeof editSchema>;

function EditSupplierDialog({ supplier, open, onClose }: { supplier: any; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const updateMutation = useUpdateSupplier();

  const form = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name:           supplier.name || "",
      contactName:    supplier.contactName || "",
      phone:          supplier.phone || "",
      email:          supplier.email || "",
      address:        supplier.address || "",
      leadTimeDays:   supplier.leadTimeDays ?? 0,
      preferredVendor: supplier.preferredVendor ?? false,
      notes:          supplier.notes || "",
    },
  });

  useEffect(() => {
    if (open) form.reset({
      name:           supplier.name || "",
      contactName:    supplier.contactName || "",
      phone:          supplier.phone || "",
      email:          supplier.email || "",
      address:        supplier.address || "",
      leadTimeDays:   supplier.leadTimeDays ?? 0,
      preferredVendor: supplier.preferredVendor ?? false,
      notes:          supplier.notes || "",
    });
  }, [open, supplier.id]);

  async function onSubmit(data: EditFormData) {
    try {
      await updateMutation.mutateAsync({ id: supplier.id, ...data });
      toast({ title: "Supplier updated", description: `${data.name} has been saved.` });
      onClose();
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Supplier — {supplier.name}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Supplier Name <span className="text-red-500">*</span></FormLabel>
                <FormControl><Input data-testid="edit-supplier-name" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="contactName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Person</FormLabel>
                  <FormControl><Input placeholder="John Doe" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="leadTimeDays" render={({ field }) => (
                <FormItem>
                  <FormLabel>Lead Time (days)</FormLabel>
                  <FormControl><Input type="number" min={0} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl><Input placeholder="555-0101" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl><Input type="email" placeholder="sales@supplier.com" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="address" render={({ field }) => (
              <FormItem>
                <FormLabel>Address</FormLabel>
                <FormControl><Input placeholder="123 Main St, City, ST 00000" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="preferredVendor" render={({ field }) => (
              <FormItem>
                <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 cursor-pointer" onClick={() => field.onChange(!field.value)}>
                  <input
                    type="checkbox"
                    checked={field.value ?? false}
                    onChange={e => field.onChange(e.target.checked)}
                    className="w-4 h-4 accent-amber-500"
                    data-testid="checkbox-preferred-vendor"
                  />
                  <div>
                    <p className="text-sm font-semibold text-amber-900">Preferred Vendor</p>
                    <p className="text-xs text-amber-700">Mark this supplier as preferred for purchasing decisions.</p>
                  </div>
                  <Star className="w-4 h-4 text-amber-500 ml-auto" />
                </div>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl><Textarea rows={2} className="resize-none" placeholder="Any relevant notes…" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={updateMutation.isPending}>Cancel</Button>
              <Button type="submit" className="bg-brand-700 hover:bg-brand-800" disabled={updateMutation.isPending} data-testid="button-save-supplier">
                {updateMutation.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function SupplierDetail() {
  const [, params] = useRoute("/suppliers/:id");
  const id = Number(params?.id || "0");
  const { data: supplier, isLoading } = useSupplier(id);
  const [editOpen, setEditOpen] = useState(false);

  if (isLoading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-slate-200 w-64 rounded" />
      <div className="h-48 bg-slate-200 rounded-2xl" />
    </div>
  );
  if (!supplier) return <div className="p-8 text-center text-slate-500">Supplier not found.</div>;

  const lowStockItems = supplier.items?.filter((i: any) => computeStatus(i) !== 'in_stock') || [];

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Link href="/suppliers" className="p-2 hover:bg-white rounded-full text-slate-500 transition-colors mt-1">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center">
                <Truck className="w-6 h-6 text-brand-600" />
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
            <Button
              variant="outline"
              size="sm"
              className="gap-2 shrink-0"
              onClick={() => setEditOpen(true)}
              data-testid="button-edit-supplier"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </Button>
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
                {lowStockItems.slice(0, 5).map((item: any) => (
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
                  ) : supplier.items.map((item: any) => (
                    <TableRow key={item.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-mono text-xs text-slate-400">{item.sku}</TableCell>
                      <TableCell>
                        <Link href={`/inventory/${item.id}`} className="font-medium text-slate-900 hover:text-brand-600">{item.name}</Link>
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
                <a href={`tel:${supplier.phone}`} className="flex items-center gap-3 text-slate-600 hover:text-brand-600">
                  <Phone className="w-4 h-4 text-slate-400" />{supplier.phone}
                </a>
              )}
              {supplier.email && (
                <a href={`mailto:${supplier.email}`} className="flex items-center gap-3 text-slate-600 hover:text-brand-600">
                  <Mail className="w-4 h-4 text-slate-400" />{supplier.email}
                </a>
              )}
              {supplier.website && (
                <a href={supplier.website} target="_blank" rel="noopener" className="flex items-center gap-3 text-slate-600 hover:text-brand-600">
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

      {editOpen && (
        <EditSupplierDialog
          supplier={supplier}
          open={editOpen}
          onClose={() => setEditOpen(false)}
        />
      )}
    </div>
  );
}
