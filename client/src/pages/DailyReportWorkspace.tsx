import { useState } from "react";
import { useParams } from "wouter";
import {
  MapPin, Calendar, ClipboardList, CheckCircle2, AlertCircle,
  Users, FileText, BarChart3, Clock, PlusCircle, Info,
} from "lucide-react";
import {
  MOCK_PROGRESS_ITEMS, calcProgressRow, overallProgress,
} from "@/lib/mock-daily-report";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MOCK_PROJECTS, STATUS_CFG, formatReportDate,
  type ProjectStatus,
} from "@/lib/mock-daily-report";
import { NewReportTab } from "@/pages/daily-report/NewReportTab";

// ─── Status badge ─────────────────────────────────────────────────────────────
function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const cfg = STATUS_CFG[status];
  return (
    <Badge variant="outline" className={`${cfg.className} text-xs font-semibold px-2 py-0.5`}>
      {cfg.label}
    </Badge>
  );
}

// ─── Tab definition ───────────────────────────────────────────────────────────
type Tab = "new-report" | "history" | "progress";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "new-report", label: "New Report",     icon: <PlusCircle className="w-4 h-4" /> },
  { id: "history",    label: "Report History", icon: <ClipboardList className="w-4 h-4" /> },
  { id: "progress",   label: "Progress",       icon: <BarChart3 className="w-4 h-4" /> },
];

// ─── Mock report history ──────────────────────────────────────────────────────
const MOCK_HISTORY = [
  { id: 101, date: "2026-03-16", crew: 8,  hours: 64,  workDone: "Panel installation – Level 3 east wing. Conduit pull-through complete.", weather: "Clear", issues: false },
  { id: 102, date: "2026-03-15", crew: 7,  hours: 56,  workDone: "Branch circuit wiring – Rooms 301–312. Inspection passed.", weather: "Partly Cloudy", issues: false },
  { id: 103, date: "2026-03-14", crew: 9,  hours: 72,  workDone: "Main switchgear rough-in. Delays due to material delivery.", weather: "Clear", issues: true },
  { id: 104, date: "2026-03-13", crew: 6,  hours: 48,  workDone: "Ground fault circuit installation – Kitchen and restrooms.", weather: "Rain", issues: false },
  { id: 105, date: "2026-03-12", crew: 8,  hours: 64,  workDone: "Conduit installation – Basement electrical room.", weather: "Clear", issues: false },
];


// ─── Tab content components ───────────────────────────────────────────────────
function HistoryTab() {
  if (MOCK_HISTORY.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-100">
            <ClipboardList className="w-7 h-7 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-600">No reports yet</p>
          <p className="text-xs text-slate-400">Submit the first daily report using the New Report tab.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {MOCK_HISTORY.map((r) => (
        <Card key={r.id} data-testid={`card-report-${r.id}`} className="hover:shadow-sm transition-shadow">
          <CardContent className="flex items-start gap-4 px-5 py-4">

            {/* Date column */}
            <div className="shrink-0 text-center w-14">
              <p className="text-xl font-bold text-slate-800 leading-none">
                {new Date(r.date).getDate()}
              </p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide mt-0.5">
                {new Date(r.date).toLocaleDateString("en-US", { month: "short" })}
              </p>
            </div>

            {/* Divider */}
            <div className="w-px self-stretch bg-slate-200 shrink-0" />

            {/* Main info */}
            <div className="flex-1 min-w-0">
              <p
                data-testid={`text-report-work-${r.id}`}
                className="text-sm text-slate-700 line-clamp-2"
              >
                {r.workDone}
              </p>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <Users className="w-3 h-3" />{r.crew} workers
                </span>
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <Clock className="w-3 h-3" />{r.hours} hrs
                </span>
                <span className="text-xs text-slate-400">{r.weather}</span>
                {r.issues && (
                  <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 px-1.5 py-0 font-semibold">
                    Issue logged
                  </Badge>
                )}
              </div>
            </div>

            {/* View button — placeholder */}
            <Button
              data-testid={`btn-view-report-${r.id}`}
              variant="ghost"
              size="sm"
              className="shrink-0 text-xs text-slate-500 gap-1"
              disabled
            >
              <FileText className="w-3.5 h-3.5" />
              View
            </Button>

          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ProgressTab() {
  // Read-only view: cumulative from all previously submitted reports (todayQty = 0)
  const rows    = MOCK_PROGRESS_ITEMS.map((item) => calcProgressRow(item, 0));
  const overall = overallProgress(rows);

  const totalEst    = rows.reduce((s, r) => s + r.estimatedQty,  0);
  const totalActual = rows.reduce((s, r) => s + r.cumulativeQty, 0);
  const totalRem    = rows.reduce((s, r) => s + r.remaining,      0);

  return (
    <div className="space-y-4">

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Overall Progress", value: `${overall}%`, sub: "weighted by est. qty",  color: "text-blue-700",    bg: "bg-blue-50" },
          { label: "Est. Total",        value: totalEst.toLocaleString(),    sub: "units in scope",  color: "text-slate-700",   bg: "bg-slate-100" },
          { label: "Installed",         value: totalActual.toLocaleString(), sub: "cumulative actual", color: "text-emerald-700", bg: "bg-emerald-50" },
          { label: "Remaining",         value: totalRem.toLocaleString(),    sub: "units left",     color: "text-amber-700",   bg: "bg-amber-50" },
        ].map(({ label, value, sub, color, bg }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-4">
              <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${bg} mb-2`}>
                <BarChart3 className={`w-4 h-4 ${color}`} />
              </div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">{label}</p>
              <p className={`text-xl font-bold leading-tight ${color}`}>{value}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Overall bar */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Overall Completion</p>
            <p className="text-sm font-bold text-blue-700">{overall}%</p>
          </div>
          <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-500"
              style={{ width: `${overall}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Weighted by estimated quantities — updates automatically when daily reports are submitted.
          </p>
        </CardContent>
      </Card>

      {/* Quantity progress table */}
      <Card>
        <CardHeader className="pb-2 flex-row items-center gap-2">
          <BarChart3 className="w-4 h-4 text-slate-500 shrink-0" />
          <div className="flex-1">
            <CardTitle className="text-sm font-semibold text-slate-700">Quantity-Based Progress</CardTitle>
            <p className="text-[11px] text-slate-400 mt-0.5">Cumulative actuals from all submitted reports to date</p>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-progress-summary">
              <thead>
                <tr className="border-y border-slate-200 bg-slate-50">
                  {["Work Item / Description", "Unit", "Est. Qty", "Cumul. Actual", "Remaining", "Progress"].map((h) => (
                    <th key={h} className="py-2 px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wide text-left whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    data-testid={`row-progress-summary-${row.id}`}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors"
                  >
                    <td className="py-2.5 px-4 text-sm text-slate-700">{row.description}</td>
                    <td className="py-2.5 px-4 text-xs text-slate-500 font-mono">{row.unit}</td>
                    <td className="py-2.5 px-4 text-sm text-slate-500 font-mono">{row.estimatedQty.toLocaleString()}</td>
                    <td className="py-2.5 px-4 text-sm font-semibold text-slate-700 font-mono">{row.cumulativeQty.toLocaleString()}</td>
                    <td className={`py-2.5 px-4 text-sm font-mono ${row.remaining === 0 ? "text-emerald-600 font-semibold" : "text-slate-600"}`}>
                      {row.remaining.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2 min-w-[100px]">
                        <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              row.pct >= 100 ? "bg-emerald-500" : row.pct >= 75 ? "bg-blue-500" : "bg-blue-400"
                            }`}
                            style={{ width: `${row.pct}%` }}
                          />
                        </div>
                        <span className={`text-xs font-semibold w-8 shrink-0 ${row.pct >= 100 ? "text-emerald-600" : "text-slate-600"}`}>
                          {row.pct}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50">
                  <td colSpan={2} className="py-2.5 px-4 text-xs font-semibold text-slate-600">Total</td>
                  <td className="py-2.5 px-4 text-xs font-bold text-slate-700 font-mono">{totalEst.toLocaleString()}</td>
                  <td className="py-2.5 px-4 text-xs font-bold text-slate-700 font-mono">{totalActual.toLocaleString()}</td>
                  <td className="py-2.5 px-4 text-xs font-bold text-slate-700 font-mono">{totalRem.toLocaleString()}</td>
                  <td className="py-2.5 px-4 text-xs font-bold text-slate-700">{overall}%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Info note */}
      <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200">
        <Info className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
        <p className="text-xs text-slate-500">
          Estimated quantities are configured at the project scope level.
          Today's quantities entered in the New Report tab will be added to the cumulative total when the report is submitted.
        </p>
      </div>

    </div>
  );
}

// ─── Main workspace page ──────────────────────────────────────────────────────
export default function DailyReportWorkspace() {
  const { projectId } = useParams<{ projectId: string }>();
  const [activeTab, setActiveTab] = useState<Tab>("new-report");

  const project = MOCK_PROJECTS.find((p) => String(p.id) === projectId);

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-100">
          <AlertCircle className="w-8 h-8 text-slate-400" />
        </div>
        <p className="text-sm font-medium text-slate-600">Project not found</p>
        <p className="text-xs text-slate-400">ID: {projectId}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Project header card ── */}
      <Card>
        <CardContent className="flex items-center gap-4 px-5 py-4">
          <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-blue-50 shrink-0">
            <FileText className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1
                data-testid="text-workspace-project-name"
                className="text-lg font-bold text-slate-900 leading-tight"
              >
                {project.name}
              </h1>
              <span className="text-xs font-mono text-slate-400">{project.code}</span>
              <ProjectStatusBadge status={project.status} />
            </div>
            <div className="flex items-center gap-4 mt-1 flex-wrap">
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <MapPin className="w-3 h-3" />{project.location}
              </span>
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Calendar className="w-3 h-3" />
                Last report: {formatReportDate(project.lastReportDate)}
              </span>
            </div>
          </div>
          <div className="shrink-0 text-right hidden sm:block">
            <p className="text-2xl font-bold text-slate-700">{project.reportCount}</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">
              {project.reportCount === 1 ? "Report" : "Reports"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Tab bar ── */}
      <div
        className="flex border-b border-slate-200"
        data-testid="tab-bar-workspace"
        role="tablist"
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              data-testid={`tab-${tab.id}`}
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={[
                "flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                isActive
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300",
              ].join(" ")}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab content ── */}
      <div data-testid="tab-content-workspace">
        {activeTab === "new-report" && <NewReportTab />}
        {activeTab === "history"    && <HistoryTab />}
        {activeTab === "progress"   && <ProgressTab />}
      </div>

    </div>
  );
}
