import { useRoute } from "wouter";
import { useItem, useDeleteItem, useUpdateItem } from "@/hooks/use-items";
import { useCategories, useLocations, useSuppliers } from "@/hooks/use-reference-data";
import { ItemStatusBadge, TransactionTypeBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  ArrowLeft, Edit, Trash2, Box, MapPin, Tag, Truck, Save, X as XIcon,
  ImageIcon, UploadCloud, PackageOpen, DollarSign, RefreshCw, Activity,
  ClipboardList,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { MovementForm } from "@/components/MovementForm";

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
                <XIcon className="w-4 h-4 mr-1" /> Cancel
              </Button>
              <Button type="submit" className="bg-brand-700 hover:bg-brand-800" disabled={updateMutation.isPending} data-testid="button-save-item">
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

function ItemImagePanel({ item, itemId }: { item: any; itemId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [uploading, setUploading] = useState(false);

  const currentImage = item.images?.[0]?.imageUrl || null;

  const updateImageMutation = useMutation({
    mutationFn: (imageUrl: string | null) =>
      apiRequest("PATCH", `/api/inventory/${itemId}/image`, { imageUrl }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/inventory", itemId] });
      toast({ title: "Image updated" });
    },
    onError: (err: any) =>
      toast({ title: "Failed to update image", description: err.message, variant: "destructive" }),
  });

  async function uploadFile(file: File) {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast({ title: "Unsupported file type", description: "Please use JPG, PNG, or WEBP.", variant: "destructive" });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 8 MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload/item-image", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Upload failed");
      }
      const { url } = await res.json();
      await updateImageMutation.mutateAsync(url);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  }

  async function handleUrlSet() {
    const url = urlInput.trim();
    if (!url) return;
    await updateImageMutation.mutateAsync(url);
    setUrlInput("");
    setShowUrlInput(false);
  }

  const busy = uploading || updateImageMutation.isPending;

  return (
    <div className="space-y-2.5">
      <div
        className={`relative rounded-2xl overflow-hidden border-2 transition-all cursor-pointer group ${
          dragOver
            ? "border-brand-400 bg-brand-50/60 shadow-lg shadow-brand-100"
            : currentImage
            ? "border-slate-200 hover:border-brand-300"
            : "border-dashed border-slate-300 bg-slate-50 hover:border-brand-300 hover:bg-brand-50/30"
        }`}
        style={{ aspectRatio: "1 / 1" }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !busy && fileInputRef.current?.click()}
        data-testid="image-drop-zone"
      >
        {busy ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/85 backdrop-blur-sm">
            <div className="w-9 h-9 border-[3px] border-brand-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-500 mt-3 font-medium">
              {uploading ? "Uploading…" : "Saving…"}
            </p>
          </div>
        ) : currentImage ? (
          <>
            <img
              src={currentImage}
              alt={item.name}
              className="w-full h-full object-contain p-3"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                (e.currentTarget.nextElementSibling as HTMLElement)?.classList.remove("hidden");
              }}
            />
            <div className="hidden absolute inset-0 flex-col items-center justify-center text-slate-300">
              <ImageIcon className="w-14 h-14" />
              <p className="text-sm mt-2 text-slate-400">Image unavailable</p>
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/25 rounded-2xl">
              <UploadCloud className="w-8 h-8 text-white mb-1.5" />
              <span className="text-white text-sm font-medium">Replace image</span>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 select-none">
            {dragOver ? (
              <>
                <UploadCloud className="w-14 h-14 text-brand-400 mb-2" />
                <p className="text-sm font-semibold text-brand-500">Drop to upload</p>
              </>
            ) : (
              <>
                <ImageIcon className="w-14 h-14 text-slate-300 mb-2" />
                <p className="text-sm font-medium text-slate-500">Drop image here</p>
                <p className="text-xs text-slate-400 mt-0.5">or click to upload</p>
                <p className="text-[11px] text-slate-300 mt-2">JPG · PNG · WEBP · max 8 MB</p>
              </>
            )}
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        className="hidden"
        onChange={handleFileInput}
        data-testid="file-input-image"
      />

      {showUrlInput ? (
        <div className="flex gap-2">
          <Input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://… image URL"
            className="text-xs h-8"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleUrlSet();
              if (e.key === "Escape") { setShowUrlInput(false); setUrlInput(""); }
            }}
            autoFocus
            data-testid="input-image-url"
          />
          <Button
            size="sm"
            className="h-8 px-3 bg-brand-700 hover:bg-brand-800 text-xs shrink-0"
            onClick={handleUrlSet}
            disabled={!urlInput.trim() || busy}
          >
            Set
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 shrink-0"
            onClick={() => { setShowUrlInput(false); setUrlInput(""); }}
          >
            <XIcon className="w-3.5 h-3.5" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <button
            className="text-xs text-brand-600 hover:underline transition-colors"
            onClick={() => setShowUrlInput(true)}
            data-testid="button-set-image-url"
          >
            {currentImage ? "Change URL" : "Paste image URL"}
          </button>
          {currentImage && (
            <button
              className="text-xs text-rose-500 hover:underline transition-colors ml-auto"
              onClick={() => updateImageMutation.mutate(null)}
              disabled={busy}
              data-testid="button-clear-image"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon?: any }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </dt>
      <dd className="text-sm font-semibold text-slate-800">{value || <span className="text-slate-400 font-normal">—</span>}</dd>
    </div>
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
  const [movementOpen, setMovementOpen] = useState(false);

  const handleDelete = () => {
    deleteMutation.mutate(id, {
      onSuccess: () => setLocation("/inventory"),
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-6 w-48 bg-slate-100 rounded animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 aspect-square bg-slate-100 rounded-2xl animate-pulse" />
          <div className="lg:col-span-3 space-y-4">
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-8 bg-slate-100 rounded-xl animate-pulse" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <PackageOpen className="w-16 h-16 text-slate-300" />
        <p className="text-lg font-medium text-slate-500">Item not found.</p>
        <Link href="/inventory"><Button variant="outline">← Back to Inventory</Button></Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/inventory" className="hover:text-brand-600 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />Inventory
        </Link>
        {item.category && (
          <>
            <span>/</span>
            <Link
              href={`/inventory/category/${item.categoryId}`}
              className="hover:text-brand-600 transition-colors"
            >
              {item.category.name}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="text-slate-800 font-medium truncate max-w-[200px]">{item.name}</span>
      </div>

      {/* Product hero — 2 column */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-0">

          {/* LEFT: Image panel */}
          <div className="lg:col-span-2 p-6 border-b lg:border-b-0 lg:border-r border-slate-100 bg-slate-50/40">
            <ItemImagePanel item={item} itemId={id} />
          </div>

          {/* RIGHT: Item info */}
          <div className="lg:col-span-3 p-6 space-y-5">

            {/* Name + status + actions */}
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-2xl font-display font-bold text-slate-900 leading-tight" data-testid="item-name">
                    {item.name}
                  </h1>
                  <ItemStatusBadge status={item.status} />
                </div>
                <p className="font-mono text-slate-500 text-sm mt-1" data-testid="item-sku">
                  SKU: {item.sku}
                </p>
              </div>
              <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-white border-slate-200 hover:border-brand-300 hover:text-brand-600"
                  onClick={() => setEditOpen(true)}
                  data-testid="button-edit-item"
                >
                  <Edit className="w-3.5 h-3.5 mr-1.5" />Edit
                </Button>
                <Button
                  size="sm"
                  className="bg-brand-700 hover:bg-brand-800 text-white"
                  onClick={() => setMovementOpen(true)}
                  data-testid="button-log-movement"
                >
                  <Activity className="w-3.5 h-3.5 mr-1.5" />Log Movement
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                  onClick={() => setDeleteOpen(true)}
                  data-testid="button-delete-item"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <div className="h-px bg-slate-100" />

            {/* Primary stock info */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
              <div className="sm:col-span-1">
                <dt className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Qty on Hand</dt>
                <dd className="mt-0.5">
                  <span className="text-3xl font-display font-bold text-slate-900" data-testid="item-quantity">
                    {item.quantityOnHand.toLocaleString()}
                  </span>
                  <span className="text-base text-slate-400 ml-1.5 font-medium">{item.unitOfMeasure}</span>
                </dd>
              </div>
              <InfoRow label="Size" value={item.sizeLabel} icon={Tag} />
              <InfoRow label="Location" value={item.location?.name} icon={MapPin} />
            </div>

            <div className="h-px bg-slate-100" />

            {/* Secondary info grid */}
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
              <InfoRow label="Supplier" value={item.supplier?.name} icon={Truck} />
              <InfoRow label="Brand" value={item.brand} icon={Box} />
              <InfoRow
                label="Unit Cost"
                value={item.unitCost && parseFloat(item.unitCost) > 0 ? `$${parseFloat(item.unitCost).toFixed(2)}` : null}
                icon={DollarSign}
              />
              <InfoRow label="Reorder Point" value={item.reorderPoint > 0 ? item.reorderPoint.toLocaleString() : null} icon={RefreshCw} />
              <InfoRow label="Reorder Qty" value={item.reorderQuantity > 0 ? item.reorderQuantity.toLocaleString() : null} icon={ClipboardList} />
              <InfoRow label="Min Stock" value={item.minimumStock > 0 ? item.minimumStock.toLocaleString() : null} />
            </dl>

            {item.notes && (
              <>
                <div className="h-px bg-slate-100" />
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Notes</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{item.notes}</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Recent History */}
      <Card className="premium-card border-none">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 rounded-t-2xl pb-4">
          <CardTitle className="text-lg font-display text-slate-900">Recent History</CardTitle>
        </CardHeader>
        <div className="divide-y divide-slate-100">
          {!item.movements || item.movements.length === 0 ? (
            <div className="p-10 text-center text-slate-400">
              <Activity className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-medium">No movement history yet.</p>
            </div>
          ) : (
            item.movements.map((tx: any) => (
              <div
                key={tx.id}
                className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50/70 transition-colors"
                data-testid={`history-row-${tx.id}`}
              >
                <div>
                  <TransactionTypeBadge type={tx.movementType} />
                  <p className="text-xs text-slate-400 mt-1">{format(new Date(tx.createdAt), "MMM d, yyyy · h:mm a")}</p>
                  {tx.note && <p className="text-xs text-slate-500 mt-0.5 max-w-sm truncate">{tx.note}</p>}
                </div>
                <div className="text-right">
                  <p className={`font-semibold text-sm ${tx.movementType === "issue" ? "text-rose-600" : "text-emerald-600"}`}>
                    {tx.movementType === "issue" ? "−" : "+"}{tx.quantity} {item.unitOfMeasure}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{tx.newQuantity} on hand after</p>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Dialogs */}
      <EditItemDialog item={item} open={editOpen} onClose={() => setEditOpen(false)} />

      <Dialog open={movementOpen} onOpenChange={setMovementOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Log Movement — {item.name}</DialogTitle>
          </DialogHeader>
          <div className="pt-2">
            <MovementForm
              defaultItemId={id}
              onSuccess={() => setMovementOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Item</DialogTitle></DialogHeader>
          <p className="text-slate-600 pt-4">
            Are you sure you want to delete <strong>{item.name}</strong>? This cannot be undone.
          </p>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending} data-testid="button-confirm-delete">
              {deleteMutation.isPending ? "Deleting…" : "Yes, Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
