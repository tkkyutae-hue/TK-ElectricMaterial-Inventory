import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useSupplier, useUpdateSupplier, useDeleteSupplier, useLocations } from "@/hooks/use-reference-data";
import { ArrowLeft, Truck, Phone, Mail, Globe, Star, Package, AlertTriangle, Pencil, Trash2, ShoppingCart, MapPin, Link2, X } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ItemStatusBadge } from "@/components/StatusBadge";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

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
  const { t } = useLanguage();
  const updateMutation = useUpdateSupplier();
  const deleteMutation = useDeleteSupplier();
  const [, navigate] = useLocation();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
    if (open) {
      form.reset({
        name:           supplier.name || "",
        contactName:    supplier.contactName || "",
        phone:          supplier.phone || "",
        email:          supplier.email || "",
        address:        supplier.address || "",
        leadTimeDays:   supplier.leadTimeDays ?? 0,
        preferredVendor: supplier.preferredVendor ?? false,
        notes:          supplier.notes || "",
      });
      setShowDeleteConfirm(false);
    }
  }, [open, supplier.id]);

  async function onSubmit(data: EditFormData) {
    try {
      await updateMutation.mutateAsync({ id: supplier.id, ...data });
      toast({ title: t.supplierDetailUpdatedToast, description: `${data.name} ${t.supplierDetailSavedDesc}` });
      onClose();
    } catch (err: any) {
      toast({ title: t.supplierDetailUpdateFailedToast, description: err.message, variant: "destructive" });
    }
  }

  async function handleDelete() {
    try {
      await deleteMutation.mutateAsync(supplier.id);
      toast({ title: t.supplierDetailDeletedToast, description: `${supplier.name} ${t.supplierDetailRemovedDesc}` });
      onClose();
      navigate("/suppliers");
    } catch (err: any) {
      toast({ title: t.supplierDetailCannotDeleteToast, description: err.message, variant: "destructive" });
      setShowDeleteConfirm(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t.supplierDetailEditTitlePrefix} {supplier.name}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>{t.supplierDetailNameLabel} <span className="text-red-500">*</span></FormLabel>
                <FormControl><Input data-testid="edit-supplier-name" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="contactName" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.supplierDetailContactPerson}</FormLabel>
                  <FormControl><Input placeholder={t.supplierContactNamePh} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="leadTimeDays" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.supplierDetailLeadTimeLbl}</FormLabel>
                  <FormControl><Input type="number" min={0} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.supplierDetailPhone}</FormLabel>
                  <FormControl><Input placeholder="555-0101" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.supplierDetailEmail}</FormLabel>
                  <FormControl><Input type="email" placeholder={t.supplierEmailPh} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="address" render={({ field }) => (
              <FormItem>
                <FormLabel>{t.supplierDetailAddress}</FormLabel>
                <FormControl><Input placeholder={t.supplierAddressPh} {...field} /></FormControl>
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
                    <p className="text-sm font-semibold text-amber-900">{t.supplierDetailPreferred}</p>
                    <p className="text-xs text-amber-700">{t.supplierDetailPreferredDesc}</p>
                  </div>
                  <Star className="w-4 h-4 text-amber-500 ml-auto" />
                </div>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>{t.supplierDetailNotes}</FormLabel>
                <FormControl><Textarea rows={2} className="resize-none" placeholder={t.supplierDetailNotesPh} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex justify-between items-center pt-2">
              <Button
                type="button"
                variant="ghost"
                className="text-red-500 hover:text-red-700 hover:bg-red-50 gap-1.5"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={updateMutation.isPending || deleteMutation.isPending}
                data-testid="button-delete-supplier"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t.cmnDelete}
              </Button>
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={onClose} disabled={updateMutation.isPending || deleteMutation.isPending}>{t.cmnCancel}</Button>
                <Button type="submit" className="bg-brand-700 hover:bg-brand-800" disabled={updateMutation.isPending || deleteMutation.isPending} data-testid="button-save-supplier">
                  {updateMutation.isPending ? t.cmnSaving : t.supplierDetailSaveChanges}
                </Button>
              </div>
            </div>

            {showDeleteConfirm && (
              <div className="mt-2 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-semibold text-red-900 mb-1">{t.supplierDetailDeleteConfirmPre}{supplier.name}{t.supplierDetailDeleteConfirmSuf}</p>
                <p className="text-xs text-red-700 mb-3">
                  {t.supplierDetailDeleteWarning}
                </p>
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={deleteMutation.isPending}
                  >
                    {t.cmnCancel}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                    data-testid="button-confirm-delete-supplier"
                  >
                    {deleteMutation.isPending ? t.supplierDetailDeleting : t.supplierDetailYesDelete}
                  </Button>
                </div>
              </div>
            )}
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
  const { data: allLocations = [] } = useLocations();
  const [editOpen, setEditOpen] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const { t } = useLanguage();
  const { isManagerOrAbove } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const linkMutation = useMutation({
    mutationFn: async ({ locationId, supplierId }: { locationId: number; supplierId: number }) => {
      const res = await apiRequest("PATCH", `/api/locations/${locationId}/supplier`, { supplierId });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/suppliers/:id", id] });
      qc.invalidateQueries({ queryKey: ["/api/locations"] });
      setSelectedLocationId("");
      toast({ title: t.supplierAssocLocLinkSuccess });
    },
    onError: (err: any) => {
      toast({ title: t.cmnError, description: err.message, variant: "destructive" });
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: async (locationId: number) => {
      const res = await apiRequest("DELETE", `/api/locations/${locationId}/supplier`);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/suppliers/:id", id] });
      qc.invalidateQueries({ queryKey: ["/api/locations"] });
      toast({ title: t.supplierAssocLocUnlinkSuccess });
    },
    onError: (err: any) => {
      toast({ title: t.cmnError, description: err.message, variant: "destructive" });
    },
  });

  const linkedLocations: any[] = supplier?.linkedLocations ?? [];
  const linkedLocationIds = new Set(linkedLocations.map((l: any) => l.id));
  const availableLocations = (allLocations as any[]).filter(
    (l: any) => l.isActive && l.supplierId == null
  );

  if (isLoading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-slate-200 w-64 rounded" />
      <div className="h-48 bg-slate-200 rounded-2xl" />
    </div>
  );
  if (!supplier) return <div className="p-8 text-center text-slate-500">{t.supplierDetailNotFound}</div>;

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
                      <Star className="w-3 h-3" />{t.supplierDetailPreferredBadge}
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
              {t.cmnEdit}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6" data-testid="supplier-detail-main">
          {lowStockItems.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <p className="font-semibold text-amber-900">{lowStockItems.length} {lowStockItems.length === 1 ? t.supplierDetailNeedReorderS : t.supplierDetailNeedReorderP}</p>
              </div>
              <div className="space-y-2">
                {lowStockItems.slice(0, 5).map((item: any) => (
                  <div key={item.id} className="flex justify-between items-center text-sm">
                    <Link href={`/inventory/${item.id}`} className="text-amber-800 font-medium hover:underline">{item.name}</Link>
                    <span className="text-amber-700">{item.quantityOnHand} {item.unitOfMeasure} {t.supplierDetailRemainingSuf}</span>
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
                  {t.supplierDetailStockedItems} ({supplier.items?.length || 0})
                </CardTitle>
              </div>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/80">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-semibold text-slate-600">{t.supplierDetailColSku}</TableHead>
                    <TableHead className="font-semibold text-slate-600">{t.supplierDetailColName}</TableHead>
                    <TableHead className="font-semibold text-slate-600 text-right">{t.supplierDetailColOnHand}</TableHead>
                    <TableHead className="font-semibold text-slate-600 text-right">{t.supplierDetailColUnitCost}</TableHead>
                    <TableHead className="font-semibold text-slate-600">{t.supplierDetailColStatus}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!supplier.items?.length ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-slate-500">{t.supplierDetailNoItems}</TableCell>
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

          <Card className="premium-card border-none" data-testid="supplier-recent-receipts">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
              <CardTitle className="text-base font-semibold text-slate-900">
                <ShoppingCart className="w-4 h-4 inline mr-2 text-slate-400" />
                {t.supplierDetailRecentReceipts}
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/80">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-semibold text-slate-600">{t.supplierDetailReceiptDate}</TableHead>
                    <TableHead className="font-semibold text-slate-600">{t.supplierDetailColSku}</TableHead>
                    <TableHead className="font-semibold text-slate-600">{t.supplierDetailReceiptItem}</TableHead>
                    <TableHead className="font-semibold text-slate-600 text-right">{t.supplierDetailReceiptQty}</TableHead>
                    <TableHead className="font-semibold text-slate-600">{t.supplierDetailReceiptBy}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!supplier.recentReceipts?.length ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-slate-500">{t.supplierDetailNoReceipts}</TableCell>
                    </TableRow>
                  ) : supplier.recentReceipts.map((r: any) => (
                    <TableRow key={r.id} className="hover:bg-slate-50/50" data-testid={`receipt-row-${r.id}`}>
                      <TableCell className="text-xs text-slate-500">
                        {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-400">{r.sku ?? "—"}</TableCell>
                      <TableCell>
                        <Link href={`/inventory/${r.itemId}`} className="font-medium text-slate-900 hover:text-brand-600 text-sm">
                          {r.itemName ?? "—"}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right font-medium text-sm">
                        {r.quantity} <span className="text-slate-400 text-xs">{r.unitOfMeasure}</span>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">{r.createdBy ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          <Card className="premium-card border-none" data-testid="supplier-assoc-locations">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-slate-900">
                  <MapPin className="w-4 h-4 inline mr-2 text-slate-400" />
                  {t.supplierAssocLocations}
                  {linkedLocations.length > 0 && (
                    <Badge className="ml-2 bg-brand-50 text-brand-700 border-brand-200 border text-xs font-medium">
                      {linkedLocations.length} {t.supplierAssocLocLinked}
                    </Badge>
                  )}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-3">
              {linkedLocations.length === 0 ? (
                <p className="text-sm text-slate-500 py-2">{t.supplierAssocLocEmpty}</p>
              ) : (
                <div className="space-y-2">
                  {linkedLocations.map((loc: any) => (
                    <div key={loc.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2.5" data-testid={`assoc-loc-${loc.id}`}>
                      <div className="flex items-center gap-2">
                        <Link2 className="w-3.5 h-3.5 text-brand-500" />
                        <span className="text-sm font-medium text-slate-800">{loc.name}</span>
                        {loc.code && <span className="font-mono text-xs text-slate-400">{loc.code}</span>}
                      </div>
                      {isManagerOrAbove && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-slate-400 hover:text-red-500 hover:bg-red-50"
                          onClick={() => {
                            if (window.confirm(t.supplierAssocLocUnlinkConfirm)) {
                              unlinkMutation.mutate(loc.id);
                            }
                          }}
                          disabled={unlinkMutation.isPending}
                          data-testid={`button-unlink-loc-${loc.id}`}
                        >
                          <X className="w-3.5 h-3.5" />
                          <span className="ml-1 text-xs">{t.supplierAssocLocUnlink}</span>
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {isManagerOrAbove && availableLocations.length > 0 && (
                <div className="flex gap-2 pt-1">
                  <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                    <SelectTrigger className="flex-1 h-9 text-sm" data-testid="select-link-location">
                      <SelectValue placeholder={t.supplierAssocLocSelect} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableLocations.map((loc: any) => (
                        <SelectItem key={loc.id} value={String(loc.id)}>
                          {loc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    className="h-9 bg-brand-700 hover:bg-brand-800 text-white gap-1.5 shrink-0"
                    onClick={() => {
                      if (!selectedLocationId) return;
                      linkMutation.mutate({ locationId: Number(selectedLocationId), supplierId: id });
                    }}
                    disabled={!selectedLocationId || linkMutation.isPending}
                    data-testid="button-link-location"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    {t.supplierAssocLocLink}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="premium-card border-none">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
              <CardTitle className="text-sm font-semibold text-slate-700">{t.supplierDetailContactInfo}</CardTitle>
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
                  <p className="text-xs text-slate-400 mb-1">{t.supplierDetailAccountNumber}</p>
                  <p className="font-mono text-slate-700">{supplier.accountNumber}</p>
                </div>
              )}
              <div className="pt-3 border-t border-slate-100">
                <p className="text-xs text-slate-400 mb-1">{t.supplierDetailLeadTimeLabel}</p>
                <p className="font-semibold text-slate-900">{supplier.leadTimeDays != null ? `${supplier.leadTimeDays} ${t.supplierDetailDays}` : t.supplierDetailUnknown}</p>
              </div>
              {supplier.notes && (
                <div className="pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-400 mb-1">{t.supplierDetailNotes}</p>
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
