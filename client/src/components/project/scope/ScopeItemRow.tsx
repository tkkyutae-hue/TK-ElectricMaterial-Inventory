import { CSSProperties } from "react";
import {
  CheckSquare, Copy, GripVertical,
  Package, Pencil, Square, Trash2,
} from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/use-language";
import type { ProjectScopeItem } from "@shared/schema";
import { resolveDisplayCategory } from "../categoryConfig";

export function ScopeTypeChip({ scopeType }: { scopeType: string | null | undefined }) {
  const { t } = useLanguage();
  if (!scopeType || scopeType === "primary") return null;
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide bg-slate-100 text-slate-400 border border-slate-200 whitespace-nowrap ml-1.5">
      {t.projScopeChipSup}
    </span>
  );
}

export interface ScopeItemRowProps {
  item: ProjectScopeItem;
  allInvItems: any[];
  accentColor: string;
  isSelected: boolean;
  rowNumber?: number;
  dragDisabled?: boolean;
  /** Internal — passed by SortableScopeItemRow */
  trRef?: (el: HTMLTableRowElement | null) => void;
  trStyle?: CSSProperties;
  isDragging?: boolean;
  dragHandleProps?: Record<string, any>;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onSelect: () => void;
}

export function ScopeItemRow({
  item, allInvItems, accentColor,
  isSelected,
  rowNumber,
  dragDisabled = false,
  trRef, trStyle, isDragging, dragHandleProps,
  onEdit, onDelete, onDuplicate, onSelect,
}: ScopeItemRowProps) {
  const { t } = useLanguage();
  const invLinked = (item as any).linkedInventoryItemId
    ? allInvItems.find((it: any) => it.id === (item as any).linkedInventoryItemId)
    : null;
  const isSupport = (item as any).scopeType === "support";

  return (
    <tr
      ref={trRef}
      style={{
        borderLeft: `3px solid ${accentColor}55`,
        opacity: isDragging ? 0.45 : 1,
        ...trStyle,
      }}
      className={`group/row transition-colors border-t border-slate-100/80 ${!item.isActive ? "opacity-40" : ""} ${isDragging ? "bg-slate-50 shadow-lg z-10" : ""}`}
      data-testid={`scope-row-${item.id}`}
      onMouseEnter={e => { if (!isDragging) e.currentTarget.style.background = `${accentColor}08`; }}
      onMouseLeave={e => { if (!isDragging) e.currentTarget.style.background = ""; }}
    >
      {/* Drag handle */}
      <td className="w-6 pl-2 pr-0 py-3">
        {!dragDisabled && (
          <div
            {...(dragHandleProps ?? {})}
            className="cursor-grab active:cursor-grabbing text-slate-200 group-hover/row:text-slate-400 transition-colors touch-none select-none flex items-center justify-center"
            title="Drag to reorder"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </div>
        )}
      </td>

      {/* Row number */}
      <td className="w-8 pr-1 py-3 text-right tabular-nums">
        {rowNumber != null && (
          <span className="text-[10px] font-semibold text-slate-300 group-hover/row:text-slate-400 transition-colors">
            {rowNumber}
          </span>
        )}
      </td>

      <td className="px-4 py-3">
        <div className="flex items-baseline gap-0 flex-wrap">
          <p className="font-medium text-slate-900 leading-snug text-sm truncate" title={item.itemName}>
            {item.itemName}
          </p>
          {isSupport && <ScopeTypeChip scopeType="support" />}
        </div>
        {invLinked && (
          <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] text-slate-500 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded truncate" title={invLinked.name}>
            <Package className="w-2.5 h-2.5 shrink-0 text-slate-400" />
            <span className="truncate">{invLinked.name}</span>
          </span>
        )}
      </td>
      {/* Spec / 규격 */}
      <td className="px-4 py-3">
        {item.remarks
          ? <p className="text-xs text-slate-500 leading-snug whitespace-pre-wrap break-words">{item.remarks}</p>
          : <span className="text-slate-300 text-xs">—</span>
        }
      </td>
      <td className="px-4 py-3 text-right font-bold text-slate-900 tabular-nums text-sm">
        {parseFloat(String(item.estimatedQty)).toLocaleString()}
      </td>
      <td className="px-4 py-3">
        <span className="font-mono text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-100 px-2 py-0.5 rounded">{item.unit}</span>
      </td>
      <td className="px-4 py-3">
        <span className="text-xs" style={{ color: accentColor }}>{resolveDisplayCategory(item.category, item.itemName)}</span>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <Button size="sm" variant="ghost"
            className="h-7 w-7 p-0 text-slate-400 hover:text-brand-700 hover:bg-brand-50"
            onClick={onDuplicate} title={t.projScopeBtnDuplicateTooltip}
            data-testid={`button-duplicate-scope-${item.id}`}>
            <Copy className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" variant="ghost"
            className="h-7 w-7 p-0 text-slate-400 hover:text-brand-700 hover:bg-brand-50"
            onClick={onEdit} title={t.projScopeBtnEditTooltip}
            data-testid={`button-edit-scope-${item.id}`}>
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" variant="ghost"
            className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
            onClick={onDelete} title={t.projScopeBtnDeleteTooltip}
            data-testid={`button-delete-scope-${item.id}`}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" variant="ghost"
            className={`h-7 w-7 p-0 transition-colors ${isSelected ? "text-brand-600 bg-brand-50 hover:bg-brand-100" : "text-slate-300 hover:text-slate-500 hover:bg-slate-50"}`}
            onClick={onSelect}
            title={isSelected ? t.projScopeBtnDeselectTooltip : t.projScopeBtnSelectTooltip}
            data-testid={`button-select-scope-${item.id}`}>
            {isSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ── Sortable wrapper ──────────────────────────────────────────────────────────
export function SortableScopeItemRow({ item, dragDisabled, rowNumber, ...rest }: ScopeItemRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: dragDisabled,
  });

  return (
    <ScopeItemRow
      item={item}
      {...rest}
      rowNumber={rowNumber}
      dragDisabled={dragDisabled}
      trRef={setNodeRef}
      trStyle={{ transform: CSS.Transform.toString(transform), transition }}
      isDragging={isDragging}
      dragHandleProps={dragDisabled ? undefined : { ...attributes, ...listeners }}
    />
  );
}
