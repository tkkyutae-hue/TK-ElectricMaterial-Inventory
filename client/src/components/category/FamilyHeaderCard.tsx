import { Package, ChevronRight, AlertTriangle, XCircle, GripVertical } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FamilyGroupCard } from "./FamilyGroupCard";
import { getGroupId } from "./types";
import type {
  FamilyHeaderGroup, CategoryItemGroup, CategoryGroupedItem,
  EditDraft, NewRowDraft, DraftFamily, CategoryGroupedDetail,
} from "./types";

interface FamilyHeaderCardProps {
  family: FamilyHeaderGroup;
  isCollapsed: boolean;
  hasActiveFilters: boolean;
  onToggleCollapsed: (subcategory: string) => void;
  draftFamily: DraftFamily | null;
  inlineEditFamily: string | null;
  editDrafts: Record<number, EditDraft>;
  editNewRows: NewRowDraft[];
  savingInline: boolean;
  familySortDir: Record<string, "asc" | "desc">;
  locations: any[];
  allSkus: Set<string>;
  data: CategoryGroupedDetail;
  onEnterEdit: (group: CategoryItemGroup) => void;
  onCancelEdit: () => void;
  onSaveEdit: (group: CategoryItemGroup) => void;
  onAddRow: () => void;
  onUpdateDraft: (itemId: number, patch: Partial<EditDraft>) => void;
  onDeleteRow: (itemId: number) => void;
  onUpdateNewRow: (tmpId: string, patch: Partial<NewRowDraft>) => void;
  onRemoveNewRow: (tmpId: string) => void;
  onToggleSort: (familyName: string) => void;
  onOpenSettings: (group: CategoryItemGroup) => void;
  onMoveCategory?: (group: CategoryItemGroup) => void;
  onAdjustStock?: (item: CategoryGroupedItem) => void;
  isAdmin?: boolean;
  collapsedItemHeaders: Set<string>;
  onToggleItemHeaderCollapsed: (gid: string) => void;
  isDraggableItemHeaders?: boolean;
  isDraggable?: boolean;
  onGroupDragEnd?: (event: DragEndEvent) => void;
}

export function FamilyHeaderCard({
  family,
  isCollapsed,
  hasActiveFilters,
  onToggleCollapsed,
  draftFamily,
  inlineEditFamily,
  editDrafts,
  editNewRows,
  savingInline,
  familySortDir,
  locations,
  allSkus,
  data,
  onEnterEdit,
  onCancelEdit,
  onSaveEdit,
  onAddRow,
  onUpdateDraft,
  onDeleteRow,
  onUpdateNewRow,
  onRemoveNewRow,
  onToggleSort,
  onOpenSettings,
  onMoveCategory,
  onAdjustStock,
  isAdmin,
  collapsedItemHeaders,
  onToggleItemHeaderCollapsed,
  isDraggableItemHeaders,
  isDraggable,
  onGroupDragEnd,
}: FamilyHeaderCardProps) {
  const hasEditingGroup = family.groups.some(g => getGroupId(g) === inlineEditFamily);
  const effectivelyCollapsed = !hasEditingGroup && !hasActiveFilters && isCollapsed;

  const skuCount = family.groups.reduce((s, g) => s + g.items.length, 0);
  const lowStockCount = family.groups.reduce((s, g) => s + g.items.filter(i => i.status === "low_stock").length, 0);
  const outOfStockCount = family.groups.reduce((s, g) => s + g.items.filter(i => i.status === "out_of_stock").length, 0);

  const displayImage =
    family.groups[0]?.representativeImage ??
    family.groups[0]?.items[0]?.imageUrl ??
    null;

  const safeId = family.subcategory.replace(/\s+/g, "-");

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: family.subcategory,
    disabled: !isDraggable,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  return (
    <div
      ref={setNodeRef}
      style={isDraggable ? { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 } : undefined}
      className="border border-slate-300 rounded-2xl overflow-hidden shadow-sm bg-white"
      data-testid={`family-header-${safeId}`}
    >
      {/* ── Family Header row ─────────────────────────────────────────────── */}
      <div className={`flex items-center bg-slate-100/80 transition-colors min-h-[56px] ${hasActiveFilters ? "" : "hover:bg-slate-100"}`}>
        {isDraggable && (
          <div
            {...attributes}
            {...listeners}
            className="pl-3 pr-1 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 shrink-0 touch-none select-none self-stretch flex items-center"
            title="Drag to reorder section"
            data-testid={`drag-handle-family-header-${safeId}`}
          >
            <GripVertical className="w-4 h-4" />
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            if (!hasActiveFilters) onToggleCollapsed(family.subcategory);
          }}
          aria-expanded={!effectivelyCollapsed}
          className={`flex-1 flex items-center gap-3 px-4 py-3 text-left ${hasActiveFilters ? "cursor-default" : "cursor-pointer"}`}
          data-testid={`button-toggle-family-header-${safeId}`}
          title={hasActiveFilters ? undefined : (effectivelyCollapsed ? "Expand" : "Collapse")}
        >
          <ChevronRight
            className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${effectivelyCollapsed ? "" : "rotate-90"}`}
            aria-hidden="true"
          />
          <div className="w-9 h-9 rounded-lg overflow-hidden bg-white border border-slate-200 flex items-center justify-center shrink-0">
            {displayImage
              ? <img src={displayImage} alt={family.subcategory} className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = "none"; (e.currentTarget.nextElementSibling as HTMLElement)?.classList.remove("hidden"); }} />
              : null}
            <Package className={`w-4 h-4 text-slate-300 ${displayImage ? "hidden" : ""}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-bold text-slate-800 truncate leading-snug"
              data-testid={`text-family-header-name-${safeId}`}
            >
              {family.subcategory}
            </p>
            <p
              className="text-[11px] text-slate-500 font-medium uppercase tracking-wide leading-none mt-0.5"
              data-testid={`text-family-header-summary-${safeId}`}
            >
              {family.groups.length} {family.groups.length === 1 ? "group" : "groups"} · {skuCount} {skuCount === 1 ? "SKU" : "SKUs"}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {outOfStockCount > 0 && (
              <span className="hidden sm:inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-full px-2.5 py-0.5 whitespace-nowrap">
                <XCircle className="w-3 h-3" />{outOfStockCount} out
              </span>
            )}
            {lowStockCount > 0 && (
              <span className="hidden sm:inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5 whitespace-nowrap">
                <AlertTriangle className="w-3 h-3" />{lowStockCount} low
              </span>
            )}
          </div>
        </button>
      </div>

      {/* ── Child Item Headers ─────────────────────────────────────────────── */}
      {!effectivelyCollapsed && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onGroupDragEnd}>
          <SortableContext
            items={family.groups.map(g => getGroupId(g))}
            strategy={verticalListSortingStrategy}
          >
            <div className="p-3 space-y-3 bg-slate-50/40">
              {family.groups.map(group => (
                <FamilyGroupCard
                  key={getGroupId(group)}
                  group={group}
                  draftFamily={draftFamily}
                  inlineEditFamily={inlineEditFamily}
                  editDrafts={editDrafts}
                  editNewRows={editNewRows}
                  savingInline={savingInline}
                  familySortDir={familySortDir}
                  locations={locations}
                  allSkus={allSkus}
                  data={data}
                  onEnterEdit={onEnterEdit}
                  onCancelEdit={onCancelEdit}
                  onSaveEdit={onSaveEdit}
                  onAddRow={onAddRow}
                  onUpdateDraft={onUpdateDraft}
                  onDeleteRow={onDeleteRow}
                  onUpdateNewRow={onUpdateNewRow}
                  onRemoveNewRow={onRemoveNewRow}
                  onToggleSort={onToggleSort}
                  onOpenSettings={onOpenSettings}
                  onMoveCategory={onMoveCategory}
                  onAdjustStock={onAdjustStock}
                  isAdmin={isAdmin}
                  isCollapsed={collapsedItemHeaders.has(getGroupId(group))}
                  onToggleCollapsed={onToggleItemHeaderCollapsed}
                  isDraggable={isDraggableItemHeaders}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
