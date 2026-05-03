import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import { ToastAction } from "@/components/ui/toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Wand2,
  RotateCcw,
  Trash2,
  Cable,
  Info,
  ArrowRight,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

type SkuItem = {
  id: number;
  sku: string;
  name: string;
  sizeLabel: string | null;
  isActive: boolean;
  isCollision: boolean;
  cleanCandidate: string | null;
  cleanConflict: string | null;
  sizeLabelCount: number;
};

type SkuFamily = {
  baseItemName: string;
  items: SkuItem[];
};

type SkuCategory = {
  id: number;
  name: string;
  code: string;
  families: SkuFamily[];
};

type CableSkuPreviewItem = {
  id: number;
  currentSku: string;
  proposedSku: string;
  name: string;
  reason: string;
  hasConflict: boolean;
  alreadyClean: boolean;
  cannotParse: boolean;
};

// ── Color extraction ──────────────────────────────────────────────────────

const COLOR_MAP: Record<string, string> = {
  black: "BLK", brown: "BRN", red: "RED", blue: "BLU", orange: "ORG",
  yellow: "YEL", grey: "GRY", gray: "GRY", white: "WHT", green: "GRN",
  purple: "PUR", pink: "PNK", violet: "VLT",
};

function extractColorCode(name: string): string | null {
  const m = name.match(/\(([^)]+)\)/i);
  if (!m) return null;
  const raw = m[1].toLowerCase().trim();
  return COLOR_MAP[raw] ?? m[1].slice(0, 3).toUpperCase();
}

// ── SKU proposal (existing collision-fix logic) ───────────────────────────

function proposeSkus(family: SkuFamily): Map<number, string> {
  const proposals = new Map<number, string>();
  const usedInFamily = new Set<string>();

  for (const item of family.items) {
    if (!item.isCollision) {
      proposals.set(item.id, item.sku);
      usedInFamily.add(item.sku);
    }
  }

  for (const item of family.items) {
    if (!item.isCollision) continue;

    let proposed = item.sku;

    if (item.cleanCandidate && !item.cleanConflict) {
      if (!usedInFamily.has(item.cleanCandidate)) {
        proposed = item.cleanCandidate;
        usedInFamily.add(item.cleanCandidate);
      } else {
        const colorCode = extractColorCode(item.name);
        if (colorCode) {
          const colorSku = `${item.cleanCandidate}-${colorCode}`;
          if (!usedInFamily.has(colorSku)) {
            proposed = colorSku;
            usedInFamily.add(colorSku);
          }
        }
      }
    } else if (item.cleanConflict && item.sizeLabelCount > 1) {
      const colorCode = extractColorCode(item.name);
      if (colorCode && item.cleanCandidate) {
        const colorSku = `${item.cleanCandidate}-${colorCode}`;
        if (!usedInFamily.has(colorSku)) {
          proposed = colorSku;
          usedInFamily.add(colorSku);
        }
      }
    }

    proposals.set(item.id, proposed);
  }

  return proposals;
}

// ── Detect conflicts ──────────────────────────────────────────────────────

function detectConflicts(editMap: Map<number, string>): Set<number> {
  const countMap = new Map<string, number[]>();
  for (const [id, sku] of editMap.entries()) {
    const key = sku.toUpperCase();
    if (!countMap.has(key)) countMap.set(key, []);
    countMap.get(key)!.push(id);
  }

  const conflictIds = new Set<number>();
  for (const ids of countMap.values()) {
    if (ids.length > 1) ids.forEach(id => conflictIds.add(id));
  }

  return conflictIds;
}

// ── Family row ────────────────────────────────────────────────────────────

function FamilyRow({
  family,
  editMap,
  onEdit,
  conflictIds,
  onReset,
  selectedIds,
  onToggleSelect,
}: {
  family: SkuFamily;
  editMap: Map<number, string>;
  onEdit: (id: number, val: string) => void;
  conflictIds: Set<number>;
  onReset: (id: number) => void;
  selectedIds: Set<number>;
  onToggleSelect: (id: number, checked: boolean) => void;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(true);
  const collisionCount = family.items.filter(i => i.isCollision).length;
  const changedCount = family.items.filter(i => {
    const proposed = editMap.get(i.id);
    return proposed && proposed !== i.sku;
  }).length;

  const familySelectedCount = family.items.filter(i => selectedIds.has(i.id)).length;
  const allFamilySelected = family.items.length > 0 && familySelectedCount === family.items.length;
  const someFamilySelected = familySelectedCount > 0 && familySelectedCount < family.items.length;

  const handleFamilyCheckbox = (checked: boolean) => {
    for (const item of family.items) {
      onToggleSelect(item.id, checked);
    }
  };

  return (
    <div className="border border-slate-200 rounded-lg mb-2 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
        data-testid={`family-toggle-${family.baseItemName}`}
      >
        {open ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />}
        <span className="font-medium text-slate-800 flex-1 text-sm">{family.baseItemName}</span>
        <Badge variant="outline" className="text-xs text-amber-700 border-amber-300 bg-amber-50">
          {t.adminSkuFamilyCollisionBadge} {collisionCount}
        </Badge>
        {changedCount > 0 && (
          <Badge variant="outline" className="text-xs text-brand-700 border-brand-300 bg-brand-50">
            {t.adminSkuFamilyChangedBadge} {changedCount}
          </Badge>
        )}
        {familySelectedCount > 0 && (
          <Badge variant="outline" className="text-xs text-red-700 border-red-300 bg-red-50">
            {familySelectedCount} {t.adminSkuFamilySelectedBadge}
          </Badge>
        )}
      </button>

      {open && (
        <div className="divide-y divide-slate-100">
          <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-50/50 text-[10px] font-semibold text-slate-400 uppercase tracking-wider items-center">
            <div className="col-span-1 flex items-center">
              <Checkbox
                checked={allFamilySelected || (someFamilySelected ? "indeterminate" : false)}
                onCheckedChange={(v) => handleFamilyCheckbox(v === true)}
                data-testid={`chk-family-${family.baseItemName}`}
                aria-label={t.adminSkuFamilySelectAria}
              />
            </div>
            <div className="col-span-2">{t.adminSkuColCurrentSku}</div>
            <div className="col-span-4">{t.adminSkuColNewSku}</div>
            <div className="col-span-3">{t.adminSkuColItem}</div>
            <div className="col-span-2 text-center">{t.adminSkuColInventory}</div>
          </div>
          {family.items.map(item => {
            const proposed = editMap.get(item.id) ?? item.sku;
            const isChanged = proposed !== item.sku;
            const hasConflict = conflictIds.has(item.id);
            const isSelected = selectedIds.has(item.id);

            return (
              <div
                key={item.id}
                className={`grid grid-cols-12 gap-2 px-4 py-2.5 items-center text-sm ${
                  isSelected ? "bg-red-50/60" :
                  hasConflict ? "bg-red-50" :
                  isChanged ? "bg-brand-50/30" : ""
                }`}
                data-testid={`sku-row-${item.id}`}
              >
                <div className="col-span-1 flex items-center">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(v) => onToggleSelect(item.id, v === true)}
                    data-testid={`chk-item-${item.id}`}
                    aria-label={`${item.sku} ${t.adminSkuItemSelectAria}`}
                  />
                </div>

                <div className="col-span-2 flex items-center gap-2">
                  <code className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                    item.isCollision
                      ? "bg-amber-100 text-amber-800"
                      : "bg-slate-100 text-slate-600"
                  }`}>
                    {item.sku}
                  </code>
                  {item.isCollision && (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                  )}
                </div>

                <div className="col-span-4 flex items-center gap-1.5">
                  <Input
                    value={proposed}
                    onChange={e => onEdit(item.id, e.target.value.toUpperCase())}
                    className={`h-7 text-xs font-mono px-2 ${
                      hasConflict
                        ? "border-red-400 focus-visible:ring-red-400"
                        : isChanged
                        ? "border-brand-400 focus-visible:ring-brand-400"
                        : "border-transparent bg-transparent"
                    }`}
                    data-testid={`input-sku-${item.id}`}
                  />
                  {isChanged && (
                    <button
                      onClick={() => onReset(item.id)}
                      className="p-1 text-slate-400 hover:text-slate-600 flex-shrink-0"
                      title={t.adminSkuRevertTitle}
                      data-testid={`btn-reset-sku-${item.id}`}
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  )}
                  {hasConflict && (
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                  )}
                  {isChanged && !hasConflict && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                  )}
                </div>

                <div className="col-span-3 text-xs text-slate-500 truncate" title={item.name}>
                  {item.name}
                  {item.sizeLabel && <span className="ml-1 text-slate-400">({item.sizeLabel})</span>}
                </div>

                <div className="col-span-2 flex justify-center">
                  {item.isActive ? (
                    <Badge
                      variant="outline"
                      className="text-[10px] text-green-700 border-green-300 bg-green-50"
                      data-testid={`badge-active-${item.id}`}
                    >
                      {t.adminSkuActive}
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-[10px] text-slate-500 border-slate-300 bg-slate-100"
                      data-testid={`badge-inactive-${item.id}`}
                    >
                      {t.adminSkuInactive}
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Category section ──────────────────────────────────────────────────────

function CategorySection({
  category,
  editMap,
  onEdit,
  conflictIds,
  onReset,
  onAutoFix,
  selectedIds,
  onToggleSelect,
}: {
  category: SkuCategory;
  editMap: Map<number, string>;
  onEdit: (id: number, val: string) => void;
  conflictIds: Set<number>;
  onReset: (id: number) => void;
  onAutoFix: (families: SkuFamily[]) => void;
  selectedIds: Set<number>;
  onToggleSelect: (id: number, checked: boolean) => void;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(true);
  const totalCollisions = category.families.reduce((s, f) => s + f.items.filter(i => i.isCollision).length, 0);

  return (
    <div className="mb-6">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 mb-3 text-left group"
        data-testid={`cat-toggle-${category.id}`}
      >
        {open ? <ChevronDown className="w-5 h-5 text-slate-500 group-hover:text-slate-700" /> : <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-slate-700" />}
        <span className="font-semibold text-slate-900">{category.name}</span>
        <Badge className="text-xs bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100">
          {totalCollisions} {t.adminSkuCatNeedsFix}
        </Badge>
        <code className="text-xs text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
          {category.code}
        </code>
      </button>

      {open && (
        <div className="pl-2">
          <div className="flex justify-end mb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAutoFix(category.families)}
              className="gap-1.5 text-xs h-7"
              data-testid={`btn-autofix-cat-${category.id}`}
            >
              <Wand2 className="w-3 h-3" />
              {t.adminSkuCatAutoFix}
            </Button>
          </div>
          {category.families.map(family => (
            <FamilyRow
              key={family.baseItemName}
              family={family}
              editMap={editMap}
              onEdit={onEdit}
              conflictIds={conflictIds}
              onReset={onReset}
              selectedIds={selectedIds}
              onToggleSelect={onToggleSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Cable SKU Standardize Panel ───────────────────────────────────────────

function CableSkuPanel() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [showOnlyChanged, setShowOnlyChanged] = useState(true);
  const [cableEditMap, setCableEditMap] = useState<Map<number, string>>(new Map());
  const [cableSelectedIds, setCableSelectedIds] = useState<Set<number>>(new Set());
  const [cableInitialized, setCableInitialized] = useState(false);

  const { data, isLoading, refetch } = useQuery<{ items: CableSkuPreviewItem[] }>({
    queryKey: ["/api/admin/cable-sku-preview"],
  });

  useEffect(() => {
    if (!data || cableInitialized) return;
    const map = new Map<number, string>();
    for (const item of data.items) {
      map.set(item.id, item.proposedSku);
    }
    setCableEditMap(map);
    setCableInitialized(true);
  }, [data, cableInitialized]);

  const cableConflictIds = useMemo(() => detectConflicts(cableEditMap), [cableEditMap]);

  const displayItems = useMemo(() => {
    if (!data) return [];
    return data.items.filter(item => {
      if (showOnlyChanged) return !item.alreadyClean;
      return true;
    });
  }, [data, showOnlyChanged]);

  const changedCount = useMemo(() => {
    if (!data) return 0;
    return data.items.filter(i => {
      const proposed = cableEditMap.get(i.id);
      return proposed && proposed !== i.currentSku;
    }).length;
  }, [data, cableEditMap]);

  const selectedChanges = useMemo(() => {
    if (!data) return [];
    return data.items
      .filter(i => cableSelectedIds.has(i.id))
      .map(i => ({
        id: i.id,
        sku: cableEditMap.get(i.id) ?? i.proposedSku,
      }))
      .filter(u => {
        const original = data.items.find(i => i.id === u.id)?.currentSku;
        return u.sku !== original;
      });
  }, [data, cableSelectedIds, cableEditMap]);

  const handleCableEdit = (id: number, val: string) => {
    setCableEditMap(prev => new Map(prev).set(id, val));
  };

  const handleCableReset = (id: number) => {
    const item = data?.items.find(i => i.id === id);
    if (item) setCableEditMap(prev => new Map(prev).set(id, item.proposedSku));
  };

  const handleToggleCableSelect = useCallback((id: number, checked: boolean) => {
    setCableSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const handleSelectAllChanged = () => {
    if (!data) return;
    const changedItems = data.items.filter(i => !i.alreadyClean);
    const allSelected = changedItems.every(i => cableSelectedIds.has(i.id));
    if (allSelected) {
      setCableSelectedIds(new Set());
    } else {
      setCableSelectedIds(new Set(changedItems.map(i => i.id)));
    }
  };

  const cableSkuMutation = useMutation({
    mutationFn: async (updates: { id: number; sku: string }[]) => {
      const res = await apiRequest("PUT", "/api/admin/sku-bulk", { updates });
      return res.json() as Promise<{ updated: number }>;
    },
    onSuccess: (result) => {
      toast({
        title: t.adminSkuToastCableUpdateOk,
        description: `${result.updated} ${t.adminSkuToastCableUpdateOkDesc}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cable-sku-preview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sku-issues"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      setCableInitialized(false);
      setCableSelectedIds(new Set());
    },
    onError: (err: Error) => {
      toast({
        title: t.adminSkuToastUpdateFail,
        description: err.message ?? t.adminSkuToastUpdateFailDesc,
        variant: "destructive",
      });
    },
  });

  const handleApplySelected = () => {
    if (cableConflictIds.size > 0) {
      const conflictSelected = selectedChanges.some(u => cableConflictIds.has(u.id));
      if (conflictSelected) {
        toast({
          title: t.adminSkuToastConflicts,
          description: t.adminSkuToastConflictsDesc,
          variant: "destructive",
        });
        return;
      }
    }
    if (selectedChanges.length === 0) {
      toast({ title: t.adminSkuToastNoSelection, description: t.adminSkuToastNoSelectionDesc });
      return;
    }
    cableSkuMutation.mutate(selectedChanges);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    );
  }

  const totalItems = data?.items.length ?? 0;
  const needsChangeCount = data?.items.filter(i => !i.alreadyClean).length ?? 0;
  const conflictCount = data?.items.filter(i => i.hasConflict).length ?? 0;
  const cannotParseCount = data?.items.filter(i => i.cannotParse).length ?? 0;

  return (
    <div>
      {/* Legend */}
      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl mb-5">
        <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-blue-800 space-y-1">
          <p className="font-semibold">{t.adminSkuLegendTitle}</p>
          <p className="font-mono">
            <span className="bg-blue-100 px-1 rounded">O1</span> = 1/0 &nbsp;·&nbsp;
            <span className="bg-blue-100 px-1 rounded">O2</span> = 2/0 &nbsp;·&nbsp;
            <span className="bg-blue-100 px-1 rounded">O3</span> = 3/0 &nbsp;·&nbsp;
            <span className="bg-blue-100 px-1 rounded">O4</span> = 4/0
          </p>
          <p className="text-blue-700">
            {t.adminSkuLegendFormat} &nbsp;
            <span className="font-mono">WIRE-{"{size}"}[-{"{color}"}]</span> &nbsp;·&nbsp;
            <span className="font-mono">CABLE-{"{size}"}-{"{config}"}</span> &nbsp;·&nbsp;
            <span className="font-mono">GW-{"{size}"}</span>
          </p>
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl mb-4">
        <Cable className="w-5 h-5 text-slate-600 flex-shrink-0" />
        <div className="flex-1 text-sm text-slate-700 space-y-0.5">
          <div>
            <span className="font-semibold">{totalItems}</span> {t.adminSkuTotalCableItems} &nbsp;·&nbsp;
            <span className="font-semibold text-amber-700">{needsChangeCount}</span> {t.adminSkuNeedsChange}
            {conflictCount > 0 && (
              <span className="ml-2 text-red-600 font-medium">
                · {conflictCount} {t.adminSkuConflicts}
              </span>
            )}
            {cannotParseCount > 0 && (
              <span className="ml-2 text-slate-400">
                · {cannotParseCount} {t.adminSkuCannotParse}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="show-only-changed"
            checked={showOnlyChanged}
            onCheckedChange={setShowOnlyChanged}
            data-testid="toggle-show-changed"
          />
          <Label htmlFor="show-only-changed" className="text-xs text-slate-600 cursor-pointer">
            {t.adminSkuShowChangedOnly}
          </Label>
        </div>
      </div>

      {/* Selection + apply bar */}
      {cableSelectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-brand-50 border border-brand-200 rounded-xl mb-4">
          <CheckCircle2 className="w-4 h-4 text-brand-600 flex-shrink-0" />
          <span className="text-sm text-brand-800 flex-1">
            <span className="font-semibold">{cableSelectedIds.size}</span> {t.adminSkuItemsSelected}
            {selectedChanges.length > 0 && (
              <span className="ml-1 text-brand-600">({selectedChanges.length} {t.adminSkuChangePending})</span>
            )}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCableSelectedIds(new Set())}
            className="text-xs h-7 border-brand-200 text-brand-700 hover:bg-brand-100"
            data-testid="btn-cable-clear-selection"
          >
            {t.adminSkuClearSelection}
          </Button>
          <Button
            size="sm"
            onClick={handleApplySelected}
            disabled={cableSkuMutation.isPending || selectedChanges.length === 0}
            className="gap-1.5 text-xs"
            data-testid="btn-cable-apply-selected"
          >
            {cableSkuMutation.isPending ? (
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            {t.adminSkuApplySelected}
          </Button>
        </div>
      )}

      {/* Select all changed shortcut */}
      {needsChangeCount > 0 && cableSelectedIds.size === 0 && (
        <div className="flex justify-between items-center mb-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectAllChanged}
            className="gap-1.5 text-xs h-7"
            data-testid="btn-cable-select-all-changed"
          >
            <Wand2 className="w-3 h-3" />
            {t.adminSkuSelectAllChanged} ({needsChangeCount})
          </Button>
        </div>
      )}

      {/* Table */}
      {displayItems.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-3" />
          <p className="font-medium text-slate-700">{t.adminSkuAllStandard}</p>
          <p className="text-sm mt-1">{t.adminSkuAllStandardDesc}</p>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-50 text-[10px] font-semibold text-slate-400 uppercase tracking-wider items-center border-b border-slate-200">
            <div className="col-span-1">
              <Checkbox
                checked={
                  displayItems.filter(i => !i.alreadyClean).length > 0 &&
                  displayItems.filter(i => !i.alreadyClean).every(i => cableSelectedIds.has(i.id))
                    ? true
                    : displayItems.some(i => cableSelectedIds.has(i.id))
                    ? "indeterminate"
                    : false
                }
                onCheckedChange={(v) => {
                  displayItems.filter(i => !i.alreadyClean).forEach(i => handleToggleCableSelect(i.id, v === true));
                }}
                data-testid="chk-cable-all"
                aria-label={t.adminSkuSelectAllAria}
              />
            </div>
            <div className="col-span-3">{t.adminSkuColCurrentSku}</div>
            <div className="col-span-3">{t.adminSkuColStandardSku}</div>
            <div className="col-span-3">{t.adminSkuColItem}</div>
            <div className="col-span-2 text-center">{t.adminSkuColStatus}</div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-slate-100">
            {displayItems.map(item => {
              const proposed = cableEditMap.get(item.id) ?? item.proposedSku;
              const isChanged = proposed !== item.currentSku;
              const hasConflict = cableConflictIds.has(item.id) || (item.hasConflict && proposed === item.proposedSku);
              const isSelected = cableSelectedIds.has(item.id);
              const isEdited = proposed !== item.proposedSku;

              return (
                <div
                  key={item.id}
                  className={`grid grid-cols-12 gap-2 px-4 py-2.5 items-center text-sm ${
                    hasConflict ? "bg-red-50" :
                    isSelected ? "bg-brand-50/40" :
                    item.alreadyClean ? "opacity-60" :
                    isChanged ? "bg-green-50/30" : ""
                  }`}
                  data-testid={`cable-row-${item.id}`}
                >
                  <div className="col-span-1">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(v) => handleToggleCableSelect(item.id, v === true)}
                      disabled={item.alreadyClean && !isEdited}
                      data-testid={`chk-cable-${item.id}`}
                      aria-label={`${item.currentSku} ${t.adminSkuItemSelectAria}`}
                    />
                  </div>

                  <div className="col-span-3 flex items-center gap-1.5">
                    <code className="text-xs font-mono bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                      {item.currentSku}
                    </code>
                    {!item.alreadyClean && (
                      <ArrowRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
                    )}
                  </div>

                  <div className="col-span-3 flex items-center gap-1">
                    <Input
                      value={proposed}
                      onChange={e => handleCableEdit(item.id, e.target.value.toUpperCase())}
                      disabled={item.alreadyClean && !isEdited}
                      className={`h-7 text-xs font-mono px-2 ${
                        hasConflict
                          ? "border-red-400 focus-visible:ring-red-400"
                          : isChanged && !item.alreadyClean
                          ? "border-green-400 focus-visible:ring-green-400 bg-green-50"
                          : "border-transparent bg-transparent"
                      }`}
                      data-testid={`input-cable-sku-${item.id}`}
                    />
                    {isEdited && (
                      <button
                        onClick={() => handleCableReset(item.id)}
                        className="p-1 text-slate-400 hover:text-slate-600 flex-shrink-0"
                        title={t.adminSkuTooltipResetAuto}
                        data-testid={`btn-cable-reset-${item.id}`}
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <div className="col-span-3 text-xs text-slate-500 truncate" title={item.name}>
                    {item.name}
                  </div>

                  <div className="col-span-2 flex justify-center">
                    {item.cannotParse ? (
                      <Badge variant="outline" className="text-[10px] text-slate-500 border-slate-300">
                        {t.adminSkuStatusCannotParse}
                      </Badge>
                    ) : hasConflict ? (
                      <Badge variant="outline" className="text-[10px] text-red-700 border-red-300 bg-red-50 flex items-center gap-1">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        {t.adminSkuStatusConflict}
                      </Badge>
                    ) : item.alreadyClean ? (
                      <Badge variant="outline" className="text-[10px] text-green-700 border-green-300 bg-green-50">
                        {t.adminSkuStatusStandard}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300 bg-amber-50">
                        {t.adminSkuStatusNeedsChange}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function SkuCleanup() {
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{ categories: SkuCategory[] }>({
    queryKey: ["/api/admin/sku-issues"],
  });

  const [editMap, setEditMap] = useState<Map<number, string>>(new Map());
  const [initialized, setInitialized] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const allFamilies = useMemo(() => {
    return data?.categories.flatMap(c => c.families) ?? [];
  }, [data]);

  useEffect(() => {
    if (!data || initialized) return;
    const map = new Map<number, string>();
    for (const cat of data.categories) {
      for (const family of cat.families) {
        const proposals = proposeSkus(family);
        for (const [id, sku] of proposals.entries()) {
          map.set(id, sku);
        }
      }
    }
    setEditMap(map);
    setInitialized(true);
  }, [data, initialized]);

  const conflictIds = useMemo(() => detectConflicts(editMap), [editMap]);

  const handleEdit = (id: number, val: string) => {
    setEditMap(prev => new Map(prev).set(id, val));
  };

  const handleReset = (id: number) => {
    for (const fam of allFamilies) {
      const item = fam.items.find(i => i.id === id);
      if (item) {
        setEditMap(prev => new Map(prev).set(id, item.sku));
        return;
      }
    }
  };

  const handleAutoFix = (families: SkuFamily[]) => {
    setEditMap(prev => {
      const next = new Map(prev);
      for (const family of families) {
        const proposals = proposeSkus(family);
        for (const [id, sku] of proposals.entries()) {
          next.set(id, sku);
        }
      }
      return next;
    });
  };

  const handleAutoFixAll = () => {
    handleAutoFix(allFamilies);
  };

  const handleToggleSelect = useCallback((id: number, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const changesToSubmit = useMemo(() => {
    const changes: { id: number; sku: string }[] = [];
    for (const fam of allFamilies) {
      for (const item of fam.items) {
        const proposed = editMap.get(item.id);
        if (proposed && proposed !== item.sku) {
          changes.push({ id: item.id, sku: proposed });
        }
      }
    }
    return changes;
  }, [editMap, allFamilies]);

  // ── SKU bulk update mutation ──────────────────────────────────────────
  const skuMutation = useMutation({
    mutationFn: async (updates: { id: number; sku: string }[]) => {
      const res = await apiRequest("PUT", "/api/admin/sku-bulk", { updates });
      return res.json() as Promise<{ updated: number }>;
    },
    onSuccess: (result) => {
      toast({
        title: "SKU 업데이트 완료",
        description: `${result.updated}개 아이템의 SKU가 업데이트되었습니다.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sku-issues"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      setInitialized(false);
    },
    onError: (err: Error) => {
      toast({
        title: "업데이트 실패",
        description: err.message ?? "오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const handleApply = () => {
    if (conflictIds.size > 0) {
      toast({
        title: "충돌 SKU가 있습니다",
        description: "빨간색으로 표시된 SKU 충돌을 먼저 해결해주세요.",
        variant: "destructive",
      });
      return;
    }
    if (changesToSubmit.length === 0) {
      toast({ title: "변경사항 없음", description: "수정된 SKU가 없습니다." });
      return;
    }
    skuMutation.mutate(changesToSubmit);
  };

  // ── Delete mutation ───────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const succeededIds: number[] = [];
      let failed = 0;
      for (const id of ids) {
        try {
          await apiRequest("DELETE", `/api/items/${id}`);
          succeededIds.push(id);
        } catch {
          failed++;
        }
      }
      return { succeededIds, failed };
    },
    onSuccess: ({ succeededIds, failed }) => {
      if (succeededIds.length > 0) {
        const handleUndo = async (dismiss: () => void) => {
          dismiss();
          try {
            await apiRequest("POST", "/api/items/restore-batch", { ids: succeededIds });
            queryClient.invalidateQueries({ queryKey: ["/api/admin/sku-issues"] });
            queryClient.invalidateQueries({ queryKey: ["/api/items"] });
            setInitialized(false);
            toast({ title: "복구 완료", description: `${succeededIds.length}개 아이템이 복구되었습니다.` });
          } catch {
            toast({ title: "복구 실패", description: "아이템 복구에 실패했습니다.", variant: "destructive" });
          }
        };
        const { dismiss } = toast({
          title: "삭제 완료",
          description: `${succeededIds.length}개 아이템이 삭제되었습니다.${failed > 0 ? ` (${failed}개 실패)` : ""}`,
          duration: 8000,
          action: (
            <ToastAction altText="되돌리기" data-testid="toast-undo-delete" onClick={() => handleUndo(dismiss)}>
              되돌리기
            </ToastAction>
          ),
        });
      }
      if (failed > 0 && succeededIds.length === 0) {
        toast({
          title: "삭제 실패",
          description: "선택한 아이템을 삭제할 수 없습니다. 이동 내역이 있는 아이템은 삭제할 수 없습니다.",
          variant: "destructive",
        });
      }
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sku-issues"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
      setInitialized(false);
    },
    onError: () => {
      toast({
        title: "삭제 실패",
        description: "오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteConfirm = () => {
    setDeleteDialogOpen(false);
    deleteMutation.mutate(Array.from(selectedIds));
  };

  // Gather info about selected items for the dialog
  const selectedItems = useMemo(() => {
    const items: SkuItem[] = [];
    for (const fam of allFamilies) {
      for (const item of fam.items) {
        if (selectedIds.has(item.id)) items.push(item);
      }
    }
    return items;
  }, [selectedIds, allFamilies]);

  const totalFamilies = data?.categories.reduce((s, c) => s + c.families.length, 0) ?? 0;
  const totalCollisions = allFamilies.reduce((s, f) => s + f.items.filter(i => i.isCollision).length, 0);

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">SKU 정리</h1>
        <p className="text-sm text-slate-500">
          충돌 접미사 제거 및 케이블/전선 SKU 표준화를 진행합니다.
        </p>
      </div>

      <Tabs defaultValue="collision" className="w-full">
        <TabsList className="mb-6" data-testid="sku-tabs">
          <TabsTrigger value="collision" data-testid="tab-collision">
            충돌 SKU 정리
            {totalCollisions > 0 && (
              <Badge className="ml-2 text-[10px] bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100">
                {totalCollisions}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="cable" data-testid="tab-cable">
            <Cable className="w-3.5 h-3.5 mr-1.5" />
            케이블 SKU 표준화
          </TabsTrigger>
        </TabsList>

        {/* ─── Tab 1: Collision cleanup (existing) ─── */}
        <TabsContent value="collision">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
            </div>
          ) : !data?.categories.length ? (
            <div className="max-w-4xl mx-auto px-6 py-10 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-slate-800 mb-2">모든 SKU가 깔끔합니다!</h2>
              <p className="text-slate-500">충돌 접미사(-2, -3 등)가 있는 SKU가 없습니다.</p>
            </div>
          ) : (
            <>
              {/* Selection action bar */}
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl mb-4">
                  <Trash2 className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <span className="text-sm text-red-800 flex-1">
                    <span className="font-semibold">{selectedIds.size}개</span> 아이템 선택됨
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedIds(new Set())}
                    className="text-xs h-7 border-red-200 text-red-700 hover:bg-red-100"
                    data-testid="btn-clear-selection"
                  >
                    선택 해제
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setDeleteDialogOpen(true)}
                    disabled={deleteMutation.isPending}
                    className="gap-1.5 text-xs bg-red-600 hover:bg-red-700 text-white"
                    data-testid="btn-delete-selected"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    선택 삭제
                  </Button>
                </div>
              )}

              {/* Summary bar */}
              <div className="flex items-center gap-4 p-4 bg-amber-50 border border-amber-200 rounded-xl mb-6">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <div className="flex-1 text-sm text-amber-800">
                  <span className="font-semibold">{totalCollisions}개</span> SKU에 충돌 접미사 있음
                  (패밀리 {totalFamilies}개, 카테고리 {data.categories.length}개)
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAutoFixAll}
                  className="gap-1.5 text-xs border-amber-300 text-amber-800 hover:bg-amber-100"
                  data-testid="btn-autofix-all"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  전체 자동 수정
                </Button>
              </div>

              {/* Changes summary + apply */}
              {changesToSubmit.length > 0 && (
                <div className="flex items-center gap-3 p-3 bg-brand-50 border border-brand-200 rounded-xl mb-6">
                  <CheckCircle2 className="w-4 h-4 text-brand-600 flex-shrink-0" />
                  <span className="text-sm text-brand-800 flex-1">
                    <span className="font-semibold">{changesToSubmit.length}개</span> SKU 변경 예정
                    {conflictIds.size > 0 && (
                      <span className="ml-2 text-red-600 font-medium">
                        · 충돌 {conflictIds.size}개 해결 필요
                      </span>
                    )}
                  </span>
                  <Button
                    onClick={handleApply}
                    disabled={skuMutation.isPending || conflictIds.size > 0}
                    size="sm"
                    className="gap-1.5"
                    data-testid="btn-apply-all"
                  >
                    {skuMutation.isPending ? (
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    변경사항 적용
                  </Button>
                </div>
              )}

              {/* Category sections */}
              {data.categories.map(cat => (
                <CategorySection
                  key={cat.id}
                  category={cat}
                  editMap={editMap}
                  onEdit={handleEdit}
                  conflictIds={conflictIds}
                  onReset={handleReset}
                  onAutoFix={handleAutoFix}
                  selectedIds={selectedIds}
                  onToggleSelect={handleToggleSelect}
                />
              ))}
            </>
          )}
        </TabsContent>

        {/* ─── Tab 2: Cable SKU standardization (new) ─── */}
        <TabsContent value="cable">
          <CableSkuPanel />
        </TabsContent>
      </Tabs>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>아이템 삭제 확인</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  선택한 <strong>{selectedIds.size}개</strong> 아이템을 삭제합니다.
                  이 작업은 되돌릴 수 없습니다.
                </p>
                <ul className="max-h-48 overflow-y-auto space-y-1 text-sm border border-slate-200 rounded-md p-2 bg-slate-50">
                  {selectedItems.map(item => (
                    <li key={item.id} className="flex items-center gap-2">
                      <code className="text-xs font-mono bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                        {item.sku}
                      </code>
                      <span className="text-slate-600 truncate">{item.name}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-slate-500">
                  ※ 이동 내역(입출고 기록)이 있는 아이템은 삭제되지 않습니다.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="btn-delete-cancel">취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="btn-delete-confirm"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
