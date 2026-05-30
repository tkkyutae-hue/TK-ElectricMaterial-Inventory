import { useState, useRef } from "react";
import { Package, XCircle, AlertTriangle, Pencil, Plus, X as XIcon, Save, ArrowUp, ArrowDown, ImageIcon, FolderInput, SlidersHorizontal, ChevronRight, GripVertical, Cpu, Camera, Upload } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ItemStatusBadge } from "@/components/StatusBadge";
import { UsagePatternBadge } from "@/components/UsagePatternBadge";
import { useLanguage } from "@/hooks/use-language";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { CategoryItemGroup, CategoryGroupedItem, EditDraft, NewRowDraft, DraftFamily, CategoryGroupedDetail } from "./types";
import { sortItems, getGroupId } from "./types";
import { InlineEditRow, InlineNewRow } from "./InlineEditRow";
// ── Asset row expansion ──────────────────────────────────────────────────────
type ToolAssetEntry = {
  id: number;
  assetTag: string;
  status: string;
  condition: string | null;
  repairNote: string | null;
  assignedTo: string | null;
  photoUrl: string | null;
  location?: { id: number; name: string } | null;
  project?: { id: number; name: string } | null;
};

const ASSET_STATUS_LABELS: Record<string, string> = {
  available: "In Stock",
  in_use: "In Use",
  repair_needed: "Repair Needed",
  under_repair: "Under Repair",
  out_of_service: "Out of Service",
  lost: "Lost",
  retired: "Retired",
};

const ASSET_CONDITION_LABELS: Record<string, string> = {
  good: "Good",
  fair: "Fair",
  damaged: "Damaged",
  needs_repair: "Needs Repair",
};

// ── Asset edit dialog ─────────────────────────────────────────────────────────
function AssetEditDialog({
  asset,
  itemId,
  open,
  onClose,
}: {
  asset: ToolAssetEntry;
  itemId: number;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState(asset.status);
  const [condition, setCondition] = useState(asset.condition ?? "good");
  const [locationId, setLocationId] = useState<string>(asset.location?.id ? String(asset.location.id) : "none");
  const [projectId, setProjectId] = useState<string>(asset.project?.id ? String(asset.project.id) : "none");
  const [assignedTo, setAssignedTo] = useState(asset.assignedTo ?? "");
  const [repairNote, setRepairNote] = useState(asset.repairNote ?? "");
  const [photoUrl, setPhotoUrl] = useState<string | null>(asset.photoUrl ?? null);
  const [uploading, setUploading] = useState(false);

  const { data: locations = [] } = useQuery<any[]>({
    queryKey: ["/api/locations"],
    staleTime: 60_000,
  });
  const { data: projects = [] } = useQuery<any[]>({
    queryKey: ["/api/projects"],
    staleTime: 60_000,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const patch: Record<string, any> = {
        status,
        condition,
        assignedTo: assignedTo.trim() || null,
        repairNote: repairNote.trim() || null,
        photoUrl: photoUrl ?? null,
        locationId: locationId !== "none" ? parseInt(locationId) : null,
        projectId: projectId !== "none" ? parseInt(projectId) : null,
      };
      const res = await fetch(`/api/tool-assets/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? "Save failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/items", itemId, "assets"] });
      toast({ title: "Asset updated", description: asset.assetTag });
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload/item-image", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) throw new Error((await res.json()).message ?? "Upload failed");
      const { url } = await res.json();
      setPhotoUrl(url);
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">Edit Asset — {asset.assetTag}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-2">
          {/* Photo */}
          <div className="col-span-2">
            <Label className="text-xs text-slate-500 mb-1.5 block">Photo</Label>
            <div className="flex items-center gap-4">
              <div
                className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50 overflow-hidden cursor-pointer hover:border-violet-400 transition-colors flex-shrink-0"
                onClick={() => fileInputRef.current?.click()}
                data-testid="asset-photo-upload-area"
              >
                {photoUrl ? (
                  <img src={photoUrl} alt="asset" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-7 h-7 text-slate-300" />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="button-asset-upload-photo"
                  className="text-xs"
                >
                  <Upload className="w-3.5 h-3.5 mr-1.5" />
                  {uploading ? "Uploading…" : photoUrl ? "Change Photo" : "Upload Photo"}
                </Button>
                {photoUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    className="text-xs text-slate-400 hover:text-red-500"
                    onClick={() => setPhotoUrl(null)}
                    data-testid="button-asset-remove-photo"
                  >
                    Remove
                  </Button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handlePhotoChange}
                data-testid="input-asset-photo-file"
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <Label className="text-xs text-slate-500 mb-1.5 block">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-8 text-sm" data-testid="select-asset-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available">In Stock</SelectItem>
                <SelectItem value="in_use">In Use</SelectItem>
                <SelectItem value="repair_needed">Repair Needed</SelectItem>
                <SelectItem value="under_repair">Under Repair</SelectItem>
                <SelectItem value="out_of_service">Out of Service</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
                <SelectItem value="retired">Retired</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Condition */}
          <div>
            <Label className="text-xs text-slate-500 mb-1.5 block">Condition</Label>
            <Select value={condition} onValueChange={setCondition}>
              <SelectTrigger className="h-8 text-sm" data-testid="select-asset-condition">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="good">Good</SelectItem>
                <SelectItem value="fair">Fair</SelectItem>
                <SelectItem value="damaged">Damaged</SelectItem>
                <SelectItem value="needs_repair">Needs Repair</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Location */}
          <div>
            <Label className="text-xs text-slate-500 mb-1.5 block">Location</Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger className="h-8 text-sm" data-testid="select-asset-location">
                <SelectValue placeholder="— None —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {locations.map((l: any) => (
                  <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Project */}
          <div>
            <Label className="text-xs text-slate-500 mb-1.5 block">Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="h-8 text-sm" data-testid="select-asset-project">
                <SelectValue placeholder="— None —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {projects.map((p: any) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Assigned To */}
          <div className="col-span-2">
            <Label className="text-xs text-slate-500 mb-1.5 block">Assigned To</Label>
            <Input
              value={assignedTo}
              onChange={e => setAssignedTo(e.target.value)}
              placeholder="Worker name…"
              className="h-8 text-sm"
              data-testid="input-asset-assigned-to"
            />
          </div>

          {/* Repair Note */}
          <div className="col-span-2">
            <Label className="text-xs text-slate-500 mb-1.5 block">Repair Note</Label>
            <Textarea
              value={repairNote}
              onChange={e => setRepairNote(e.target.value)}
              placeholder="Describe repair or issue…"
              rows={2}
              className="text-sm resize-none"
              data-testid="input-asset-repair-note"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saveMutation.isPending}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || uploading}
            data-testid="button-asset-save"
          >
            {saveMutation.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Asset expanded row ────────────────────────────────────────────────────────
function AssetExpandedRow({ itemId, colSpan }: { itemId: number; colSpan: number }) {
  const [editingAsset, setEditingAsset] = useState<ToolAssetEntry | null>(null);

  const { data: assets = [], isLoading } = useQuery<ToolAssetEntry[]>({
    queryKey: ["/api/items", itemId, "assets"],
    queryFn: () => fetch(`/api/items/${itemId}/assets`, { credentials: "include" }).then(r => r.json()),
    staleTime: 30_000,
  });

  return (
    <TableRow className="hover:bg-violet-50/20 border-0">
      <TableCell colSpan={colSpan} className="p-0">
        <div className="bg-violet-50/40 border-t border-violet-100">
          {isLoading ? (
            <div className="px-8 py-3 text-xs text-slate-400">Loading assets…</div>
          ) : assets.length === 0 ? (
            <div className="px-8 py-3 text-xs text-slate-400 italic">
              No asset records yet. Use "Generate Asset IDs" below to create them.
            </div>
          ) : (
            <table className="w-full text-xs border-b border-violet-100">
              <thead>
                <tr className="border-b border-violet-100">
                  <th className="text-left pl-10 pr-3 py-2 font-semibold text-violet-700 uppercase tracking-wide whitespace-nowrap">Asset ID</th>
                  <th className="text-left px-3 py-2 font-semibold text-violet-700 uppercase tracking-wide w-[52px]">Photo</th>
                  <th className="text-left px-3 py-2 font-semibold text-violet-700 uppercase tracking-wide w-[130px]">Status</th>
                  <th className="text-left px-3 py-2 font-semibold text-violet-700 uppercase tracking-wide w-[100px]">Condition</th>
                  <th className="text-left px-3 py-2 font-semibold text-violet-700 uppercase tracking-wide w-[150px]">Location</th>
                  <th className="text-left px-3 py-2 font-semibold text-violet-700 uppercase tracking-wide w-[150px]">Project</th>
                  <th className="text-left px-3 py-2 font-semibold text-violet-700 uppercase tracking-wide">Assigned To</th>
                  <th className="text-left px-3 py-2 font-semibold text-violet-700 uppercase tracking-wide pr-2">Repair Note</th>
                  <th className="w-8 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {assets.map(a => (
                  <tr key={a.id} className="border-t border-violet-100/70 hover:bg-violet-100/40 transition-colors" data-testid={`row-asset-expanded-${a.id}`}>
                    <td className="pl-10 pr-3 py-2 font-mono font-semibold text-slate-700 whitespace-nowrap">{a.assetTag}</td>
                    {/* Photo thumbnail */}
                    <td className="px-3 py-1.5">
                      {a.photoUrl ? (
                        <img
                          src={a.photoUrl}
                          alt={a.assetTag}
                          className="w-8 h-8 rounded object-cover border border-slate-200 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => setEditingAsset(a)}
                          data-testid={`img-asset-thumb-${a.id}`}
                        />
                      ) : (
                        <div
                          className="w-8 h-8 rounded border border-dashed border-slate-200 flex items-center justify-center bg-slate-50 cursor-pointer hover:border-violet-400 transition-colors"
                          onClick={() => setEditingAsset(a)}
                          data-testid={`img-asset-thumb-${a.id}`}
                          title="Add photo"
                        >
                          <Camera className="w-3.5 h-3.5 text-slate-300" />
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        a.status === "available" ? "bg-emerald-100 text-emerald-800" :
                        a.status === "in_use" ? "bg-blue-100 text-blue-800" :
                        a.status === "repair_needed" || a.status === "under_repair" ? "bg-amber-100 text-amber-800" :
                        "bg-slate-100 text-slate-600"
                      }`}>{ASSET_STATUS_LABELS[a.status] ?? a.status}</span>
                    </td>
                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{ASSET_CONDITION_LABELS[a.condition ?? ""] ?? a.condition ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{a.location?.name ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{a.project?.name ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{a.assignedTo ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-600 pr-2 max-w-[180px] truncate" title={a.repairNote ?? ""}>{a.repairNote || "—"}</td>
                    {/* Edit button */}
                    <td className="pr-3 py-2 text-right">
                      <button
                        className="p-1 rounded hover:bg-violet-200 text-violet-400 hover:text-violet-700 transition-colors"
                        onClick={() => setEditingAsset(a)}
                        data-testid={`button-edit-asset-${a.id}`}
                        title="Edit asset"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {editingAsset && (
          <AssetEditDialog
            asset={editingAsset}
            itemId={itemId}
            open={!!editingAsset}
            onClose={() => setEditingAsset(null)}
          />
        )}
      </TableCell>
    </TableRow>
  );
}

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
  onMoveCategory?: (group: CategoryItemGroup) => void;
  onAdjustStock?: (item: CategoryGroupedItem) => void;
  isAdmin?: boolean;
  isCollapsed?: boolean;
  onToggleCollapsed?: (familyName: string) => void;
  isDraggable?: boolean;
}

export function FamilyGroupCard({
  group, draftFamily, inlineEditFamily, editDrafts, editNewRows, savingInline,
  familySortDir, locations, allSkus, data,
  onEnterEdit, onCancelEdit, onSaveEdit, onAddRow,
  onUpdateDraft, onDeleteRow, onUpdateNewRow, onRemoveNewRow,
  onToggleSort, onOpenSettings, onMoveCategory, onAdjustStock, isAdmin,
  isCollapsed, onToggleCollapsed, isDraggable,
}: FamilyGroupCardProps) {
  const gid = getGroupId(group);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: gid,
    disabled: !isDraggable,
  });
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isDraftConfirmed = draftFamily?.confirmed && draftFamily.name === group.baseItemName;
  const isEditingThis = inlineEditFamily === gid;
  const sortDir = familySortDir[gid] ?? "asc";
  const sortedItems = sortItems(group.items, sortDir);

  // ── Part 1 fix: isAssetGroup purely based on trackingMode, never on category name ──
  const isAssetCategory = data.category.name === "TOOLS & ASSETS"; // kept only for InlineEditRow/InlineNewRow
  const isAssetGroup = group.items.some(i => i.trackingMode === "asset");

  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [expandedItemIds, setExpandedItemIds] = useState<Set<number>>(new Set());
  const toggleExpand = (itemId: number) => setExpandedItemIds(prev => {
    const next = new Set(prev);
    if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
    return next;
  });

  const collapseDisabled = isEditingThis || !!isDraftConfirmed;
  const effectivelyCollapsed = !collapseDisabled && !!isCollapsed;
  const handleToggleCollapsed = () => {
    if (collapseDisabled) return;
    onToggleCollapsed?.(gid);
  };

  const groupLowStock = group.items.filter(i => i.status === "low_stock").length;
  const groupOutOfStock = group.items.filter(i => i.status === "out_of_stock").length;

  const skusForNewRowCheck = new Set(allSkus);
  editNewRows.forEach(r => { if (r.sku.trim()) skusForNewRowCheck.add(r.sku.trim().toUpperCase()); });

  // ── Part 10: Convert all items in group to asset tracking ──────────────────
  const handleConvertToAsset = async () => {
    setIsConverting(true);
    try {
      await Promise.all(
        group.items.map(item =>
          apiRequest("PUT", `/api/items/${item.id}`, { trackingMode: "asset" })
        )
      );
      qc.invalidateQueries({ queryKey: ["/api/inventory/category"] });
      setShowConvertDialog(false);
      toast({ title: "Converted to Asset Tracking", description: `"${group.baseItemName}" items are now asset-tracked.` });
    } catch (err: any) {
      toast({ title: "Conversion failed", description: err?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div
      ref={isDraggable ? setNodeRef : undefined}
      style={isDraggable ? { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 } : undefined}
      className={`bg-white border rounded-xl overflow-hidden shadow-sm ${isDraftConfirmed ? "border-brand-300 border-2" : isEditingThis ? "border-amber-300 border-2" : "border-slate-200"}`}
      data-testid={`family-card-${group.baseItemName.replace(/\s+/g, "-")}`}
    >
      {/* Family card header */}
      <div className={`flex items-center justify-between px-5 border-b ${effectivelyCollapsed ? "border-b-0" : ""} min-h-[60px] ${isEditingThis ? "bg-amber-50/60 border-amber-200" : "border-slate-200 bg-slate-50/80"}`}>
        {isDraggable && !isEditingThis && (
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing mr-1 text-slate-300 hover:text-slate-500 shrink-0 touch-none select-none"
            title="Drag to reorder"
            data-testid={`drag-handle-${group.baseItemName.replace(/\s+/g, "-")}`}
          >
            <GripVertical className="w-4 h-4" />
          </div>
        )}
        <button
          type="button"
          onClick={handleToggleCollapsed}
          disabled={collapseDisabled}
          aria-expanded={!effectivelyCollapsed}
          aria-controls={!effectivelyCollapsed && !isEditingThis ? `family-table-${group.baseItemName.replace(/\s+/g, "-")}` : undefined}
          className={`flex items-center gap-3 py-3 flex-1 min-w-0 text-left ${collapseDisabled ? "cursor-default" : "cursor-pointer hover:opacity-90"}`}
          data-testid={`button-toggle-collapse-${group.baseItemName.replace(/\s+/g, "-")}`}
          title={collapseDisabled ? undefined : (effectivelyCollapsed ? "Click to expand" : "Click to collapse")}
        >
          <ChevronRight
            className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${effectivelyCollapsed ? "" : "rotate-90"} ${collapseDisabled ? "opacity-30" : ""}`}
            aria-hidden="true"
          />
          <div className="w-11 h-11 rounded-lg overflow-hidden bg-white border border-slate-200 flex items-center justify-center shrink-0">
            {group.representativeImage ? <img src={group.representativeImage} alt={group.baseItemName} className="w-full h-full object-cover" /> : <Package className="w-5 h-5 text-slate-300" />}
          </div>
          <div className="min-w-0 flex-1">
            {(() => {
              const mfr = group.manufacturerName?.trim() || group.items[0]?.manufacturer?.trim() || null;
              const cleanTitle = mfr
                ? group.baseItemName.replace(/^\[.*?\]\s*/, "").trim()
                : group.baseItemName;
              return (
                <h3
                  className="!text-base leading-snug truncate text-slate-900"
                  style={{ fontSize: "1rem" }}
                  data-testid={`family-title-${group.baseItemName.replace(/\s+/g, "-")}`}
                >
                  {mfr ? (
                    <><strong style={{ fontWeight: 700 }}>{mfr}</strong>{" "}<span style={{ fontWeight: 400 }}>{cleanTitle}</span></>
                  ) : (
                    <span style={{ fontWeight: 600 }}>{cleanTitle}</span>
                  )}
                </h3>
              );
            })()}
            <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider leading-none mt-0.5">
              {isAssetGroup
                ? <span className="text-violet-600 normal-case tracking-normal font-semibold">Asset tracked</span>
                : <>{group.items.length} {group.items.length === 1 ? "size" : "sizes"}</>
              }
              {isDraftConfirmed && <span className="ml-2 text-brand-500 normal-case tracking-normal">New family</span>}
              {isEditingThis && <span className="ml-2 text-amber-600 normal-case tracking-normal font-semibold">● Editing</span>}
            </p>
          </div>
        </button>

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
              {isAdmin && onMoveCategory && (
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 gap-1"
                  onClick={() => onMoveCategory(group)} disabled={!!inlineEditFamily}
                  data-testid={`button-move-category-${group.baseItemName.replace(/\s+/g, "-")}`} title="카테고리 이동">
                  <FolderInput className="w-3 h-3" />이동
                </Button>
              )}
              {/* Part 10: Convert to Asset Tracking — only for admins, only when no asset items yet */}
              {isAdmin && !isAssetGroup && group.items.length > 0 && (
                <Button variant="ghost" size="sm"
                  className="h-7 px-2 text-xs text-violet-600 hover:text-violet-800 hover:bg-violet-50 gap-1"
                  onClick={() => setShowConvertDialog(true)}
                  disabled={!!inlineEditFamily}
                  data-testid={`button-convert-asset-${group.baseItemName.replace(/\s+/g, "-")}`}
                  title="Convert to Asset Tracking"
                >
                  <Cpu className="w-3 h-3" />Asset
                </Button>
              )}
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

      {/* Items — edit mode or view mode */}
      {effectivelyCollapsed ? null : isEditingThis ? (
        <div className="overflow-x-auto">
          <Table style={{ tableLayout: "fixed", width: "100%", minWidth: "780px" }}>
            <colgroup>
              <col style={{ width: "100px" }} />
              <col style={{ width: "50px" }} />
              <col style={{ width: "100px" }} />
              <col style={{ width: "240px" }} />
              <col style={{ width: "84px" }} />
              <col style={{ width: "78px" }} />
              <col style={{ width: "140px" }} />
              <col style={{ width: "70px" }} />
            </colgroup>
            <TableHeader>
              <TableRow className="hover:bg-transparent bg-transparent border-b border-slate-100">
                <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-2 pl-5 text-center">SKU</TableHead>
                <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-2 text-center">Photo</TableHead>
                <TableHead className="py-2 text-center">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 uppercase tracking-wide">Size</span>
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-2 text-center">Item Name</TableHead>
                <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-2 text-center whitespace-nowrap" title="On Hand — current stock quantity">On Hand</TableHead>
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
                      locations={locations} onChange={patch => onUpdateDraft(item.id, patch)} onDelete={() => onDeleteRow(item.id)}
                      isAssetCategory={isAssetCategory} />
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
                  isAssetCategory={isAssetCategory}
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
        /* ── View mode: always show inventory table, then AssetPanels for asset items ── */
        <>
          <div className="overflow-x-auto" id={`family-table-${group.baseItemName.replace(/\s+/g, "-")}`}>
            <Table style={{ tableLayout: "fixed", width: "100%", minWidth: "750px" }}>
              <colgroup>
                <col style={{ width: "120px" }} />
                <col style={{ width: "55px" }} />
                <col style={{ width: "90px" }} />
                <col style={{ width: "260px" }} />
                <col style={{ width: "100px" }} />
                <col style={{ width: "110px" }} />
                <col style={{ width: "120px" }} />
              </colgroup>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-transparent border-b border-slate-100">
                  <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide h-9 pl-5 pr-2">SKU</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide h-9 px-2">Photo</TableHead>
                  <TableHead className="h-9 pl-2 pr-3">
                    {isAssetGroup ? (
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Size / Model</span>
                    ) : (
                      <button
                        onClick={() => onToggleSort(gid)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 uppercase tracking-wide hover:text-slate-600 transition-colors"
                        title={sortDir === "asc" ? "Sorted small→large (click for large→small)" : "Sorted large→small (click for small→large)"}
                        data-testid={`button-sort-size-${group.baseItemName.replace(/\s+/g, "-")}`}
                      >
                        Size
                        {sortDir === "asc"
                          ? <ArrowUp className="w-3 h-3 text-brand-500" />
                          : <ArrowDown className="w-3 h-3 text-brand-500" />}
                      </button>
                    )}
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide h-9 pl-2 pr-3">Item</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide h-9 px-2 text-right whitespace-nowrap" title="On Hand — current stock quantity">On Hand</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide h-9 px-3 text-center">{t.reorderColUsagePattern}</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide h-9 px-3 text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedItems.map(item => {
                  const isAsset = item.trackingMode === "asset";
                  const isExpanded = expandedItemIds.has(item.id);
                  return [
                    <TableRow
                      key={`item-${item.id}`}
                      onClick={isAsset ? () => toggleExpand(item.id) : undefined}
                      className={`transition-colors border-b border-slate-50 last:border-0
                        ${isAsset ? `cursor-pointer hover:bg-violet-50/50 select-none${isExpanded ? " bg-violet-50/30" : ""}` : `hover:bg-slate-50/70 ${item.status === "out_of_stock" ? "bg-red-50/20" : item.status === "low_stock" ? "bg-amber-50/20" : ""}`}`}
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
                          <Link
                            href={`/inventory/${item.id}`}
                            onClick={isAsset ? (e: React.MouseEvent) => e.stopPropagation() : undefined}
                            className="text-slate-700 text-sm hover:text-brand-600 hover:underline transition-colors block truncate"
                            data-testid={`link-item-name-${item.id}`}
                            title={item.name}
                          >{item.name}</Link>
                        </TableCell>
                        <TableCell className="h-10 px-2 text-right tabular-nums overflow-hidden">
                          <div className="flex items-center justify-end gap-1">
                            <span className="font-semibold text-slate-900 text-sm">{item.quantityOnHand.toLocaleString()}</span>
                            <span className="text-slate-400 font-normal text-[11px]">{item.unitOfMeasure}</span>
                            {isAdmin && onAdjustStock && (
                              <button
                                type="button"
                                onClick={e => { e.stopPropagation(); onAdjustStock(item); }}
                                disabled={!!inlineEditFamily}
                                className="ml-1 p-1 rounded text-slate-300 hover:text-brand-600 hover:bg-brand-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Adjust on-hand stock"
                                data-testid={`button-adjust-stock-${item.id}`}
                              >
                                <SlidersHorizontal className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="h-10 px-3 overflow-hidden">
                          <div className="flex items-center justify-center">
                            <UsagePatternBadge
                              issueCount30d={item.issueCount30d ?? 0}
                              issueCount90d={item.issueCount90d ?? item.issueCount30d ?? 0}
                              lastIssueAt={item.lastIssueAt}
                              testId={`chip-usage-pattern-${item.id}`}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="h-10 px-3 overflow-hidden">
                          <div className="flex items-center justify-center gap-1.5">
                            <ItemStatusBadge status={item.status} />
                            {isAsset && (
                              <ChevronRight className={`w-3.5 h-3.5 text-violet-400 flex-shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>,
                    isAsset && isExpanded
                      ? <AssetExpandedRow key={`expand-${item.id}`} itemId={item.id} colSpan={7} />
                      : null,
                  ];
                })}
                {group.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6 text-slate-400 text-sm">
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

        </>
      )}

      {/* Part 10: Convert to Asset Tracking confirmation dialog */}
      <Dialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-violet-600" />Convert to Asset Tracking?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm pt-1">
            <p className="text-slate-700">
              Convert all items in <strong>"{group.baseItemName}"</strong> to asset tracking mode.
            </p>
            <ul className="text-xs text-slate-500 space-y-1 list-disc list-inside">
              <li>Current quantities will not change</li>
              <li>Each item will get its own asset roster</li>
              <li>Asset IDs are <strong>not</strong> generated automatically — use "Generate Asset IDs" after</li>
            </ul>
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
              This action cannot be undone through the UI.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setShowConvertDialog(false)} disabled={isConverting}>
                Cancel
              </Button>
              <Button size="sm" className="bg-violet-700 hover:bg-violet-800"
                onClick={handleConvertToAsset}
                disabled={isConverting}
                data-testid={`button-confirm-convert-asset-${group.baseItemName.replace(/\s+/g, "-")}`}
              >
                {isConverting ? "Converting…" : "Convert to Asset Tracking"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
