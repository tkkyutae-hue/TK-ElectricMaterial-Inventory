import { useState, useEffect } from "react";
import { MoveRight, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ItemStatusBadge } from "@/components/StatusBadge";
import type { CategoryItemGroup, ItemClassDraft } from "./types";

const FAMILY_TABLE_COLS = "1.2rem 4.5rem 2fr 1fr 1fr 1fr 6.5rem";

interface FamilyEditDialogProps {
  open: boolean;
  onClose: () => void;
  categoryId: number;
  group: CategoryItemGroup;
  allFamilies: string[];
}

export function FamilyEditDialog({ open, onClose, categoryId, group, allFamilies }: FamilyEditDialogProps) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: classOptions } = useQuery<{ subcategories: string[]; detailTypes: string[]; subTypes: string[] }>({
    queryKey: ["/api/inventory/category", String(categoryId), "classification-options"],
    enabled: open,
  });

  const [familyName, setFamilyName] = useState(group.baseItemName);
  const [imageUrl, setImageUrl] = useState(group.representativeImage ?? "");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [moveTarget, setMoveTarget] = useState("");
  const [showMoveInput, setShowMoveInput] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [itemDrafts, setItemDrafts] = useState<Record<number, ItemClassDraft>>({});

  useEffect(() => {
    if (open) {
      setFamilyName(group.baseItemName);
      setImageUrl(group.representativeImage ?? "");
      setSelectedIds(new Set());
      setShowMoveInput(false);
      setConfirmDelete(false);
      const drafts: Record<number, ItemClassDraft> = {};
      for (const item of group.items) {
        drafts[item.id] = {
          name: item.name,
          subcategory: item.subcategory ?? "",
          detailType: item.detailType ?? "",
          subType: (item as any).subType ?? "",
        };
      }
      setItemDrafts(drafts);
    }
  }, [open, group.baseItemName, group.items]);

  const patchDraft = (id: number, patch: Partial<ItemClassDraft>) => {
    setItemDrafts(prev => {
      const next = { ...prev };
      next[id] = { ...next[id], ...patch };

      if ('subcategory' in patch || 'detailType' in patch) {
        const targetItem = group.items.find(i => i.id === id);
        if (targetItem) {
          const origSub = targetItem.subcategory ?? "";
          const origDt  = targetItem.detailType ?? "";

          for (const sibling of group.items) {
            if (sibling.id === id) continue;
            const sibSub = sibling.subcategory ?? "";
            const sibDt  = sibling.detailType  ?? "";
            if ('subcategory' in patch && sibSub === origSub) {
              next[sibling.id] = { ...next[sibling.id], subcategory: patch.subcategory! };
            }
            if ('detailType' in patch && sibDt === origDt) {
              next[sibling.id] = { ...next[sibling.id], detailType: patch.detailType! };
            }
          }
        }
      }

      return next;
    });
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["/api/inventory/category", String(categoryId), "grouped"] });
    qc.invalidateQueries({ queryKey: ["/api/inventory/categories/summary"] });
    qc.invalidateQueries({ queryKey: ["/api/field/families"] });
    qc.invalidateQueries({ queryKey: ["/api/field/types"] });
    qc.invalidateQueries({ queryKey: ["/api/field/subcategories"] });
    qc.invalidateQueries({ queryKey: ["/api/field/items"] });
    qc.invalidateQueries({ queryKey: ["/api/field/sizes"] });
  };

  const saveMeta = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", `/api/inventory/category/${categoryId}/item-groups`, {
        baseItemName: group.baseItemName, imageUrl: imageUrl || null,
        newName: familyName !== group.baseItemName ? familyName : undefined,
      });
      const changedItems = group.items.filter(item => {
        const d = itemDrafts[item.id];
        if (!d) return false;
        return d.name !== item.name ||
          d.subcategory !== (item.subcategory ?? "") ||
          d.detailType !== (item.detailType ?? "") ||
          d.subType !== ((item as any).subType ?? "");
      });
      if (changedItems.length > 0) {
        await Promise.all(changedItems.map(item => {
          const d = itemDrafts[item.id];
          return apiRequest("PUT", `/api/items/${item.id}`, {
            name: d.name,
            subcategory: d.subcategory || null,
            detailType: d.detailType || null,
            subType: d.subType || null,
          }).then(r => r.json());
        }));
      }
      await qc.refetchQueries({ queryKey: ["/api/inventory/category", String(categoryId), "grouped"] });
    },
    onSuccess: () => {
      toast({ title: "Settings saved" });
      qc.invalidateQueries({ queryKey: ["/api/inventory/categories/summary"] });
      qc.invalidateQueries({ queryKey: ["/api/field/families"] });
      qc.invalidateQueries({ queryKey: ["/api/field/types"] });
      qc.invalidateQueries({ queryKey: ["/api/field/subcategories"] });
      qc.invalidateQueries({ queryKey: ["/api/field/items"] });
      qc.invalidateQueries({ queryKey: ["/api/field/sizes"] });
      onClose();
    },
    onError: (err: any) => toast({ title: "Failed to save", description: err.message, variant: "destructive" }),
  });

  const moveItems = useMutation({
    mutationFn: () => apiRequest("POST", `/api/inventory/items/move-family`, { itemIds: [...selectedIds], newBaseItemName: moveTarget.trim() }),
    onSuccess: () => {
      toast({ title: `${selectedIds.size} item(s) moved to "${moveTarget}"` });
      invalidate(); setSelectedIds(new Set()); setShowMoveInput(false); setMoveTarget(""); onClose();
    },
    onError: (err: any) => toast({ title: "Move failed", description: err.message, variant: "destructive" }),
  });

  const deleteItems = useMutation({
    mutationFn: () => apiRequest("POST", `/api/inventory/items/bulk-delete`, { itemIds: [...selectedIds] }),
    onSuccess: () => {
      toast({ title: `${selectedIds.size} item(s) removed` });
      invalidate(); setSelectedIds(new Set()); setConfirmDelete(false); onClose();
    },
    onError: (err: any) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
  });

  const toggleItem = (id: number) => setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = () => { if (selectedIds.size === group.items.length) setSelectedIds(new Set()); else setSelectedIds(new Set(group.items.map(i => i.id))); };
  const otherFamilies = allFamilies.filter(f => f !== group.baseItemName);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[860px] w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Family Settings — {group.baseItemName}</DialogTitle></DialogHeader>
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

          {/* Item classification table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="grid gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200"
              style={{ gridTemplateColumns: FAMILY_TABLE_COLS }}>
              <div className="flex items-center justify-center">
                <input type="checkbox" checked={selectedIds.size === group.items.length && group.items.length > 0}
                  onChange={toggleAll} className="rounded border-slate-300" data-testid="checkbox-select-all" />
              </div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide self-center text-center">SKU</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide self-center text-center">Name</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide self-center text-center">Family</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide self-center text-center">Type</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide self-center text-center">Subcategory</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide self-center text-center">Status</span>
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
              {group.items.map(item => {
                const d = itemDrafts[item.id] ?? { name: item.name, subcategory: item.subcategory ?? "", detailType: item.detailType ?? "", subType: (item as any).subType ?? "" };
                const isChanged = d.name !== item.name || d.subcategory !== (item.subcategory ?? "") || d.detailType !== (item.detailType ?? "") || d.subType !== ((item as any).subType ?? "");
                return (
                  <div key={item.id}
                    className={`grid gap-2 px-3 py-2 items-center hover:bg-slate-50 ${selectedIds.has(item.id) ? "bg-brand-50/30" : ""} ${isChanged ? "bg-amber-50/50" : ""}`}
                    style={{ gridTemplateColumns: FAMILY_TABLE_COLS }}
                    data-testid={`row-family-item-${item.id}`}>
                    <div className="flex items-center justify-center">
                      <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleItem(item.id)}
                        className="rounded border-slate-300" onClick={e => e.stopPropagation()} />
                    </div>
                    <span className="text-xs text-slate-500 font-mono truncate text-center" title={item.sku}>{item.sku}</span>
                    <input
                      className="min-w-0 text-xs border border-slate-200 rounded px-1.5 py-1 w-full focus:outline-none focus:border-brand-400 bg-white"
                      value={d.name}
                      onChange={e => patchDraft(item.id, { name: e.target.value })}
                      data-testid={`input-item-name-${item.id}`}
                    />
                    <input
                      className="min-w-0 text-xs border border-slate-200 rounded px-1.5 py-1 w-full focus:outline-none focus:border-brand-400 bg-white"
                      value={d.subcategory}
                      onChange={e => patchDraft(item.id, { subcategory: e.target.value })}
                      placeholder="e.g. EMT Conduit"
                      list={`dl-subcategory-${categoryId}`}
                      data-testid={`input-item-family-${item.id}`}
                    />
                    <input
                      className="min-w-0 text-xs border border-slate-200 rounded px-1.5 py-1 w-full focus:outline-none focus:border-brand-400 bg-white"
                      value={d.detailType}
                      onChange={e => patchDraft(item.id, { detailType: e.target.value })}
                      placeholder="e.g. Connector"
                      list={`dl-detailtype-${categoryId}`}
                      data-testid={`input-item-type-${item.id}`}
                    />
                    <input
                      className="min-w-0 text-xs border border-slate-200 rounded px-1.5 py-1 w-full focus:outline-none focus:border-brand-400 bg-white"
                      value={d.subType}
                      onChange={e => patchDraft(item.id, { subType: e.target.value })}
                      placeholder="e.g. Set Screw"
                      list={`dl-subtype-${categoryId}`}
                      data-testid={`input-item-subtype-${item.id}`}
                    />
                    <div className="flex justify-center">
                      <ItemStatusBadge status={item.status} />
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedIds.size > 0 && (
              <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 flex items-center gap-2">
                <span className="text-xs text-brand-600 font-medium">{selectedIds.size} selected</span>
              </div>
            )}
          </div>

          {/* Datalists for autocomplete */}
          <datalist id={`dl-subcategory-${categoryId}`}>
            {classOptions?.subcategories.map(s => <option key={s} value={s}>{s}</option>)}
          </datalist>
          <datalist id={`dl-detailtype-${categoryId}`}>
            {classOptions?.detailTypes.map(s => <option key={s} value={s}>{s}</option>)}
          </datalist>
          <datalist id={`dl-subtype-${categoryId}`}>
            {classOptions?.subTypes.map(s => <option key={s} value={s}>{s}</option>)}
          </datalist>

          {/* Bulk actions */}
          {selectedIds.size > 0 && (
            <div className="border border-slate-200 rounded-xl p-3 space-y-3 bg-slate-50/60">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions for {selectedIds.size} selected item{selectedIds.size !== 1 ? "s" : ""}</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" className="text-brand-600 border-brand-200 hover:bg-brand-50" onClick={() => { setShowMoveInput(!showMoveInput); setConfirmDelete(false); }} data-testid="button-move-items">
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
                  <Button type="button" size="sm" className="bg-brand-700 hover:bg-brand-800" onClick={() => moveItems.mutate()} disabled={!moveTarget.trim() || moveItems.isPending} data-testid="button-confirm-move">
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
            <Button type="button" className="bg-brand-700 hover:bg-brand-800" onClick={() => saveMeta.mutate()} disabled={saveMeta.isPending || !familyName.trim()} data-testid="button-save-family">
              {saveMeta.isPending ? "Saving…" : "Save Settings"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
