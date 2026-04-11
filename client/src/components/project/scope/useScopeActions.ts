import { useState, useRef, type Dispatch, type SetStateAction } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ProjectScopeItem } from "@shared/schema";
import type { PendingRow, BundleRow } from "../types";

interface UseScopeActionsParams {
  projectId: number;
  scopeItems: ProjectScopeItem[];
  pendingRows: PendingRow[];
  setPendingRows: Dispatch<SetStateAction<PendingRow[]>>;
  setAddMode: Dispatch<SetStateAction<"none" | "multiple" | "bundle">>;
  selectedIds: Set<number>;
  setSelectedIds: Dispatch<SetStateAction<Set<number>>>;
  setVariantOpen: Dispatch<SetStateAction<number | null>>;
  setMovingItem: Dispatch<SetStateAction<number | null>>;
  patchMutateAsync: (args: { id: number; data: any }) => Promise<any>;
}

export function useScopeActions({
  projectId,
  scopeItems,
  pendingRows,
  setPendingRows,
  setAddMode,
  selectedIds,
  setSelectedIds,
  setVariantOpen,
  setMovingItem,
  patchMutateAsync,
}: UseScopeActionsParams) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [undoSnackbar, setUndoSnackbar] = useState<{ message: string; onUndo: () => void } | null>(null);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "scope-items"] });
    qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "progress"] });
  }

  function showUndoSnack(message: string, onUndo: () => void) {
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    setUndoSnackbar({ message, onUndo });
    undoTimeoutRef.current = setTimeout(() => setUndoSnackbar(null), 5500);
  }

  function dismissUndoSnackbar() {
    setUndoSnackbar(null);
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
  }

  async function saveMultiple() {
    const validRows = pendingRows.filter(r => r.itemName.trim() && r.unit.trim() && r.estimatedQty.trim());
    if (validRows.length === 0) {
      toast({ title: "Nothing to save", description: "Fill in at least Item Name, Unit, and Est. Qty.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      await Promise.all(validRows.map(row =>
        apiRequest("POST", `/api/projects/${projectId}/scope-items`, {
          itemName: row.itemName.trim(), unit: row.unit.trim(),
          estimatedQty: row.estimatedQty,
          category: row.category.trim() || null,
          remarks: row.remarks.trim() || null,
          linkedInventoryItemId: row.linkedInventoryItemId,
          scopeType: row.scopeType, isActive: true,
        })
      ));
      invalidate();
      toast({ title: `${validRows.length} scope item${validRows.length > 1 ? "s" : ""} saved` });
      setPendingRows([]);
      setAddMode("none");
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }

  async function saveBundle(rows: Omit<BundleRow, "localId" | "checked">[]) {
    setIsSaving(true);
    try {
      await Promise.all(rows.map(row =>
        apiRequest("POST", `/api/projects/${projectId}/scope-items`, {
          itemName: row.itemName.trim(), unit: row.unit.trim(),
          estimatedQty: row.estimatedQty || "0",
          category: row.category || null, scopeType: row.scopeType, isActive: true,
        })
      ));
      invalidate();
      toast({ title: `${rows.length} bundle item${rows.length !== 1 ? "s" : ""} added` });
      setAddMode("none");
    } catch (err: any) {
      toast({ title: "Bundle save failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }

  async function duplicateItem(item: ProjectScopeItem) {
    try {
      await apiRequest("POST", `/api/projects/${projectId}/scope-items`, {
        itemName: `${item.itemName} (Copy)`, unit: item.unit,
        estimatedQty: String(item.estimatedQty), category: item.category ?? null,
        remarks: item.remarks ?? null, linkedInventoryItemId: (item as any).linkedInventoryItemId ?? null,
        scopeType: (item as any).scopeType ?? "primary", isActive: item.isActive,
      });
      invalidate();
      toast({ title: "Item duplicated" });
    } catch (err: any) {
      toast({ title: "Duplicate failed", description: err.message, variant: "destructive" });
    }
  }

  async function saveVariants(item: ProjectScopeItem, ids: number[]) {
    await patchMutateAsync({ id: item.id, data: { acceptedVariants: ids } });
    setVariantOpen(null);
    toast({ title: "Variants saved" });
  }

  async function moveToCategory(item: ProjectScopeItem, category: string) {
    await patchMutateAsync({ id: item.id, data: { category } });
    setMovingItem(null);
  }

  async function deleteSelected() {
    const ids = [...selectedIds];
    const snapshot = scopeItems.filter(i => ids.includes(i.id));
    setSelectedIds(new Set());
    try {
      await Promise.all(ids.map(id => apiRequest("DELETE", `/api/scope-items/${id}`)));
      invalidate();
      showUndoSnack(
        `${ids.length} scope item${ids.length !== 1 ? "s" : ""} deleted`,
        async () => {
          try {
            await Promise.all(snapshot.map(item =>
              apiRequest("POST", `/api/projects/${projectId}/scope-items`, {
                itemName: item.itemName, unit: item.unit,
                estimatedQty: String(item.estimatedQty),
                category: item.category ?? null,
                remarks: item.remarks ?? null,
                linkedInventoryItemId: (item as any).linkedInventoryItemId ?? null,
                scopeType: (item as any).scopeType ?? "primary",
                isActive: item.isActive,
              })
            ));
            invalidate();
            setUndoSnackbar(null);
            toast({ title: `${snapshot.length} item${snapshot.length !== 1 ? "s" : ""} restored` });
          } catch (err: any) {
            toast({ title: "Undo failed", description: err.message, variant: "destructive" });
          }
        }
      );
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
  }

  return {
    isSaving,
    undoSnackbar,
    dismissUndoSnackbar,
    saveMultiple,
    saveBundle,
    duplicateItem,
    saveVariants,
    moveToCategory,
    deleteSelected,
  };
}
