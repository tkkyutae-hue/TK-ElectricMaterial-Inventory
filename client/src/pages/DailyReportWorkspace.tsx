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
import { useLanguage } from "@/hooks/use-language";

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

function useTabs(): { id: Tab; label: string; icon: React.ReactNode }[] {
  const { t } = useLanguage();
  return [
    { id: "new-report", label: t.dailyWorkspaceTabNew,      icon: <PlusCircle className="w-4 h-4" /> },
    { id: "history",    label: t.dailyWorkspaceTabHistory,  icon: <ClipboardList className="w-4 h-4" /> },
    { id: "progress",   label: t.dailyWorkspaceTabProgress, icon: <BarChart3 className="w-4 h-4" /> },
  ];
}

// ─── Status badge helper ─────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const { t } = useLanguage();
  if (status === "submitted") {
    return (
      <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 px-1.5 py-0 font-semibold">
        {t.dailyWorkspaceStatusSubmitted}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 px-1.5 py-0 font-semibold">
      {t.dailyWorkspaceStatusDraft}
    </Badge>
  );
}

// ─── Weather code mapper ───────────────────────────────────────────────────────
const WEATHER_MAP: Record<string, string> = {
  // Sunny / clear
  clear: "SUNNY", sunny: "SUNNY",
  // Cloudy — handles hyphenated editor value "partly-cloudy" after normalisation
  "partly cloudy": "CLOUDY", cloudy: "CLOUDY", overcast: "CLOUDY",
  // Rain
  rain: "RAIN", rainy: "RAIN", raining: "RAIN", drizzle: "RAIN",
  // Snow
  snow: "SNOW", snowy: "SNOW", snowing: "SNOW",
  // Tornado
  tornado: "TORNADO",
  // Editor-only values not in the five-option template — output as-is (uppercased)
  wind: "WIND", windy: "WIND",
  heat: "HEAT", hot: "HEAT",
};
function mapWeather(raw: string): string {
  // Normalise: lowercase, strip leading/trailing spaces, convert hyphens to spaces
  const key = (raw ?? "").toLowerCase().trim().replace(/-/g, " ");
  return WEATHER_MAP[key] ?? (raw ? raw.toUpperCase() : "—");
}

// ─── Excel export helper (ExcelJS) ───────────────────────────────────────────
async function exportReportToExcel(report: any, project: any): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Daily Report");

  const fd = report.formData ?? {};

  // Project location: jobLocation takes priority, else build from address parts
  const projectLoc =
    project?.jobLocation ||
    [project?.addressLine1, project?.city, project?.state].filter(Boolean).join(", ") ||
    "—";

  const fmtDate = (d: string | null | undefined) =>
    d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }) : "—";
  const duration = project
    ? `${fmtDate(project.startDate)} ~ ${fmtDate(project.endDate)}`
    : "—";
  const fmtTemp = (v: string | number | null | undefined) =>
    (v != null && v !== "") ? `${v}°F` : "—";

  // ── Helpers ────────────────────────────────────────────────────────────────
  const HEADER_FILL: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3A5F" } };
  const SECTION_FILL: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EDF5" } };
  const LABEL_FILL: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF8E7" } };
  const COL_LABEL_FILL: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F4FA" } };
  const PHOTO_LABEL_FILL: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
  const PHOTO_DESC_FILL: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFBF0" } };
  const PHOTO_MEMO_FILL: ExcelJS.FillPattern = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };

  function addTitle(text: string) {
    const row = ws.addRow([text]);
    row.height = 24;
    const cell = row.getCell(1);
    cell.fill = HEADER_FILL;
    cell.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle" };
    ws.mergeCells(`A${row.number}:H${row.number}`);
  }

  function addKV(label: string, value: string, label2?: string, value2?: string) {
    const r = ws.addRow([label, value, "", label2 ?? "", value2 ?? ""]);
    r.getCell(1).font = { bold: true, size: 10 };
    r.getCell(1).fill = LABEL_FILL;
    r.getCell(4).font = { bold: true, size: 10 };
    if (label2) r.getCell(4).fill = LABEL_FILL;
    r.getCell(2).font = { size: 10 };
    r.getCell(5).font = { size: 10 };
    [1,2,4,5].forEach(c => { r.getCell(c).alignment = { vertical: "middle", wrapText: true }; });
    r.height = 18;
  }

  function addSectionHeader(text: string) {
    ws.addRow([]);
    const row = ws.addRow([text]);
    row.height = 20;
    const cell = row.getCell(1);
    cell.fill = SECTION_FILL;
    cell.font = { bold: true, size: 11, color: { argb: "FF1F3A5F" } };
    cell.alignment = { vertical: "middle" };
    ws.mergeCells(`A${row.number}:H${row.number}`);
  }

  function addColHeader(cols: string[]) {
    const row = ws.addRow(cols);
    row.height = 16;
    cols.forEach((_, i) => {
      const c = row.getCell(i + 1);
      c.fill = COL_LABEL_FILL;
      c.font = { bold: true, size: 9 };
      c.alignment = { vertical: "middle" };
      c.border = { bottom: { style: "thin", color: { argb: "FFCCCCCC" } } };
    });
  }

  function addDataRow(vals: (string | number)[]) {
    const row = ws.addRow(vals);
    row.height = 16;
    vals.forEach((_, i) => {
      row.getCell(i + 1).font = { size: 10 };
      row.getCell(i + 1).alignment = { vertical: "middle", wrapText: true };
    });
    return row;
  }

  // ── Column widths ──
  ws.columns = [
    { width: 22 }, { width: 28 }, { width: 14 }, { width: 20 },
    { width: 28 }, { width: 10 }, { width: 10 }, { width: 20 },
  ];

  // ── Title ──────────────────────────────────────────────────────────────────
  addTitle("VoltStock — Daily Report");

  // ── Project header ─────────────────────────────────────────────────────────
  addKV("PO / JOB NO:",     project?.code ?? project?.poNumber ?? "—");
  addKV("PROJECT:",         project?.name ?? "—");
  addKV("CLIENT:",          project?.customerName ?? "—");
  addKV("PROJECT LOCATION:", projectLoc);
  addKV("PROJECT DURATION:", duration);
  addKV("Report No.:",      String(report.reportNumber ?? "—"), "Report Date:", report.reportDate ?? "—");
  addKV("REPORTER:",        fd.preparedBy ?? "—",             "TITLE:",       fd.preparedByTrade ?? "—");
  addKV("PROJECT MANAGER:", fd.projectManager ?? "—",         "TITLE:",       fd.projectManagerTrade ?? "—");
  addKV("Shift:",           fd.shift ?? "—",                  "WEATHER:",     mapWeather(fd.weather ?? ""));
  addKV("TEMP HIGH:",       fmtTemp(fd.temperatureHigh),      "TEMP LOW:",    fmtTemp(fd.temperatureLow));

  // ── Manpower ───────────────────────────────────────────────────────────────
  addSectionHeader("MANPOWER");
  addColHeader(["Worker", "Trade", "Status", "Start", "End", "Hours", "Notes"]);
  (fd.manpower ?? []).forEach((r: any) => {
    addDataRow([r.workerName ?? "", r.trade ?? "", r.attendanceStatus ?? "", r.startTime ?? "", r.endTime ?? "", Number(r.hoursWorked ?? 0), r.notes ?? ""]);
  });
  const totalHrs = (fd.manpower ?? []).reduce((s: number, r: any) => s + Number(r.hoursWorked ?? 0), 0);
  const totRow = ws.addRow(["", "", "", "", "Total:", totalHrs.toFixed(1), ""]);
  totRow.getCell(5).font = { bold: true, size: 10 };
  totRow.getCell(6).font = { bold: true, size: 10 };

  // ── Work Tasks ─────────────────────────────────────────────────────────────
  addSectionHeader("WORK TASKS");
  addColHeader(["Description", "Area", "Status", "Notes"]);
  (fd.tasks ?? []).forEach((r: any) => {
    addDataRow([r.description ?? "", r.area ?? "", r.status ?? "", r.notes ?? ""]);
  });

  // ── Materials ──────────────────────────────────────────────────────────────
  addSectionHeader("MATERIALS");
  addColHeader(["Material", "Size / Spec", "Unit", "Qty", "Notes"]);
  (fd.materials ?? []).forEach((r: any) => {
    addDataRow([r.description ?? "", r.spec ?? r.remarks ?? "", r.unit ?? "", Number(r.qty ?? 0), r.notes ?? ""]);
  });

  // ── Equipment ──────────────────────────────────────────────────────────────
  addSectionHeader("EQUIPMENT");
  addColHeader(["Equipment", "Unit", "Qty", "Hours", "Notes"]);
  (fd.equipment ?? []).forEach((r: any) => {
    addDataRow([r.name ?? "", r.unit ?? "", Number(r.qty ?? 0), Number(r.hours ?? 0), r.notes ?? ""]);
  });

  // ── Notes / Remarks ────────────────────────────────────────────────────────
  addSectionHeader("NOTES / REMARKS");
  addKV("General Notes:",            fd.generalNotes ?? "");
  addKV("Safety Concerns:",          fd.safetyNotes ?? "");
  addKV("Request From Client/Team:", fd.requestFromClient ?? "");
  addKV("Inspector/Visitor:",        fd.inspectorVisitor ?? "");
  addKV("Drawing No.:",              fd.drawingNo ?? "");
  addKV("Drawing Description:",      fd.drawingDescription ?? "");

  // ── Work Photos section — PICTURE / WORK DESCRIPTION / MEMO per task ──────
  const tasksWithPhotos = (fd.tasks ?? []).filter((t: any) => (t.photoFiles ?? []).length > 0);
  if (tasksWithPhotos.length > 0) {
    addSectionHeader("WORK PHOTOS");
    for (const task of tasksWithPhotos) {
      // Task sub-header
      ws.addRow([]);
      const taskRow = ws.addRow([`Task: ${task.description ?? "—"}`]);
      taskRow.getCell(1).font = { bold: true, size: 10, italic: true };
      ws.mergeCells(`A${taskRow.number}:H${taskRow.number}`);

      const photos: { url: string; workDescription: string; memo: string }[] =
        (task.photoFiles ?? []).map((p: any) =>
          typeof p === "string" ? { url: p, workDescription: "", memo: "" } : p
        );

      // Pair photos: [0,1] then [2,3]
      for (let i = 0; i < photos.length; i += 2) {
        const p1 = photos[i];
        const p2 = photos[i + 1] ?? null;
        const picNum1 = i + 1;
        const picNum2 = i + 2;

        // PICTURE labels
        const picLabelRow = ws.addRow([`PICTURE ${picNum1}`, "", "", "", p2 ? `PICTURE ${picNum2}` : ""]);
        [1, 5].forEach(c => {
          const cell = picLabelRow.getCell(c);
          cell.fill = PHOTO_LABEL_FILL;
          cell.font = { bold: true, size: 10, color: { argb: "FF1D4ED8" } };
          cell.alignment = { horizontal: "center", vertical: "middle" };
        });
        ws.mergeCells(`A${picLabelRow.number}:D${picLabelRow.number}`);
        if (p2) ws.mergeCells(`E${picLabelRow.number}:H${picLabelRow.number}`);
        picLabelRow.height = 18;

        // WORK DESCRIPTION row
        const descRow = ws.addRow(["WORK DESCRIPTION", p1.workDescription, "", "", p2 ? "WORK DESCRIPTION" : "", p2 ? p2.workDescription : ""]);
        [1, 5].forEach(c => {
          descRow.getCell(c).fill = PHOTO_DESC_FILL;
          descRow.getCell(c).font = { bold: true, size: 9 };
          descRow.getCell(c).alignment = { vertical: "middle" };
        });
        [2, 6].forEach(c => {
          descRow.getCell(c).font = { size: 10 };
          descRow.getCell(c).alignment = { vertical: "middle", wrapText: true };
        });
        ws.mergeCells(`B${descRow.number}:D${descRow.number}`);
        if (p2) ws.mergeCells(`F${descRow.number}:H${descRow.number}`);
        descRow.height = 18;

        // MEMO row
        const memoRow = ws.addRow(["MEMO", p1.memo, "", "", p2 ? "MEMO" : "", p2 ? p2.memo : ""]);
        [1, 5].forEach(c => {
          memoRow.getCell(c).fill = PHOTO_MEMO_FILL;
          memoRow.getCell(c).font = { bold: true, size: 9 };
          memoRow.getCell(c).alignment = { vertical: "middle" };
        });
        [2, 6].forEach(c => {
          memoRow.getCell(c).font = { size: 10 };
          memoRow.getCell(c).alignment = { vertical: "middle", wrapText: true };
        });
        ws.mergeCells(`B${memoRow.number}:D${memoRow.number}`);
        if (p2) ws.mergeCells(`F${memoRow.number}:H${memoRow.number}`);
        memoRow.height = 18;
      }
    }
  }

  // ── Download ───────────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href  = url;
  link.download = `DailyReport_${report.reportNumber ?? report.id}_${report.reportDate ?? "unknown"}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

// ─── Tab content components ───────────────────────────────────────────────────
function HistoryTab({
  projectId,
  project,
  onOpen,
}: {
  projectId: number;
  project: any;
  onOpen: (report: any) => void;
}) {
  const { toast } = useToast();
  const { t } = useLanguage();

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
          <p className="text-sm font-medium text-slate-600">{t.dailyWorkspaceNoReportsYet}</p>
          <p className="text-xs text-slate-400">{t.dailyWorkspaceNoReportsHint}</p>
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
          {reports.length} {reports.length !== 1 ? t.dailyWorkspaceReportPlural : t.dailyWorkspaceReportSingular} {t.dailyWorkspaceTotalSuffix}
        </span>
        <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
          {reports.filter((r) => r.status === "draft").length} {t.dailyWorkspaceDraftSuffix}
        </span>
        <span className="flex items-center gap-1 text-xs text-emerald-700 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          {reports.filter((r) => r.status === "submitted").length} {t.dailyWorkspaceSubmittedSuffix}
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
                        {t.dailyWorkspaceByPrefix} {fd.preparedBy}
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
                        {workerCount} {workerCount !== 1 ? t.dailyWorkspaceWorkerPlural : t.dailyWorkspaceWorkerSingular}
                      </span>
                    )}
                    {totalHours > 0 && (
                      <span
                        data-testid={`text-report-hours-${r.id}`}
                        className="flex items-center gap-1 text-xs text-slate-500"
                      >
                        <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                        {totalHours.toFixed(1)} {t.dailyWorkspaceManHrs}
                      </span>
                    )}
                    {taskCount > 0 && (
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <ListTodo className="w-3 h-3 text-slate-400 shrink-0" />
                        {taskCount} {taskCount !== 1 ? t.dailyWorkspaceTaskPlural : t.dailyWorkspaceTaskSingular}
                      </span>
                    )}
                    {workerCount === 0 && taskCount === 0 && (
                      <span className="text-xs text-slate-300 italic">{t.dailyWorkspaceNoData}</span>
                    )}
                  </div>

                  {/* Row 3: Last updated */}
                  {updatedAt && (
                    <p className="text-[11px] text-slate-400">
                      {t.dailyWorkspaceLastUpdated} {updatedAt.toLocaleString("en-US", {
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
                    {submitted ? t.dailyWorkspaceView : t.dailyWorkspaceEdit}
                  </Button>
                  {submitted && (
                    <Button
                      data-testid={`btn-export-report-${r.id}`}
                      variant="ghost"
                      size="sm"
                      className="text-xs gap-1.5 h-8 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50"
                      onClick={() => {
                        exportReportToExcel(r, project)
                          .then(() => toast({ title: t.dailyWorkspaceExportedToast, description: t.dailyWorkspaceExportedDesc.replace("{n}", String(r.reportNumber ?? r.id)) }))
                          .catch(() => toast({ title: "Export failed", variant: "destructive" }));
                      }}
                    >
                      <Download className="w-3.5 h-3.5" />
                      {t.dailyWorkspaceExport}
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
  const { t } = useLanguage();
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
          <p className="text-sm font-medium text-slate-600">{t.dailyWorkspaceNoScope}</p>
          <p className="text-xs text-slate-400">{t.dailyWorkspaceNoScopeHint}</p>
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
          { label: t.dailyWorkspaceOverallProgress, value: `${overall.toFixed(1)}%`, sub: t.dailyWorkspaceWeightedHint,   color: "text-blue-700",    bg: "bg-blue-50"    },
          { label: t.dailyWorkspaceEstTotal,        value: summary.estTotal.toLocaleString(),    sub: t.dailyWorkspaceUnitsToInstall, color: "text-slate-700",   bg: "bg-slate-100"  },
          { label: t.dailyWorkspaceCumulActual,     value: summary.installed.toLocaleString(),   sub: t.dailyWorkspaceCumulActualSub, color: "text-emerald-700", bg: "bg-emerald-50" },
          { label: t.dailyWorkspaceRemaining,       value: summary.remaining.toLocaleString(),   sub: t.dailyWorkspaceUnitsLeft,      color: "text-amber-700",   bg: "bg-amber-50"   },
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
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{t.dailyWorkspaceOverallCompletion}</p>
            <p className="text-sm font-bold text-blue-700">{overall.toFixed(1)}%</p>
          </div>
          <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${pctBarColor(overall)}`}
              style={{ width: `${Math.min(100, overall)}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            {t.dailyWorkspaceWeightedNote}
          </p>
        </CardContent>
      </Card>

      {/* Quantity-Based Progress table */}
      <Card>
        <CardHeader className="pb-2 flex-row items-center gap-2">
          <BarChart3 className="w-4 h-4 text-slate-500 shrink-0" />
          <div className="flex-1">
            <CardTitle className="text-sm font-semibold text-slate-700">{t.dailyWorkspaceQtyProgress}</CardTitle>
            <p className="text-[11px] text-slate-400 mt-0.5">{t.dailyWorkspaceQtyProgressSub}</p>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-progress-summary">
              <thead>
                <tr className="border-y border-slate-200 bg-slate-50">
                  {[t.dailyWorkspaceColWorkItem, t.dailyWorkspaceColUnit, t.dailyWorkspaceColEstQty, t.dailyWorkspaceColCumulActual, t.dailyWorkspaceColRemaining, t.dailyWorkspaceColProgress].map((h) => (
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
                  <td colSpan={2} className="py-2.5 px-4 text-xs font-semibold text-slate-600">{t.dailyWorkspaceTotalRow}</td>
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
          {t.dailyWorkspaceProgressFootnote}
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
  const { t } = useLanguage();
  const TABS = useTabs();
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
        <p className="text-sm text-slate-400">{t.dailyWorkspaceLoadingProject}</p>
      </div>
    );
  }

  if (projectError || !project) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-100">
          <AlertCircle className="w-8 h-8 text-slate-400" />
        </div>
        <p className="text-sm font-medium text-slate-600">{t.dailyWorkspaceProjectNotFound}</p>
        <p className="text-xs text-slate-400">{t.dailyWorkspaceIdLabel} {projectId}</p>
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
                {project.poNumber ? `${t.dailyWorkspacePoPrefix} ${project.poNumber}` : t.dailyWorkspaceNoPo}
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
                  {t.dailyWorkspaceStarted} {new Date(project.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
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
                    {t.dailyWorkspaceEditingPrefix} #{editingReport.reportNumber || editingReport.id} — {editingReport.status === "submitted" ? t.dailyWorkspaceStatusSubmitted : t.dailyWorkspaceStatusDraft}
                  </p>
                </div>
                <Button
                  data-testid="btn-new-report-clear"
                  variant="ghost"
                  size="sm"
                  className="text-xs text-blue-700 hover:text-blue-900 hover:bg-blue-100 h-7 px-2"
                  onClick={() => setEditingReport(null)}
                >
                  {t.dailyWorkspaceNewReportBtn}
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
                if (status === "deleted") {
                  setEditingReport(null);
                  setActiveTab("history");
                  return;
                }
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
            project={project}
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
