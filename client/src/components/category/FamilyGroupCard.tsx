import { Package, XCircle, AlertTriangle, Pencil, Plus, X as XIcon, Save, ArrowUp, ArrowDown, ImageIcon } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ItemStatusBadge } from "@/components/StatusBadge";
import type { CategoryItemGroup, CategoryGroupedItem, EditDraft, NewRowDraft, DraftFamily, CategoryGroupedDetail } from "./types";
import { sortItems } from "./types";
import { InlineEditRow, InlineNewRow } from "./InlineEditRow";

interface FamilyGroupCardProps {
  group: CategoryItemGroup;
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
}

export function FamilyGroupCard({
  group, draftFamily, inlineEditFamily, editDrafts, editNewRows, savingInline,
  familySortDir, locations, allSkus, data,
  onEnterEdit, onCancelEdit, onSaveEdit, onAddRow,
  onUpdateDraft, onDeleteRow, onUpdateNewRow, onRemoveNewRow,
  onToggleSort, onOpenSettings,
}: FamilyGroupCardProps) {
  const isDraftConfirmed = draftFamily?.confirmed && draftFamily.name === group.baseItemName;
  const isEditingThis = inlineEditFamily === group.baseItemName;
  const sortDir = familySortDir[group.baseItemName] ?? "asc";
  const sortedItems = sortItems(group.items, sortDir);

  const groupLowStock = group.items.filter(i => i.status === "low_stock").length;
  const groupOutOfStock = group.items.filter(i => i.status === "out_of_stock").length;

  const skusForNewRowCheck = new Set(allSkus);
  editNewRows.forEach(r => { if (r.sku.trim()) skusForNewRowCheck.add(r.sku.trim().toUpperCase()); });

  return (
    <div
      className={`bg-white border rounded-xl overflow-hidden shadow-sm ${isDraftConfirmed ? "border-brand-300 border-2" : isEditingThis ? "border-amber-300 border-2" : "border-slate-200"}`}
      data-testid={`family-card-${group.baseItemName.replace(/\s+/g, "-")}`}
    >
      {/* Family card header */}
      <div className={`flex items-center justify-between px-5 border-b min-h-[60px] ${isEditingThis ? "bg-amber-50/60 border-amber-200" : "border-slate-200 bg-slate-50/80"}`}>
        <div className="flex items-center gap-3 py-3 flex-1 min-w-0">
          <div className="w-11 h-11 rounded-lg overflow-hidden bg-white border border-slate-200 flex items-center justify-center shrink-0">
            {group.representativeImage ? <img src={group.representativeImage} alt={group.baseItemName} className="w-full h-full object-cover" /> : <Package className="w-5 h-5 text-slate-300" />}
          </div>
          <div className="min-w-0 flex-1">
            <h3
              className="!text-base font-semibold text-slate-900 leading-snug truncate"
              style={{ fontSize: "1rem", fontWeight: 600 }}
            >{group.baseItemName}</h3>
            <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider leading-none mt-0.5">
              {group.items.length} {group.items.length === 1 ? "size" : "sizes"}
              {isDraftConfirmed && <span className="ml-2 text-brand-500 normal-case tracking-normal">New family</span>}
              {isEditingThis && <span className="ml-2 text-amber-600 normal-case tracking-normal font-semibold">● Editing</span>}
            </p>
          </div>
        </div>

        {/* Header buttons */}
        <div className="flex items-center gap-2 shrink-0 pl-3">
          {!isEditingThis && (
            <>
              {groupOutOfStock > 0 && (
                <span className="hidden sm:inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-full px-2.5 py-0.5 whitespace-nowrap">
                  <XCircle className="w-3 h-3" />{groupOutOfStock} out of stock
                </span>
              )}
              {groupLowStock > 0 && (
                <span className="hidden sm:inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5 whitespace-nowrap">
                  <AlertTriangle className="w-3 h-3" />{groupLowStock} low
                </span>
              )}
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 gap-1"
                onClick={() => onOpenSettings(group)} data-testid={`button-family-settings-${group.baseItemName.replace(/\s+/g, "-")}`} title="Family settings">
                <Pencil className="w-3 h-3" />Settings
              </Button>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-amber-600 bg-amber-50 hover:bg-amber-100 border border-amber-200 gap-1"
                onClick={() => onEnterEdit(group)} disabled={!!inlineEditFamily} data-testid={`button-edit-family-${group.baseItemName.replace(/\s+/g, "-")}`}>
                <Pencil className="w-3 h-3" />Edit
              </Button>
            </>
          )}
          {isEditingThis && (
            <>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs text-brand-600 border-brand-200 hover:bg-brand-50 gap-1"
                onClick={onAddRow} disabled={savingInline} data-testid={`button-add-row-${group.baseItemName.replace(/\s+/g, "-")}`}>
                <Plus className="w-3 h-3" />Add Row
              </Button>
              <Button variant="outline" size="sm" className="h-7 px-3 text-xs text-slate-600 hover:bg-slate-100"
                onClick={onCancelEdit} disabled={savingInline} data-testid={`button-cancel-edit-${group.baseItemName.replace(/\s+/g, "-")}`}>
                <XIcon className="w-3 h-3 mr-1" />Cancel
              </Button>
              <Button size="sm" className="h-7 px-3 text-xs bg-brand-700 hover:bg-brand-800 gap-1"
                onClick={() => onSaveEdit(group)} disabled={savingInline} data-testid={`button-save-edit-${group.baseItemName.replace(/\s+/g, "-")}`}>
                <Save className="w-3 h-3" />{savingInline ? "Saving…" : "Save Changes"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Items — edit mode table or view mode table */}
      {isEditingThis ? (
        <div className="overflow-x-auto">
          <Table style={{ tableLayout: "fixed", width: "100%", minWidth: "760px" }}>
            <colgroup>
              <col style={{ width: "100px" }} />
              <col style={{ width: "50px" }} />
              <col style={{ width: "100px" }} />
              <col />
              <col style={{ width: "85px" }} />
              <col style={{ width: "95px" }} />
              <col style={{ width: "150px" }} />
              <col style={{ width: "80px" }} />
            </colgroup>
            <TableHeader>
              <TableRow className="hover:bg-transparent bg-transparent border-b border-slate-100">
                <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-2 pl-5 text-center">SKU</TableHead>
                <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-2 text-center">Photo</TableHead>
                <TableHead className="py-2 text-center">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 uppercase tracking-wide">Size</span>
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-2 text-center">Item Name</TableHead>
                <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-2 text-center">Qty</TableHead>
                <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-2 text-center">Unit</TableHead>
                <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-2 text-center">Location</TableHead>
                <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-2 pr-5 text-center">Delete</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedItems.map(item => {
                if (editDrafts[item.id]) {
                  if (editDrafts[item.id]._deleted) return null;
                  return (
                    <InlineEditRow key={item.id} item={item} draft={editDrafts[item.id]}
                      locations={locations} onChange={patch => onUpdateDraft(item.id, patch)} onDelete={() => onDeleteRow(item.id)} />
                  );
                }
                return null;
              })}
              {editNewRows.map(row => (
                <InlineNewRow
                  key={row.tmpId}
                  draft={row}
                  familyName={group.baseItemName}
                  categoryId={data?.category.id}
                  categoryCode={data?.category.code}
                  existingItems={group.items}
                  existingSkus={skusForNewRowCheck}
                  locations={locations}
                  onChange={patch => onUpdateNewRow(row.tmpId, patch)}
                  onRemove={() => onRemoveNewRow(row.tmpId)}
                />
              ))}
              {group.items.length === 0 && editNewRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-6 text-slate-400 text-sm">
                    Click <strong>Add Row</strong> above to add items to this family.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table style={{ tableLayout: "fixed", width: "100%", minWidth: "600px" }}>
            <colgroup>
              <col style={{ width: "130px" }} />
              <col style={{ width: "56px" }} />
              <col style={{ width: "104px" }} />
              <col />
              <col style={{ width: "108px" }} />
              <col style={{ width: "118px" }} />
            </colgroup>
            <TableHeader>
              <TableRow className="hover:bg-transparent bg-transparent border-b border-slate-100">
                <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide h-9 pl-5 pr-2">SKU</TableHead>
                <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide h-9 px-2">Photo</TableHead>
                <TableHead className="h-9 pl-2 pr-3">
                  <button
                    onClick={() => onToggleSort(group.baseItemName)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 uppercase tracking-wide hover:text-slate-600 transition-colors"
                    title={sortDir === "asc" ? "Sorted small→large (click for large→small)" : "Sorted large→small (click for small→large)"}
                    data-testid={`button-sort-size-${group.baseItemName.replace(/\s+/g, "-")}`}
                  >
                    Size
                    {sortDir === "asc"
                      ? <ArrowUp className="w-3 h-3 text-brand-500" />
                      : <ArrowDown className="w-3 h-3 text-brand-500" />}
                  </button>
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide h-9 pl-2 pr-3">Item</TableHead>
                <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide h-9 px-3 text-right whitespace-nowrap">Qty / Unit</TableHead>
                <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide h-9 px-3 text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedItems.map(item => (
                <TableRow
                  key={item.id}
                  className={`hover:bg-slate-50/70 transition-colors border-b border-slate-50 last:border-0 ${item.status === "out_of_stock" ? "bg-red-50/20" : item.status === "low_stock" ? "bg-amber-50/20" : ""}`}
                  data-testid={`row-item-${item.id}`}
                >
                  <TableCell className="h-10 pl-5 pr-2 overflow-hidden">
                    <div className="font-mono text-[11px] leading-tight text-slate-500 truncate" title={item.sku}>{item.sku}</div>
                  </TableCell>
                  <TableCell className="h-10 px-2">
                    <div className="flex items-center">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt="" className="w-9 h-9 object-cover rounded border border-slate-200 block"
                          onError={e => { e.currentTarget.style.display = "none"; (e.currentTarget.nextElementSibling as HTMLElement)?.classList.remove("hidden"); }} />
                      ) : null}
                      <div className={`w-9 h-9 rounded border border-slate-100 bg-slate-50 flex items-center justify-center ${item.imageUrl ? "hidden" : ""}`}>
                        <ImageIcon className="w-3.5 h-3.5 text-slate-300" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="h-10 pl-2 pr-3 overflow-hidden">
                    <div className="font-semibold text-slate-800 text-sm truncate">{item.sizeLabel || "—"}</div>
                  </TableCell>
                  <TableCell className="h-10 pl-2 pr-3 overflow-hidden">
                    <Link href={`/inventory/${item.id}`} className="text-slate-700 text-sm hover:text-brand-600 hover:underline transition-colors block truncate" data-testid={`link-item-name-${item.id}`} title={item.name}>{item.name}</Link>
                  </TableCell>
                  <TableCell className="h-10 px-3 text-right tabular-nums overflow-hidden">
                    <span className="font-semibold text-slate-900">{item.quantityOnHand.toLocaleString()}</span>
                    <span className="text-slate-400 font-normal text-xs ml-1">{item.unitOfMeasure}</span>
                  </TableCell>
                  <TableCell className="h-10 px-3 overflow-hidden">
                    <div className="flex items-center justify-center"><ItemStatusBadge status={item.status} /></div>
                  </TableCell>
                </TableRow>
              ))}
              {group.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 text-slate-400 text-sm">
                    No items yet.{" "}
                    <button className="text-brand-600 hover:underline" onClick={() => onEnterEdit(group)} data-testid={`link-add-first-item-${group.baseItemName.replace(/\s+/g, "-")}`}>
                      Click Edit to add items.
                    </button>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
