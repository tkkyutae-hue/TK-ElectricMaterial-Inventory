import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar, Users, Package, Truck, Image,
  BarChart2, FileText, ChevronDown, Plus, Trash2,
  Save, Send, Download, AlertTriangle, CheckCircle2,
  Info, Loader2, HardHat, Upload, Paperclip, Camera,
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
const TASK_STATUS_CFG: Record<string, { label: string; dot: string; text: string; rowBg: string }> = {
  "not-started": { label: "Not Started",  dot: "bg-slate-400",   text: "text-slate-500",   rowBg: "" },
  "in-progress":  { label: "In Progress", dot: "bg-blue-500",    text: "text-blue-700",    rowBg: "" },
  "completed":    { label: "Completed",   dot: "bg-emerald-500", text: "text-emerald-700", rowBg: "" },
  "delayed":      { label: "Delayed",     dot: "bg-amber-500",   text: "text-amber-700",   rowBg: "bg-amber-50/40" },
  "blocked":      { label: "Blocked",     dot: "bg-red-500",     text: "text-red-700",     rowBg: "bg-red-50/40" },
};

const ATTENDANCE_STATUSES = [
  "ATTEND", "PTO", "SICK", "ABSENT", "OFF",
  "LATE", "EARLY_LEAVE", "WFH", "TRAINING", "SUSPENDED", "TERMINATED",
];

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
interface TaskRow      { id: number; description: string; area: string; status: string; notes: string; drawingCount: number; photoCount: number }
interface ManpowerRow  { id: number; workerId: number | null; workerName: string; trade: string; attendanceStatus: string; startTime: string; endTime: string; hoursWorked: number; notes: string }
interface MaterialRow  { id: number; description: string; unit: string; qty: number; notes: string; inventoryItemId: number | null }
interface EquipmentRow { id: number; name: string; unit: string; qty: number; hours: number; notes: string }

function isWorkerBasedManpower(rows: any[]): boolean {
  return rows.length === 0 || "workerId" in rows[0];
}

// ─── Section color palette ────────────────────────────────────────────────────
const SECTION_ICON_STYLE: Record<number, { bg: string; icon: string }> = {
  1: { bg: "bg-blue-50",    icon: "text-blue-500"    },
  2: { bg: "bg-violet-50",  icon: "text-violet-500"  },
  3: { bg: "bg-emerald-50", icon: "text-emerald-600" },
  4: { bg: "bg-amber-50",   icon: "text-amber-600"   },
  5: { bg: "bg-orange-50",  icon: "text-orange-600"  },
  6: { bg: "bg-sky-50",     icon: "text-sky-500"     },
  7: { bg: "bg-teal-50",    icon: "text-teal-600"    },
  8: { bg: "bg-slate-100",  icon: "text-slate-500"   },
};

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({
  num, title, icon, defaultOpen = true, summary, children,
}: {
  num: number; title: string; icon: React.ReactNode;
  defaultOpen?: boolean; summary?: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const ic = SECTION_ICON_STYLE[num] ?? { bg: "bg-slate-100", icon: "text-slate-500" };
  return (
    <Card className="overflow-hidden shadow-none border border-slate-200">
      <button
        type="button"
        data-testid={`section-toggle-${num}`}
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/70 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-bold shrink-0 tabular-nums">{num}</span>
          <span className={`flex items-center justify-center w-7 h-7 rounded-lg shrink-0 ${ic.bg}`}>
            <span className={ic.icon}>{icon}</span>
          </span>
          <span className="text-sm font-semibold text-slate-800 shrink-0 tracking-tight">{title}</span>
          {!open && summary && (
            <span className="ml-1 text-[11px] text-slate-400 font-normal truncate">{summary}</span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ml-3 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <CardContent className="pt-0 pb-6 px-5 border-t border-slate-100">
          <div className="pt-5">{children}</div>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Field label ──────────────────────────────────────────────────────────────
function FL({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5 select-none">
      {children}
    </label>
  );
}

// ─── Table header ─────────────────────────────────────────────────────────────
function TH({ cols }: { cols: { label: string; cls?: string }[] }) {
  return (
    <thead>
      <tr className="border-b border-slate-200 bg-slate-50/80">
        {cols.map(({ label, cls }) => (
          <th key={label} className={`py-2 px-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-widest whitespace-nowrap text-left ${cls ?? ""}`}>
            {label}
          </th>
        ))}
        <th className="w-9 py-2 px-1" />
      </tr>
    </thead>
  );
}

// ─── Delete button ────────────────────────────────────────────────────────────
function DelBtn({ onClick, testId }: { onClick: () => void; testId: string }) {
  return (
    <button type="button" data-testid={testId} onClick={onClick}
      className="flex items-center justify-center w-7 h-7 rounded-md text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors">
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  );
}

// ─── Add row button ───────────────────────────────────────────────────────────
function AddRow({ onClick, label, testId }: { onClick: () => void; label: string; testId: string }) {
  return (
    <Button data-testid={testId} type="button" variant="outline" size="sm"
      className="mt-4 gap-1.5 text-xs text-slate-500 border-dashed border-slate-300 hover:border-slate-400 hover:text-slate-700"
      onClick={onClick}>
      <Plus className="w-3.5 h-3.5" /> {label}
    </Button>
  );
}

// ─── Read-only cell ───────────────────────────────────────────────────────────
function ROCell({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <div className={`h-8 flex items-center px-2.5 text-xs text-slate-500 bg-slate-50 rounded-md border border-slate-200 select-none ${center ? "justify-center font-semibold text-slate-700" : ""}`}>
      {children}
    </div>
  );
}

// ─── Worker Combobox ──────────────────────────────────────────────────────────
// Supports both free-text entry and selection from the registered worker list.
// Fixes the "name appearing twice" issue by using a plain Input instead of <Select>.
function WorkerCombobox({
  row,
  allWorkers,
  takenIds,
  testId,
  onChange,
}: {
  row: ManpowerRow;
  allWorkers: Worker[];
  takenIds: Set<number | null>;
  testId: string;
  onChange: (patch: Partial<ManpowerRow>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery]  = useState(row.workerName);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = allWorkers
    .filter((w) => !takenIds.has(w.id) || w.id === row.workerId)
    .filter((w) => !query || w.fullName.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8);

  useEffect(() => { setQuery(row.workerName); }, [row.workerName]);

  return (
    <div ref={ref} className="relative">
      <Input
        data-testid={testId}
        value={query}
        placeholder="Type name or search…"
        className="h-8 text-xs"
        onChange={(e) => {
          const val = e.target.value;
          setQuery(val);
          setOpen(true);
          onChange({ workerName: val, workerId: null, trade: row.trade });
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-lg border border-slate-200 shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((w) => (
            <button
              key={w.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setQuery(w.fullName);
                setOpen(false);
                onChange({ workerId: w.id, workerName: w.fullName, trade: w.trade ?? "" });
              }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center gap-2 transition-colors"
            >
              <HardHat className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="font-medium text-slate-700 truncate">{w.fullName}</span>
              {w.trade && <span className="text-slate-400 ml-auto shrink-0">{w.trade}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Material Search (inventory-linked) ──────────────────────────────────────
function MaterialSearch({
  row,
  inventoryItems,
  testId,
  onChange,
}: {
  row: MaterialRow;
  inventoryItems: any[];
  testId: string;
  onChange: (patch: Partial<MaterialRow>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(row.description);

  const filtered = inventoryItems
    .filter((item) => !query || item.name.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 10);

  useEffect(() => { setQuery(row.description); }, [row.description]);

  return (
    <div className="relative">
      <Input
        data-testid={testId}
        value={query}
        placeholder="Search inventory or enter material…"
        className="h-8 text-xs border-transparent bg-transparent hover:border-slate-300 hover:bg-white focus:border-blue-300 focus:bg-white transition-colors"
        onChange={(e) => {
          const val = e.target.value;
          setQuery(val);
          setOpen(true);
          onChange({ description: val, inventoryItemId: null });
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-lg border border-slate-200 shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setQuery(item.name);
                setOpen(false);
                onChange({
                  description: item.name,
                  unit: item.unitOfMeasure ?? row.unit,
                  inventoryItemId: item.id,
                });
              }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center justify-between gap-3 transition-colors"
            >
              <span className="font-medium text-slate-700 truncate">{item.name}</span>
              <span className="text-[11px] text-slate-400 shrink-0 font-mono">{item.unitOfMeasure}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Task Attachment Pill ─────────────────────────────────────────────────────
function AttachPill({
  icon, count, label, testId, onClick,
}: { icon: React.ReactNode; count: number; label: string; testId: string; onClick: () => void }) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      title={label}
      className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-medium transition-colors ${
        count > 0
          ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
          : "border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-600"
      }`}
    >
      {icon}
      {count > 0 ? count : "+"}
    </button>
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
  const { toast }   = useToast();
  const queryClient = useQueryClient();
  const fd          = initialData?.formData ?? null;

  // ── Registry queries ──
  const { data: workers = [] } = useQuery<Worker[]>({ queryKey: ["/api/workers"] });
  const activeWorkers = workers.filter((w) => w.isActive);

  const { data: inventoryItems = [] } = useQuery<any[]>({ queryKey: ["/api/items"] });

  // ── Existing reports (for Report No. auto-generation) ──
  const { data: existingReports = [] } = useQuery<any[]>({
    queryKey: ["/api/daily-reports", projectId],
    queryFn: () => fetch(`/api/daily-reports?projectId=${projectId}`, { credentials: "include" }).then((r) => r.json()),
    enabled: !reportId,
  });

  // ── General Info ──
  // Report No. auto-generates when creating a new report; editable for existing ones
  const [reportNumber, setReportNumber] = useState<string>(fd?.reportNumber ?? "");
  const [preparedBy,   setPreparedBy]   = useState<string>(fd?.preparedBy    ?? "");
  const [reportDate,   setReportDate]   = useState<string>(fd?.reportDate    ?? new Date().toISOString().slice(0, 10));
  const [shift,        setShift]        = useState<string>(fd?.shift         ?? "day");
  const [weather,      setWeather]      = useState<string>(fd?.weather       ?? "clear");
  const [temperature,  setTemperature]  = useState<string>(fd?.temperature   ?? "72");

  // Auto-set report number for new reports once existing reports are loaded
  const autoNumberApplied = useRef(false);
  useEffect(() => {
    if (reportId || fd?.reportNumber || autoNumberApplied.current) return;
    autoNumberApplied.current = true;
    const next = String(existingReports.length + 1).padStart(3, "0");
    setReportNumber(next);
  }, [existingReports.length, reportId, fd?.reportNumber]);

  // ── Dynamic rows ──
  const [tasks, setTasks] = useState<TaskRow[]>(() => {
    const saved = fd?.tasks ?? [];
    return saved.map((t: any) => ({ drawingCount: 0, photoCount: 0, ...t }));
  });

  const rawMp = fd?.manpower ?? [];
  const [manpower, setManpower] = useState<ManpowerRow[]>(
    isWorkerBasedManpower(rawMp) ? rawMp : []
  );

  const [materials,  setMaterials]  = useState<MaterialRow[]>(
    (fd?.materials ?? []).map((m: any) => ({ inventoryItemId: null, ...m }))
  );
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

  // ── Computed ──
  const progressRows  = MOCK_PROGRESS_ITEMS.map((item) => calcProgressRow(item, todayQty[item.id] ?? 0));
  const overallPct    = overallProgress(progressRows);
  const totalWorkers  = manpower.length;
  const totalManhours = manpower.reduce((s, r) => s + r.hoursWorked, 0);

  // ── Summaries ──
  const taskSummary  = tasks.length     ? `${tasks.length} task${tasks.length !== 1 ? "s" : ""}` : undefined;
  const mpSummary    = manpower.length  ? `${totalWorkers} worker${totalWorkers !== 1 ? "s" : ""} · ${totalManhours.toFixed(1)} hrs` : undefined;
  const matSummary   = materials.length ? `${materials.length} item${materials.length !== 1 ? "s" : ""}` : undefined;
  const eqSummary    = equipment.length ? `${equipment.length} item${equipment.length !== 1 ? "s" : ""}` : undefined;
  const notesSummary = generalNotes.trim() ? generalNotes.trim().slice(0, 44) + (generalNotes.length > 44 ? "…" : "") : "3 fields";

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

  // ── Action bar ──
  function ActionBar({ bottom }: { bottom?: boolean }) {
    return (
      <div className={`flex items-center justify-between gap-3 flex-wrap ${bottom ? "" : ""}`}>
        <div className="flex items-center gap-2 flex-wrap">
          <Button data-testid={bottom ? "btn-save-draft-bottom" : "btn-save-draft"}
            variant="outline" size="sm"
            className="gap-2 h-9 text-slate-600 border-slate-300 hover:bg-slate-50"
            disabled={saveMutation.isPending || isSubmitted}
            onClick={() => saveMutation.mutate("draft")}>
            {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Draft
          </Button>

          <Button data-testid={bottom ? "btn-submit-report-bottom" : "btn-submit-report"}
            size="sm"
            className={`gap-2 h-9 font-semibold ${isSubmitted ? "bg-emerald-600 hover:bg-emerald-600 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"}`}
            disabled={saveMutation.isPending || isSubmitted}
            onClick={() => saveMutation.mutate("submitted")}>
            {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isSubmitted ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
            {isSubmitted ? "Submitted" : "Submit Report"}
          </Button>

          <div className="w-px h-5 bg-slate-200 hidden sm:block" />

          <Button data-testid={bottom ? "btn-export-excel-bottom" : "btn-export-excel"}
            variant="ghost" size="sm"
            className="gap-2 h-9 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50"
            onClick={() => {}} disabled>
            <Download className="w-3.5 h-3.5" /> Export Excel
          </Button>
        </div>

        {!bottom && (
          <div className="flex items-center gap-2">
            <div className="w-px h-5 bg-slate-200" />
            <Badge variant="outline" className={
              isSubmitted
                ? "text-[11px] bg-emerald-50 text-emerald-700 border-emerald-200 py-0.5 px-2.5"
                : savedStatus === "draft"
                ? "text-[11px] bg-amber-50 text-amber-700 border-amber-200 py-0.5 px-2.5"
                : "text-[11px] text-slate-400 border-slate-200 bg-white py-0.5 px-2.5"
            }>
              {isSubmitted ? "✓ Submitted" : savedStatus === "draft" ? "Draft saved" : "Unsaved"}
            </Badge>
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">

      {/* ── Top action bar ── */}
      <div className="bg-white rounded-xl border border-slate-200 px-5 py-3">
        <ActionBar />
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          §1 — General Info
          Field order: Report No. | Prepared By | Report Date
                       Shift      | Weather     | Temperature
      ══════════════════════════════════════════════════════════════════ */}
      <Section num={1} title="General Info" icon={<Calendar className="w-4 h-4" />}>
        <div className="grid grid-cols-3 gap-x-5 gap-y-4">

          {/* Row 1 */}
          <div>
            <FL>Report No.</FL>
            <div className="flex items-center h-9 px-3 rounded-md border border-slate-200 bg-slate-50 text-sm font-mono font-semibold text-slate-700 tracking-widest select-none">
              {reportNumber || <span className="text-slate-300 font-sans font-normal text-xs">auto…</span>}
            </div>
          </div>

          <div>
            <FL>Prepared By</FL>
            <Input data-testid="input-prepared-by" value={preparedBy}
              onChange={(e) => setPreparedBy(e.target.value)}
              className="h-9 text-sm" placeholder="Your name" />
          </div>

          <div>
            <FL>Report Date</FL>
            <Input data-testid="input-report-date" type="date" value={reportDate}
              onChange={(e) => setReportDate(e.target.value)} className="h-9 text-sm" />
          </div>

          {/* Row 2 */}
          <div>
            <FL>Shift</FL>
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
            <FL>Weather</FL>
            <Select value={weather} onValueChange={setWeather}>
              <SelectTrigger data-testid="select-weather" className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="clear">☀️  Clear</SelectItem>
                <SelectItem value="partly-cloudy">⛅  Partly Cloudy</SelectItem>
                <SelectItem value="overcast">☁️  Overcast</SelectItem>
                <SelectItem value="rain">🌧️  Rain</SelectItem>
                <SelectItem value="wind">💨  Windy</SelectItem>
                <SelectItem value="heat">🌡️  Extreme Heat</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <FL>Temperature (°F)</FL>
            <Input data-testid="input-temperature" type="number" value={temperature}
              onChange={(e) => setTemperature(e.target.value)} className="h-9 text-sm" placeholder="°F" />
          </div>

        </div>
      </Section>

      {/* ══════════════════════════════════════════════════════════════════
          §2 — Manpower  (moved directly after General Info)
      ══════════════════════════════════════════════════════════════════ */}
      <Section num={2} title="Manpower" icon={<Users className="w-4 h-4" />} summary={mpSummary}>
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm" data-testid="table-manpower">
            <TH cols={[
              { label: "Worker Name",  cls: "min-w-[200px] w-[25%]" },
              { label: "Trade",        cls: "min-w-[110px] w-[14%]" },
              { label: "Attendance",   cls: "min-w-[110px] w-[13%]" },
              { label: "Start",        cls: "w-[86px]"              },
              { label: "End",          cls: "w-[86px]"              },
              { label: "Hrs",          cls: "w-[58px] text-center"  },
              { label: "Notes",        cls: "min-w-[110px]"         },
            ]} />
            <tbody>
              {manpower.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-xs text-slate-300 italic">
                    No workers added — type a name or search registered workers below
                  </td>
                </tr>
              )}
              {manpower.map((row, i) => {
                const takenIds = new Set(manpower.filter((r) => r.id !== row.id).map((r) => r.workerId));
                const hoursActive = HOURS_COMPUTED.has(row.attendanceStatus);

                return (
                  <tr key={row.id} className="border-b border-slate-100 last:border-0 group hover:bg-slate-50/50">

                    {/* Worker Name — combobox: free-text + registered-worker search */}
                    <td className="py-1.5 px-2.5">
                      <WorkerCombobox
                        row={row}
                        allWorkers={activeWorkers}
                        takenIds={takenIds}
                        testId={`input-mp-worker-${i}`}
                        onChange={(patch) =>
                          setManpower(manpower.map((r) => r.id === row.id ? { ...r, ...patch } : r))
                        }
                      />
                    </td>

                    {/* Trade */}
                    <td className="py-1.5 px-2.5">
                      <Input
                        data-testid={`input-mp-trade-${i}`}
                        value={row.trade}
                        onChange={(e) => setManpower(manpower.map((r) => r.id === row.id ? { ...r, trade: e.target.value } : r))}
                        className="h-8 text-xs border-transparent bg-transparent hover:border-slate-300 hover:bg-white focus:border-blue-300 focus:bg-white transition-colors"
                        placeholder="e.g. Electrician"
                      />
                    </td>

                    {/* Attendance */}
                    <td className="py-1.5 px-2.5">
                      <Select value={row.attendanceStatus}
                        onValueChange={(v) => {
                          const hrs = calcHours(row.startTime, row.endTime, v);
                          setManpower(manpower.map((r) => r.id === row.id ? { ...r, attendanceStatus: v, hoursWorked: hrs } : r));
                        }}>
                        <SelectTrigger data-testid={`select-mp-status-${i}`} className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ATTENDANCE_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>

                    {/* Start */}
                    <td className="py-1.5 px-2.5">
                      <Input data-testid={`input-mp-start-${i}`} type="time" value={row.startTime}
                        onChange={(e) => {
                          const hrs = calcHours(e.target.value, row.endTime, row.attendanceStatus);
                          setManpower(manpower.map((r) => r.id === row.id ? { ...r, startTime: e.target.value, hoursWorked: hrs } : r));
                        }}
                        className={`h-8 text-xs ${!hoursActive ? "opacity-40 pointer-events-none" : ""}`}
                        disabled={!hoursActive} />
                    </td>

                    {/* End */}
                    <td className="py-1.5 px-2.5">
                      <Input data-testid={`input-mp-end-${i}`} type="time" value={row.endTime}
                        onChange={(e) => {
                          const hrs = calcHours(row.startTime, e.target.value, row.attendanceStatus);
                          setManpower(manpower.map((r) => r.id === row.id ? { ...r, endTime: e.target.value, hoursWorked: hrs } : r));
                        }}
                        className={`h-8 text-xs ${!hoursActive ? "opacity-40 pointer-events-none" : ""}`}
                        disabled={!hoursActive} />
                    </td>

                    {/* Hrs — read-only */}
                    <td className="py-1.5 px-2.5">
                      <ROCell center>
                        {hoursActive ? row.hoursWorked.toFixed(1) : <span className="text-slate-300">—</span>}
                      </ROCell>
                    </td>

                    {/* Notes */}
                    <td className="py-1.5 px-2.5">
                      <Input data-testid={`input-mp-notes-${i}`} value={row.notes}
                        onChange={(e) => setManpower(manpower.map((r) => r.id === row.id ? { ...r, notes: e.target.value } : r))}
                        className="h-8 text-xs border-transparent bg-transparent hover:border-slate-300 hover:bg-white focus:border-blue-300 focus:bg-white transition-colors"
                        placeholder="Optional" />
                    </td>

                    <td className="py-1.5 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <DelBtn testId={`btn-remove-mp-${i}`} onClick={() => setManpower(manpower.filter((r) => r.id !== row.id))} />
                    </td>
                  </tr>
                );
              })}

              {/* Totals row */}
              {manpower.length > 0 && (
                <tr className="border-t border-slate-200 bg-slate-50">
                  <td colSpan={5} className="py-2.5 px-2.5">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Summary</span>
                    <span className="ml-3 text-xs text-slate-600">
                      <span className="font-semibold text-slate-800">{totalWorkers}</span> worker{totalWorkers !== 1 ? "s" : ""}
                    </span>
                  </td>
                  <td className="py-2.5 px-2.5">
                    <div className="h-7 flex items-center justify-center px-1 rounded-md bg-blue-50 border border-blue-200 text-xs font-bold text-blue-700 tabular-nums">
                      {totalManhours.toFixed(1)}
                    </div>
                  </td>
                  <td colSpan={2} className="py-2.5 px-2.5">
                    <span className="text-[10px] text-slate-400">man-hrs</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <AddRow testId="btn-add-manpower" label="Add Worker"
          onClick={() => setManpower([...manpower, {
            id: uid(), workerId: null, workerName: "", trade: "",
            attendanceStatus: "ATTEND",
            startTime: "07:00", endTime: "15:30",
            hoursWorked: calcHours("07:00", "15:30", "ATTEND"),
            notes: "",
          }])} />

        {activeWorkers.length === 0 && (
          <div className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-100">
            <Info className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">No registered workers found in the system. You can still enter names manually above.</p>
          </div>
        )}
      </Section>

      {/* ══════════════════════════════════════════════════════════════════
          §3 — Work Tasks  (with per-row drawing + photo attachment)
      ══════════════════════════════════════════════════════════════════ */}
      <Section num={3} title="Work Tasks" icon={<FileText className="w-4 h-4" />} summary={taskSummary}>
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm" data-testid="table-tasks">
            <TH cols={[
              { label: "Task Description", cls: "min-w-[200px] w-[35%]" },
              { label: "Area / Location",  cls: "min-w-[130px] w-[18%]" },
              { label: "Status",           cls: "min-w-[135px] w-[15%]" },
              { label: "Notes",            cls: "min-w-[120px]"         },
              { label: "Attach",           cls: "w-[88px] text-center"  },
            ]} />
            <tbody>
              {tasks.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-slate-300 italic">
                    No tasks yet — add your first task below
                  </td>
                </tr>
              )}
              {tasks.map((row, i) => {
                const cfg = TASK_STATUS_CFG[row.status] ?? TASK_STATUS_CFG["not-started"];
                return (
                  <tr key={row.id} className={`border-b border-slate-100 last:border-0 group ${cfg.rowBg}`}>

                    <td className="py-1.5 px-2.5">
                      <Input data-testid={`input-task-desc-${i}`} value={row.description}
                        onChange={(e) => setTasks(tasks.map((r) => r.id === row.id ? { ...r, description: e.target.value } : r))}
                        className="h-8 text-xs border-transparent bg-transparent hover:border-slate-300 hover:bg-white focus:border-blue-300 focus:bg-white transition-colors"
                        placeholder="Describe the task…" />
                    </td>

                    <td className="py-1.5 px-2.5">
                      <Input data-testid={`input-task-area-${i}`} value={row.area}
                        onChange={(e) => setTasks(tasks.map((r) => r.id === row.id ? { ...r, area: e.target.value } : r))}
                        className="h-8 text-xs border-transparent bg-transparent hover:border-slate-300 hover:bg-white focus:border-blue-300 focus:bg-white transition-colors"
                        placeholder="Area / Zone" />
                    </td>

                    <td className="py-1.5 px-2.5">
                      <div className="relative">
                        <span className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full z-10 pointer-events-none ${cfg.dot}`} />
                        <Select value={row.status}
                          onValueChange={(v) => setTasks(tasks.map((r) => r.id === row.id ? { ...r, status: v } : r))}>
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

                    <td className="py-1.5 px-2.5">
                      <Input data-testid={`input-task-notes-${i}`} value={row.notes}
                        onChange={(e) => setTasks(tasks.map((r) => r.id === row.id ? { ...r, notes: e.target.value } : r))}
                        className="h-8 text-xs border-transparent bg-transparent hover:border-slate-300 hover:bg-white focus:border-blue-300 focus:bg-white transition-colors"
                        placeholder="Optional" />
                    </td>

                    {/* Per-row attachment pills */}
                    <td className="py-1.5 px-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <AttachPill
                          testId={`btn-task-drawing-${i}`}
                          icon={<Paperclip className="w-3 h-3" />}
                          count={row.drawingCount}
                          label="Attach Drawing"
                          onClick={() => toast({ title: "Drawing upload", description: "File attachment coming in next update." })}
                        />
                        <AttachPill
                          testId={`btn-task-photo-${i}`}
                          icon={<Camera className="w-3 h-3" />}
                          count={row.photoCount}
                          label="Attach Photo"
                          onClick={() => toast({ title: "Photo upload", description: "Photo attachment coming in next update." })}
                        />
                      </div>
                    </td>

                    <td className="py-1.5 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <DelBtn testId={`btn-remove-task-${i}`} onClick={() => setTasks(tasks.filter((r) => r.id !== row.id))} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <AddRow testId="btn-add-task" label="Add Task"
          onClick={() => setTasks([...tasks, { id: uid(), description: "", area: "", status: "in-progress", notes: "", drawingCount: 0, photoCount: 0 }])} />
      </Section>

      {/* ══════════════════════════════════════════════════════════════════
          §4 — Materials  (inventory-linked search + auto-fill unit)
      ══════════════════════════════════════════════════════════════════ */}
      <Section num={4} title="Materials" icon={<Package className="w-4 h-4" />} summary={matSummary} defaultOpen={false}>
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm" data-testid="table-materials">
            <TH cols={[
              { label: "Material / Inventory Item", cls: "min-w-[220px] w-[50%]" },
              { label: "Unit",                      cls: "w-[80px]"              },
              { label: "Qty Used",                  cls: "w-[90px]"              },
              { label: "Notes",                     cls: "min-w-[130px]"         },
            ]} />
            <tbody>
              {materials.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-slate-300 italic">No materials logged yet</td>
                </tr>
              )}
              {materials.map((row, i) => (
                <tr key={row.id} className="border-b border-slate-100 last:border-0 group hover:bg-slate-50/50">

                  {/* Material description — inventory-linked combobox */}
                  <td className="py-1.5 px-2.5">
                    <MaterialSearch
                      row={row}
                      inventoryItems={inventoryItems}
                      testId={`input-mat-desc-${i}`}
                      onChange={(patch) => setMaterials(materials.map((r) => r.id === row.id ? { ...r, ...patch } : r))}
                    />
                  </td>

                  {/* Unit — auto-filled from inventory, read-only when linked */}
                  <td className="py-1.5 px-2.5">
                    {row.inventoryItemId ? (
                      <ROCell>
                        <span className="font-mono">{row.unit || "—"}</span>
                      </ROCell>
                    ) : (
                      <Input data-testid={`input-mat-unit-${i}`} value={row.unit}
                        onChange={(e) => setMaterials(materials.map((r) => r.id === row.id ? { ...r, unit: e.target.value } : r))}
                        className="h-8 text-xs text-center font-mono" placeholder="EA" />
                    )}
                  </td>

                  {/* Qty */}
                  <td className="py-1.5 px-2.5">
                    <Input data-testid={`input-mat-qty-${i}`} type="number" min={0} value={row.qty}
                      onChange={(e) => setMaterials(materials.map((r) => r.id === row.id ? { ...r, qty: Number(e.target.value) } : r))}
                      className="h-8 text-xs text-center tabular-nums" />
                  </td>

                  {/* Notes */}
                  <td className="py-1.5 px-2.5">
                    <Input data-testid={`input-mat-notes-${i}`} value={row.notes}
                      onChange={(e) => setMaterials(materials.map((r) => r.id === row.id ? { ...r, notes: e.target.value } : r))}
                      className="h-8 text-xs border-transparent bg-transparent hover:border-slate-300 hover:bg-white focus:border-blue-300 focus:bg-white transition-colors"
                      placeholder="Optional" />
                  </td>

                  <td className="py-1.5 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <DelBtn testId={`btn-remove-mat-${i}`} onClick={() => setMaterials(materials.filter((r) => r.id !== row.id))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <AddRow testId="btn-add-material" label="Add Material"
          onClick={() => setMaterials([...materials, { id: uid(), description: "", unit: "EA", qty: 1, notes: "", inventoryItemId: null }])} />

        {inventoryItems.length > 0 && (
          <p className="mt-2 text-[10px] text-slate-400">
            {inventoryItems.length} inventory items available — type in the description field to search
          </p>
        )}
      </Section>

      {/* ══════════════════════════════════════════════════════════════════
          §5 — Equipment
      ══════════════════════════════════════════════════════════════════ */}
      <Section num={5} title="Equipment" icon={<Truck className="w-4 h-4" />} summary={eqSummary} defaultOpen={false}>
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm" data-testid="table-equipment">
            <TH cols={[
              { label: "Equipment Name", cls: "min-w-[200px] w-[40%]" },
              { label: "Unit",           cls: "w-[70px]"              },
              { label: "Qty",            cls: "w-[70px]"              },
              { label: "Hours Used",     cls: "w-[90px]"              },
              { label: "Notes",          cls: "min-w-[130px]"         },
            ]} />
            <tbody>
              {equipment.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-slate-300 italic">No equipment logged yet</td>
                </tr>
              )}
              {equipment.map((row, i) => (
                <tr key={row.id} className="border-b border-slate-100 last:border-0 group hover:bg-slate-50/50">
                  <td className="py-1.5 px-2.5">
                    <Input data-testid={`input-eq-name-${i}`} value={row.name}
                      onChange={(e) => setEquipment(equipment.map((r) => r.id === row.id ? { ...r, name: e.target.value } : r))}
                      className="h-8 text-xs border-transparent bg-transparent hover:border-slate-300 hover:bg-white focus:border-blue-300 focus:bg-white transition-colors"
                      placeholder="Equipment name…" />
                  </td>
                  <td className="py-1.5 px-2.5">
                    <Input data-testid={`input-eq-unit-${i}`} value={row.unit}
                      onChange={(e) => setEquipment(equipment.map((r) => r.id === row.id ? { ...r, unit: e.target.value } : r))}
                      className="h-8 text-xs text-center" placeholder="EA" />
                  </td>
                  <td className="py-1.5 px-2.5">
                    <Input data-testid={`input-eq-qty-${i}`} type="number" min={0} value={row.qty}
                      onChange={(e) => setEquipment(equipment.map((r) => r.id === row.id ? { ...r, qty: Number(e.target.value) } : r))}
                      className="h-8 text-xs text-center tabular-nums" />
                  </td>
                  <td className="py-1.5 px-2.5">
                    <Input data-testid={`input-eq-hours-${i}`} type="number" min={0} step={0.5} value={row.hours}
                      onChange={(e) => setEquipment(equipment.map((r) => r.id === row.id ? { ...r, hours: Number(e.target.value) } : r))}
                      className="h-8 text-xs text-center tabular-nums" />
                  </td>
                  <td className="py-1.5 px-2.5">
                    <Input data-testid={`input-eq-notes-${i}`} value={row.notes}
                      onChange={(e) => setEquipment(equipment.map((r) => r.id === row.id ? { ...r, notes: e.target.value } : r))}
                      className="h-8 text-xs border-transparent bg-transparent hover:border-slate-300 hover:bg-white focus:border-blue-300 focus:bg-white transition-colors"
                      placeholder="Optional" />
                  </td>
                  <td className="py-1.5 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <DelBtn testId={`btn-remove-eq-${i}`} onClick={() => setEquipment(equipment.filter((r) => r.id !== row.id))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <AddRow testId="btn-add-equipment" label="Add Equipment"
          onClick={() => setEquipment([...equipment, { id: uid(), name: "", unit: "EA", qty: 1, hours: 0, notes: "" }])} />
      </Section>

      {/* ══════════════════════════════════════════════════════════════════
          §6 — Photo Log
      ══════════════════════════════════════════════════════════════════ */}
      <Section num={6} title="Photo Log" icon={<Image className="w-4 h-4" />} summary="0 photos" defaultOpen={false}>
        <div
          data-testid="photo-upload-zone"
          className="flex flex-col items-center justify-center gap-3 py-10 border-2 border-dashed border-slate-200 rounded-xl bg-gradient-to-b from-slate-50 to-white"
        >
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-white border border-slate-200 shadow-sm">
            <Upload className="w-5 h-5 text-slate-400" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-medium text-slate-600">Click to upload site photos</p>
            <p className="text-xs text-slate-400">JPG, PNG, HEIC · max 10 MB per photo · multiple files allowed</p>
          </div>
          <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-200 bg-white mt-1">
            Upload available in next update
          </Badge>
        </div>
      </Section>

      {/* ══════════════════════════════════════════════════════════════════
          §7 — Progress
      ══════════════════════════════════════════════════════════════════ */}
      <Section num={7} title="Progress" icon={<BarChart2 className="w-4 h-4" />} summary={`${overallPct}% complete`}>

        {/* A. Completion + Schedule */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">
              Overall Completion
              <span className="ml-1.5 font-normal normal-case text-slate-300">auto-calculated</span>
            </p>
            <div className="flex items-baseline gap-1.5 mb-3">
              <span className="text-5xl font-black text-slate-800 leading-none tabular-nums">{overallPct}</span>
              <span className="text-2xl font-bold text-slate-400 leading-none">%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${overallPct >= 100 ? "bg-emerald-500" : overallPct >= 70 ? "bg-blue-500" : "bg-blue-400"}`}
                style={{ width: `${overallPct}%` }} />
            </div>
            <p className="text-[11px] text-slate-400 mt-2">Weighted by estimated quantities from project scope</p>
          </div>

          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3">Schedule Status</p>
            <div className="flex gap-2">
              <button type="button" data-testid="btn-on-schedule-yes" onClick={() => setOnSchedule(true)}
                className={`flex items-center gap-2.5 px-4 py-3.5 rounded-xl border text-sm font-semibold transition-all flex-1 justify-center ${onSchedule ? "bg-emerald-50 border-emerald-300 text-emerald-700 shadow-sm" : "bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600"}`}>
                <CheckCircle2 className="w-4 h-4" /> On Track
              </button>
              <button type="button" data-testid="btn-on-schedule-no" onClick={() => setOnSchedule(false)}
                className={`flex items-center gap-2.5 px-4 py-3.5 rounded-xl border text-sm font-semibold transition-all flex-1 justify-center ${!onSchedule ? "bg-rose-50 border-rose-300 text-rose-700 shadow-sm" : "bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600"}`}>
                <AlertTriangle className="w-4 h-4" /> Delayed
              </button>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg bg-blue-50 border border-blue-100 mb-4">
          <Info className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-700 leading-relaxed">
            <strong>Est. Qty</strong> is fixed at the project scope level.&nbsp;
            <strong>Prev. Cumul.</strong> = running total from submitted reports.&nbsp;
            Enter <strong className="text-blue-800">Today</strong> — totals and progress auto-calculate.
          </p>
        </div>

        {/* B. Progress table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 mb-5">
          <table className="w-full text-sm" data-testid="table-progress">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {[
                  { l: "Work Item",    c: "text-left min-w-[160px] px-3" },
                  { l: "Unit",         c: "text-center w-12 px-2" },
                  { l: "Est. Qty",     c: "text-right w-20 px-3" },
                  { l: "Prev. Cum.",   c: "text-right w-20 px-3" },
                  { l: "Today ✏",     c: "text-center w-24 px-2 text-blue-600" },
                  { l: "New Total",    c: "text-right w-20 px-3" },
                  { l: "Remaining",    c: "text-right w-20 px-3" },
                  { l: "Progress",     c: "text-center w-28 px-3" },
                ].map(({ l, c }) => (
                  <th key={l} className={`py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-widest whitespace-nowrap ${c}`}>
                    {l}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {progressRows.map((row, i) => {
                const isOver = row.actualTotal > row.estimatedQty;
                return (
                  <tr key={row.id} data-testid={`row-progress-${row.id}`}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5 px-3 text-sm text-slate-700 font-medium">{row.description}</td>
                    <td className="py-2.5 px-2 text-center text-xs text-slate-400 font-mono">{row.unit}</td>
                    <td className="py-2.5 px-3 text-right text-sm text-slate-400 font-mono tabular-nums">{row.estimatedQty.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right text-sm text-slate-400 font-mono tabular-nums">{row.cumulativeQty.toLocaleString()}</td>
                    <td className="py-2 px-2 text-center">
                      <Input data-testid={`input-progress-today-${i}`} type="number" min={0}
                        value={todayQty[row.id] ?? ""} placeholder="0"
                        onChange={(e) => setTodayQty((prev) => ({ ...prev, [row.id]: Math.max(0, Number(e.target.value)) }))}
                        className="h-8 text-xs text-center font-semibold border-blue-200 bg-blue-50 focus:border-blue-400 focus:bg-white tabular-nums w-20 mx-auto" />
                    </td>
                    <td className={`py-2.5 px-3 text-right text-sm font-mono font-semibold tabular-nums ${isOver ? "text-amber-600" : "text-slate-700"}`}>
                      {row.actualTotal.toLocaleString()}
                    </td>
                    <td className={`py-2.5 px-3 text-right text-sm font-mono tabular-nums ${row.remaining === 0 ? "text-emerald-600 font-semibold" : "text-slate-500"}`}>
                      {row.remaining.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-300 ${row.pct >= 100 ? "bg-emerald-500" : row.pct >= 75 ? "bg-blue-500" : "bg-blue-400"}`}
                            style={{ width: `${row.pct}%` }} />
                        </div>
                        <span className={`text-xs font-bold w-9 text-right shrink-0 tabular-nums ${row.pct >= 100 ? "text-emerald-600" : "text-slate-600"}`}>
                          {row.pct}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-800">
                <td colSpan={2} className="py-2.5 px-3 text-xs font-bold text-slate-200 uppercase tracking-wide">Total</td>
                <td className="py-2.5 px-3 text-right text-xs font-bold text-slate-100 font-mono tabular-nums">{progressRows.reduce((s, r) => s + r.estimatedQty, 0).toLocaleString()}</td>
                <td className="py-2.5 px-3 text-right text-xs font-bold text-slate-100 font-mono tabular-nums">{progressRows.reduce((s, r) => s + r.cumulativeQty, 0).toLocaleString()}</td>
                <td className="py-2.5 px-2 text-center text-xs font-black text-blue-200 font-mono tabular-nums">{progressRows.reduce((s, r) => s + r.todayQty, 0).toLocaleString()}</td>
                <td className="py-2.5 px-3 text-right text-xs font-bold text-slate-100 font-mono tabular-nums">{progressRows.reduce((s, r) => s + r.actualTotal, 0).toLocaleString()}</td>
                <td className="py-2.5 px-3 text-right text-xs font-bold text-slate-100 font-mono tabular-nums">{progressRows.reduce((s, r) => s + r.remaining, 0).toLocaleString()}</td>
                <td className="py-2.5 px-3 text-center text-xs font-black text-white">{overallPct}%</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* C. Issues + Next Day Plan */}
        <div className="space-y-4">
          <div>
            <FL>Issues / Delays</FL>
            <Textarea data-testid="input-issues" value={issues} onChange={(e) => setIssues(e.target.value)}
              placeholder="Issues, delays, or blockers — include root cause and corrective action…"
              className="text-sm min-h-[90px] resize-y" />
          </div>
          <div>
            <FL>Next Day Work Plan</FL>
            <Textarea data-testid="input-next-day-plan" value={nextDayPlan} onChange={(e) => setNextDayPlan(e.target.value)}
              placeholder="Tomorrow's work items, crew assignments, equipment or special requirements…"
              className="text-sm min-h-[90px] resize-y" />
          </div>
        </div>

      </Section>

      {/* ══════════════════════════════════════════════════════════════════
          §8 — Notes / Remarks
      ══════════════════════════════════════════════════════════════════ */}
      <Section num={8} title="Notes / Remarks" icon={<FileText className="w-4 h-4" />} summary={notesSummary}>
        <div className="space-y-5">
          <div>
            <FL>General Notes</FL>
            <Textarea data-testid="input-general-notes" value={generalNotes} onChange={(e) => setGeneralNotes(e.target.value)}
              placeholder="General site observations, conditions, or notes for the record…"
              className="text-sm min-h-[90px] resize-y" />
          </div>
          <div>
            <FL>Safety Observations</FL>
            <Textarea data-testid="input-safety-notes" value={safetyNotes} onChange={(e) => setSafetyNotes(e.target.value)}
              placeholder="Safety incidents, near misses, toolbox topics, PPE compliance, hazard observations…"
              className="text-sm min-h-[80px] resize-y" />
          </div>
          <div>
            <FL>Inspector / Visitor on Site</FL>
            <Input data-testid="input-inspector-visitor" value={inspectorVisitor}
              onChange={(e) => setInspectorVisitor(e.target.value)}
              placeholder="Name and affiliation of any inspector or visitor present today"
              className="h-9 text-sm" />
          </div>
        </div>
      </Section>

      {/* ── Bottom action bar ── */}
      <div className="bg-white rounded-xl border border-slate-200 px-5 py-3">
        <div className="flex items-center justify-end gap-2 flex-wrap">
          <Button data-testid="btn-save-draft-bottom" variant="outline" size="sm"
            className="gap-2 h-9 text-slate-600 border-slate-300 hover:bg-slate-50"
            disabled={saveMutation.isPending || isSubmitted}
            onClick={() => saveMutation.mutate("draft")}>
            {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Draft
          </Button>
          <Button data-testid="btn-submit-report-bottom" size="sm"
            className={`gap-2 h-9 font-semibold ${isSubmitted ? "bg-emerald-600 hover:bg-emerald-600 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"}`}
            disabled={saveMutation.isPending || isSubmitted}
            onClick={() => saveMutation.mutate("submitted")}>
            {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isSubmitted ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
            {isSubmitted ? "Submitted" : "Submit Report"}
          </Button>
          <div className="w-px h-5 bg-slate-200 hidden sm:block" />
          <Button data-testid="btn-export-excel-bottom" variant="ghost" size="sm"
            className="gap-2 h-9 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50"
            onClick={() => {}} disabled>
            <Download className="w-3.5 h-3.5" /> Export Excel
          </Button>
        </div>
      </div>

    </div>
  );
}
