import { useState } from "react";
import { format } from "date-fns";
import { useLocation } from "wouter";
import {
  FileText, Filter, Plus, Download, Pencil, Eye,
  Users, Clock, ListTodo, Package,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/shared/EmptyState";
import { useLanguage } from "@/hooks/use-language";
import type { Translations } from "@/lib/i18n";

function ReportStatusBadge({ status, t }: { status: string; t: Translations }) {
  if (status === "submitted") return (
    <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 px-2 py-0.5 font-semibold">
      {t.projDailyStatusSubmitted}
    </Badge>
  );
  return (
    <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 px-2 py-0.5 font-semibold">
      {t.projDailyStatusDraft}
    </Badge>
  );
}

function exportReportCsv(report: any, projectName: string, t: any) {
  const fd = report.formData ?? {};
  const rows: string[][] = [];
  rows.push([t.csvTitle]);
  rows.push([t.csvProject, projectName]);
  rows.push([t.csvReportNo, report.reportNumber ?? "—"]);
  rows.push([t.csvReportDate, report.reportDate ?? "—"]);
  rows.push([t.csvPreparedBy, fd.preparedBy ?? "—"]);
  rows.push([t.csvShift, fd.shift ?? "—"]);
  rows.push([t.csvWeather, fd.weather ?? "—"]);
  rows.push([]);
  rows.push([t.csvManpowerHdr]);
  rows.push([t.csvWorker, t.csvTrade, t.csvStatus, t.csvStart, t.csvEnd, t.csvHours, t.csvNotes]);
  (fd.manpower ?? []).forEach((r: any) =>
    rows.push([r.workerName ?? "", r.trade ?? "", r.attendanceStatus ?? "", r.startTime ?? "", r.endTime ?? "", String(r.hoursWorked ?? 0), r.notes ?? ""])
  );
  const totalHrs = (fd.manpower ?? []).reduce((s: number, r: any) => s + Number(r.hoursWorked ?? 0), 0);
  rows.push(["", "", "", "", t.csvTotalHours, String(totalHrs)]);
  rows.push([]);
  rows.push([t.csvTasksHdr]);
  rows.push([t.csvTaskNum, t.csvDescription, t.csvLocation, t.csvQty, t.csvUnitCol, t.csvNotes]);
  (fd.tasks ?? []).forEach((task: any, i: number) =>
    rows.push([String(i + 1), task.description ?? "", task.location ?? "", String(task.qty ?? ""), task.unit ?? "", task.notes ?? ""])
  );
  rows.push([]);
  rows.push([t.csvMaterialsHdr]);
  rows.push([t.csvMaterial, t.csvUnitCol, t.csvQtyUsed, t.csvNotes]);
  (fd.materials ?? []).forEach((m: any) =>
    rows.push([m.description ?? "", m.unit ?? "", String(m.qty ?? ""), m.notes ?? ""])
  );
  rows.push([]);
  rows.push([t.csvEquipmentHdr]);
  rows.push([t.csvEquipment, t.csvQty, t.csvEquipHours, t.csvNotes]);
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

export function DailyReportsTab({ projectId, project }: { projectId: number; project: any }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();
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
      {/* Filter bar */}
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
            {f === "all"
              ? `${t.projDailyFilterAll} (${reports.length})`
              : f === "submitted"
              ? `${t.projDailyStatusSubmitted} (${reports.filter(r => r.status === "submitted").length})`
              : `${t.projDailyStatusDraft} (${reports.filter(r => r.status === "draft").length})`}
          </button>
        ))}
        <div className="flex-1" />
        <Button
          variant="outline" size="sm"
          className="text-xs gap-1.5 h-8 bg-white"
          onClick={() => navigate(`/daily-report/${projectId}`)}
          data-testid="btn-goto-workspace"
        >
          <Plus className="w-3.5 h-3.5" />{t.projDailyNewReport}
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="premium-card bg-white p-12 text-center text-slate-400 text-sm">{t.projDailyLoading}</div>
      ) : filtered.length === 0 ? (
        <div className="premium-card bg-white">
          <EmptyState
            icon={<FileText className="w-10 h-10" />}
            title={t.projDailyEmptyTitle}
            description={filter === "all" ? t.projDailyEmptyAll : t.projDailyEmptyFiltered}
            className="py-12"
          />
        </div>
      ) : (
        <div className="premium-card bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-daily-reports">
              <thead className="bg-slate-50/80 border-b border-slate-100">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs w-[80px]">{t.projDailyColReportNo}</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs w-[90px]">{t.projDailyColDate}</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">{t.projDailyColPreparedBy}</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs w-[90px]">{t.projDailyColStatus}</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600 text-xs w-[70px]">{t.projDailyColWorkers}</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600 text-xs w-[80px]">{t.projDailyColManHrs}</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600 text-xs w-[65px]">{t.projDailyColTasks}</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600 text-xs w-[75px]">{t.projDailyColMaterials}</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">{t.projDailyColLastUpdated}</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs w-[130px]">{t.projDailyColActions}</th>
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
                  const dateStr   = r.reportDate ?? null;
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
                            {r.reportNumber ? `#${r.reportNumber}` : "—"}
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
                        <ReportStatusBadge status={r.status} t={t} />
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
                            variant="outline" size="sm"
                            className={`text-xs h-7 px-2.5 gap-1 ${submitted && canForceEdit ? "border-brand-200 text-brand-700 hover:bg-brand-50" : ""}`}
                            data-testid={`btn-edit-report-${r.id}`}
                            onClick={() => {
                              const forceEditParam = submitted && canForceEdit ? "&forceEdit=true" : "";
                              navigate(`/daily-report/${projectId}?reportId=${r.id}${forceEditParam}`);
                            }}
                          >
                            {submitted && canForceEdit ? <Pencil className="w-3 h-3" /> : submitted ? <Eye className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
                            {submitted && canForceEdit ? t.projDailyBtnEdit : submitted ? t.projDailyBtnView : t.projDailyBtnEdit}
                          </Button>
                          {submitted && (
                            <Button
                              variant="ghost" size="sm"
                              className="text-xs h-7 px-2.5 gap-1 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50"
                              data-testid={`btn-export-report-${r.id}`}
                              onClick={() => {
                                exportReportCsv(r, project.name, t);
                                toast({ title: t.projDailyExportedToast, description: `${t.projDailyExportedDescPrefix} #${r.reportNumber ?? r.id} CSV` });
                              }}
                            >
                              <Download className="w-3 h-3" />{t.projDailyBtnCsv}
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
