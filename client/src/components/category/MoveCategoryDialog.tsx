import { useState } from "react";
import { FolderInput, AlertTriangle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
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
  const { t } = useLanguage();
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
        throw new Error(body.message ?? t.catMoveFailedFallback);
      }
      return res.json();
    },
    onSuccess: (data: { moved: number }) => {
      toast({
        title: t.catMoveSuccessTitle,
        description: `"${group.baseItemName}" (${data.moved} ${t.catMoveItemsCountSuffix}) → ${selectedCategory?.name}`,
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
      const msg = err instanceof Error ? err.message : t.catMoveFailedFallback;
      toast({ title: t.catMoveFailedTitle, description: msg, variant: "destructive" });
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
            {t.catMoveTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">{t.catMoveFamilyLabel}</span>
              <span className="font-semibold text-slate-900">{group.baseItemName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">{t.catMoveItemCountLbl}</span>
              <span className="font-semibold text-slate-900">{group.items.length} {t.catMoveItemsCountSuffix}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">{t.catMoveCurrent}</span>
              <span className="font-semibold text-slate-900">{categoryName}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">{t.catMoveTarget}</label>
            <Select
              value={targetCategoryId}
              onValueChange={(val) => { setTargetCategoryId(val); moveMutation.reset(); }}
            >
              <SelectTrigger className="w-full" data-testid="select-target-category">
                <SelectValue placeholder={t.catMoveSelectPh} />
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
            <p className="text-xs text-slate-400">{t.catMoveCheckingConflict}</p>
          )}

          {targetCategoryId && !checkingConflict && hasConflict && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800" data-testid="alert-move-conflict">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
              <span>
                <strong>{selectedCategory?.name}</strong> {t.catMoveConflictPrefix} <strong>"{group.baseItemName}"</strong> {t.catMoveConflictSuffix}
              </span>
            </div>
          )}

          <p className="text-xs text-slate-500">
            {t.catMoveDescription}
          </p>

          <div className="flex justify-end gap-3 pt-1 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={handleClose} disabled={moveMutation.isPending}
              data-testid="button-cancel-move-category">
              {t.cmnCancel}
            </Button>
            <Button
              type="button"
              className="bg-brand-700 hover:bg-brand-800"
              onClick={() => moveMutation.mutate()}
              disabled={!canMove}
              data-testid="button-confirm-move-category"
            >
              {moveMutation.isPending ? t.catMoveInProgress : t.catMoveAction}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
