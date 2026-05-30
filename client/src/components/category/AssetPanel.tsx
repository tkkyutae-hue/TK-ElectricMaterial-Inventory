import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { CategoryGroupedItem } from "./types";

type ToolAssetEntry = {
  id: number;
  assetTag: string;
  status: string;
  condition: string | null;
  repairNote: string | null;
  assignedTo: string | null;
  location?: { id: number; name: string } | null;
  project?: { id: number; name: string } | null;
};


interface AssetPanelProps {
  item: CategoryGroupedItem;
  isAdmin: boolean;
}

export function AssetPanel({ item, isAdmin }: AssetPanelProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showGenerate, setShowGenerate] = useState(false);

  const { data: assets = [] } = useQuery<ToolAssetEntry[]>({
    queryKey: ["/api/items", item.id, "assets"],
    queryFn: () => fetch(`/api/items/${item.id}/assets`).then(r => r.json()),
    staleTime: 30_000,
  });

  const generateMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/items/${item.id}/assets/generate-from-quantity`, {}),
    onSuccess: async (res) => {
      const data = await res.json();
      qc.invalidateQueries({ queryKey: ["/api/items", item.id, "assets"] });
      setShowGenerate(false);
      if ((data.summary?.missingCount ?? 0) === 0) {
        toast({ title: "Already complete", description: "All asset IDs are already generated." });
      } else {
        toast({ title: `Generated ${data.summary?.generated ?? data.created?.length ?? 0} asset IDs`, description: `${item.name} asset roster updated.` });
      }
    },
    onError: (err: any) => {
      toast({ title: "Generation failed", description: err.message ?? "Unknown error", variant: "destructive" });
    },
  });

  const qty = item.quantityOnHand;
  const activeCount = assets.length;
  const missingCount = Math.max(0, qty - activeCount);
  const hasSku = !!item.sku?.trim();

  const statusCounts = assets.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="border-t border-violet-100 bg-violet-50/30" data-testid={`asset-panel-${item.id}`}>
      {/* Summary bar */}
      <div className="px-5 py-3 flex flex-wrap gap-x-4 gap-y-2 items-center">
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-slate-400 font-medium">Legacy Qty:</span>
          <span className="font-semibold text-slate-900">{qty.toLocaleString()} {item.unitOfMeasure}</span>
        </div>
        <div className="w-px h-4 bg-slate-200 hidden sm:block" />
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-slate-400 font-medium">Registered:</span>
          <span className={`font-semibold ${activeCount >= qty ? "text-emerald-700" : missingCount > 0 ? "text-amber-700" : "text-slate-900"}`}>
            {activeCount} / {qty}
          </span>
        </div>
        {missingCount > 0 && (
          <span className="text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
            {missingCount} unregistered
          </span>
        )}
        {activeCount > 0 && Object.entries(statusCounts).map(([st, cnt]) => (
          <span key={st} className="text-[11px] px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 font-medium">
            {STATUS_LABELS[st] ?? st} {cnt}
          </span>
        ))}
        {isAdmin && hasSku && (
          <div className="ml-auto">
            <Button variant="outline" size="sm"
              className="h-7 px-3 text-xs border-violet-300 text-violet-700 hover:bg-violet-100 gap-1"
              onClick={() => setShowGenerate(true)}
              data-testid={`button-generate-assets-${item.id}`}
            >
              <Wand2 className="w-3 h-3" />Generate Asset IDs
            </Button>
          </div>
        )}
      </div>

      {/* Generate dialog */}
      <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-violet-600" />Generate Asset IDs
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm pt-1">
            {missingCount === 0 ? (
              <p className="text-emerald-700 font-medium text-xs bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                All {qty} assets are already registered for {item.name}.
              </p>
            ) : (
              <>
                <p className="text-slate-700">
                  Create <strong>{missingCount}</strong> new asset record{missingCount !== 1 ? "s" : ""} for <strong>{item.name}</strong>.
                </p>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1 text-xs text-slate-600">
                  <div className="flex justify-between"><span>Qty on hand:</span><span className="font-semibold">{qty}</span></div>
                  <div className="flex justify-between"><span>Already registered:</span><span className="font-semibold">{activeCount}</span></div>
                  <div className="flex justify-between text-violet-700 font-semibold border-t border-slate-200 pt-1 mt-1"><span>Will generate:</span><span>{missingCount}</span></div>
                </div>
                <p className="text-slate-400 text-xs">
                  IDs use format <code className="bg-slate-100 px-1 rounded">{item.sku}-001</code>, continuing from the last existing number.
                </p>
              </>
            )}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setShowGenerate(false)} disabled={generateMutation.isPending}>
                Cancel
              </Button>
              <Button size="sm" className="bg-violet-700 hover:bg-violet-800"
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending || missingCount === 0}
                data-testid={`button-confirm-generate-assets-${item.id}`}
              >
                {generateMutation.isPending ? "Generating…" : missingCount === 0 ? "Already complete" : `Generate ${missingCount}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
