import { useState } from "react";
import { FolderInput, AlertTriangle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { CategoryItemGroup, CategoryGroupedDetail } from "./types";

interface Category {
  id: number;
  name: string;
  code: string;
}

interface MoveCategoryDialogProps {
  open: boolean;
  onClose: () => void;
  categoryId: number;
  categoryName: string;
  group: CategoryItemGroup;
}

export function MoveCategoryDialog({ open, onClose, categoryId, categoryName, group }: MoveCategoryDialogProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [targetCategoryId, setTargetCategoryId] = useState<string>("");

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
    enabled: open,
  });

  const otherCategories = (categories ?? []).filter(c => c.id !== categoryId);
  const selectedCategory = otherCategories.find(c => String(c.id) === targetCategoryId);

  const { data: targetData, isLoading: checkingConflict } = useQuery<CategoryGroupedDetail>({
    queryKey: ["/api/inventory/category", targetCategoryId, "grouped"],
    queryFn: () => fetch(`/api/inventory/category/${targetCategoryId}/grouped`).then(r => r.json()),
    enabled: !!targetCategoryId,
  });

  const hasConflict = !!targetData && targetData.groups.some(g => g.baseItemName === group.baseItemName);

  const moveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/inventory/items/move-family-to-category", {
        fromCategoryId: categoryId,
        baseItemName: group.baseItemName,
        toCategoryId: Number(targetCategoryId),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? "이동 실패");
      }
      return res.json();
    },
    onSuccess: (data: { moved: number }) => {
      toast({
        title: "패밀리 이동 완료",
        description: `"${group.baseItemName}" (${data.moved}개 아이템) → ${selectedCategory?.name}`,
      });
      qc.invalidateQueries({ queryKey: ["/api/inventory/category", String(categoryId), "grouped"] });
      qc.invalidateQueries({ queryKey: ["/api/inventory/categories/summary"] });
      if (selectedCategory) {
        qc.invalidateQueries({ queryKey: ["/api/inventory/category", String(selectedCategory.id), "grouped"] });
      }
      qc.invalidateQueries({ queryKey: ["/api/field/families"] });
      onClose();
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "이동 실패";
      toast({ title: "이동 실패", description: msg, variant: "destructive" });
    },
  });

  const handleClose = () => {
    if (!moveMutation.isPending) {
      setTargetCategoryId("");
      moveMutation.reset();
      onClose();
    }
  };

  const canMove = !!targetCategoryId && !hasConflict && !checkingConflict && !moveMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-md w-[calc(100vw-2rem)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderInput className="w-4 h-4 text-brand-600" />
            패밀리 카테고리 이동
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">패밀리</span>
              <span className="font-semibold text-slate-900">{group.baseItemName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">아이템 수</span>
              <span className="font-semibold text-slate-900">{group.items.length}개</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">현재 카테고리</span>
              <span className="font-semibold text-slate-900">{categoryName}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">이동할 카테고리</label>
            <Select
              value={targetCategoryId}
              onValueChange={(val) => { setTargetCategoryId(val); moveMutation.reset(); }}
            >
              <SelectTrigger className="w-full" data-testid="select-target-category">
                <SelectValue placeholder="카테고리 선택…" />
              </SelectTrigger>
              <SelectContent>
                {otherCategories.map(c => (
                  <SelectItem key={c.id} value={String(c.id)} data-testid={`option-category-${c.id}`}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {targetCategoryId && checkingConflict && (
            <p className="text-xs text-slate-400">충돌 여부 확인 중…</p>
          )}

          {targetCategoryId && !checkingConflict && hasConflict && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800" data-testid="alert-move-conflict">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
              <span>
                <strong>{selectedCategory?.name}</strong> 카테고리에 이미 <strong>"{group.baseItemName}"</strong> 패밀리가 존재합니다. 다른 카테고리를 선택해 주세요.
              </span>
            </div>
          )}

          <p className="text-xs text-slate-500">
            이 패밀리의 모든 아이템(ID, 이동 이력, 프로젝트 연결 포함)이 선택한 카테고리로 이동됩니다.
          </p>

          <div className="flex justify-end gap-3 pt-1 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={handleClose} disabled={moveMutation.isPending}
              data-testid="button-cancel-move-category">
              취소
            </Button>
            <Button
              type="button"
              className="bg-brand-700 hover:bg-brand-800"
              onClick={() => moveMutation.mutate()}
              disabled={!canMove}
              data-testid="button-confirm-move-category"
            >
              {moveMutation.isPending ? "이동 중…" : "이동"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
