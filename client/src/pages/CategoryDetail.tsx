import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Package, AlertTriangle, XCircle, CheckCircle2, ChevronRight,
  Search, Plus, Pencil, Trash2, MoveRight, Check, X as XIcon, ImageIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useLocations } from "@/hooks/use-reference-data";
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

const UOM_OPTIONS = ["EA", "FT", "LF", "PR", "PKG", "BOX", "CTN", "LB", "ROLL"];

function InlineAddRow({
  familyName,
  categoryId,
  existingSkus,
  locations,
  onSaved,
  onSaveNext,
  onCancel,
}: {
  familyName: string;
  categoryId: number;
  existingSkus: Set<string>;
  locations: any[] | undefined;
  onSaved: () => void;
  onSaveNext: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const createMutation = useCreateItem();
  const qc = useQueryClient();
  const skuRef = useRef<HTMLInputElement>(null);
  const nameManuallyEdited = useRef(false);

  const [sku, setSku] = useState("");
  const [sizeLabel, setSizeLabel] = useState("");
  const [name, setName] = useState("");
  const [qty, setQty] = useState("0");
  const [unit, setUnit] = useState("EA");
  const [locationId, setLocationId] = useState(locations?.[0]?.id?.toString() ?? "");
  const [skuError, setSkuError] = useState("");

  useEffect(() => { skuRef.current?.focus(); }, []);

  useEffect(() => {
    if (!nameManuallyEdited.current && sizeLabel.trim() && familyName.trim()) {
      setName(`${sizeLabel.trim()} ${familyName.trim()}`);
    }
  }, [sizeLabel, familyName]);

  function handleNameChange(v: string) {
    setName(v);
    nameManuallyEdited.current = true;
  }

  function validateSku(value: string): boolean {
    if (!value.trim()) { setSkuError("Required"); return false; }
    if (existingSkus.has(value.trim().toUpperCase())) { setSkuError("Duplicate SKU"); return false; }
    setSkuError("");
    return true;
  }

  async function save(andNext: boolean) {
    const trimmedSku = sku.trim().toUpperCase();
    const trimmedName = name.trim();
    const trimmedSize = sizeLabel.trim();
    if (!validateSku(trimmedSku)) return;
    if (!trimmedSize) { toast({ title: "Size is required", variant: "destructive" }); return; }
    if (!trimmedName) { toast({ title: "Item name is required", variant: "destructive" }); return; }

    try {
      await createMutation.mutateAsync({
        sku: trimmedSku,
        name: trimmedName,
        baseItemName: familyName,
        sizeLabel: trimmedSize,
        categoryId,
        unitOfMeasure: unit,
        quantityOnHand: Number(qty) || 0,
        primaryLocationId: locationId ? Number(locationId) : undefined,
        reorderPoint: 0,
        reorderQuantity: 0,
        minimumStock: 0,
        unitCost: "0.00",
      });
      qc.invalidateQueries({ queryKey: ["/api/inventory/category", String(categoryId), "grouped"] });
      qc.invalidateQueries({ queryKey: ["/api/inventory/categories/summary"] });
      if (andNext) onSaveNext();
      else onSaved();
    } catch (err: any) {
      toast({ title: "Failed to create item", description: err.message, variant: "destructive" });
    }
  }

  const inputCls = (err?: string) =>
    `w-full text-xs bg-white border ${err ? "border-red-400 ring-1 ring-red-300" : "border-slate-300"} rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400`;

  return (
    <TableRow className="bg-blue-50/50 border-b border-blue-100" data-testid="row-inline-add">
      <TableCell className="pl-5 py-2 align-top">
        <input
          ref={skuRef}
          value={sku}
          onChange={e => { setSku(e.target.value.toUpperCase()); if (skuError) validateSku(e.target.value); }}
          onBlur={e => validateSku(e.target.value)}
          placeholder="SKU *"
          className={inputCls(skuError)}
          data-testid="inline-input-sku"
        />
        {skuError && <p className="text-red-500 text-[10px] mt-0.5 font-medium">{skuError}</p>}
      </TableCell>
      <TableCell className="py-2 align-top">
        <input
          value={sizeLabel}
          onChange={e => setSizeLabel(e.target.value)}
          placeholder='e.g. 3/4"'
          className={inputCls()}
          data-testid="inline-input-size"
        />
      </TableCell>
      <TableCell className="py-2 align-top">
        <input
          value={name}
          onChange={e => handleNameChange(e.target.value)}
          placeholder="Item name *"
          className={`${inputCls()} min-w-[140px]`}
          data-testid="inline-input-name"
        />
        {!nameManuallyEdited.current && sizeLabel.trim() && (
          <p className="text-[10px] text-blue-500 mt-0.5">Auto-suggested</p>
        )}
      </TableCell>
      <TableCell className="py-2 align-top text-right">
        <input
          value={qty}
          onChange={e => setQty(e.target.value)}
          type="number"
          min="0"
          className="w-16 text-xs text-right bg-white border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
          data-testid="inline-input-qty"
        />
      </TableCell>
      <TableCell className="py-2 align-top">
        <select
          value={unit}
          onChange={e => setUnit(e.target.value)}
          className="text-xs bg-white border border-slate-300 rounded px-1.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
          data-testid="inline-select-unit"
        >
          {UOM_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </TableCell>
      <TableCell className="py-2 align-top">
        <select
          value={locationId}
          onChange={e => setLocationId(e.target.value)}
          className="text-xs bg-white border border-slate-300 rounded px-1.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 min-w-[100px]"
          data-testid="inline-select-location"
        >
          <option value="">No location</option>
          {locations?.map((l: any) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </TableCell>
      <TableCell className="py-2 pr-5 align-top">
        <div className="flex gap-1 flex-wrap">
          <Button
            size="sm"
            className="h-7 text-xs bg-blue-600 hover:bg-blue-700 px-2.5"
            onClick={() => save(false)}
            disabled={createMutation.isPending}
            data-testid="inline-button-save"
          >
            {createMutation.isPending ? "…" : "Save"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs px-2 border-blue-300 text-blue-700 hover:bg-blue-50"
            onClick={() => save(true)}
            disabled={createMutation.isPending}
            data-testid="inline-button-save-next"
            title="Save and add another"
          >
            +Next
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs px-2 text-slate-400 hover:text-slate-700"
            onClick={onCancel}
            disabled={createMutation.isPending}
            data-testid="inline-button-cancel"
          >
            <XIcon className="w-3 h-3" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

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
    onSuccess: () => { toast({ title: "Family updated" }); invalidate(); onClose(); },
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
      setSelectedIds(new Set()); setShowMoveInput(false); setMoveTarget("");
      onClose();
    },
    onError: (err: any) => toast({ title: "Move failed", description: err.message, variant: "destructive" }),
  });

  const deleteItems = useMutation({
    mutationFn: () => apiRequest("POST", `/api/inventory/items/bulk-delete`, { itemIds: [...selectedIds] }),
    onSuccess: () => {
      toast({ title: `${selectedIds.size} item(s) removed` });
      invalidate();
      setSelectedIds(new Set()); setConfirmDelete(false);
      onClose();
    },
    onError: (err: any) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
  });

  const toggleItem = (id: number) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Family Name</label>
              <Input value={familyName} onChange={e => setFamilyName(e.target.value)} placeholder="e.g. EMT Conduit" data-testid="input-family-name" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Representative Image URL</label>
              <Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://…" data-testid="input-family-image-url" />
            </div>
          </div>
          {imageUrl && (
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg p-2">
              <img src={imageUrl} alt="preview" className="w-14 h-14 object-cover rounded-md border border-slate-200" onError={e => { e.currentTarget.style.opacity = "0.3"; }} />
              <span className="text-xs text-slate-500">Image preview</span>
            </div>
          )}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={selectedIds.size === group.items.length && group.items.length > 0} onChange={toggleAll} className="rounded border-slate-300" data-testid="checkbox-select-all" />
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{group.items.length} item{group.items.length !== 1 ? "s" : ""} in this family</span>
              </div>
              {selectedIds.size > 0 && <span className="text-xs text-blue-600 font-medium">{selectedIds.size} selected</span>}
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
          {selectedIds.size > 0 && (
            <div className="border border-slate-200 rounded-xl p-3 space-y-3 bg-slate-50/60">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions for {selectedIds.size} selected item{selectedIds.size !== 1 ? "s" : ""}</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50" onClick={() => { setShowMoveInput(!showMoveInput); setConfirmDelete(false); }} data-testid="button-move-items">
                  <MoveRight className="w-3.5 h-3.5 mr-1.5" />Move to family…
                </Button>
                <Button type="button" size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => { setConfirmDelete(!confirmDelete); setShowMoveInput(false); }} data-testid="button-delete-items">
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />Remove selected
                </Button>
              </div>
              {showMoveInput && (
                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1">
                    <label className="text-xs text-slate-600 font-medium">Target family name</label>
                    <Input value={moveTarget} onChange={e => setMoveTarget(e.target.value)} placeholder="Existing or new family name…" list="move-target-suggestions" data-testid="input-move-target" />
                    <datalist id="move-target-suggestions">{otherFamilies.map(f => <option key={f} value={f} />)}</datalist>
                  </div>
                  <Button type="button" size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => moveItems.mutate()} disabled={!moveTarget.trim() || moveItems.isPending} data-testid="button-confirm-move">
                    {moveItems.isPending ? "Moving…" : "Move"}
                  </Button>
                </div>
              )}
              {confirmDelete && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-2.5">
                  <span className="text-sm text-red-700 flex-1">Remove {selectedIds.size} item(s) from inventory permanently?</span>
                  <Button type="button" size="sm" variant="destructive" onClick={() => deleteItems.mutate()} disabled={deleteItems.isPending} data-testid="button-confirm-delete">
                    {deleteItems.isPending ? "Removing…" : "Confirm"}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-1 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={onClose} disabled={saveMeta.isPending}>Cancel</Button>
            <Button type="button" className="bg-blue-600 hover:bg-blue-700" onClick={() => saveMeta.mutate()} disabled={saveMeta.isPending || !familyName.trim()} data-testid="button-save-family">
              {saveMeta.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type DraftFamily = {
  name: string;
  imageUrl: string;
  showImageInput: boolean;
  confirmed: boolean;
};

export default function CategoryDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: locations } = useLocations();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [familyFilter, setFamilyFilter] = useState("all");
  const [editingGroup, setEditingGroup] = useState<CategoryItemGroup | null>(null);
  const [draftFamily, setDraftFamily] = useState<DraftFamily | null>(null);
  const [inlineAddFamilies, setInlineAddFamilies] = useState<Set<string>>(new Set());
  const [inlineRowVersions, setInlineRowVersions] = useState<Record<string, number>>({});

  const { data, isLoading, isError } = useQuery<CategoryGroupedDetail>({
    queryKey: ["/api/inventory/category", id, "grouped"],
    queryFn: () => fetch(`/api/inventory/category/${id}/grouped`).then(r => r.json()),
    enabled: !!id,
  });

  useEffect(() => {
    if (draftFamily?.confirmed && data) {
      const exists = data.groups.some(g => g.baseItemName === draftFamily.name);
      if (exists) setDraftFamily(null);
    }
  }, [data, draftFamily]);

  const allSkus = useMemo(() => {
    if (!data) return new Set<string>();
    const s = new Set<string>();
    data.groups.forEach(g => g.items.forEach(i => s.add(i.sku.toUpperCase())));
    return s;
  }, [data]);

  const filteredGroups = useMemo(() => {
    if (!data) return [];
    const tokens = search.trim().toLowerCase().split(/\s+/).filter(t => t.length > 0);
    return data.groups
      .filter(g => familyFilter === "all" || g.baseItemName === familyFilter)
      .map(g => ({
        ...g,
        items: g.items.filter(item => {
          const matchesStatus = statusFilter === "all" || item.status === statusFilter;
          if (!matchesStatus) return false;
          if (tokens.length === 0) return true;
          const haystack = [item.sku, item.name, item.sizeLabel || "", g.baseItemName, item.location?.name || ""].join(" ").toLowerCase();
          return tokens.every(t => haystack.includes(t));
        }),
      }))
      .filter(g => g.items.length > 0 || inlineAddFamilies.has(g.baseItemName));
  }, [data, search, statusFilter, familyFilter, inlineAddFamilies]);

  const displayGroups = useMemo(() => {
    if (!draftFamily?.confirmed) return filteredGroups;
    const draftInReal = filteredGroups.some(g => g.baseItemName === draftFamily.name);
    if (draftInReal) return filteredGroups;
    return [
      { baseItemName: draftFamily.name, items: [], representativeImage: draftFamily.imageUrl || null, customImageUrl: null },
      ...filteredGroups,
    ];
  }, [filteredGroups, draftFamily]);

  const openInlineAdd = useCallback((familyName: string) => {
    setInlineAddFamilies(prev => new Set([...prev, familyName]));
  }, []);

  const handleInlineSaved = useCallback((familyName: string, andNext: boolean) => {
    if (andNext) {
      setInlineRowVersions(prev => ({ ...prev, [familyName]: (prev[familyName] || 0) + 1 }));
    } else {
      setInlineAddFamilies(prev => { const n = new Set(prev); n.delete(familyName); return n; });
    }
  }, []);

  const handleInlineCancel = useCallback((familyName: string) => {
    setInlineAddFamilies(prev => { const n = new Set(prev); n.delete(familyName); return n; });
    setDraftFamily(prev => {
      if (prev?.confirmed && prev.name === familyName) return null;
      return prev;
    });
  }, []);

  const handleConfirmDraftFamily = useCallback(() => {
    if (!draftFamily?.name.trim()) return;
    const trimmed = draftFamily.name.trim();
    if (data?.groups.some(g => g.baseItemName === trimmed)) {
      toast({ title: "Family already exists", description: `"${trimmed}" already exists. Use the Add button in that family instead.`, variant: "destructive" });
      return;
    }
    setDraftFamily(prev => prev ? { ...prev, name: trimmed, confirmed: true } : null);
    setInlineAddFamilies(prev => new Set([...prev, trimmed]));
  }, [draftFamily, data, toast]);

  const handleSaveDraftFamilyImage = useCallback(async (familyName: string, imageUrl: string) => {
    if (!imageUrl || !id) return;
    try {
      await apiRequest("PUT", `/api/inventory/category/${id}/item-groups`, { baseItemName: familyName, imageUrl });
      qc.invalidateQueries({ queryKey: ["/api/inventory/category", id, "grouped"] });
    } catch (_) {}
  }, [id, qc]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
        <div className="h-12 bg-slate-100 rounded-xl animate-pulse" />
        <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-40 bg-slate-100 rounded-xl animate-pulse" />)}</div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="text-center py-20 text-slate-500">
        <XCircle className="w-12 h-12 mx-auto mb-3 text-red-300" />
        <p className="text-lg font-medium text-slate-900">Category not found</p>
        <Link href="/inventory"><Button variant="outline" className="mt-4">← Back to Inventory</Button></Link>
      </div>
    );
  }

  const { category, skuCount, totalQuantity, lowStockCount, outOfStockCount, groups } = data;
  const gradientClass = CATEGORY_FALLBACK_COLORS[category.code || ""] || "from-slate-600 to-slate-800";
  const hasActiveFilters = search.trim() !== "" || statusFilter !== "all" || familyFilter !== "all";
  const existingFamilies = groups.map(g => g.baseItemName).filter(Boolean) as string[];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/inventory" className="hover:text-blue-600 transition-colors">Inventory</Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-slate-900 font-medium">{category.name}</span>
      </div>

      <div className="relative rounded-2xl overflow-hidden shadow-lg" style={{ height: "200px" }}>
        {category.imageUrl ? (
          <img
            src={category.imageUrl}
            alt={category.name}
            className="w-full h-full object-cover object-center"
            style={{ objectPosition: "center 40%" }}
            onError={(e) => {
              e.currentTarget.style.display = "none";
              (e.currentTarget.nextElementSibling as HTMLElement)?.classList.remove("hidden");
            }}
          />
        ) : null}
        <div className={`${category.imageUrl ? "hidden" : ""} absolute inset-0 bg-gradient-to-br ${gradientClass}`} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <Link href="/inventory" className="inline-flex items-center gap-1.5 text-white/70 hover:text-white text-sm mb-2 transition-colors">
            <ArrowLeft className="w-4 h-4" />Back to Inventory
          </Link>
          <h1 className="text-2xl font-display font-bold text-white">{category.name}</h1>
          {category.description && <p className="text-white/70 text-sm mt-0.5 max-w-2xl">{category.description}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1"><Package className="w-4 h-4 text-blue-600" /><span className="text-xs text-slate-500 font-medium uppercase tracking-wide">SKUs</span></div>
          <p className="text-2xl font-bold text-slate-900" data-testid="stat-sku-count">{skuCount}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1"><CheckCircle2 className="w-4 h-4 text-emerald-600" /><span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Total Qty</span></div>
          <p className="text-2xl font-bold text-slate-900" data-testid="stat-total-qty">{totalQuantity.toLocaleString()}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1"><AlertTriangle className="w-4 h-4 text-amber-500" /><span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Low Stock</span></div>
          <p className="text-2xl font-bold text-amber-600" data-testid="stat-low-stock">{lowStockCount}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1"><XCircle className="w-4 h-4 text-red-500" /><span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Out of Stock</span></div>
          <p className="text-2xl font-bold text-red-600" data-testid="stat-out-of-stock">{outOfStockCount}</p>
        </div>
      </div>

      {/* Toolbar */}
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
          <SelectTrigger className="w-[140px] h-9 text-sm bg-slate-50 border-slate-200" data-testid="select-status-filter"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="in_stock">In Stock</SelectItem>
            <SelectItem value="low_stock">Low Stock</SelectItem>
            <SelectItem value="out_of_stock">Out of Stock</SelectItem>
          </SelectContent>
        </Select>
        <Select value={familyFilter} onValueChange={setFamilyFilter}>
          <SelectTrigger className="w-[200px] h-9 text-sm bg-slate-50 border-slate-200" data-testid="select-family-filter"><SelectValue placeholder="Family" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Families</SelectItem>
            {groups.map(g => <SelectItem key={g.baseItemName} value={g.baseItemName}>{g.baseItemName}</SelectItem>)}
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <button onClick={() => { setSearch(""); setStatusFilter("all"); setFamilyFilter("all"); }} className="text-xs text-slate-500 hover:text-blue-600 transition-colors whitespace-nowrap" data-testid="button-clear-filters">
            Clear filters
          </button>
        )}
        <span className="text-xs text-slate-400 whitespace-nowrap">
          {filteredGroups.reduce((n, g) => n + g.items.length, 0)} items{hasActiveFilters ? " matching" : ""}
        </span>
        <Button
          onClick={() => {
            if (!draftFamily) setDraftFamily({ name: "", imageUrl: "", showImageInput: false, confirmed: false });
          }}
          className="ml-auto bg-blue-600 hover:bg-blue-700 text-white h-9 text-sm shrink-0"
          disabled={!!draftFamily && !draftFamily.confirmed}
          data-testid="button-new-family"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          New Family
        </Button>
      </div>

      {/* Draft family card (unconfirmed) */}
      {draftFamily && !draftFamily.confirmed && (
        <div className="bg-white border-2 border-blue-300 border-dashed rounded-xl overflow-hidden shadow-sm" data-testid="draft-family-card">
          <div className="flex items-start gap-3 px-5 py-4 bg-blue-50/30">
            <div className="w-11 h-11 rounded-lg overflow-hidden bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center shrink-0 mt-0.5">
              {draftFamily.imageUrl ? (
                <img src={draftFamily.imageUrl} alt="" className="w-full h-full object-cover" onError={e => { e.currentTarget.style.opacity = "0.3"; }} />
              ) : (
                <Package className="w-5 h-5 text-slate-300" />
              )}
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <input
                autoFocus
                value={draftFamily.name}
                onChange={e => setDraftFamily(prev => prev ? { ...prev, name: e.target.value } : null)}
                placeholder="Enter family name…"
                className="w-full font-semibold text-slate-900 bg-transparent border-b-2 border-blue-300 focus:border-blue-500 focus:outline-none py-0.5 text-sm placeholder-slate-400"
                data-testid="input-draft-family-name"
                onKeyDown={e => {
                  if (e.key === "Enter") handleConfirmDraftFamily();
                  if (e.key === "Escape") setDraftFamily(null);
                }}
              />
              {!draftFamily.showImageInput ? (
                <button
                  className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 transition-colors"
                  onClick={() => setDraftFamily(prev => prev ? { ...prev, showImageInput: true } : null)}
                  data-testid="button-add-image-link"
                >
                  <ImageIcon className="w-3 h-3" />Add image link
                </button>
              ) : (
                <input
                  autoFocus
                  value={draftFamily.imageUrl}
                  onChange={e => setDraftFamily(prev => prev ? { ...prev, imageUrl: e.target.value } : null)}
                  placeholder="https://… (image URL)"
                  className="w-full text-xs bg-white border border-blue-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  data-testid="input-draft-family-image"
                />
              )}
            </div>
            <div className="flex gap-2 shrink-0 mt-0.5">
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white h-7 text-xs gap-1"
                onClick={handleConfirmDraftFamily}
                disabled={!draftFamily.name.trim()}
                data-testid="button-confirm-draft-family"
              >
                <Check className="w-3 h-3" />Confirm
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-slate-500 hover:text-slate-800"
                onClick={() => setDraftFamily(null)}
                data-testid="button-cancel-draft-family"
              >
                <XIcon className="w-3 h-3 mr-1" />Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Family groups */}
      {displayGroups.length === 0 && !draftFamily ? (
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
                <button
                  onClick={() => setDraftFamily({ name: "", imageUrl: "", showImageInput: false, confirmed: false })}
                  className="text-blue-600 hover:underline"
                >
                  Create the first family
                </button>
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {displayGroups.map((group) => {
            const groupLowStock = group.items.filter(i => i.status === "low_stock").length;
            const groupOutOfStock = group.items.filter(i => i.status === "out_of_stock").length;
            const hasInlineRow = inlineAddFamilies.has(group.baseItemName);
            const rowKey = `inline-${group.baseItemName}-${inlineRowVersions[group.baseItemName] || 0}`;
            const isDraftConfirmed = draftFamily?.confirmed && draftFamily.name === group.baseItemName;

            return (
              <div
                key={group.baseItemName}
                className={`bg-white border rounded-xl overflow-hidden shadow-sm ${isDraftConfirmed ? "border-blue-300 border-2" : "border-slate-200"}`}
                data-testid={`family-card-${group.baseItemName.replace(/\s+/g, "-")}`}
              >
                {/* Family header */}
                <div className="flex items-center justify-between px-5 border-b border-slate-200 bg-slate-50/80 min-h-[60px]">
                  <div className="flex items-center gap-3 py-3 flex-1 min-w-0">
                    <div className="w-11 h-11 rounded-lg overflow-hidden bg-white border border-slate-200 flex items-center justify-center shrink-0">
                      {group.representativeImage ? (
                        <img src={group.representativeImage} alt={group.baseItemName} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-5 h-5 text-slate-300" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-slate-900 text-sm leading-snug truncate">{group.baseItemName}</h3>
                      <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider leading-none mt-0.5">
                        {group.items.length} {group.items.length === 1 ? "size" : "sizes"}
                        {isDraftConfirmed && <span className="ml-2 text-blue-500 normal-case tracking-normal">New family</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 pl-3">
                    {groupOutOfStock > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-full px-2.5 py-0.5 whitespace-nowrap">
                        <XCircle className="w-3 h-3" />{groupOutOfStock} out of stock
                      </span>
                    )}
                    {groupLowStock > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5 whitespace-nowrap">
                        <AlertTriangle className="w-3 h-3" />{groupLowStock} low
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-slate-500 hover:text-blue-600 hover:bg-blue-50 gap-1"
                      onClick={() => setEditingGroup(group)}
                      data-testid={`button-edit-family-${group.baseItemName.replace(/\s+/g, "-")}`}
                    >
                      <Pencil className="w-3 h-3" />Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 gap-1"
                      onClick={() => openInlineAdd(group.baseItemName)}
                      disabled={hasInlineRow}
                      data-testid={`button-add-item-${group.baseItemName.replace(/\s+/g, "-")}`}
                    >
                      <Plus className="w-3 h-3" />Add
                    </Button>
                  </div>
                </div>

                {/* Items table */}
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
                      {hasInlineRow && (
                        <InlineAddRow
                          key={rowKey}
                          familyName={group.baseItemName}
                          categoryId={data.category.id}
                          existingSkus={allSkus}
                          locations={locations}
                          onSaved={() => {
                            handleInlineSaved(group.baseItemName, false);
                            if (isDraftConfirmed && draftFamily?.imageUrl) {
                              handleSaveDraftFamilyImage(group.baseItemName, draftFamily.imageUrl);
                            }
                          }}
                          onSaveNext={() => handleInlineSaved(group.baseItemName, true)}
                          onCancel={() => handleInlineCancel(group.baseItemName)}
                        />
                      )}
                      {group.items.map((item) => (
                        <TableRow
                          key={item.id}
                          className={`hover:bg-slate-50/70 transition-colors ${item.status === "out_of_stock" ? "bg-red-50/20" : item.status === "low_stock" ? "bg-amber-50/20" : ""}`}
                          data-testid={`row-item-${item.id}`}
                        >
                          <TableCell className="font-mono text-xs text-slate-500 py-2.5 pl-5">{item.sku}</TableCell>
                          <TableCell className="font-semibold text-slate-800 text-sm py-2.5 whitespace-nowrap">{item.sizeLabel || "—"}</TableCell>
                          <TableCell className="text-slate-700 text-sm py-2.5">
                            <Link href={`/inventory/${item.id}`} className="hover:text-blue-600 hover:underline transition-colors" data-testid={`link-item-name-${item.id}`}>
                              {item.name}
                            </Link>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-slate-900 py-2.5 tabular-nums">{item.quantityOnHand.toLocaleString()}</TableCell>
                          <TableCell className="text-slate-500 text-sm py-2.5">{item.unitOfMeasure}</TableCell>
                          <TableCell className="text-slate-600 text-sm py-2.5 whitespace-nowrap">{item.location?.name || "—"}</TableCell>
                          <TableCell className="py-2.5 pr-5"><StatusBadge status={item.status} /></TableCell>
                        </TableRow>
                      ))}
                      {group.items.length === 0 && !hasInlineRow && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-6 text-slate-400 text-sm">
                            No items yet.{" "}
                            <button
                              className="text-blue-600 hover:underline"
                              onClick={() => openInlineAdd(group.baseItemName)}
                              data-testid={`link-add-first-item-${group.baseItemName.replace(/\s+/g, "-")}`}
                            >
                              Click Add to create the first item.
                            </button>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
