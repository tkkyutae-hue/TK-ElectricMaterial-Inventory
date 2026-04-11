import { useState, useMemo, useEffect, useCallback } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Package, AlertTriangle, XCircle, CheckCircle2, ChevronRight,
  Search, Plus, Check, X as XIcon, ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLocations } from "@/hooks/use-reference-data";
import { apiRequest } from "@/lib/queryClient";
import { getCategoryGradient } from "@/lib/categoryUtils";
import { isReelEligible } from "@/lib/reelEligibility";

import type {
  CategoryGroupedDetail, CategoryGroupedItem, CategoryItemGroup,
  EditDraft, NewRowDraft, DraftFamily,
} from "@/components/category/types";
import { FamilyEditDialog } from "@/components/category/FamilyEditDialog";
import { FamilyGroupCard } from "@/components/category/FamilyGroupCard";
import { ErrorState } from "@/components/shared/ErrorState";

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CategoryDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: locations } = useLocations();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [familyFilter, setFamilyFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [editingGroup, setEditingGroup] = useState<CategoryItemGroup | null>(null);
  const [draftFamily, setDraftFamily] = useState<DraftFamily | null>(null);

  const [familySortDir, setFamilySortDir] = useState<Record<string, "asc" | "desc">>({});

  const [inlineEditFamily, setInlineEditFamily] = useState<string | null>(null);
  const [editDrafts, setEditDrafts] = useState<Record<number, EditDraft>>({});
  const [editNewRows, setEditNewRows] = useState<NewRowDraft[]>([]);
  const [savingInline, setSavingInline] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<CategoryGroupedDetail>({
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
          const matchesLocation = locationFilter === "all" || (item.location?.name ?? "") === locationFilter;
          if (!matchesLocation) return false;
          if (tokens.length === 0) return true;
          const haystack = [item.sku, item.name, item.sizeLabel || "", g.baseItemName, item.location?.name || ""].join(" ").toLowerCase();
          return tokens.every(t => haystack.includes(t));
        }),
      }))
      .filter(g => g.items.length > 0 || inlineEditFamily === g.baseItemName);
  }, [data, search, statusFilter, familyFilter, locationFilter, inlineEditFamily]);

  const displayGroups = useMemo(() => {
    if (!draftFamily?.confirmed) return filteredGroups;
    const draftInReal = filteredGroups.some(g => g.baseItemName === draftFamily.name);
    if (draftInReal) return filteredGroups;
    return [
      { baseItemName: draftFamily.name, items: [], representativeImage: draftFamily.imageUrl || null, customImageUrl: null },
      ...filteredGroups,
    ];
  }, [filteredGroups, draftFamily]);

  const handleConfirmDraftFamily = useCallback(() => {
    if (!draftFamily?.name.trim()) return;
    const trimmed = draftFamily.name.trim();
    if (data?.groups.some(g => g.baseItemName === trimmed)) {
      toast({ title: "Family already exists", description: `"${trimmed}" already exists. Click Edit in that family to add items.`, variant: "destructive" });
      return;
    }
    setDraftFamily(prev => prev ? { ...prev, name: trimmed, confirmed: true } : null);
  }, [draftFamily, data, toast]);

  const handleSaveDraftFamilyImage = useCallback(async (familyName: string, imageUrl: string) => {
    if (!imageUrl || !id) return;
    try {
      await apiRequest("PUT", `/api/inventory/category/${id}/item-groups`, { baseItemName: familyName, imageUrl });
      qc.invalidateQueries({ queryKey: ["/api/inventory/category", id, "grouped"] });
    } catch (_) {}
  }, [id, qc]);

  // ── Inline Edit handlers ──────────────────────────────────────────────────
  const enterInlineEdit = useCallback((group: CategoryItemGroup) => {
    const drafts: Record<number, EditDraft> = {};
    group.items.forEach(item => {
      const locId = (item as any).primaryLocationId
        ? (item as any).primaryLocationId
        : locations?.find((l: any) => l.name === item.location?.name)?.id ?? null;
      drafts[item.id] = {
        sizeLabel: item.sizeLabel ?? "",
        name: item.name,
        quantityOnHand: item.quantityOnHand,
        unitOfMeasure: item.unitOfMeasure,
        primaryLocationId: locId,
        imageUrl: item.imageUrl ?? null,
        trackingMode: item.trackingMode ?? null,
        trackingModeError: "",
      };
    });
    setEditDrafts(drafts);
    setEditNewRows([]);
    setInlineEditFamily(group.baseItemName);
  }, [locations]);

  const cancelInlineEdit = useCallback(() => {
    setInlineEditFamily(null);
    setEditDrafts({});
    setEditNewRows([]);
  }, []);

  const updateDraft = useCallback((itemId: number, patch: Partial<EditDraft>) => {
    setEditDrafts(prev => ({ ...prev, [itemId]: { ...prev[itemId], ...patch } }));
  }, []);

  const deleteRow = useCallback((itemId: number) => {
    setEditDrafts(prev => ({ ...prev, [itemId]: { ...prev[itemId], _deleted: true } }));
  }, []);

  const addNewRow = useCallback(() => {
    setEditNewRows(prev => [...prev, {
      tmpId: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sku: "", sizeLabel: "", name: "", quantityOnHand: 0,
      unitOfMeasure: "EA", primaryLocationId: null, imageUrl: null,
      skuError: "", nameManuallyEdited: false, skuManuallyEdited: false,
      subcategoryOverride: null, detailTypeOverride: null,
      trackingMode: null, trackingModeError: "",
    }]);
  }, []);

  const updateNewRow = useCallback((tmpId: string, patch: Partial<NewRowDraft>) => {
    setEditNewRows(prev => prev.map(r => r.tmpId === tmpId ? { ...r, ...patch } : r));
  }, []);

  const removeNewRow = useCallback((tmpId: string) => {
    setEditNewRows(prev => prev.filter(r => r.tmpId !== tmpId));
  }, []);

  const saveInlineEdits = useCallback(async (group: CategoryItemGroup) => {
    const allCurrentSkus = new Set(allSkus);

    const activeItems = group.items.filter(item => !editDrafts[item.id]?._deleted);
    for (const item of activeItems) {
      const d = editDrafts[item.id];
      if (!d) continue;
      if (!d.name.trim()) { toast({ title: "Validation error", description: `Item name required for ${item.sku}`, variant: "destructive" }); return; }
      if (d.quantityOnHand < 0) { toast({ title: "Validation error", description: `Qty must be ≥ 0 for ${item.sku}`, variant: "destructive" }); return; }
      if (d.trackingModeError) { toast({ title: "Tracking mode error", description: `${item.sku}: ${d.trackingModeError}`, variant: "destructive" }); return; }
      if (d.trackingMode === "reel" && !isReelEligible({ name: d.name, sku: item.sku, subcategory: item.subcategory, detailType: item.detailType, baseItemName: item.baseItemName, unitOfMeasure: d.unitOfMeasure })) {
        toast({ title: "Tracking mode error", description: `${item.sku}: This item type is not eligible for reel tracking`, variant: "destructive" }); return;
      }
    }

    const newSkusSeen = new Set<string>();
    for (const row of editNewRows) {
      const sku = row.sku.trim().toUpperCase();
      if (!sku) { toast({ title: "Validation error", description: "SKU is required for all new items", variant: "destructive" }); return; }
      if (!row.name.trim()) { toast({ title: "Validation error", description: `Item name required for ${sku}`, variant: "destructive" }); return; }
      if (!row.sizeLabel.trim()) { toast({ title: "Validation error", description: `Size required for ${sku}`, variant: "destructive" }); return; }
      if (allCurrentSkus.has(sku) || newSkusSeen.has(sku)) { toast({ title: "Duplicate SKU", description: `${sku} already exists`, variant: "destructive" }); return; }
      if (row.trackingModeError) { toast({ title: "Tracking mode error", description: `${sku}: ${row.trackingModeError}`, variant: "destructive" }); return; }
      if (row.trackingMode === "reel" && !isReelEligible({ name: row.name, subcategory: row.subcategoryOverride || null, detailType: row.detailTypeOverride || null, unitOfMeasure: row.unitOfMeasure })) {
        toast({ title: "Tracking mode error", description: `${sku}: This item type is not eligible for reel tracking`, variant: "destructive" }); return;
      }
      newSkusSeen.add(sku);
    }

    setSavingInline(true);
    try {
      const promises: Promise<any>[] = [];

      for (const item of group.items) {
        const d = editDrafts[item.id];
        if (!d) continue;
        if (d._deleted) {
          promises.push(fetch(`/api/items/${item.id}`, { method: "DELETE", credentials: "include" }));
          continue;
        }
        const changed = d.name !== item.name || d.sizeLabel !== (item.sizeLabel ?? "") ||
          d.quantityOnHand !== item.quantityOnHand || d.unitOfMeasure !== item.unitOfMeasure ||
          d.primaryLocationId !== ((item as any).primaryLocationId ?? null) ||
          (d.trackingMode ?? null) !== (item.trackingMode ?? null);
        if (changed) {
          promises.push(fetch(`/api/items/${item.id}`, {
            method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
            body: JSON.stringify({ name: d.name.trim(), sizeLabel: d.sizeLabel || null, quantityOnHand: d.quantityOnHand, unitOfMeasure: d.unitOfMeasure, primaryLocationId: d.primaryLocationId || null, trackingMode: d.trackingMode ?? null }),
          }));
        }
        if (d.imageUrl !== (item.imageUrl ?? null)) {
          promises.push(fetch(`/api/inventory/${item.id}/image`, {
            method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
            body: JSON.stringify({ imageUrl: d.imageUrl }),
          }));
        }
      }

      for (const row of editNewRows) {
        promises.push(fetch("/api/items", {
          method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
          body: JSON.stringify({
            sku: row.sku.trim().toUpperCase(),
            name: row.name.trim(),
            baseItemName: group.baseItemName,
            sizeLabel: row.sizeLabel.trim() || null,
            categoryId: data?.category.id,
            unitOfMeasure: row.unitOfMeasure,
            quantityOnHand: row.quantityOnHand,
            primaryLocationId: row.primaryLocationId || null,
            subcategory: row.subcategoryOverride || null,
            detailType: row.detailTypeOverride || null,
            trackingMode: row.trackingMode ?? null,
            reorderPoint: 0, reorderQuantity: 0, minimumStock: 0, unitCost: "0.00",
          }),
        }));
      }

      await Promise.all(promises);
      await qc.invalidateQueries({ queryKey: ["/api/inventory/category", id, "grouped"] });
      await qc.invalidateQueries({ queryKey: ["/api/inventory/categories/summary"] });

      const isDraftConfirmed = draftFamily?.confirmed && draftFamily.name === group.baseItemName;
      if (isDraftConfirmed && draftFamily?.imageUrl) {
        await handleSaveDraftFamilyImage(group.baseItemName, draftFamily.imageUrl);
      }

      const deletedCount = group.items.filter(i => editDrafts[i.id]?._deleted).length;
      const updatedCount = group.items.length - deletedCount;
      const createdCount = editNewRows.length;
      toast({
        title: "Changes saved",
        description: [
          updatedCount > 0 && `${updatedCount} updated`,
          createdCount > 0 && `${createdCount} added`,
          deletedCount > 0 && `${deletedCount} removed`,
        ].filter(Boolean).join(", ") + ".",
      });

      setInlineEditFamily(null);
      setEditDrafts({});
      setEditNewRows([]);
    } catch (err: any) {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    } finally {
      setSavingInline(false);
    }
  }, [editDrafts, editNewRows, allSkus, id, qc, toast, data, draftFamily, handleSaveDraftFamilyImage]);

  const toggleFamilySort = useCallback((familyName: string) => {
    setFamilySortDir(prev => ({ ...prev, [familyName]: prev[familyName] === "desc" ? "asc" : "desc" }));
  }, []);

  // ── Loading / error states ────────────────────────────────────────────────
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
      <ErrorState
        title="Category not found"
        description="This category may have been removed or you may not have access to it."
        retryLabel="Try again"
        onRetry={() => refetch()}
      />
    );
  }

  const { category, skuCount, totalQuantity, lowStockCount, outOfStockCount, groups } = data;
  const gradientClass = getCategoryGradient(category.code);
  const hasActiveFilters = search.trim() !== "" || statusFilter !== "all" || familyFilter !== "all" || locationFilter !== "all";
  const existingFamilies = groups.map(g => g.baseItemName).filter(Boolean) as string[];
  const uniqueLocationNames = Array.from(
    new Set(groups.flatMap(g => g.items.map(i => i.location?.name).filter((n): n is string => !!n)))
  ).sort();

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/inventory" className="hover:text-brand-600 transition-colors">Inventory</Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-slate-900 font-medium">{category.name}</span>
      </div>

      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden shadow-xl bg-[#16202e]" style={{ height: "210px" }}>
        {category.imageUrl && (
          <img src={category.imageUrl} aria-hidden className="absolute inset-0 w-full h-full object-cover scale-125 blur-2xl opacity-80 brightness-70 saturate-200 pointer-events-none" />
        )}
        {category.imageUrl ? (
          <img src={category.imageUrl} alt={category.name} className="absolute inset-0 w-full h-full object-contain object-center z-10"
            onError={(e) => { e.currentTarget.style.display = "none"; (e.currentTarget.previousElementSibling as HTMLElement)?.style.setProperty("display","none"); (e.currentTarget.nextElementSibling as HTMLElement)?.classList.remove("hidden"); }} />
        ) : null}
        <div className={`${category.imageUrl ? "hidden" : ""} absolute inset-0 bg-gradient-to-br ${gradientClass}`} />
        <div className="absolute inset-0 z-20 bg-gradient-to-r from-black/70 via-black/20 to-transparent pointer-events-none" />
        <div className="absolute inset-0 z-20 bg-gradient-to-t from-black/75 via-black/20 to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 z-30 p-6">
          <Link href="/inventory" className="inline-flex items-center gap-1.5 text-white/65 hover:text-white text-xs font-medium mb-2 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />Back to Inventory
          </Link>
          <h1
            className="!text-3xl font-display font-bold text-white"
            style={{ fontSize: "1.875rem", lineHeight: "2.25rem", fontWeight: 700, textShadow: "0 1px 6px rgba(0,0,0,0.6)" }}
          >{category.name}</h1>
          {category.description && <p className="text-white/65 text-sm mt-1 max-w-2xl leading-relaxed">{category.description}</p>}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: <Package className="w-4 h-4 text-brand-600" />, label: "SKUs", value: skuCount, cls: "text-slate-900", testid: "stat-sku-count" },
          { icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />, label: "Total Qty", value: totalQuantity.toLocaleString(), cls: "text-slate-900", testid: "stat-total-qty" },
          { icon: <AlertTriangle className="w-4 h-4 text-amber-500" />, label: "Low Stock", value: lowStockCount, cls: "text-amber-600", testid: "stat-low-stock" },
          { icon: <XCircle className="w-4 h-4 text-red-500" />, label: "Out of Stock", value: outOfStockCount, cls: "text-red-600", testid: "stat-out-of-stock" },
        ].map(card => (
          <div key={card.label} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">{card.icon}<span className="text-xs text-slate-500 font-medium uppercase tracking-wide">{card.label}</span></div>
            <p className={`text-2xl font-bold ${card.cls}`} data-testid={card.testid}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input placeholder="Search by SKU, name, size, or family…" className="pl-8 h-9 bg-slate-50 border-slate-200 text-sm focus:bg-white"
            value={search} onChange={e => setSearch(e.target.value)} data-testid="input-category-search" />
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
        {uniqueLocationNames.length > 0 && (
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-[180px] h-9 text-sm bg-slate-50 border-slate-200" data-testid="select-location-filter"><SelectValue placeholder="Location" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {uniqueLocationNames.map(loc => <SelectItem key={loc} value={loc}>{loc}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {hasActiveFilters && (
          <button onClick={() => { setSearch(""); setStatusFilter("all"); setFamilyFilter("all"); setLocationFilter("all"); }} className="text-xs text-slate-500 hover:text-brand-600 transition-colors whitespace-nowrap" data-testid="button-clear-filters">
            Clear filters
          </button>
        )}
        <span className="text-xs text-slate-400 whitespace-nowrap">
          {filteredGroups.reduce((n, g) => n + g.items.length, 0)} items{hasActiveFilters ? " matching" : ""}
        </span>
        <Button
          onClick={() => { if (!draftFamily) setDraftFamily({ name: "", imageUrl: "", showImageInput: false, confirmed: false }); }}
          className="ml-auto bg-brand-700 hover:bg-brand-800 text-white h-9 text-sm shrink-0"
          disabled={!!draftFamily && !draftFamily.confirmed}
          data-testid="button-new-family"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />New Family
        </Button>
      </div>

      {/* Draft family card (unconfirmed) */}
      {draftFamily && !draftFamily.confirmed && (
        <div className="bg-white border-2 border-brand-300 border-dashed rounded-xl overflow-hidden shadow-sm" data-testid="draft-family-card">
          <div className="flex items-start gap-3 px-5 py-4 bg-brand-50/30">
            <div className="w-11 h-11 rounded-lg overflow-hidden bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center shrink-0 mt-0.5">
              {draftFamily.imageUrl ? <img src={draftFamily.imageUrl} alt="" className="w-full h-full object-cover" onError={e => { e.currentTarget.style.opacity = "0.3"; }} /> : <Package className="w-5 h-5 text-slate-300" />}
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <input autoFocus value={draftFamily.name}
                onChange={e => setDraftFamily(prev => prev ? { ...prev, name: e.target.value } : null)}
                placeholder="Enter family name…"
                className="w-full font-semibold text-slate-900 bg-transparent border-b-2 border-brand-300 focus:border-brand-500 focus:outline-none py-0.5 text-sm placeholder-slate-400"
                data-testid="input-draft-family-name"
                onKeyDown={e => { if (e.key === "Enter") handleConfirmDraftFamily(); if (e.key === "Escape") setDraftFamily(null); }}
              />
              {!draftFamily.showImageInput ? (
                <button className="flex items-center gap-1 text-xs text-brand-500 hover:text-brand-700 transition-colors" onClick={() => setDraftFamily(prev => prev ? { ...prev, showImageInput: true } : null)} data-testid="button-add-image-link">
                  <ImageIcon className="w-3 h-3" />Add image link
                </button>
              ) : (
                <input autoFocus value={draftFamily.imageUrl} onChange={e => setDraftFamily(prev => prev ? { ...prev, imageUrl: e.target.value } : null)}
                  placeholder="https://… (image URL)" className="w-full text-xs bg-white border border-brand-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500" data-testid="input-draft-family-image" />
              )}
            </div>
            <div className="flex gap-2 shrink-0 mt-0.5">
              <Button size="sm" className="bg-brand-700 hover:bg-brand-800 text-white h-7 text-xs gap-1" onClick={handleConfirmDraftFamily} disabled={!draftFamily.name.trim()} data-testid="button-confirm-draft-family">
                <Check className="w-3 h-3" />Confirm
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-500 hover:text-slate-800" onClick={() => setDraftFamily(null)} data-testid="button-cancel-draft-family">
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
            <><p className="text-base font-semibold text-slate-900">No items match your search</p><p className="text-sm mt-1">Try different keywords or clear the filters.</p></>
          ) : (
            <><p className="text-base font-semibold text-slate-900">No items in this category</p>
              <p className="text-sm mt-1"><button onClick={() => setDraftFamily({ name: "", imageUrl: "", showImageInput: false, confirmed: false })} className="text-brand-600 hover:underline">Create the first family</button></p></>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {displayGroups.map((group) => (
            <FamilyGroupCard
              key={group.baseItemName}
              group={group}
              draftFamily={draftFamily}
              inlineEditFamily={inlineEditFamily}
              editDrafts={editDrafts}
              editNewRows={editNewRows}
              savingInline={savingInline}
              familySortDir={familySortDir}
              locations={locations || []}
              allSkus={allSkus}
              data={data}
              onEnterEdit={enterInlineEdit}
              onCancelEdit={cancelInlineEdit}
              onSaveEdit={saveInlineEdits}
              onAddRow={addNewRow}
              onUpdateDraft={updateDraft}
              onDeleteRow={deleteRow}
              onUpdateNewRow={updateNewRow}
              onRemoveNewRow={removeNewRow}
              onToggleSort={toggleFamilySort}
              onOpenSettings={setEditingGroup}
            />
          ))}
        </div>
      )}

      {/* Family Settings dialog */}
      {editingGroup && (
        <FamilyEditDialog open={!!editingGroup} onClose={() => setEditingGroup(null)} categoryId={data.category.id} group={editingGroup} allFamilies={existingFamilies} />
      )}
    </div>
  );
}
