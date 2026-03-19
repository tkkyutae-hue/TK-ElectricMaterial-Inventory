import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
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
const TASK_STATUS_CFG: Record<string, { label: string; dot: string; text: string; rowBg: string; borderColor: string }> = {
  "not-started": { label: "Not Started",  dot: "bg-slate-400",   text: "text-slate-500",   rowBg: "",             borderColor: "#94a3b8" },
  "in-progress":  { label: "In Progress", dot: "bg-blue-500",    text: "text-blue-700",    rowBg: "",             borderColor: "#1d6ecc" },
  "completed":    { label: "Completed",   dot: "bg-emerald-500", text: "text-emerald-700", rowBg: "",             borderColor: "#16a34a" },
  "delayed":      { label: "Delayed",     dot: "bg-amber-500",   text: "text-amber-700",   rowBg: "bg-amber-50/30", borderColor: "#d97706" },
  "blocked":      { label: "Blocked",     dot: "bg-red-500",     text: "text-red-700",     rowBg: "bg-red-50/30",   borderColor: "#ef4444" },
};

const TRADE_COLOR_CFG: Record<string, { bg: string; color: string; border: string }> = {
  "Foreman":     { bg: "#dcfce7", color: "#16a34a", border: "#86efac" },
  "Helper":      { bg: "#dbeafe", color: "#1d6ecc", border: "#bfdbfe" },
  "Safety":      { bg: "#fee2e2", color: "#dc2626", border: "#fecaca" },
  "Apprentice":  { bg: "#fef3c7", color: "#d97706", border: "#fde68a" },
  "Electrician": { bg: "#ede9fe", color: "#7c3aed", border: "#c4b5fd" },
  "Supervisor":  { bg: "#ccfbf1", color: "#0d9488", border: "#99f6e4" },
};
const DEFAULT_TRADE_COLOR = { bg: "#f3f4f6", color: "#6b7280", border: "#e5e7eb" };
function tradeBadge(trade: string | undefined) {
  if (!trade) return null;
  const t = TRADE_COLOR_CFG[trade] ?? DEFAULT_TRADE_COLOR;
  return (
    <span style={{
      display: "inline-flex", padding: "1px 7px", borderRadius: 4,
      fontSize: 9.5, fontWeight: 700, border: `1px solid ${t.border}`,
      background: t.bg, color: t.color, whiteSpace: "nowrap", flexShrink: 0,
    }}>{trade}</span>
  );
}

const ATTENDANCE_STATUSES = [
  "ATTEND", "PTO", "SICK", "ABSENT", "OFF",
  "LATE", "EARLY_LEAVE", "WFH", "TRAINING", "SUSPENDED", "TERMINATED",
];

const HOURS_COMPUTED = new Set(["ATTEND", "LATE", "EARLY_LEAVE", "WFH", "TRAINING"]);

const EQUIPMENT_PRESETS = [
  "Scissor Lift", "Boom Lift", "One Man Lift", "Reach Forklift",
  "Forklift", "Trench", "Excavator Small", "Excavator Big",
];

// Exact rank allowlist for "Prepared By" — Foreman and above
const PREPARED_BY_RANKS = new Set([
  "general manager",
  "deputy general manager",
  "manager",
  "assistant manager",
  "project engineer",
  "foreman",
]);
function isForemanPlus(trade: string | null | undefined): boolean {
  if (!trade) return false;
  return PREPARED_BY_RANKS.has(trade.toLowerCase().trim());
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

function initials(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean).map(w => w[0]?.toUpperCase() ?? "").slice(0, 2).join("");
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface TaskWorker { name: string; role: "main" | "assist"; trade?: string }
interface TaskRow {
  id: number; description: string; area: string; status: string; notes: string;
  expanded: boolean; detailNotes: string; drawingFiles: string[]; photoFiles: string[];
  workers: TaskWorker[]; linkedPinId: string | null;
}
interface DrawingPin { id: string; x: number; y: number; linkedTaskId: number | null }
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
  onChange: (name: string, id: number | null, trade?: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(() =>
    value ? allWorkers.find(w => w.fullName === value) ?? null : null
  );

  const foremanPlus = allWorkers.filter(w => w.isActive && isForemanPlus(w.trade));
  const filtered = foremanPlus
    .filter(w => !query || w.fullName.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 10);

  useEffect(() => {
    setQuery(value);
    if (!value) { setSelectedWorker(null); return; }
    const found = allWorkers.find(w => w.fullName === value);
    if (found) setSelectedWorker(found);
  }, [value, allWorkers]);

  const displayWorker = selectedWorker ?? (value ? allWorkers.find(w => w.fullName === value) ?? null : null);

  if (displayWorker && value) {
    return (
      <div style={{ position: "relative", height: 36 }}>
        <div style={{
          background: "#dcfce7", border: "1px solid #86efac",
          color: "#16a34a", fontWeight: 600, borderRadius: 8,
          padding: "0 38px 0 10px", height: 36,
          display: "flex", alignItems: "center", fontSize: 13,
          userSelect: "none", cursor: "default", overflow: "hidden",
        }}>
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {displayWorker.fullName}{displayWorker.trade ? `  ·  ${displayWorker.trade}` : ""}
          </span>
        </div>
        {!disabled && (
          <button type="button"
            data-testid="btn-clear-prepared-by"
            title="Clear selection"
            onClick={() => { setSelectedWorker(null); setQuery(""); onChange("", null, ""); }}
            style={{
              position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
              width: 20, height: 20, borderRadius: "50%",
              background: "#86efac", color: "#16a34a",
              fontSize: 12, fontWeight: 700, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "none", flexShrink: 0,
            }}
            onMouseEnter={e => { const b = e.currentTarget; b.style.background = "#16a34a"; b.style.color = "white"; }}
            onMouseLeave={e => { const b = e.currentTarget; b.style.background = "#86efac"; b.style.color = "#16a34a"; }}>
            ×
          </button>
        )}
      </div>
    );
  }

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
          setSelectedWorker(null);
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
              onClick={() => { setQuery(w.fullName); setOpen(false); setSelectedWorker(w); onChange(w.fullName, w.id, w.trade); }}
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
  projectId, reportId, initialData, onSaved, forceEdit = false,
}: {
  projectId: number; reportId?: number | null; initialData?: any;
  onSaved?: (id: number, status: string) => void;
  forceEdit?: boolean;
}) {
  const { toast }   = useToast();
  const queryClient = useQueryClient();
  const { isManagerOrAbove } = useAuth();
  const fd          = initialData?.formData ?? null;

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ── Registry queries ──
  const { data: workers = [] }        = useQuery<Worker[]>({ queryKey: ["/api/workers"] });
  const { data: inventoryItems = [] } = useQuery<any[]>({ queryKey: ["/api/items"] });
  const { data: project }             = useQuery<any>({
    queryKey: ["/api/projects", projectId],
    queryFn: () => fetch(`/api/projects/${projectId}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!projectId,
  });
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
  const [reportNumber,    setReportNumber]    = useState<string>(fd?.reportNumber ?? "");
  const [preparedBy,      setPreparedBy]      = useState<string>(fd?.preparedBy   ?? "");
  const [preparedById,    setPreparedById]    = useState<number | null>(fd?.preparedById ?? null);
  const [preparedByTrade, setPreparedByTrade] = useState<string>(fd?.preparedByTrade ?? "");
  const [reportDate,      setReportDate]      = useState<string>(fd?.reportDate   ?? new Date().toISOString().slice(0, 10));
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
    (fd?.tasks ?? []).map((t: any) => ({ expanded: false, detailNotes: "", drawingFiles: [], photoFiles: [], workers: [], ...t }))
  );
  const [assignOpen,     setAssignOpen]     = useState<number | null>(null);
  const [deleteConfirm,  setDeleteConfirm]  = useState<number | null>(null);
  const [undoState,      setUndoState]      = useState<{ task: TaskRow; index: number; progress: number } | null>(null);
  const undoTimerRef    = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const undoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Drawing Board state
  const [drawingUrl,       setDrawingUrl]       = useState<string | null>(null);
  const [drawingFilename,  setDrawingFilename]  = useState("");
  const [pins,             setPins]             = useState<DrawingPin[]>([]);
  const [drawingCollapsed, setDrawingCollapsed] = useState(false);
  const [addPinMode,       setAddPinMode]       = useState(false);
  const [selectedPinId,    setSelectedPinId]    = useState<string | null>(null);
  const [pinLinkOpen,      setPinLinkOpen]      = useState<string | null>(null);
  const [taskPinOpen,      setTaskPinOpen]      = useState<number | null>(null);
  const drawingInputRef    = useRef<HTMLInputElement>(null);

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
  const totalWorkers    = manpower.length;
  const totalManhours   = manpower.reduce((s, r) => s + r.hoursWorked, 0);
  const presentCount    = manpower.filter((r) => r.attendanceStatus === "ATTEND").length;
  const exceptionsCount = manpower.filter((r) => r.attendanceStatus !== "ATTEND").length;

  // ── Submit validation ──
  const isSubmitted  = savedStatus === "submitted" && !forceEdit;
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
  const taskSummary = tasks.length ? `${tasks.length} task${tasks.length !== 1 ? "s" : ""}` : undefined;

  function handleDeleteTask(task: TaskRow, index: number) {
    setDeleteConfirm(null);
    setTasks(prev => prev.filter(r => r.id !== task.id));
    // Unlink any pin that was pointing at this task
    if (task.linkedPinId) {
      setPins(prev => prev.map(p => p.id === task.linkedPinId ? { ...p, linkedTaskId: null } : p));
    }
    if (undoTimerRef.current)    clearTimeout(undoTimerRef.current);
    if (undoIntervalRef.current) clearInterval(undoIntervalRef.current);
    let progress = 100;
    setUndoState({ task, index, progress });
    undoIntervalRef.current = setInterval(() => {
      progress -= 2;
      setUndoState(prev => prev ? { ...prev, progress: Math.max(0, progress) } : null);
    }, 100);
    undoTimerRef.current = setTimeout(() => {
      if (undoIntervalRef.current) clearInterval(undoIntervalRef.current);
      setUndoState(null);
    }, 5000);
  }

  function handleUndo() {
    if (!undoState) return;
    if (undoTimerRef.current)    clearTimeout(undoTimerRef.current);
    if (undoIntervalRef.current) clearInterval(undoIntervalRef.current);
    const restoredTask = undoState.task;
    setTasks(prev => {
      const arr = [...prev];
      arr.splice(undoState.index, 0, restoredTask);
      return arr;
    });
    // Re-link the pin that was unlinked on delete
    if (restoredTask.linkedPinId) {
      setPins(prev => prev.map(p => p.id === restoredTask.linkedPinId ? { ...p, linkedTaskId: restoredTask.id } : p));
    }
    setUndoState(null);
  }

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

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!reportId) throw new Error("No report ID");
      return apiRequest("DELETE", `/api/daily-reports/${reportId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/daily-reports", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/daily-reports-summary"] });
      toast({ title: "Report deleted", description: "The daily report has been permanently deleted." });
      onSaved?.(-1, "deleted");
    },
    onError: (err: any) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">

      {/* ── Delete confirmation modal ── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-50 shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Delete Report</h3>
                <p className="text-xs text-slate-500 mt-0.5">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-slate-700 mb-5">Are you sure you want to delete this report?</p>
            <div className="flex items-center gap-2 justify-end">
              <Button variant="outline" size="sm" className="h-9"
                onClick={() => setShowDeleteConfirm(false)}
                data-testid="btn-delete-cancel">
                Cancel
              </Button>
              <Button size="sm"
                className="h-9 gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold"
                disabled={deleteMutation.isPending}
                onClick={() => { deleteMutation.mutate(); setShowDeleteConfirm(false); }}
                data-testid="btn-delete-confirm">
                {deleteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

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
                className={`gap-2 h-9 ${
                  isSubmitted
                    ? "bg-emerald-600 hover:bg-emerald-600 text-white font-semibold"
                    : canSubmit
                    ? "bg-[#16a34a] hover:bg-[#15803d] text-white font-bold border border-[#16a34a]"
                    : "bg-[#f3f4f6] border border-[#e5e7eb] text-[#9ca3af] font-semibold opacity-60 cursor-not-allowed"
                }`}
                disabled={saveMutation.isPending || isSubmitted || !canSubmit}
                onClick={() => saveMutation.mutate("submitted")}>
                {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isSubmitted ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                {isSubmitted ? "Submitted" : "Submit Report"}
              </Button>
            </div>

            {isManagerOrAbove && reportId && (
              <Button data-testid="btn-delete-report"
                variant="outline" size="sm"
                className="gap-2 h-9 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                disabled={deleteMutation.isPending}
                onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 className="w-3.5 h-3.5" />
                Delete Report
              </Button>
            )}
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
        <div className="grid grid-cols-3 gap-x-6 gap-y-4">

          {/* Row 1 */}
          <div>
            <FL>Report No.</FL>
            <div className="h-9 flex items-center px-3 rounded-md border border-slate-200 bg-slate-50 text-sm font-mono font-semibold text-slate-600 tracking-widest select-none">
              {reportNumber || <span className="text-slate-300 font-sans font-normal text-xs italic">auto…</span>}
            </div>
          </div>

          <div>
            <FL>
              Prepared By
              <span style={{ fontSize: 9, color: "#dc2626", fontWeight: 500, marginLeft: 6, textTransform: "none", letterSpacing: 0 }}>
                * Required to submit
              </span>
            </FL>
            <PreparedByCombobox
              value={preparedBy}
              allWorkers={activeWorkers}
              disabled={isSubmitted}
              onChange={(name, id, trade) => { setPreparedBy(name); setPreparedById(id); setPreparedByTrade(trade ?? ""); }}
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

          {/* Row 3: Auto-filled project fields */}
          <div>
            <FL>
              <span>🔒 PROJECT LOCATION</span>
              <span style={{ fontSize: 8, color: "#9db8a2", fontWeight: 400, textTransform: "none", letterSpacing: 0, marginLeft: 5 }}>auto-filled</span>
            </FL>
            <div data-testid="field-project-location" style={{
              background: "#f8faf9", border: "1px solid #e2e8e3", color: "#3d5c42",
              borderRadius: 8, padding: "10px 14px", cursor: "default", userSelect: "none",
              display: "flex", alignItems: "center", gap: 6, fontSize: 13, minHeight: 36,
            }}>
              <span style={{ fontSize: 13, opacity: 0.5 }}>📍</span>
              <span>{project?.jobLocation || "—"}</span>
            </div>
          </div>

          <div>
            <FL>
              <span>🔒 OWNER / MANAGER</span>
              <span style={{ fontSize: 8, color: "#9db8a2", fontWeight: 400, textTransform: "none", letterSpacing: 0, marginLeft: 5 }}>auto-filled</span>
            </FL>
            <div data-testid="field-project-owner" style={{
              background: "#f8faf9", border: "1px solid #e2e8e3", color: "#3d5c42",
              borderRadius: 8, padding: "10px 14px", cursor: "default", userSelect: "none",
              display: "flex", alignItems: "center", gap: 6, fontSize: 13, minHeight: 36,
            }}>
              <span style={{ fontSize: 13, opacity: 0.5 }}>👤</span>
              <span>{project?.ownerName || "—"}</span>
            </div>
          </div>

          <div>
            <FL>
              <span>🔒 PO NUMBER</span>
              <span style={{ fontSize: 8, color: "#9db8a2", fontWeight: 400, textTransform: "none", letterSpacing: 0, marginLeft: 5 }}>auto-filled</span>
            </FL>
            <div data-testid="field-project-po" style={{
              background: "#f8faf9", border: "1px solid #e2e8e3", color: "#3d5c42",
              borderRadius: 8, padding: "10px 14px", cursor: "default", userSelect: "none",
              display: "flex", alignItems: "center", gap: 6, fontSize: 13, minHeight: 36,
            }}>
              <span style={{ fontSize: 13, opacity: 0.5 }}>📋</span>
              <span>{project?.poNumber || "—"}</span>
            </div>
          </div>

        </div>

        {/* Submit readiness indicator */}
        <div style={{
          marginTop: 14,
          background: preparedBy.trim() ? "#dcfce7" : "#fef3c7",
          border: preparedBy.trim() ? "1px solid #86efac" : "1px solid #fde68a",
          borderRadius: 8, padding: "9px 14px",
          fontSize: 10.5,
          color: preparedBy.trim() ? "#16a34a" : "#d97706",
        }}>
          {preparedBy.trim()
            ? `✓ Ready to submit — Prepared By: ${preparedBy}${preparedByTrade ? ` (${preparedByTrade})` : ""}`
            : "⚠ Add Prepared By to enable submission"}
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
            onClick={() => {
              const next = !defLunchBreak;
              setDefLunchBreak(next);
              setManpower(prev => prev.map(r => {
                const hrs = calcHours(r.startTime, r.endTime, r.attendanceStatus, next);
                return { ...r, lunchBreak: next, hoursWorked: hrs };
              }));
            }}
            className={`flex items-center gap-1.5 h-7 px-3 rounded-md border text-[11px] font-medium transition-colors ${
              defLunchBreak
                ? "bg-amber-50 border-amber-200 text-amber-700"
                : "border-slate-200 text-slate-400 bg-white"
            }`}>
            <span className="text-[13px] leading-none">☕</span>
            Lunch Break {defLunchBreak ? "ON (−1h)" : "OFF"}
          </button>
          <span className="text-[10px] text-slate-300 italic">applies to all rows</span>
        </div>

        {/* Manpower table — no overflow-x-auto so dropdown panels are not clipped */}
        <div>
          <table className="text-sm w-full" data-testid="table-manpower">
            <TH cols={[
              { label: "Worker Name",  cls: "w-[220px]" },
              { label: "Trade",        cls: "w-[110px]" },
              { label: "Status",       cls: "w-[140px]" },
              { label: "Start",        cls: "w-[76px]" },
              { label: "End",          cls: "w-[76px]" },
              { label: "Break",        cls: "w-[46px] text-center" },
              { label: "Hrs",          cls: "w-[48px] text-center" },
              { label: "Notes",        cls: "w-[120px]" },
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
                        <SelectTrigger data-testid={`select-mp-status-${i}`} className="h-8 text-xs" style={{ minWidth: "140px", width: "140px" }}>
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

              {/* Summary row — individual tds mirror each column so HRS aligns perfectly */}
              {manpower.length > 0 && (
                <tr style={{ borderTop: "2px solid #d0dbd2", background: "#eef2ef" }}>
                  {/* Worker Name + Trade + Status: SUMMARY label + Present + Exceptions */}
                  <td colSpan={3} className="px-3" style={{ paddingTop: 10, paddingBottom: 10 }}>
                    <div className="flex items-center gap-0">
                      <span className="text-[11px] uppercase tracking-wider mr-3" style={{ fontWeight: 700, color: "#3d5c42" }}>
                        Summary
                      </span>
                      <div className="flex items-center gap-1 pr-3 mr-3 border-r border-slate-200">
                        <span className="text-[11px] text-slate-500">Present:</span>
                        <span className="text-[11px] tabular-nums" style={{ fontWeight: 700, color: "#16a34a" }}>{presentCount}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] text-slate-500">Exceptions:</span>
                        <span className="text-[11px] tabular-nums" style={{ fontWeight: 700, color: exceptionsCount > 0 ? "#d97706" : "#94a3b8" }}>{exceptionsCount}</span>
                      </div>
                    </div>
                  </td>
                  {/* Start: empty */}
                  <td style={{ paddingTop: 10, paddingBottom: 10 }} />
                  {/* End: empty */}
                  <td style={{ paddingTop: 10, paddingBottom: 10 }} />
                  {/* Break: break chip */}
                  <td className="px-2.5 text-center" style={{ paddingTop: 10, paddingBottom: 10 }}>
                    {defLunchBreak ? (
                      <span className="inline-flex items-center justify-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 border border-amber-200 text-[9px] font-semibold text-amber-700 whitespace-nowrap">
                        ● ON
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center gap-0.5 px-1.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[9px] font-medium text-slate-500 whitespace-nowrap">
                        OFF
                      </span>
                    )}
                  </td>
                  {/* HRS: total man-hours — aligned directly under HRS header */}
                  <td className="px-2.5 text-center" style={{ paddingTop: 10, paddingBottom: 10 }}>
                    <span className="tabular-nums leading-none" style={{ fontSize: 16, fontWeight: 800, color: exceptionsCount > 0 ? "#d97706" : "#16a34a" }}>
                      {totalManhours.toFixed(1)}
                    </span>
                  </td>
                  {/* Notes: man-hrs label + issues indicator */}
                  <td colSpan={2} className="px-2.5" style={{ paddingTop: 10, paddingBottom: 10 }}>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400">man-hrs</span>
                      <span className="text-slate-200">|</span>
                      {exceptionsCount === 0 ? (
                        <span className="text-[11px] text-slate-400">Issues: None</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 border border-amber-200 text-[10px] font-semibold text-amber-700">
                          ⚠ {exceptionsCount} flagged
                        </span>
                      )}
                    </div>
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

        {/* ── Drawing Board ── */}
        <div style={{ border: "1px solid #d0dbd2", borderRadius: 10, overflow: "hidden", marginBottom: 18 }}>

          {/* Header */}
          <div style={{ padding: "9px 14px", background: "#f4f7f5", borderBottom: drawingUrl ? "1px solid #e2e8e4" : undefined, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ flex: 1, fontSize: 10.5, fontWeight: 700, color: "#3d5c45" }}>
              📐 Project Drawing Board{drawingFilename ? ` · ${drawingFilename}` : ""}
            </span>
            {drawingUrl ? (
              <>
                <button type="button"
                  onClick={() => { setAddPinMode(m => !m); setSelectedPinId(null); }}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5,
                    padding: "3px 9px", borderRadius: 5,
                    border: addPinMode ? "1px solid #a78bfa" : "1px solid #d0dbd2",
                    background: addPinMode ? "#ede9fe" : "white",
                    color: addPinMode ? "#7c3aed" : "#3d5c45", cursor: "pointer", fontWeight: addPinMode ? 700 : 400,
                  }}>📍 Add Pin</button>
                <button type="button" onClick={() => drawingInputRef.current?.click()}
                  style={{ fontSize: 10.5, padding: "3px 9px", border: "1px solid #d0dbd2", borderRadius: 5, background: "white", color: "#3d5c45", cursor: "pointer" }}>
                  Replace
                </button>
                <button type="button" onClick={() => { setDrawingCollapsed(c => !c); setAddPinMode(false); setSelectedPinId(null); }}
                  style={{ fontSize: 10.5, padding: "3px 9px", border: "1px solid #d0dbd2", borderRadius: 5, background: "white", color: "#3d5c45", cursor: "pointer" }}>
                  {drawingCollapsed ? "▼ Expand" : "▲ Collapse"}
                </button>
              </>
            ) : (
              <button type="button" onClick={() => drawingInputRef.current?.click()}
                style={{ fontSize: 10.5, padding: "3px 9px", border: "1px solid #4ade80", borderRadius: 5, background: "white", color: "#16a34a", cursor: "pointer", fontWeight: 600 }}>
                + Upload Drawing
              </button>
            )}
          </div>

          {/* Body */}
          {!drawingUrl ? (
            /* Empty upload area */
            <div style={{ padding: "18px 18px 14px", background: "#f8faf9" }}
              onClick={() => drawingInputRef.current?.click()}>
              <div style={{
                border: "2px dashed #c8d9cb", borderRadius: 8, minHeight: 110,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 6, cursor: "pointer", padding: 20,
              }}>
                <span style={{ fontSize: 32, lineHeight: 1 }}>📐</span>
                <p style={{ fontSize: 11, color: "#9db8a2", textAlign: "center" }}>Upload a project drawing to mark work areas</p>
                <p style={{ fontSize: 9.5, color: "#b8cebe", textAlign: "center" }}>PDF, DWG, JPG, PNG — drag & drop or click</p>
              </div>
            </div>
          ) : drawingCollapsed ? (
            /* Collapsed summary bar */
            <div style={{ padding: "7px 14px", background: "#f8faf9", display: "flex", alignItems: "center", gap: 8, fontSize: 10.5, color: "#6b8a70" }}>
              <span style={{ flex: 1 }}>
                {pins.length} pin{pins.length !== 1 ? "s" : ""} placed ·{" "}
                {pins.filter(p => p.linkedTaskId !== null).length} linked to task{pins.filter(p => p.linkedTaskId !== null).length !== 1 ? "s" : ""} ·{" "}
                {pins.filter(p => p.linkedTaskId === null).length} unlinked
              </span>
              <button type="button" onClick={() => setDrawingCollapsed(false)}
                style={{ fontSize: 10.5, color: "#7c3aed", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                ▼ Expand drawing
              </button>
            </div>
          ) : (
            /* Drawing canvas with pins */
            <>
              <div
                style={{ position: "relative", maxHeight: 280, overflow: "hidden", background: "#f1f5f2", cursor: addPinMode ? "crosshair" : "default" }}
                onClick={e => {
                  if (!addPinMode) { setSelectedPinId(null); setPinLinkOpen(null); return; }
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  const x = ((e.clientX - rect.left) / rect.width) * 100;
                  const y = ((e.clientY - rect.top)  / rect.height) * 100;
                  const nextId = `A${pins.length + 1}`;
                  setPins(prev => [...prev, { id: nextId, x, y, linkedTaskId: null }]);
                }}>
                <img src={drawingUrl} alt="Project drawing"
                  style={{ width: "100%", maxHeight: 280, objectFit: "contain", display: "block" }} />
                {/* Pins */}
                {pins.map(pin => {
                  const isLinked = pin.linkedTaskId !== null;
                  const linkedTask = isLinked ? tasks.find(t => t.id === pin.linkedTaskId) : null;
                  return (
                    <div key={pin.id}
                      style={{
                        position: "absolute", left: `${pin.x}%`, top: `${pin.y}%`,
                        width: 26, height: 26, borderRadius: "50%",
                        background: isLinked ? "#16a34a" : "#1d6ecc",
                        color: "white", fontSize: 9, fontWeight: 700,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transform: "translate(-50%, -50%)",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.25)", cursor: "pointer", zIndex: 10, userSelect: "none",
                      }}
                      onClick={e => {
                        e.stopPropagation();
                        if (selectedPinId === pin.id) { setSelectedPinId(null); setPinLinkOpen(null); }
                        else { setSelectedPinId(pin.id); setPinLinkOpen(null); }
                      }}>
                      {pin.id}
                      {/* Pin popover */}
                      {selectedPinId === pin.id && (
                        <div style={{
                          position: "absolute", bottom: "calc(100% + 10px)", left: "50%", transform: "translateX(-50%)",
                          background: "white", border: "1px solid #d0dbd2", borderRadius: 8, padding: "10px 12px",
                          minWidth: 190, boxShadow: "0 4px 16px rgba(0,0,0,0.15)", fontSize: 11, zIndex: 50,
                          color: "#1c2b1f", cursor: "default", textAlign: "left",
                        }} onClick={e => e.stopPropagation()}>
                          <p style={{ fontWeight: 700, marginBottom: 4 }}>Pin {pin.id}</p>
                          <p style={{ color: "#6b8a70", fontSize: 10, marginBottom: 8 }}>
                            {linkedTask ? `→ ${linkedTask.description || `Task ${tasks.indexOf(linkedTask) + 1}`}` : "Not linked"}
                          </p>
                          <div style={{ position: "relative", display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button type="button"
                              onClick={() => setPinLinkOpen(pinLinkOpen === pin.id ? null : pin.id)}
                              style={{ fontSize: 10, color: "#4338ca", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                              Link to task ▾
                            </button>
                            <button type="button"
                              onClick={() => {
                                // Unlink the task that pointed to this pin
                                if (pin.linkedTaskId !== null) {
                                  setTasks(prev => prev.map(t => t.id === pin.linkedTaskId ? { ...t, linkedPinId: null } : t));
                                }
                                setPins(prev => prev.filter(p => p.id !== pin.id));
                                setSelectedPinId(null); setPinLinkOpen(null);
                              }}
                              style={{ fontSize: 10, color: "#dc2626", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                              Delete pin
                            </button>
                            {pinLinkOpen === pin.id && (
                              <div style={{
                                position: "absolute", top: "100%", left: 0, marginTop: 4,
                                background: "white", border: "1px solid #d0dbd2", borderRadius: 6,
                                boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 100, minWidth: 200,
                              }}>
                                {tasks.length === 0 ? (
                                  <p style={{ padding: "6px 10px", fontSize: 10, color: "#9db8a2" }}>No tasks yet</p>
                                ) : tasks.map((t, ti) => (
                                  <button key={t.id} type="button"
                                    style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 10px", fontSize: 10, color: "#1c2b1f", background: "none", border: "none", cursor: "pointer" }}
                                    className="hover:bg-slate-50"
                                    onClick={() => {
                                      // Unlink previous task if any
                                      if (pin.linkedTaskId !== null) {
                                        setTasks(prev => prev.map(t2 => t2.id === pin.linkedTaskId ? { ...t2, linkedPinId: null } : t2));
                                      }
                                      // Unlink any other pin that was linked to this task
                                      const existingPin = pins.find(p => p.id !== pin.id && p.linkedTaskId === t.id);
                                      if (existingPin) {
                                        setPins(prev => prev.map(p => p.id === existingPin.id ? { ...p, linkedTaskId: null } : p));
                                        setTasks(prev => prev.map(t2 => t2.id === t.id ? { ...t2, linkedPinId: null } : t2));
                                      }
                                      setPins(prev => prev.map(p => p.id === pin.id ? { ...p, linkedTaskId: t.id } : p));
                                      setTasks(prev => prev.map(t2 => t2.id === t.id ? { ...t2, linkedPinId: pin.id } : t2));
                                      setPinLinkOpen(null); setSelectedPinId(null);
                                    }}>
                                    {t.description || `Task ${ti + 1}`}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Legend bar */}
              <div style={{ background: "#f4f7f5", borderTop: "1px solid #e2e8e4", padding: "7px 12px", display: "flex", alignItems: "center", fontSize: 9, color: "#6b8a70" }}>
                <span style={{ flex: 1, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#16a34a", display: "inline-block" }} /> Linked to task
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#1d6ecc", display: "inline-block" }} /> Not yet linked
                  </span>
                </span>
                <span>Click drawing to add pin · Click pin to link or rename</span>
              </div>
            </>
          )}
        </div>
        <input ref={drawingInputRef} type="file" accept="image/*,.pdf,.dwg" className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            if (!file) return;
            const url = URL.createObjectURL(file);
            setDrawingUrl(url); setDrawingFilename(file.name);
            setDrawingCollapsed(false); setAddPinMode(false);
            e.target.value = "";
          }} />

        {/* Empty state */}
        {tasks.length === 0 && (
          <p className="py-7 text-center text-xs text-slate-300 italic">No tasks yet — click Add Task below</p>
        )}

        {/* Task cards */}
        <div className="space-y-[10px]" data-testid="task-cards">
          {tasks.map((row, i) => {
            const cfg = TASK_STATUS_CFG[row.status] ?? TASK_STATUS_CFG["not-started"];
            const mainWorker   = row.workers.find(w => w.role === "main");
            const assistWorkers = row.workers.filter(w => w.role === "assist");
            const allAvatars   = [...(mainWorker ? [mainWorker] : []), ...assistWorkers];

            return (
              <div key={row.id} data-testid={`task-card-${i}`} className="group"
                style={{ background: "white", border: "1px solid #d0dbd2", borderLeft: `3px solid ${cfg.borderColor}`, borderRadius: 10 }}>

                {/* ── Main row ── */}
                <div
                  onClick={() => setTasks(tasks.map(r => r.id === row.id ? { ...r, expanded: !r.expanded } : r))}
                  className="cursor-pointer hover:bg-[#f8faf9] transition-colors"
                  style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 160px 148px 40px", alignItems: "center", padding: "12px 14px" }}>

                  {/* Col 1: Description + Area */}
                  <div className="pr-[14px] border-r border-slate-100 overflow-hidden" onClick={e => e.stopPropagation()}>
                    <Input data-testid={`input-task-desc-${i}`} value={row.description}
                      onChange={e => setTasks(tasks.map(r => r.id === row.id ? { ...r, description: e.target.value } : r))}
                      className="shadow-none h-auto focus-visible:ring-0 focus:border-[#86efac] bg-white font-semibold placeholder:text-[#6b8a70] truncate w-full rounded-sm"
                      style={{ fontSize: 12.5, border: "1px solid #d0dbd2", color: "#0f1a12", padding: "3px 6px" }}
                      placeholder="Task description…" />
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6 }}>
                      <Input data-testid={`input-task-area-${i}`} value={row.area}
                        onChange={e => setTasks(tasks.map(r => r.id === row.id ? { ...r, area: e.target.value } : r))}
                        className="shadow-none h-auto focus-visible:ring-0 focus:border-[#86efac] bg-white placeholder:text-[#6b8a70] truncate rounded-sm"
                        style={{ fontSize: 10.5, border: "1px solid #d0dbd2", color: "#0f1a12", padding: "2px 6px", flex: 1, minWidth: 0 }}
                        placeholder="Area / Location" />
                      {/* Drawing Ref badge */}
                      {row.linkedPinId ? (
                        <button type="button"
                          data-testid={`badge-pin-linked-${i}`}
                          onClick={() => { setDrawingCollapsed(false); setSelectedPinId(row.linkedPinId); }}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 3,
                            background: "#ede9fe", color: "#7c3aed",
                            border: "1px solid #c4b5fd", borderRadius: 4,
                            padding: "1px 6px", fontSize: 9.5, fontWeight: 700,
                            cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap",
                          }}>
                          📍 {row.linkedPinId}
                        </button>
                      ) : (
                        <div style={{ position: "relative", flexShrink: 0 }}>
                          <button type="button"
                            data-testid={`badge-pin-link-${i}`}
                            onClick={() => setTaskPinOpen(taskPinOpen === row.id ? null : row.id)}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 3,
                              border: "1px dashed #c4b5fd", color: "#7c3aed",
                              borderRadius: 4, padding: "1px 6px", fontSize: 9.5,
                              cursor: "pointer", background: "transparent", whiteSpace: "nowrap",
                            }}>
                            📍 Link pin
                          </button>
                          {taskPinOpen === row.id && (
                            <div style={{
                              position: "absolute", top: "100%", left: 0, marginTop: 3, zIndex: 60,
                              background: "white", border: "1px solid #d0dbd2", borderRadius: 6,
                              boxShadow: "0 4px 12px rgba(0,0,0,0.1)", minWidth: 150,
                            }}>
                              {pins.filter(p => p.linkedTaskId === null).length === 0 ? (
                                <p style={{ padding: "6px 10px", fontSize: 10, color: "#9db8a2" }}>
                                  {pins.length === 0 ? "No pins on drawing yet" : "All pins are linked"}
                                </p>
                              ) : pins.filter(p => p.linkedTaskId === null).map(pin => (
                                <button key={pin.id} type="button"
                                  style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 10px", fontSize: 10, color: "#1c2b1f", background: "none", border: "none", cursor: "pointer" }}
                                  className="hover:bg-slate-50"
                                  onClick={() => {
                                    setPins(prev => prev.map(p => p.id === pin.id ? { ...p, linkedTaskId: row.id } : p));
                                    setTasks(prev => prev.map(r => r.id === row.id ? { ...r, linkedPinId: pin.id } : r));
                                    setTaskPinOpen(null);
                                  }}>
                                  📍 {pin.id}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Col 2: Workers summary */}
                  <div className="px-3 border-r border-slate-100 overflow-hidden" onClick={e => e.stopPropagation()}>
                    <p style={{ fontSize: 8 }} className="font-semibold text-slate-400 uppercase tracking-widest mb-1">Workers</p>
                    {row.workers.length === 0 ? (
                      <span className="text-[11px] text-slate-300 italic">+ Assign</span>
                    ) : (
                      <div className="flex items-center gap-1.5 overflow-hidden">
                        {/* Stacked avatars — shrink-0 so they never compress */}
                        <div className="flex items-center shrink-0">
                          {allAvatars.slice(0, 3).map((w, wi) => (
                            <div key={wi} style={{
                              width: 20, height: 20, borderRadius: "50%",
                              marginLeft: wi > 0 ? -6 : 0, border: "1.5px solid white",
                              background: w.role === "main" ? "#dcfce7" : "#dbeafe",
                              color: w.role === "main" ? "#16a34a" : "#1d6ecc",
                              fontSize: 8, fontWeight: 700,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              position: "relative", zIndex: 3 - wi, flexShrink: 0,
                            }}>{initials(w.name)}</div>
                          ))}
                          {row.workers.length > 3 && (
                            <div style={{
                              width: 20, height: 20, borderRadius: "50%",
                              marginLeft: -6, border: "1.5px solid white",
                              background: "#e0e7ff", color: "#4338ca",
                              fontSize: 8, fontWeight: 700,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              position: "relative", zIndex: 0, flexShrink: 0,
                            }}>+{row.workers.length - 3}</div>
                          )}
                        </div>
                        {/* Name + assist count — two lines */}
                        <div className="flex flex-col min-w-0">
                          <span className="text-[10px] text-slate-700 font-medium truncate leading-tight">
                            {mainWorker ? (() => {
                              const parts = mainWorker.name.trim().split(/\s+/);
                              return parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0];
                            })() : ""}
                          </span>
                          {assistWorkers.length > 0 && (
                            <span className="leading-tight" style={{ fontSize: 10, color: "#6b8a70", fontWeight: 600 }}>
                              + {assistWorkers.length} assist
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Col 3: Status */}
                  <div className="px-2 border-r border-slate-100" onClick={e => e.stopPropagation()}>
                    <div className="relative">
                      <span className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full z-10 pointer-events-none ${cfg.dot}`} />
                      <Select value={row.status} onValueChange={v => setTasks(tasks.map(r => r.id === row.id ? { ...r, status: v } : r))}>
                        <SelectTrigger data-testid={`select-task-status-${i}`} className={`h-8 text-xs pl-6 ${cfg.text} w-full`} style={{ minWidth: 120, whiteSpace: "nowrap" }}>
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
                  </div>

                  {/* Col 4: Chevron + delete */}
                  <div className="flex items-center justify-center gap-1 pl-1 overflow-hidden">
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${row.expanded ? "rotate-180" : ""}`} />
                    <button type="button" data-testid={`btn-remove-task-${i}`}
                      onClick={e => { e.stopPropagation(); setDeleteConfirm(row.id); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* ── Delete confirm bar ── */}
                {deleteConfirm === row.id && (
                  <div style={{ background: "#fee2e2", borderTop: "1px solid #fecaca", padding: "8px 14px", display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: "#dc2626" }}
                    onClick={e => e.stopPropagation()}>
                    <span style={{ flex: 1 }}>Delete this task?</span>
                    <button type="button"
                      onClick={() => setDeleteConfirm(null)}
                      className="px-2.5 py-1 text-slate-600 border border-slate-200 rounded text-[11px] bg-white hover:bg-slate-50 transition-colors">
                      Cancel
                    </button>
                    <button type="button"
                      onClick={() => handleDeleteTask(row, i)}
                      className="px-2.5 py-1 text-white rounded text-[11px] hover:bg-red-700 transition-colors"
                      style={{ background: "#dc2626" }}>
                      Delete
                    </button>
                  </div>
                )}

                {/* ── Detail panel ── */}
                {row.expanded && (
                  <div style={{ background: "#f8faf9", borderTop: "1px solid #e2e8e4", padding: 16, borderBottomLeftRadius: 10, borderBottomRightRadius: 10 }}>
                    <div className="grid grid-cols-3 gap-5">

                      {/* Col A: Worker Assignment */}
                      <div>
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Worker Assignment</p>

                        {/* Assigned list */}
                        {row.workers.length > 0 && (
                          <div className="space-y-1 mb-2">
                            {row.workers.map((w, wi) => (
                              <div key={wi} className={`flex items-center gap-2 px-2 py-1.5 rounded-md ${w.role === "main" ? "bg-green-50" : "bg-white border border-slate-100"}`}>
                                <div style={{
                                  width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                                  background: w.role === "main" ? "#dcfce7" : "#dbeafe",
                                  color: w.role === "main" ? "#16a34a" : "#1d6ecc",
                                  border: `1.5px solid ${w.role === "main" ? "#86efac" : "#93c5fd"}`,
                                  fontSize: 9, fontWeight: 700,
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                }}>{initials(w.name)}</div>
                                <span className="text-[11px] text-slate-700 flex-1 min-w-0 truncate">{w.name}</span>
                                {tradeBadge(w.trade)}
                                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
                                  w.role === "main" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                                }`}>{w.role === "main" ? "Main" : "Assist"}</span>
                                <button type="button"
                                  onClick={() => setTasks(tasks.map(r => r.id === row.id
                                    ? { ...r, workers: r.workers.filter((_, idx) => idx !== wi) } : r))}
                                  className="text-slate-200 hover:text-red-400 transition-colors shrink-0">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Assign dropdown */}
                        {manpower.length === 0 ? (
                          <button type="button" disabled
                            title="Add workers in the Manpower section first"
                            className="w-full text-left text-[11px] text-slate-300 border border-dashed border-slate-200 rounded-md px-3 py-2 cursor-not-allowed">
                            + Assign worker from Manpower
                          </button>
                        ) : (
                          <div className="relative">
                            <button type="button"
                              onClick={e => { e.stopPropagation(); setAssignOpen(assignOpen === row.id ? null : row.id); }}
                              className="w-full text-left text-[11px] text-blue-600 border border-dashed border-blue-200 rounded-md px-3 py-2 hover:bg-blue-50 transition-colors">
                              + Assign worker from Manpower
                            </button>
                            {assignOpen === row.id && (
                              <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[200px]">
                                {manpower
                                  .filter(mp => mp.workerName && !row.workers.some(w => w.name === mp.workerName))
                                  .map(mp => (
                                    <button key={mp.id} type="button"
                                      className="w-full text-left px-3 py-1.5 text-[11px] text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                      onClick={e => {
                                        e.stopPropagation();
                                        const isFirst = row.workers.length === 0;
                                        setTasks(tasks.map(r => r.id === row.id
                                          ? { ...r, workers: [...r.workers, { name: mp.workerName, role: isFirst ? "main" : "assist", trade: mp.trade || undefined }] }
                                          : r));
                                        setAssignOpen(null);
                                      }}>
                                      <div style={{
                                        width: 18, height: 18, borderRadius: "50%",
                                        background: "#dbeafe", color: "#1d6ecc",
                                        fontSize: 8, fontWeight: 700,
                                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                                      }}>{initials(mp.workerName)}</div>
                                      <span className="flex-1 truncate">{mp.workerName}</span>
                                      {tradeBadge(mp.trade)}
                                      {row.workers.length === 0
                                        ? <span className="text-[9px] text-green-600 shrink-0">→ Main</span>
                                        : <span className="text-[9px] text-slate-400 shrink-0">Assist</span>}
                                    </button>
                                  ))}
                                {manpower.filter(mp => mp.workerName && !row.workers.some(w => w.name === mp.workerName)).length === 0 && (
                                  <p className="px-3 py-2 text-[11px] text-slate-400 italic">All workers assigned</p>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Col B: Drawing Reference + Site Photos */}
                      <div>
                        {/* Drawing Reference */}
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Drawing Reference</p>
                        {row.linkedPinId ? (
                          <div
                            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "#ede9fe", border: "1px solid #c4b5fd", borderRadius: 6, marginBottom: 10, cursor: "pointer" }}
                            onClick={() => { setDrawingCollapsed(false); setSelectedPinId(row.linkedPinId); }}>
                            <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#7c3aed", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, flexShrink: 0 }}>
                              {row.linkedPinId}
                            </div>
                            <div>
                              <p style={{ fontSize: 11, fontWeight: 600, color: "#4338ca", lineHeight: 1.3 }}>
                                Pin {row.linkedPinId} — {row.area || "Drawing area"}
                              </p>
                              <p style={{ fontSize: 9.5, color: "#7c3aed", lineHeight: 1.3 }}>Click to jump to this area on drawing ↑</p>
                            </div>
                          </div>
                        ) : (
                          <div style={{ marginBottom: 10 }}>
                            <p style={{ fontSize: 10.5, color: "#9db8a2" }}>No drawing area linked</p>
                            <button type="button"
                              style={{ fontSize: 10.5, color: "#7c3aed", background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: 3 }}
                              onClick={() => setTaskPinOpen(taskPinOpen === row.id ? null : row.id)}>
                              Link to a pin on the drawing above
                            </button>
                          </div>
                        )}

                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">
                          Site Photos {row.photoFiles.length > 0 && <span className="text-blue-600 normal-case">({row.photoFiles.length})</span>}
                        </p>
                        <button type="button"
                          onClick={() => toast({ title: "Photo upload", description: "Photo attachment is coming in the next update." })}
                          className="w-full h-[72px] border-2 border-dashed border-slate-200 rounded-lg text-xs text-slate-400 hover:border-slate-300 hover:text-slate-500 transition-colors flex flex-col items-center justify-center gap-1">
                          <Camera className="w-4 h-4" />
                          <span>JPG, PNG, HEIC</span>
                        </button>
                      </div>

                      {/* Col C: Notes */}
                      <div>
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Notes</p>
                        <Textarea value={row.detailNotes}
                          onChange={e => setTasks(tasks.map(r => r.id === row.id ? { ...r, detailNotes: e.target.value } : r))}
                          placeholder="Issues encountered, corrective actions..."
                          className="text-xs min-h-[72px] resize-y bg-white" />
                      </div>

                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <AddRow testId="btn-add-task" label="Add Task"
          onClick={() => setTasks([...tasks, {
            id: uid(), description: "", area: "", status: "in-progress", notes: "",
            expanded: false, detailNotes: "", drawingFiles: [], photoFiles: [], workers: [], linkedPinId: null,
          }])} />

        {/* ── Undo toast ── */}
        {undoState && (
          <div style={{
            position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
            background: "#1f2937", color: "white", borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.2)", zIndex: 9999,
            minWidth: 240, overflow: "hidden",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "10px 18px" }}>
              <span style={{ flex: 1, fontSize: 11.5 }}>Task deleted</span>
              <button type="button" onClick={handleUndo}
                style={{ color: "#86efac", fontWeight: 700, fontSize: 11.5, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                Undo
              </button>
            </div>
            <div style={{ height: 3, background: "#374151" }}>
              <div style={{ height: "100%", background: "#86efac", width: `${undoState.progress}%`, transition: "width 0.1s linear" }} />
            </div>
          </div>
        )}
      </Section>

      {/* ══════════════════════════════════════════════════════
          §4 — Materials
      ══════════════════════════════════════════════════════ */}
      <Section num={4} title="Materials" icon={<Package className="w-4 h-4" />} summary={matSummary} defaultOpen={false}>
        <div>
        <table className="text-sm w-full" data-testid="table-materials">
          <TH cols={[
            { label: "Material / Inventory Item", cls: "w-[300px]" },
            { label: "Unit",     cls: "w-[64px] text-center" },
            { label: "Qty Used", cls: "w-[72px] text-center" },
            { label: "Notes",    cls: "w-[120px]" },
            ...(scopeItems.length > 0 ? [{ label: "Scope Link", cls: "w-[150px]" }] : []),
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
                    className="h-8 text-xs text-center tabular-nums w-[64px]" />
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

        </div>
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

        <div className="overflow-x-auto">
        <table className="text-sm w-full" data-testid="table-equipment">
          <TH cols={[
            { label: "Equipment Name", cls: "w-[200px]" },
            { label: "Unit",           cls: "w-[60px] text-center" },
            { label: "Qty",            cls: "w-[60px] text-center" },
            { label: "Hours Used",     cls: "w-[80px] text-center" },
            { label: "Notes",          cls: "w-[120px]" },
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
                    className="h-8 text-xs text-center w-[52px]" placeholder="EA" />
                </td>
                <td className="py-1.5 px-2.5">
                  <Input data-testid={`input-eq-qty-${i}`} type="number" min={0} value={row.qty}
                    onChange={(e) => setEquipment(equipment.map((r) => r.id === row.id ? { ...r, qty: Number(e.target.value) } : r))}
                    className="h-8 text-xs text-center tabular-nums w-[52px]" />
                </td>
                <td className="py-1.5 px-2.5">
                  <Input data-testid={`input-eq-hours-${i}`} type="number" min={0} step={0.5} value={row.hours}
                    onChange={(e) => setEquipment(equipment.map((r) => r.id === row.id ? { ...r, hours: Number(e.target.value) } : r))}
                    className="h-8 text-xs text-center tabular-nums w-[72px]" />
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

        </div>
        <AddRow testId="btn-add-equipment" label="Add Custom"
          onClick={() => setEquipment([...equipment, { id: uid(), name: "", unit: "EA", qty: 1, hours: 0, notes: "" }])} />
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
              className={`gap-2 h-9 ${
                isSubmitted
                  ? "bg-emerald-600 hover:bg-emerald-600 text-white font-semibold"
                  : canSubmit
                  ? "bg-[#16a34a] hover:bg-[#15803d] text-white font-bold border border-[#16a34a]"
                  : "bg-[#f3f4f6] border border-[#e5e7eb] text-[#9ca3af] font-semibold opacity-60 cursor-not-allowed"
              }`}
              disabled={saveMutation.isPending || isSubmitted || !canSubmit}
              onClick={() => saveMutation.mutate("submitted")}>
              {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isSubmitted ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
              {isSubmitted ? "Submitted" : "Submit Report"}
            </Button>
            {isManagerOrAbove && reportId && (
              <Button data-testid="btn-delete-report-bottom"
                variant="outline" size="sm"
                className="gap-2 h-9 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                disabled={deleteMutation.isPending}
                onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 className="w-3.5 h-3.5" />
                Delete Report
              </Button>
            )}
          </div>
          {submitHelper && (
            <span className="text-[11px] text-slate-400 italic">{submitHelper}</span>
          )}
        </div>
      </div>

    </div>
  );
}
