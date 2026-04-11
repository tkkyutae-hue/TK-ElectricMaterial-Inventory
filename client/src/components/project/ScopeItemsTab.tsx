import { useState, useMemo } from "react";
import {
  Plus, Save, CheckCircle2, Boxes, LayoutList, Hash, ChevronDown, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { ProjectScopeItem } from "@shared/schema";
import { type PendingRow, newPendingRow } from "./types";
import { CATEGORY_ORDER, resolveDisplayCategory } from "./categoryConfig";
import { BundleSelector } from "./scope/BundleSelector";
import { ScopeItemDialog } from "./scope/ScopeItemDialog";
import { ScopeDeleteDialog, UndoSnackbar } from "./scope/ScopeDeleteDialog";
import { InlineScopeRow } from "./scope/InlineScopeRow";
import { ScopeCategorySection } from "./scope/ScopeCategorySection";
import { useScopeActions } from "./scope/useScopeActions";
import { EmptyState } from "@/components/shared/EmptyState";

export function ScopeItemsTab({ projectId }: { projectId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  type AddMode = "none" | "multiple" | "bundle";

  // ── Dialog / panel state ──
  const [dialogItem, setDialogItem] = useState<ProjectScopeItem | null | "new">(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectScopeItem | null>(null);
  const [addMode, setAddMode] = useState<AddMode>("none");
  const [showAddMenu, setShowAddMenu] = useState(false);

  // ── Inline-add row state ──
  const [pendingRows, setPendingRows] = useState<PendingRow[]>([]);

  // ── Table interaction state ──
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const [variantOpen, setVariantOpen] = useState<number | null>(null);
  const [movingItem, setMovingItem] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // ── Data ──
  const { data: scopeItems = [], isLoading } = useQuery<ProjectScopeItem[]>({
    queryKey: ["/api/projects", projectId, "scope-items"],
    queryFn: () => fetch(`/api/projects/${projectId}/scope-items`, { credentials: "include" }).then(r => r.json()),
  });
  const { data: allInvItems = [] } = useQuery<any[]>({ queryKey: ["/api/items"] });

  // ── Mutations (single-item delete + patch — bulk actions live in the hook) ──
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

  // ── Stats ──
  const totalItems = scopeItems.length;
  const totalQty = scopeItems.reduce((s, i) => s + parseFloat(String(i.estimatedQty || 0)), 0);
  const primaryCount = scopeItems.filter(i => !((i as any).scopeType) || (i as any).scopeType === "primary").length;

  // ── Grouped / ordered category data ──
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

  // ── Async action cluster ──
  const {
    isSaving, undoSnackbar, dismissUndoSnackbar,
    saveMultiple, saveBundle, duplicateItem, saveVariants, moveToCategory, deleteSelected,
  } = useScopeActions({
    projectId, scopeItems, pendingRows, setPendingRows, setAddMode,
    selectedIds, setSelectedIds, setVariantOpen, setMovingItem,
    patchMutateAsync: patchMutation.mutateAsync,
  });

  // ── Local helpers ──
  function toggleCat(cat: string) {
    setCollapsedCats(prev => { const next = new Set(prev); if (next.has(cat)) next.delete(cat); else next.add(cat); return next; });
  }
  function addRow() { setPendingRows(prev => [...prev, newPendingRow()]); }
  function updateRow(localId: string, updated: PendingRow) { setPendingRows(prev => prev.map(r => r.localId === localId ? updated : r)); }
  function removeRow(localId: string) { setPendingRows(prev => prev.filter(r => r.localId !== localId)); }
  function toggleSelectItem(id: number) {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function selectAllVisible() {
    const visibleIds = grouped.flatMap(g => collapsedCats.has(g.cat) ? [] : g.items.map(i => i.id));
    setSelectedIds(new Set(visibleIds));
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

        {/* ── Toolbar ── */}
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
            <span className="text-xs font-semibold text-slate-700" data-testid="bulk-selected-count">
              {selectedIds.size} selected
            </span>
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

        {/* ── Inline add-multiple panel ── */}
        {isAdding && (
          <div className="border-b border-slate-100">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-brand-50/40">
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Add Multiple Items</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {pendingRows.length} row{pendingRows.length !== 1 ? "s" : ""} — fill in details and save
                </p>
              </div>
              <Button size="sm" variant="outline" className="border-brand-200 text-brand-700 hover:bg-brand-50"
                onClick={addRow} data-testid="button-add-more-scope-row">
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Row
              </Button>
            </div>
            <div className="p-5 space-y-3">
              {pendingRows.map((row, i) => (
                <InlineScopeRow
                  key={row.localId} row={row} invItems={allInvItems}
                  onChange={updated => updateRow(row.localId, updated)}
                  onRemove={() => removeRow(row.localId)} rowIndex={i}
                />
              ))}
            </div>
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 bg-slate-50/50">
              <button type="button"
                onClick={() => { setPendingRows([]); setAddMode("none"); }}
                className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
                data-testid="button-cancel-inline-scope">
                Cancel
              </button>
              <Button className="bg-brand-700 hover:bg-brand-800 text-white"
                onClick={saveMultiple} disabled={isSaving} data-testid="button-save-scope-items">
                <Save className="w-4 h-4 mr-1.5" />
                {isSaving ? "Saving…" : `Save ${pendingRows.length} Item${pendingRows.length !== 1 ? "s" : ""}`}
              </Button>
            </div>
          </div>
        )}

        {/* ── Bundle add panel ── */}
        {addMode === "bundle" && (
          <div className="border-b border-slate-100">
            <BundleSelector onSave={saveBundle} onClose={() => setAddMode("none")} invItems={allInvItems} />
          </div>
        )}

        {/* ── Main table ── */}
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Loading…</div>

        ) : scopeItems.length === 0 && addMode === "none" ? (
          <EmptyState
            icon={<LayoutList className="w-10 h-10" />}
            title="No scope items yet"
            description="Add items to define the project's estimated work quantities."
            action={
              <Button size="sm" variant="outline"
                onClick={() => { setAddMode("multiple"); setPendingRows([newPendingRow()]); }}
                data-testid="button-add-scope-item-empty">
                <Plus className="w-4 h-4 mr-1" /> Add First Item
              </Button>
            }
            className="py-12"
          />

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
              {grouped.map(({ cat, items }) => (
                <ScopeCategorySection
                  key={cat}
                  cat={cat}
                  items={items}
                  allInvItems={allInvItems}
                  isCollapsed={collapsedCats.has(cat)}
                  onToggle={() => toggleCat(cat)}
                  variantOpen={variantOpen}
                  movingItem={movingItem}
                  selectedIds={selectedIds}
                  onVariantOpen={(id) => setVariantOpen(variantOpen === id ? null : id)}
                  onVariantClose={() => setVariantOpen(null)}
                  onVariantSave={saveVariants}
                  onMoveOpen={(id) => setMovingItem(id)}
                  onMoveClose={() => setMovingItem(null)}
                  onMoveCategory={moveToCategory}
                  onEdit={setDialogItem}
                  onDelete={setDeleteTarget}
                  onDuplicate={duplicateItem}
                  onSelect={toggleSelectItem}
                />
              ))}
            </table>
          </div>
        ) : null}
      </div>

      {/* ── Dialogs ── */}
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
          onDismiss={dismissUndoSnackbar}
        />
      )}
    </div>
  );
}
