import { Fragment, useState, useMemo, useRef } from "react";
import {
  X, Trash2, Plus, Save, CheckCircle2,
  Boxes, LayoutList, Hash, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { ProjectScopeItem } from "@shared/schema";
import { type PendingRow, newPendingRow, COMMON_UNITS, flexMatch } from "./types";
import {
  CATEGORY_ORDER, CATEGORY_CONFIG, CAT_ICONS,
  resolveDisplayCategory, resolveSubGroup,
} from "./categoryConfig";
import { BundleSelector } from "./scope/BundleSelector";
import { ScopeItemDialog } from "./scope/ScopeItemDialog";
import { ScopeItemRow } from "./scope/ScopeItemRow";
import { ScopeDeleteDialog, UndoSnackbar } from "./scope/ScopeDeleteDialog";
import type { BundleRow } from "./types";

function InlineScopeRow({
  row, invItems, onChange, onRemove, rowIndex,
}: {
  row: PendingRow;
  invItems: any[];
  onChange: (updated: PendingRow) => void;
  onRemove: () => void;
  rowIndex: number;
}) {
  const [invSearch, setInvSearch] = useState(
    row.linkedInventoryItemId
      ? (invItems.find(it => it.id === row.linkedInventoryItemId)?.name ?? row.itemName)
      : row.itemName
  );
  const [invOpen, setInvOpen] = useState(false);

  const filtered = invItems
    .filter(it => flexMatch(invSearch, it.name))
    .slice(0, 12);

  function selectInv(it: any) {
    setInvSearch(it.name);
    setInvOpen(false);
    onChange({
      ...row,
      itemName: it.name,
      unit: it.unitOfMeasure ?? row.unit,
      linkedInventoryItemId: it.id,
      category: it.subcategory ?? row.category,
    });
  }

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3" data-testid={`inline-scope-row-${rowIndex}`}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0 space-y-1">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Item / Description *</label>
          <div className="relative">
            <Input
              value={invSearch}
              placeholder="Search inventory or enter name…"
              onChange={(e) => {
                const val = e.target.value;
                setInvSearch(val);
                setInvOpen(true);
                if (row.linkedInventoryItemId && val !== invItems.find(it => it.id === row.linkedInventoryItemId)?.name) {
                  onChange({ ...row, itemName: val, linkedInventoryItemId: null });
                } else {
                  onChange({ ...row, itemName: val });
                }
              }}
              onFocus={() => setInvOpen(true)}
              onBlur={() => setTimeout(() => setInvOpen(false), 150)}
              className={`h-8 text-sm ${row.linkedInventoryItemId ? "border-emerald-300 bg-emerald-50/60" : ""}`}
              data-testid={`inline-scope-name-${rowIndex}`}
            />
            {row.linkedInventoryItemId && (
              <button type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                onClick={() => { setInvSearch(""); onChange({ ...row, itemName: "", linkedInventoryItemId: null }); }}>
                <X className="w-3 h-3" />
              </button>
            )}
            {invOpen && filtered.length > 0 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-white border border-slate-200 rounded-lg shadow-xl max-h-44 overflow-y-auto">
                {filtered.map(it => (
                  <button key={it.id} type="button"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => selectInv(it)}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between gap-2 hover:bg-slate-50 transition-colors ${row.linkedInventoryItemId === it.id ? "bg-emerald-50 text-emerald-800 font-semibold" : "text-slate-700"}`}>
                    <span className="truncate">{it.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono shrink-0">{it.unitOfMeasure ?? ""}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {row.linkedInventoryItemId && (
            <p className="text-[10px] text-emerald-700 flex items-center gap-1">
              <CheckCircle2 className="w-2.5 h-2.5" /> Inventory item linked
            </p>
          )}
        </div>

        <div className="w-20 space-y-1 shrink-0">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Unit *</label>
          <Input
            value={row.unit}
            placeholder="EA"
            onChange={e => onChange({ ...row, unit: e.target.value })}
            className="h-8 text-sm"
            list={`units-list-${rowIndex}`}
            data-testid={`inline-scope-unit-${rowIndex}`}
          />
          <datalist id={`units-list-${rowIndex}`}>
            {COMMON_UNITS.map(u => <option key={u} value={u} />)}
          </datalist>
        </div>

        <div className="w-24 space-y-1 shrink-0">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Est. Qty *</label>
          <Input
            type="number" min="0" step="any"
            value={row.estimatedQty} placeholder="0"
            onChange={e => onChange({ ...row, estimatedQty: e.target.value })}
            className="h-8 text-sm"
            data-testid={`inline-scope-qty-${rowIndex}`}
          />
        </div>

        <div className="w-32 space-y-1 shrink-0">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Category</label>
          <Input
            value={row.category}
            placeholder="e.g. Conduit"
            onChange={e => onChange({ ...row, category: e.target.value })}
            className="h-8 text-sm"
            list={`cat-list-${rowIndex}`}
            data-testid={`inline-scope-category-${rowIndex}`}
          />
          <datalist id={`cat-list-${rowIndex}`}>
            {CATEGORY_ORDER.map(c => <option key={c} value={c} />)}
          </datalist>
        </div>

        <div className="w-28 space-y-1 shrink-0">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Scope Type</label>
          <select
            value={row.scopeType}
            onChange={e => onChange({ ...row, scopeType: e.target.value as "primary" | "support" })}
            className="h-8 w-full text-xs border border-slate-200 rounded-md px-2 bg-white text-slate-700"
            data-testid={`inline-scope-type-${rowIndex}`}
          >
            <option value="primary">Primary</option>
            <option value="support">Support</option>
          </select>
        </div>

        <button
          type="button" onClick={onRemove}
          className="mt-6 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
          data-testid={`inline-scope-remove-${rowIndex}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <Input
        value={row.remarks}
        placeholder="Remarks (optional)"
        onChange={e => onChange({ ...row, remarks: e.target.value })}
        className="h-7 text-xs text-slate-500 bg-white"
        data-testid={`inline-scope-remarks-${rowIndex}`}
      />
    </div>
  );
}

export function ScopeItemsTab({ projectId }: { projectId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  type AddMode = "none" | "multiple" | "bundle";
  const [dialogItem, setDialogItem] = useState<ProjectScopeItem | null | "new">(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectScopeItem | null>(null);
  const [addMode, setAddMode] = useState<AddMode>("none");
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [pendingRows, setPendingRows] = useState<PendingRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const [variantOpen, setVariantOpen] = useState<number | null>(null);
  const [movingItem, setMovingItem] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [undoSnackbar, setUndoSnackbar] = useState<{ message: string; onUndo: () => void } | null>(null);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: scopeItems = [], isLoading } = useQuery<ProjectScopeItem[]>({
    queryKey: ["/api/projects", projectId, "scope-items"],
    queryFn: () => fetch(`/api/projects/${projectId}/scope-items`, { credentials: "include" }).then(r => r.json()),
  });
  const { data: allInvItems = [] } = useQuery<any[]>({ queryKey: ["/api/items"] });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/scope-items/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "scope-items"] });
      qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "progress"] });
      toast({ title: "Scope item deleted" });
      setDeleteTarget(null);
    },
    onError: (err: any) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/scope-items/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "scope-items"] });
      qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "progress"] });
    },
    onError: (err: any) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  const totalItems = scopeItems.length;
  const totalQty = scopeItems.reduce((s, i) => s + parseFloat(String(i.estimatedQty || 0)), 0);
  const primaryCount = scopeItems.filter(i => !((i as any).scopeType) || (i as any).scopeType === "primary").length;

  const grouped = useMemo(() => {
    const map = new Map<string, ProjectScopeItem[]>();
    for (const item of scopeItems) {
      const cat = resolveDisplayCategory(item.category, item.itemName);
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    }
    for (const [, items] of map) items.sort((a, b) => {
      const aType = (a as any).scopeType ?? "primary";
      const bType = (b as any).scopeType ?? "primary";
      if (aType !== bType) return aType === "primary" ? -1 : 1;
      return a.itemName.localeCompare(b.itemName);
    });
    const result: { cat: string; items: ProjectScopeItem[] }[] = [];
    for (const cat of CATEGORY_ORDER) { if (map.has(cat)) result.push({ cat, items: map.get(cat)! }); }
    for (const [cat, items] of map) { if (!CATEGORY_ORDER.includes(cat)) result.push({ cat, items }); }
    return result;
  }, [scopeItems]);

  function toggleCat(cat: string) {
    setCollapsedCats(prev => { const next = new Set(prev); if (next.has(cat)) next.delete(cat); else next.add(cat); return next; });
  }

  function addRow() { setPendingRows(prev => [...prev, newPendingRow()]); }
  function updateRow(localId: string, updated: PendingRow) { setPendingRows(prev => prev.map(r => r.localId === localId ? updated : r)); }
  function removeRow(localId: string) { setPendingRows(prev => prev.filter(r => r.localId !== localId)); }

  async function saveMultiple() {
    const validRows = pendingRows.filter(r => r.itemName.trim() && r.unit.trim() && r.estimatedQty.trim());
    if (validRows.length === 0) {
      toast({ title: "Nothing to save", description: "Fill in at least Item Name, Unit, and Est. Qty.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      await Promise.all(validRows.map(row =>
        apiRequest("POST", `/api/projects/${projectId}/scope-items`, {
          itemName: row.itemName.trim(), unit: row.unit.trim(),
          estimatedQty: row.estimatedQty,
          category: row.category.trim() || null,
          remarks: row.remarks.trim() || null,
          linkedInventoryItemId: row.linkedInventoryItemId,
          scopeType: row.scopeType, isActive: true,
        })
      ));
      qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "scope-items"] });
      qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "progress"] });
      toast({ title: `${validRows.length} scope item${validRows.length > 1 ? "s" : ""} saved` });
      setPendingRows([]); setAddMode("none");
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally { setIsSaving(false); }
  }

  async function saveBundle(rows: Omit<BundleRow, "localId" | "checked">[]) {
    setIsSaving(true);
    try {
      await Promise.all(rows.map(row =>
        apiRequest("POST", `/api/projects/${projectId}/scope-items`, {
          itemName: row.itemName.trim(), unit: row.unit.trim(),
          estimatedQty: row.estimatedQty || "0",
          category: row.category || null, scopeType: row.scopeType, isActive: true,
        })
      ));
      qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "scope-items"] });
      qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "progress"] });
      toast({ title: `${rows.length} bundle item${rows.length !== 1 ? "s" : ""} added` });
      setAddMode("none");
    } catch (err: any) {
      toast({ title: "Bundle save failed", description: err.message, variant: "destructive" });
    } finally { setIsSaving(false); }
  }

  async function duplicateItem(item: ProjectScopeItem) {
    try {
      await apiRequest("POST", `/api/projects/${projectId}/scope-items`, {
        itemName: `${item.itemName} (Copy)`, unit: item.unit,
        estimatedQty: String(item.estimatedQty), category: item.category ?? null,
        remarks: item.remarks ?? null, linkedInventoryItemId: (item as any).linkedInventoryItemId ?? null,
        scopeType: (item as any).scopeType ?? "primary", isActive: item.isActive,
      });
      qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "scope-items"] });
      toast({ title: "Item duplicated" });
    } catch (err: any) {
      toast({ title: "Duplicate failed", description: err.message, variant: "destructive" });
    }
  }

  async function saveVariants(item: ProjectScopeItem, ids: number[]) {
    await patchMutation.mutateAsync({ id: item.id, data: { acceptedVariants: ids } });
    setVariantOpen(null);
    toast({ title: "Variants saved" });
  }

  async function moveToCategory(item: ProjectScopeItem, category: string) {
    await patchMutation.mutateAsync({ id: item.id, data: { category } });
    setMovingItem(null);
  }

  function toggleSelectItem(id: number) {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  function selectAllVisible() {
    const visibleIds = grouped.flatMap(g => collapsedCats.has(g.cat) ? [] : g.items.map(i => i.id));
    setSelectedIds(new Set(visibleIds));
  }

  function showUndoSnack(message: string, onUndo: () => void) {
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    setUndoSnackbar({ message, onUndo });
    undoTimeoutRef.current = setTimeout(() => setUndoSnackbar(null), 5500);
  }

  async function deleteSelected() {
    const ids = [...selectedIds];
    const snapshot = scopeItems.filter(i => ids.includes(i.id));
    setSelectedIds(new Set());
    try {
      await Promise.all(ids.map(id => apiRequest("DELETE", `/api/scope-items/${id}`)));
      qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "scope-items"] });
      qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "progress"] });
      showUndoSnack(
        `${ids.length} scope item${ids.length !== 1 ? "s" : ""} deleted`,
        async () => {
          try {
            await Promise.all(snapshot.map(item =>
              apiRequest("POST", `/api/projects/${projectId}/scope-items`, {
                itemName: item.itemName, unit: item.unit,
                estimatedQty: String(item.estimatedQty),
                category: item.category ?? null,
                remarks: item.remarks ?? null,
                linkedInventoryItemId: (item as any).linkedInventoryItemId ?? null,
                scopeType: (item as any).scopeType ?? "primary",
                isActive: item.isActive,
              })
            ));
            qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "scope-items"] });
            qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "progress"] });
            setUndoSnackbar(null);
            toast({ title: `${snapshot.length} item${snapshot.length !== 1 ? "s" : ""} restored` });
          } catch (err: any) {
            toast({ title: "Undo failed", description: err.message, variant: "destructive" });
          }
        }
      );
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
  }

  const isAdding = addMode === "multiple" && pendingRows.length > 0;

  return (
    <div className="space-y-5">
      {/* ── KPI Stats Strip ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Scope Items", value: totalItems, icon: LayoutList, color: "text-brand-600", bg: "bg-brand-50" },
          { label: "Total Est. Qty", value: totalQty.toLocaleString(), icon: Hash, color: "text-indigo-600", bg: "bg-indigo-50" },
          { label: "Primary Items", value: primaryCount, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
        ].map((s, i) => (
          <div key={i} className="premium-card bg-white p-4 flex items-center gap-3" data-testid={`scope-kpi-${i}`}>
            <div className={`p-2 rounded-xl ${s.bg}`}><s.icon className={`w-4 h-4 ${s.color}`} /></div>
            <div>
              <p className="text-xs text-slate-400">{s.label}</p>
              <p className="text-xl font-display font-bold text-slate-900">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="premium-card bg-white overflow-hidden">
        {/* ── Toolbar header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">Scope Items</h3>
            <p className="text-xs text-slate-400 mt-0.5">Grouped by category — click headers to collapse</p>
          </div>
          <div className="relative">
            <div className="flex">
              <Button size="sm"
                className="bg-brand-700 hover:bg-brand-800 text-white rounded-r-none border-r border-brand-500/40"
                onClick={() => { setAddMode("multiple"); setPendingRows([newPendingRow()]); setShowAddMenu(false); }}
                data-testid="button-add-scope-multiple">
                <Plus className="w-4 h-4 mr-1" /> Add Item
              </Button>
              <button
                className="bg-brand-700 hover:bg-brand-800 text-white px-2 rounded-r-lg flex items-center transition-colors"
                onClick={() => setShowAddMenu(m => !m)}
                data-testid="button-add-scope-menu">
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
            {showAddMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 min-w-[180px] py-1">
                <button type="button"
                  onClick={() => { setAddMode("bundle"); setShowAddMenu(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 text-slate-700 transition-colors flex items-center gap-2.5"
                  data-testid="menu-scope-add-by-bundle">
                  <Boxes className="w-3.5 h-3.5 text-brand-600 shrink-0" /> Add by Bundle
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Bulk selection bar ── */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 px-5 py-2.5 bg-slate-50 border-b border-slate-200">
            <span className="text-xs font-semibold text-slate-700" data-testid="bulk-selected-count">{selectedIds.size} selected</span>
            <div className="flex items-center gap-1.5 ml-auto">
              <button type="button" onClick={selectAllVisible}
                className="text-xs text-slate-500 hover:text-slate-800 px-2.5 py-1 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 transition-all"
                data-testid="button-select-visible">
                Select Visible
              </button>
              <button type="button" onClick={() => setSelectedIds(new Set())}
                className="text-xs text-slate-500 hover:text-slate-800 px-2.5 py-1 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 transition-all"
                data-testid="button-clear-selection">
                Clear
              </button>
              <button type="button" onClick={deleteSelected}
                className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-3 py-1 rounded-lg hover:bg-red-100 transition-colors"
                data-testid="button-bulk-delete-scope">
                <Trash2 className="w-3 h-3" /> Delete Selected
              </button>
            </div>
          </div>
        )}

        {/* ── Inline add-multiple area ── */}
        {isAdding && (
          <div className="border-b border-slate-100">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-brand-50/40">
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Add Multiple Items</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {pendingRows.length} row{pendingRows.length !== 1 ? "s" : ""} — fill in details and save
                </p>
              </div>
              <Button size="sm" variant="outline" className="border-brand-200 text-brand-700 hover:bg-brand-50" onClick={addRow}
                data-testid="button-add-more-scope-row">
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Row
              </Button>
            </div>
            <div className="p-5 space-y-3">
              {pendingRows.map((row, i) => (
                <InlineScopeRow key={row.localId} row={row} invItems={allInvItems}
                  onChange={updated => updateRow(row.localId, updated)}
                  onRemove={() => removeRow(row.localId)} rowIndex={i} />
              ))}
            </div>
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 bg-slate-50/50">
              <button type="button" onClick={() => { setPendingRows([]); setAddMode("none"); }}
                className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
                data-testid="button-cancel-inline-scope">
                Cancel
              </button>
              <Button className="bg-brand-700 hover:bg-brand-800 text-white" onClick={saveMultiple}
                disabled={isSaving} data-testid="button-save-scope-items">
                <Save className="w-4 h-4 mr-1.5" />
                {isSaving ? "Saving…" : `Save ${pendingRows.length} Item${pendingRows.length !== 1 ? "s" : ""}`}
              </Button>
            </div>
          </div>
        )}

        {/* ── Bundle add area ── */}
        {addMode === "bundle" && (
          <div className="border-b border-slate-100">
            <BundleSelector onSave={async (rows) => { await saveBundle(rows); }} onClose={() => setAddMode("none")} invItems={allInvItems} />
          </div>
        )}

        {/* ── Main table ── */}
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Loading…</div>
        ) : scopeItems.length === 0 && addMode === "none" ? (
          <div className="p-12 text-center">
            <LayoutList className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No scope items yet</p>
            <p className="text-xs text-slate-400 mt-1">Add items to define the project's estimated work quantities.</p>
            <Button size="sm" variant="outline" className="mt-4"
              onClick={() => { setAddMode("multiple"); setPendingRows([newPendingRow()]); }}
              data-testid="button-add-scope-item-empty">
              <Plus className="w-4 h-4 mr-1" /> Add First Item
            </Button>
          </div>
        ) : grouped.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/80 border-b border-slate-200">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600 w-[38%]">Item</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 w-[7%]">Unit</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 w-[10%]">Est. Qty</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 w-[13%]">Category</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 w-[32%]">Actions</th>
                </tr>
              </thead>
              {grouped.map(({ cat, items }) => {
                const cfg = CATEGORY_CONFIG[cat] ?? { accent: "#64748b", iconBg: "#f1f5f9", subtitle: "" };
                const CatIcon = CAT_ICONS[cat] ?? LayoutList;
                const isCollapsed = collapsedCats.has(cat);
                const catTotalQty = items.reduce((s, i) => s + parseFloat(String(i.estimatedQty || 0)), 0);

                const sgDefs = cfg.subGroups ?? [];
                const sgMap = new Map<string | null, ProjectScopeItem[]>();
                for (const item of items) {
                  const sg = sgDefs.length ? resolveSubGroup(cat, item.itemName) : null;
                  if (!sgMap.has(sg)) sgMap.set(sg, []);
                  sgMap.get(sg)!.push(item);
                }
                const activeSgEntries = sgDefs
                  .map(sg => ({ ...sg, items: sgMap.get(sg.key) ?? [] }))
                  .filter(sg => sg.items.length > 0);
                const ungroupedItems = sgMap.get(null) ?? [];

                return (
                  <tbody key={cat}>
                    {/* Category header row */}
                    <tr>
                      <td colSpan={5} style={{ padding: 0, borderLeft: `4px solid ${cfg.accent}` }}>
                        <button
                          type="button"
                          onClick={() => toggleCat(cat)}
                          style={{ background: `${cfg.accent}0d` }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:brightness-95 transition-all"
                          data-testid={`scope-cat-toggle-${cat.replace(/[\s/&]+/g, "-")}`}
                        >
                          <div style={{ background: cfg.iconBg, width: 28, height: 28, color: cfg.accent }}
                            className="rounded-md flex items-center justify-center shrink-0">
                            <CatIcon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold leading-tight" style={{ color: cfg.accent }}>{cat}</p>
                            <p className="text-[9px] text-slate-400 leading-tight mt-0.5 truncate">{cfg.subtitle}</p>
                          </div>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap"
                            style={{ background: `${cfg.accent}1a`, color: cfg.accent }}>
                            {items.length} item{items.length !== 1 ? "s" : ""}
                          </span>
                          <span className="font-mono text-xs font-bold tabular-nums shrink-0 w-16 text-right" style={{ color: cfg.accent }}>
                            {catTotalQty.toLocaleString()}
                          </span>
                          <ChevronDown className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isCollapsed ? "-rotate-90" : ""}`}
                            style={{ color: cfg.accent }} />
                        </button>
                      </td>
                    </tr>

                    {/* Item rows */}
                    {!isCollapsed && (
                      activeSgEntries.length > 0 ? (
                        <>
                          {activeSgEntries.map(sg => (
                            <Fragment key={sg.key}>
                              <tr style={{ background: `${cfg.accent}08`, borderLeft: `3px solid ${cfg.accent}33` }}>
                                <td colSpan={5} style={{ paddingLeft: 22, paddingTop: 5, paddingBottom: 5, borderBottom: `1px solid ${cfg.accent}1f` }}>
                                  <span style={{ color: `${cfg.accent}b3`, fontSize: 8, letterSpacing: "1.2px", fontWeight: 700 }}>
                                    └ {sg.label.toUpperCase()}
                                  </span>
                                </td>
                              </tr>
                              {sg.items.map(item => (
                                <ScopeItemRow
                                  key={item.id}
                                  item={item}
                                  allInvItems={allInvItems}
                                  accentColor={cfg.accent}
                                  isVariantOpen={variantOpen === item.id}
                                  isMoving={movingItem === item.id}
                                  isSelected={selectedIds.has(item.id)}
                                  onVariantOpen={() => setVariantOpen(variantOpen === item.id ? null : item.id)}
                                  onVariantClose={() => setVariantOpen(null)}
                                  onVariantSave={(ids) => saveVariants(item, ids)}
                                  onMoveOpen={() => setMovingItem(item.id)}
                                  onMoveClose={() => setMovingItem(null)}
                                  onMoveCategory={(cat) => moveToCategory(item, cat)}
                                  onEdit={() => setDialogItem(item)}
                                  onDelete={() => setDeleteTarget(item)}
                                  onDuplicate={() => duplicateItem(item)}
                                  onSelect={() => toggleSelectItem(item.id)}
                                />
                              ))}
                            </Fragment>
                          ))}
                          {ungroupedItems.map(item => (
                            <ScopeItemRow
                              key={item.id}
                              item={item}
                              allInvItems={allInvItems}
                              accentColor={cfg.accent}
                              isVariantOpen={variantOpen === item.id}
                              isMoving={movingItem === item.id}
                              isSelected={selectedIds.has(item.id)}
                              onVariantOpen={() => setVariantOpen(variantOpen === item.id ? null : item.id)}
                              onVariantClose={() => setVariantOpen(null)}
                              onVariantSave={(ids) => saveVariants(item, ids)}
                              onMoveOpen={() => setMovingItem(item.id)}
                              onMoveClose={() => setMovingItem(null)}
                              onMoveCategory={(cat) => moveToCategory(item, cat)}
                              onEdit={() => setDialogItem(item)}
                              onDelete={() => setDeleteTarget(item)}
                              onDuplicate={() => duplicateItem(item)}
                              onSelect={() => toggleSelectItem(item.id)}
                            />
                          ))}
                        </>
                      ) : (
                        items.map(item => (
                          <ScopeItemRow
                            key={item.id}
                            item={item}
                            allInvItems={allInvItems}
                            accentColor={cfg.accent}
                            isVariantOpen={variantOpen === item.id}
                            isMoving={movingItem === item.id}
                            isSelected={selectedIds.has(item.id)}
                            onVariantOpen={() => setVariantOpen(variantOpen === item.id ? null : item.id)}
                            onVariantClose={() => setVariantOpen(null)}
                            onVariantSave={(ids) => saveVariants(item, ids)}
                            onMoveOpen={() => setMovingItem(item.id)}
                            onMoveClose={() => setMovingItem(null)}
                            onMoveCategory={(cat) => moveToCategory(item, cat)}
                            onEdit={() => setDialogItem(item)}
                            onDelete={() => setDeleteTarget(item)}
                            onDuplicate={() => duplicateItem(item)}
                            onSelect={() => toggleSelectItem(item.id)}
                          />
                        ))
                      )
                    )}

                    <tr><td colSpan={5} style={{ height: 4, background: "#f8fafc", padding: 0 }} /></tr>
                  </tbody>
                );
              })}
            </table>
          </div>
        ) : null}
      </div>

      <ScopeItemDialog
        projectId={projectId}
        item={dialogItem === "new" ? null : dialogItem}
        open={dialogItem !== null}
        onClose={() => setDialogItem(null)}
      />

      <ScopeDeleteDialog
        target={deleteTarget}
        isPending={deleteMutation.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={(id) => deleteMutation.mutate(id)}
      />

      {undoSnackbar && (
        <UndoSnackbar
          message={undoSnackbar.message}
          onUndo={undoSnackbar.onUndo}
          onDismiss={() => { setUndoSnackbar(null); if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current); }}
        />
      )}
    </div>
  );
}
