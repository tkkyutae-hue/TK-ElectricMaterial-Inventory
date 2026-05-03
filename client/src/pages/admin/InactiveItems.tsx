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
import { Trash2, PackageX, History, AlertTriangle } from "lucide-react";

type InactiveItem = {
  id: number;
  sku: string;
  name: string;
  quantityOnHand: number;
  updatedAt: string;
  movementCount: number;
  txCount: number;
  hasMoveHistory: boolean;
};

export default function InactiveItems() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data, isLoading } = useQuery<{ items: InactiveItem[] }>({
    queryKey: ["/api/admin/inactive-items"],
  });

  const items = data?.items ?? [];
  const purgeable = useMemo(() => items.filter(i => !i.hasMoveHistory), [items]);
  const blocked = useMemo(() => items.filter(i => i.hasMoveHistory), [items]);

  const allPurgeableSelected =
    purgeable.length > 0 && purgeable.every(i => selectedIds.has(i.id));
  const somePurgeableSelected =
    purgeable.some(i => selectedIds.has(i.id)) && !allPurgeableSelected;

  const handleToggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(purgeable.map(i => i.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggle = useCallback((id: number, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const purgeMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await apiRequest("DELETE", "/api/admin/items/purge", { ids });
      return res.json() as Promise<{ deleted: number }>;
    },
    onSuccess: (result) => {
      toast({
        title: t.adminInactiveToastSuccess,
        description: `${result.deleted} ${t.adminInactiveToastSuccessDesc}`,
      });
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inactive-items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
    },
    onError: (err: Error) => {
      toast({
        title: t.adminInactiveToastFail,
        description: err.message ?? t.adminInactiveToastFailDesc,
        variant: "destructive",
      });
    },
  });

  const selectedCount = selectedIds.size;
  const selectedQty = items
    .filter(i => selectedIds.has(i.id))
    .reduce((sum, i) => sum + i.quantityOnHand, 0);

  function formatDate(s: string) {
    const d = new Date(s);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "2-digit", day: "2-digit" });
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-display font-bold text-slate-900 flex items-center gap-2">
          <PackageX className="w-6 h-6 text-slate-500" />
          {t.adminInactiveTitle}
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          {t.adminInactiveSubtitle}
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-700 mr-3" />
          {t.adminInactiveLoading}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
          <PackageX className="w-10 h-10 opacity-30" />
          <p className="text-sm">{t.adminInactiveEmpty}</p>
        </div>
      ) : (
        <>
          {/* Summary bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="outline" className="text-xs text-slate-600 border-slate-300">
              {t.adminInactiveTotal} {items.length}{t.adminInactiveCountUnit}
            </Badge>
            <Badge variant="outline" className="text-xs text-green-700 border-green-300 bg-green-50">
              {t.adminInactiveCanPurge} {purgeable.length}{t.adminInactiveCountUnit}
            </Badge>
            {blocked.length > 0 && (
              <Badge variant="outline" className="text-xs text-amber-700 border-amber-300 bg-amber-50">
                <History className="w-3 h-3 mr-1" />
                {t.adminInactiveHasHistory} {blocked.length}{t.adminInactiveCountUnit}
              </Badge>
            )}
          </div>

          {/* Action bar */}
          {selectedCount > 0 && (
            <div
              className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3"
              data-testid="inactive-action-bar"
            >
              <span className="text-sm font-medium text-red-800 flex-1">
                {selectedCount}{t.adminInactiveCountUnit} {t.adminInactiveSelected}
                {selectedQty > 0 && (
                  <span className="ml-1 text-red-600 font-normal">
                    ({selectedQty} {t.adminInactiveStockSuffix})
                  </span>
                )}
              </span>
              <Button
                variant="destructive"
                size="sm"
                className="gap-1.5"
                onClick={() => setConfirmOpen(true)}
                disabled={purgeMutation.isPending}
                data-testid="btn-purge-selected"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t.adminInactivePurgeBtn}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
                data-testid="btn-purge-deselect-all"
              >
                {t.adminInactiveDeselect}
              </Button>
            </div>
          )}

          {/* Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            {/* Header */}
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-[10px] font-semibold text-slate-400 uppercase tracking-wider items-center">
              <div className="col-span-1 flex items-center">
                {purgeable.length > 0 && (
                  <Checkbox
                    checked={allPurgeableSelected || (somePurgeableSelected ? "indeterminate" : false)}
                    onCheckedChange={v => handleToggleAll(v === true)}
                    data-testid="chk-select-all-purgeable"
                    aria-label={t.adminInactiveSelectAllAria}
                  />
                )}
              </div>
              <div className="col-span-2">SKU</div>
              <div className="col-span-3">{t.adminInactiveColName}</div>
              <div className="col-span-1 text-right">{t.adminInactiveColStock}</div>
              <div className="col-span-2 text-center">{t.adminInactiveColMovements}</div>
              <div className="col-span-2 text-center">{t.adminInactiveColStatus}</div>
              <div className="col-span-1 text-right">{t.adminInactiveColDeactivated}</div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-slate-100">
              {items.map(item => {
                const isSelected = selectedIds.has(item.id);
                const canSelect = !item.hasMoveHistory;

                return (
                  <div
                    key={item.id}
                    className={`grid grid-cols-12 gap-2 px-4 py-3 items-center text-sm transition-colors ${
                      isSelected ? "bg-red-50/60" : canSelect ? "hover:bg-slate-50/60" : "opacity-70"
                    }`}
                    data-testid={`row-inactive-${item.id}`}
                  >
                    <div className="col-span-1 flex items-center">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={v => handleToggle(item.id, v === true)}
                        disabled={!canSelect}
                        data-testid={`chk-inactive-${item.id}`}
                        aria-label={`${item.sku} ${t.adminInactiveSelectAria}`}
                      />
                    </div>

                    <div className="col-span-2">
                      <code className="text-xs font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        {item.sku}
                      </code>
                    </div>

                    <div className="col-span-3 text-slate-700 truncate text-xs" title={item.name}>
                      {item.name || <span className="text-slate-400 italic">{t.adminInactiveNoName}</span>}
                    </div>

                    <div className="col-span-1 text-right">
                      {item.quantityOnHand > 0 ? (
                        <span className="text-xs font-medium text-amber-700 flex items-center justify-end gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {item.quantityOnHand}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">0</span>
                      )}
                    </div>

                    <div className="col-span-2 flex justify-center" data-testid={`move-count-${item.id}`}>
                      {item.movementCount > 0 || item.txCount > 0 ? (
                        <span className="text-xs text-amber-700 flex items-center gap-1">
                          <History className="w-3 h-3" />
                          {item.movementCount + item.txCount} {t.adminInactiveMovementsCount}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </div>

                    <div className="col-span-2 flex justify-center">
                      {item.hasMoveHistory ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] text-amber-700 border-amber-300 bg-amber-50 gap-1"
                          data-testid={`badge-history-${item.id}`}
                        >
                          <History className="w-2.5 h-2.5" />
                          {t.adminInactiveStatusHasHistory}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-[10px] text-green-700 border-green-300 bg-green-50"
                          data-testid={`badge-safe-${item.id}`}
                        >
                          {t.adminInactiveStatusCanPurge}
                        </Badge>
                      )}
                    </div>

                    <div className="col-span-1 text-right text-xs text-slate-400">
                      {item.updatedAt ? formatDate(item.updatedAt) : "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {blocked.length > 0 && (
            <p className="text-xs text-slate-400 flex items-start gap-1.5">
              <History className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-amber-500" />
              {t.adminInactiveBlockedNote}
            </p>
          )}
        </>
      )}

      {/* Confirm dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-700">
              <Trash2 className="w-5 h-5" />
              {t.adminInactiveConfirmTitle}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                {t.adminInactiveConfirmDescPrefix} <strong>{selectedCount}</strong> {t.adminInactiveConfirmDescSuffix}
              </span>
              {selectedQty > 0 && (
                <span className="block text-amber-700 font-medium">
                  {t.adminInactiveConfirmStockWarn} {selectedQty} {t.adminInactiveConfirmStockWarn2}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="btn-purge-cancel">{t.cmnCancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => purgeMutation.mutate([...selectedIds])}
              data-testid="btn-purge-confirm"
            >
              {t.adminInactivePurgeBtn}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
