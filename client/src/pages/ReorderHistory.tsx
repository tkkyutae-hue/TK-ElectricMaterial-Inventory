import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Eye, Loader2, Pencil, Trash2, X } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { RmsExportHistory, RmsExportHistoryWithLines } from "@shared/schema";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
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

export default function ReorderHistory() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [openId, setOpenId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editId, setEditId] = useState<number | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

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

  // Reconcile selection against current rows so deletes don't leave phantoms.
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
            <TableHead>{t.reorderHistoryColPo}</TableHead>
            <TableHead>{t.reorderHistoryColDelivery}</TableHead>
            <TableHead className="text-right">{t.reorderHistoryColItemCount}</TableHead>
            <TableHead>{t.reorderHistoryColStatus}</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const isSelected = selected.has(r.id);
            return (
              <TableRow
                key={r.id}
                data-testid={`row-history-${r.id}`}
                data-state={isSelected ? "selected" : undefined}
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
                <TableCell>{r.poNumber || "—"}</TableCell>
                <TableCell>{r.deliveryTo || "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{r.itemCount}</TableCell>
                <TableCell>
                  <Badge variant="secondary" data-testid={`text-history-status-${r.id}`}>
                    {r.status === "exported" ? t.reorderHistoryStatusExported : r.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setOpenId(r.id)}
                    data-testid={`button-history-detail-${r.id}`}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {isFetching && (
        <div className="px-4 py-2 text-xs text-slate-400">{t.cmnLoading}</div>
      )}

      {/* Floating bottom action bar */}
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

      {/* Edit dialog */}
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

      {/* Delete confirm */}
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

      {/* Detail dialog */}
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
