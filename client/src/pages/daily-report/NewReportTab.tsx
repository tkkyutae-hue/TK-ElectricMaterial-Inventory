import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar, Users, Package, Truck, Image,
  BarChart2, FileText, ChevronDown, Plus, Trash2,
  Save, Send, Download, AlertTriangle, CheckCircle2,
  Info, Loader2, User, Clock, HardHat,
} from "lucide-react";
import {
  MOCK_PROGRESS_ITEMS, calcProgressRow, overallProgress,
} from "@/lib/mock-daily-report";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { Worker } from "@shared/schema";

// ─── Constants ────────────────────────────────────────────────────────────────
const TASK_STATUS_CFG: Record<string, { label: string; dot: string; text: string }> = {
  "not-started": { label: "Not Started",  dot: "bg-slate-400",   text: "text-slate-500"  },
  "in-progress":  { label: "In Progress", dot: "bg-blue-500",    text: "text-blue-700"   },
  "completed":    { label: "Completed",   dot: "bg-emerald-500", text: "text-emerald-700"},
  "delayed":      { label: "Delayed",     dot: "bg-amber-500",   text: "text-amber-700"  },
  "blocked":      { label: "Blocked",     dot: "bg-red-500",     text: "text-red-700"    },
};

const ATTENDANCE_STATUSES = [
  "ATTEND", "PTO", "SICK", "ABSENT", "OFF",
  "LATE", "EARLY_LEAVE", "WFH", "TRAINING", "SUSPENDED", "TERMINATED",
];

// Statuses where hours are computed from start/end time
const HOURS_COMPUTED = new Set(["ATTEND", "LATE", "EARLY_LEAVE", "WFH", "TRAINING"]);

// ─── Helpers ──────────────────────────────────────────────────────────────────
let _uid = 1000;
function uid() { return ++_uid; }

function calcHours(start: string, end: string, status: string): number {
  if (!HOURS_COMPUTED.has(status) || !start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = (eh * 60 + em) - (sh * 60 + sm);
  return Math.max(0, Math.round(mins / 60 * 10) / 10);
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface TaskRow      { id: number; description: string; area: string; status: string; notes: string }
interface ManpowerRow  { id: number; workerId: number | null; workerName: string; trade: string; attendanceStatus: string; startTime: string; endTime: string; hoursWorked: number; notes: string }
interface MaterialRow  { id: number; description: string; unit: string; qty: number; notes: string }
interface EquipmentRow { id: number; name: string; unit: string; qty: number; hours: number; notes: string }

function isWorkerBasedManpower(rows: any[]): boolean {
  return rows.length === 0 || "workerId" in rows[0];
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({
  num, title, icon, defaultOpen = true, summary, children,
}: {
  num: number; title: string; icon: React.ReactNode;
  defaultOpen?: boolean; summary?: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        data-testid={`section-toggle-${num}`}
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-800 text-white text-[11px] font-bold shrink-0">
            {num}
          </span>
          <span className="text-slate-500 shrink-0">{icon}</span>
          <span className="text-sm font-semibold text-slate-800 shrink-0">{title}</span>
          {!open && summary && (
            <span className="text-xs text-slate-400 font-normal truncate">— {summary}</span>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ml-2 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <CardContent className="pt-0 pb-5 px-5 border-t border-slate-100">
          <div className="pt-4">{children}</div>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Field label ──────────────────────────────────────────────────────────────
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
      {children}
    </label>
  );
}

// ─── Table header ─────────────────────────────────────────────────────────────
function TableHeader({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr className="border-b border-slate-200 bg-slate-50">
        {cols.map((c) => (
          <th key={c} className="text-left py-2 px-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
            {c}
          </th>
        ))}
        <th className="w-8" />
      </tr>
    </thead>
  );
}

// ─── Row delete button ────────────────────────────────────────────────────────
function DeleteBtn({ onClick, testId }: { onClick: () => void; testId: string }) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className="flex items-center justify-center w-7 h-7 rounded-md text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  );
}

// ─── Add row button ───────────────────────────────────────────────────────────
function AddRowBtn({ onClick, label, testId }: { onClick: () => void; label: string; testId: string }) {
  return (
    <Button
      data-testid={testId}
      type="button"
      variant="outline"
      size="sm"
      className="mt-3 gap-1.5 text-xs text-slate-600 border-dashed"
      onClick={onClick}
    >
      <Plus className="w-3.5 h-3.5" /> {label}
    </Button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function NewReportTab({
  projectId,
  reportId,
  initialData,
  onSaved,
}: {
  projectId: number;
  reportId?: number | null;
  initialData?: any;
  onSaved?: (id: number, status: string) => void;
}) {
  const { toast }    = useToast();
  const queryClient  = useQueryClient();

  const fd = initialData?.formData ?? null;

  // ── Workers registry ──
  const { data: workers = [] } = useQuery<Worker[]>({
    queryKey: ["/api/workers"],
  });
  const activeWorkers = workers.filter((w) => w.isActive);

  // ── General Info ──
  const [reportDate,   setReportDate]   = useState<string>(fd?.reportDate   ?? new Date().toISOString().slice(0, 10));
  const [reportNumber, setReportNumber] = useState<string>(fd?.reportNumber  ?? "");
  const [preparedBy,   setPreparedBy]   = useState<string>(fd?.preparedBy    ?? "");
  const [shift,        setShift]        = useState<string>(fd?.shift         ?? "day");
  const [weather,      setWeather]      = useState<string>(fd?.weather       ?? "clear");
  const [temperature,  setTemperature]  = useState<string>(fd?.temperature   ?? "72");

  // ── Dynamic rows ──
  const [tasks, setTasks] = useState<TaskRow[]>(fd?.tasks ?? []);

  const rawMp = fd?.manpower ?? [];
  const [manpower, setManpower] = useState<ManpowerRow[]>(
    isWorkerBasedManpower(rawMp) ? rawMp : []
  );

  const [materials,  setMaterials]  = useState<MaterialRow[]>(fd?.materials  ?? []);
  const [equipment,  setEquipment]  = useState<EquipmentRow[]>(fd?.equipment  ?? []);

  // ── Progress ──
  const [todayQty,    setTodayQty]    = useState<Record<number, number>>(fd?.todayQty    ?? {});
  const [onSchedule,  setOnSchedule]  = useState<boolean>(fd?.onSchedule  ?? true);
  const [issues,      setIssues]      = useState<string>(fd?.issues       ?? "");
  const [nextDayPlan, setNextDayPlan] = useState<string>(fd?.nextDayPlan  ?? "");

  // ── Notes ──
  const [generalNotes,     setGeneralNotes]     = useState<string>(fd?.generalNotes     ?? "");
  const [safetyNotes,      setSafetyNotes]      = useState<string>(fd?.safetyNotes      ?? "");
  const [inspectorVisitor, setInspectorVisitor] = useState<string>(fd?.inspectorVisitor ?? "");

  // ── Status ──
  const [savedStatus, setSavedStatus] = useState<string | null>(initialData?.status ?? null);

  // ── Computed progress ──
  const progressRows = MOCK_PROGRESS_ITEMS.map((item) => calcProgressRow(item, todayQty[item.id] ?? 0));
  const overallPct   = overallProgress(progressRows);

  // ── Manpower totals ──
  const totalWorkers  = manpower.length;
  const totalManhours = manpower.reduce((s, r) => s + r.hoursWorked, 0);

  // ── Section summaries for collapsed state ──
  const taskSummary     = tasks.length     ? `${tasks.length} task${tasks.length !== 1 ? "s" : ""}` : undefined;
  const mpSummary       = manpower.length  ? `${totalWorkers} worker${totalWorkers !== 1 ? "s" : ""} · ${totalManhours.toFixed(1)} hrs` : undefined;
  const matSummary      = materials.length ? `${materials.length} item${materials.length !== 1 ? "s" : ""}` : undefined;
  const eqSummary       = equipment.length ? `${equipment.length} item${equipment.length !== 1 ? "s" : ""}` : undefined;
  const notesSummary    = generalNotes.trim() ? generalNotes.trim().slice(0, 40) + (generalNotes.length > 40 ? "…" : "") : undefined;

  // ── Build form data ──
  function buildFormData() {
    return {
      reportDate, reportNumber, preparedBy, shift, weather, temperature,
      tasks, manpower, materials, equipment,
      todayQty, onSchedule, issues, nextDayPlan,
      generalNotes, safetyNotes, inspectorVisitor,
      photoLog: [],
    };
  }

  // ── Mutation ──
  const saveMutation = useMutation({
    mutationFn: async (status: "draft" | "submitted") => {
      const body = {
        projectId,
        reportDate,
        reportNumber: reportNumber || null,
        preparedBy:   preparedBy   || null,
        status,
        formData: buildFormData(),
      };
      if (reportId) return apiRequest("PATCH", `/api/daily-reports/${reportId}`, body);
      return apiRequest("POST", "/api/daily-reports", body);
    },
    onSuccess: async (res: any, status) => {
      const saved = await res.json();
      setSavedStatus(status);
      queryClient.invalidateQueries({ queryKey: ["/api/daily-reports", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/daily-reports-summary"] });
      toast({
        title: status === "submitted" ? "Report submitted" : "Draft saved",
        description: status === "submitted"
          ? "The daily report has been submitted successfully."
          : "Your progress has been saved as a draft.",
      });
      onSaved?.(saved.id, status);
    },
    onError: (err: any) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  const isSubmitted = savedStatus === "submitted";

  // ── Shared action buttons ──
  function ActionButtons({ bottom }: { bottom?: boolean }) {
    return (
      <div className={`flex items-center gap-2 flex-wrap ${bottom ? "justify-end pt-4 border-t border-slate-200" : "justify-between"}`}>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            data-testid={bottom ? "btn-save-draft-bottom" : "btn-save-draft"}
            variant="outline"
            size="sm"
            className="gap-2 text-slate-700"
            disabled={saveMutation.isPending || isSubmitted}
            onClick={() => saveMutation.mutate("draft")}
          >
            {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Draft
          </Button>
          <Button
            data-testid={bottom ? "btn-submit-report-bottom" : "btn-submit-report"}
            size="sm"
            className={`gap-2 ${isSubmitted ? "bg-emerald-600 hover:bg-emerald-600" : "bg-blue-600 hover:bg-blue-700"} text-white`}
            disabled={saveMutation.isPending || isSubmitted}
            onClick={() => saveMutation.mutate("submitted")}
          >
            {saveMutation.isPending
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : isSubmitted ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
            {isSubmitted ? "Submitted" : "Submit Report"}
          </Button>
          <Button
            data-testid={bottom ? "btn-export-excel-bottom" : "btn-export-excel"}
            variant="outline"
            size="sm"
            className="gap-2 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
            onClick={() => {}}
            disabled
          >
            <Download className="w-3.5 h-3.5" />
            Export Excel
          </Button>
        </div>

        {!bottom && (
          <Badge
            variant="outline"
            className={
              isSubmitted
                ? "text-[11px] bg-emerald-50 text-emerald-700 border-emerald-200 px-2.5 py-1"
                : savedStatus === "draft"
                ? "text-[11px] bg-amber-50 text-amber-700 border-amber-200 px-2.5 py-1"
                : "text-[11px] text-slate-400 border-slate-200 bg-slate-50 px-2.5 py-1"
            }
          >
            {isSubmitted ? "✓ Submitted" : savedStatus === "draft" ? "Draft saved" : "Unsaved"}
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* ── Top action bar ── */}
      <div className="bg-white rounded-xl border border-slate-200 px-5 py-3.5">
        <ActionButtons />
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          Section 1 — General Info
      ══════════════════════════════════════════════════════════════════ */}
      <Section num={1} title="General Info" icon={<Calendar className="w-4 h-4" />}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">

          <div>
            <FieldLabel>Report Date</FieldLabel>
            <Input
              data-testid="input-report-date"
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          <div>
            <FieldLabel>Report No.</FieldLabel>
            <Input
              data-testid="input-report-number"
              value={reportNumber}
              onChange={(e) => setReportNumber(e.target.value)}
              className="h-9 text-sm font-mono"
              placeholder="e.g. 001"
            />
          </div>

          <div>
            <FieldLabel>Prepared By</FieldLabel>
            <Input
              data-testid="input-prepared-by"
              value={preparedBy}
              onChange={(e) => setPreparedBy(e.target.value)}
              className="h-9 text-sm"
              placeholder="Name"
            />
          </div>

          <div>
            <FieldLabel>Shift</FieldLabel>
            <Select value={shift} onValueChange={setShift}>
              <SelectTrigger data-testid="select-shift" className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Day Shift</SelectItem>
                <SelectItem value="night">Night Shift</SelectItem>
                <SelectItem value="both">Both Shifts</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <FieldLabel>Weather</FieldLabel>
            <Select value={weather} onValueChange={setWeather}>
              <SelectTrigger data-testid="select-weather" className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="clear">☀️ Clear</SelectItem>
                <SelectItem value="partly-cloudy">⛅ Partly Cloudy</SelectItem>
                <SelectItem value="overcast">☁️ Overcast</SelectItem>
                <SelectItem value="rain">🌧️ Rain</SelectItem>
                <SelectItem value="wind">💨 Windy</SelectItem>
                <SelectItem value="heat">🌡️ Extreme Heat</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <FieldLabel>Temperature (°F)</FieldLabel>
            <Input
              data-testid="input-temperature"
              type="number"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              className="h-9 text-sm"
              placeholder="°F"
            />
          </div>

        </div>
      </Section>

      {/* ══════════════════════════════════════════════════════════════════
          Section 2 — Work Tasks
      ══════════════════════════════════════════════════════════════════ */}
      <Section num={2} title="Work Tasks" icon={<FileText className="w-4 h-4" />} summary={taskSummary} defaultOpen={true}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="table-tasks">
            <TableHeader cols={["Task Description", "Area / Location", "Status", "Notes"]} />
            <tbody>
              {tasks.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-xs text-slate-300">
                    No tasks yet — add your first task below
                  </td>
                </tr>
              )}
              {tasks.map((row, i) => {
                const cfg = TASK_STATUS_CFG[row.status] ?? TASK_STATUS_CFG["not-started"];
                return (
                  <tr key={row.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                    <td className="py-1.5 px-2 min-w-[180px]">
                      <Input
                        data-testid={`input-task-desc-${i}`}
                        value={row.description}
                        onChange={(e) => setTasks(tasks.map((r) => r.id === row.id ? { ...r, description: e.target.value } : r))}
                        className="h-8 text-xs"
                        placeholder="Describe the task…"
                      />
                    </td>
                    <td className="py-1.5 px-2 min-w-[130px]">
                      <Input
                        data-testid={`input-task-area-${i}`}
                        value={row.area}
                        onChange={(e) => setTasks(tasks.map((r) => r.id === row.id ? { ...r, area: e.target.value } : r))}
                        className="h-8 text-xs"
                        placeholder="Area / Zone"
                      />
                    </td>
                    <td className="py-1.5 px-2 min-w-[140px]">
                      <div className="relative">
                        <span className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full z-10 ${cfg.dot}`} />
                        <Select
                          value={row.status}
                          onValueChange={(v) => setTasks(tasks.map((r) => r.id === row.id ? { ...r, status: v } : r))}
                        >
                          <SelectTrigger data-testid={`select-task-status-${i}`} className={`h-8 text-xs pl-6 ${cfg.text}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(TASK_STATUS_CFG).map(([val, c]) => (
                              <SelectItem key={val} value={val}>
                                <span className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full ${c.dot} shrink-0`} />
                                  {c.label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </td>
                    <td className="py-1.5 px-2 min-w-[130px]">
                      <Input
                        data-testid={`input-task-notes-${i}`}
                        value={row.notes}
                        onChange={(e) => setTasks(tasks.map((r) => r.id === row.id ? { ...r, notes: e.target.value } : r))}
                        className="h-8 text-xs"
                        placeholder="Optional"
                      />
                    </td>
                    <td className="py-1.5 px-1">
                      <DeleteBtn
                        testId={`btn-remove-task-${i}`}
                        onClick={() => setTasks(tasks.filter((r) => r.id !== row.id))}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <AddRowBtn
          testId="btn-add-task"
          label="Add Task"
          onClick={() => setTasks([...tasks, { id: uid(), description: "", area: "", status: "in-progress", notes: "" }])}
        />
      </Section>

      {/* ══════════════════════════════════════════════════════════════════
          Section 3 — Manpower (Worker-based)
      ══════════════════════════════════════════════════════════════════ */}
      <Section num={3} title="Manpower" icon={<Users className="w-4 h-4" />} summary={mpSummary} defaultOpen={true}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="table-manpower">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {[
                  { label: "Worker Name",          cls: "min-w-[160px]" },
                  { label: "Trade",                cls: "min-w-[130px]" },
                  { label: "Attendance",           cls: "min-w-[130px]" },
                  { label: "Start",                cls: "w-24"          },
                  { label: "End",                  cls: "w-24"          },
                  { label: "Hrs",                  cls: "w-14 text-center" },
                  { label: "Notes",                cls: "min-w-[100px]" },
                ].map(({ label, cls }) => (
                  <th key={label} className={`text-left py-2 px-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap ${cls}`}>
                    {label}
                  </th>
                ))}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {manpower.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-xs text-slate-300">
                    No workers added — select workers from the registry below
                  </td>
                </tr>
              )}
              {manpower.map((row, i) => {
                const workerIds = new Set(manpower.filter((r) => r.id !== row.id).map((r) => r.workerId));
                const availableWorkers = activeWorkers.filter((w) => !workerIds.has(w.id));
                const allSelectable = row.workerId
                  ? [activeWorkers.find((w) => w.id === row.workerId), ...availableWorkers].filter(Boolean) as Worker[]
                  : availableWorkers;

                return (
                  <tr key={row.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                    {/* Worker Name */}
                    <td className="py-1.5 px-2">
                      <Select
                        value={row.workerId !== null ? String(row.workerId) : "__none__"}
                        onValueChange={(v) => {
                          if (v === "__none__") {
                            setManpower(manpower.map((r) => r.id === row.id
                              ? { ...r, workerId: null, workerName: "", trade: "" } : r));
                            return;
                          }
                          const w = activeWorkers.find((w) => w.id === Number(v));
                          if (!w) return;
                          setManpower(manpower.map((r) => r.id === row.id
                            ? { ...r, workerId: w.id, workerName: w.fullName, trade: w.trade ?? "" } : r));
                        }}
                      >
                        <SelectTrigger
                          data-testid={`select-mp-worker-${i}`}
                          className="h-8 text-xs"
                        >
                          <SelectValue placeholder="Select worker…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— Select worker —</SelectItem>
                          {allSelectable.map((w) => (
                            <SelectItem key={w.id} value={String(w.id)}>
                              <span className="flex items-center gap-2">
                                <HardHat className="w-3 h-3 text-slate-400 shrink-0" />
                                {w.fullName}
                              </span>
                            </SelectItem>
                          ))}
                          {allSelectable.length === 0 && (
                            <div className="px-3 py-2 text-xs text-slate-400">All workers already added</div>
                          )}
                        </SelectContent>
                      </Select>
                    </td>

                    {/* Trade (read-only auto-filled) */}
                    <td className="py-1.5 px-2">
                      <div className="h-8 flex items-center px-2 text-xs text-slate-500 bg-slate-50 rounded-md border border-slate-200 truncate">
                        {row.trade || <span className="text-slate-300 italic">auto-filled</span>}
                      </div>
                    </td>

                    {/* Attendance Status */}
                    <td className="py-1.5 px-2">
                      <Select
                        value={row.attendanceStatus}
                        onValueChange={(v) => {
                          const hrs = calcHours(row.startTime, row.endTime, v);
                          setManpower(manpower.map((r) => r.id === row.id
                            ? { ...r, attendanceStatus: v, hoursWorked: hrs } : r));
                        }}
                      >
                        <SelectTrigger data-testid={`select-mp-status-${i}`} className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ATTENDANCE_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>

                    {/* Start Time */}
                    <td className="py-1.5 px-2">
                      <Input
                        data-testid={`input-mp-start-${i}`}
                        type="time"
                        value={row.startTime}
                        onChange={(e) => {
                          const hrs = calcHours(e.target.value, row.endTime, row.attendanceStatus);
                          setManpower(manpower.map((r) => r.id === row.id
                            ? { ...r, startTime: e.target.value, hoursWorked: hrs } : r));
                        }}
                        className="h-8 text-xs"
                        disabled={!HOURS_COMPUTED.has(row.attendanceStatus)}
                      />
                    </td>

                    {/* End Time */}
                    <td className="py-1.5 px-2">
                      <Input
                        data-testid={`input-mp-end-${i}`}
                        type="time"
                        value={row.endTime}
                        onChange={(e) => {
                          const hrs = calcHours(row.startTime, e.target.value, row.attendanceStatus);
                          setManpower(manpower.map((r) => r.id === row.id
                            ? { ...r, endTime: e.target.value, hoursWorked: hrs } : r));
                        }}
                        className="h-8 text-xs"
                        disabled={!HOURS_COMPUTED.has(row.attendanceStatus)}
                      />
                    </td>

                    {/* Hours (auto-calc, read-only) */}
                    <td className="py-1.5 px-2">
                      <div className="h-8 flex items-center justify-center px-1 text-xs font-semibold text-slate-700 bg-slate-50 rounded-md border border-slate-200">
                        {HOURS_COMPUTED.has(row.attendanceStatus) ? row.hoursWorked.toFixed(1) : "—"}
                      </div>
                    </td>

                    {/* Notes */}
                    <td className="py-1.5 px-2">
                      <Input
                        data-testid={`input-mp-notes-${i}`}
                        value={row.notes}
                        onChange={(e) => setManpower(manpower.map((r) => r.id === row.id ? { ...r, notes: e.target.value } : r))}
                        className="h-8 text-xs"
                        placeholder="Optional"
                      />
                    </td>

                    <td className="py-1.5 px-1">
                      <DeleteBtn
                        testId={`btn-remove-mp-${i}`}
                        onClick={() => setManpower(manpower.filter((r) => r.id !== row.id))}
                      />
                    </td>
                  </tr>
                );
              })}

              {/* Totals row */}
              {manpower.length > 0 && (
                <tr className="border-t-2 border-slate-200 bg-slate-50">
                  <td className="py-2 px-2 text-xs font-semibold text-slate-600">
                    Total
                  </td>
                  <td colSpan={4} />
                  <td className="py-2 px-2">
                    <div className="h-7 flex items-center justify-center px-1 text-xs font-bold text-blue-700 bg-blue-50 rounded-md border border-blue-200">
                      {totalManhours.toFixed(1)}
                    </div>
                  </td>
                  <td className="py-2 px-2 text-xs text-slate-500">
                    <span className="font-medium">{totalWorkers}</span> worker{totalWorkers !== 1 ? "s" : ""}
                  </td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <AddRowBtn
          testId="btn-add-manpower"
          label="Add Worker"
          onClick={() => setManpower([...manpower, {
            id: uid(),
            workerId: null, workerName: "", trade: "",
            attendanceStatus: "ATTEND",
            startTime: "07:00", endTime: "15:30",
            hoursWorked: calcHours("07:00", "15:30", "ATTEND"),
            notes: "",
          }])}
        />

        {activeWorkers.length === 0 && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-100">
            <Info className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <p className="text-xs text-amber-700">
              No active workers found in the registry. Add workers in the Admin Mode Manpower section first.
            </p>
          </div>
        )}
      </Section>

      {/* ══════════════════════════════════════════════════════════════════
          Section 4 — Materials
      ══════════════════════════════════════════════════════════════════ */}
      <Section num={4} title="Materials" icon={<Package className="w-4 h-4" />} summary={matSummary} defaultOpen={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="table-materials">
            <TableHeader cols={["Material Description", "Unit", "Qty Used", "Notes"]} />
            <tbody>
              {materials.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-xs text-slate-300">
                    No materials logged yet
                  </td>
                </tr>
              )}
              {materials.map((row, i) => (
                <tr key={row.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                  <td className="py-1.5 px-2 min-w-[200px]">
                    <Input
                      data-testid={`input-mat-desc-${i}`}
                      value={row.description}
                      onChange={(e) => setMaterials(materials.map((r) => r.id === row.id ? { ...r, description: e.target.value } : r))}
                      className="h-8 text-xs"
                      placeholder="Material name or description…"
                    />
                  </td>
                  <td className="py-1.5 px-2 w-20">
                    <Input
                      data-testid={`input-mat-unit-${i}`}
                      value={row.unit}
                      onChange={(e) => setMaterials(materials.map((r) => r.id === row.id ? { ...r, unit: e.target.value } : r))}
                      className="h-8 text-xs text-center"
                      placeholder="EA"
                    />
                  </td>
                  <td className="py-1.5 px-2 w-24">
                    <Input
                      data-testid={`input-mat-qty-${i}`}
                      type="number"
                      min={0}
                      value={row.qty}
                      onChange={(e) => setMaterials(materials.map((r) => r.id === row.id ? { ...r, qty: Number(e.target.value) } : r))}
                      className="h-8 text-xs text-center"
                    />
                  </td>
                  <td className="py-1.5 px-2 min-w-[140px]">
                    <Input
                      data-testid={`input-mat-notes-${i}`}
                      value={row.notes}
                      onChange={(e) => setMaterials(materials.map((r) => r.id === row.id ? { ...r, notes: e.target.value } : r))}
                      className="h-8 text-xs"
                      placeholder="Optional"
                    />
                  </td>
                  <td className="py-1.5 px-1">
                    <DeleteBtn
                      testId={`btn-remove-mat-${i}`}
                      onClick={() => setMaterials(materials.filter((r) => r.id !== row.id))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <AddRowBtn
          testId="btn-add-material"
          label="Add Material"
          onClick={() => setMaterials([...materials, { id: uid(), description: "", unit: "EA", qty: 1, notes: "" }])}
        />
      </Section>

      {/* ══════════════════════════════════════════════════════════════════
          Section 5 — Equipment
      ══════════════════════════════════════════════════════════════════ */}
      <Section num={5} title="Equipment" icon={<Truck className="w-4 h-4" />} summary={eqSummary} defaultOpen={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="table-equipment">
            <TableHeader cols={["Equipment Name", "Unit", "Qty", "Hours Used", "Notes"]} />
            <tbody>
              {equipment.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-xs text-slate-300">
                    No equipment logged yet
                  </td>
                </tr>
              )}
              {equipment.map((row, i) => (
                <tr key={row.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                  <td className="py-1.5 px-2 min-w-[180px]">
                    <Input
                      data-testid={`input-eq-name-${i}`}
                      value={row.name}
                      onChange={(e) => setEquipment(equipment.map((r) => r.id === row.id ? { ...r, name: e.target.value } : r))}
                      className="h-8 text-xs"
                      placeholder="Equipment name…"
                    />
                  </td>
                  <td className="py-1.5 px-2 w-20">
                    <Input
                      data-testid={`input-eq-unit-${i}`}
                      value={row.unit}
                      onChange={(e) => setEquipment(equipment.map((r) => r.id === row.id ? { ...r, unit: e.target.value } : r))}
                      className="h-8 text-xs text-center"
                      placeholder="EA"
                    />
                  </td>
                  <td className="py-1.5 px-2 w-20">
                    <Input
                      data-testid={`input-eq-qty-${i}`}
                      type="number"
                      min={0}
                      value={row.qty}
                      onChange={(e) => setEquipment(equipment.map((r) => r.id === row.id ? { ...r, qty: Number(e.target.value) } : r))}
                      className="h-8 text-xs text-center"
                    />
                  </td>
                  <td className="py-1.5 px-2 w-24">
                    <Input
                      data-testid={`input-eq-hours-${i}`}
                      type="number"
                      min={0}
                      step={0.5}
                      value={row.hours}
                      onChange={(e) => setEquipment(equipment.map((r) => r.id === row.id ? { ...r, hours: Number(e.target.value) } : r))}
                      className="h-8 text-xs text-center"
                    />
                  </td>
                  <td className="py-1.5 px-2 min-w-[130px]">
                    <Input
                      data-testid={`input-eq-notes-${i}`}
                      value={row.notes}
                      onChange={(e) => setEquipment(equipment.map((r) => r.id === row.id ? { ...r, notes: e.target.value } : r))}
                      className="h-8 text-xs"
                      placeholder="Optional"
                    />
                  </td>
                  <td className="py-1.5 px-1">
                    <DeleteBtn
                      testId={`btn-remove-eq-${i}`}
                      onClick={() => setEquipment(equipment.filter((r) => r.id !== row.id))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <AddRowBtn
          testId="btn-add-equipment"
          label="Add Equipment"
          onClick={() => setEquipment([...equipment, { id: uid(), name: "", unit: "EA", qty: 1, hours: 0, notes: "" }])}
        />
      </Section>

      {/* ══════════════════════════════════════════════════════════════════
          Section 6 — Photo Log
      ══════════════════════════════════════════════════════════════════ */}
      <Section num={6} title="Photo Log" icon={<Image className="w-4 h-4" />} defaultOpen={false}>
        <div
          data-testid="photo-upload-zone"
          className="flex flex-col items-center justify-center gap-4 py-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 cursor-not-allowed select-none"
        >
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <Image className="w-7 h-7 text-slate-300" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-500">Photo upload</p>
            <p className="text-xs text-slate-400 mt-1">JPG, PNG, HEIC · max 10 MB per photo</p>
            <p className="text-xs text-slate-300 mt-2">Upload will be enabled once backend storage is configured</p>
          </div>
          <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-200">
            Coming soon
          </Badge>
        </div>
      </Section>

      {/* ══════════════════════════════════════════════════════════════════
          Section 7 — Progress
      ══════════════════════════════════════════════════════════════════ */}
      <Section num={7} title="Progress" icon={<BarChart2 className="w-4 h-4" />}>
        <div className="space-y-5">

          {/* A. Overall Completion + On Schedule */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">
                Overall Completion
                <span className="ml-1 normal-case font-normal text-slate-300">(auto-calculated)</span>
              </p>
              <div className="flex items-end gap-3 mb-3">
                <span className="text-4xl font-bold text-slate-800 leading-none">{overallPct}</span>
                <span className="text-lg font-semibold text-slate-400 leading-none mb-0.5">%</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    overallPct >= 100 ? "bg-emerald-500" : overallPct >= 70 ? "bg-blue-500" : overallPct >= 40 ? "bg-blue-400" : "bg-slate-400"
                  }`}
                  style={{ width: `${overallPct}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">Weighted by estimated quantities</p>
            </div>

            <div>
              <FieldLabel>On Schedule?</FieldLabel>
              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  data-testid="btn-on-schedule-yes"
                  onClick={() => setOnSchedule(true)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all flex-1 justify-center ${
                    onSchedule
                      ? "bg-emerald-50 border-emerald-300 text-emerald-700 shadow-sm"
                      : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" /> On Track
                </button>
                <button
                  type="button"
                  data-testid="btn-on-schedule-no"
                  onClick={() => setOnSchedule(false)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all flex-1 justify-center ${
                    !onSchedule
                      ? "bg-rose-50 border-rose-300 text-rose-700 shadow-sm"
                      : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"
                  }`}
                >
                  <AlertTriangle className="w-4 h-4" /> Delayed
                </button>
              </div>
            </div>
          </div>

          {/* Info note */}
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-blue-50 border border-blue-100">
            <Info className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700 leading-relaxed">
              <strong>Est. Qty</strong> is fixed at the project scope level.&nbsp;
              <strong>Prev. Cumul.</strong> is the running total from all submitted reports.&nbsp;
              Enter <strong>Today</strong> below — New Total, Remaining, and Progress % are auto-calculated.
            </p>
          </div>

          {/* B. Progress table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm" data-testid="table-progress">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {[
                    { label: "Work Item / Description", cls: "text-left min-w-[160px] px-3" },
                    { label: "Unit",        cls: "text-center w-12 px-2" },
                    { label: "Est. Qty",    cls: "text-right w-20 px-3", note: "scope" },
                    { label: "Prev. Cumul.", cls: "text-right w-24 px-3", note: "before today" },
                    { label: "Today ✏",    cls: "text-center w-24 px-2 text-blue-700" },
                    { label: "New Total",  cls: "text-right w-20 px-3" },
                    { label: "Remaining",  cls: "text-right w-20 px-3" },
                    { label: "Progress",   cls: "text-center w-28 px-3" },
                  ].map(({ label, cls, note }) => (
                    <th key={label} className={`py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap ${cls}`}>
                      <div>{label}</div>
                      {note && <div className="text-[9px] text-slate-400 normal-case font-normal tracking-normal">{note}</div>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {progressRows.map((row, i) => {
                  const isOver = row.actualTotal > row.estimatedQty;
                  return (
                    <tr key={row.id} data-testid={`row-progress-${row.id}`}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                      <td className="py-2 px-3 text-sm text-slate-700">{row.description}</td>
                      <td className="py-2 px-2 text-center text-xs text-slate-400 font-mono">{row.unit}</td>
                      <td className="py-2 px-3 text-right text-sm text-slate-400 font-mono">{row.estimatedQty.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right text-sm text-slate-400 font-mono">{row.cumulativeQty.toLocaleString()}</td>
                      <td className="py-1.5 px-2 text-center">
                        <Input
                          data-testid={`input-progress-today-${i}`}
                          type="number" min={0}
                          value={todayQty[row.id] ?? ""}
                          placeholder="0"
                          onChange={(e) => setTodayQty((prev) => ({ ...prev, [row.id]: Math.max(0, Number(e.target.value)) }))}
                          className="h-8 text-xs text-center font-semibold border-blue-200 focus:border-blue-400 bg-blue-50 w-20"
                        />
                      </td>
                      <td className={`py-2 px-3 text-right text-sm font-mono font-semibold ${isOver ? "text-amber-600" : "text-slate-700"}`}>
                        {row.actualTotal.toLocaleString()}
                      </td>
                      <td className={`py-2 px-3 text-right text-sm font-mono ${row.remaining === 0 ? "text-emerald-600 font-semibold" : "text-slate-500"}`}>
                        {row.remaining.toLocaleString()}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${row.pct >= 100 ? "bg-emerald-500" : row.pct >= 75 ? "bg-blue-500" : "bg-blue-400"}`}
                              style={{ width: `${row.pct}%` }}
                            />
                          </div>
                          <span className={`text-xs font-bold w-8 text-right shrink-0 ${row.pct >= 100 ? "text-emerald-600" : "text-slate-600"}`}>
                            {row.pct}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td colSpan={2} className="py-2 px-3 text-xs font-semibold text-slate-600">Total</td>
                  <td className="py-2 px-3 text-right text-xs font-bold text-slate-700 font-mono">
                    {progressRows.reduce((s, r) => s + r.estimatedQty, 0).toLocaleString()}
                  </td>
                  <td className="py-2 px-3 text-right text-xs font-bold text-slate-700 font-mono">
                    {progressRows.reduce((s, r) => s + r.cumulativeQty, 0).toLocaleString()}
                  </td>
                  <td className="py-2 px-2 text-center text-xs font-bold text-blue-700 font-mono">
                    {progressRows.reduce((s, r) => s + r.todayQty, 0).toLocaleString()}
                  </td>
                  <td className="py-2 px-3 text-right text-xs font-bold text-slate-700 font-mono">
                    {progressRows.reduce((s, r) => s + r.actualTotal, 0).toLocaleString()}
                  </td>
                  <td className="py-2 px-3 text-right text-xs font-bold text-slate-700 font-mono">
                    {progressRows.reduce((s, r) => s + r.remaining, 0).toLocaleString()}
                  </td>
                  <td className="py-2 px-3 text-center text-xs font-bold text-slate-700">{overallPct}%</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* C. Issues / Delays */}
          <div>
            <FieldLabel>Issues / Delays</FieldLabel>
            <Textarea
              data-testid="input-issues"
              value={issues}
              onChange={(e) => setIssues(e.target.value)}
              placeholder="Describe any issues, delays, or blockers encountered today. Include root cause, affected scope, and any corrective action taken…"
              className="text-sm min-h-[90px] resize-y"
            />
          </div>

          {/* D. Next Day Work Plan */}
          <div>
            <FieldLabel>Next Day Work Plan</FieldLabel>
            <Textarea
              data-testid="input-next-day-plan"
              value={nextDayPlan}
              onChange={(e) => setNextDayPlan(e.target.value)}
              placeholder="List the planned work scope for tomorrow's shift. Include work items, areas, and any special requirements or crew changes…"
              className="text-sm min-h-[90px] resize-y"
            />
          </div>

        </div>
      </Section>

      {/* ══════════════════════════════════════════════════════════════════
          Section 8 — Notes / Remarks
      ══════════════════════════════════════════════════════════════════ */}
      <Section num={8} title="Notes / Remarks" icon={<FileText className="w-4 h-4" />} summary={notesSummary} defaultOpen={true}>
        <div className="space-y-4">

          <div>
            <FieldLabel>General Notes</FieldLabel>
            <Textarea
              data-testid="input-general-notes"
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              placeholder="Any general observations, site conditions, or notes for the record…"
              className="text-sm min-h-[90px] resize-y"
            />
          </div>

          <div>
            <FieldLabel>Safety Observations</FieldLabel>
            <Textarea
              data-testid="input-safety-notes"
              value={safetyNotes}
              onChange={(e) => setSafetyNotes(e.target.value)}
              placeholder="Safety incidents, near misses, toolbox talk topics, PPE compliance, hazard observations…"
              className="text-sm min-h-[80px] resize-y"
            />
          </div>

          <div>
            <FieldLabel>Inspector / Visitor on Site</FieldLabel>
            <Input
              data-testid="input-inspector-visitor"
              value={inspectorVisitor}
              onChange={(e) => setInspectorVisitor(e.target.value)}
              placeholder="Name and affiliation of any inspector or visitor"
              className="h-9 text-sm"
            />
          </div>

        </div>
      </Section>

      {/* ── Bottom action bar ── */}
      <div className="bg-white rounded-xl border border-slate-200 px-5 py-4">
        <ActionButtons bottom />
      </div>

    </div>
  );
}
