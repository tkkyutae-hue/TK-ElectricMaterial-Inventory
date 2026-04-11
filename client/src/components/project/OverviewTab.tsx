import { useMemo } from "react";
import { format } from "date-fns";
import {
  ArrowUpRight, ArrowDownRight, Package, DollarSign,
  LayoutList, Hash, Clock,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { statusConfig } from "./types";
import { ProjectSummaryCard } from "./overview/ProjectSummaryCard";
import { ReportsSummaryCard } from "./overview/ReportsSummaryCard";
import { OverviewProgressCard } from "./overview/OverviewProgressCard";
import { OverviewTransactionsTable } from "./overview/OverviewTransactionsTable";

export { MaterialUsageTab } from "./overview/MaterialUsageTab";
export { DailyReportsTab } from "./overview/DailyReportsTab";
export { ProjectDetailsSidebar } from "./overview/ProjectDetailsSidebar";

function fmtMoney(v: number) {
  return v > 0 ? `$${v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "—";
}

export function OverviewTab({ project, projectId }: { project: any; projectId: number }) {
  // ── Data ──
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

  // ── Report stats ──
  const totalReports   = reports.length;
  const draftCount     = reports.filter(r => r.status === "draft").length;
  const submittedCount = reports.filter(r => r.status === "submitted").length;
  const lastSubmittedDate = (() => {
    const submitted = reports.filter(r => r.status === "submitted");
    return submitted.length > 0
      ? [...submitted].sort((a, b) => (b.reportDate ?? "") > (a.reportDate ?? "") ? 1 : -1)[0]?.reportDate ?? null
      : null;
  })();

  // ── Material stats ──
  const matIssued   = allMovements.filter(m => m.movementType === "issue").reduce((s, m) => s + Number(m.quantity ?? 0), 0);
  const matReturned = allMovements.filter(m => m.movementType === "return").reduce((s, m) => s + Number(m.quantity ?? 0), 0);
  const matNetUsed  = matIssued - matReturned;
  const matValue    = allMovements.reduce((s, m) => {
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

  // ── Progress / scope stats ──
  const totalScopeItems = progressData?.scopeItems?.length ?? 0;
  const totalEstQty     = progressData?.summary?.estTotal ?? 0;

  // ── Status ──
  const statusCfg = statusConfig[project.status] || { label: project.status, className: "bg-slate-100 text-slate-600" };

  // ── KPI definitions ──
  const scopeKpis = [
    { label: "Scope Items",           value: totalScopeItems,                                   icon: LayoutList, color: "text-indigo-600", bg: "bg-indigo-50",  testId: "overview-scope-count"    },
    { label: "Total Est. Qty",        value: totalEstQty.toLocaleString(),                       icon: Hash,       color: "text-brand-600",  bg: "bg-brand-50",   testId: "overview-est-qty"        },
    { label: "Last Submitted Report", value: lastSubmittedDate
        ? format(new Date(lastSubmittedDate + "T00:00:00"), "MMM d, yyyy")
        : null,
      icon: Clock, color: "text-slate-500", bg: "bg-slate-50", testId: "overview-last-submitted", span: true },
  ];

  const matKpis = [
    { label: "Total Issued",   value: matIssued.toLocaleString(),   icon: ArrowUpRight,  color: "text-brand-600",   bg: "bg-brand-50"   },
    { label: "Total Returned", value: matReturned.toLocaleString(), icon: ArrowDownRight, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Net Used",       value: matNetUsed.toLocaleString(),  icon: Package,       color: "text-slate-600",   bg: "bg-slate-50"   },
    { label: "Est. Value",     value: fmtMoney(matValue),           icon: DollarSign,    color: "text-indigo-600",  bg: "bg-indigo-50"  },
  ];

  return (
    <div className="space-y-5">

      {/* ── Header row: project summary + reports + progress ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <ProjectSummaryCard project={project} statusCfg={statusCfg} />
        </div>
        <div className="space-y-4">
          <ReportsSummaryCard
            totalReports={totalReports}
            submittedCount={submittedCount}
            draftCount={draftCount}
          />
          <OverviewProgressCard progressData={progressData} />
        </div>
      </div>

      {/* ── Scope KPI strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {scopeKpis.map((s, i) => (
          <div
            key={i}
            className={`premium-card bg-white p-4 flex items-center gap-3 ${s.span ? "col-span-2 sm:col-span-1" : ""}`}
            data-testid={s.testId}
          >
            <div className={`p-2 rounded-xl ${s.bg}`}><s.icon className={`w-4 h-4 ${s.color}`} /></div>
            <div>
              <p className="text-xs text-slate-400">{s.label}</p>
              {s.value != null
                ? <p className="text-2xl font-display font-bold text-slate-900">{s.value}</p>
                : <p className="text-sm font-semibold text-slate-800 mt-0.5"><span className="text-slate-400 font-normal text-xs">No submitted reports yet</span></p>
              }
            </div>
          </div>
        ))}
      </div>

      {/* ── Material KPI strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {matKpis.map((s, i) => (
          <div key={i} className="premium-card bg-white p-4 flex items-start gap-3" data-testid={`overview-mat-kpi-${i}`}>
            <div className={`p-2 rounded-xl ${s.bg}`}><s.icon className={`w-4 h-4 ${s.color}`} /></div>
            <div>
              <p className="text-xs text-slate-400">{s.label}</p>
              <p className="text-2xl font-display font-bold text-slate-900">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Paginated transactions table ── */}
      {sortedMovements.length > 0 && (
        <OverviewTransactionsTable sortedMovements={sortedMovements} />
      )}
    </div>
  );
}
