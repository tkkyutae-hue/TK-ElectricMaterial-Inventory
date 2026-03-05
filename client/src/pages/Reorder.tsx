import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { ShoppingCart, RefreshCw, CheckCircle, XCircle, AlertTriangle, AlertCircle, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

async function fetchJson(url: string) {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

const priorityConfig: Record<string, { label: string; className: string; icon: any }> = {
  critical: { label: "Critical", className: "bg-rose-100 text-rose-700 border-rose-200", icon: AlertCircle },
  high: { label: "High", className: "bg-orange-100 text-orange-700 border-orange-200", icon: AlertTriangle },
  medium: { label: "Medium", className: "bg-amber-100 text-amber-700 border-amber-200", icon: Package },
  low: { label: "Low", className: "bg-slate-100 text-slate-600 border-slate-200", icon: Package },
};

function PriorityBadge({ level }: { level: string }) {
  const cfg = priorityConfig[level] || priorityConfig.low;
  return (
    <Badge variant="outline" className={`${cfg.className} text-xs font-bold flex items-center gap-1 w-fit`}>
      <cfg.icon className="w-3 h-3" />{cfg.label}
    </Badge>
  );
}

export default function Reorder() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");

  const { data: recommendations, isLoading } = useQuery({
    queryKey: [api.reorder.recommendations.path],
    queryFn: () => fetchJson(api.reorder.recommendations.path),
  });

  const generateMutation = useMutation({
    mutationFn: () => fetch('/api/reorder/generate', { method: 'POST', credentials: 'include' }).then(r => r.json()),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: [api.reorder.recommendations.path] });
      toast({ title: "Recommendations generated", description: `${data.length} item${data.length !== 1 ? 's' : ''} need attention.` });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await fetch(`/api/reorder/recommendations/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [api.reorder.recommendations.path] }),
  });

  const filtered = recommendations?.filter((r: any) => filter === "all" || r.priorityLevel === filter);

  const criticalCount = recommendations?.filter((r: any) => r.priorityLevel === 'critical').length || 0;
  const highCount = recommendations?.filter((r: any) => r.priorityLevel === 'high').length || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Reorder & Purchasing</h1>
          <p className="text-slate-500 mt-1">Items that need to be ordered based on current stock levels.</p>
        </div>
        <Button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="bg-brand-700 hover:bg-brand-800 text-white shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${generateMutation.isPending ? 'animate-spin' : ''}`} />
          Refresh Recommendations
        </Button>
      </div>

      {(criticalCount > 0 || highCount > 0) && (
        <div className="grid grid-cols-2 gap-4">
          {criticalCount > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 flex items-center gap-4">
              <AlertCircle className="w-8 h-8 text-rose-500 flex-shrink-0" />
              <div>
                <p className="font-bold text-rose-900 text-lg">{criticalCount} Critical</p>
                <p className="text-rose-700 text-sm">Items completely out of stock</p>
              </div>
            </div>
          )}
          {highCount > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 flex items-center gap-4">
              <AlertTriangle className="w-8 h-8 text-orange-500 flex-shrink-0" />
              <div>
                <p className="font-bold text-orange-900 text-lg">{highCount} High Priority</p>
                <p className="text-orange-700 text-sm">Critically low stock levels</p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="premium-card bg-white overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex gap-2">
          {["all", "critical", "high", "medium", "low"].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${filter === f ? 'bg-brand-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {f === "all" ? "All" : f}
            </button>
          ))}
        </div>

        <Table>
          <TableHeader className="bg-slate-50/80">
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-semibold text-slate-600">Priority</TableHead>
              <TableHead className="font-semibold text-slate-600">Item</TableHead>
              <TableHead className="font-semibold text-slate-600 text-right">On Hand</TableHead>
              <TableHead className="font-semibold text-slate-600 text-right">Reorder Pt</TableHead>
              <TableHead className="font-semibold text-slate-600 text-right">Order Qty</TableHead>
              <TableHead className="font-semibold text-slate-600">Supplier</TableHead>
              <TableHead className="font-semibold text-slate-600">Reason</TableHead>
              <TableHead className="font-semibold text-slate-600 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [1,2,3].map(i => (
                <TableRow key={i}>
                  {[...Array(8)].map((_, j) => (
                    <TableCell key={j}><div className="h-4 bg-slate-100 rounded animate-pulse" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : !filtered?.length ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-16 text-slate-500">
                  <ShoppingCart className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="font-semibold text-slate-900">No reorder recommendations</p>
                  <p className="text-sm mt-1">All stock levels are above reorder points.</p>
                  <Button variant="outline" className="mt-4" onClick={() => generateMutation.mutate()}>
                    Check Now
                  </Button>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((rec: any) => (
                <TableRow key={rec.id} className="hover:bg-slate-50/50">
                  <TableCell><PriorityBadge level={rec.priorityLevel} /></TableCell>
                  <TableCell>
                    <Link href={`/inventory/${rec.item?.id}`}>
                      <p className="font-medium text-slate-900 hover:text-brand-600">{rec.item?.name}</p>
                      <p className="text-xs font-mono text-slate-400">{rec.item?.sku}</p>
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={rec.item?.quantityOnHand === 0 ? 'text-rose-600 font-bold' : 'text-amber-600 font-semibold'}>
                      {rec.item?.quantityOnHand}
                    </span>
                    <span className="text-slate-400 text-xs ml-1">{rec.item?.unitOfMeasure}</span>
                  </TableCell>
                  <TableCell className="text-right text-slate-600">{rec.item?.reorderPoint}</TableCell>
                  <TableCell className="text-right font-semibold text-brand-700">{rec.recommendedQuantity}</TableCell>
                  <TableCell className="text-sm text-slate-600">{rec.supplier?.name || <span className="text-slate-300">—</span>}</TableCell>
                  <TableCell className="text-xs text-slate-500 max-w-[120px] truncate">{rec.reason}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs text-emerald-600 hover:bg-emerald-50 border-emerald-200"
                        onClick={() => updateStatusMutation.mutate({ id: rec.id, status: 'ordered' })}
                      >
                        <CheckCircle className="w-3 h-3 mr-1" />Ordered
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-slate-400 hover:text-rose-500"
                        onClick={() => updateStatusMutation.mutate({ id: rec.id, status: 'dismissed' })}
                      >
                        <XCircle className="w-3 h-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
