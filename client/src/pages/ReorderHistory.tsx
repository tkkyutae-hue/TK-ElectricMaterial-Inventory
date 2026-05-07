import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ChevronDown, ChevronRight, Download, Eye, GripVertical, Loader2, Package, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { RmsExportHistory, RmsExportHistoryWithLines, RmsExportHistoryItem, ItemWithRelations } from "@shared/schema";

type HistoryLine = RmsExportHistoryItem & { itemImageUrl: string | null };

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function safeJson<T = unknown>(res: Response): Promise<T> {
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    const text = await res.text().catch(() => "");
    throw new Error(`Unexpected response (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

function buildRmsFilename(poNumber?: string | null, poSeq?: number | null): string {
  if (poSeq == null) return "—";
  const safe = (s: string) => (s || "").replace(/[\\/:*?"<>|]/g, "_").trim();
  const poPart = safe(poNumber || "");
  const seqStr = String(poSeq).padStart(4, "0");
  return poPart ? `RMS-${poPart}-${seqStr}.xlsx` : `RMS-${seqStr}.xlsx`;
}

function formatDateTime(value?: string | Date | null): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

const editSchema = z.object({
  requestFrom: z.string().trim().max(255).optional(),
  poNumber: z.string().trim().max(255).optional(),
  projectName: z.string().trim().max(255).optional(),
  completionDate: z.string().trim().max(64).optional(),
  deliveryTo: z.string().trim().max(255).optional(),
});
type EditFormValues = z.infer<typeof editSchema>;

type EditableLine = HistoryLine & { _qty: number };

function ItemThumb({ imageUrl, name }: { imageUrl?: string | null; name?: string | null }) {
  return imageUrl ? (
    <img src={imageUrl} alt={name ?? ""} className="w-9 h-9 rounded object-cover border border-slate-200 shrink-0" />
  ) : (
    <div className="w-9 h-9 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-300 shrink-0">
      <Package className="w-3.5 h-3.5" />
    </div>
  );
}

function SortableItemRow({
  line,
  index,
  onQtyChange,
  onDelete,
}: {
  line: EditableLine;
  index: number;
  onQtyChange: (id: number, qty: number) => void;
  onDelete: (id: number) => void;
}) {
  const { t } = useLanguage();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: line.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <tr
      ref={setNodeRef}
      style={style}
      className="border-t border-slate-100 bg-white"
      data-testid={`row-pending-line-${line.id}`}
    >
      <td
        className="px-2 py-2 text-slate-300 cursor-grab active:cursor-grabbing touch-none"
        {...listeners}
        {...attributes}
      >
        <GripVertical className="w-4 h-4" />
      </td>
      <td className="px-2 py-2 text-slate-400 tabular-nums text-right w-8 text-xs">{index + 1}</td>
      <td className="px-2 py-2 w-12">
        <ItemThumb imageUrl={line.itemImageUrl} name={line.nameSnapshot} />
      </td>
      <td className="px-2 py-2 text-xs text-slate-500 w-24">{line.sizeSnapshot || "—"}</td>
      <td className="px-2 py-2 text-sm text-slate-800">{line.nameSnapshot || "—"}</td>
      <td className="px-2 py-2 text-xs text-slate-400 text-right tabular-nums w-16">
        {line.onHandSnapshot ?? "—"}
      </td>
      <td className="px-2 py-2 text-right w-24">
        <Input
          type="number"
          min={0}
          className="h-8 text-right w-20 ml-auto text-sm"
          value={line._qty}
          onChange={e => onQtyChange(line.id, Number(e.target.value))}
          onPointerDown={e => e.stopPropagation()}
          data-testid={`input-pending-qty-${line.id}`}
        />
      </td>
      <td className="px-2 py-2 text-xs text-slate-500 w-16">{line.unitSnapshot || "—"}</td>
      <td className="px-2 py-1 w-8">
        <button
          type="button"
          onClick={() => onDelete(line.id)}
          onPointerDown={e => e.stopPropagation()}
          title={t.reorderHistoryDeleteItemTip}
          className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
          data-testid={`button-delete-line-${line.id}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
}

function OverlayItemRow({ line, index }: { line: EditableLine; index: number }) {
  return (
    <tr className="border border-slate-200 bg-white shadow-lg">
      <td className="px-2 py-2 text-slate-300"><GripVertical className="w-4 h-4" /></td>
      <td className="px-2 py-2 text-slate-400 tabular-nums text-right w-8 text-xs">{index + 1}</td>
      <td className="px-2 py-2 w-12"><ItemThumb imageUrl={line.itemImageUrl} name={line.nameSnapshot} /></td>
      <td className="px-2 py-2 text-xs text-slate-500 w-24">{line.sizeSnapshot || "—"}</td>
      <td className="px-2 py-2 text-sm text-slate-800">{line.nameSnapshot || "—"}</td>
      <td className="px-2 py-2 text-xs text-slate-400 text-right tabular-nums w-16">{line.onHandSnapshot ?? "—"}</td>
      <td className="px-2 py-2 text-right w-24">
        <div className="h-8 w-20 ml-auto border rounded text-right px-2 flex items-center justify-end text-sm">{line._qty}</div>
      </td>
      <td className="px-2 py-2 text-xs text-slate-500 w-16">{line.unitSnapshot || "—"}</td>
      <td className="px-2 py-1 w-8" />
    </tr>
  );
}

function PendingInlineEditor({ historyId, onDownloaded }: { historyId: number; onDownloaded: () => void }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [headerFields, setHeaderFields] = useState({ requestFrom: "", poNumber: "", projectName: "", deliveryTo: "" });
  const tableRef = useRef<HTMLTableElement>(null);

  // ── Add-item panel state (multi-select) ──────────────────────────────────
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [addSearch, setAddSearch] = useState("");
  const [addDebouncedSearch, setAddDebouncedSearch] = useState("");
  // Map<itemId, { item, qty }>
  const [addChecked, setAddChecked] = useState<Map<number, { item: ItemWithRelations; qty: number }>>(new Map());
  const addSearchRef = useRef<HTMLInputElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, []);

  const handleAddSearchChange = useCallback((val: string) => {
    setAddSearch(val);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setAddDebouncedSearch(val), 300);
  }, []);

  const searchItemsQuery = useQuery<ItemWithRelations[]>({
    queryKey: ["/api/items", { search: addDebouncedSearch }],
    queryFn: () => fetchJson<ItemWithRelations[]>(`/api/items?search=${encodeURIComponent(addDebouncedSearch)}&perPage=20`),
    enabled: addDebouncedSearch.length >= 1,
    staleTime: 10_000,
  });

  const toggleAddItem = (item: ItemWithRelations) => {
    setAddChecked(prev => {
      const next = new Map(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.set(item.id, { item, qty: item.reorderQuantity && item.reorderQuantity > 0 ? item.reorderQuantity : 1 });
      }
      return next;
    });
  };

  const updateAddQty = (itemId: number, qty: number) => {
    setAddChecked(prev => {
      const entry = prev.get(itemId);
      if (!entry) return prev;
      const next = new Map(prev);
      next.set(itemId, { ...entry, qty: Math.max(0, qty) });
      return next;
    });
  };

  const resetAddPanel = () => {
    setShowAddPanel(false);
    setAddSearch("");
    setAddDebouncedSearch("");
    setAddChecked(new Map());
  };

  const addBatchMutation = useMutation({
    mutationFn: async () => {
      const items = Array.from(addChecked.values()).map(({ item, qty }) => ({
        itemId: item.id,
        nameSnapshot: item.name,
        sizeSnapshot: item.sizeLabel ?? undefined,
        unitSnapshot: item.unitOfMeasure ?? undefined,
        onHandSnapshot: item.quantityOnHand ?? undefined,
        qty,
      }));
      const res = await fetch(`/api/reorder/history/${historyId}/items/add-batch`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `HTTP ${res.status}`);
      }
      return safeJson<RmsExportHistoryWithLines>(res);
    },
    onSuccess: (data) => {
      const sorted = [...data.lines].sort((a, b) => a.sortOrder - b.sortOrder);
      setLines(sorted.map(l => ({ ...l, _qty: l.qty })));
      queryClient.invalidateQueries({ queryKey: ["/api/reorder/history"] });
      resetAddPanel();
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: t.cmnSaveFailed, description: err.message });
    },
  });

  // Map from itemId → { line snapshot, original index } so concurrent deletes don't cross-wire
  const pendingDeletesRef = useRef<Map<number, { line: EditableLine; index: number }>>(new Map());

  const undoDeleteMutation = useMutation({
    mutationFn: async ({ line, index }: { line: EditableLine; index: number }) => {
      const res = await fetch(`/api/reorder/history/${historyId}/items/add-batch`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{
            itemId: line.itemId ?? undefined,
            nameSnapshot: line.nameSnapshot ?? "",
            sizeSnapshot: line.sizeSnapshot ?? undefined,
            unitSnapshot: line.unitSnapshot ?? undefined,
            onHandSnapshot: line.onHandSnapshot ?? undefined,
            qty: line._qty,
          }],
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `HTTP ${res.status}`);
      }
      const data = await safeJson<RmsExportHistoryWithLines>(res);
      return { data, index };
    },
    onSuccess: async ({ data, index }) => {
      // Server always appends the re-added row at the end (highest sortOrder).
      // We need to move it back to the captured original index, then persist.
      const sorted = [...data.lines].sort((a, b) => a.sortOrder - b.sortOrder);
      const newItem = sorted[sorted.length - 1]; // last = just re-added
      const rest = sorted.filter(l => l.id !== newItem.id);
      const clampedIndex = Math.min(index, rest.length);
      rest.splice(clampedIndex, 0, newItem);
      const editableLines = rest.map(l => ({ ...l, _qty: l.qty }));
      setLines(editableLines);

      // Persist the restored sort order so a page refresh keeps it
      try {
        const patchRes = await fetch(`/api/reorder/history/${historyId}/items`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: editableLines.map((l, i) => ({ id: l.id, qty: l._qty, sortOrder: i })),
          }),
        });
        if (!patchRes.ok) {
          toast({ description: t.reorderHistoryItemsUpdated + " (order not saved)", duration: 4000 });
        }
      } catch {
        // Non-critical — row is restored in DB, only sort order may revert on refresh
      }
      queryClient.invalidateQueries({ queryKey: ["/api/reorder/history"] });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: t.cmnSaveFailed, description: err.message });
    },
  });

  const deleteLineMutation = useMutation({
    mutationFn: async (itemId: number) => {
      const res = await fetch(`/api/reorder/history/${historyId}/items/${itemId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `HTTP ${res.status}`);
      }
      return itemId;
    },
    onSuccess: (itemId) => {
      const captured = pendingDeletesRef.current.get(itemId);
      pendingDeletesRef.current.delete(itemId);
      setLines(prev => prev.filter(l => l.id !== itemId));
      queryClient.invalidateQueries({ queryKey: ["/api/reorder/history"] });
      if (captured) {
        const { dismiss } = toast({
          title: t.reorderRmsRowRemoved,
          duration: 5000,
          action: (
            <ToastAction
              altText={t.undoMovement}
              data-testid={`toast-undo-line-delete-${itemId}`}
              onClick={() => {
                undoDeleteMutation.mutate(captured);
                dismiss();
              }}
            >
              {t.undoMovement}
            </ToastAction>
          ),
        });
      }
    },
    onError: (err: Error, itemId: number) => {
      pendingDeletesRef.current.delete(itemId);
      toast({ variant: "destructive", title: t.cmnDeleteFailed, description: err.message });
    },
  });

  const handleDeleteLine = useCallback((id: number) => {
    setLines(prev => {
      const index = prev.findIndex(l => l.id === id);
      if (index >= 0) {
        pendingDeletesRef.current.set(id, { line: prev[index], index });
      }
      return prev;
    });
    deleteLineMutation.mutate(id);
  }, [deleteLineMutation]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const detailQuery = useQuery<RmsExportHistoryWithLines>({
    queryKey: ["/api/reorder/history", historyId],
    queryFn: () => fetchJson<RmsExportHistoryWithLines>(`/api/reorder/history/${historyId}`),
  });

  useEffect(() => {
    if (detailQuery.data) {
      const sorted = [...detailQuery.data.lines].sort((a, b) => a.sortOrder - b.sortOrder);
      setLines(sorted.map(l => ({ ...l, _qty: l.qty })));
      setHeaderFields({
        requestFrom: detailQuery.data.requestFrom ?? "",
        poNumber: detailQuery.data.poNumber ?? "",
        projectName: detailQuery.data.projectName ?? "",
        deliveryTo: detailQuery.data.deliveryTo ?? "",
      });
    }
  }, [detailQuery.data]);

  const patchHeader = async () => {
    const payload: Record<string, string | null> = {
      requestFrom: headerFields.requestFrom.trim() || null,
      poNumber: headerFields.poNumber.trim() || null,
      projectName: headerFields.projectName.trim() || null,
      deliveryTo: headerFields.deliveryTo.trim() || null,
    };
    const res = await fetch(`/api/reorder/history/${historyId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Header update failed: HTTP ${res.status}`);
  };

  const setHeader = (key: keyof typeof headerFields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setHeaderFields(prev => ({ ...prev, [key]: e.target.value }));

  const activeRow = activeId != null ? lines.find(l => l.id === activeId) ?? null : null;

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as number);
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setLines(prev => {
      const oldIdx = prev.findIndex(l => l.id === active.id);
      const newIdx = prev.findIndex(l => l.id === over.id);
      if (oldIdx < 0 || newIdx < 0) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  };

  const updateQty = (id: number, qty: number) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, _qty: Number.isFinite(qty) ? qty : 0 } : l));
  };

  const saveItemsMutation = useMutation({
    mutationFn: async () => {
      await patchHeader();
      const res = await fetch(`/api/reorder/history/${historyId}/items`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map((l, i) => ({ id: l.id, qty: l._qty, sortOrder: i })),
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `HTTP ${res.status}`);
      }
      return safeJson(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reorder/history"] });
      toast({ description: t.reorderHistoryItemsUpdated });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: t.cmnSaveFailed, description: err.message });
    },
  });

  const downloadMutation = useMutation({
    mutationFn: async () => {
      await patchHeader();
      const saveRes = await fetch(`/api/reorder/history/${historyId}/items`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map((l, i) => ({ id: l.id, qty: l._qty, sortOrder: i })),
        }),
      });
      if (!saveRes.ok) throw new Error(`Save failed: HTTP ${saveRes.status}`);
      const dlRes = await fetch(`/api/reorder/history/${historyId}/download`, {
        method: "POST",
        credentials: "include",
      });
      if (!dlRes.ok) throw new Error(`Download failed: HTTP ${dlRes.status}`);
      const blob = await dlRes.blob();
      const cd = dlRes.headers.get("Content-Disposition") || "";
      const m = /filename="([^"]+)"/.exec(cd);
      return { blob, filename: m?.[1] || "RMS.xlsx" };
    },
    onSuccess: ({ blob, filename }) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      queryClient.invalidateQueries({ queryKey: ["/api/reorder/history"] });
      toast({ description: t.reorderHistoryDownloadSuccess });
      onDownloaded();
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: t.reorderHistoryDownloadError, description: err.message });
    },
  });

  if (detailQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 px-4 text-slate-400 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> {t.cmnLoading}
      </div>
    );
  }

  return (
    <div className="border-t border-amber-200 bg-amber-50/40 px-4 py-3 space-y-3">
      <p className="text-xs text-amber-700 font-medium">{t.reorderHistoryPendingBanner}</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="space-y-1">
          <label className="text-xs text-slate-500">{t.reorderRmsRequester}</label>
          <Input
            value={headerFields.requestFrom}
            onChange={setHeader("requestFrom")}
            className="h-8 text-sm"
            data-testid={`input-pending-requester-${historyId}`}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-500">{t.reorderHistoryColPo}</label>
          <Input
            value={headerFields.poNumber}
            onChange={setHeader("poNumber")}
            className="h-8 text-sm"
            data-testid={`input-pending-po-${historyId}`}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-500">{t.reorderHistoryColProject}</label>
          <Input
            value={headerFields.projectName}
            onChange={setHeader("projectName")}
            className="h-8 text-sm"
            data-testid={`input-pending-project-${historyId}`}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-500">{t.reorderHistoryColDelivery}</label>
          <Input
            value={headerFields.deliveryTo}
            onChange={setHeader("deliveryTo")}
            className="h-8 text-sm"
            data-testid={`input-pending-delivery-${historyId}`}
          />
        </div>
      </div>

      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <table ref={tableRef} className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs">
                <tr>
                  <th className="w-8 px-2 py-2" />
                  <th className="w-8 text-right px-2 py-2">#</th>
                  <th className="w-12 px-2 py-2">{t.reorderRmsPhoto}</th>
                  <th className="text-left px-2 py-2">{t.reorderRmsSize}</th>
                  <th className="text-left px-2 py-2">{t.reorderRmsItem}</th>
                  <th className="text-right px-2 py-2 w-16">{t.reorderColOnHand}</th>
                  <th className="text-right px-2 py-2 w-24">{t.reorderRmsQty}</th>
                  <th className="text-left px-2 py-2 w-16">{t.reorderRmsUnit}</th>
                  <th className="w-8 px-2 py-2" />
                </tr>
              </thead>
              <SortableContext items={lines.map(l => l.id)} strategy={verticalListSortingStrategy}>
                <tbody>
                  {lines.map((line, i) => (
                    <SortableItemRow key={line.id} line={line} index={i} onQtyChange={updateQty} onDelete={handleDeleteLine} />
                  ))}
                </tbody>
              </SortableContext>
              <DragOverlay>
                {activeRow && (
                  <table className="text-sm" style={{ width: tableRef.current?.offsetWidth }}>
                    <tbody>
                      <OverlayItemRow line={activeRow} index={lines.findIndex(l => l.id === activeRow.id)} />
                    </tbody>
                  </table>
                )}
              </DragOverlay>
            </table>
          </DndContext>
        </div>
      </div>

      {/* ── Multi-select add panel ───────────────────────────────────────── */}
      {showAddPanel ? (
        <div className="border border-slate-200 rounded-lg bg-white p-3 space-y-3" data-testid={`panel-additem-${historyId}`}>
          <p className="text-xs font-medium text-slate-600">{t.reorderHistoryAddItem}</p>

          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <Input
              ref={addSearchRef}
              value={addSearch}
              onChange={e => handleAddSearchChange(e.target.value)}
              placeholder={t.reorderHistoryAddItemSearch}
              className="h-8 text-sm pl-8"
              data-testid={`input-additem-search-${historyId}`}
            />
          </div>

          {/* Search results */}
          {addDebouncedSearch.length >= 1 && (
            <div className="border border-slate-200 rounded-md overflow-hidden max-h-56 overflow-y-auto min-w-[400px]">
              {searchItemsQuery.isLoading ? (
                <div className="flex items-center gap-2 px-3 py-3 text-xs text-slate-400">
                  <Loader2 className="w-3 h-3 animate-spin" /> {t.cmnLoading}
                </div>
              ) : (searchItemsQuery.data ?? []).length === 0 ? (
                <div className="px-3 py-3 text-xs text-slate-400">—</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="w-8 px-2 py-1.5" />
                      <th className="w-10 px-2 py-1.5">{t.reorderRmsPhoto}</th>
                      <th className="text-left px-2 py-1.5 w-28">{t.reorderRmsSize}</th>
                      <th className="text-left px-2 py-1.5">{t.reorderRmsItem}</th>
                      <th className="text-right px-2 py-1.5 w-20">{t.reorderColOnHand}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(searchItemsQuery.data ?? []).map(item => {
                      const checked = addChecked.has(item.id);
                      return (
                        <tr
                          key={item.id}
                          onClick={() => toggleAddItem(item)}
                          className={`border-t border-slate-100 cursor-pointer hover:bg-blue-50 transition-colors ${checked ? "bg-blue-50" : "bg-white"}`}
                          data-testid={`row-additem-${item.id}`}
                        >
                          <td className="px-2 py-2">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => toggleAddItem(item)}
                              onClick={e => e.stopPropagation()}
                              data-testid={`check-additem-${item.id}`}
                            />
                          </td>
                          <td className="px-2 py-2 w-10">
                            <ItemThumb imageUrl={item.imageUrl ?? null} name={item.name} />
                          </td>
                          <td className="px-2 py-2 text-xs text-slate-500 w-28">{item.sizeLabel || "—"}</td>
                          <td className="px-2 py-2 text-sm text-slate-800">{item.name}</td>
                          <td className={`px-2 py-2 text-xs text-right tabular-nums w-20 ${(item.quantityOnHand ?? 0) <= 0 ? "text-red-500" : "text-slate-400"}`}>
                            {item.quantityOnHand ?? 0} {item.unitOfMeasure || ""}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Selected items table */}
          {addChecked.size > 0 && (
            <div className="border border-blue-200 rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-blue-50 text-blue-700 text-xs border-b border-blue-200">
                  <tr>
                    <th className="w-10 px-2 py-1.5">{t.reorderRmsPhoto}</th>
                    <th className="text-left px-2 py-1.5 w-28">{t.reorderRmsSize}</th>
                    <th className="text-left px-2 py-1.5">{t.reorderRmsItem}</th>
                    <th className="text-right px-2 py-1.5 w-20">{t.reorderColOnHand}</th>
                    <th className="text-right px-2 py-1.5 w-24">{t.reorderRmsQty}</th>
                    <th className="text-left px-2 py-1.5 w-16">{t.reorderRmsUnit}</th>
                    <th className="w-8 px-2 py-1.5" />
                  </tr>
                </thead>
                <tbody>
                  {Array.from(addChecked.values()).map(({ item, qty }) => (
                    <tr key={item.id} className="border-t border-blue-100 bg-white">
                      <td className="px-2 py-1.5 w-10">
                        <ItemThumb imageUrl={item.imageUrl ?? null} name={item.name} />
                      </td>
                      <td className="px-2 py-1.5 text-xs text-slate-500 w-28">{item.sizeLabel || "—"}</td>
                      <td className="px-2 py-1.5 text-sm text-slate-800">{item.name}</td>
                      <td className={`px-2 py-1.5 text-xs text-right tabular-nums w-20 ${(item.quantityOnHand ?? 0) <= 0 ? "text-red-500" : "text-slate-400"}`}>
                        {item.quantityOnHand ?? 0}
                      </td>
                      <td className="px-2 py-1.5 text-right w-24">
                        <Input
                          type="number"
                          min={0}
                          value={qty}
                          onChange={e => updateAddQty(item.id, Number(e.target.value))}
                          className="h-7 text-right w-20 ml-auto text-sm"
                          data-testid={`input-additem-qty-${item.id}`}
                        />
                      </td>
                      <td className="px-2 py-1.5 text-xs text-slate-500 w-16">{item.unitOfMeasure || "—"}</td>
                      <td className="px-2 py-1.5 w-8">
                        <button
                          type="button"
                          onClick={() => toggleAddItem(item)}
                          className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                          data-testid={`button-additem-remove-${item.id}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={resetAddPanel}
              disabled={addBatchMutation.isPending}
              data-testid={`button-additem-cancel-${historyId}`}
            >
              {t.cmnCancel}
            </Button>
            <Button
              size="sm"
              onClick={() => addBatchMutation.mutate()}
              disabled={addBatchMutation.isPending || addChecked.size === 0}
              data-testid={`button-additem-confirm-${historyId}`}
            >
              {addBatchMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />{t.cmnSaving}</>
              ) : (
                <><Plus className="w-4 h-4 mr-1.5" />{addChecked.size > 0 ? t.reorderHistoryAddItemsCount.replace("{n}", String(addChecked.size)) : t.reorderHistoryAddItems}</>
              )}
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setShowAddPanel(true); setTimeout(() => addSearchRef.current?.focus(), 50); }}
            data-testid={`button-additem-open-${historyId}`}
          >
            <Plus className="w-4 h-4 mr-1.5" />{t.reorderHistoryAddItem}
          </Button>
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => saveItemsMutation.mutate()}
          disabled={saveItemsMutation.isPending || downloadMutation.isPending}
          data-testid={`button-pending-save-${historyId}`}
        >
          {saveItemsMutation.isPending ? (
            <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />{t.cmnSaving}</>
          ) : t.reorderHistorySaveItems}
        </Button>
        <Button
          size="sm"
          onClick={() => downloadMutation.mutate()}
          disabled={saveItemsMutation.isPending || downloadMutation.isPending}
          data-testid={`button-pending-download-${historyId}`}
        >
          {downloadMutation.isPending ? (
            <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />{t.reorderHistoryDownloading}</>
          ) : (
            <><Download className="w-4 h-4 mr-1.5" />{t.reorderHistoryDownload}</>
          )}
        </Button>
      </div>
    </div>
  );
}

export default function ReorderHistory() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [openId, setOpenId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editId, setEditId] = useState<number | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [expandedPending, setExpandedPending] = useState<Set<number>>(new Set());
  const [downloadingExportedId, setDownloadingExportedId] = useState<number | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery<RmsExportHistory[]>({
    queryKey: ["/api/reorder/history"],
    queryFn: () => fetchJson<RmsExportHistory[]>("/api/reorder/history"),
  });

  const detailQuery = useQuery<RmsExportHistoryWithLines>({
    queryKey: ["/api/reorder/history", openId],
    queryFn: () => fetchJson<RmsExportHistoryWithLines>(`/api/reorder/history/${openId}`),
    enabled: openId != null,
  });

  const rows = data ?? [];
  const visibleIds = useMemo(() => rows.map(r => r.id), [rows]);

  const groups = useMemo(() => {
    const orderMap = new Map<string, number>();
    rows.forEach(r => {
      const key = r.poNumber ?? "";
      if (!orderMap.has(key)) orderMap.set(key, orderMap.size);
    });
    const buckets = new Map<string, RmsExportHistory[]>();
    rows.forEach(r => {
      const key = r.poNumber ?? "";
      const bucket = buckets.get(key) ?? [];
      bucket.push(r);
      buckets.set(key, bucket);
    });
    return Array.from(orderMap.entries())
      .sort((a, b) => a[1] - b[1])
      .map(([key]) => ({
        poKey: key,
        rows: (buckets.get(key) ?? []).slice().sort((a, b) => {
          if (a.poSeq != null && b.poSeq != null) return a.poSeq - b.poSeq;
          if (a.poSeq != null) return -1;
          if (b.poSeq != null) return 1;
          const ta = a.exportedAt ? new Date(a.exportedAt).getTime() : 0;
          const tb = b.exportedAt ? new Date(b.exportedAt).getTime() : 0;
          return ta - tb;
        }),
      }));
  }, [rows]);

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const toggleGroup = (key: string) =>
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  const togglePending = (id: number) =>
    setExpandedPending(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  useEffect(() => {
    setSelected(prev => {
      const valid = new Set(visibleIds);
      let changed = false;
      const next = new Set<number>();
      prev.forEach(id => {
        if (valid.has(id)) next.add(id);
        else changed = true;
      });
      return changed ? next : prev;
    });
  }, [visibleIds]);

  const allSelected = visibleIds.length > 0 && visibleIds.every(id => selected.has(id));
  const someSelected = !allSelected && visibleIds.some(id => selected.has(id));

  const toggleAll = (on: boolean) => setSelected(prev => {
    const next = new Set(prev);
    visibleIds.forEach(id => { if (on) next.add(id); else next.delete(id); });
    return next;
  });
  const toggleOne = (id: number, on: boolean) => setSelected(prev => {
    const next = new Set(prev);
    if (on) next.add(id); else next.delete(id);
    return next;
  });

  const editingRow = useMemo(
    () => (editId != null ? rows.find(r => r.id === editId) ?? null : null),
    [editId, rows],
  );

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      requestFrom: "", poNumber: "", projectName: "", completionDate: "", deliveryTo: "",
    },
  });

  useEffect(() => {
    if (editingRow) {
      form.reset({
        requestFrom: editingRow.requestFrom ?? "",
        poNumber: editingRow.poNumber ?? "",
        projectName: editingRow.projectName ?? "",
        completionDate: editingRow.completionDate ?? "",
        deliveryTo: editingRow.deliveryTo ?? "",
      });
    }
  }, [editingRow, form]);

  const updateMutation = useMutation({
    mutationFn: async (vars: { id: number; patch: EditFormValues }) => {
      const payload: Record<string, string | null> = {};
      (Object.keys(vars.patch) as (keyof EditFormValues)[]).forEach(k => {
        const v = vars.patch[k];
        payload[k] = v && v.trim() ? v.trim() : null;
      });
      const res = await apiRequest("PATCH", `/api/reorder/history/${vars.id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reorder/history"] });
      toast({ description: t.reorderHistoryUpdated });
      setEditId(null);
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: t.cmnSaveFailed, description: err.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await apiRequest("DELETE", `/api/reorder/history`, { ids });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reorder/history"] });
      toast({ description: t.reorderHistoryDeleteSuccess });
      setSelected(new Set());
      setConfirmDeleteOpen(false);
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: t.cmnDeleteFailed, description: err.message });
    },
  });

  const redownloadMutation = useMutation({
    mutationFn: async (id: number) => {
      setDownloadingExportedId(id);
      const res = await fetch(`/api/reorder/history/${id}/download`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const m = /filename="([^"]+)"/.exec(cd);
      return { blob, filename: m?.[1] || "RMS.xlsx" };
    },
    onSuccess: ({ blob, filename }) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      queryClient.invalidateQueries({ queryKey: ["/api/reorder/history"] });
      toast({ description: t.reorderHistoryDownloadSuccess });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: t.reorderHistoryDownloadError, description: err.message });
    },
    onSettled: () => setDownloadingExportedId(null),
  });

  if (isLoading) {
    return (
      <div className="premium-card bg-white p-10 flex items-center justify-center text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t.cmnLoading}
      </div>
    );
  }
  if (isError) {
    return (
      <div className="premium-card bg-white p-10 text-center space-y-3">
        <p className="text-slate-500">{t.cmnError}</p>
        <Button variant="outline" onClick={() => refetch()} data-testid="button-history-retry">
          {t.stockPricingRetry}
        </Button>
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="premium-card bg-white p-10 text-center text-slate-500" data-testid="text-history-empty">
        {t.reorderHistoryEmpty}
      </div>
    );
  }

  const selectedCount = selected.size;

  return (
    <div className="premium-card bg-white overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                onCheckedChange={(v) => toggleAll(v === true)}
                aria-label={t.reorderHistorySelectAllAria}
                data-testid="checkbox-history-select-all"
              />
            </TableHead>
            <TableHead className="w-12 text-right">{t.reorderHistoryColRowNum}</TableHead>
            <TableHead>{t.reorderHistoryColExportedAt}</TableHead>
            <TableHead>{t.reorderHistoryColExportedBy}</TableHead>
            <TableHead>{t.reorderHistoryColProject}</TableHead>
            <TableHead>{t.reorderHistoryColDelivery}</TableHead>
            <TableHead className="text-right">{t.reorderHistoryColItemCount}</TableHead>
            <TableHead>{t.reorderHistoryColStatus}</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group, groupIdx) => {
            const collapsed = collapsedGroups.has(group.poKey);
            const label = group.poKey ? group.poKey : t.reorderHistoryNoPo;
            return (
              <React.Fragment key={group.poKey || "no-po"}>
                {groupIdx > 0 && (
                  <TableRow aria-hidden="true">
                    <TableCell colSpan={9} className="p-0 h-2 bg-slate-100/60 border-none" />
                  </TableRow>
                )}
                <TableRow
                  className="bg-slate-50 hover:bg-slate-100 cursor-pointer select-none"
                  onClick={() => toggleGroup(group.poKey)}
                  data-testid={`row-history-group-${group.poKey || "no-po"}`}
                >
                  <TableCell colSpan={9} className="py-2 px-4">
                    <div className="flex items-center gap-2">
                      {collapsed
                        ? <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                        : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 mr-1">
                        {t.reorderHistoryColPo}
                      </span>
                      <span className="font-semibold text-slate-700 text-sm">{label}</span>
                      <span className="ml-auto text-xs text-slate-400">{group.rows.length}</span>
                    </div>
                  </TableCell>
                </TableRow>

                {!collapsed && group.rows.map((r) => {
                  const isSelected = selected.has(r.id);
                  const isPending = r.status === "pending";
                  const isExpanded = expandedPending.has(r.id);
                  return (
                    <React.Fragment key={r.id}>
                      <TableRow
                        data-testid={`row-history-${r.id}`}
                        data-state={isSelected ? "selected" : undefined}
                        className={isPending ? "bg-amber-50/50" : undefined}
                      >
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(v) => toggleOne(r.id, v === true)}
                            aria-label={t.reorderHistorySelectRowAria}
                            data-testid={`checkbox-history-row-${r.id}`}
                          />
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-slate-400" data-testid={`text-history-seq-${r.id}`}>
                          {r.poSeq != null ? String(r.poSeq).padStart(4, "0") : "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{formatDateTime(r.exportedAt)}</TableCell>
                        <TableCell data-testid={`text-history-requester-${r.id}`}>{r.requestFrom || "—"}</TableCell>
                        <TableCell>{r.projectName || "—"}</TableCell>
                        <TableCell>{r.deliveryTo || "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.itemCount}</TableCell>
                        <TableCell>
                          {isPending ? (
                            <Badge
                              className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100"
                              variant="outline"
                              data-testid={`text-history-status-${r.id}`}
                            >
                              {t.reorderHistoryStatusPending}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" data-testid={`text-history-status-${r.id}`}>
                              {r.status === "exported" ? t.reorderHistoryStatusExported : r.status}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {isPending ? (
                            <div className="flex items-center gap-0.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => togglePending(r.id)}
                                data-testid={`button-history-pending-toggle-${r.id}`}
                                className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                              >
                                {isExpanded
                                  ? <ChevronDown className="w-4 h-4" />
                                  : <ChevronRight className="w-4 h-4" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setOpenId(r.id)}
                                data-testid={`button-history-pending-detail-${r.id}`}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-0.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => redownloadMutation.mutate(r.id)}
                                disabled={downloadingExportedId === r.id}
                                data-testid={`button-history-download-${r.id}`}
                                title={t.reorderHistoryDownload}
                              >
                                {downloadingExportedId === r.id
                                  ? <Loader2 className="w-4 h-4 animate-spin" />
                                  : <Download className="w-4 h-4" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setOpenId(r.id)}
                                data-testid={`button-history-detail-${r.id}`}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>

                      {isPending && isExpanded && (
                        <TableRow data-testid={`row-pending-editor-${r.id}`}>
                          <TableCell colSpan={9} className="p-0">
                            <PendingInlineEditor
                              historyId={r.id}
                              onDownloaded={() => setExpandedPending(prev => {
                                const next = new Set(prev);
                                next.delete(r.id);
                                return next;
                              })}
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
      {isFetching && (
        <div className="px-4 py-2 text-xs text-slate-400">{t.cmnLoading}</div>
      )}

      {selectedCount > 0 && typeof document !== "undefined" && createPortal(
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] px-4">
          <div
            className="flex items-center gap-2 bg-slate-900 text-white rounded-full shadow-lg pl-5 pr-2 py-2"
            data-testid="bar-history-selection"
          >
            <span className="text-sm">
              <span className="font-semibold" data-testid="text-history-selected-count">{selectedCount}</span>{" "}
              {t.reorderHistorySelectedSuffix}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-white hover:bg-white/10 rounded-full"
              onClick={() => setSelected(new Set())}
              data-testid="button-history-clear-selection"
            >
              <X className="w-4 h-4 mr-1" />
              {t.reorderRmsClearSelection}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-white hover:bg-white/10 rounded-full disabled:opacity-40"
              disabled={selectedCount !== 1}
              onClick={() => {
                const id = Array.from(selected)[0];
                if (id != null) setEditId(id);
              }}
              data-testid="button-history-edit"
            >
              <Pencil className="w-4 h-4 mr-1" />
              {t.cmnEdit}
            </Button>
            <Button
              size="sm"
              className="h-8 bg-red-600 hover:bg-red-700 text-white rounded-full"
              onClick={() => setConfirmDeleteOpen(true)}
              data-testid="button-history-delete"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              {t.cmnDelete}
            </Button>
          </div>
        </div>,
        document.body,
      )}

      <Dialog open={editId != null} onOpenChange={(o) => !o && setEditId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t.reorderHistoryEditTitle}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((values) => {
                if (editId != null) updateMutation.mutate({ id: editId, patch: values });
              })}
              className="space-y-3"
            >
              <FormField
                control={form.control}
                name="requestFrom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.reorderRmsRequester}</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-requester" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="poNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.reorderHistoryColPo}</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-po" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="projectName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.reorderHistoryColProject}</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-project" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="completionDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.reorderRmsCompletionDate}</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-completion-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="deliveryTo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.reorderHistoryColDelivery}</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-delivery" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditId(null)}
                  data-testid="button-edit-cancel"
                >
                  {t.cmnCancel}
                </Button>
                <Button
                  type="submit"
                  disabled={updateMutation.isPending}
                  data-testid="button-edit-save"
                >
                  {updateMutation.isPending ? t.cmnSaving : t.cmnSave}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.reorderHistoryDeleteConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.reorderHistoryDeleteConfirmBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-delete-cancel">{t.cmnCancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                deleteMutation.mutate(Array.from(selected));
              }}
              data-testid="button-delete-confirm"
            >
              {deleteMutation.isPending ? t.cmnDeleting : t.cmnDelete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={openId != null} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-w-6xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t.reorderHistoryDetailTitle}</DialogTitle>
          </DialogHeader>
          {detailQuery.isLoading && (
            <div className="flex items-center justify-center py-10 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t.cmnLoading}
            </div>
          )}
          {detailQuery.data && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <Field label={t.reorderHistoryColExportedAt} value={formatDateTime(detailQuery.data.exportedAt)} />
                <Field label={t.reorderHistoryColExportedByMeta} value={detailQuery.data.exportedByName || "—"} />
                <Field label={t.reorderRmsRequester} value={detailQuery.data.requestFrom || "—"} />
                <Field label={t.reorderHistoryColPo} value={detailQuery.data.poNumber || "—"} />
                <Field label={t.reorderHistoryFilename} value={buildRmsFilename(detailQuery.data.poNumber, detailQuery.data.poSeq)} />
                <Field label={t.reorderHistoryColProject} value={detailQuery.data.projectName || "—"} />
                <Field label={t.reorderRmsCompletionDate} value={detailQuery.data.completionDate || "—"} />
                <Field label={t.reorderHistoryColDelivery} value={detailQuery.data.deliveryTo || "—"} />
                <Field label={t.reorderHistoryColStatus} value={detailQuery.data.status === "exported" ? t.reorderHistoryStatusExported : detailQuery.data.status} />
                <Field label={t.reorderHistoryColItemCount} value={String(detailQuery.data.itemCount)} />
              </div>

              {(() => {
                const showStock = detailQuery.data.lines.some(
                  (l) =>
                    l.onHandSnapshot != null ||
                    l.reorderPointSnapshot != null ||
                    l.reorderQuantitySnapshot != null ||
                    l.minimumStockSnapshot != null,
                );
                return (
                  <div className="border rounded-lg overflow-hidden overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="whitespace-nowrap text-right w-12">{t.reorderHistoryColRowNum}</TableHead>
                          <TableHead className="whitespace-nowrap w-16">{t.colPhoto}</TableHead>
                          <TableHead className="whitespace-nowrap">{t.reorderRmsSize}</TableHead>
                          <TableHead className="whitespace-nowrap">{t.reorderRmsItem}</TableHead>
                          <TableHead className="whitespace-nowrap text-right">{t.reorderRmsQty}</TableHead>
                          <TableHead className="whitespace-nowrap">{t.reorderRmsUnit}</TableHead>
                          {showStock && (
                            <>
                              <TableHead className="whitespace-nowrap text-right font-semibold text-slate-900">{t.reorderHistoryColOnHand}</TableHead>
                              <TableHead className="whitespace-nowrap text-right">{t.reorderHistoryColReorderPoint}</TableHead>
                              <TableHead className="whitespace-nowrap text-right">{t.reorderHistoryColReorderQty}</TableHead>
                              <TableHead className="whitespace-nowrap text-right">{t.reorderHistoryColMinStock}</TableHead>
                            </>
                          )}
                          <TableHead className="whitespace-nowrap">{t.reorderHistoryColRemarks}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailQuery.data.lines.map((l, i) => (
                          <TableRow key={l.id} data-testid={`row-history-line-${l.id}`}>
                            <TableCell className="text-right tabular-nums text-slate-500" data-testid={`text-history-line-num-${l.id}`}>
                              {i + 1}
                            </TableCell>
                            <TableCell>
                              {l.itemImageUrl ? (
                                <img
                                  src={l.itemImageUrl}
                                  alt={l.nameSnapshot ?? ""}
                                  className="w-10 h-10 rounded object-cover border border-slate-200"
                                  data-testid={`img-history-line-photo-${l.id}`}
                                />
                              ) : (
                                <span className="text-slate-300" data-testid={`img-history-line-photo-${l.id}`}>—</span>
                              )}
                            </TableCell>
                            <TableCell>{l.sizeSnapshot || "—"}</TableCell>
                            <TableCell>{l.nameSnapshot || "—"}</TableCell>
                            <TableCell className="text-right tabular-nums">{l.qty}</TableCell>
                            <TableCell>{l.unitSnapshot || "—"}</TableCell>
                            {showStock && (
                              <>
                                <TableCell className="text-right tabular-nums font-semibold text-slate-900" data-testid={`text-history-onhand-${l.id}`}>
                                  {l.onHandSnapshot ?? "—"}
                                </TableCell>
                                <TableCell className="text-right tabular-nums" data-testid={`text-history-rop-${l.id}`}>
                                  {l.reorderPointSnapshot ?? "—"}
                                </TableCell>
                                <TableCell className="text-right tabular-nums" data-testid={`text-history-roq-${l.id}`}>
                                  {l.reorderQuantitySnapshot ?? "—"}
                                </TableCell>
                                <TableCell className="text-right tabular-nums" data-testid={`text-history-min-${l.id}`}>
                                  {l.minimumStockSnapshot ?? "—"}
                                </TableCell>
                              </>
                            )}
                            <TableCell className="text-xs text-slate-500">{l.remarksSnapshot || "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-slate-800 mt-0.5">{value}</div>
    </div>
  );
}
