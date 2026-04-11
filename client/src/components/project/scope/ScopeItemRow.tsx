import { Fragment, useState } from "react";
import {
  CheckCircle2, CheckSquare, Copy, FolderOpen,
  Package, Pencil, Square, Trash2, X, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProjectScopeItem } from "@shared/schema";
import { CATEGORY_ORDER, resolveDisplayCategory } from "../categoryConfig";
import { flexMatch } from "../types";

export function ScopeTypeChip({ scopeType }: { scopeType: string | null | undefined }) {
  if (!scopeType || scopeType === "primary") return null;
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide bg-slate-100 text-slate-400 border border-slate-200 whitespace-nowrap ml-1.5">
      sup
    </span>
  );
}

function VariantArea({
  item, invItems, onSave, onClose,
}: {
  item: ProjectScopeItem;
  invItems: any[];
  onSave: (ids: number[]) => void;
  onClose: () => void;
}) {
  const existing: number[] = (item as any).acceptedVariants ?? [];
  const [selected, setSelected] = useState<number[]>(existing);
  const [search, setSearch] = useState("");

  const filtered = invItems.filter(it => flexMatch(search, it.name)).slice(0, 15);
  const selectedItems = invItems.filter(it => selected.includes(it.id));

  function toggle(id: number) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  return (
    <tr>
      <td colSpan={6} className="px-5 pb-4 pt-0">
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-indigo-800">Accepted Variants — "{item.itemName}"</p>
              <p className="text-[10px] text-indigo-500 mt-0.5">Inventory items accepted as substitutes for this scope item</p>
            </div>
            <button type="button" onClick={onClose} className="text-indigo-400 hover:text-indigo-600 p-1">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {selectedItems.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedItems.map(it => (
                <span key={it.id} className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 border border-indigo-300 text-indigo-800 text-xs rounded-full">
                  {it.name}
                  <button type="button" onClick={() => toggle(it.id)} className="text-indigo-400 hover:text-indigo-700 ml-0.5">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search inventory items to add as variants…"
            className="h-8 text-xs"
            data-testid={`variant-search-${item.id}`}
          />
          {search && (
            <div className="bg-white border border-slate-200 rounded-lg max-h-40 overflow-y-auto">
              {filtered.length === 0
                ? <p className="text-xs text-slate-400 px-3 py-2 italic">No matches</p>
                : filtered.map(it => (
                  <button key={it.id} type="button" onClick={() => toggle(it.id)}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between gap-2 hover:bg-slate-50 transition-colors ${selected.includes(it.id) ? "bg-indigo-50 text-indigo-800 font-medium" : "text-slate-700"}`}
                    data-testid={`variant-item-${it.id}`}>
                    <span className="truncate">{it.name}</span>
                    {selected.includes(it.id) && <CheckCircle2 className="w-3 h-3 text-indigo-600 shrink-0" />}
                  </button>
                ))
              }
            </div>
          )}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-indigo-600">{selected.length} variant{selected.length !== 1 ? "s" : ""} selected</span>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={onClose} className="h-7 text-xs">Cancel</Button>
              <Button type="button" size="sm" className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={() => onSave(selected)} data-testid={`button-save-variants-${item.id}`}>
                Save Variants
              </Button>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

export interface ScopeItemRowProps {
  item: ProjectScopeItem;
  allInvItems: any[];
  accentColor: string;
  isVariantOpen: boolean;
  isMoving: boolean;
  isSelected: boolean;
  onVariantOpen: () => void;
  onVariantClose: () => void;
  onVariantSave: (ids: number[]) => void;
  onMoveOpen: () => void;
  onMoveClose: () => void;
  onMoveCategory: (category: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onSelect: () => void;
}

export function ScopeItemRow({
  item, allInvItems, accentColor,
  isVariantOpen, isMoving, isSelected,
  onVariantOpen, onVariantClose, onVariantSave,
  onMoveOpen, onMoveClose, onMoveCategory,
  onEdit, onDelete, onDuplicate, onSelect,
}: ScopeItemRowProps) {
  const invLinked = (item as any).linkedInventoryItemId
    ? allInvItems.find(it => it.id === (item as any).linkedInventoryItemId)
    : null;
  const variants = (item as any).acceptedVariants as number[] ?? [];
  const isSupport = (item as any).scopeType === "support";

  return (
    <Fragment>
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
          {variants.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-0.5">
              {variants.slice(0, 2).map((vid: number) => {
                const inv = allInvItems.find(it => it.id === vid);
                return inv ? (
                  <span key={vid} className="text-[9px] px-1.5 py-0.5 bg-violet-50 border border-violet-200 text-violet-600 rounded truncate max-w-[120px]" title={inv.name}>
                    {inv.name}
                  </span>
                ) : null;
              })}
              {variants.length > 2 && <span className="text-[9px] text-slate-400">+{variants.length - 2}</span>}
            </div>
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
          {isMoving ? (
            <select
              className="text-xs border border-brand-300 rounded px-1.5 py-1 bg-white text-slate-700 w-36"
              value={resolveDisplayCategory(item.category, item.itemName)}
              onChange={e => onMoveCategory(e.target.value)}
              onBlur={onMoveClose}
              autoFocus
              data-testid={`scope-move-cat-${item.id}`}
            >
              {CATEGORY_ORDER.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          ) : (
            <span className="text-xs" style={{ color: accentColor }}>{resolveDisplayCategory(item.category, item.itemName)}</span>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-1">
            <Button size="sm" variant="ghost"
              className="h-7 px-2 text-[10px] text-slate-400 hover:text-violet-600 hover:bg-violet-50 gap-1"
              onClick={onVariantOpen}
              title="Add / Edit Variants" data-testid={`button-variant-scope-${item.id}`}>
              <Zap className="w-3 h-3" />
              <span className="hidden xl:inline">Variants</span>
            </Button>
            <Button size="sm" variant="ghost"
              className="h-7 w-7 p-0 text-slate-400 hover:text-brand-700 hover:bg-brand-50"
              onClick={onDuplicate} title="Duplicate"
              data-testid={`button-duplicate-scope-${item.id}`}>
              <Copy className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" variant="ghost"
              className="h-7 w-7 p-0 text-slate-400 hover:text-amber-600 hover:bg-amber-50"
              onClick={onMoveOpen}
              title="Move to Category" data-testid={`button-move-scope-${item.id}`}>
              <FolderOpen className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" variant="ghost"
              className="h-7 w-7 p-0 text-slate-400 hover:text-brand-700 hover:bg-brand-50"
              onClick={onEdit} title="Edit"
              data-testid={`button-edit-scope-${item.id}`}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" variant="ghost"
              className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
              onClick={onDelete} title="Delete"
              data-testid={`button-delete-scope-${item.id}`}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" variant="ghost"
              className={`h-7 w-7 p-0 transition-colors ${isSelected ? "text-brand-600 bg-brand-50 hover:bg-brand-100" : "text-slate-300 hover:text-slate-500 hover:bg-slate-50"}`}
              onClick={onSelect}
              title={isSelected ? "Deselect" : "Select for bulk action"}
              data-testid={`button-select-scope-${item.id}`}>
              {isSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </td>
      </tr>
      {isVariantOpen && (
        <VariantArea
          item={item}
          invItems={allInvItems}
          onSave={onVariantSave}
          onClose={onVariantClose}
        />
      )}
    </Fragment>
  );
}
