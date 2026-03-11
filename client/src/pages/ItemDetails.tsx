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
  ArrowLeft, Edit, Trash2, Tag, Save, X as XIcon,
  ImageIcon, UploadCloud, PackageOpen, DollarSign, RefreshCw, Activity,
  ClipboardList, Layers, Plus, Pencil, Check,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useRef, useEffect, forwardRef, useImperativeHandle, type Ref } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { MovementForm } from "@/components/MovementForm";

const editSchema = z.object({
  sku:               z.string().min(1, "SKU is required"),
  name:              z.string().min(1, "Name is required"),
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
            <FormField control={form.control} name="baseItemName" render={({ field }) => (
              <FormItem>
                <FormLabel>Base Item Name <span className="text-xs font-normal text-muted-foreground">(for grouping)</span></FormLabel>
                <FormControl><Input placeholder="e.g. EMT Set Screw Connector" {...field} data-testid="edit-base-item-name" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="subcategory" render={({ field }) => (
                <FormItem>
                  <FormLabel>Subcategory</FormLabel>
                  <FormControl><Input placeholder="e.g. EMT Conduit" {...field} data-testid="edit-subcategory" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="detailType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Detail Type</FormLabel>
                  <FormControl><Input placeholder="e.g. Connector" {...field} data-testid="edit-detail-type" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="sizeLabel" render={({ field }) => (
                <FormItem>
                  <FormLabel>Size Label</FormLabel>
                  <FormControl><Input placeholder='e.g. 3/4", #12' {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-4">
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
      qc.invalidateQueries({ queryKey: ["/api/items", itemId] });
      qc.invalidateQueries({ queryKey: ["/api/inventory/category"] });
      qc.invalidateQueries({ queryKey: ["/api/inventory/categories/summary"] });
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

const BRAND_ABBREV: Record<string, string> = {
  "southwire": "SW", "southwire company": "SW",
  "ideal": "IDEAL", "ideal industries": "IDEAL",
  "hubbell": "HUB", "leviton": "LEV",
  "siemens": "SIE", "square d": "SQD",
  "eaton": "ETN", "greenlee": "GRL",
  "milwaukee": "MIL", "klein": "KLN",
  "grainger": "GRG", "3m": "3M",
  "panduit": "PAN", "burndy": "BRN",
  "ilsco": "ILS", "nvent": "NVT",
  "thomas & betts": "TB", "abb": "ABB",
};

function abbreviateWord(str: string): string {
  const s = str.trim();
  if (!s) return "XX";
  if (/^[A-Z0-9#/\-]+$/.test(s)) return s;
  const words = s.split(/\s+/);
  if (words.length > 1) {
    return words.map(w => (w[0] || "").toUpperCase()).join("").replace(/[^A-Z0-9]/g, "");
  }
  const upper = s.toUpperCase();
  const vowels = new Set(["A","E","I","O","U"]);
  const initials: string[] = [upper[0]];
  let afterVowel = vowels.has(upper[0]);
  let consecutiveConsonants = 0;
  for (let i = 1; i < upper.length; i++) {
    const ch = upper[i];
    if (!/[A-Z0-9]/.test(ch)) { afterVowel = false; consecutiveConsonants = 0; continue; }
    const isVowel = vowels.has(ch);
    if (!isVowel) {
      if (afterVowel && consecutiveConsonants === 0) {
        initials.push(ch);
        if (initials.length >= 4) break;
      }
      consecutiveConsonants++;
    } else {
      consecutiveConsonants = 0;
    }
    afterVowel = isVowel || (afterVowel && consecutiveConsonants <= 1);
  }
  return initials.slice(0, 3).join("");
}

function generateReelId(item: any, brand: string, seqNum: number): string {
  const familyName = (item.baseItemName || item.name || "").trim();
  const itemAbbr = abbreviateWord(familyName).replace(/[^A-Z0-9]/gi, "");
  const size = (item.sizeLabel || "").replace(/[^A-Za-z0-9#\/]/g, "");
  const brandKey = (brand || "").toLowerCase().trim();
  const brandAbbr = (BRAND_ABBREV[brandKey] || abbreviateWord(brand).replace(/[^A-Z0-9]/gi, "") || "XX");
  const seq = String(seqNum).padStart(3, "0");
  return `${itemAbbr}-${size}-${brandAbbr}-R${seq}`;
}

function ReelStatusBadge({ status }: { status: string | null }) {
  const s = status || "new";
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium ${REEL_STATUS_COLORS[s] ?? "bg-slate-100 text-slate-600"}`}>
      {REEL_STATUS_LABELS[s] ?? s}
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

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["/api/wire-reels", item.id] });
    qc.invalidateQueries({ queryKey: ["/api/items", item.id] });
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
      toast({ title: `${rows.length} reel${rows.length > 1 ? "s" : ""} added` });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (reelId: number) => apiRequest("DELETE", `/api/wire-reels/${reelId}`),
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Reel removed" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
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
      toast({ title: "Reel updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
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
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Reel Inventory</span>
          {!isLoading && reels.length > 0 && (
            <span className="text-xs text-slate-400 font-normal">
              {reels.length} reel{reels.length !== 1 ? "s" : ""} · {totalFt.toLocaleString()} FT total
            </span>
          )}
        </div>
        <button
          className="flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-800 transition-colors"
          onClick={() => { setShowAdd(v => !v); setRows([{ ...BLANK_REEL_DRAFT }]); }}
          data-testid={`button-add-reel-${item.id}`}
        >
          <Plus className="w-3.5 h-3.5" />{showAdd ? "Cancel" : "Add Reel"}
        </button>
      </div>

      <div className="space-y-4">
        {/* Add reel multi-row form */}
        {showAdd && (
          <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm space-y-3">
            {/* Column headers */}
            <div className="grid items-center gap-2" style={{ gridTemplateColumns: "1fr 90px 110px 130px 90px 28px" }}>
              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">Reel ID</span>
              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">Length (FT)</span>
              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">Brand</span>
              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">Location</span>
              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">Status</span>
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
                  placeholder="500" className="h-8 text-sm"
                  data-testid={`input-reel-length-${item.id}-${i}`}
                />
                <Input
                  value={row.brand}
                  onChange={e => setRows(rs => rs.map((r, j) => j === i ? { ...r, brand: e.target.value } : r))}
                  placeholder="Southwire" className="h-8 text-sm"
                  data-testid={`input-reel-brand-${item.id}-${i}`}
                />
                <Select
                  value={row.locationId || "__none__"}
                  onValueChange={v => setRows(rs => rs.map((r, j) => j === i ? { ...r, locationId: v === "__none__" ? "" : v } : r))}
                >
                  <SelectTrigger className="h-8 text-sm" data-testid={`select-reel-location-${item.id}-${i}`}><SelectValue placeholder="— None —" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— None —</SelectItem>
                    {(locationList as any[]).map((l: any) => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select
                  value={row.status}
                  onValueChange={v => setRows(rs => rs.map((r, j) => j === i ? { ...r, status: v as AddReelDraft["status"] } : r))}
                >
                  <SelectTrigger className="h-8 text-sm" data-testid={`select-reel-status-${item.id}-${i}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="used">Used</SelectItem>
                  </SelectContent>
                </Select>
                <button
                  onClick={() => setRows(rs => rs.length > 1 ? rs.filter((_, j) => j !== i) : rs)}
                  className="text-slate-300 hover:text-red-400 transition-colors disabled:opacity-30"
                  disabled={rows.length === 1}
                  title="Remove row"
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
                <Plus className="w-3.5 h-3.5" /> Add Row
              </button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setShowAdd(false); setRows([{ ...BLANK_REEL_DRAFT }]); }}>Cancel</Button>
                <Button size="sm" className="bg-brand-700 hover:bg-brand-800 text-white"
                  disabled={rows.every(r => !r.lengthFt) || addMutation.isPending}
                  onClick={() => addMutation.mutate()}
                  data-testid={`button-save-reel-${item.id}`}
                >
                  {addMutation.isPending ? "Saving…" : `Save ${rows.length > 1 ? `${rows.length} Reels` : "Reel"}`}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Reel table or empty state */}
        {isLoading ? (
          <div className="text-sm text-slate-400 py-2">Loading reels…</div>
        ) : reels.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2 text-slate-400">
            <Layers className="w-8 h-8 text-slate-200" />
            <p className="text-sm">No reels recorded yet.</p>
            {!showAdd && (
              <button className="text-sm text-brand-600 hover:text-brand-800 font-medium mt-1" onClick={() => setShowAdd(true)}>
                + Add the first reel
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#D9E7DD]">
            <table className="w-full text-sm" style={{ tableLayout: "auto" }}>
              <thead>
                <tr className="bg-white border-b border-slate-100">
                  {["Reel ID", "Length (FT)", "Brand", "Location", "Status", ""].map(h => (
                    <th key={h} className={`px-4 py-2.5 font-semibold text-slate-400 uppercase tracking-wide text-[11px] ${h === "Length (FT)" ? "text-right" : h === "Status" ? "text-center" : h === "" ? "" : "text-left"}`}>{h}</th>
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
                          <td className="px-3 py-1.5">
                            <Input type="number" min={0} value={draft.lengthFt} onChange={e => updateRowDraft(reel.id, "lengthFt", e.target.value)} className="h-7 text-xs text-right w-20" data-testid={`input-bulk-reel-length-${reel.id}`} />
                          </td>
                          <td className="px-3 py-1.5">
                            <Input value={draft.brand} onChange={e => updateRowDraft(reel.id, "brand", e.target.value)} placeholder="Brand" className="h-7 text-xs w-24" data-testid={`input-bulk-reel-brand-${reel.id}`} />
                          </td>
                          <td className="px-3 py-1.5">
                            <Select value={draft.locationId || "__none__"} onValueChange={v => updateRowDraft(reel.id, "locationId", v === "__none__" ? "" : v)}>
                              <SelectTrigger className="h-7 text-xs w-32" data-testid={`select-bulk-reel-location-${reel.id}`}><SelectValue placeholder="— None —" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">— None —</SelectItem>
                                {(locationList as any[]).map((l: any) => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-1.5">
                            <Select value={draft.status} onValueChange={v => updateRowDraft(reel.id, "status", v)}>
                              <SelectTrigger className="h-7 text-xs w-20" data-testid={`select-bulk-reel-status-${reel.id}`}><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="new">New</SelectItem>
                                <SelectItem value="used">Used</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-1.5">
                            <button
                              onClick={() => deleteMutation.mutate(reel.id)}
                              disabled={deleteMutation.isPending}
                              style={{ color: "#527856" }}
                              onMouseEnter={e => (e.currentTarget.style.color = "#ff5050")}
                              onMouseLeave={e => (e.currentTarget.style.color = "#527856")}
                              className="transition-colors disabled:opacity-40"
                              title="Remove reel"
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
                          <td className="px-3 py-1.5">
                            <Input type="number" min={0} value={editDraft.lengthFt} onChange={e => setEditDraft(d => ({ ...d, lengthFt: e.target.value }))} className="h-7 text-xs text-right w-20" data-testid={`input-edit-reel-length-${reel.id}`} />
                          </td>
                          <td className="px-3 py-1.5">
                            <Input value={editDraft.brand} onChange={e => setEditDraft(d => ({ ...d, brand: e.target.value }))} placeholder="Brand" className="h-7 text-xs w-24" data-testid={`input-edit-reel-brand-${reel.id}`} />
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
      toast({ title: "Saved", description: "Item updated successfully." });
    } catch (err: any) {
      toast({ title: "Error saving", description: err.message, variant: "destructive" });
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
                  {item.unitOfMeasure === "FT" && (
                    <span className="block text-xs text-slate-400 mt-0.5" data-testid="item-reel-count">
                      {wireReels.length} reel{wireReels.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </dd>
              </div>
              <InfoRow label="Size" value={item.sizeLabel} icon={Tag} />
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
            {item.unitOfMeasure === "FT" && (
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
