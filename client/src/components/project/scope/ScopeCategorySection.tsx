import { Fragment } from "react";
import { ChevronDown, LayoutList } from "lucide-react";
import type { ProjectScopeItem } from "@shared/schema";
import { CATEGORY_CONFIG, CAT_ICONS, resolveSubGroup } from "../categoryConfig";
import { ScopeItemRow } from "./ScopeItemRow";

interface ScopeCategorySectionProps {
  cat: string;
  items: ProjectScopeItem[];
  allInvItems: any[];
  isCollapsed: boolean;
  onToggle: () => void;
  variantOpen: number | null;
  movingItem: number | null;
  selectedIds: Set<number>;
  onVariantOpen: (id: number) => void;
  onVariantClose: () => void;
  onVariantSave: (item: ProjectScopeItem, ids: number[]) => void;
  onMoveOpen: (id: number) => void;
  onMoveClose: () => void;
  onMoveCategory: (item: ProjectScopeItem, category: string) => void;
  onEdit: (item: ProjectScopeItem) => void;
  onDelete: (item: ProjectScopeItem) => void;
  onDuplicate: (item: ProjectScopeItem) => void;
  onSelect: (id: number) => void;
}

export function ScopeCategorySection({
  cat, items, allInvItems,
  isCollapsed, onToggle,
  variantOpen, movingItem, selectedIds,
  onVariantOpen, onVariantClose, onVariantSave,
  onMoveOpen, onMoveClose, onMoveCategory,
  onEdit, onDelete, onDuplicate, onSelect,
}: ScopeCategorySectionProps) {
  const cfg = CATEGORY_CONFIG[cat] ?? { accent: "#64748b", iconBg: "#f1f5f9", subtitle: "" };
  const CatIcon = CAT_ICONS[cat] ?? LayoutList;
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

  function renderRow(item: ProjectScopeItem) {
    return (
      <ScopeItemRow
        key={item.id}
        item={item}
        allInvItems={allInvItems}
        accentColor={cfg.accent}
        isVariantOpen={variantOpen === item.id}
        isMoving={movingItem === item.id}
        isSelected={selectedIds.has(item.id)}
        onVariantOpen={() => onVariantOpen(item.id)}
        onVariantClose={onVariantClose}
        onVariantSave={(ids) => onVariantSave(item, ids)}
        onMoveOpen={() => onMoveOpen(item.id)}
        onMoveClose={onMoveClose}
        onMoveCategory={(c) => onMoveCategory(item, c)}
        onEdit={() => onEdit(item)}
        onDelete={() => onDelete(item)}
        onDuplicate={() => onDuplicate(item)}
        onSelect={() => onSelect(item.id)}
      />
    );
  }

  return (
    <tbody>
      {/* Category header */}
      <tr>
        <td colSpan={5} style={{ padding: 0, borderLeft: `4px solid ${cfg.accent}` }}>
          <button
            type="button"
            onClick={onToggle}
            style={{ background: `${cfg.accent}0d` }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:brightness-95 transition-all"
            data-testid={`scope-cat-toggle-${cat.replace(/[\s/&]+/g, "-")}`}
          >
            <div
              style={{ background: cfg.iconBg, width: 28, height: 28, color: cfg.accent }}
              className="rounded-md flex items-center justify-center shrink-0"
            >
              <CatIcon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold leading-tight" style={{ color: cfg.accent }}>{cat}</p>
              <p className="text-[9px] text-slate-400 leading-tight mt-0.5 truncate">{cfg.subtitle}</p>
            </div>
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap"
              style={{ background: `${cfg.accent}1a`, color: cfg.accent }}
            >
              {items.length} item{items.length !== 1 ? "s" : ""}
            </span>
            <span
              className="font-mono text-xs font-bold tabular-nums shrink-0 w-16 text-right"
              style={{ color: cfg.accent }}
            >
              {catTotalQty.toLocaleString()}
            </span>
            <ChevronDown
              className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isCollapsed ? "-rotate-90" : ""}`}
              style={{ color: cfg.accent }}
            />
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
                  <td
                    colSpan={5}
                    style={{ paddingLeft: 22, paddingTop: 5, paddingBottom: 5, borderBottom: `1px solid ${cfg.accent}1f` }}
                  >
                    <span style={{ color: `${cfg.accent}b3`, fontSize: 8, letterSpacing: "1.2px", fontWeight: 700 }}>
                      └ {sg.label.toUpperCase()}
                    </span>
                  </td>
                </tr>
                {sg.items.map(renderRow)}
              </Fragment>
            ))}
            {ungroupedItems.map(renderRow)}
          </>
        ) : (
          items.map(renderRow)
        )
      )}

      {/* Spacer */}
      <tr><td colSpan={5} style={{ height: 4, background: "#f8fafc", padding: 0 }} /></tr>
    </tbody>
  );
}
