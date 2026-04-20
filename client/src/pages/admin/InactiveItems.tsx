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
        title: "영구 삭제 완료",
        description: `${result.deleted}개 아이템이 데이터베이스에서 완전히 제거되었습니다.`,
      });
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/admin/inactive-items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/items"] });
    },
    onError: (err: Error) => {
      toast({
        title: "삭제 실패",
        description: err.message ?? "오류가 발생했습니다.",
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
    return d.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-display font-bold text-slate-900 flex items-center gap-2">
          <PackageX className="w-6 h-6 text-slate-500" />
          비활성 자재 관리
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          인벤토리에서 제외된 자재 목록입니다. 이동 기록이 없는 자재는 영구 삭제할 수 있습니다.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-700 mr-3" />
          불러오는 중…
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
          <PackageX className="w-10 h-10 opacity-30" />
          <p className="text-sm">비활성 자재가 없습니다.</p>
        </div>
      ) : (
        <>
          {/* Summary bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="outline" className="text-xs text-slate-600 border-slate-300">
              총 {items.length}개
            </Badge>
            <Badge variant="outline" className="text-xs text-green-700 border-green-300 bg-green-50">
              삭제 가능 {purgeable.length}개
            </Badge>
            {blocked.length > 0 && (
              <Badge variant="outline" className="text-xs text-amber-700 border-amber-300 bg-amber-50">
                <History className="w-3 h-3 mr-1" />
                기록 있음 {blocked.length}개
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
                {selectedCount}개 선택됨
                {selectedQty > 0 && (
                  <span className="ml-1 text-red-600 font-normal">
                    (재고 {selectedQty}개 포함 — 완전히 제거됩니다)
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
                영구 삭제
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
                data-testid="btn-purge-deselect-all"
              >
                선택 해제
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
                    aria-label="삭제 가능한 아이템 전체 선택"
                  />
                )}
              </div>
              <div className="col-span-2">SKU</div>
              <div className="col-span-4">아이템명</div>
              <div className="col-span-1 text-right">재고</div>
              <div className="col-span-2 text-center">상태</div>
              <div className="col-span-2 text-right">비활성화 날짜</div>
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
                        aria-label={`${item.sku} 선택`}
                      />
                    </div>

                    <div className="col-span-2">
                      <code className="text-xs font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        {item.sku}
                      </code>
                    </div>

                    <div className="col-span-4 text-slate-700 truncate text-xs" title={item.name}>
                      {item.name || <span className="text-slate-400 italic">(이름 없음)</span>}
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

                    <div className="col-span-2 flex justify-center">
                      {item.hasMoveHistory ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] text-amber-700 border-amber-300 bg-amber-50 gap-1"
                          data-testid={`badge-history-${item.id}`}
                        >
                          <History className="w-2.5 h-2.5" />
                          기록 있음
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-[10px] text-green-700 border-green-300 bg-green-50"
                          data-testid={`badge-safe-${item.id}`}
                        >
                          삭제 가능
                        </Badge>
                      )}
                    </div>

                    <div className="col-span-2 text-right text-xs text-slate-400">
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
              "기록 있음" 아이템은 이동/프로젝트 거래 내역이 있어 영구 삭제할 수 없습니다.
              이력 보존을 위해 비활성 상태로만 유지됩니다.
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
              영구 삭제 확인
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                선택한 <strong>{selectedCount}개</strong> 아이템을 데이터베이스에서 완전히 삭제합니다.
                이 작업은 되돌릴 수 없습니다.
              </span>
              {selectedQty > 0 && (
                <span className="block text-amber-700 font-medium">
                  ⚠ 선택된 아이템에 총 {selectedQty}개의 재고가 포함되어 있습니다.
                  삭제 시 해당 재고 정보도 함께 제거됩니다.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="btn-purge-cancel">취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => purgeMutation.mutate([...selectedIds])}
              data-testid="btn-purge-confirm"
            >
              영구 삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
