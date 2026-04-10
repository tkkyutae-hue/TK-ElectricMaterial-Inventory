import { useState, Fragment } from "react";
import { format } from "date-fns";
import { ChevronRight, Hash, CheckCircle2, TrendingUp, AlertCircle, ListTodo } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

function DrillDownRows({
  entries, unit, estQty,
}: {
  entries: { reportId: number; reportNumber: string | null; reportDate: string; preparedBy: string | null; qty: number; runningTotal: number }[];
  unit: string;
  estQty: number;
}) {
  if (entries.length === 0) {
    return (
      <tr>
        <td />
        <td colSpan={6} className="px-4 pb-3 pt-0">
          <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs text-slate-400 italic">
            No submitted reports have logged quantities for this item yet.
          </div>
        </td>
      </tr>
    );
  }
  return (
    <tr>
      <td />
      <td colSpan={6} className="px-4 pb-4 pt-0">
        <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-[90px_110px_1fr_90px_110px] gap-0 bg-slate-100/80 border-b border-slate-200 px-4 py-2">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Report #</span>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Date</span>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Prepared By</span>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-right">Qty</span>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-right">Running Total</span>
          </div>
          {entries.map((e, i) => {
            const pct = estQty > 0 ? Math.min(100, Math.round((e.runningTotal / estQty) * 1000) / 10) : 0;
            return (
              <div
                key={`${e.reportId}-${i}`}
                className="grid grid-cols-[90px_110px_1fr_90px_110px] gap-0 px-4 py-2.5 border-b border-slate-100 last:border-0 hover:bg-white/70 transition-colors"
              >
                <span className="text-xs font-mono font-semibold text-brand-700">
                  {e.reportNumber ? `#${e.reportNumber}` : `ID ${e.reportId}`}
                </span>
                <span className="text-xs text-slate-600">
                  {e.reportDate ? format(new Date(e.reportDate + "T00:00:00"), "MMM d, yyyy") : "—"}
                </span>
                <span className="text-xs text-slate-600 truncate pr-2">{e.preparedBy || <span className="text-slate-300 italic">—</span>}</span>
                <span className="text-xs font-semibold text-emerald-700 tabular-nums text-right">
                  +{e.qty.toLocaleString()} {unit}
                </span>
                <div className="flex items-center justify-end gap-1.5">
                  <span className="text-xs tabular-nums text-slate-700 font-medium">{e.runningTotal.toLocaleString()}</span>
                  <span className="text-[10px] text-slate-400 font-mono">({pct.toFixed(1)}%)</span>
                </div>
              </div>
            );
          })}
          <div className="px-4 py-2 bg-slate-100/60 border-t border-slate-200 flex items-center justify-between">
            <span className="text-[10px] text-slate-400">{entries.length} submitted report{entries.length !== 1 ? "s" : ""} contributed</span>
            <span className="text-xs font-bold text-emerald-700">
              Total: {entries[entries.length - 1]?.runningTotal?.toLocaleString() ?? 0} / {estQty.toLocaleString()} {unit}
            </span>
          </div>
        </div>
      </td>
    </tr>
  );
}

export function ProgressTab({ projectId }: { projectId: number }) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const { data, isLoading } = useQuery<{
    scopeItems: any[];
    progress: Record<number, { cumulative: number; remaining: number; pct: number; todayAdded: number; completedBeforeToday: number }>;
    drillDown: Record<number, { reportId: number; reportNumber: string | null; reportDate: string; preparedBy: string | null; qty: number; runningTotal: number }[]>;
    summary: { overallPct: number; estTotal: number; installed: number; remaining: number; todayAdded: number };
  }>({
    queryKey: ["/api/projects", projectId, "progress"],
    queryFn: () => fetch(`/api/projects/${projectId}/progress`, { credentials: "include" }).then(r => r.json()),
  });

  if (isLoading) return <div className="p-8 text-center text-slate-400">Loading progress…</div>;

  const scopeItems = data?.scopeItems ?? [];
  const progress   = data?.progress ?? {};
  const drillDown  = data?.drillDown ?? {};
  const summary    = data?.summary ?? { overallPct: 0, estTotal: 0, installed: 0, remaining: 0, todayAdded: 0 };
  const hasScopes  = scopeItems.length > 0;

  const summaryPctColor =
    summary.overallPct >= 100 ? "text-emerald-600" :
    summary.overallPct >= 70  ? "text-brand-600"   :
    summary.overallPct >= 40  ? "text-blue-600"    : "text-slate-500";

  function toggleRow(id: number) {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-5">
      {!hasScopes && (
        <div className="premium-card bg-white p-12 text-center">
          <TrendingUp className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No scope items defined</p>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
            Add scope items in the <strong>Scope Items</strong> tab to enable progress tracking.
          </p>
        </div>
      )}

      {hasScopes && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="premium-card bg-white p-4 col-span-2 sm:col-span-1 lg:col-span-2 flex flex-col items-center justify-center gap-1" data-testid="progress-overall">
              <p className="text-xs text-slate-400 uppercase tracking-wide">Overall Progress</p>
              <p className={`text-4xl font-display font-bold ${summaryPctColor}`}>{summary.overallPct.toFixed(1)}%</p>
              {(() => {
                const prevInstalled = Math.max(0, summary.installed - summary.todayAdded);
                const prevPct = summary.estTotal > 0 ? Math.min(100, (prevInstalled / summary.estTotal) * 100) : 0;
                const todayPct = summary.estTotal > 0 ? Math.min(100 - prevPct, (summary.todayAdded / summary.estTotal) * 100) : 0;
                return (
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden relative mt-1">
                    <div className="absolute left-0 top-0 h-full bg-emerald-500" style={{ width: `${prevPct}%` }} />
                    <div className="absolute top-0 h-full bg-brand-400" style={{ left: `${prevPct}%`, width: `${todayPct}%` }} />
                  </div>
                );
              })()}
              {summary.todayAdded > 0 && (
                <div className="flex gap-3 mt-1">
                  <span className="flex items-center gap-1 text-[9px] text-emerald-600"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Prev</span>
                  <span className="flex items-center gap-1 text-[9px] text-brand-600"><span className="w-2 h-2 rounded-full bg-brand-400 inline-block" />Today</span>
                </div>
              )}
            </div>
            {[
              { label: "Est. Total",      value: summary.estTotal.toLocaleString(),                             icon: Hash,          color: "text-slate-600",   bg: "bg-slate-50"   },
              { label: "Installed",       value: summary.installed.toLocaleString(),                            icon: CheckCircle2,  color: "text-emerald-600", bg: "bg-emerald-50" },
              { label: "Today Added",     value: summary.todayAdded > 0 ? `+${summary.todayAdded.toLocaleString()}` : "0",   icon: TrendingUp,    color: "text-brand-600",   bg: "bg-brand-50"   },
              { label: "Remaining",       value: summary.remaining.toLocaleString(),                            icon: AlertCircle,   color: "text-amber-600",   bg: "bg-amber-50"   },
              { label: "Scope Items",     value: scopeItems.length.toLocaleString(),                            icon: ListTodo,      color: "text-indigo-600",  bg: "bg-indigo-50"  },
            ].map((s, i) => (
              <div key={i} className="premium-card bg-white p-4 flex items-start gap-3" data-testid={`progress-kpi-${i}`}>
                <div className={`p-2 rounded-xl ${s.bg}`}><s.icon className={`w-4 h-4 ${s.color}`} /></div>
                <div>
                  <p className="text-xs text-slate-400">{s.label}</p>
                  <p className="text-xl font-display font-bold text-slate-900">{s.value}</p>
                </div>
              </div>
            ))}
          </div>

          {summary.installed === 0 && (
            <div className="premium-card bg-white px-5 py-4 flex items-center gap-3 text-sm text-amber-700 bg-amber-50/40 border border-amber-100">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>No submitted daily reports yet — submit a report with linked scope items to see progress update.</span>
            </div>
          )}

          <div className="premium-card bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Progress by Scope Item</h3>
                <p className="text-xs text-slate-400 mt-0.5">Click any row to see which submitted reports contributed to that item's total</p>
              </div>
              {expandedRows.size > 0 && (
                <button
                  onClick={() => setExpandedRows(new Set())}
                  className="text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2 transition-colors"
                >
                  Collapse all
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/80">
                  <tr>
                    <th className="w-9 px-2" />
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 w-[24%]">Item</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 w-[7%]">Unit</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600 w-[10%]">Est. Qty</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600 w-[10%] text-emerald-600">Before Today</th>
                    <th className="text-right px-4 py-3 font-semibold text-brand-600 w-[10%]">Today</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600 w-[10%]">Total</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600 w-[10%]">Remaining</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {scopeItems.map((scope) => {
                    const p = progress[scope.id] ?? { cumulative: 0, remaining: parseFloat(String(scope.estimatedQty)), pct: 0, todayAdded: 0, completedBeforeToday: 0 };
                    const estQty = parseFloat(String(scope.estimatedQty));
                    const entries = drillDown[scope.id] ?? [];
                    const isExpanded = expandedRows.has(scope.id);
                    const hasDrillDown = p.cumulative > 0;

                    const prevPct  = estQty > 0 ? Math.min(100, (p.completedBeforeToday / estQty) * 100) : 0;
                    const todayPct = estQty > 0 ? Math.min(100 - prevPct, (p.todayAdded / estQty) * 100) : 0;

                    return (
                      <Fragment key={scope.id}>
                        <tr
                          data-testid={`progress-row-${scope.id}`}
                          onClick={() => hasDrillDown && toggleRow(scope.id)}
                          className={[
                            "transition-colors border-b border-slate-100",
                            hasDrillDown ? "cursor-pointer" : "",
                            isExpanded ? "bg-brand-50/30 border-b-0" : hasDrillDown ? "hover:bg-slate-50" : "",
                            !scope.isActive ? "opacity-50" : "",
                          ].join(" ")}
                        >
                          <td className="px-2 py-3.5 text-center">
                            {hasDrillDown ? (
                              <span className={`inline-flex items-center justify-center w-5 h-5 rounded transition-transform text-slate-400 ${isExpanded ? "rotate-90 text-brand-600" : ""}`}>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </span>
                            ) : (
                              <span className="inline-block w-5 h-5" />
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            <p className="font-medium text-slate-900">{scope.itemName}</p>
                            {scope.category && <p className="text-xs text-slate-400">{scope.category}</p>}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="font-mono text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-100 px-2 py-0.5 rounded">{scope.unit}</span>
                          </td>
                          <td className="px-4 py-3.5 text-right tabular-nums text-slate-700">{estQty.toLocaleString()}</td>
                          <td className="px-4 py-3.5 text-right tabular-nums text-emerald-700 font-medium">
                            {p.completedBeforeToday > 0 ? p.completedBeforeToday.toLocaleString() : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-3.5 text-right tabular-nums text-brand-600 font-medium">
                            {p.todayAdded > 0 ? `+${p.todayAdded.toLocaleString()}` : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-slate-800">
                            {p.cumulative > 0 ? (
                              <span className="flex items-center justify-end gap-1">
                                {p.cumulative.toLocaleString()}
                                {entries.length > 0 && (
                                  <span className="text-[10px] font-normal text-slate-400 ml-0.5">({entries.length}r)</span>
                                )}
                              </span>
                            ) : (
                              <span className="text-slate-300">0</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right tabular-nums text-amber-700">{p.remaining.toLocaleString()}</td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-slate-100 rounded-full h-2 min-w-[60px] relative overflow-hidden">
                                <div className="absolute left-0 top-0 h-full bg-emerald-500 transition-all" style={{ width: `${prevPct}%` }} />
                                <div className="absolute top-0 h-full bg-brand-400 transition-all" style={{ left: `${prevPct}%`, width: `${todayPct}%` }} />
                              </div>
                              <span className={`text-xs font-bold tabular-nums w-12 text-right ${
                                p.pct >= 100 ? "text-emerald-600" : p.pct > 0 ? "text-brand-600" : "text-slate-400"
                              }`}>
                                {p.pct.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                        </tr>

                        {isExpanded && (
                          <DrillDownRows entries={entries} unit={scope.unit} estQty={estQty} />
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
