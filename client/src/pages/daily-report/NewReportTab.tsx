import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar, Users, Package, Truck, FileText, ChevronDown, ChevronRight,
  Plus, Trash2, Save, Send, AlertTriangle, CheckCircle2,
  Info, Loader2, HardHat, Paperclip, Camera, Wrench, Clock,
} from "lucide-react";
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
  "delayed":      { label: "Delayed",     dot: "bg-amber-500",   text: "text-amber-700",   rowBg: "bg-amber-50/30" },
  "blocked":      { label: "Blocked",     dot: "bg-red-500",     text: "text-red-700",     rowBg: "bg-red-50/30" },
};

const ATTENDANCE_STATUSES = [
  "ATTEND", "PTO", "SICK", "ABSENT", "OFF",
  "LATE", "EARLY_LEAVE", "WFH", "TRAINING", "SUSPENDED", "TERMINATED",
];

const HOURS_COMPUTED = new Set(["ATTEND", "LATE", "EARLY_LEAVE", "WFH", "TRAINING"]);

const EQUIPMENT_PRESETS = [
  "Scissor Lift", "Boom Lift", "One Man Lift", "Reach Forklift",
  "Forklift", "Trench", "Excavator Small", "Excavator Big",
];

// Foreman-or-above filter — matches common supervisory trade names
const FOREMAN_PLUS_KW = ["foreman", "superintendent", "supervisor", "lead", "manager", "pm", "super", "gc", "master"];
function isForemanPlus(trade: string | null | undefined): boolean {
  if (!trade) return false;
  const t = trade.toLowerCase();
  return FOREMAN_PLUS_KW.some(kw => t.includes(kw));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
let _uid = 1000;
function uid() { return ++_uid; }

function calcHours(start: string, end: string, status: string, lunchBreak: boolean): number {
  if (!HOURS_COMPUTED.has(status) || !start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = (eh * 60 + em) - (sh * 60 + sm);
  const gross = Math.max(0, Math.round(mins / 60 * 10) / 10);
  return lunchBreak ? Math.max(0, Math.round((gross - 1) * 10) / 10) : gross;
}

// Flexible word-order match for material search
function flexMatch(name: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const n = name.toLowerCase();
  if (n.includes(q)) return true;
  const words = q.split(/\s+/).filter(Boolean);
  return words.length > 1 && words.every(w => n.includes(w));
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface TaskRow {
  id: number; description: string; area: string; status: string; notes: string;
  expanded: boolean; detailNotes: string; drawingFiles: string[]; photoFiles: string[];
}
interface ManpowerRow {
  id: number; workerId: number | null; workerName: string; trade: string;
  attendanceStatus: string; startTime: string; endTime: string;
  hoursWorked: number; lunchBreak: boolean; notes: string;
}
interface MaterialRow  { id: number; description: string; unit: string; qty: number; notes: string; inventoryItemId: number | null; scopeItemId: number | null }
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
  5: { bg: "bg-orange-50",  icon: "text-orange-500"  },
  6: { bg: "bg-slate-100",  icon: "text-slate-500"   },
};

// ─── Section wrapper ──────────────────────────────────────────────────────────
// overflow-hidden removed so combobox dropdowns are not clipped
function Section({
  num, title, icon, defaultOpen = true, summary, children,
}: {
  num: number; title: string; icon: React.ReactNode;
  defaultOpen?: boolean; summary?: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const ic = SECTION_ICON_STYLE[num] ?? { bg: "bg-slate-100", icon: "text-slate-500" };
  return (
    <Card className="shadow-none border border-slate-200">
      <button type="button" data-testid={`section-toggle-${num}`}
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50/70 transition-colors text-left">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-bold shrink-0">
            {num}
          </span>
          <span className={`flex items-center justify-center w-7 h-7 rounded-lg shrink-0 ${ic.bg}`}>
            <span className={ic.icon}>{icon}</span>
          </span>
          <span className="text-sm font-semibold text-slate-800 shrink-0">{title}</span>
          {!open && summary && (
            <span className="ml-1 text-[11px] text-slate-400 truncate">{summary}</span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ml-3 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <CardContent className="pt-0 pb-6 px-5 border-t border-slate-100">
          <div className="pt-4">{children}</div>
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
      <tr className="border-b border-slate-200 bg-slate-50">
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
      className="mt-3 gap-1.5 text-xs text-slate-500 border-dashed border-slate-300 hover:border-slate-400 hover:text-slate-700"
      onClick={onClick}>
      <Plus className="w-3.5 h-3.5" /> {label}
    </Button>
  );
}

// ─── Read-only cell display ───────────────────────────────────────────────────
function ROCell({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <div className={`h-8 flex items-center px-2.5 text-xs text-slate-500 bg-slate-50 rounded-md border border-slate-200 select-none ${center ? "justify-center font-semibold text-slate-700" : ""}`}>
      {children}
    </div>
  );
}

// ─── Transparent input (for table cells) ─────────────────────────────────────
const cellInputCls = "h-8 text-xs border-transparent bg-transparent hover:border-slate-300 hover:bg-white focus:border-blue-300 focus:bg-white transition-colors";

// ─── Worker Combobox ──────────────────────────────────────────────────────────
function WorkerCombobox({
  row, allWorkers, takenIds, testId, onChange,
}: {
  row: ManpowerRow; allWorkers: Worker[]; takenIds: Set<number | null>;
  testId: string; onChange: (patch: Partial<ManpowerRow>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(row.workerName);

  const filtered = allWorkers
    .filter((w) => !takenIds.has(w.id) || w.id === row.workerId)
    .filter((w) => !query || w.fullName.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8);

  useEffect(() => { setQuery(row.workerName); }, [row.workerName]);

  return (
    <div className="relative">
      <Input data-testid={testId} value={query} placeholder="Type name or search…"
        className="h-8 text-xs"
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          onChange({ workerName: e.target.value, workerId: null, trade: row.trade });
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && filtered.length > 0 && (
        <div className="absolute z-[100] top-full left-0 right-0 mt-1 bg-white rounded-lg border border-slate-200 shadow-xl max-h-48 overflow-y-auto">
          {filtered.map((w) => (
            <button key={w.id} type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { setQuery(w.fullName); setOpen(false); onChange({ workerId: w.id, workerName: w.fullName, trade: w.trade ?? "" }); }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center gap-2 transition-colors">
              <HardHat className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="font-medium text-slate-700 truncate">{w.fullName}</span>
              {w.trade && <span className="text-slate-400 ml-auto shrink-0 text-[10px]">{w.trade}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Prepared By Combobox (Foreman+ workers) ─────────────────────────────────
function PreparedByCombobox({
  value, allWorkers, onChange, disabled,
}: {
  value: string; allWorkers: Worker[];
  onChange: (name: string, id: number | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);

  const foremanPlus = allWorkers.filter(w => w.isActive && isForemanPlus(w.trade));
  const filtered = foremanPlus
    .filter(w => !query || w.fullName.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 10);

  useEffect(() => { setQuery(value); }, [value]);

  return (
    <div className="relative">
      <Input
        data-testid="input-prepared-by"
        value={query}
        placeholder={foremanPlus.length > 0 ? "Select or type Foreman name…" : "Enter name…"}
        disabled={disabled}
        className={`h-9 text-sm ${!value && !disabled ? "border-slate-300" : ""}`}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          onChange(e.target.value, null);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-[200] top-full left-0 right-0 mt-1 bg-white rounded-lg border border-slate-200 shadow-xl max-h-48 overflow-y-auto">
          {filtered.map(w => (
            <button key={w.id} type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => { setQuery(w.fullName); setOpen(false); onChange(w.fullName, w.id); }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center gap-2 transition-colors">
              <HardHat className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="font-medium text-slate-800 truncate">{w.fullName}</span>
              {w.trade && <span className="text-slate-400 ml-auto shrink-0 text-[10px]">{w.trade}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Material Combobox (inventory-linked, flexible word-order search) ─────────
function MaterialSearch({
  row, inventoryItems, testId, onChange,
}: {
  row: MaterialRow; inventoryItems: any[]; testId: string;
  onChange: (patch: Partial<MaterialRow>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(row.description);

  const filtered = inventoryItems
    .filter(item => flexMatch(item.name, query))
    .slice(0, 12);

  useEffect(() => { setQuery(row.description); }, [row.description]);

  return (
    <div className="relative">
      <Input data-testid={testId} value={query}
        placeholder="Search inventory or enter manually…"
        className={cellInputCls}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          onChange({ description: e.target.value, inventoryItemId: null });
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && filtered.length > 0 && (
        <div className="absolute z-[100] top-full left-0 right-0 mt-1 bg-white rounded-lg border border-slate-200 shadow-xl max-h-44 overflow-y-auto">
          {filtered.map((item) => (
            <button key={item.id} type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setQuery(item.name); setOpen(false);
                onChange({ description: item.name, unit: item.unitOfMeasure ?? row.unit, inventoryItemId: item.id });
              }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center justify-between gap-3 transition-colors">
              <span className="font-medium text-slate-700 truncate">{item.name}</span>
              <span className="text-[10px] text-slate-400 shrink-0 font-mono">{item.unitOfMeasure}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function NewReportTab({
  projectId, reportId, initialData, onSaved,
}: {
  projectId: number; reportId?: number | null; initialData?: any;
  onSaved?: (id: number, status: string) => void;
}) {
  const { toast }   = useToast();
  const queryClient = useQueryClient();
  const fd          = initialData?.formData ?? null;

  // ── Registry queries ──
  const { data: workers = [] }        = useQuery<Worker[]>({ queryKey: ["/api/workers"] });
  const { data: inventoryItems = [] } = useQuery<any[]>({ queryKey: ["/api/items"] });
  const { data: scopeItems = [] }     = useQuery<any[]>({
    queryKey: ["/api/projects", projectId, "scope-items"],
    queryFn: () => fetch(`/api/projects/${projectId}/scope-items`, { credentials: "include" }).then(r => r.json()),
    enabled: !!projectId,
  });
  const activeWorkers                 = workers.filter((w) => w.isActive);

  // ── Existing reports for auto report number ──
  const { data: existingReports = [] } = useQuery<any[]>({
    queryKey: ["/api/daily-reports", projectId],
    queryFn: () => fetch(`/api/daily-reports?projectId=${projectId}`, { credentials: "include" }).then((r) => r.json()),
    enabled: !reportId,
  });

  // ── General Info state ──
  const [reportNumber,  setReportNumber]  = useState<string>(fd?.reportNumber ?? "");
  const [preparedBy,    setPreparedBy]    = useState<string>(fd?.preparedBy   ?? "");
  const [preparedById,  setPreparedById]  = useState<number | null>(fd?.preparedById ?? null);
  const [reportDate,    setReportDate]    = useState<string>(fd?.reportDate   ?? new Date().toISOString().slice(0, 10));
  const [shift,         setShift]         = useState<string>(fd?.shift        ?? "day");
  const [weather,       setWeather]       = useState<string>(fd?.weather      ?? "clear");
  const [temperature,   setTemperature]   = useState<string>(fd?.temperature  ?? "72");

  // Auto-generate report number
  const autoNumApplied = useRef(false);
  useEffect(() => {
    if (reportId || fd?.reportNumber || autoNumApplied.current) return;
    autoNumApplied.current = true;
    setReportNumber(String(existingReports.length + 1).padStart(3, "0"));
  }, [existingReports.length, reportId, fd?.reportNumber]);

  // ── Manpower section-level defaults ──
  const [defStart,      setDefStart]      = useState("07:00");
  const [defEnd,        setDefEnd]        = useState("17:00");
  const [defLunchBreak, setDefLunchBreak] = useState(true);

  // ── Dynamic rows ──
  const [tasks, setTasks] = useState<TaskRow[]>(() =>
    (fd?.tasks ?? []).map((t: any) => ({ expanded: false, detailNotes: "", drawingFiles: [], photoFiles: [], ...t }))
  );

  const [manpower, setManpower] = useState<ManpowerRow[]>(() => {
    const rows = isWorkerBasedManpower(fd?.manpower ?? []) ? (fd?.manpower ?? []) : [];
    return rows.map((r: any) => ({ lunchBreak: true, ...r }));
  });
  const [materials,  setMaterials]  = useState<MaterialRow[]>(
    (fd?.materials ?? []).map((m: any) => ({ inventoryItemId: null, scopeItemId: null, ...m }))
  );
  const [equipment, setEquipment]  = useState<EquipmentRow[]>(fd?.equipment  ?? []);

  // ── Notes ──
  const [generalNotes,     setGeneralNotes]     = useState<string>(fd?.generalNotes     ?? "");
  const [safetyNotes,      setSafetyNotes]      = useState<string>(fd?.safetyNotes      ?? "");
  const [inspectorVisitor, setInspectorVisitor] = useState<string>(fd?.inspectorVisitor ?? "");

  // ── Save state ──
  const [savedStatus, setSavedStatus] = useState<string | null>(initialData?.status ?? null);
  const [lastSaved,   setLastSaved]   = useState<Date | null>(null);

  // ── Computed ──
  const totalWorkers  = manpower.length;
  const totalManhours = manpower.reduce((s, r) => s + r.hoursWorked, 0);

  // ── Submit validation ──
  const isSubmitted  = savedStatus === "submitted";
  const canSubmit    = !!reportDate && !!preparedBy.trim() && (manpower.length > 0 || tasks.length > 0);
  const submitHelper = !canSubmit && !isSubmitted
    ? (!preparedBy.trim()
        ? "Add Prepared By to submit"
        : manpower.length === 0 && tasks.length === 0
        ? "Add at least one worker or task to submit"
        : "")
    : "";

  // ── Summaries ──
  const mpSummary  = manpower.length  ? `${totalWorkers}w · ${totalManhours.toFixed(1)}h` : undefined;
  const matSummary = materials.length ? `${materials.length} item${materials.length !== 1 ? "s" : ""}` : undefined;
  const eqSummary  = equipment.length ? `${equipment.length} item${equipment.length !== 1 ? "s" : ""}` : undefined;
  const taskSummary = tasks.length    ? `${tasks.length} task${tasks.length !== 1 ? "s" : ""}` : undefined;

  // ── Form data builder ──
  function buildFormData() {
    return {
      reportDate, reportNumber, preparedBy, preparedById, shift, weather, temperature,
      tasks, manpower, materials, equipment,
      generalNotes, safetyNotes, inspectorVisitor,
    };
  }

  // ── Mutation ──
  const saveMutation = useMutation({
    mutationFn: async (status: "draft" | "submitted") => {
      const body = {
        projectId, reportDate,
        reportNumber: reportNumber || null,
        preparedBy:   preparedBy   || null,
        status, formData: buildFormData(),
      };
      if (reportId) return apiRequest("PATCH", `/api/daily-reports/${reportId}`, body);
      return apiRequest("POST", "/api/daily-reports", body);
    },
    onSuccess: async (res: any, status) => {
      const saved = await res.json();
      setSavedStatus(status);
      setLastSaved(new Date());
      queryClient.invalidateQueries({ queryKey: ["/api/daily-reports", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/daily-reports-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "progress"] });
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

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">

      {/* ── Top action bar ── */}
      <div className="bg-white rounded-xl border border-slate-200 px-5 py-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">

          {/* Left: actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button data-testid="btn-save-draft"
              variant="outline" size="sm"
              className="gap-2 h-9 text-slate-600 border-slate-300 hover:bg-slate-50"
              disabled={saveMutation.isPending || isSubmitted}
              onClick={() => saveMutation.mutate("draft")}>
              {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Draft
            </Button>

            <div className="relative group">
              <Button data-testid="btn-submit-report"
                size="sm"
                className={`gap-2 h-9 font-semibold ${isSubmitted ? "bg-emerald-600 hover:bg-emerald-600 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"}`}
                disabled={saveMutation.isPending || isSubmitted || !canSubmit}
                onClick={() => saveMutation.mutate("submitted")}>
                {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isSubmitted ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                {isSubmitted ? "Submitted" : "Submit Report"}
              </Button>
            </div>
          </div>

          {/* Right: status */}
          <div className="flex items-center gap-3">
            {submitHelper && (
              <span className="text-[11px] text-slate-400 italic">{submitHelper}</span>
            )}
            <div className="w-px h-5 bg-slate-200" />
            <div className="flex flex-col items-end">
              <Badge variant="outline" className={
                isSubmitted
                  ? "text-[11px] bg-emerald-50 text-emerald-700 border-emerald-200 py-0.5 px-2.5"
                  : savedStatus === "draft"
                  ? "text-[11px] bg-amber-50 text-amber-700 border-amber-200 py-0.5 px-2.5"
                  : "text-[11px] text-slate-400 border-slate-200 bg-white py-0.5 px-2.5"
              }>
                {isSubmitted ? "✓ Submitted" : savedStatus === "draft" ? "Draft" : "Unsaved"}
              </Badge>
              {lastSaved && (
                <span className="text-[10px] text-slate-400 mt-0.5">Last saved: {fmtTime(lastSaved)}</span>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ── Sections: locked when submitted (pointer-events + opacity) ── */}
      <div className="space-y-3" style={isSubmitted ? { opacity: 0.72, pointerEvents: "none", userSelect: "none" } : {}}>

      {/* ══════════════════════════════════════════════════════
          §1 — General Info
      ══════════════════════════════════════════════════════ */}
      <Section num={1} title="General Info" icon={<Calendar className="w-4 h-4" />}>
        <div className="grid grid-cols-3 gap-x-5 gap-y-3.5">

          {/* Row 1 */}
          <div>
            <FL>Report No.</FL>
            <div className="h-9 flex items-center px-3 rounded-md border border-slate-200 bg-slate-50 text-sm font-mono font-semibold text-slate-600 tracking-widest select-none">
              {reportNumber || <span className="text-slate-300 font-sans font-normal text-xs italic">auto…</span>}
            </div>
          </div>

          <div>
            <FL>Prepared By</FL>
            <PreparedByCombobox
              value={preparedBy}
              allWorkers={activeWorkers}
              disabled={isSubmitted}
              onChange={(name, id) => { setPreparedBy(name); setPreparedById(id); }}
            />
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

      {/* ══════════════════════════════════════════════════════
          §2 — Manpower
      ══════════════════════════════════════════════════════ */}
      <Section num={2} title="Manpower" icon={<Users className="w-4 h-4" />} summary={mpSummary}>

        {/* Section-level defaults */}
        <div className="flex items-center gap-4 flex-wrap mb-4 pb-4 border-b border-slate-100">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest shrink-0 flex items-center gap-1.5">
            <Clock className="w-3 h-3" /> Row defaults
          </span>
          <div className="flex items-center gap-1.5">
            <label className="text-[11px] text-slate-500">Start</label>
            <Input type="time" value={defStart} onChange={(e) => setDefStart(e.target.value)}
              data-testid="input-def-start" className="h-7 text-xs w-28" />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-[11px] text-slate-500">End</label>
            <Input type="time" value={defEnd} onChange={(e) => setDefEnd(e.target.value)}
              data-testid="input-def-end" className="h-7 text-xs w-28" />
          </div>
          <button type="button" data-testid="toggle-def-lunch-break"
            onClick={() => setDefLunchBreak(v => !v)}
            className={`flex items-center gap-1.5 h-7 px-3 rounded-md border text-[11px] font-medium transition-colors ${
              defLunchBreak
                ? "bg-amber-50 border-amber-200 text-amber-700"
                : "border-slate-200 text-slate-400 bg-white"
            }`}>
            <span className="text-[13px] leading-none">☕</span>
            Lunch Break {defLunchBreak ? "ON (−1h)" : "OFF"}
          </button>
          <span className="text-[10px] text-slate-300 italic">applied to new rows only</span>
        </div>

        {/* Manpower table — max-h + scroll only when rows exceed 5 */}
        <div className={manpower.length > 5 ? "max-h-[360px] overflow-y-auto pr-1" : ""}>
          <table className="w-full text-sm" data-testid="table-manpower">
            <TH cols={[
              { label: "Worker Name",  cls: "min-w-[180px] w-[24%]" },
              { label: "Trade",        cls: "min-w-[100px] w-[13%]" },
              { label: "Status",       cls: "min-w-[100px] w-[13%]" },
              { label: "Start",        cls: "w-[82px]" },
              { label: "End",          cls: "w-[82px]" },
              { label: "Break",        cls: "w-[50px] text-center" },
              { label: "Hrs",          cls: "w-[52px] text-center" },
              { label: "Notes",        cls: "min-w-[90px]" },
            ]} />
            <tbody>
              {manpower.length === 0 && (
                <tr><td colSpan={9} className="py-7 text-center text-xs text-slate-300 italic">
                  No workers added — click Add Worker below
                </td></tr>
              )}
              {manpower.map((row, i) => {
                const takenIds    = new Set(manpower.filter((r) => r.id !== row.id).map((r) => r.workerId));
                const hoursActive = HOURS_COMPUTED.has(row.attendanceStatus);
                return (
                  <tr key={row.id} className="border-b border-slate-100 last:border-0 group hover:bg-slate-50/40">
                    <td className="py-1.5 px-2.5">
                      <WorkerCombobox row={row} allWorkers={activeWorkers} takenIds={takenIds}
                        testId={`input-mp-worker-${i}`}
                        onChange={(p) => setManpower(manpower.map((r) => r.id === row.id ? { ...r, ...p } : r))} />
                    </td>
                    <td className="py-1.5 px-2.5">
                      <Input data-testid={`input-mp-trade-${i}`} value={row.trade}
                        onChange={(e) => setManpower(manpower.map((r) => r.id === row.id ? { ...r, trade: e.target.value } : r))}
                        className={cellInputCls} placeholder="e.g. Electrician" />
                    </td>
                    <td className="py-1.5 px-2.5">
                      <Select value={row.attendanceStatus}
                        onValueChange={(v) => {
                          const hrs = calcHours(row.startTime, row.endTime, v, row.lunchBreak);
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
                    <td className="py-1.5 px-2.5">
                      <Input data-testid={`input-mp-start-${i}`} type="time" value={row.startTime}
                        onChange={(e) => {
                          const hrs = calcHours(e.target.value, row.endTime, row.attendanceStatus, row.lunchBreak);
                          setManpower(manpower.map((r) => r.id === row.id ? { ...r, startTime: e.target.value, hoursWorked: hrs } : r));
                        }}
                        className={`h-8 text-xs ${!hoursActive ? "opacity-40 pointer-events-none" : ""}`}
                        disabled={!hoursActive} />
                    </td>
                    <td className="py-1.5 px-2.5">
                      <Input data-testid={`input-mp-end-${i}`} type="time" value={row.endTime}
                        onChange={(e) => {
                          const hrs = calcHours(row.startTime, e.target.value, row.attendanceStatus, row.lunchBreak);
                          setManpower(manpower.map((r) => r.id === row.id ? { ...r, endTime: e.target.value, hoursWorked: hrs } : r));
                        }}
                        className={`h-8 text-xs ${!hoursActive ? "opacity-40 pointer-events-none" : ""}`}
                        disabled={!hoursActive} />
                    </td>
                    <td className="py-1.5 px-1">
                      <div className="flex justify-center">
                        <button type="button" data-testid={`toggle-mp-break-${i}`}
                          onClick={() => {
                            const nb = !row.lunchBreak;
                            const hrs = calcHours(row.startTime, row.endTime, row.attendanceStatus, nb);
                            setManpower(manpower.map((r) => r.id === row.id ? { ...r, lunchBreak: nb, hoursWorked: hrs } : r));
                          }}
                          title={row.lunchBreak ? "Lunch break applied (−1h) — click to disable" : "No break deduction — click to enable"}
                          className={`h-6 w-8 rounded text-[9px] font-bold border transition-colors ${
                            row.lunchBreak && hoursActive
                              ? "bg-amber-50 border-amber-200 text-amber-600"
                              : "border-slate-200 text-slate-300 bg-transparent"
                          }`}>
                          {row.lunchBreak && hoursActive ? "−1h" : "—"}
                        </button>
                      </div>
                    </td>
                    <td className="py-1.5 px-2.5">
                      <ROCell center>
                        {hoursActive ? row.hoursWorked.toFixed(1) : <span className="text-slate-300">—</span>}
                      </ROCell>
                    </td>
                    <td className="py-1.5 px-2.5">
                      <Input data-testid={`input-mp-notes-${i}`} value={row.notes}
                        onChange={(e) => setManpower(manpower.map((r) => r.id === row.id ? { ...r, notes: e.target.value } : r))}
                        className={cellInputCls} placeholder="Optional" />
                    </td>
                    <td className="py-1.5 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <DelBtn testId={`btn-remove-mp-${i}`} onClick={() => setManpower(manpower.filter((r) => r.id !== row.id))} />
                    </td>
                  </tr>
                );
              })}

              {/* Summary row */}
              {manpower.length > 0 && (
                <tr className="border-t border-slate-200 bg-slate-50">
                  <td colSpan={5} className="py-2 px-2.5">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Summary</span>
                    <span className="ml-3 text-xs">
                      <span className="font-bold text-slate-800">{totalWorkers}</span>
                      <span className="text-slate-500"> worker{totalWorkers !== 1 ? "s" : ""}</span>
                    </span>
                  </td>
                  <td className="py-2 px-2.5">
                    <div className="h-6 flex items-center justify-center px-1 rounded-md bg-blue-50 border border-blue-200 text-xs font-bold text-blue-700 tabular-nums">
                      {totalManhours.toFixed(1)}
                    </div>
                  </td>
                  <td colSpan={2} className="py-2 px-2.5 text-[10px] text-slate-400">man-hrs</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <AddRow testId="btn-add-manpower" label="Add Worker"
          onClick={() => setManpower([...manpower, {
            id: uid(), workerId: null, workerName: "", trade: "",
            attendanceStatus: "ATTEND",
            startTime: defStart, endTime: defEnd,
            lunchBreak: defLunchBreak,
            hoursWorked: calcHours(defStart, defEnd, "ATTEND", defLunchBreak),
            notes: "",
          }])} />

        {activeWorkers.length === 0 && (
          <p className="mt-2 text-[11px] text-amber-600 flex items-center gap-1.5">
            <Info className="w-3 h-3 shrink-0" />
            No registered workers found. You can still enter names manually.
          </p>
        )}
      </Section>

      {/* ══════════════════════════════════════════════════════
          §3 — Work Tasks
      ══════════════════════════════════════════════════════ */}
      <Section num={3} title="Work Tasks" icon={<FileText className="w-4 h-4" />} summary={taskSummary}>
        <table className="w-full text-sm" data-testid="table-tasks">
          <TH cols={[
            { label: "Task Description",  cls: "min-w-[200px] w-[35%]" },
            { label: "Area / Location",   cls: "min-w-[120px] w-[18%]" },
            { label: "Status",            cls: "min-w-[130px] w-[15%]" },
            { label: "Notes",             cls: "min-w-[110px]" },
            { label: "Detail",            cls: "w-[58px] text-center" },
          ]} />
          <tbody>
            {tasks.length === 0 && (
              <tr><td colSpan={6} className="py-7 text-center text-xs text-slate-300 italic">
                No tasks yet — click Add Task below
              </td></tr>
            )}
            {tasks.map((row, i) => {
              const cfg = TASK_STATUS_CFG[row.status] ?? TASK_STATUS_CFG["not-started"];
              return (
                <>
                  {/* Main row */}
                  <tr key={row.id} className={`border-b border-slate-100 group ${cfg.rowBg} ${row.expanded ? "border-b-0" : ""}`}>
                    <td className="py-1.5 px-2.5">
                      <Input data-testid={`input-task-desc-${i}`} value={row.description}
                        onChange={(e) => setTasks(tasks.map((r) => r.id === row.id ? { ...r, description: e.target.value } : r))}
                        className={cellInputCls} placeholder="Describe the task…" />
                    </td>
                    <td className="py-1.5 px-2.5">
                      <Input data-testid={`input-task-area-${i}`} value={row.area}
                        onChange={(e) => setTasks(tasks.map((r) => r.id === row.id ? { ...r, area: e.target.value } : r))}
                        className={cellInputCls} placeholder="Area / Zone" />
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
                        className={cellInputCls} placeholder="Optional" />
                    </td>
                    {/* Expand / attachment toggle */}
                    <td className="py-1.5 px-2 text-center">
                      <button type="button" data-testid={`btn-task-expand-${i}`}
                        onClick={() => setTasks(tasks.map((r) => r.id === row.id ? { ...r, expanded: !r.expanded } : r))}
                        title="Attachments & detail"
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-medium transition-colors ${
                          row.expanded || row.drawingFiles.length > 0 || row.photoFiles.length > 0
                            ? "border-blue-200 bg-blue-50 text-blue-600"
                            : "border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600"
                        }`}>
                        <Paperclip className="w-3 h-3" />
                        {row.drawingFiles.length + row.photoFiles.length > 0
                          ? row.drawingFiles.length + row.photoFiles.length
                          : <ChevronRight className={`w-3 h-3 transition-transform ${row.expanded ? "rotate-90" : ""}`} />
                        }
                      </button>
                    </td>
                    <td className="py-1.5 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <DelBtn testId={`btn-remove-task-${i}`} onClick={() => setTasks(tasks.filter((r) => r.id !== row.id))} />
                    </td>
                  </tr>

                  {/* Expandable detail row */}
                  {row.expanded && (
                    <tr key={`${row.id}-detail`} className={`border-b border-slate-100 ${cfg.rowBg}`}>
                      <td colSpan={6} className="px-3 pb-3 pt-0">
                        <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 space-y-3">
                          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Task Detail &amp; Attachments</p>
                          <div className="grid grid-cols-2 gap-3">
                            {/* Drawing upload placeholder */}
                            <div>
                              <p className="text-[10px] text-slate-500 font-medium mb-1.5 flex items-center gap-1">
                                <Paperclip className="w-3 h-3" /> Drawings
                                {row.drawingFiles.length > 0 && <span className="ml-1 text-blue-600">({row.drawingFiles.length})</span>}
                              </p>
                              <button type="button"
                                onClick={() => toast({ title: "Drawing upload", description: "File attachment is coming in the next update." })}
                                className="w-full h-16 border-2 border-dashed border-slate-200 rounded-lg text-xs text-slate-400 hover:border-slate-300 hover:text-slate-500 transition-colors flex flex-col items-center justify-center gap-1">
                                <Paperclip className="w-4 h-4" />
                                <span>PDF, DWG, or image</span>
                              </button>
                            </div>
                            {/* Photo upload placeholder */}
                            <div>
                              <p className="text-[10px] text-slate-500 font-medium mb-1.5 flex items-center gap-1">
                                <Camera className="w-3 h-3" /> Site Photos
                                {row.photoFiles.length > 0 && <span className="ml-1 text-blue-600">({row.photoFiles.length})</span>}
                              </p>
                              <button type="button"
                                onClick={() => toast({ title: "Photo upload", description: "Photo attachment is coming in the next update." })}
                                className="w-full h-16 border-2 border-dashed border-slate-200 rounded-lg text-xs text-slate-400 hover:border-slate-300 hover:text-slate-500 transition-colors flex flex-col items-center justify-center gap-1">
                                <Camera className="w-4 h-4" />
                                <span>JPG, PNG, HEIC</span>
                              </button>
                            </div>
                          </div>
                          {/* Extra task notes */}
                          <div>
                            <p className="text-[10px] text-slate-400 font-medium mb-1">Additional Notes</p>
                            <Textarea value={row.detailNotes}
                              onChange={(e) => setTasks(tasks.map((r) => r.id === row.id ? { ...r, detailNotes: e.target.value } : r))}
                              placeholder="Additional task notes, issues encountered, corrective actions…"
                              className="text-xs min-h-[64px] resize-y bg-white" />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>

        <AddRow testId="btn-add-task" label="Add Task"
          onClick={() => setTasks([...tasks, {
            id: uid(), description: "", area: "", status: "in-progress", notes: "",
            expanded: false, detailNotes: "", drawingFiles: [], photoFiles: [],
          }])} />
      </Section>

      {/* ══════════════════════════════════════════════════════
          §4 — Materials
      ══════════════════════════════════════════════════════ */}
      <Section num={4} title="Materials" icon={<Package className="w-4 h-4" />} summary={matSummary} defaultOpen={false}>
        <table className="w-full text-sm" data-testid="table-materials">
          <TH cols={[
            { label: "Material / Inventory Item", cls: "min-w-[200px] w-[40%]" },
            { label: "Unit",     cls: "w-[72px] text-center" },
            { label: "Qty Used", cls: "w-[80px] text-center" },
            { label: "Notes",    cls: "min-w-[100px]" },
            ...(scopeItems.length > 0 ? [{ label: "Scope Link", cls: "min-w-[140px]" }] : []),
          ]} />
          <tbody>
            {materials.length === 0 && (
              <tr><td colSpan={scopeItems.length > 0 ? 6 : 5} className="py-7 text-center text-xs text-slate-300 italic">No materials logged yet</td></tr>
            )}
            {materials.map((row, i) => (
              <tr key={row.id} className="border-b border-slate-100 last:border-0 group hover:bg-slate-50/40">
                <td className="py-1.5 px-2.5">
                  <MaterialSearch row={row} inventoryItems={inventoryItems} testId={`input-mat-desc-${i}`}
                    onChange={(p) => {
                      let patch: Partial<MaterialRow> = { ...p };
                      if (p.inventoryItemId !== undefined && p.inventoryItemId !== null) {
                        const matched = scopeItems.find((s: any) => s.linkedInventoryItemId === p.inventoryItemId);
                        if (matched) patch.scopeItemId = matched.id;
                      }
                      setMaterials(materials.map((r) => r.id === row.id ? { ...r, ...patch } : r));
                    }} />
                </td>
                <td className="py-1.5 px-2.5 w-[72px]">
                  <Input
                    data-testid={`input-mat-unit-${i}`}
                    value={row.unit}
                    onChange={(e) => setMaterials(materials.map((r) => r.id === row.id ? { ...r, unit: e.target.value } : r))}
                    readOnly={!!row.inventoryItemId}
                    className={`h-8 text-xs text-center font-mono w-[60px] ${row.inventoryItemId ? "bg-slate-50 border-slate-200 text-slate-600 cursor-default" : ""}`}
                    placeholder="EA"
                  />
                </td>
                <td className="py-1.5 px-2.5">
                  <Input data-testid={`input-mat-qty-${i}`} type="number" min={0} value={row.qty}
                    onChange={(e) => setMaterials(materials.map((r) => r.id === row.id ? { ...r, qty: Number(e.target.value) } : r))}
                    className="h-8 text-xs text-center tabular-nums" />
                </td>
                <td className="py-1.5 px-2.5">
                  <Input data-testid={`input-mat-notes-${i}`} value={row.notes}
                    onChange={(e) => setMaterials(materials.map((r) => r.id === row.id ? { ...r, notes: e.target.value } : r))}
                    className={cellInputCls} placeholder="Optional" />
                </td>
                {scopeItems.length > 0 && (
                  <td className="py-1.5 px-2.5">
                    <select
                      data-testid={`select-scope-link-${i}`}
                      value={row.scopeItemId ?? ""}
                      onChange={(e) => {
                        const scopeId = e.target.value ? Number(e.target.value) : null;
                        let patch: Partial<MaterialRow> = { scopeItemId: scopeId };
                        if (scopeId) {
                          const scope = scopeItems.find((s: any) => s.id === scopeId);
                          if (scope?.linkedInventoryItemId) {
                            const invItem = inventoryItems.find((inv: any) => inv.id === scope.linkedInventoryItemId);
                            if (invItem) {
                              patch.inventoryItemId = invItem.id;
                              patch.description    = invItem.name;
                              patch.unit           = invItem.unitOfMeasure ?? row.unit;
                            }
                          }
                        }
                        setMaterials(materials.map((r) => r.id === row.id ? { ...r, ...patch } : r));
                      }}
                      className="h-8 w-full text-xs rounded-md border border-transparent bg-transparent hover:border-slate-300 hover:bg-white focus:border-blue-300 focus:bg-white transition-colors px-2 cursor-pointer text-slate-600"
                    >
                      <option value="">— No link</option>
                      {scopeItems.filter((s: any) => s.isActive).map((s: any) => (
                        <option key={s.id} value={s.id}>{s.itemName} ({s.unit})</option>
                      ))}
                    </select>
                  </td>
                )}
                <td className="py-1.5 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <DelBtn testId={`btn-remove-mat-${i}`} onClick={() => setMaterials(materials.filter((r) => r.id !== row.id))} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <AddRow testId="btn-add-material" label="Add Material"
          onClick={() => setMaterials([...materials, { id: uid(), description: "", unit: "EA", qty: 1, notes: "", inventoryItemId: null, scopeItemId: null }])} />

        {inventoryItems.length > 0 && (
          <p className="mt-2 text-[10px] text-slate-400">
            {inventoryItems.length} inventory items available — type to search
            {scopeItems.length > 0 && (
              <> · Scope Link auto-fills when an inventory item is linked to a scope item</>
            )}
          </p>
        )}
      </Section>

      {/* ══════════════════════════════════════════════════════
          §5 — Equipment
      ══════════════════════════════════════════════════════ */}
      <Section num={5} title="Equipment" icon={<Truck className="w-4 h-4" />} summary={eqSummary} defaultOpen={false}>

        {/* Quick-add preset buttons */}
        <div className="mb-4">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Wrench className="w-3 h-3" /> Quick Add
          </p>
          <div className="flex flex-wrap gap-1.5">
            {EQUIPMENT_PRESETS.map((name) => (
              <button key={name} type="button"
                data-testid={`btn-eq-preset-${name.replace(/ /g, "-").toLowerCase()}`}
                onClick={() => setEquipment([...equipment, { id: uid(), name, unit: "EA", qty: 1, hours: 0, notes: "" }])}
                className="px-2.5 py-1 rounded-full text-xs border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors">
                + {name}
              </button>
            ))}
          </div>
        </div>

        <table className="w-full text-sm" data-testid="table-equipment">
          <TH cols={[
            { label: "Equipment Name", cls: "min-w-[180px] w-[38%]" },
            { label: "Unit",           cls: "w-[70px] text-center" },
            { label: "Qty",            cls: "w-[68px] text-center" },
            { label: "Hours Used",     cls: "w-[88px] text-center" },
            { label: "Notes",          cls: "min-w-[120px]" },
          ]} />
          <tbody>
            {equipment.length === 0 && (
              <tr><td colSpan={6} className="py-7 text-center text-xs text-slate-300 italic">No equipment logged yet — use Quick Add above or add manually</td></tr>
            )}
            {equipment.map((row, i) => (
              <tr key={row.id} className="border-b border-slate-100 last:border-0 group hover:bg-slate-50/40">
                <td className="py-1.5 px-2.5">
                  <Input data-testid={`input-eq-name-${i}`} value={row.name}
                    onChange={(e) => setEquipment(equipment.map((r) => r.id === row.id ? { ...r, name: e.target.value } : r))}
                    className={cellInputCls} placeholder="Equipment name…" />
                </td>
                <td className="py-1.5 px-2.5">
                  <Input data-testid={`input-eq-unit-${i}`} value={row.unit}
                    onChange={(e) => setEquipment(equipment.map((r) => r.id === row.id ? { ...r, unit: e.target.value } : r))}
                    className="h-8 text-xs text-center" placeholder="DAY" />
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
                    className={cellInputCls} placeholder="Optional" />
                </td>
                <td className="py-1.5 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <DelBtn testId={`btn-remove-eq-${i}`} onClick={() => setEquipment(equipment.filter((r) => r.id !== row.id))} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <AddRow testId="btn-add-equipment" label="Add Custom"
          onClick={() => setEquipment([...equipment, { id: uid(), name: "", unit: "DAY", qty: 1, hours: 0, notes: "" }])} />
      </Section>

      {/* ══════════════════════════════════════════════════════
          §6 — Notes / Remarks
      ══════════════════════════════════════════════════════ */}
      <Section num={6} title="Notes / Remarks" icon={<FileText className="w-4 h-4" />}
        summary={generalNotes.trim() ? generalNotes.trim().slice(0, 44) + (generalNotes.length > 44 ? "…" : "") : undefined}
        defaultOpen={false}>
        <div className="space-y-4">
          <div>
            <FL>General Notes</FL>
            <Textarea data-testid="input-general-notes" value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              placeholder="Any general observations, site conditions, or notes for the record…"
              className="text-sm min-h-[88px] resize-y" />
          </div>
          <div>
            <FL>Safety Observations</FL>
            <Textarea data-testid="input-safety-notes" value={safetyNotes}
              onChange={(e) => setSafetyNotes(e.target.value)}
              placeholder="Safety incidents, near misses, toolbox talk topics, PPE compliance, hazard observations…"
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

      </div>{/* end sections lock wrapper */}

      {/* ── Bottom action bar ── */}
      <div className="bg-white rounded-xl border border-slate-200 px-5 py-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Button data-testid="btn-save-draft-bottom" variant="outline" size="sm"
              className="gap-2 h-9 text-slate-600 border-slate-300 hover:bg-slate-50"
              disabled={saveMutation.isPending || isSubmitted}
              onClick={() => saveMutation.mutate("draft")}>
              {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Draft
            </Button>
            <Button data-testid="btn-submit-report-bottom" size="sm"
              className={`gap-2 h-9 font-semibold ${isSubmitted ? "bg-emerald-600 hover:bg-emerald-600 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"}`}
              disabled={saveMutation.isPending || isSubmitted || !canSubmit}
              onClick={() => saveMutation.mutate("submitted")}>
              {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isSubmitted ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
              {isSubmitted ? "Submitted" : "Submit Report"}
            </Button>
          </div>
          {submitHelper && (
            <span className="text-[11px] text-slate-400 italic">{submitHelper}</span>
          )}
        </div>
      </div>

    </div>
  );
}
