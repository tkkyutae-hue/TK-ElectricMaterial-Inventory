import { useMemo } from "react";
import { ArrowUpRight, ArrowDownRight, Package, DollarSign } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/components/shared/EmptyState";
import { useLanguage } from "@/hooks/use-language";

function fmtValue(v: number) {
  return v > 0 ? `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";
}

export function MaterialUsageTab({ projectId }: { projectId: number }) {
  const { t } = useLanguage();
  const { data: movements = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/movements", { projectId, limit: 500 }],
    queryFn: () => fetch(`/api/movements?projectId=${projectId}&limit=500`, { credentials: "include" }).then(r => r.json()),
    enabled: !!projectId,
  });

  const grouped = useMemo(() => {
    const map: Record<string, { name: string; unit: string; issuedQty: number; returnedQty: number; unitCost: number | null }> = {};
    for (const m of movements) {
      const name = m.item?.name ?? m.itemName ?? `Item #${m.itemId}`;
      const unit = m.item?.unitOfMeasure ?? "—";
      if (!map[name]) map[name] = { name, unit, issuedQty: 0, returnedQty: 0, unitCost: null };
      const qty = Number(m.quantity ?? 0);
      if (m.movementType === "issue") {
        map[name].issuedQty += qty;
        const snap = m.unitCostSnapshot ? Number(m.unitCostSnapshot) : null;
        if (snap && snap > 0 && !map[name].unitCost) map[name].unitCost = snap;
      } else if (m.movementType === "return") {
        map[name].returnedQty += qty;
      }
    }
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  }, [movements]);

  const totalIssued   = grouped.reduce((s, g) => s + g.issuedQty, 0);
  const totalReturned = grouped.reduce((s, g) => s + g.returnedQty, 0);
  const totalNetUsed  = totalIssued - totalReturned;
  const totalValue    = grouped.reduce((s, g) => {
    const net = Math.max(0, g.issuedQty - g.returnedQty);
    return s + (g.unitCost ? net * g.unitCost : 0);
  }, 0);

  const kpiStats = [
    { label: t.projMaterialKpiIssued,   value: totalIssued.toLocaleString(),   icon: ArrowUpRight,  color: "text-brand-600",   bg: "bg-brand-50"   },
    { label: t.projMaterialKpiReturned, value: totalReturned.toLocaleString(), icon: ArrowDownRight, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: t.projMaterialKpiNetUsed,  value: totalNetUsed.toLocaleString(),  icon: Package,       color: "text-slate-600",   bg: "bg-slate-50"   },
    { label: t.projMaterialKpiValue,    value: fmtValue(totalValue),           icon: DollarSign,    color: "text-indigo-600",  bg: "bg-indigo-50"  },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {kpiStats.map((s, i) => (
          <div key={i} className="premium-card bg-white p-4 flex items-center gap-3" data-testid={`matusage-kpi-${i}`}>
            <div className={`p-2 rounded-xl ${s.bg}`}><s.icon className={`w-4 h-4 ${s.color}`} /></div>
            <div>
              <p className="text-xs text-slate-400">{s.label}</p>
              <p className="text-xl font-display font-bold text-slate-900">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="premium-card bg-white p-10 text-center text-slate-400 text-sm">{t.projMaterialLoading}</div>
      ) : grouped.length === 0 ? (
        <div className="premium-card bg-white">
          <EmptyState
            icon={<Package className="w-10 h-10" />}
            title={t.projMaterialEmptyTitle}
            description={t.projMaterialEmptyDesc}
            className="py-12"
          />
        </div>
      ) : (
        <div className="premium-card bg-white overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
            <Package className="w-4 h-4 text-slate-400" />
            <h3 className="font-semibold text-slate-900 text-sm">{t.projMaterialUsageTitle}</h3>
            <span className="text-xs text-slate-400 ml-1">({grouped.length} {grouped.length !== 1 ? t.projMaterialItemsSuffix : t.projMaterialItemSingular})</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-material-usage">
              <thead className="bg-slate-50/80 border-b border-slate-100">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs">{t.projMaterialColItem}</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs w-[60px]">{t.projMaterialColUnit}</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs w-[100px]">{t.projMaterialColIssued}</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs w-[110px]">{t.projMaterialColReturned}</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs w-[90px]">{t.projMaterialColNetUsed}</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs w-[120px]">{t.projMaterialColValue}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {grouped.map((g, i) => {
                  const netUsed = Math.max(0, g.issuedQty - g.returnedQty);
                  const value   = g.unitCost ? netUsed * g.unitCost : null;
                  return (
                    <tr key={i} data-testid={`row-matusage-${i}`} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 text-xs text-slate-800 font-medium">{g.name}</td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-100 px-2 py-0.5 rounded">{g.unit}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-mono font-semibold text-brand-700">{g.issuedQty.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-xs font-mono font-semibold text-emerald-600">
                        {g.returnedQty > 0 ? g.returnedQty.toLocaleString() : <span className="text-slate-300">0</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-mono font-bold text-slate-900">{netUsed.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-xs font-mono text-indigo-700">
                        {value !== null ? fmtValue(value) : <span className="text-slate-300">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td className="px-5 py-3 text-xs font-bold text-slate-700 uppercase tracking-wide">Total</td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-right text-xs font-bold text-brand-700 tabular-nums">{totalIssued.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-emerald-600 tabular-nums">{totalReturned.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-slate-900 tabular-nums">{totalNetUsed.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-indigo-700 tabular-nums">
                    {totalValue > 0 ? fmtValue(totalValue) : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
