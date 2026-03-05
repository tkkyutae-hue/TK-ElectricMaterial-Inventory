import { useState, useMemo } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Package, AlertTriangle, XCircle, CheckCircle2, ChevronRight, Search, Plus, Pencil, Trash2, MoveRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useLocations, useSuppliers } from "@/hooks/use-reference-data";
import { useCreateItem } from "@/hooks/use-items";
import { apiRequest } from "@/lib/queryClient";

type CategoryGroupedItem = {
  id: number;
  sku: string;
  name: string;
  sizeLabel?: string | null;
  baseItemName?: string | null;
  quantityOnHand: number;
  reorderPoint: number;
  unitOfMeasure: string;
  status: string;
  location?: { name: string } | null;
  supplier?: { name: string } | null;
};

type CategoryItemGroup = {
  baseItemName: string;
  items: CategoryGroupedItem[];
  representativeImage?: string | null;
  customImageUrl?: string | null;
};

type CategoryGroupedDetail = {
  category: {
    id: number;
    name: string;
    description?: string | null;
    imageUrl?: string | null;
    code?: string | null;
  };
  skuCount: number;
  totalQuantity: number;
  lowStockCount: number;
  outOfStockCount: number;
  groups: CategoryItemGroup[];
};

function StatusBadge({ status }: { status: string }) {
  if (status === "out_of_stock") return <Badge className="bg-red-50 text-red-700 border-red-200 border font-medium whitespace-nowrap">Out of Stock</Badge>;
  if (status === "low_stock") return <Badge className="bg-amber-50 text-amber-700 border-amber-200 border font-medium whitespace-nowrap">Low Stock</Badge>;
  return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 border font-medium whitespace-nowrap">In Stock</Badge>;
}

const CATEGORY_FALLBACK_COLORS: Record<string, string> = {
  "CT": "from-sky-600 to-sky-800",
  "CF": "from-slate-600 to-slate-800",
  "CS": "from-zinc-600 to-zinc-800",
  "CW": "from-orange-600 to-orange-800",
  "DV": "from-violet-600 to-violet-800",
  "FH": "from-stone-600 to-stone-800",
  "BC": "from-blue-600 to-blue-800",
  "DP": "from-indigo-600 to-indigo-800",
  "GT": "from-teal-600 to-teal-800",
};

const addItemSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  name: z.string().min(1, "Item name is required"),
  baseItemName: z.string().optional(),
  sizeLabel: z.string().optional(),
  imageUrl: z.string().optional(),
  categoryId: z.coerce.number(),
  unitOfMeasure: z.string().min(1, "Unit is required"),
  quantityOnHand: z.coerce.number().min(0),
  supplierId: z.coerce.number().optional(),
  primaryLocationId: z.coerce.number().optional(),
  reorderPoint: z.coerce.number().min(0),
  reorderQuantity: z.coerce.number().min(0),
  notes: z.string().optional(),
});

type AddItemFormData = z.infer<typeof addItemSchema>;

function AddItemDialog({
  open,
  onClose,
  categoryId,
  categoryName,
  existingFamilies,
}: {
  open: boolean;
  onClose: () => void;
  categoryId: number;
  categoryName: string;
  existingFamilies: string[];
}) {
  const { toast } = useToast();
  const createMutation = useCreateItem();
  const { data: locations } = useLocations();
  const { data: suppliers } = useSuppliers();
  const qc = useQueryClient();

  const form = useForm<AddItemFormData>({
    resolver: zodResolver(addItemSchema),
    defaultValues: {
      sku: "",
      name: "",
      baseItemName: "",
      sizeLabel: "",
      imageUrl: "",
      categoryId,
      unitOfMeasure: "EA",
      quantityOnHand: 0,
      reorderPoint: 0,
      reorderQuantity: 0,
      notes: "",
    },
  });

  async function onSubmit(data: AddItemFormData) {
    try {
      await createMutation.mutateAsync({
        ...data,
        categoryId,
        imageUrl: data.imageUrl || undefined,
        baseItemName: data.baseItemName || undefined,
        sizeLabel: data.sizeLabel || undefined,
        supplierId: data.supplierId || undefined,
        primaryLocationId: data.primaryLocationId || undefined,
        notes: data.notes || undefined,
        minimumStock: 0,
        unitCost: "0.00",
      });
      toast({ title: "Item created", description: `${data.name} has been added to ${categoryName}.` });
      qc.invalidateQueries({ queryKey: ["/api/inventory/category", String(categoryId), "grouped"] });
      qc.invalidateQueries({ queryKey: ["/api/inventory/categories/summary"] });
      form.reset({ categoryId, unitOfMeasure: "EA", quantityOnHand: 0, reorderPoint: 0, reorderQuantity: 0 });
      onClose();
    } catch (err: any) {
      toast({ title: "Failed to create item", description: err.message, variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Item — {categoryName}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="sku" render={({ field }) => (
                <FormItem>
                  <FormLabel>SKU / Part Number <span className="text-red-500">*</span></FormLabel>
                  <FormControl><Input placeholder="e.g. EMT-075" data-testid="input-new-sku" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="unitOfMeasure" render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit of Measure <span className="text-red-500">*</span></FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger data-testid="select-new-uom"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {["EA", "FT", "LF", "PR", "PKG", "BOX", "CTN", "LB", "ROLL"].map(u => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Item Name <span className="text-red-500">*</span></FormLabel>
                <FormControl><Input placeholder='e.g. 3/4" EMT Conduit' data-testid="input-new-name" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="baseItemName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Family / Subcategory</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. EMT Conduit"
                      list="family-suggestions"
                      data-testid="input-new-family"
                      {...field}
                    />
                  </FormControl>
                  <datalist id="family-suggestions">
                    {existingFamilies.map(f => <option key={f} value={f} />)}
                  </datalist>
                  <p className="text-[11px] text-slate-400 mt-0.5">Groups items of the same type under one header.</p>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="sizeLabel" render={({ field }) => (
                <FormItem>
                  <FormLabel>Size</FormLabel>
                  <FormControl><Input placeholder='e.g. 3/4", 12/2, 100A' data-testid="input-new-size" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="quantityOnHand" render={({ field }) => (
                <FormItem>
                  <FormLabel>Initial Quantity</FormLabel>
                  <FormControl><Input type="number" min={0} data-testid="input-new-qty" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="primaryLocationId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value?.toString()}>
                    <FormControl><SelectTrigger data-testid="select-new-location"><SelectValue placeholder="Select location" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {locations?.map(l => <SelectItem key={l.id} value={l.id.toString()}>{l.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="supplierId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Supplier</FormLabel>
                  <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value?.toString()}>
                    <FormControl><SelectTrigger data-testid="select-new-supplier"><SelectValue placeholder="Select supplier" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {suppliers?.map((s: any) => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="imageUrl" render={({ field }) => (
                <FormItem>
                  <FormLabel>Image URL (optional)</FormLabel>
                  <FormControl><Input placeholder="https://…" data-testid="input-new-image-url" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="reorderPoint" render={({ field }) => (
                <FormItem>
                  <FormLabel>Reorder Point</FormLabel>
                  <FormControl><Input type="number" min={0} data-testid="input-new-reorder-pt" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="reorderQuantity" render={({ field }) => (
                <FormItem>
                  <FormLabel>Reorder Quantity</FormLabel>
                  <FormControl><Input type="number" min={0} data-testid="input-new-reorder-qty" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes (optional)</FormLabel>
                <FormControl><Textarea placeholder="Any relevant notes…" rows={2} className="resize-none" data-testid="input-new-notes" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={createMutation.isPending}>Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={createMutation.isPending} data-testid="button-save-new-item">
                {createMutation.isPending ? "Saving…" : "Add Item"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Family Edit Dialog ────────────────────────────────────────────────────────

function FamilyEditDialog({
  open,
  onClose,
  categoryId,
  group,
  allFamilies,
}: {
  open: boolean;
  onClose: () => void;
  categoryId: number;
  group: CategoryItemGroup;
  allFamilies: string[];
}) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [familyName, setFamilyName] = useState(group.baseItemName);
  const [imageUrl, setImageUrl] = useState(group.representativeImage ?? "");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [moveTarget, setMoveTarget] = useState("");
  const [showMoveInput, setShowMoveInput] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["/api/inventory/category", String(categoryId), "grouped"] });
    qc.invalidateQueries({ queryKey: ["/api/inventory/categories/summary"] });
    qc.invalidateQueries({ queryKey: ["/api/inventory"] });
  };

  const saveMeta = useMutation({
    mutationFn: () => apiRequest("PUT", `/api/inventory/category/${categoryId}/item-groups`, {
      baseItemName: group.baseItemName,
      imageUrl: imageUrl || null,
      newName: familyName !== group.baseItemName ? familyName : undefined,
    }),
    onSuccess: () => {
      toast({ title: "Family updated" });
      invalidate();
      onClose();
    },
    onError: (err: any) => toast({ title: "Failed to save", description: err.message, variant: "destructive" }),
  });

  const moveItems = useMutation({
    mutationFn: () => apiRequest("POST", `/api/inventory/items/move-family`, {
      itemIds: [...selectedIds],
      newBaseItemName: moveTarget.trim(),
    }),
    onSuccess: () => {
      toast({ title: `${selectedIds.size} item(s) moved to "${moveTarget}"` });
      invalidate();
      setSelectedIds(new Set());
      setShowMoveInput(false);
      setMoveTarget("");
      onClose();
    },
    onError: (err: any) => toast({ title: "Move failed", description: err.message, variant: "destructive" }),
  });

  const deleteItems = useMutation({
    mutationFn: () => apiRequest("POST", `/api/inventory/items/bulk-delete`, {
      itemIds: [...selectedIds],
    }),
    onSuccess: () => {
      toast({ title: `${selectedIds.size} item(s) removed` });
      invalidate();
      setSelectedIds(new Set());
      setConfirmDelete(false);
      onClose();
    },
    onError: (err: any) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
  });

  const toggleItem = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === group.items.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(group.items.map(i => i.id)));
  };

  const otherFamilies = allFamilies.filter(f => f !== group.baseItemName);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Family — {group.baseItemName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 pt-1">

          {/* Family name + image */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Family Name</label>
              <Input
                value={familyName}
                onChange={e => setFamilyName(e.target.value)}
                placeholder="e.g. EMT Conduit"
                data-testid="input-family-name"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Representative Image URL</label>
              <Input
                value={imageUrl}
                onChange={e => setImageUrl(e.target.value)}
                placeholder="https://…"
                data-testid="input-family-image-url"
              />
            </div>
          </div>
          {imageUrl && (
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg p-2">
              <img src={imageUrl} alt="preview" className="w-14 h-14 object-cover rounded-md border border-slate-200" onError={e => { e.currentTarget.style.opacity = "0.3"; }} />
              <span className="text-xs text-slate-500">Image preview</span>
            </div>
          )}

          {/* Items in this family */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedIds.size === group.items.length && group.items.length > 0}
                  onChange={toggleAll}
                  className="rounded border-slate-300"
                  data-testid="checkbox-select-all"
                />
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  {group.items.length} item{group.items.length !== 1 ? "s" : ""} in this family
                </span>
              </div>
              {selectedIds.size > 0 && (
                <span className="text-xs text-blue-600 font-medium">{selectedIds.size} selected</span>
              )}
            </div>
            <div className="max-h-52 overflow-y-auto divide-y divide-slate-100">
              {group.items.map(item => (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 cursor-pointer ${selectedIds.has(item.id) ? "bg-blue-50/40" : ""}`}
                  onClick={() => toggleItem(item.id)}
                  data-testid={`row-family-item-${item.id}`}
                >
                  <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleItem(item.id)} className="rounded border-slate-300 pointer-events-none" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
                    <p className="text-xs text-slate-400">{item.sku}{item.sizeLabel ? ` · ${item.sizeLabel}` : ""}</p>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
              ))}
            </div>
          </div>

          {/* Actions on selected items */}
          {selectedIds.size > 0 && (
            <div className="border border-slate-200 rounded-xl p-3 space-y-3 bg-slate-50/60">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Actions for {selectedIds.size} selected item{selectedIds.size !== 1 ? "s" : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-blue-600 border-blue-200 hover:bg-blue-50"
                  onClick={() => { setShowMoveInput(!showMoveInput); setConfirmDelete(false); }}
                  data-testid="button-move-items"
                >
                  <MoveRight className="w-3.5 h-3.5 mr-1.5" />
                  Move to family…
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => { setConfirmDelete(!confirmDelete); setShowMoveInput(false); }}
                  data-testid="button-delete-items"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Remove selected
                </Button>
              </div>

              {showMoveInput && (
                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1">
                    <label className="text-xs text-slate-600 font-medium">Target family name</label>
                    <Input
                      value={moveTarget}
                      onChange={e => setMoveTarget(e.target.value)}
                      placeholder="Existing or new family name…"
                      list="move-target-suggestions"
                      data-testid="input-move-target"
                    />
                    <datalist id="move-target-suggestions">
                      {otherFamilies.map(f => <option key={f} value={f} />)}
                    </datalist>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={() => moveItems.mutate()}
                    disabled={!moveTarget.trim() || moveItems.isPending}
                    data-testid="button-confirm-move"
                  >
                    {moveItems.isPending ? "Moving…" : "Move"}
                  </Button>
                </div>
              )}

              {confirmDelete && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-2.5">
                  <span className="text-sm text-red-700 flex-1">Remove {selectedIds.size} item(s) from inventory permanently?</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteItems.mutate()}
                    disabled={deleteItems.isPending}
                    data-testid="button-confirm-delete"
                  >
                    {deleteItems.isPending ? "Removing…" : "Confirm"}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                </div>
              )}
            </div>
          )}

          {/* Footer actions */}
          <div className="flex justify-end gap-3 pt-1 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={onClose} disabled={saveMeta.isPending}>Cancel</Button>
            <Button
              type="button"
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => saveMeta.mutate()}
              disabled={saveMeta.isPending || !familyName.trim()}
              data-testid="button-save-family"
            >
              {saveMeta.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function CategoryDetail() {
  const { id } = useParams<{ id: string }>();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [familyFilter, setFamilyFilter] = useState("all");
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CategoryItemGroup | null>(null);

  const { data, isLoading, isError } = useQuery<CategoryGroupedDetail>({
    queryKey: ["/api/inventory/category", id, "grouped"],
    queryFn: () => fetch(`/api/inventory/category/${id}/grouped`).then(r => r.json()),
    enabled: !!id,
  });

  const filteredGroups = useMemo(() => {
    if (!data) return [];
    const tokens = search.trim().toLowerCase().split(/\s+/).filter(t => t.length > 0);

    return data.groups
      .filter(group => familyFilter === "all" || group.baseItemName === familyFilter)
      .map(group => {
        const filteredItems = group.items.filter(item => {
          const matchesSearch = tokens.length === 0 || (() => {
            const haystack = [
              item.sku,
              item.name,
              item.sizeLabel || "",
              group.baseItemName,
              item.location?.name || "",
              item.supplier?.name || "",
            ].join(" ").toLowerCase();
            return tokens.every(token => haystack.includes(token));
          })();
          const matchesStatus = statusFilter === "all" || item.status === statusFilter;
          return matchesSearch && matchesStatus;
        });
        return { ...group, items: filteredItems };
      })
      .filter(group => group.items.length > 0);
  }, [data, search, statusFilter, familyFilter]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
        <div className="h-12 bg-slate-100 rounded-xl animate-pulse" />
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-40 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="text-center py-20 text-slate-500">
        <XCircle className="w-12 h-12 mx-auto mb-3 text-red-300" />
        <p className="text-lg font-medium text-slate-900">Category not found</p>
        <Link href="/inventory">
          <Button variant="outline" className="mt-4">← Back to Inventory</Button>
        </Link>
      </div>
    );
  }

  const { category, skuCount, totalQuantity, lowStockCount, outOfStockCount, groups } = data;
  const gradientClass = CATEGORY_FALLBACK_COLORS[category.code || ""] || "from-slate-600 to-slate-800";
  const hasActiveFilters = search.trim() !== "" || statusFilter !== "all" || familyFilter !== "all";
  const existingFamilies = groups.map(g => g.baseItemName).filter(Boolean) as string[];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/inventory" className="hover:text-blue-600 transition-colors">Inventory</Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-slate-900 font-medium">{category.name}</span>
      </div>

      {/* Category hero */}
      <div className="relative rounded-2xl overflow-hidden shadow-lg" style={{ height: "200px" }}>
        {category.imageUrl ? (
          <img
            src={category.imageUrl}
            alt={category.name}
            className="w-full h-full object-cover object-center"
            style={{ objectPosition: "center 40%" }}
            onError={(e) => {
              const t = e.currentTarget;
              t.style.display = "none";
              (t.nextElementSibling as HTMLElement)?.classList.remove("hidden");
            }}
          />
        ) : null}
        <div className={`${category.imageUrl ? "hidden" : ""} absolute inset-0 bg-gradient-to-br ${gradientClass}`} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <Link href="/inventory" className="inline-flex items-center gap-1.5 text-white/70 hover:text-white text-sm mb-2 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Inventory
          </Link>
          <h1 className="text-2xl font-display font-bold text-white">{category.name}</h1>
          {category.description && (
            <p className="text-white/70 text-sm mt-0.5 max-w-2xl">{category.description}</p>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Package className="w-4 h-4 text-blue-600" />
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">SKUs</span>
          </div>
          <p className="text-2xl font-bold text-slate-900" data-testid="stat-sku-count">{skuCount}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Total Qty</span>
          </div>
          <p className="text-2xl font-bold text-slate-900" data-testid="stat-total-qty">{totalQuantity.toLocaleString()}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Low Stock</span>
          </div>
          <p className="text-2xl font-bold text-amber-600" data-testid="stat-low-stock">{lowStockCount}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="w-4 h-4 text-red-500" />
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Out of Stock</span>
          </div>
          <p className="text-2xl font-bold text-red-600" data-testid="stat-out-of-stock">{outOfStockCount}</p>
        </div>
      </div>

      {/* Search + filter bar with Add New Item */}
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input
            placeholder="Search by SKU, name, size, or family…"
            className="pl-8 h-9 bg-slate-50 border-slate-200 text-sm focus:bg-white"
            value={search}
            onChange={e => setSearch(e.target.value)}
            data-testid="input-category-search"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-9 text-sm bg-slate-50 border-slate-200" data-testid="select-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="in_stock">In Stock</SelectItem>
            <SelectItem value="low_stock">Low Stock</SelectItem>
            <SelectItem value="out_of_stock">Out of Stock</SelectItem>
          </SelectContent>
        </Select>
        <Select value={familyFilter} onValueChange={setFamilyFilter}>
          <SelectTrigger className="w-[200px] h-9 text-sm bg-slate-50 border-slate-200" data-testid="select-family-filter">
            <SelectValue placeholder="Family" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Families</SelectItem>
            {groups.map(g => (
              <SelectItem key={g.baseItemName} value={g.baseItemName}>{g.baseItemName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <button
            onClick={() => { setSearch(""); setStatusFilter("all"); setFamilyFilter("all"); }}
            className="text-xs text-slate-500 hover:text-blue-600 transition-colors whitespace-nowrap"
            data-testid="button-clear-filters"
          >
            Clear filters
          </button>
        )}
        <span className="text-xs text-slate-400 whitespace-nowrap">
          {filteredGroups.reduce((n, g) => n + g.items.length, 0)} items
          {hasActiveFilters ? " matching" : ""}
        </span>
        <Button
          onClick={() => setAddItemOpen(true)}
          className="ml-auto bg-blue-600 hover:bg-blue-700 text-white h-9 text-sm shrink-0"
          data-testid="button-add-item"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add New Item
        </Button>
      </div>

      {/* Grouped inventory sections */}
      {filteredGroups.length === 0 ? (
        <div className="text-center py-16 text-slate-500 bg-white border border-slate-200 rounded-xl">
          <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          {hasActiveFilters ? (
            <>
              <p className="text-base font-semibold text-slate-900">No items match your search</p>
              <p className="text-sm mt-1">Try different keywords or clear the filters.</p>
            </>
          ) : (
            <>
              <p className="text-base font-semibold text-slate-900">No items in this category</p>
              <p className="text-sm mt-1">
                <button onClick={() => setAddItemOpen(true)} className="text-blue-600 hover:underline">Add the first item</button>
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredGroups.map((group) => {
            const groupLowStock = group.items.filter(i => i.status === "low_stock").length;
            const groupOutOfStock = group.items.filter(i => i.status === "out_of_stock").length;
            return (
              <div key={group.baseItemName} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                {/* Group header */}
                <div className="flex items-center justify-between px-5 border-b border-slate-200 bg-slate-50/80 min-h-[60px]">
                  <div className="flex items-center gap-3 py-3">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-white border border-slate-200 flex items-center justify-center shrink-0">
                      {group.representativeImage ? (
                        <img src={group.representativeImage} alt={group.baseItemName} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-5 h-5 text-slate-300" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-900 text-sm leading-snug truncate">{group.baseItemName}</h3>
                      <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider leading-none mt-0.5">
                        {group.items.length} {group.items.length === 1 ? "size" : "sizes"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 pl-3">
                    {groupOutOfStock > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-full px-2.5 py-0.5 whitespace-nowrap">
                        <XCircle className="w-3 h-3" />
                        {groupOutOfStock} out of stock
                      </span>
                    )}
                    {groupLowStock > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5 whitespace-nowrap">
                        <AlertTriangle className="w-3 h-3" />
                        {groupLowStock} low
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                      onClick={() => setEditingGroup(group)}
                      data-testid={`button-edit-family-${group.baseItemName.replace(/\s+/g, "-")}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Group table */}
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent bg-transparent border-b border-slate-100">
                        <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-2 pl-5">SKU</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-2">Size</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-2">Item Name</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-2 text-right">Qty</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-2">Unit</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-2">Location</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-2 pr-5">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.items.map((item) => (
                        <TableRow
                          key={item.id}
                          className={`hover:bg-slate-50/70 transition-colors ${item.status === "out_of_stock" ? "bg-red-50/20" : item.status === "low_stock" ? "bg-amber-50/20" : ""}`}
                          data-testid={`row-item-${item.id}`}
                        >
                          <TableCell className="font-mono text-xs text-slate-500 py-2.5 pl-5">{item.sku}</TableCell>
                          <TableCell className="font-semibold text-slate-800 text-sm py-2.5 whitespace-nowrap">{item.sizeLabel || "—"}</TableCell>
                          <TableCell className="text-slate-700 text-sm py-2.5">
                            <Link
                              href={`/inventory/${item.id}`}
                              className="hover:text-blue-600 hover:underline transition-colors"
                              data-testid={`link-item-name-${item.id}`}
                            >
                              {item.name}
                            </Link>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-slate-900 py-2.5 tabular-nums">
                            {item.quantityOnHand.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-slate-500 text-sm py-2.5">{item.unitOfMeasure}</TableCell>
                          <TableCell className="text-slate-600 text-sm py-2.5 whitespace-nowrap">{item.location?.name || "—"}</TableCell>
                          <TableCell className="py-2.5 pr-5"><StatusBadge status={item.status} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AddItemDialog
        open={addItemOpen}
        onClose={() => setAddItemOpen(false)}
        categoryId={data.category.id}
        categoryName={data.category.name}
        existingFamilies={existingFamilies}
      />

      {editingGroup && (
        <FamilyEditDialog
          open={!!editingGroup}
          onClose={() => setEditingGroup(null)}
          categoryId={data.category.id}
          group={editingGroup}
          allFamilies={existingFamilies}
        />
      )}
    </div>
  );
}
