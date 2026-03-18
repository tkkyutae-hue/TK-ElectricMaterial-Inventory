import { useState, useEffect } from "react";
import { useParams, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  MapPin, Calendar, ClipboardList, AlertCircle,
  Users, FileText, BarChart3, Clock, PlusCircle, Info, Edit2, Loader2,
  Hash, Download, ListTodo,
} from "lucide-react";
import {
  STATUS_CFG, type ProjectStatus,
} from "@/lib/mock-daily-report";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NewReportTab } from "@/pages/daily-report/NewReportTab";
import { useToast } from "@/hooks/use-toast";
import type { Project } from "@shared/schema";

// ─── Status badge ─────────────────────────────────────────────────────────────
function ProjectStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status as ProjectStatus] ?? {
    label: status,
    className: "bg-slate-100 text-slate-500 border-slate-200",
  };
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

// ─── Status badge helper ─────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  if (status === "submitted") {
    return (
      <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 px-1.5 py-0 font-semibold">
        Submitted
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 px-1.5 py-0 font-semibold">
      Draft
    </Badge>
  );
}

// ─── Excel export helper ──────────────────────────────────────────────────────
function exportReportToExcel(report: any, projectName: string) {
  const fd = report.formData ?? {};
  const rows: string[][] = [];

  // Header
  rows.push(["VoltStock — Daily Report Export"]);
  rows.push(["Project:", projectName]);
  rows.push(["Report No.:", report.reportNumber ?? "—"]);
  rows.push(["Report Date:", report.reportDate ?? "—"]);
  rows.push(["Prepared By:", fd.preparedBy ?? "—"]);
  rows.push(["Shift:", fd.shift ?? "—"]);
  rows.push(["Weather:", fd.weather ?? "—"]);
  rows.push(["Temperature:", fd.temperature ? `${fd.temperature}°F` : "—"]);
  rows.push([]);

  // Manpower
  rows.push(["── MANPOWER ──"]);
  rows.push(["Worker", "Trade", "Status", "Start", "End", "Hours", "Notes"]);
  (fd.manpower ?? []).forEach((r: any) => {
    rows.push([r.workerName ?? "", r.trade ?? "", r.attendanceStatus ?? "", r.startTime ?? "", r.endTime ?? "", String(r.hoursWorked ?? 0), r.notes ?? ""]);
  });
  const totalHrs = (fd.manpower ?? []).reduce((s: number, r: any) => s + Number(r.hoursWorked ?? 0), 0);
  rows.push(["", "", "", "", "Total:", String(totalHrs.toFixed(1)), ""]);
  rows.push([]);

  // Work Tasks
  rows.push(["── WORK TASKS ──"]);
  rows.push(["Description", "Area", "Status", "Notes"]);
  (fd.tasks ?? []).forEach((r: any) => {
    rows.push([r.description ?? "", r.area ?? "", r.status ?? "", r.notes ?? ""]);
  });
  rows.push([]);

  // Materials
  rows.push(["── MATERIALS ──"]);
  rows.push(["Material", "Unit", "Qty", "Notes"]);
  (fd.materials ?? []).forEach((r: any) => {
    rows.push([r.description ?? "", r.unit ?? "", String(r.qty ?? 0), r.notes ?? ""]);
  });
  rows.push([]);

  // Equipment
  rows.push(["── EQUIPMENT ──"]);
  rows.push(["Equipment", "Unit", "Qty", "Hours", "Notes"]);
  (fd.equipment ?? []).forEach((r: any) => {
    rows.push([r.name ?? "", r.unit ?? "", String(r.qty ?? 0), String(r.hours ?? 0), r.notes ?? ""]);
  });
  rows.push([]);

  // Notes
  rows.push(["── NOTES / REMARKS ──"]);
  rows.push(["General Notes:", fd.generalNotes ?? ""]);
  rows.push(["Safety:", fd.safetyNotes ?? ""]);
  rows.push(["Inspector/Visitor:", fd.inspectorVisitor ?? ""]);

  // Build CSV
  const csv = rows.map((row) =>
    row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
  ).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href  = url;
  link.download = `DailyReport_${report.reportNumber ?? report.id}_${report.reportDate ?? "unknown"}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ─── Tab content components ───────────────────────────────────────────────────
function HistoryTab({
  projectId,
  projectName,
  onOpen,
}: {
  projectId: number;
  projectName: string;
  onOpen: (report: any) => void;
}) {
  const { toast } = useToast();

  const { data: reports = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/daily-reports", projectId],
    queryFn: () => fetch(`/api/daily-reports?projectId=${projectId}`, { credentials: "include" }).then((r) => r.json()),
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (reports.length === 0) {
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

  // Sort descending by reportDate then id
  const sorted = [...reports].sort((a, b) => {
    const da = a.reportDate ?? "";
    const db = b.reportDate ?? "";
    return da > db ? -1 : da < db ? 1 : b.id - a.id;
  });

  return (
    <div className="space-y-2">
      {/* Summary bar */}
      <div className="flex items-center gap-4 px-1 pb-1">
        <span className="text-xs text-slate-400">
          {reports.length} report{reports.length !== 1 ? "s" : ""} total
        </span>
        <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
          {reports.filter((r) => r.status === "draft").length} draft
        </span>
        <span className="flex items-center gap-1 text-xs text-emerald-700 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          {reports.filter((r) => r.status === "submitted").length} submitted
        </span>
      </div>

      {sorted.map((r: any) => {
        const dateObj    = r.reportDate ? new Date(r.reportDate + "T00:00:00") : null;
        const updatedAt  = r.updatedAt  ? new Date(r.updatedAt)  : null;
        const fd         = r.formData ?? {};
        const manpower   = fd.manpower ?? [];
        const tasks      = fd.tasks    ?? [];

        // ── Correct calculations using actual ManpowerRow shape ──
        const workerCount = manpower.length;
        const totalHours  = manpower.reduce((s: number, row: any) => s + Number(row.hoursWorked ?? 0), 0);
        const taskCount   = tasks.length;
        const submitted   = r.status === "submitted";

        return (
          <Card
            key={r.id}
            data-testid={`card-report-${r.id}`}
            className="hover:shadow-sm transition-shadow border border-slate-200"
          >
            <CardContent className="px-0 py-0">

              {/* ── Top: status accent bar ── */}
              <div className={`h-0.5 rounded-t-xl ${submitted ? "bg-emerald-400" : "bg-amber-400"}`} />

              <div className="flex items-stretch gap-0 px-5 py-4">

                {/* Date column */}
                <div className="shrink-0 text-center w-[52px] flex flex-col items-center justify-center pr-4 border-r border-slate-100">
                  {dateObj ? (
                    <>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">
                        {dateObj.toLocaleDateString("en-US", { month: "short" })}
                      </p>
                      <p className="text-2xl font-bold text-slate-800 leading-none mt-0.5">
                        {String(dateObj.getDate()).padStart(2, "0")}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {dateObj.getFullYear()}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-slate-400">—</p>
                  )}
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0 pl-4 space-y-2">

                  {/* Row 1: Report # + status badge + prepared by */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {r.reportNumber && (
                      <span
                        data-testid={`text-report-number-${r.id}`}
                        className="text-xs font-mono font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded"
                      >
                        #{r.reportNumber}
                      </span>
                    )}
                    <StatusBadge status={r.status} />
                    {fd.preparedBy && (
                      <span className="text-xs text-slate-400">
                        by {fd.preparedBy}
                      </span>
                    )}
                  </div>

                  {/* Row 2: Stats chips */}
                  <div className="flex items-center gap-3 flex-wrap">
                    {workerCount > 0 && (
                      <span
                        data-testid={`text-report-workers-${r.id}`}
                        className="flex items-center gap-1 text-xs text-slate-500"
                      >
                        <Users className="w-3 h-3 text-slate-400 shrink-0" />
                        {workerCount} worker{workerCount !== 1 ? "s" : ""}
                      </span>
                    )}
                    {totalHours > 0 && (
                      <span
                        data-testid={`text-report-hours-${r.id}`}
                        className="flex items-center gap-1 text-xs text-slate-500"
                      >
                        <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                        {totalHours.toFixed(1)} man-hrs
                      </span>
                    )}
                    {taskCount > 0 && (
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <ListTodo className="w-3 h-3 text-slate-400 shrink-0" />
                        {taskCount} task{taskCount !== 1 ? "s" : ""}
                      </span>
                    )}
                    {workerCount === 0 && taskCount === 0 && (
                      <span className="text-xs text-slate-300 italic">No data recorded</span>
                    )}
                  </div>

                  {/* Row 3: Last updated */}
                  {updatedAt && (
                    <p className="text-[11px] text-slate-400">
                      Last updated {updatedAt.toLocaleString("en-US", {
                        month: "short", day: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  )}

                </div>

                {/* Right: action buttons */}
                <div className="shrink-0 flex flex-col items-end justify-center gap-2 pl-4">
                  <Button
                    data-testid={`btn-open-report-${r.id}`}
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1.5 h-8"
                    onClick={() => onOpen(r)}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    {submitted ? "View" : "Edit"}
                  </Button>
                  {submitted && (
                    <Button
                      data-testid={`btn-export-report-${r.id}`}
                      variant="ghost"
                      size="sm"
                      className="text-xs gap-1.5 h-8 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50"
                      onClick={() => {
                        exportReportToExcel(r, projectName);
                        toast({ title: "Exported", description: `Report #${r.reportNumber ?? r.id} downloaded as CSV.` });
                      }}
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export
                    </Button>
                  )}
                </div>

              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function ProgressTab({ projectId }: { projectId: number }) {
  const { data, isLoading } = useQuery<{
    scopeItems: any[];
    progress: Record<number, { cumulative: number; remaining: number; pct: number }>;
    summary: { overallPct: number; estTotal: number; installed: number; remaining: number };
  }>({
    queryKey: ["/api/projects", projectId, "progress"],
    queryFn: () => fetch(`/api/projects/${projectId}/progress`, { credentials: "include" }).then(r => r.json()),
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const scopeItems = data?.scopeItems?.filter((s: any) => s.isActive !== false) ?? [];
  const progress   = data?.progress ?? {};
  const summary    = data?.summary ?? { overallPct: 0, estTotal: 0, installed: 0, remaining: 0 };
  const overall    = summary.overallPct;

  if (scopeItems.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-100">
            <BarChart3 className="w-7 h-7 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-600">No scope items yet</p>
          <p className="text-xs text-slate-400">The project manager will add scope items to enable progress tracking.</p>
        </CardContent>
      </Card>
    );
  }

  const pctBarColor = (pct: number) =>
    pct >= 100 ? "bg-emerald-500" : pct >= 75 ? "bg-blue-500" : "bg-blue-400";

  return (
    <div className="space-y-4">

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Overall Progress", value: `${overall.toFixed(1)}%`, sub: "weighted by est. qty",    color: "text-blue-700",    bg: "bg-blue-50"    },
          { label: "Est. Total",       value: summary.estTotal.toLocaleString(),    sub: "units to install",   color: "text-slate-700",   bg: "bg-slate-100"  },
          { label: "Cumul. Actual",    value: summary.installed.toLocaleString(),   sub: "cumulative actual",  color: "text-emerald-700", bg: "bg-emerald-50" },
          { label: "Remaining",        value: summary.remaining.toLocaleString(),   sub: "units left",         color: "text-amber-700",   bg: "bg-amber-50"   },
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

      {/* Overall completion bar */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Overall Completion</p>
            <p className="text-sm font-bold text-blue-700">{overall.toFixed(1)}%</p>
          </div>
          <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${pctBarColor(overall)}`}
              style={{ width: `${Math.min(100, overall)}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Weighted by estimated quantities — updates automatically when daily reports are submitted.
          </p>
        </CardContent>
      </Card>

      {/* Quantity-Based Progress table */}
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
                {scopeItems.map((scope: any) => {
                  const p = progress[scope.id] ?? { cumulative: 0, remaining: parseFloat(String(scope.estimatedQty)) || 0, pct: 0 };
                  const estQty = parseFloat(String(scope.estimatedQty)) || 0;
                  return (
                    <tr
                      key={scope.id}
                      data-testid={`row-progress-summary-${scope.id}`}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors"
                    >
                      <td className="py-2.5 px-4 text-sm text-slate-700">
                        {scope.itemName}
                        {scope.category && <span className="ml-1.5 text-[10px] text-slate-400">({scope.category})</span>}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-slate-500 font-mono">{scope.unit}</td>
                      <td className="py-2.5 px-4 text-sm text-slate-500 tabular-nums">{estQty.toLocaleString()}</td>
                      <td className="py-2.5 px-4 text-sm font-semibold text-slate-700 tabular-nums">
                        {p.cumulative > 0 ? (
                          <span className="text-emerald-700">{p.cumulative.toLocaleString()}</span>
                        ) : (
                          <span className="text-slate-300">0</span>
                        )}
                      </td>
                      <td className={`py-2.5 px-4 text-sm tabular-nums ${p.remaining === 0 ? "text-emerald-600 font-semibold" : "text-slate-600"}`}>
                        {p.remaining.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2 min-w-[100px]">
                          <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${pctBarColor(p.pct)}`}
                              style={{ width: `${Math.min(100, p.pct)}%` }}
                            />
                          </div>
                          <span className={`text-xs font-semibold w-9 shrink-0 text-right tabular-nums ${p.pct >= 100 ? "text-emerald-600" : p.pct > 0 ? "text-blue-600" : "text-slate-400"}`}>
                            {p.pct.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50">
                  <td colSpan={2} className="py-2.5 px-4 text-xs font-semibold text-slate-600">Total</td>
                  <td className="py-2.5 px-4 text-xs font-bold text-slate-700 tabular-nums">{summary.estTotal.toLocaleString()}</td>
                  <td className="py-2.5 px-4 text-xs font-bold text-emerald-700 tabular-nums">{summary.installed.toLocaleString()}</td>
                  <td className="py-2.5 px-4 text-xs font-bold text-slate-700 tabular-nums">{summary.remaining.toLocaleString()}</td>
                  <td className="py-2.5 px-4 text-xs font-bold text-blue-700">{overall.toFixed(1)}%</td>
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

// ─── Location helper ──────────────────────────────────────────────────────────
function projectLocation(p: Project): string {
  if (p.jobLocation) return p.jobLocation;
  const parts = [p.city, p.state].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "—";
}

// ─── Main workspace page ──────────────────────────────────────────────────────
export default function DailyReportWorkspace() {
  const { projectId } = useParams<{ projectId: string }>();
  const searchStr     = useSearch();
  const searchParams  = new URLSearchParams(searchStr);
  const urlReportId   = searchParams.get("reportId");
  const forceEdit     = searchParams.get("forceEdit") === "true";

  const [activeTab, setActiveTab] = useState<Tab>("new-report");
  const [editingReport, setEditingReport] = useState<any>(null);
  const [autoLoadDone, setAutoLoadDone]   = useState(false);

  const numericProjectId = Number(projectId);

  // Auto-open a specific report when ?reportId= is in the URL
  useEffect(() => {
    if (!urlReportId || autoLoadDone) return;
    setAutoLoadDone(true);
    fetch(`/api/daily-reports/${urlReportId}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(report => {
        if (report?.id) {
          setEditingReport(report);
          setActiveTab("new-report");
        }
      })
      .catch(() => {});
  }, [urlReportId, autoLoadDone]);

  const {
    data: project,
    isLoading: projectLoading,
    isError: projectError,
  } = useQuery<Project>({
    queryKey: ["/api/projects", numericProjectId],
    enabled: !isNaN(numericProjectId),
  });

  if (projectLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Loader2 className="w-8 h-8 text-slate-300 animate-spin" />
        <p className="text-sm text-slate-400">Loading project…</p>
      </div>
    );
  }

  if (projectError || !project) {
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
              <span
                data-testid="text-workspace-project-po"
                className="flex items-center gap-0.5 text-xs text-slate-400 font-medium shrink-0"
              >
                <Hash className="w-3 h-3" />
                {project.poNumber ? `PO: ${project.poNumber}` : "No PO"}
              </span>
              <ProjectStatusBadge status={project.status} />
            </div>
            <div className="flex items-center gap-4 mt-1 flex-wrap">
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <MapPin className="w-3 h-3" />{projectLocation(project)}
              </span>
              {(project.ownerName || project.customerName) && (
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <Users className="w-3 h-3" />
                  {project.ownerName || project.customerName}
                </span>
              )}
              {project.startDate && (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <Calendar className="w-3 h-3" />
                  Started: {new Date(project.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              )}
            </div>
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
        {activeTab === "new-report" && (
          <>
            {/* Editing-existing banner */}
            {editingReport?.id && (
              <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg bg-blue-50 border border-blue-200 mb-4">
                <div className="flex items-center gap-2">
                  <Edit2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <p className="text-xs text-blue-800 font-medium">
                    Editing report #{editingReport.reportNumber || editingReport.id} — {editingReport.status === "submitted" ? "Submitted" : "Draft"}
                  </p>
                </div>
                <Button
                  data-testid="btn-new-report-clear"
                  variant="ghost"
                  size="sm"
                  className="text-xs text-blue-700 hover:text-blue-900 hover:bg-blue-100 h-7 px-2"
                  onClick={() => setEditingReport(null)}
                >
                  + New Report
                </Button>
              </div>
            )}
            <NewReportTab
              key={editingReport?.id ?? "new"}
              projectId={numericProjectId}
              reportId={editingReport?.id ?? null}
              initialData={editingReport}
              forceEdit={forceEdit}
              onSaved={(id, status) => {
                setEditingReport((prev: any) =>
                  prev ? { ...prev, id, status } : { id, status, projectId: numericProjectId }
                );
              }}
            />
          </>
        )}
        {activeTab === "history" && (
          <HistoryTab
            projectId={numericProjectId}
            projectName={project.name}
            onOpen={(report) => {
              setEditingReport(report);
              setActiveTab("new-report");
            }}
          />
        )}
        {activeTab === "progress" && <ProgressTab projectId={numericProjectId} />}
      </div>

    </div>
  );
}
