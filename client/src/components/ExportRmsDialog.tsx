import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import { Download, Loader2, Package, X } from "lucide-react";
import type { Project } from "@shared/schema";

export type RmsExportItem = {
  id: number;
  itemId: number | null;
  name: string;
  size: string;
  unit: string;
  qty: number;
  onHand?: number;
  imageUrl?: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialItems: RmsExportItem[];
};

type RowCellsProps = {
  row: RmsExportItem;
  index: number;
  onUpdateQty: (id: number, qty: number) => void;
  onRemove?: (id: number) => void;
  removeLabel?: string;
};

function RowCells({ row: r, index, onUpdateQty, onRemove, removeLabel }: RowCellsProps) {
  return (
    <>
      <td className="px-2 py-2 text-slate-400 tabular-nums text-right w-8">{index + 1}</td>
      <td className="px-3 py-2">
        {r.imageUrl ? (
          <img
            src={r.imageUrl}
            alt={r.name}
            className="w-10 h-10 rounded object-cover border border-slate-200"
            data-testid={`img-rms-photo-${r.id}`}
          />
        ) : (
          <div
            className="w-10 h-10 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400"
            data-testid={`img-rms-photo-${r.id}`}
          >
            <Package className="w-4 h-4" />
          </div>
        )}
      </td>
      <td className="px-3 py-2 text-slate-600">{r.size || "—"}</td>
      <td className="px-3 py-2 text-slate-900">{r.name}</td>
      <td className="px-3 py-2 text-right text-slate-400 tabular-nums w-16" data-testid={`text-rms-onhand-${r.id}`}>
        {r.onHand ?? "—"}
      </td>
      <td className="px-3 py-2 text-right">
        <Input
          type="number"
          min={0}
          className="h-8 text-right w-24 ml-auto"
          value={r.qty}
          onChange={e => onUpdateQty(r.id, Number(e.target.value))}
          onPointerDown={e => e.stopPropagation()}
          data-testid={`input-rms-qty-${r.id}`}
        />
      </td>
      <td className="px-3 py-2 text-slate-600">{r.unit || "—"}</td>
      {onRemove && (
        <td className="px-2 py-2 w-8">
          <button
            onClick={() => onRemove(r.id)}
            className="text-slate-300 hover:text-rose-500 p-1 rounded transition-colors"
            aria-label={removeLabel}
            data-testid={`button-rms-remove-${r.id}`}
          >
            <X className="w-4 h-4" />
          </button>
        </td>
      )}
    </>
  );
}

function OverlayRow({ row: r, index }: { row: RmsExportItem; index: number }) {
  return (
    <tr className="border-t border-slate-100 bg-white shadow-lg cursor-grabbing">
      <RowCells row={r} index={index} onUpdateQty={() => {}} />
    </tr>
  );
}

type SortableRowProps = {
  row: RmsExportItem;
  index: number;
  onUpdateQty: (id: number, qty: number) => void;
  onRemove: (id: number) => void;
  removeLabel: string;
};

function SortableRow({ row: r, index, onUpdateQty, onRemove, removeLabel }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: r.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="border-t border-slate-100 cursor-grab active:cursor-grabbing touch-none"
      data-testid={`row-rms-${r.id}`}
    >
      <RowCells row={r} index={index} onUpdateQty={onUpdateQty} onRemove={onRemove} removeLabel={removeLabel} />
    </tr>
  );
}

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildRmsFilename(poNumber: string, poSeq: number): string {
  const safe = (s: string) => (s || "").replace(/[\\/:*?"<>|]/g, "_").trim();
  const poPart = safe(poNumber || "");
  const seqStr = String(poSeq).padStart(4, "0");
  return poPart ? `RMS-${poPart}-${seqStr}.xlsx` : `RMS-${seqStr}.xlsx`;
}

export default function ExportRmsDialog({ open, onOpenChange, initialItems }: Props) {
  const { t } = useLanguage();
  const { toast } = useToast();

  const [date, setDate] = useState(todayIso());
  const [requester, setRequester] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [debouncedPo, setDebouncedPo] = useState("");
  const [projectName, setProjectName] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [completionDate, setCompletionDate] = useState("");
  const [deliveryTo, setDeliveryTo] = useState("");
  const [rows, setRows] = useState<RmsExportItem[]>(initialItems);
  const [submitting, setSubmitting] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const activeRow = activeId != null ? rows.find(r => r.id === activeId) ?? null : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as number);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setRows(prev => {
      const oldIdx = prev.findIndex(r => r.id === active.id);
      const newIdx = prev.findIndex(r => r.id === over.id);
      if (oldIdx < 0 || newIdx < 0) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  };

  // Load projects for the picker. Only fetched when dialog is open.
  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: open,
  });

  // Project options sorted by name; label includes PO number when present.
  const projectOptions = useMemo(() => {
    const sorted = [...projects].sort((a, b) =>
      String(a.name ?? "").localeCompare(String(b.name ?? "")),
    );
    return sorted.map((p) => ({
      value: String(p.id),
      label: p.poNumber ? `${p.name} (${p.poNumber})` : p.name,
    }));
  }, [projects]);

  // Debounce PO number for seq lookup (400 ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedPo(poNumber.trim()), 400);
    return () => clearTimeout(timer);
  }, [poNumber]);

  // Fetch predicted sequence number for the current PO
  const { data: seqData, isFetching: seqFetching } = useQuery<{ nextSeq: number }>({
    queryKey: ["/api/reorder/next-seq", debouncedPo],
    queryFn: async ({ queryKey }) => {
      const po = queryKey[1] as string;
      const params = po ? `?po=${encodeURIComponent(po)}` : "";
      const res = await fetch(`/api/reorder/next-seq${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("seq fetch failed");
      return res.json();
    },
    enabled: open,
    staleTime: 0,
  });

  const predictedFilename = buildRmsFilename(poNumber, seqData?.nextSeq ?? 1);

  // When dialog opens, refresh row list from incoming selection and clear the
  // picker so a new export starts from a clean slate.
  useEffect(() => {
    if (open) {
      setRows(initialItems);
      setSelectedProjectId("");
    }
  }, [open, initialItems]);

  const handleSelectProject = (val: string) => {
    setSelectedProjectId(val);
    const p = projects.find((x) => String(x.id) === val);
    if (p) {
      setPoNumber(p.poNumber ?? "");
      setProjectName(p.name ?? "");
    }
  };

  const truncated = rows.length > 50;

  const updateQty = (id: number, qty: number) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, qty: Number.isFinite(qty) ? qty : 0 } : r));
  };

  const removeRow = (id: number) => {
    const index = rows.findIndex(r => r.id === id);
    if (index < 0) return;
    const row = rows[index];
    const removed = { row, index };
    setRows(prev => prev.filter(r => r.id !== id));
    const { dismiss } = toast({
      title: t.reorderRmsRowRemoved,
      duration: 5000,
      action: (
        <ToastAction
          altText={t.undoMovement}
          data-testid="toast-undo-rms-remove"
          onClick={() => {
            setRows(current => {
              const next = [...current];
              next.splice(removed.index, 0, removed.row);
              return next;
            });
            dismiss();
          }}
        >
          {t.undoMovement}
        </ToastAction>
      ),
    });
  };

  const handleSubmit = async () => {
    if (!poNumber.trim()) {
      toast({ title: t.reorderRmsPoRequired, variant: "destructive" });
      return;
    }
    if (rows.length === 0) {
      toast({ title: t.reorderRmsExportError, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/reorder/export-rms", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          header: {
            date,
            requester,
            poNumber,
            projectName,
            completionDate,
            deliveryTo,
          },
          projectId: selectedProjectId ? Number(selectedProjectId) : undefined,
          items: rows.map(r => ({
            itemId: r.itemId ?? undefined,
            name: r.name,
            size: r.size,
            unit: r.unit,
            qty: Number(r.qty) || 0,
          })),
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const m = /filename="([^"]+)"/.exec(cd);
      const filename = m?.[1] || `${(poNumber || "RMS").replace(/[\\/:*?"<>|]/g, "_")}.xlsx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      queryClient.invalidateQueries({ queryKey: ["/api/reorder/next-seq"] });
      toast({ title: t.reorderRmsExportSuccess });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: t.reorderRmsExportError, description: err?.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-export-rms">
        <DialogHeader>
          <DialogTitle>{t.reorderRmsTitle}</DialogTitle>
          <DialogDescription>{t.reorderRmsSubtitle}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Header inputs */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-2">{t.reorderRmsHeaderSection}</h3>
            <div className="space-y-1 mb-3">
              <Label className="text-xs text-slate-600">
                {t.reorderRmsProjectPickerLabel}
              </Label>
              <SearchableSelect
                value={selectedProjectId}
                onChange={handleSelectProject}
                options={projectOptions}
                placeholder={projectsLoading ? t.reorderRmsProjectPickerLoading : t.reorderRmsProjectPickerPlaceholder}
                searchPlaceholder={t.reorderRmsProjectPickerSearch}
                emptyText={projectsLoading ? t.reorderRmsProjectPickerLoading : t.reorderRmsProjectPickerEmpty}
                data-testid="select-rms-project"
              />
              <p className="text-xs text-slate-400">{t.reorderRmsProjectPickerHint}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="rms-date" className="text-xs text-slate-600">{t.reorderRmsDate}</Label>
                <Input id="rms-date" type="date" value={date} onChange={e => setDate(e.target.value)} data-testid="input-rms-date" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rms-requester" className="text-xs text-slate-600">{t.reorderRmsRequester}</Label>
                <Input id="rms-requester" value={requester} onChange={e => setRequester(e.target.value)} data-testid="input-rms-requester" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rms-po" className="text-xs text-slate-600">
                  {t.reorderRmsPoNumber} <span className="text-rose-500">*</span>
                </Label>
                <Input id="rms-po" value={poNumber} onChange={e => setPoNumber(e.target.value)} data-testid="input-rms-po" />
                {poNumber.trim().length > 0 && (
                  <p className="text-xs text-slate-400 font-mono" data-testid="text-rms-filename-preview">
                    {t.reorderRmsFilenamePreview}{" "}
                    {seqFetching || poNumber.trim() !== debouncedPo ? (
                      <span className="text-slate-400">…</span>
                    ) : (
                      <span className="text-slate-600">{predictedFilename}</span>
                    )}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="rms-project" className="text-xs text-slate-600">{t.reorderRmsProjectName}</Label>
                <Input id="rms-project" value={projectName} onChange={e => setProjectName(e.target.value)} data-testid="input-rms-project" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rms-comp" className="text-xs text-slate-600">{t.reorderRmsCompletionDate}</Label>
                <Input id="rms-comp" type="date" value={completionDate} onChange={e => setCompletionDate(e.target.value)} data-testid="input-rms-comp" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rms-delivery" className="text-xs text-slate-600">{t.reorderRmsDeliveryTo}</Label>
                <Input id="rms-delivery" value={deliveryTo} onChange={e => setDeliveryTo(e.target.value)} data-testid="input-rms-delivery" />
              </div>
            </div>
          </div>

          {/* Item preview */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-700">
                {t.reorderRmsItemsSection}{" "}
                <span className="text-slate-400 font-normal">({rows.length})</span>
              </h3>
              {truncated && (
                <span className="text-xs text-amber-600">{t.reorderRmsTruncatedNote}</span>
              )}
            </div>
            <div className="border border-slate-200 rounded-md overflow-hidden">
              <div className="max-h-72 overflow-y-auto">
                <table ref={tableRef} className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="text-right font-medium px-2 py-2 w-8">#</th>
                      <th className="text-left font-medium px-3 py-2 w-14">{t.reorderRmsPhoto}</th>
                      <th className="text-left font-medium px-3 py-2 w-28">{t.reorderRmsSize}</th>
                      <th className="text-left font-medium px-3 py-2">{t.reorderRmsItem}</th>
                      <th className="text-right font-medium px-3 py-2 w-16">{t.reorderColOnHand}</th>
                      <th className="text-right font-medium px-3 py-2 w-24">{t.reorderColOrderQty}</th>
                      <th className="text-left font-medium px-3 py-2 w-20">{t.reorderRmsUnit}</th>
                      <th className="w-8 px-2 py-2" />
                    </tr>
                  </thead>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext items={rows.map(r => r.id)} strategy={verticalListSortingStrategy}>
                      <tbody>
                        {rows.map((r, i) => (
                          <SortableRow key={r.id} row={r} index={i} onUpdateQty={updateQty} onRemove={removeRow} removeLabel={t.removeFromCart} />
                        ))}
                      </tbody>
                    </SortableContext>
                    <DragOverlay>
                      {activeRow && (
                        <table className="text-sm" style={{ width: tableRef.current?.offsetWidth }}>
                          <tbody>
                            <OverlayRow
                              row={activeRow}
                              index={rows.findIndex(r => r.id === activeRow.id)}
                            />
                          </tbody>
                        </table>
                      )}
                    </DragOverlay>
                  </DndContext>
                </table>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting} data-testid="button-rms-cancel">
            {t.reorderRmsCancel}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || rows.length === 0} data-testid="button-rms-download">
            {submitting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t.reorderRmsGenerating}</>
            ) : (
              <><Download className="w-4 h-4 mr-2" />{t.reorderRmsDownload}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
