import {
  CheckSquare, Copy,
  Package, Pencil, Square, Trash2,
} from "lucide-react";
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
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onSelect: () => void;
}

export function ScopeItemRow({
  item, allInvItems, accentColor,
  isSelected,
  onEdit, onDelete, onDuplicate, onSelect,
}: ScopeItemRowProps) {
  const { t } = useLanguage();
  const invLinked = (item as any).linkedInventoryItemId
    ? allInvItems.find((it: any) => it.id === (item as any).linkedInventoryItemId)
    : null;
  const isSupport = (item as any).scopeType === "support";

  return (
    <tr
      style={{ borderLeft: `3px solid ${accentColor}55` }}
      className={`transition-colors border-t border-slate-100/80 ${!item.isActive ? "opacity-40" : ""}`}
      data-testid={`scope-row-${item.id}`}
      onMouseEnter={e => (e.currentTarget.style.background = `${accentColor}08`)}
      onMouseLeave={e => (e.currentTarget.style.background = "")}
    >
      <td className="px-5 py-3">
        <div className="flex items-baseline gap-0 flex-wrap">
          <p className="font-medium text-slate-900 leading-snug text-sm truncate max-w-[260px]" title={item.itemName}>
            {item.itemName}
          </p>
          {isSupport && <ScopeTypeChip scopeType="support" />}
        </div>
        {invLinked && (
          <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] text-slate-500 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded truncate max-w-[240px]" title={invLinked.name}>
            <Package className="w-2.5 h-2.5 shrink-0 text-slate-400" />
            <span className="truncate">{invLinked.name}</span>
          </span>
        )}
        {item.remarks && <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[240px]">{item.remarks}</p>}
      </td>
      <td className="px-4 py-3">
        <span className="font-mono text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-100 px-2 py-0.5 rounded">{item.unit}</span>
      </td>
      <td className="px-4 py-3 text-right font-bold text-slate-900 tabular-nums text-sm">
        {parseFloat(String(item.estimatedQty)).toLocaleString()}
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
