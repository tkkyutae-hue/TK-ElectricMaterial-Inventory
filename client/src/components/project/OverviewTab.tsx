import { useState, useMemo } from "react";
import { format } from "date-fns";
import { useLocation } from "wouter";
import {
  ArrowUpRight, ArrowDownRight, Package, DollarSign, FileText, TrendingUp,
  Hash, LayoutList, Clock, MapPin, Calendar, Plus, Filter, Download,
  Users, ListTodo, Pencil, Eye, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { MovementTypeBadge } from "@/components/StatusBadge";
import { statusConfig } from "./types";

const TXN_PAGE_SIZE = 10;

function exportReportCsv(report: any, projectName: string) {
  const fd = report.formData ?? {};
  const rows: string[][] = [];
  rows.push(["VoltStock — Daily Report Export"]);
  rows.push(["Project:", projectName]);
  rows.push(["Report No.:", report.reportNumber ?? "—"]);
  rows.push(["Report Date:", report.reportDate ?? "—"]);
  rows.push(["Prepared By:", fd.preparedBy ?? "—"]);
  rows.push(["Shift:", fd.shift ?? "—"]);
  rows.push(["Weather:", fd.weather ?? "—"]);
  rows.push([]);
  rows.push(["── MANPOWER ──"]);
  rows.push(["Worker", "Trade", "Status", "Start", "End", "Hours", "Notes"]);
  (fd.manpower ?? []).forEach((r: any) =>
    rows.push([r.workerName ?? "", r.trade ?? "", r.attendanceStatus ?? "", r.startTime ?? "", r.endTime ?? "", String(r.hoursWorked ?? 0), r.notes ?? ""])
  );
  const totalHrs = (fd.manpower ?? []).reduce((s: number, r: any) => s + Number(r.hoursWorked ?? 0), 0);
  rows.push(["", "", "", "", "TOTAL HOURS", String(totalHrs)]);
  rows.push([]);
  rows.push(["── WORK TASKS ──"]);
  rows.push(["#", "Description", "Location", "Qty", "Unit", "Notes"]);
  (fd.tasks ?? []).forEach((t: any, i: number) =>
    rows.push([String(i + 1), t.description ?? "", t.location ?? "", String(t.qty ?? ""), t.unit ?? "", t.notes ?? ""])
  );
  rows.push([]);
  rows.push(["── MATERIALS ──"]);
  rows.push(["Material", "Unit", "Qty Used", "Notes"]);
  (fd.materials ?? []).forEach((m: any) =>
    rows.push([m.description ?? "", m.unit ?? "", String(m.qty ?? ""), m.notes ?? ""])
  );
  rows.push([]);
  rows.push(["── EQUIPMENT ──"]);
  rows.push(["Equipment", "Qty", "Hours", "Notes"]);
  (fd.equipment ?? []).forEach((e: any) =>
    rows.push([e.description ?? "", String(e.qty ?? ""), String(e.hours ?? ""), e.notes ?? ""])
  );
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `report-${report.reportNumber ?? report.id}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function ReportStatusBadge({ status }: { status: string }) {
  if (status === "submitted") return (
    <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 px-2 py-0.5 font-semibold">
      Submitted
    </Badge>
  );
  return (
    <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 px-2 py-0.5 font-semibold">
      Draft
    </Badge>
  );
}

export function OverviewTab({ project, projectId }: { project: any; projectId: number }) {
  const [txnPage, setTxnPage] = useState(0);

  const { data: reports = [] } = useQuery<any[]>({
    queryKey: ["/api/daily-reports", projectId],
    queryFn: () => fetch(`/api/daily-reports?projectId=${projectId}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!projectId,
  });
  const { data: allMovements = [] } = useQuery<any[]>({
    queryKey: ["/api/movements", { projectId, limit: 500 }],
    queryFn: () => fetch(`/api/movements?projectId=${projectId}&limit=500`, { credentials: "include" }).then(r => r.json()),
    enabled: !!projectId,
  });
  const { data: progressData } = useQuery<{
    scopeItems: any[];
    summary: { overallPct: number; estTotal: number; installed: number; remaining: number; todayAdded: number };
  }>({
    queryKey: ["/api/projects", projectId, "progress"],
    queryFn: () => fetch(`/api/projects/${projectId}/progress`, { credentials: "include" }).then(r => r.json()),
  });

  const totalReports    = reports.length;
  const draftCount      = reports.filter(r => r.status === "draft").length;
  const submittedCount  = reports.filter(r => r.status === "submitted").length;
  const overallPct      = progressData?.summary?.overallPct ?? 0;
  const totalScopeItems = progressData?.scopeItems?.length ?? 0;
  const totalEstQty     = progressData?.summary?.estTotal ?? 0;
  const todayAdded      = progressData?.summary?.todayAdded ?? 0;
  const statusCfg       = statusConfig[project.status] || { label: project.status, className: "bg-slate-100 text-slate-600" };

  const submittedReports = reports.filter(r => r.status === "submitted");
  const lastSubmittedDate = submittedReports.length > 0
    ? [...submittedReports].sort((a, b) => (b.reportDate ?? "") > (a.reportDate ?? "") ? 1 : -1)[0]?.reportDate ?? null
    : null;

  const matIssued   = allMovements.filter(m => m.movementType === "issue").reduce((s: number, m: any) => s + Number(m.quantity ?? 0), 0);
  const matReturned = allMovements.filter(m => m.movementType === "return").reduce((s: number, m: any) => s + Number(m.quantity ?? 0), 0);
  const matNetUsed  = matIssued - matReturned;
  const matValue    = allMovements.reduce((s: number, m: any) => {
    if (m.movementType !== "issue") return s;
    const snap = m.unitCostSnapshot ? Number(m.unitCostSnapshot) : 0;
    return s + snap * Number(m.quantity ?? 0);
  }, 0);

  const sortedMovements = useMemo(() =>
    [...allMovements].sort((a, b) => {
      const da = a.transactionDate ?? a.createdAt ?? "";
      const db = b.transactionDate ?? b.createdAt ?? "";
      return da > db ? -1 : da < db ? 1 : 0;
    }), [allMovements]);

  const totalTxnPages = Math.ceil(sortedMovements.length / TXN_PAGE_SIZE);
  const pageMovements = sortedMovements.slice(txnPage * TXN_PAGE_SIZE, (txnPage + 1) * TXN_PAGE_SIZE);

  const pctColor = overallPct >= 100 ? "bg-emerald-500" : overallPct >= 70 ? "bg-brand-500" : overallPct >= 40 ? "bg-blue-400" : "bg-slate-300";
  const pctText  = overallPct >= 100 ? "text-emerald-600" : overallPct >= 70 ? "text-brand-600" : overallPct >= 40 ? "text-blue-600" : "text-slate-400";

  const fmtValue = (v: number) =>
    v > 0 ? `$${v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "—";

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 premium-card bg-white p-6 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Project</p>
              <h2 className="text-2xl font-display font-bold text-slate-900">{project.name}</h2>
              {project.customerName && <p className="text-sm text-slate-500 mt-0.5">{project.customerName}</p>}
            </div>
            <Badge variant="outline" className={`${statusCfg.className} text-xs font-semibold shrink-0`}>{statusCfg.label}</Badge>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
            {project.poNumber && (
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">PO Number</p>
                <p className="text-sm font-mono font-bold text-brand-700">{project.poNumber}</p>
              </div>
            )}
            {project.ownerName && (
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Owner / Manager</p>
                <p className="text-sm font-semibold text-slate-800">{project.ownerName}</p>
              </div>
            )}
            {project.jobLocation && (
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Location</p>
                <p className="text-sm text-slate-700 flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-slate-400" />{project.jobLocation}</p>
              </div>
            )}
            {project.startDate && (
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Start Date</p>
                <p className="text-sm text-slate-700">{format(new Date(project.startDate + "T00:00:00"), "MMM d, yyyy")}</p>
              </div>
            )}
            {project.endDate && (
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">End Date</p>
                <p className="text-sm text-slate-700">{format(new Date(project.endDate + "T00:00:00"), "MMM d, yyyy")}</p>
              </div>
            )}
          </div>

          {project.notes && (
            <div className="pt-3 border-t border-slate-100">
              <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Notes</p>
              <p className="text-sm text-slate-600 leading-relaxed">{project.notes}</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="premium-card bg-white p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />Daily Reports
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Total Reports</span>
                <span className="text-lg font-display font-bold text-slate-900">{totalReports}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: totalReports ? `${(submittedCount / totalReports) * 100}%` : "0%" }} />
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-1 text-center px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-100">
                  <p className="text-[10px] text-emerald-600 uppercase tracking-wide">Submitted</p>
                  <p className="text-xl font-bold text-emerald-700">{submittedCount}</p>
                </div>
                <div className="flex-1 text-center px-3 py-2 rounded-xl bg-amber-50 border border-amber-100">
                  <p className="text-[10px] text-amber-600 uppercase tracking-wide">Draft</p>
                  <p className="text-xl font-bold text-amber-700">{draftCount}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="premium-card bg-white p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />Overall Progress
            </p>
            <div className="flex items-end gap-2 mb-2">
              <span className={`text-4xl font-display font-bold ${pctText}`}>{overallPct.toFixed(1)}%</span>
              <span className="text-xs text-slate-400 mb-1">complete</span>
            </div>
            {(() => {
              const installed = progressData?.summary?.installed ?? 0;
              const estTotal  = progressData?.summary?.estTotal ?? 0;
              const prevInstalled = Math.max(0, installed - todayAdded);
              const prevPct  = estTotal > 0 ? Math.min(100, (prevInstalled / estTotal) * 100) : 0;
              const todayPct = estTotal > 0 ? Math.min(100 - prevPct, (todayAdded / estTotal) * 100) : 0;
              return (
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden relative">
                  <div className="absolute left-0 top-0 h-full bg-emerald-500 transition-all" style={{ width: `${prevPct}%` }} />
                  <div className="absolute top-0 h-full bg-brand-400 transition-all" style={{ left: `${prevPct}%`, width: `${todayPct}%` }} />
                </div>
              );
            })()}
            {todayAdded > 0 && (
              <div className="flex items-center gap-3 mt-2">
                <span className="flex items-center gap-1 text-[10px] text-emerald-600"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Previous</span>
                <span className="flex items-center gap-1 text-[10px] text-brand-600"><span className="w-2 h-2 rounded-full bg-brand-400 inline-block" />Today: +{todayAdded.toLocaleString()}</span>
              </div>
            )}
            {progressData && (
              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100">
                <div>
                  <p className="text-[10px] text-slate-400">Installed</p>
                  <p className="text-sm font-bold text-emerald-700">{progressData.summary.installed.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">Remaining</p>
                  <p className="text-sm font-bold text-amber-700">{progressData.summary.remaining.toLocaleString()}</p>
                </div>
                {todayAdded > 0 && (
                  <div>
                    <p className="text-[10px] text-brand-500">Today Added</p>
                    <p className="text-sm font-bold text-brand-600">+{todayAdded.toLocaleString()}</p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] text-slate-400">Est. Total</p>
                  <p className="text-sm font-bold text-slate-700">{progressData.summary.estTotal.toLocaleString()}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="premium-card bg-white p-4 flex items-center gap-3" data-testid="overview-scope-count">
          <div className="p-2 rounded-xl bg-indigo-50"><LayoutList className="w-4 h-4 text-indigo-600" /></div>
          <div>
            <p className="text-xs text-slate-400">Scope Items</p>
            <p className="text-2xl font-display font-bold text-slate-900">{totalScopeItems}</p>
          </div>
        </div>
        <div className="premium-card bg-white p-4 flex items-center gap-3" data-testid="overview-est-qty">
          <div className="p-2 rounded-xl bg-brand-50"><Hash className="w-4 h-4 text-brand-600" /></div>
          <div>
            <p className="text-xs text-slate-400">Total Est. Qty</p>
            <p className="text-2xl font-display font-bold text-slate-900">{totalEstQty.toLocaleString()}</p>
          </div>
        </div>
        <div className="premium-card bg-white p-4 flex items-center gap-3 col-span-2 sm:col-span-1" data-testid="overview-last-submitted">
          <div className="p-2 rounded-xl bg-slate-50"><Clock className="w-4 h-4 text-slate-500" /></div>
          <div>
            <p className="text-xs text-slate-400">Last Submitted Report</p>
            <p className="text-sm font-semibold text-slate-800 mt-0.5">
              {lastSubmittedDate
                ? format(new Date(lastSubmittedDate + "T00:00:00"), "MMM d, yyyy")
                : <span className="text-slate-400 font-normal text-xs">No submitted reports yet</span>
              }
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Issued",   value: matIssued.toLocaleString(),  icon: ArrowUpRight,  color: "text-brand-600",   bg: "bg-brand-50"   },
          { label: "Total Returned", value: matReturned.toLocaleString(),icon: ArrowDownRight, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Net Used",       value: matNetUsed.toLocaleString(),  icon: Package,       color: "text-slate-600",   bg: "bg-slate-50"   },
          { label: "Est. Value",     value: fmtValue(matValue),           icon: DollarSign,    color: "text-indigo-600",  bg: "bg-indigo-50"  },
        ].map((s, i) => (
          <div key={i} className="premium-card bg-white p-4 flex items-start gap-3" data-testid={`overview-mat-kpi-${i}`}>
            <div className={`p-2 rounded-xl ${s.bg}`}><s.icon className={`w-4 h-4 ${s.color}`} /></div>
            <div>
              <p className="text-xs text-slate-400">{s.label}</p>
              <p className="text-2xl font-display font-bold text-slate-900">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {sortedMovements.length > 0 && (
        <div className="premium-card bg-white overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1.5">
              <ArrowUpRight className="w-3.5 h-3.5 text-brand-500" />Recent Material Transactions
            </p>
            <span className="text-[10px] text-slate-400">
              {sortedMovements.length} total — newest first
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50/60">
                <tr>
                  <th className="text-left px-4 py-2 font-semibold text-slate-500 w-[90px]">Date</th>
                  <th className="text-left px-4 py-2 font-semibold text-slate-500">Item</th>
                  <th className="text-left px-4 py-2 font-semibold text-slate-500 w-[80px]">Type</th>
                  <th className="text-right px-4 py-2 font-semibold text-slate-500 w-[70px]">Qty</th>
                  <th className="text-left px-4 py-2 font-semibold text-slate-500 w-[50px]">Unit</th>
                  <th className="text-left px-4 py-2 font-semibold text-slate-500">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pageMovements.map((m: any) => {
                  const dateStr = m.transactionDate ?? m.createdAt;
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/40 transition-colors">
                      <td className="px-4 py-2 text-slate-500 whitespace-nowrap">
                        {dateStr ? format(new Date(dateStr), "MMM d, yy") : "—"}
                      </td>
                      <td className="px-4 py-2 text-slate-700 font-medium truncate max-w-[200px]">
                        {m.item?.name ?? m.itemName ?? `Item #${m.itemId}`}
                      </td>
                      <td className="px-4 py-2">
                        <MovementTypeBadge type={m.movementType} past={true} />
                      </td>
                      <td className="px-4 py-2 text-right font-mono font-semibold text-slate-700">
                        {Number(m.quantity ?? 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 font-mono text-slate-400">
                        {m.item?.unitOfMeasure ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-slate-400 truncate max-w-[120px]">
                        {m.createdBy ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              {txnPage * TXN_PAGE_SIZE + 1}–{Math.min((txnPage + 1) * TXN_PAGE_SIZE, sortedMovements.length)} of {sortedMovements.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                data-testid="btn-txn-prev"
                onClick={() => setTxnPage(p => Math.max(0, p - 1))}
                disabled={txnPage === 0}
                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] text-slate-500 font-semibold tabular-nums">
                {txnPage + 1} / {Math.max(1, totalTxnPages)}
              </span>
              <button
                data-testid="btn-txn-next"
                onClick={() => setTxnPage(p => Math.min(totalTxnPages - 1, p + 1))}
                disabled={txnPage >= totalTxnPages - 1}
                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function MaterialUsageTab({ projectId }: { projectId: number }) {
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

  const fmtValue = (v: number) =>
    v > 0 ? `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Issued",   value: totalIssued.toLocaleString(),   icon: ArrowUpRight,  color: "text-brand-600",   bg: "bg-brand-50"   },
          { label: "Total Returned", value: totalReturned.toLocaleString(), icon: ArrowDownRight, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Net Used",       value: totalNetUsed.toLocaleString(),  icon: Package,       color: "text-slate-600",   bg: "bg-slate-50"   },
          { label: "Material Value", value: fmtValue(totalValue),           icon: DollarSign,    color: "text-indigo-600",  bg: "bg-indigo-50"  },
        ].map((s, i) => (
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
        <div className="premium-card bg-white p-10 text-center text-slate-400 text-sm">Loading material usage…</div>
      ) : grouped.length === 0 ? (
        <div className="premium-card bg-white p-12 text-center">
          <Package className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No material movements</p>
          <p className="text-xs text-slate-400 mt-1">No material movements logged for this project yet.</p>
        </div>
      ) : (
        <div className="premium-card bg-white overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
            <Package className="w-4 h-4 text-slate-400" />
            <h3 className="font-semibold text-slate-900 text-sm">Item-Level Material Usage</h3>
            <span className="text-xs text-slate-400 ml-1">({grouped.length} item{grouped.length !== 1 ? "s" : ""})</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-material-usage">
              <thead className="bg-slate-50/80 border-b border-slate-100">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600 text-xs">Item Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs w-[60px]">Unit</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs w-[100px]">Issued Qty</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs w-[110px]">Returned Qty</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs w-[90px]">Net Used</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs w-[120px]">Material Value</th>
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
                      <td className="px-4 py-3 text-right text-xs font-mono font-semibold text-emerald-600">{g.returnedQty > 0 ? g.returnedQty.toLocaleString() : <span className="text-slate-300">0</span>}</td>
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
                  <td className="px-4 py-3 text-right text-xs font-bold text-indigo-700 tabular-nums">{totalValue > 0 ? fmtValue(totalValue) : "—"}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export function DailyReportsTab({ projectId, project }: { projectId: number; project: any }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [filter, setFilter] = useState<"all" | "draft" | "submitted">("all");

  const { data: me } = useQuery<{ role: string; username: string }>({
    queryKey: ["/api/me"],
    queryFn: () => fetch("/api/me", { credentials: "include" }).then(r => r.json()),
  });
  const canForceEdit = me?.role === "admin" || me?.role === "manager";

  const { data: reports = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/daily-reports", projectId],
    queryFn: () => fetch(`/api/daily-reports?projectId=${projectId}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!projectId,
  });

  const sorted = [...reports].sort((a, b) => {
    const da = a.reportDate ?? a.createdAt ?? "";
    const db = b.reportDate ?? b.createdAt ?? "";
    return da > db ? -1 : da < db ? 1 : 0;
  });
  const filtered = filter === "all" ? sorted : sorted.filter(r => r.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        {(["all", "submitted", "draft"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            data-testid={`filter-reports-${f}`}
            className={[
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
              filter === f
                ? f === "submitted" ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                  : f === "draft" ? "bg-amber-100 text-amber-700 border border-amber-200"
                  : "bg-slate-800 text-white"
                : "bg-white text-slate-500 border border-slate-200 hover:border-slate-300",
            ].join(" ")}
          >
            {f === "all" ? `All (${reports.length})` : f === "submitted" ? `Submitted (${reports.filter(r=>r.status==="submitted").length})` : `Draft (${reports.filter(r=>r.status==="draft").length})`}
          </button>
        ))}
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          className="text-xs gap-1.5 h-8 bg-white"
          onClick={() => navigate(`/daily-report/${projectId}`)}
          data-testid="btn-goto-workspace"
        >
          <Plus className="w-3.5 h-3.5" />New Report
        </Button>
      </div>

      {isLoading ? (
        <div className="premium-card bg-white p-12 text-center text-slate-400 text-sm">Loading reports…</div>
      ) : filtered.length === 0 ? (
        <div className="premium-card bg-white p-12 text-center">
          <FileText className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No reports found</p>
          <p className="text-xs text-slate-400 mt-1">
            {filter === "all" ? "No daily reports yet for this project." : `No ${filter} reports.`}
          </p>
        </div>
      ) : (
        <div className="premium-card bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-daily-reports">
              <thead className="bg-slate-50/80 border-b border-slate-100">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs w-[80px]">Report #</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs w-[90px]">Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">Prepared By</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs w-[90px]">Status</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600 text-xs w-[70px]">Workers</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600 text-xs w-[80px]">Man-hrs</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600 text-xs w-[65px]">Tasks</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600 text-xs w-[75px]">Materials</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">Last Updated</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs w-[130px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => {
                  const fd = r.formData ?? {};
                  const manpower  = Array.isArray(fd.manpower)  ? fd.manpower  : [];
                  const tasks     = Array.isArray(fd.tasks)     ? fd.tasks     : [];
                  const materials = Array.isArray(fd.materials) ? fd.materials : [];
                  const workers   = manpower.length;
                  const manHrs    = manpower.reduce((s: number, mp: any) => s + Number(mp.hoursWorked ?? 0), 0);
                  const submitted = r.status === "submitted";
                  const dateStr  = r.reportDate ?? null;
                  const updatedAt = r.updatedAt ? new Date(r.updatedAt) : null;

                  return (
                    <tr
                      key={r.id}
                      data-testid={`row-report-${r.id}`}
                      className={`hover:bg-slate-50 transition-colors ${submitted ? "" : "bg-amber-50/20"}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-1 h-6 rounded-full shrink-0 ${submitted ? "bg-emerald-400" : "bg-amber-400"}`} />
                          <span className="font-mono text-xs font-semibold text-slate-700">
                            {r.reportNumber ? `#${r.reportNumber}` : `—`}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                        {dateStr ? format(new Date(dateStr + "T00:00:00"), "MMM d, yyyy") : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700">
                        {fd.preparedBy || <span className="text-slate-300 italic">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <ReportStatusBadge status={r.status} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {workers > 0 ? (
                          <span className="flex items-center justify-center gap-1 text-xs text-slate-600">
                            <Users className="w-3 h-3 text-slate-400" />{workers}
                          </span>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {manHrs > 0 ? (
                          <span className="flex items-center justify-center gap-1 text-xs text-slate-600">
                            <Clock className="w-3 h-3 text-slate-400" />{manHrs.toFixed(1)}
                          </span>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {tasks.length > 0 ? (
                          <span className="flex items-center justify-center gap-1 text-xs text-slate-600">
                            <ListTodo className="w-3 h-3 text-slate-400" />{tasks.length}
                          </span>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {materials.length > 0 ? (
                          <span className="flex items-center justify-center gap-1 text-xs text-slate-600">
                            <Package className="w-3 h-3 text-slate-400" />{materials.length}
                          </span>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {updatedAt ? updatedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className={`text-xs h-7 px-2.5 gap-1 ${submitted && canForceEdit ? "border-brand-200 text-brand-700 hover:bg-brand-50" : ""}`}
                            data-testid={`btn-edit-report-${r.id}`}
                            onClick={() => {
                              const forceEditParam = submitted && canForceEdit ? "&forceEdit=true" : "";
                              navigate(`/daily-report/${projectId}?reportId=${r.id}${forceEditParam}`);
                            }}
                          >
                            {submitted && canForceEdit ? <Pencil className="w-3 h-3" /> : submitted ? <Eye className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
                            {submitted && canForceEdit ? "Edit" : submitted ? "View" : "Edit"}
                          </Button>
                          {submitted && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs h-7 px-2.5 gap-1 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50"
                              data-testid={`btn-export-report-${r.id}`}
                              onClick={() => {
                                exportReportCsv(r, project.name);
                                toast({ title: "Exported", description: `Report #${r.reportNumber ?? r.id} downloaded as CSV.` });
                              }}
                            >
                              <Download className="w-3 h-3" />CSV
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export function ProjectDetailsSidebar({ project }: { project: any }) {
  return (
    <Card className="premium-card border-none">
      <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
        <CardTitle className="text-sm font-semibold text-slate-700">Project Details</CardTitle>
      </CardHeader>
      <CardContent className="p-5 space-y-4 text-sm">
        {project.poNumber && (
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">PO Number</p>
            <p className="font-semibold text-brand-700">{project.poNumber}</p>
          </div>
        )}
        {project.ownerName && (
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Project Owner</p>
            <p className="font-semibold text-slate-900">{project.ownerName}</p>
          </div>
        )}
        {project.jobLocation && (
          <div className="flex gap-3">
            <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <p className="text-slate-600">{project.jobLocation}</p>
          </div>
        )}
        {(project.startDate || project.endDate) && (
          <div className="flex gap-3">
            <Calendar className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-0.5">
              {project.startDate && (
                <p className="text-slate-600">
                  <span className="text-slate-400">Start: </span>
                  {format(new Date(project.startDate + "T00:00:00"), 'MMM d, yyyy')}
                </p>
              )}
              {project.endDate && (
                <p className="text-slate-600">
                  <span className="text-slate-400">End: </span>
                  {format(new Date(project.endDate + "T00:00:00"), 'MMM d, yyyy')}
                </p>
              )}
            </div>
          </div>
        )}
        {project.notes && (
          <div className="pt-3 border-t border-slate-100">
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Notes</p>
            <p className="text-slate-600 leading-relaxed">{project.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
