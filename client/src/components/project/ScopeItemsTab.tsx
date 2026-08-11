import { useState, useMemo, useCallback } from "react";
import {
  Plus, Save, CheckCircle2, Boxes, LayoutList, Hash, ChevronDown, Trash2, Sparkles, Package,
} from "lucide-react";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { ProjectScopeItem } from "@shared/schema";
import { type PendingRow, newPendingRow } from "./types";
import { CATEGORY_ORDER, resolveDisplayCategory } from "./categoryConfig";
import { BundleSelector } from "./scope/BundleSelector";
import { ScopeItemDialog } from "./scope/ScopeItemDialog";
import { ScopeExtractDialog } from "./scope/ScopeExtractDialog";
import { ScopeDeleteDialog, UndoSnackbar } from "./scope/ScopeDeleteDialog";
import { InlineScopeRow } from "./scope/InlineScopeRow";
import { ScopeCategorySection } from "./scope/ScopeCategorySection";
import { useScopeActions } from "./scope/useScopeActions";
import { EmptyState } from "@/components/shared/EmptyState";
import { useLanguage } from "@/hooks/use-language";

// Categories that collapse under the "Materials" header
const MATERIAL_CATS = new Set([
  "Conduit",
  "Fittings & Connectors",
  "Cable Tray",
  "Cable / Wire",
  "Grounding",
  "Boxes",
  "Devices",
]);

export function ScopeItemsTab({ projectId }: { projectId: number }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();

  type AddMode = "none" | "multiple" | "bundle";

  // ── Dialog / panel state ──
  const [dialogItem, setDialogItem] = useState<ProjectScopeItem | null | "new">(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectScopeItem | null>(null);
  const [addMode, setAddMode] = useState<AddMode>("none");
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [extractOpen, setExtractOpen] = useState(false);

  // ── Inline-add row state ──
  const [pendingRows, setPendingRows] = useState<PendingRow[]>([]);

  // ── Table interaction state ──
  const [materialsCollapsed, setMaterialsCollapsed] = useState(false);
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // ── Local drag-order override (null = use server sortOrder) ──
  const [localOrder, setLocalOrder] = useState<number[] | null>(null);

  // ── Data ──
  const { data: scopeItems = [], isLoading } = useQuery<ProjectScopeItem[]>({
    queryKey: ["/api/projects", projectId, "scope-items"],
    queryFn: () => fetch(`/api/projects/${projectId}/scope-items`, { credentials: "include" }).then(r => r.json()),
  });
  const { data: allInvItems = [] } = useQuery<any[]>({ queryKey: ["/api/items"] });

  // ── Reorder mutation ──
  const reorderMutation = useMutation({
    mutationFn: (ids: number[]) =>
      apiRequest("PATCH", `/api/projects/${projectId}/scope-items/reorder`, { ids }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "scope-items"] });
    },
    onError: (err: any) => {
      setLocalOrder(null); // revert optimistic order on error
      toast({ title: "Reorder failed", description: err.message, variant: "destructive" });
    },
  });

  // ── Mutations ──
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/scope-items/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "scope-items"] });
      qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "progress"] });
      toast({ title: t.projScopeDeletedToast });
      setDeleteTarget(null);
    },
    onError: (err: any) => toast({ title: t.projScopeDeleteFailedToast, description: err.message, variant: "destructive" }),
  });

  // ── Stats ──
  const totalItems = scopeItems.length;
  const totalQty = scopeItems.reduce((s, i) => s + parseFloat(String(i.estimatedQty || 0)), 0);
  const primaryCount = scopeItems.filter(i => !((i as any).scopeType) || (i as any).scopeType === "primary").length;

  // ── Sort items by server sortOrder (or local override) ──
  const sortedScopeItems = useMemo(() => {
    // Server already returns items sorted by sortOrder NULLS LAST, id
    // localOrder overrides that for optimistic drag-and-drop updates
    if (!localOrder) return scopeItems;
    const idMap = new Map(scopeItems.map(i => [i.id, i]));
    const ordered = localOrder.map(id => idMap.get(id)).filter(Boolean) as ProjectScopeItem[];
    // Append any items not in localOrder (e.g. just added)
    const inOrder = new Set(localOrder);
    for (const item of scopeItems) { if (!inOrder.has(item.id)) ordered.push(item); }
    return ordered;
  }, [scopeItems, localOrder]);

  // ── Grouped / ordered category data (preserves sortedScopeItems order) ──
  const grouped = useMemo(() => {
    const map = new Map<string, ProjectScopeItem[]>();
    for (const item of sortedScopeItems) {
      const cat = resolveDisplayCategory(item.category, item.itemName);
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    }
    // Preserve sortedScopeItems order within each group (no re-sort)
    const result: { cat: string; items: ProjectScopeItem[] }[] = [];
    for (const cat of CATEGORY_ORDER) { if (map.has(cat)) result.push({ cat, items: map.get(cat)! }); }
    map.forEach((items, cat) => { if (!CATEGORY_ORDER.includes(cat)) result.push({ cat, items }); });
    return result;
  }, [sortedScopeItems]);

  // ── Split into materials vs equipment groups ──
  const materialGroups = grouped.filter(g => MATERIAL_CATS.has(g.cat));
  const equipmentGroups = grouped.filter(g => !MATERIAL_CATS.has(g.cat));

  const materialTotalItems = materialGroups.reduce((s, g) => s + g.items.length, 0);
  const materialTotalQty = materialGroups.reduce(
    (s, g) => s + g.items.reduce((ss, i) => ss + parseFloat(String(i.estimatedQty || 0)), 0), 0
  );

  // Flat ordered IDs for the single Materials SortableContext
  const materialItemIds = materialGroups.flatMap(g => g.items.map(i => i.id));

  // ── DnD setup ──
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );
  const isAdding = addMode === "multiple" && pendingRows.length > 0;

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = active.id as number;
    const overId   = over.id as number;

    const isMaterialActive = materialItemIds.includes(activeId);
    const isMaterialOver   = materialItemIds.includes(overId);

    // Block cross Materials ↔ Equipment drops
    if (isMaterialActive !== isMaterialOver) return;

    // Within Equipment: block cross-category drops
    if (!isMaterialActive) {
      const activeCat = equipmentGroups.find(g => g.items.some(i => i.id === activeId));
      const overCat   = equipmentGroups.find(g => g.items.some(i => i.id === overId));
      if (!activeCat || !overCat || activeCat.cat !== overCat.cat) return;
    }
    // Within Materials: allow cross-category (renders as a flat list)

    const currentGlobalOrder = sortedScopeItems.map(i => i.id);
    const activeIdx = currentGlobalOrder.indexOf(activeId);
    const overIdx   = currentGlobalOrder.indexOf(overId);
    if (activeIdx === -1 || overIdx === -1) return;

    const newGlobalOrder = arrayMove(currentGlobalOrder, activeIdx, overIdx);
    setLocalOrder(newGlobalOrder);
    reorderMutation.mutate(newGlobalOrder);
  }, [sortedScopeItems, materialItemIds, equipmentGroups, reorderMutation]);

  // ── Async action cluster ──
  const {
    isSaving, undoSnackbar, dismissUndoSnackbar,
    saveMultiple, saveBundle, duplicateItem, deleteSelected,
  } = useScopeActions({
    projectId, scopeItems, pendingRows, setPendingRows, setAddMode,
    selectedIds, setSelectedIds,
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

  return (
    <div className="space-y-5">

      {/* ── KPI Stats Strip ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: t.projScopeKpiTotal, value: totalItems, icon: LayoutList, color: "text-brand-600", bg: "bg-brand-50" },
          { label: t.projScopeKpiTotalEst, value: totalQty.toLocaleString(), icon: Hash, color: "text-indigo-600", bg: "bg-indigo-50" },
          { label: t.projScopeKpiPrimary, value: primaryCount, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
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
            <h3 className="font-semibold text-slate-900 text-sm">{t.projScopeTableTitle}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{t.projScopeTableSubtitle}</p>
          </div>
          <div className="relative flex items-center gap-2">
            <Button size="sm" variant="outline"
              className="border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-400 gap-1.5"
              onClick={() => { setExtractOpen(true); setShowAddMenu(false); }}
              data-testid="button-scope-extract">
              <Sparkles className="w-3.5 h-3.5" /> 견적서에서 가져오기
            </Button>
            <div className="flex">
              <Button size="sm"
                className="bg-brand-700 hover:bg-brand-800 text-white rounded-r-none border-r border-brand-500/40"
                onClick={() => { setAddMode("multiple"); setPendingRows([newPendingRow()]); setShowAddMenu(false); }}
                data-testid="button-add-scope-multiple">
                <Plus className="w-4 h-4 mr-1" /> {t.projScopeAddItemBtn}
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
                  <Boxes className="w-3.5 h-3.5 text-brand-600 shrink-0" /> {t.projScopeAddByBundleBtn}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Bulk selection bar ── */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 px-5 py-2.5 bg-slate-50 border-b border-slate-200">
            <span className="text-xs font-semibold text-slate-700" data-testid="bulk-selected-count">
              {selectedIds.size} {t.projScopeSelectedSuffix}
            </span>
            <div className="flex items-center gap-1.5 ml-auto">
              <button type="button" onClick={selectAllVisible}
                className="text-xs text-slate-500 hover:text-slate-800 px-2.5 py-1 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 transition-all"
                data-testid="button-select-visible">
                {t.projScopeSelectVisible}
              </button>
              <button type="button" onClick={() => setSelectedIds(new Set())}
                className="text-xs text-slate-500 hover:text-slate-800 px-2.5 py-1 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 transition-all"
                data-testid="button-clear-selection">
                {t.projScopeClearBtn}
              </button>
              <button type="button" onClick={deleteSelected}
                className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-3 py-1 rounded-lg hover:bg-red-100 transition-colors"
                data-testid="button-bulk-delete-scope">
                <Trash2 className="w-3 h-3" /> {t.projScopeDeleteSelected}
              </button>
            </div>
          </div>
        )}

        {/* ── Inline add-multiple panel ── */}
        {isAdding && (
          <div className="border-b border-slate-100">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-brand-50/40">
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">{t.projScopeAddMultipleTitle}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {pendingRows.length} {pendingRows.length !== 1 ? t.projScopeRowsLabel : t.projScopeRowSingular} — {t.projScopeAddMultipleDesc}
                </p>
              </div>
              <Button size="sm" variant="outline" className="border-brand-200 text-brand-700 hover:bg-brand-50"
                onClick={addRow} data-testid="button-add-more-scope-row">
                <Plus className="w-3.5 h-3.5 mr-1" /> {t.projScopeAddRowBtn}
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
                {t.projScopeCancelBtn}
              </button>
              <Button className="bg-brand-700 hover:bg-brand-800 text-white"
                onClick={saveMultiple} disabled={isSaving} data-testid="button-save-scope-items">
                <Save className="w-4 h-4 mr-1.5" />
                {isSaving ? t.projScopeSavingBtn : `${t.projScopeSaveBtnPrefix} ${pendingRows.length} ${pendingRows.length !== 1 ? t.projScopeItemsSuffix : t.projScopeItemSingular}`}
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
          <div className="p-8 text-center text-slate-400">{t.projScopeLoading}</div>

        ) : scopeItems.length === 0 && addMode === "none" ? (
          <EmptyState
            icon={<LayoutList className="w-10 h-10" />}
            title={t.projScopeEmptyTitle}
            description={t.projScopeEmptyDesc}
            action={
              <Button size="sm" variant="outline"
                onClick={() => { setAddMode("multiple"); setPendingRows([newPendingRow()]); }}
                data-testid="button-add-scope-item-empty">
                <Plus className="w-4 h-4 mr-1" /> {t.projScopeAddFirstBtn}
              </Button>
            }
            className="py-12"
          />

        ) : grouped.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/80 border-b border-slate-200">
                  <tr>
                    {/* Drag handle column */}
                    <th className="w-6" />
                    {/* Row number column */}
                    <th className="w-8 pr-1 text-right text-[10px] font-semibold text-slate-300 py-3">#</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 w-[33%]">{t.projScopeColItem}</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 w-[7%]">{t.projScopeColUnit}</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600 w-[10%]">{t.projScopeColEstQty}</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 w-[13%]">{t.projScopeColCategory}</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600 w-[31%]">{t.projScopeColActions}</th>
                  </tr>
                </thead>

                {/* ── Materials super-header + rows ── */}
                {materialGroups.length > 0 && (
                  <>
                    <tbody>
                      <tr>
                        <td colSpan={7} style={{ padding: 0, borderLeft: "4px solid #64748b" }}>
                          <button
                            type="button"
                            onClick={() => setMaterialsCollapsed(c => !c)}
                            style={{ background: "#64748b0d" }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:brightness-95 transition-all"
                            data-testid="scope-cat-toggle-materials"
                          >
                            <div
                              style={{ background: "#f1f5f9", width: 28, height: 28, color: "#64748b" }}
                              className="rounded-md flex items-center justify-center shrink-0"
                            >
                              <Package className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold leading-tight text-slate-600">Materials</p>
                              <p className="text-[9px] text-slate-400 leading-tight mt-0.5">
                                {materialGroups.map(g => g.cat).join(" · ")}
                              </p>
                            </div>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap bg-slate-200/70 text-slate-500">
                              {materialTotalItems} item{materialTotalItems !== 1 ? "s" : ""}
                            </span>
                            <span className="font-mono text-xs font-bold tabular-nums shrink-0 w-16 text-right text-slate-500">
                              {materialTotalQty.toLocaleString()}
                            </span>
                            <ChevronDown
                              className={`w-4 h-4 shrink-0 text-slate-400 transition-transform duration-200 ${materialsCollapsed ? "-rotate-90" : ""}`}
                            />
                          </button>
                        </td>
                      </tr>
                    </tbody>

                    {/* Single SortableContext for all material items (flat list, cross-category OK) */}
                    {!materialsCollapsed && (
                      <SortableContext items={materialItemIds} strategy={verticalListSortingStrategy}>
                        {materialGroups.map(({ cat, items }, gi) => {
                          const offset = materialGroups.slice(0, gi).reduce((s, g) => s + g.items.length, 0);
                          return (
                            <ScopeCategorySection
                              key={cat}
                              cat={cat}
                              items={items}
                              allInvItems={allInvItems}
                              hideHeader={true}
                              isCollapsed={false}
                              onToggle={() => {}}
                              selectedIds={selectedIds}
                              dragDisabled={isAdding}
                              startIndex={offset + 1}
                              onEdit={setDialogItem}
                              onDelete={setDeleteTarget}
                              onDuplicate={duplicateItem}
                              onSelect={toggleSelectItem}
                            />
                          );
                        })}
                      </SortableContext>
                    )}

                    {/* Spacer between Materials block and Equipment */}
                    {equipmentGroups.length > 0 && (
                      <tbody>
                        <tr><td colSpan={7} style={{ height: 4, background: "#f8fafc", padding: 0 }} /></tr>
                      </tbody>
                    )}
                  </>
                )}

                {/* ── Equipment groups (each in its own SortableContext, numbered 1…N per category) ── */}
                {equipmentGroups.map(({ cat, items }) => (
                  <SortableContext
                    key={cat}
                    items={items.map(i => i.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <ScopeCategorySection
                      cat={cat}
                      items={items}
                      allInvItems={allInvItems}
                      hideHeader={false}
                      isCollapsed={collapsedCats.has(cat)}
                      onToggle={() => toggleCat(cat)}
                      selectedIds={selectedIds}
                      dragDisabled={isAdding}
                      startIndex={1}
                      onEdit={setDialogItem}
                      onDelete={setDeleteTarget}
                      onDuplicate={duplicateItem}
                      onSelect={toggleSelectItem}
                    />
                  </SortableContext>
                ))}
              </table>
            </div>
          </DndContext>
        ) : null}
      </div>

      {/* ── Extract from file dialog ── */}
      <ScopeExtractDialog
        projectId={projectId}
        open={extractOpen}
        onClose={() => setExtractOpen(false)}
        onAdded={() => qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "scope-items"] })}
      />

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
