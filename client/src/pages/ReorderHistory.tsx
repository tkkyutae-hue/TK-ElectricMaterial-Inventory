import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, Loader2 } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";
import type { RmsExportHistory, RmsExportHistoryWithLines } from "@shared/schema";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

export default function ReorderHistory() {
  const { t } = useLanguage();
  const [openId, setOpenId] = useState<number | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery<RmsExportHistory[]>({
    queryKey: ["/api/reorder/history"],
    queryFn: () => fetchJson<RmsExportHistory[]>("/api/reorder/history"),
  });

  const detailQuery = useQuery<RmsExportHistoryWithLines>({
    queryKey: ["/api/reorder/history", openId],
    queryFn: () => fetchJson<RmsExportHistoryWithLines>(`/api/reorder/history/${openId}`),
    enabled: openId != null,
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
  const rows = data ?? [];
  if (rows.length === 0) {
    return (
      <div className="premium-card bg-white p-10 text-center text-slate-500" data-testid="text-history-empty">
        {t.reorderHistoryEmpty}
      </div>
    );
  }

  return (
    <div className="premium-card bg-white overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
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
          {rows.map((r) => (
            <TableRow key={r.id} data-testid={`row-history-${r.id}`}>
              <TableCell className="whitespace-nowrap">{formatDateTime(r.exportedAt as any)}</TableCell>
              <TableCell>{r.exportedByName || "—"}</TableCell>
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
          ))}
        </TableBody>
      </Table>
      {isFetching && (
        <div className="px-4 py-2 text-xs text-slate-400">{t.cmnLoading}</div>
      )}

      <Dialog open={openId != null} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
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
                <Field label={t.reorderHistoryColExportedAt} value={formatDateTime(detailQuery.data.exportedAt as any)} />
                <Field label={t.reorderHistoryColExportedBy} value={detailQuery.data.exportedByName || "—"} />
                <Field label={t.reorderRmsRequester} value={detailQuery.data.requestFrom || "—"} />
                <Field label={t.reorderHistoryColPo} value={detailQuery.data.poNumber || "—"} />
                <Field label={t.reorderHistoryColProject} value={detailQuery.data.projectName || "—"} />
                <Field label={t.reorderRmsCompletionDate} value={detailQuery.data.completionDate || "—"} />
                <Field label={t.reorderHistoryColDelivery} value={detailQuery.data.deliveryTo || "—"} />
                <Field label={t.reorderHistoryColStatus} value={detailQuery.data.status === "exported" ? t.reorderHistoryStatusExported : detailQuery.data.status} />
                <Field label={t.reorderHistoryColItemCount} value={String(detailQuery.data.itemCount)} />
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.reorderHistoryColSku}</TableHead>
                      <TableHead>{t.reorderRmsItem}</TableHead>
                      <TableHead>{t.reorderRmsSize}</TableHead>
                      <TableHead className="text-right">{t.reorderRmsQty}</TableHead>
                      <TableHead>{t.reorderRmsUnit}</TableHead>
                      <TableHead>{t.reorderHistoryColRemarks}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailQuery.data.lines.map((l) => (
                      <TableRow key={l.id} data-testid={`row-history-line-${l.id}`}>
                        <TableCell className="font-mono text-xs">{l.skuSnapshot || "—"}</TableCell>
                        <TableCell>{l.nameSnapshot || "—"}</TableCell>
                        <TableCell>{l.sizeSnapshot || "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{l.qty}</TableCell>
                        <TableCell>{l.unitSnapshot || "—"}</TableCell>
                        <TableCell className="text-xs text-slate-500">{l.remarksSnapshot || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
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
