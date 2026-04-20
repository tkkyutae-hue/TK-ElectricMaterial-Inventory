import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, Wand2, RotateCcw, Trash2 } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

type SkuItem = {
  id: number;
  sku: string;
  name: string;
  sizeLabel: string | null;
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

// ── SKU proposal ──────────────────────────────────────────────────────────

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
          충돌 {collisionCount}개
        </Badge>
        {changedCount > 0 && (
          <Badge variant="outline" className="text-xs text-brand-700 border-brand-300 bg-brand-50">
            변경 {changedCount}개
          </Badge>
        )}
        {familySelectedCount > 0 && (
          <Badge variant="outline" className="text-xs text-red-700 border-red-300 bg-red-50">
            {familySelectedCount}개 선택
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
                aria-label="패밀리 전체 선택"
              />
            </div>
            <div className="col-span-3">현재 SKU</div>
            <div className="col-span-5">새 SKU (직접 편집 가능)</div>
            <div className="col-span-3">아이템명</div>
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
                    aria-label={`${item.sku} 선택`}
                  />
                </div>

                <div className="col-span-3 flex items-center gap-2">
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

                <div className="col-span-5 flex items-center gap-1.5">
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
                      title="원래대로"
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
          {totalCollisions}개 수정 필요
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
              이 카테고리 자동 수정
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
      let succeeded = 0;
      let failed = 0;
      for (const id of ids) {
        try {
          await apiRequest("DELETE", `/api/items/${id}`);
          succeeded++;
        } catch {
          failed++;
        }
      }
      return { succeeded, failed };
    },
    onSuccess: ({ succeeded, failed }) => {
      if (succeeded > 0) {
        toast({
          title: "삭제 완료",
          description: `${succeeded}개 아이템이 삭제되었습니다.${failed > 0 ? ` (${failed}개 실패)` : ""}`,
        });
      }
      if (failed > 0 && succeeded === 0) {
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    );
  }

  if (!data?.categories.length) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-10 text-center">
        <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-800 mb-2">모든 SKU가 깔끔합니다!</h2>
        <p className="text-slate-500">충돌 접미사(-2, -3 등)가 있는 SKU가 없습니다.</p>
      </div>
    );
  }

  const totalFamilies = data.categories.reduce((s, c) => s + c.families.length, 0);
  const totalCollisions = allFamilies.reduce((s, f) => s + f.items.filter(i => i.isCollision).length, 0);

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">SKU 정리</h1>
        <p className="text-sm text-slate-500">
          충돌 접미사(-2, -3 등)가 붙은 SKU를 정리합니다. 새 SKU를 직접 수정하거나 자동 수정을 사용하세요.
        </p>
      </div>

      {/* Selection action bar — shown when items are selected */}
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
