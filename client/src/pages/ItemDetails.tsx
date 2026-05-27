import { useRoute } from "wouter";
import { BRAND_ABBREV, abbreviateWord, generateReelId } from "@/lib/reel-utils";
import { parseWireConfig } from "@/lib/wire-config-utils";
import { shouldShowReelUI } from "@/lib/reelEligibility";
import { useItem, useDeleteItem, useUpdateItem } from "@/hooks/use-items";
import { useCategories, useLocations, useSuppliers } from "@/hooks/use-reference-data";
import { ItemStatusBadge, TransactionTypeBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  ArrowLeft, Edit, Trash2, Tag, Save, X as XIcon,
  ImageIcon, UploadCloud, PackageOpen, DollarSign, RefreshCw, Activity,
  ClipboardList, Layers, Plus, Pencil, Check,
  ChevronLeft, ChevronRight, Star, Camera, Eye,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/use-auth";
import type { ItemImage } from "@shared/schema";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useRef, useEffect, forwardRef, useImperativeHandle, type Ref } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import type { Translations } from "@/lib/i18n";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { api } from "@shared/routes";
import { MovementForm } from "@/components/MovementForm";

const makeEditSchema = (t: Translations) => z.object({
  sku:               z.string().min(1, t.itemDetailSkuRequired),
  name:              z.string().min(1, t.itemDetailNameRequired),
  baseItemName:      z.string().optional(),
  sizeLabel:         z.string().optional(),
  categoryId:        z.coerce.number().min(1, "Category is required"),
  subcategory:       z.string().optional(),
  detailType:        z.string().optional(),
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

type EditFormData = z.infer<ReturnType<typeof makeEditSchema>>;

function EditItemDialog({ item, open, onClose }: { item: any; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const updateMutation = useUpdateItem();
  const { data: categories } = useCategories();
  const { data: locations } = useLocations();
  const { data: suppliers } = useSuppliers();

  const makeDefaults = (i: any): EditFormData => ({
    sku:               i.sku || "",
    name:              i.name || "",
    baseItemName:      i.baseItemName || "",
    sizeLabel:         i.sizeLabel || "",
    categoryId:        i.categoryId || 0,
    subcategory:       i.subcategory || "",
    detailType:        i.detailType || "",
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
    resolver: zodResolver(makeEditSchema(t)),
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
        baseItemName:      data.baseItemName || null,
        subcategory:       data.subcategory || null,
        detailType:        data.detailType || null,
        supplierId:        data.supplierId || null,
        primaryLocationId: data.primaryLocationId || null,
        statusOverride:    (data.statusOverride && data.statusOverride !== "auto") ? data.statusOverride : null,
        notes:             data.notes || null,
        brand:             data.brand || null,
        sizeLabel:         data.sizeLabel || null,
      });
      toast({ title: t.itemDetailUpdatedToast, description: `${data.name} ${t.itemDetailSavedSuffix}` });
      onClose();
    } catch (err: any) {
      toast({ title: t.itemDetailErrorSavingItem, description: err.message, variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">{t.itemDetailEditPrefix} — {item.name}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-1">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="sku" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.itemDetailFieldSku}</FormLabel>
                  <FormControl><Input {...field} data-testid="edit-sku" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.itemDetailFieldName}</FormLabel>
                  <FormControl><Input {...field} data-testid="edit-name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="baseItemName" render={({ field }) => (
              <FormItem>
                <FormLabel>{t.itemDetailFieldBaseName} <span className="text-xs font-normal text-muted-foreground">{t.itemDetailFieldBaseNameHint}</span></FormLabel>
                <FormControl><Input placeholder={t.itemDetailBaseNamePh} {...field} data-testid="edit-base-item-name" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="subcategory" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.itemDetailFieldSubcat}</FormLabel>
                  <FormControl><Input placeholder={t.itemDetailSubcatPh} {...field} data-testid="edit-subcategory" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="detailType" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.itemDetailFieldDetailType}</FormLabel>
                  <FormControl><Input placeholder={t.itemDetailDetailTypePh} {...field} data-testid="edit-detail-type" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="sizeLabel" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.itemDetailFieldSizeLabel}</FormLabel>
                  <FormControl><Input placeholder={t.itemDetailSizeLabelPh} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="brand" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.itemDetailFieldBrand}</FormLabel>
                  <FormControl><Input placeholder={t.itemDetailBrandPh} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="categoryId" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.itemDetailFieldCategory}</FormLabel>
                  <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value?.toString()}>
                    <FormControl><SelectTrigger data-testid="edit-category"><SelectValue placeholder={t.itemDetailSelectPh} /></SelectTrigger></FormControl>
                    <SelectContent>
                      {categories?.map((c: any) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="supplierId" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.itemDetailFieldSupplier}</FormLabel>
                  <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value?.toString()}>
                    <FormControl><SelectTrigger><SelectValue placeholder={t.itemDetailSelectPh} /></SelectTrigger></FormControl>
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
                  <FormLabel>{t.itemDetailFieldLocation}</FormLabel>
                  <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value?.toString()}>
                    <FormControl><SelectTrigger><SelectValue placeholder={t.itemDetailSelectPh} /></SelectTrigger></FormControl>
                    <SelectContent>
                      {locations?.map((l: any) => <SelectItem key={l.id} value={l.id.toString()}>{l.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="unitOfMeasure" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.itemDetailFieldUOM}</FormLabel>
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
                  <FormLabel>{t.itemDetailFieldQty}</FormLabel>
                  <FormControl><Input type="number" min={0} {...field} data-testid="edit-qty" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="unitCost" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.itemDetailFieldUnitCostUsd}</FormLabel>
                  <FormControl><Input type="number" step="0.01" min={0} placeholder={t.itemDetailUnitCostPh} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="minimumStock" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.itemDetailMinStock}</FormLabel>
                  <FormControl><Input type="number" min={0} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="reorderPoint" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.itemDetailReorderPoint}</FormLabel>
                  <FormControl><Input type="number" min={0} {...field} data-testid="edit-reorder-point" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="reorderQuantity" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.itemDetailReorderQty}</FormLabel>
                  <FormControl><Input type="number" min={0} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="statusOverride" render={({ field }) => (
              <FormItem>
                <FormLabel>{t.itemDetailFieldStatusOverride}</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || "auto"}>
                  <FormControl><SelectTrigger data-testid="edit-status"><SelectValue placeholder={t.itemDetailStatusAutoPh} /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="auto">{t.itemDetailStatusAuto}</SelectItem>
                    <SelectItem value="active">{t.itemDetailStatusActive}</SelectItem>
                    <SelectItem value="discontinued">{t.itemDetailStatusDiscontinued}</SelectItem>
                    <SelectItem value="on_order">{t.itemDetailStatusOnOrder}</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>{t.itemDetailNotes}</FormLabel>
                <FormControl><Textarea placeholder={t.itemDetailNotesPh} rows={2} className="resize-none" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={updateMutation.isPending}>
                <XIcon className="w-4 h-4 mr-1" /> {t.cmnCancel}
              </Button>
              <Button type="submit" className="bg-brand-700 hover:bg-brand-800" disabled={updateMutation.isPending} data-testid="button-save-item">
                <Save className="w-4 h-4 mr-1" />
                {updateMutation.isPending ? t.itemDetailSavingDots : t.itemDetailSaveChanges}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function ItemGalleryPanel({ item, itemId }: { item: any; itemId: number }) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const qc = useQueryClient();
  const { isManagerOrAbove } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const { data: images = [] } = useQuery<ItemImage[]>({
    queryKey: ["/api/inventory", itemId, "images"],
    queryFn: () => fetch(`/api/inventory/${itemId}/images`, { credentials: "include" }).then(r => r.json()),
  });

  useEffect(() => {
    if (images.length > 0 && activeIdx >= images.length) setActiveIdx(images.length - 1);
  }, [images.length, activeIdx]);

  const canAdd = images.length < 4;
  const activeImage = images[activeIdx] ?? null;

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ["/api/inventory", itemId, "images"] });
    qc.invalidateQueries({ queryKey: [api.items.get.path, itemId] });
    qc.invalidateQueries({ queryKey: ["/api/inventory/categories/summary"] });
  }

  const appendMutation = useMutation({
    mutationFn: (imageUrl: string) =>
      apiRequest("POST", `/api/inventory/${itemId}/images`, { imageUrl }),
    onSuccess: invalidateAll,
    onError: (err: any) =>
      toast({ title: t.itemDetailUploadFailed, description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (imageId: number) =>
      apiRequest("DELETE", `/api/inventory/${itemId}/images/${imageId}`),
    onSuccess: () => { invalidateAll(); setPendingDeleteId(null); },
    onError: (err: any) => {
      toast({ title: t.itemDetailUploadFailed, description: err.message, variant: "destructive" });
      setPendingDeleteId(null);
    },
  });

  const primaryMutation = useMutation({
    mutationFn: (imageId: number) =>
      apiRequest("PATCH", `/api/inventory/${itemId}/images/${imageId}/primary`),
    onSuccess: () => { invalidateAll(); setActiveIdx(0); },
    onError: (err: any) =>
      toast({ title: t.itemDetailUploadFailed, description: err.message, variant: "destructive" }),
  });

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const slots = 4 - images.length;
    if (slots <= 0) {
      toast({ description: t.itemDetailMaxPhotosReached, variant: "destructive" });
      return;
    }
    const fileArr = Array.from(files);
    const toUpload = fileArr.slice(0, slots);
    if (fileArr.length > slots) {
      toast({ description: t.itemDetailSkippedFiles.replace("{n}", String(fileArr.length - slots)) });
    }
    let appendCount = 0;
    for (const file of toUpload) {
      const nameLower = file.name.toLowerCase();
      if (
        file.type === "image/heic" || file.type === "image/heif" ||
        nameLower.endsWith(".heic") || nameLower.endsWith(".heif")
      ) {
        toast({ title: t.itemDetailHeicNotSupported, variant: "destructive" });
        continue;
      }
      const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
      if (!allowed.includes(file.type)) {
        toast({ title: t.itemDetailUnsupportedType, description: t.itemDetailUnsupportedTypeDesc, variant: "destructive" });
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: t.itemDetailFileTooLarge, description: t.itemDetailFileTooLargeDesc, variant: "destructive" });
        continue;
      }
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload/item-image", { method: "POST", body: formData });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.message || t.itemDetailUploadFailed);
        }
        const { url } = await res.json();
        await appendMutation.mutateAsync(url);
        setActiveIdx(images.length + appendCount);
        appendCount++;
      } catch (err: any) {
        toast({ title: t.itemDetailUploadFailed, description: err.message, variant: "destructive" });
      } finally {
        setUploading(false);
      }
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    uploadFiles(e.target.files);
    e.target.value = "";
  }

  const busy = uploading || appendMutation.isPending || deleteMutation.isPending || primaryMutation.isPending;

  return (
    <div className="space-y-3">
      {/* Main image */}
      <div
        className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-50"
        style={{ aspectRatio: "1 / 1" }}
      >
        {activeImage ? (
          <>
            <img
              src={activeImage.imageUrl}
              alt={(activeImage as any).altText ?? item.name}
              className="w-full h-full object-contain p-3"
              data-testid="img-gallery-main"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
            {images.length > 1 && (
              <>
                <button
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full w-7 h-7 flex items-center justify-center shadow-sm opacity-70 hover:opacity-100 transition-opacity"
                  onClick={() => setActiveIdx(i => (i - 1 + images.length) % images.length)}
                  data-testid="btn-gallery-prev"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-700" />
                </button>
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full w-7 h-7 flex items-center justify-center shadow-sm opacity-70 hover:opacity-100 transition-opacity"
                  onClick={() => setActiveIdx(i => (i + 1) % images.length)}
                  data-testid="btn-gallery-next"
                >
                  <ChevronRight className="w-4 h-4 text-slate-700" />
                </button>
              </>
            )}
          </>
        ) : (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 select-none"
            data-testid="image-drop-zone"
          >
            <ImageIcon className="w-14 h-14 text-slate-300 mb-2" />
            <p className="text-sm font-medium text-slate-500">{t.itemDetailDropImageHere}</p>
            {isManagerOrAbove && <p className="text-xs text-slate-400 mt-0.5">{t.itemDetailOrClickToUpload}</p>}
            <p className="text-[11px] text-slate-300 mt-2">{t.itemDetailImageHint}</p>
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm rounded-2xl">
            <div className="w-8 h-8 border-[3px] border-brand-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-500 mt-2">{uploading ? t.itemDetailUploadingDots : t.itemDetailSavingDots}</p>
          </div>
        )}
      </div>

      {/* Photo count (manager only) */}
      {isManagerOrAbove && (
        <p className="text-xs font-medium text-slate-500">
          {t.itemDetailGalleryLabel}{" "}
          <span className="font-bold text-slate-700">{t.itemDetailPhotoCount.replace("{current}", String(images.length))}</span>
        </p>
      )}

      {/* 4-slot thumbnail grid */}
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, idx) => {
          const img = images[idx];
          const isPrimary = idx === 0;
          const isActive = idx === activeIdx;

          if (img) {
            const thumbnail = (
              <div
                className={`relative rounded-lg overflow-hidden bg-slate-100 cursor-pointer transition-all ${
                  isActive ? "ring-2 ring-brand-500 shadow-sm" : "ring-1 ring-slate-200 hover:ring-brand-300"
                }`}
                style={{ aspectRatio: "1 / 1" }}
                data-testid={`thumbnail-image-${img.id}`}
              >
                <img
                  src={img.imageUrl}
                  alt={(img as any).altText ?? `Photo ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
                {isPrimary && (
                  <div className="absolute top-0.5 left-0.5 w-5 h-5 flex items-center justify-center pointer-events-none">
                    <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 drop-shadow-sm" />
                  </div>
                )}
              </div>
            );

            if (isManagerOrAbove) {
              return (
                <DropdownMenu key={img.id}>
                  <DropdownMenuTrigger asChild>{thumbnail}</DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-44">
                    <DropdownMenuItem
                      onClick={() => setActiveIdx(idx)}
                      data-testid={`menu-view-${img.id}`}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      {t.itemDetailViewPhoto}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={isPrimary || primaryMutation.isPending}
                      onClick={() => { if (!isPrimary) primaryMutation.mutate(img.id); }}
                      data-testid={`menu-primary-${img.id}`}
                    >
                      <Star className="w-4 h-4 mr-2" />
                      {t.itemDetailSetPrimary}
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled>
                      {/* TODO: Replace Photo — individual image replacement API not yet implemented */}
                      <UploadCloud className="w-4 h-4 mr-2" />
                      {t.itemDetailReplacePhoto}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-rose-600 focus:text-rose-600 focus:bg-rose-50"
                      onClick={() => setPendingDeleteId(img.id)}
                      data-testid={`menu-delete-${img.id}`}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      {t.itemDetailDeletePhoto}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            }

            return (
              <div key={img.id} onClick={() => setActiveIdx(idx)}>
                {thumbnail}
              </div>
            );
          }

          if (isManagerOrAbove && canAdd) {
            return (
              <DropdownMenu key={`empty-${idx}`}>
                <DropdownMenuTrigger asChild>
                  <div
                    className="relative rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/60 flex items-center justify-center transition-colors cursor-pointer hover:border-brand-300 hover:bg-brand-50/30"
                    style={{ aspectRatio: "1 / 1" }}
                    data-testid={`thumbnail-empty-${idx}`}
                  >
                    <Plus className="w-4 h-4 text-slate-300" />
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-44">
                  <DropdownMenuItem
                    onClick={() => fileRef.current?.click()}
                    data-testid="menu-upload-photo"
                  >
                    <UploadCloud className="w-4 h-4 mr-2" />
                    {t.itemDetailUploadPhoto}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => cameraRef.current?.click()}
                    data-testid="menu-take-photo"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    {t.itemDetailTakePhoto}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-slate-400" data-testid="menu-cancel-slot">
                    {t.itemDetailDeletePhotoCancel}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            );
          }

          return (
            <div
              key={`empty-${idx}`}
              className="relative rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/60"
              style={{ aspectRatio: "1 / 1" }}
              data-testid={`thumbnail-empty-${idx}`}
            />
          );
        })}
      </div>

      {!canAdd && isManagerOrAbove && (
        <p className="text-[11px] text-slate-400 text-center">{t.itemDetailMaxPhotosReached}</p>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.itemDetailDeletePhotoTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.itemDetailDeletePhotoConfirm}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setPendingDeleteId(null)}
              data-testid="btn-delete-cancel"
            >
              {t.itemDetailDeletePhotoCancel}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700 focus:ring-rose-600"
              onClick={() => { if (pendingDeleteId !== null) deleteMutation.mutate(pendingDeleteId); }}
              disabled={deleteMutation.isPending}
              data-testid="btn-delete-confirm"
            >
              {t.itemDetailDeletePhotoDelete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <input ref={fileRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" multiple className="hidden" onChange={handleFileInput} data-testid="file-input-gallery" />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileInput} data-testid="file-input-camera" />
    </div>
  );
}

// ── Wire Reel Inventory ───────────────────────────────────────────────────────

type WireReelLocal = {
  id: number;
  itemId: number;
  reelId: string;
  lengthFt: number;
  brand: string | null;
  status: string | null;
  notes: string | null;
  supplier: { id: number; name: string } | null;
  location: { id: number; name: string } | null;
  supplierId: number | null;
  locationId: number | null;
};

type AddReelDraft = {
  lengthFt: string;
  brand: string;
  locationId: string;
  status: "new" | "used";
};

type EditReelDraft = {
  reelId: string;
  lengthFt: string;
  brand: string;
  locationId: string;
  status: string;
};

const REEL_STATUS_COLORS: Record<string, string> = {
  new: "bg-emerald-100 text-emerald-700",
  used: "bg-amber-100 text-amber-700",
};
const REEL_STATUS_LABELS: Record<string, string> = {
  new: "New", used: "Used",
};

const BLANK_REEL_DRAFT: AddReelDraft = {
  lengthFt: "", brand: "", locationId: "", status: "new",
};


function ReelStatusBadge({ status }: { status: string | null }) {
  const s = status || "new";
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium ${REEL_STATUS_COLORS[s] ?? "bg-slate-100 text-slate-600"}`}>
      {REEL_STATUS_LABELS[s] ?? s}
    </span>
  );
}

function WireConfigBadge({ coreType }: { coreType: string | null }) {
  if (!coreType) return <span className="text-slate-300 text-xs">—</span>;
  const isMulti = coreType === "Multi Core";
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${isMulti ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700"}`}>
      {coreType}
    </span>
  );
}

type WireReelInlineHandle = {
  saveAll: () => Promise<void>;
  discardAll: () => void;
};

type RowDraft = { reelId: string; lengthFt: string; brand: string; locationId: string; status: string };

function WireReelInlineInner(
  { item, editModeActive = false }: { item: any; editModeActive?: boolean },
  ref: Ref<WireReelInlineHandle>
) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const qc = useQueryClient();
  const { data: locationList = [] } = useLocations();
  const [showAdd, setShowAdd] = useState(false);
  const [rows, setRows] = useState<AddReelDraft[]>([{ ...BLANK_REEL_DRAFT }]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<EditReelDraft>({ reelId: "", lengthFt: "", brand: "", locationId: "", status: "new" });
  const [rowDrafts, setRowDrafts] = useState<Record<number, RowDraft>>({});

  const { data: reels = [], isLoading } = useQuery<WireReelLocal[]>({
    queryKey: ["/api/wire-reels", item.id],
    queryFn: async () => {
      const res = await fetch(`/api/wire-reels/${item.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load reels");
      return res.json();
    },
  });

  const totalFt = reels.reduce((s, r) => s + r.lengthFt, 0);
  const wireConfig = parseWireConfig(item);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["/api/wire-reels", item.id] });
    qc.invalidateQueries({ queryKey: [api.items.get.path, item.id] });
    qc.invalidateQueries({ queryKey: ["/api/inventory/category"] });
    qc.invalidateQueries({ queryKey: ["/api/inventory/categories/summary"] });
  };

  const addMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/wire-reels/bulk", {
      reels: rows.map((row, i) => ({
        itemId: item.id,
        reelId: generateReelId(item, row.brand, reels.length + i + 1),
        lengthFt: parseInt(row.lengthFt) || 0,
        brand: row.brand.trim() || null,
        locationId: row.locationId ? parseInt(row.locationId) : null,
        status: row.status,
      })),
    }),
    onSuccess: () => {
      invalidateAll();
      setShowAdd(false);
      setRows([{ ...BLANK_REEL_DRAFT }]);
      toast({ title: `${rows.length} ${rows.length > 1 ? t.itemDetailReelsAddedSuffix2 : t.itemDetailReelAddedSuffix}` });
    },
    onError: (err: any) => toast({ title: t.itemDetailErrorSaving, description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (reel: WireReelLocal) => apiRequest("DELETE", `/api/wire-reels/${reel.id}`),
    onSuccess: (_data, deletedReel) => {
      invalidateAll();
      const dismissRef = { fn: () => {} };
      const { dismiss } = toast({
        title: t.itemDetailReelRemoved,
        description: (
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm text-muted-foreground">{deletedReel.reelId} · {deletedReel.lengthFt.toLocaleString()} FT</span>
            <button
              type="button"
              className="text-xs font-semibold underline underline-offset-2 hover:opacity-80"
              onClick={async () => {
                dismissRef.fn();
                try {
                  await apiRequest("POST", `/api/wire-reels/${deletedReel.id}/restore`);
                  invalidateAll();
                  toast({ title: t.itemDetailUndoSuccess, description: `${deletedReel.reelId} ${t.itemDetailRestoredSuffix}` });
                } catch (err: any) {
                  toast({ title: t.itemDetailUndoFailed, description: err.message, variant: "destructive" });
                }
              }}
            >
              {t.itemDetailUndo}
            </button>
          </div>
        ),
      });
      dismissRef.fn = dismiss;
    },
    onError: (err: any) => toast({ title: t.itemDetailErrorSaving, description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/wire-reels/${id}`, {
      reelId: editDraft.reelId.trim(),
      lengthFt: parseInt(editDraft.lengthFt) || 0,
      brand: editDraft.brand.trim() || null,
      locationId: editDraft.locationId ? parseInt(editDraft.locationId) : null,
      status: editDraft.status || null,
    }),
    onSuccess: () => {
      invalidateAll();
      setEditingId(null);
      toast({ title: t.itemDetailReelUpdated });
    },
    onError: (err: any) => toast({ title: t.itemDetailErrorSaving, description: err.message, variant: "destructive" }),
  });

  const startEdit = (reel: WireReelLocal) => {
    setEditingId(reel.id);
    setEditDraft({
      reelId: reel.reelId,
      lengthFt: String(reel.lengthFt),
      brand: reel.brand || "",
      locationId: reel.locationId ? String(reel.locationId) : "",
      status: reel.status || "new",
    });
  };

  useEffect(() => {
    if (editModeActive && reels.length > 0) {
      setRowDrafts(prev => {
        const next: Record<number, RowDraft> = {};
        reels.forEach(r => {
          next[r.id] = prev[r.id] ?? {
            reelId: r.reelId,
            lengthFt: String(r.lengthFt),
            brand: r.brand || "",
            locationId: r.locationId ? String(r.locationId) : "",
            status: r.status || "new",
          };
        });
        return next;
      });
    }
    if (!editModeActive) {
      setRowDrafts({});
      setEditingId(null);
    }
  }, [editModeActive, reels]);

  const updateRowDraft = (reelDbId: number, field: keyof RowDraft, value: string) => {
    setRowDrafts(prev => {
      const current = prev[reelDbId];
      if (!current) return prev;
      const updated = { ...current, [field]: value };
      if (field === "brand") {
        const seqMatch = current.reelId.match(/R(\d+)$/i);
        const seq = seqMatch ? parseInt(seqMatch[1]) : 1;
        updated.reelId = generateReelId(item, value, seq);
      }
      return { ...prev, [reelDbId]: updated };
    });
  };

  useImperativeHandle(ref, () => ({
    saveAll: async () => {
      const promises = reels.map(reel => {
        const draft = rowDrafts[reel.id];
        if (!draft) return Promise.resolve();
        return apiRequest("PATCH", `/api/wire-reels/${reel.id}`, {
          reelId: draft.reelId.trim(),
          lengthFt: parseInt(draft.lengthFt) || 0,
          brand: draft.brand.trim() || null,
          locationId: draft.locationId ? parseInt(draft.locationId) : null,
          status: draft.status || null,
        });
      });
      await Promise.all(promises);
      invalidateAll();
    },
    discardAll: () => {
      setRowDrafts({});
    },
  }), [rowDrafts, reels]);

  return (
    <div data-testid={`wire-reel-section-${item.id}`}>
      {/* Inline header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-brand-600" />
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{t.itemDetailReelInventory}</span>
          {!isLoading && reels.length > 0 && (
            <span className="text-xs text-slate-400 font-normal">
              {reels.length} {reels.length !== 1 ? t.itemDetailReels : t.itemDetailReel} · {totalFt.toLocaleString()} {t.itemDetailFtTotal}
            </span>
          )}
        </div>
        <button
          className="flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-800 transition-colors"
          onClick={() => { setShowAdd(v => !v); setRows([{ ...BLANK_REEL_DRAFT }]); }}
          data-testid={`button-add-reel-${item.id}`}
        >
          <Plus className="w-3.5 h-3.5" />{showAdd ? t.cmnCancel : t.itemDetailAddReel}
        </button>
      </div>

      <div className="space-y-4">
        {/* Add reel multi-row form */}
        {showAdd && (
          <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm space-y-3">
            {/* Column headers */}
            <div className="grid items-center gap-2" style={{ gridTemplateColumns: "1fr 90px 110px 130px 90px 28px" }}>
              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">{t.itemDetailReelHeader}</span>
              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">{t.itemDetailLengthFt}</span>
              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">{t.itemDetailBrand}</span>
              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">{t.itemDetailLocation}</span>
              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">{t.itemDetailStatusCol}</span>
              <span />
            </div>

            {rows.map((row, i) => (
              <div key={i} className="grid items-center gap-2" style={{ gridTemplateColumns: "1fr 90px 110px 130px 90px 28px" }}>
                <Input
                  value={generateReelId(item, row.brand, reels.length + i + 1)}
                  readOnly
                  className="h-8 text-xs bg-slate-50 text-slate-400 font-mono cursor-default"
                  data-testid={`input-reel-id-${item.id}-${i}`}
                />
                <Input
                  type="number" min={0} value={row.lengthFt}
                  onChange={e => setRows(rs => rs.map((r, j) => j === i ? { ...r, lengthFt: e.target.value } : r))}
                  placeholder={t.itemDetailReelLengthPh} className="h-8 text-sm"
                  data-testid={`input-reel-length-${item.id}-${i}`}
                />
                <Input
                  value={row.brand}
                  onChange={e => setRows(rs => rs.map((r, j) => j === i ? { ...r, brand: e.target.value } : r))}
                  placeholder={t.itemDetailReelBrandPh} className="h-8 text-sm"
                  data-testid={`input-reel-brand-${item.id}-${i}`}
                />
                <Select
                  value={row.locationId || "__none__"}
                  onValueChange={v => setRows(rs => rs.map((r, j) => j === i ? { ...r, locationId: v === "__none__" ? "" : v } : r))}
                >
                  <SelectTrigger className="h-8 text-sm" data-testid={`select-reel-location-${item.id}-${i}`}><SelectValue placeholder={t.itemDetailNoneDash} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t.itemDetailNoneDash}</SelectItem>
                    {(locationList as any[]).map((l: any) => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select
                  value={row.status}
                  onValueChange={v => setRows(rs => rs.map((r, j) => j === i ? { ...r, status: v as AddReelDraft["status"] } : r))}
                >
                  <SelectTrigger className="h-8 text-sm" data-testid={`select-reel-status-${item.id}-${i}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">{t.itemDetailStatusNew}</SelectItem>
                    <SelectItem value="used">{t.itemDetailStatusUsed}</SelectItem>
                  </SelectContent>
                </Select>
                <button
                  onClick={() => setRows(rs => rs.length > 1 ? rs.filter((_, j) => j !== i) : rs)}
                  className="text-slate-300 hover:text-red-400 transition-colors disabled:opacity-30"
                  disabled={rows.length === 1}
                  title={t.itemDetailRemoveRow}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => setRows(rs => [...rs, { ...BLANK_REEL_DRAFT }])}
                className="flex items-center gap-1 text-sm text-brand-600 hover:text-brand-800 font-medium transition-colors"
                data-testid={`button-add-reel-row-${item.id}`}
              >
                <Plus className="w-3.5 h-3.5" /> {t.itemDetailAddRow}
              </button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setShowAdd(false); setRows([{ ...BLANK_REEL_DRAFT }]); }}>{t.cmnCancel}</Button>
                <Button size="sm" className="bg-brand-700 hover:bg-brand-800 text-white"
                  disabled={rows.every(r => !r.lengthFt) || addMutation.isPending}
                  onClick={() => addMutation.mutate()}
                  data-testid={`button-save-reel-${item.id}`}
                >
                  {addMutation.isPending ? t.itemDetailSavingDots : `${t.itemDetailSavePrefix} ${rows.length > 1 ? `${rows.length} ${t.itemDetailReelsCapital}` : t.itemDetailReelCapital}`}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Reel table or empty state */}
        {isLoading ? (
          <div className="text-sm text-slate-400 py-2">{t.itemDetailLoadingReels}</div>
        ) : reels.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2 text-slate-400">
            <Layers className="w-8 h-8 text-slate-200" />
            <p className="text-sm">{t.itemDetailNoReels}</p>
            {!showAdd && (
              <button className="text-sm text-brand-600 hover:text-brand-800 font-medium mt-1" onClick={() => setShowAdd(true)}>
                {t.itemDetailAddFirstReel}
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#D9E7DD]">
            <table className="w-full text-sm" style={{ tableLayout: "auto" }}>
              <thead>
                <tr className="bg-white border-b border-slate-100">
                  {[t.itemDetailReelHeader, "Core Type", "Size", "Conductors / Color", t.itemDetailLengthFt, t.itemDetailBrand, t.itemDetailLocation, t.itemDetailStatusCol, ""].map((h, idx) => (
                    <th key={idx} className={`px-4 py-2.5 font-semibold text-slate-400 uppercase tracking-wide text-[11px] ${idx === 4 ? "text-right" : idx === 7 ? "text-center" : idx === 8 ? "" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-50">
                {reels.map(reel => {
                  const isBulkEdit = editModeActive;
                  const isRowEdit = !editModeActive && editingId === reel.id;
                  const draft = rowDrafts[reel.id];
                  return (
                    <tr key={reel.id} className={`transition-colors ${isBulkEdit || isRowEdit ? "bg-slate-50" : "hover:bg-slate-50"}`} data-testid={`row-reel-${reel.id}`}>
                      {isBulkEdit && draft ? (
                        <>
                          <td className="px-3 py-1.5 font-mono text-xs font-semibold text-slate-400 whitespace-nowrap">{draft.reelId}</td>
                          <td className="px-3 py-1.5"><WireConfigBadge coreType={wireConfig.coreTypeLabel} /></td>
                          <td className="px-3 py-1.5 text-xs text-slate-400 whitespace-nowrap">{wireConfig.sizeLabel || "—"}</td>
                          <td className="px-3 py-1.5 text-xs text-slate-400 whitespace-nowrap">{wireConfig.conductorColorLabel || "—"}</td>
                          <td className="px-3 py-1.5">
                            <Input type="number" min={0} value={draft.lengthFt} onChange={e => updateRowDraft(reel.id, "lengthFt", e.target.value)} className="h-7 text-xs text-right w-20" data-testid={`input-bulk-reel-length-${reel.id}`} />
                          </td>
                          <td className="px-3 py-1.5">
                            <Input value={draft.brand} onChange={e => updateRowDraft(reel.id, "brand", e.target.value)} placeholder={t.itemDetailBrandColPh} className="h-7 text-xs w-24" data-testid={`input-bulk-reel-brand-${reel.id}`} />
                          </td>
                          <td className="px-3 py-1.5">
                            <Select value={draft.locationId || "__none__"} onValueChange={v => updateRowDraft(reel.id, "locationId", v === "__none__" ? "" : v)}>
                              <SelectTrigger className="h-7 text-xs w-32" data-testid={`select-bulk-reel-location-${reel.id}`}><SelectValue placeholder={t.itemDetailNoneDash} /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">{t.itemDetailNoneDash}</SelectItem>
                                {(locationList as any[]).map((l: any) => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-1.5">
                            <Select value={draft.status} onValueChange={v => updateRowDraft(reel.id, "status", v)}>
                              <SelectTrigger className="h-7 text-xs w-20" data-testid={`select-bulk-reel-status-${reel.id}`}><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="new">{t.itemDetailStatusNew}</SelectItem>
                                <SelectItem value="used">{t.itemDetailStatusUsed}</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-1.5">
                            <button
                              onClick={() => deleteMutation.mutate(reel)}
                              disabled={deleteMutation.isPending}
                              style={{ color: "#527856" }}
                              onMouseEnter={e => (e.currentTarget.style.color = "#ff5050")}
                              onMouseLeave={e => (e.currentTarget.style.color = "#527856")}
                              className="transition-colors disabled:opacity-40"
                              title={t.itemDetailRemoveReel}
                              data-testid={`button-delete-reel-${reel.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </>
                      ) : isRowEdit ? (
                        <>
                          <td className="px-3 py-1.5">
                            <Input value={editDraft.reelId} onChange={e => setEditDraft(d => ({ ...d, reelId: e.target.value }))} className="h-7 text-xs font-mono w-28" data-testid={`input-edit-reel-id-${reel.id}`} />
                          </td>
                          <td className="px-3 py-1.5"><WireConfigBadge coreType={wireConfig.coreTypeLabel} /></td>
                          <td className="px-3 py-1.5 text-xs text-slate-400 whitespace-nowrap">{wireConfig.sizeLabel || "—"}</td>
                          <td className="px-3 py-1.5 text-xs text-slate-400 whitespace-nowrap">{wireConfig.conductorColorLabel || "—"}</td>
                          <td className="px-3 py-1.5">
                            <Input type="number" min={0} value={editDraft.lengthFt} onChange={e => setEditDraft(d => ({ ...d, lengthFt: e.target.value }))} className="h-7 text-xs text-right w-20" data-testid={`input-edit-reel-length-${reel.id}`} />
                          </td>
                          <td className="px-3 py-1.5">
                            <Input value={editDraft.brand} onChange={e => setEditDraft(d => ({ ...d, brand: e.target.value }))} placeholder={t.itemDetailBrandColPh} className="h-7 text-xs w-24" data-testid={`input-edit-reel-brand-${reel.id}`} />
                          </td>
                          <td className="px-3 py-1.5">
                            <Select value={editDraft.locationId || "__none__"} onValueChange={v => setEditDraft(d => ({ ...d, locationId: v === "__none__" ? "" : v }))}>
                              <SelectTrigger className="h-7 text-xs w-32" data-testid={`select-edit-reel-location-${reel.id}`}><SelectValue placeholder="— None —" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">— None —</SelectItem>
                                {(locationList as any[]).map((l: any) => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-1.5">
                            <Select value={editDraft.status} onValueChange={v => setEditDraft(d => ({ ...d, status: v }))}>
                              <SelectTrigger className="h-7 text-xs w-20" data-testid={`select-edit-reel-status-${reel.id}`}><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="new">New</SelectItem>
                                <SelectItem value="used">Used</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-1.5">
                            <div className="flex items-center gap-1">
                              <button onClick={() => updateMutation.mutate(reel.id)} disabled={!editDraft.reelId.trim() || updateMutation.isPending} className="text-emerald-500 hover:text-emerald-700 transition-colors disabled:opacity-40" title="Save" data-testid={`button-save-edit-reel-${reel.id}`}>
                                <Check className="w-4 h-4" />
                              </button>
                              <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-600 transition-colors" title="Cancel" data-testid={`button-cancel-edit-reel-${reel.id}`}>
                                <XIcon className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-2.5 font-mono text-xs font-semibold text-slate-700 whitespace-nowrap">{reel.reelId}</td>
                          <td className="px-3 py-2.5"><WireConfigBadge coreType={wireConfig.coreTypeLabel} /></td>
                          <td className="px-3 py-2.5 text-xs text-slate-600 whitespace-nowrap">{wireConfig.sizeLabel || <span className="text-slate-300">—</span>}</td>
                          <td className="px-3 py-2.5 text-xs text-slate-600 whitespace-nowrap">{wireConfig.conductorColorLabel || <span className="text-slate-300">—</span>}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-slate-800 whitespace-nowrap">{reel.lengthFt.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{reel.brand || <span className="text-slate-300">—</span>}</td>
                          <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{reel.location?.name || <span className="text-slate-300">—</span>}</td>
                          <td className="px-4 py-2.5 text-center"><ReelStatusBadge status={reel.status} /></td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2" style={{ visibility: "hidden" }}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-[#EAF7EE] border-t border-[#D9E7DD]">
                  <td className="px-4 py-2.5 font-semibold text-brand-700 text-sm">{reels.length} reel{reels.length !== 1 ? "s" : ""}</td>
                  <td colSpan={3} />
                  <td className="px-4 py-2.5 text-right tabular-nums font-bold text-brand-800">{totalFt.toLocaleString()} FT</td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
const WireReelInline = forwardRef(WireReelInlineInner);

function StockStatusBar({ qty, minStock }: { qty: number; minStock: number }) {
  let label: string;
  let cls: string;
  let dot: string;
  if (qty === 0) {
    label = "Out of Stock";
    cls = "bg-rose-100 text-rose-700 border-rose-200";
    dot = "bg-rose-500";
  } else if (qty <= minStock) {
    label = "Low Stock";
    cls = "bg-amber-100 text-amber-700 border-amber-200";
    dot = "bg-amber-500";
  } else {
    label = "In Stock";
    cls = "bg-emerald-100 text-emerald-700 border-emerald-200";
    dot = "bg-emerald-500";
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${cls}`} data-testid="stock-status-bar">
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
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
  const qc = useQueryClient();

  const { data: item, isLoading } = useItem(id);
  const deleteMutation = useDeleteItem();

  const { data: wireReels = [] } = useQuery<any[]>({
    queryKey: ["/api/wire-reels", id],
    queryFn: async () => {
      const res = await fetch(`/api/wire-reels/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load reels");
      return res.json();
    },
    enabled: !!id,
  });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [movementOpen, setMovementOpen] = useState(false);

  const updateMutation = useUpdateItem();
  const { toast } = useToast();
  const { t } = useLanguage();

  // Invalidate inventory caches on unmount so the list always shows fresh data when
  // the user clicks Back — covers both the category grouped rows and the summary cards.
  useEffect(() => {
    return () => {
      qc.invalidateQueries({ queryKey: ["/api/inventory/category"] });
      qc.invalidateQueries({ queryKey: ["/api/inventory/categories/summary"] });
    };
  }, [qc]);

  const [inlineEdit, setInlineEdit] = useState(false);
  const wireReelRef = useRef<WireReelInlineHandle>(null);
  const [inlineDraft, setInlineDraft] = useState({
    unitCost: "",
    reorderPoint: 0,
    reorderQuantity: 0,
    minimumStock: 0,
  });

  function enterInlineEdit() {
    setInlineDraft({
      unitCost: item?.unitCost?.toString() || "",
      reorderPoint: item?.reorderPoint ?? 0,
      reorderQuantity: item?.reorderQuantity ?? 0,
      minimumStock: item?.minimumStock ?? 0,
    });
    setInlineEdit(true);
  }

  async function saveInlineEdits() {
    if (!item) return;
    try {
      await wireReelRef.current?.saveAll();
      await updateMutation.mutateAsync({
        id: item.id,
        sku: item.sku,
        name: item.name,
        baseItemName: item.baseItemName || null,
        sizeLabel: item.sizeLabel || null,
        categoryId: item.categoryId,
        subcategory: item.subcategory || null,
        detailType: item.detailType || null,
        supplierId: item.supplierId || null,
        primaryLocationId: item.primaryLocationId || null,
        quantityOnHand: item.quantityOnHand,
        minimumStock: Number(inlineDraft.minimumStock) || 0,
        reorderPoint: Number(inlineDraft.reorderPoint) || 0,
        reorderQuantity: Number(inlineDraft.reorderQuantity) || 0,
        unitCost: inlineDraft.unitCost || null,
        unitOfMeasure: item.unitOfMeasure,
        statusOverride: item.statusOverride || null,
        notes: item.notes || null,
        brand: item.brand || null,
      });
      setInlineEdit(false);
      toast({ title: t.itemDetailSavedToast, description: t.itemDetailSavedDesc });
    } catch (err: any) {
      toast({ title: t.itemDetailErrorSaving, description: err.message, variant: "destructive" });
    }
  }

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
        <p className="text-lg font-medium text-slate-500">{t.itemDetailNotFound}</p>
        <Link href="/inventory"><Button variant="outline">{t.itemDetailBackToInventory}</Button></Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/inventory" className="hover:text-brand-600 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />{t.itemDetailBreadcrumbInventory}
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
            <ItemGalleryPanel item={item} itemId={id} />
          </div>

          {/* RIGHT: Item info */}
          <div className="lg:col-span-3 p-6 space-y-5">

            {/* Name + status + actions */}
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  {/* ITEM DETAIL TITLE — locked at 1.875rem/bold. Do not reduce this size. */}
                  <h1
                    className="!text-3xl font-display font-bold text-slate-900 leading-tight"
                    style={{ fontSize: "1.875rem", lineHeight: "2.25rem", fontWeight: 700 }}
                    data-testid="item-name"
                  >
                    {item.name}
                  </h1>
                  <StockStatusBar qty={item.quantityOnHand} minStock={item.minimumStock} />
                </div>
                <p className="font-mono text-slate-500 text-sm mt-1" data-testid="item-sku">
                  SKU: {item.sku}
                </p>
              </div>
              <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                {inlineEdit ? (
                  <>
                    <Button
                      size="sm"
                      className="bg-brand-700 hover:bg-brand-800 text-white"
                      onClick={saveInlineEdits}
                      disabled={updateMutation.isPending}
                      data-testid="button-save-inline"
                    >
                      <Save className="w-3.5 h-3.5 mr-1.5" />{updateMutation.isPending ? "Saving…" : "Save"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { wireReelRef.current?.discardAll(); setInlineEdit(false); }}
                      data-testid="button-cancel-inline"
                    >
                      <XIcon className="w-3.5 h-3.5 mr-1" />Cancel
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white border-slate-200 hover:border-brand-300 hover:text-brand-600"
                    onClick={enterInlineEdit}
                    data-testid="button-edit-item"
                  >
                    <Edit className="w-3.5 h-3.5 mr-1.5" />Edit
                  </Button>
                )}
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
                  {shouldShowReelUI(item) && (
                    <span className="block text-xs text-slate-400 mt-0.5" data-testid="item-reel-count">
                      {wireReels.length} reel{wireReels.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </dd>
              </div>
              <InfoRow label={t.itemDetailSize} value={item.sizeLabel} icon={Tag} />
              <div className="flex flex-col gap-0.5">
                <dt className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />Unit Cost
                  {inlineEdit && <span className="ml-1 text-amber-500 text-[10px] normal-case tracking-normal font-normal">(editing)</span>}
                </dt>
                {inlineEdit ? (
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={inlineDraft.unitCost}
                    onChange={e => setInlineDraft(d => ({ ...d, unitCost: e.target.value }))}
                    className="h-8 text-sm w-28 font-semibold"
                    placeholder="0.00"
                    data-testid="input-unit-cost"
                  />
                ) : (
                  <dd className="text-sm font-semibold text-slate-800">
                    {item.unitCost && parseFloat(item.unitCost) > 0
                      ? `$${parseFloat(item.unitCost).toFixed(2)}`
                      : <span className="text-slate-400 font-normal">—</span>}
                  </dd>
                )}
              </div>
            </div>

            <div className="h-px bg-slate-100" />

            {/* Reel Inventory — inline for wire/cable items */}
            {shouldShowReelUI(item) && (
              <>
                <WireReelInline ref={wireReelRef} item={item} editModeActive={inlineEdit} />
                <div className="h-px bg-slate-100" />
              </>
            )}

            {/* Reorder stats */}
            {inlineEdit && (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 font-medium">
                <Edit className="w-3 h-3" />
                Editing — update values below and click Save
              </div>
            )}
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
              <div className="flex flex-col gap-0.5">
                <dt className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" />Reorder Point
                </dt>
                {inlineEdit ? (
                  <Input
                    type="number" min="0"
                    value={inlineDraft.reorderPoint}
                    onChange={e => setInlineDraft(d => ({ ...d, reorderPoint: Number(e.target.value) }))}
                    className="h-8 text-sm w-24 font-semibold"
                    data-testid="input-reorder-point"
                  />
                ) : (
                  <dd className="text-sm font-semibold text-slate-800">
                    {item.reorderPoint > 0 ? item.reorderPoint.toLocaleString() : <span className="text-slate-400 font-normal">—</span>}
                  </dd>
                )}
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <ClipboardList className="w-3 h-3" />Reorder Qty
                </dt>
                {inlineEdit ? (
                  <Input
                    type="number" min="0"
                    value={inlineDraft.reorderQuantity}
                    onChange={e => setInlineDraft(d => ({ ...d, reorderQuantity: Number(e.target.value) }))}
                    className="h-8 text-sm w-24 font-semibold"
                    data-testid="input-reorder-qty"
                  />
                ) : (
                  <dd className="text-sm font-semibold text-slate-800">
                    {item.reorderQuantity > 0 ? item.reorderQuantity.toLocaleString() : <span className="text-slate-400 font-normal">—</span>}
                  </dd>
                )}
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Min Stock</dt>
                {inlineEdit ? (
                  <Input
                    type="number" min="0"
                    value={inlineDraft.minimumStock}
                    onChange={e => setInlineDraft(d => ({ ...d, minimumStock: Number(e.target.value) }))}
                    className="h-8 text-sm w-24 font-semibold"
                    data-testid="input-min-stock"
                  />
                ) : (
                  <dd className="text-sm font-semibold text-slate-800">
                    {item.minimumStock > 0 ? item.minimumStock.toLocaleString() : <span className="text-slate-400 font-normal">—</span>}
                  </dd>
                )}
              </div>
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
        <DialogContent className="sm:max-w-[760px] flex flex-col max-h-[90vh] gap-0 p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 shrink-0">
            <DialogTitle>Log Movement — {item.name}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 flex flex-col min-h-0 px-6 pt-4 pb-6 overflow-hidden">
            <MovementForm
              defaultItemId={id}
              onSuccess={() => setMovementOpen(false)}
              onCancel={() => setMovementOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t.itemDetailDeleteTitle}</DialogTitle></DialogHeader>
          <p className="text-slate-600 pt-4">
            {t.itemDetailDeleteConfirmPrefix} <strong>{item.name}</strong>{t.itemDetailDeleteConfirmSuffix}
          </p>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>{t.cmnCancel}</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending} data-testid="button-confirm-delete">
              {deleteMutation.isPending ? t.itemDetailDeleting : t.itemDetailYesDelete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
