import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
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
import { useLanguage } from "@/hooks/use-language";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Cable,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Info,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

type ReelIdPreviewRow = {
  reelDbId: number;
  currentReelId: string;
  proposedReelId: string;
  itemId: number;
  itemName: string;
  sizeLabel: string | null;
  coreCode: "MC" | "SC";
  sizeCode: string;
  configCode: string;
  status: "ready" | "already_new_format" | "ambiguous" | "conflict" | "invalid_sequence" | "missing_item";
  reason: string;
};

// ── Status badge config ────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  ready: { label: "Ready", className: "text-green-700 border-green-300 bg-green-50" },
  already_new_format: { label: "Already New", className: "text-slate-500 border-slate-300 bg-slate-100" },
  ambiguous: { label: "Ambiguous", className: "text-amber-700 border-amber-300 bg-amber-50" },
  conflict: { label: "Conflict", className: "text-red-700 border-red-300 bg-red-50" },
  invalid_sequence: { label: "Invalid Seq", className: "text-purple-700 border-purple-300 bg-purple-50" },
  missing_item: { label: "Missing Item", className: "text-rose-700 border-rose-300 bg-rose-50" },
};

function StatusBadge({ status }: { status: ReelIdPreviewRow["status"] }) {
  const cfg = STATUS_STYLE[status] ?? STATUS_STYLE.ready;
  return (
    <Badge variant="outline" className={`text-[10px] whitespace-nowrap ${cfg.className}`}>
      {cfg.label}
    </Badge>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function ReelIdCleanup() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery<{ rows: ReelIdPreviewRow[] }>({
    queryKey: ["/api/admin/reel-id-preview"],
  });

  const rows = data?.rows ?? [];

  // Count by status
  const counts = useMemo(() => {
    const c = { ready: 0, already_new_format: 0, ambiguous: 0, conflict: 0, invalid_sequence: 0, missing_item: 0 };
    for (const r of rows) {
      if (r.status in c) (c as any)[r.status]++;
    }
    return c;
  }, [rows]);

  // Only "ready" rows are selectable
  const readyRows = useMemo(() => rows.filter(r => r.status === "ready"), [rows]);
  const allReadySelected = readyRows.length > 0 && readyRows.every(r => selectedIds.has(r.reelDbId));
  const someReadySelected = readyRows.some(r => selectedIds.has(r.reelDbId));

  const toggleRow = useCallback((id: number, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const handleSelectAll = () => {
    if (allReadySelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(readyRows.map(r => r.reelDbId)));
    }
  };

  const renameMutation = useMutation({
    mutationFn: async (reelDbIds: number[]) => {
      const res = await apiRequest("PATCH", "/api/admin/reel-id-rename", { reelDbIds });
      return res.json() as Promise<{ updated: number; skipped: number; errors: string[] }>;
    },
    onSuccess: (result) => {
      toast({
        title: `${result.updated} ${t.adminReelIdToast}`,
        description: result.errors.length > 0
          ? `${result.skipped} skipped. Errors: ${result.errors.slice(0, 3).join("; ")}`
          : result.skipped > 0 ? `${result.skipped} already up-to-date.` : undefined,
      });
      setSelectedIds(new Set());
      setConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reel-id-preview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wire-reels"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-slate-900 flex items-center gap-2">
          <Cable className="w-6 h-6 text-slate-500" />
          {t.adminReelIdTitle}
        </h1>
        <p className="text-slate-500 text-sm mt-1">{t.adminReelIdSubtitle}</p>
      </div>

      {/* Safety banner */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
        <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-500" />
        <span>{t.adminReelIdSafetyBanner}</span>
      </div>

      {/* Summary counts */}
      {!isLoading && rows.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="text-xs gap-1 text-green-700 border-green-300 bg-green-50">
            <CheckCircle2 className="w-3 h-3" /> {counts.ready} {t.adminReelIdCountReady}
          </Badge>
          <Badge variant="outline" className="text-xs text-slate-500 border-slate-300 bg-slate-100">
            {counts.already_new_format} {t.adminReelIdCountAlreadyNew}
          </Badge>
          {counts.ambiguous > 0 && (
            <Badge variant="outline" className="text-xs text-amber-700 border-amber-300 bg-amber-50">
              <AlertTriangle className="w-3 h-3 mr-1" /> {counts.ambiguous} {t.adminReelIdCountAmbiguous}
            </Badge>
          )}
          {counts.conflict > 0 && (
            <Badge variant="outline" className="text-xs text-red-700 border-red-300 bg-red-50">
              {counts.conflict} {t.adminReelIdCountConflict}
            </Badge>
          )}
          {counts.invalid_sequence > 0 && (
            <Badge variant="outline" className="text-xs text-purple-700 border-purple-300 bg-purple-50">
              {counts.invalid_sequence} {t.adminReelIdCountInvalidSeq}
            </Badge>
          )}
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {readyRows.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={handleSelectAll} className="gap-1.5 text-xs h-8" data-testid="btn-select-all-ready">
                {allReadySelected ? t.adminReelIdClearAll : t.adminReelIdSelectAll}
              </Button>
              {someReadySelected && (
                <span className="text-xs text-slate-500">{selectedIds.size} selected</span>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-1.5 text-xs h-8"
            data-testid="btn-refresh-preview"
          >
            <RefreshCw className={`w-3 h-3 ${isFetching ? "animate-spin" : ""}`} />
            {t.adminReelIdRefreshBtn}
          </Button>
          {selectedIds.size > 0 && (
            <Button
              size="sm"
              className="gap-1.5 bg-brand-700 hover:bg-brand-800 text-white h-8 text-xs"
              onClick={() => setConfirmOpen(true)}
              disabled={renameMutation.isPending}
              data-testid="btn-rename-selected"
            >
              <Cable className="w-3 h-3" />
              {t.adminReelIdRenameBtn} ({selectedIds.size})
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-700 mr-3" />
          Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
          <CheckCircle2 className="w-10 h-10 opacity-30" />
          <p className="text-sm">{t.adminReelIdEmpty}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-3 py-2.5 w-8">
                  <Checkbox
                    checked={allReadySelected || (someReadySelected ? "indeterminate" : false)}
                    onCheckedChange={(v) => {
                      if (v === true) setSelectedIds(new Set(readyRows.map(r => r.reelDbId)));
                      else setSelectedIds(new Set());
                    }}
                    disabled={readyRows.length === 0}
                    data-testid="chk-select-all"
                    aria-label="Select all ready"
                  />
                </th>
                <th className="px-3 py-2.5 text-left font-semibold text-slate-400 uppercase tracking-wider">
                  {t.adminReelIdColCurrentId}
                </th>
                <th className="px-3 py-2.5 text-left font-semibold text-slate-400 uppercase tracking-wider">
                  {t.adminReelIdColProposedId}
                </th>
                <th className="px-3 py-2.5 text-left font-semibold text-slate-400 uppercase tracking-wider">
                  {t.adminReelIdColItem}
                </th>
                <th className="px-3 py-2.5 text-left font-semibold text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-3 py-2.5 text-left font-semibold text-slate-400 uppercase tracking-wider">
                  {t.adminReelIdColReason}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-50">
              {rows.map((row) => {
                const isSelectable = row.status === "ready";
                const isSelected = selectedIds.has(row.reelDbId);
                const isAmbiguous = row.status === "ambiguous";

                return (
                  <tr
                    key={row.reelDbId}
                    className={`transition-colors ${
                      isSelected ? "bg-brand-50/50" :
                      row.status === "conflict" ? "bg-red-50/40" :
                      row.status === "ambiguous" ? "bg-amber-50/30" :
                      row.status === "already_new_format" ? "bg-slate-50/50" :
                      "hover:bg-slate-50/50"
                    }`}
                    data-testid={`row-reel-${row.reelDbId}`}
                  >
                    <td className="px-3 py-2.5">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(v) => toggleRow(row.reelDbId, v === true)}
                        disabled={!isSelectable}
                        data-testid={`chk-reel-${row.reelDbId}`}
                        aria-label={row.currentReelId}
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <code className={`font-mono px-1.5 py-0.5 rounded text-xs ${
                        row.status === "already_new_format"
                          ? "bg-slate-100 text-slate-500"
                          : "bg-amber-100 text-amber-800"
                      }`}>
                        {row.currentReelId}
                      </code>
                    </td>
                    <td className="px-3 py-2.5">
                      {row.status === "already_new_format" ? (
                        <span className="text-slate-400 italic text-xs">—</span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <ArrowRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
                          <code className={`font-mono px-1.5 py-0.5 rounded text-xs ${
                            row.status === "conflict"
                              ? "bg-red-100 text-red-800"
                              : isAmbiguous
                              ? "bg-amber-100 text-amber-800"
                              : "bg-green-100 text-green-800"
                          }`}>
                            {row.proposedReelId}
                          </code>
                          {isAmbiguous && (
                            <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" aria-label={t.adminReelIdUnkHint} />
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="text-slate-700 truncate max-w-[180px]" title={row.itemName}>
                        {row.itemName}
                        {row.sizeLabel && (
                          <span className="ml-1 text-slate-400">({row.sizeLabel})</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 max-w-[220px] truncate" title={row.reason}>
                      {isAmbiguous ? (
                        <span className="flex items-center gap-1 text-amber-700">
                          <Info className="w-3 h-3 flex-shrink-0" />
                          {row.reason}
                        </span>
                      ) : row.status === "conflict" ? (
                        <span className="flex items-center gap-1 text-red-700">
                          <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                          {row.reason}
                        </span>
                      ) : (
                        row.reason
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Ambiguous hint */}
      {counts.ambiguous > 0 && (
        <p className="text-xs text-amber-700 flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          {t.adminReelIdUnkHint}
        </p>
      )}

      {/* Confirm dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Cable className="w-5 h-5 text-brand-600" />
              {t.adminReelIdDialogTitle}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Renaming <strong>{selectedIds.size}</strong> reel{selectedIds.size !== 1 ? "s" : ""}.
              </span>
              <span className="block text-sm">{t.adminReelIdDialogDesc}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="btn-rename-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-brand-700 hover:bg-brand-800 text-white"
              onClick={() => renameMutation.mutate(Array.from(selectedIds))}
              data-testid="btn-rename-confirm"
            >
              {renameMutation.isPending ? "Renaming…" : t.adminReelIdConfirmBtn}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
