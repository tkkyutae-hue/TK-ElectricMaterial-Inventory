import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Unlink, Truck, AlertTriangle, CheckCircle2, PackageSearch } from "lucide-react";

type UnlinkItem = {
  id: number;
  sku: string;
  name: string;
  quantityOnHand: number;
  unitOfMeasure: string;
  supplierId: number;
  supplierName: string;
};

type PreviewData = {
  items: UnlinkItem[];
  total: number;
};

type BySupplier = {
  id: number;
  name: string;
  items: UnlinkItem[];
};

const QK = ["/api/admin/cleanup/supplier-unlink-preview"] as const;

export default function SupplierCleanup() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  const { data, isLoading } = useQuery<PreviewData>({ queryKey: QK });
  const items = data?.items ?? [];

  const bySupplier = useMemo<BySupplier[]>(() => {
    const map = new Map<number, BySupplier>();
    for (const item of items) {
      if (!map.has(item.supplierId)) {
        map.set(item.supplierId, { id: item.supplierId, name: item.supplierName, items: [] });
      }
      map.get(item.supplierId)!.items.push(item);
    }
    return [...map.values()].sort((a, b) => b.items.length - a.items.length);
  }, [items]);

  const unlinkMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/cleanup/supplier-unlink", {});
      return res.json() as Promise<{ unlinked: number }>;
    },
    onSuccess: (result) => {
      setDone(result.unlinked);
      toast({
        title: "공급사 연결 제거 완료",
        description: `${result.unlinked}개 아이템의 공급사 링크를 제거했습니다.`,
      });
      queryClient.invalidateQueries({ queryKey: QK });
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
    },
    onError: (err: Error) => {
      toast({
        title: "실패",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-display font-bold text-slate-900 flex items-center gap-2">
          <Unlink className="w-6 h-6 text-slate-500" />
          {t.navSupplierCleanup}
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          트랜잭션(입고) 기록이 없는 아이템의 공급사 연결을 해제합니다. 재고 수량은 유지됩니다.
        </p>
      </div>

      {done !== null ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <CheckCircle2 className="w-12 h-12 text-green-500" />
          <p className="text-lg font-semibold text-slate-800">클린업 완료</p>
          <p className="text-slate-500 text-sm">{done}개 아이템의 공급사 연결이 제거됐습니다.</p>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-700 mr-3" />
          불러오는 중…
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
          <PackageSearch className="w-10 h-10 opacity-30" />
          <p className="text-sm">트랜잭션 없는 공급사 연결 아이템이 없습니다.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="outline" className="text-xs text-slate-600 border-slate-300">
                총 {items.length}개 아이템
              </Badge>
              <Badge variant="outline" className="text-xs text-amber-700 border-amber-300 bg-amber-50">
                <Truck className="w-3 h-3 mr-1" />
                {bySupplier.length}개 공급사
              </Badge>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="gap-2"
              onClick={() => setConfirmOpen(true)}
              disabled={unlinkMutation.isPending}
              data-testid="btn-supplier-unlink-run"
            >
              <Unlink className="w-3.5 h-3.5" />
              공급사 연결 전체 해제
            </Button>
          </div>

          <div className="space-y-4">
            {bySupplier.map(supplier => (
              <div key={supplier.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                  <Truck className="w-4 h-4 text-slate-400" />
                  <span className="font-semibold text-slate-700 text-sm">{supplier.name}</span>
                  <Badge variant="outline" className="ml-auto text-[10px] text-slate-500 border-slate-300">
                    {supplier.items.length}개
                  </Badge>
                </div>

                <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-50/50 border-b border-slate-100 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  <div className="col-span-3">SKU</div>
                  <div className="col-span-6">Name</div>
                  <div className="col-span-3 text-right">On Hand</div>
                </div>

                <div className="divide-y divide-slate-50">
                  {supplier.items.map(item => (
                    <div
                      key={item.id}
                      className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center text-sm hover:bg-slate-50/50 transition-colors"
                      data-testid={`row-supplier-cleanup-${item.id}`}
                    >
                      <div className="col-span-3">
                        <code className="text-xs font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {item.sku}
                        </code>
                      </div>
                      <div className="col-span-6 text-slate-700 truncate text-xs" title={item.name}>
                        {item.name}
                      </div>
                      <div className="col-span-3 text-right">
                        {item.quantityOnHand > 0 ? (
                          <span className="text-xs font-medium text-amber-700 flex items-center justify-end gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {item.quantityOnHand.toLocaleString()} {item.unitOfMeasure}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">0 {item.unitOfMeasure}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-slate-400 flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-amber-500" />
            재고 수량은 그대로 유지됩니다. 공급사 연결(supplier_id)만 제거됩니다.
          </p>
        </>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-700">
              <Unlink className="w-5 h-5" />
              공급사 연결 해제 확인
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                트랜잭션 기록이 없는 <strong>{items.length}개</strong> 아이템의 공급사 연결을 해제합니다.
              </span>
              <span className="block text-amber-700 font-medium">
                재고 수량은 유지됩니다. 이 작업은 되돌릴 수 없습니다.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="btn-supplier-unlink-cancel">취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => unlinkMutation.mutate()}
              data-testid="btn-supplier-unlink-confirm"
            >
              해제 실행
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
