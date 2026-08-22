import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Users, CheckCircle2, MapPin, Loader2, GripVertical,
  Search, SlidersHorizontal, X, HardHat, ShieldCheck, Wrench, AlertCircle,
} from "lucide-react";
import {
  DndContext, type DragEndEvent, type DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCenter, pointerWithin,
  DragOverlay, useDraggable, useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, arrayMove, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import type { Worker, Project } from "@shared/schema";

// ─── Types ────────────────────────────────────────────────────────────────────
interface JibbleEntry { firstIn: string; lastOut?: string }
interface JibbleActive { entry: JibbleEntry; worker: { id: number } | null }
interface Assignment { workerId: number; projectId: number | null; date: string }
interface KoreanAttendanceRow { workerId: number; date: string; present: boolean }
interface UndoState {
  workerId: number;
  prevProjectId: number;
  workerName: string;
  projectName: string;
  timerId: ReturnType<typeof setTimeout>;
}
interface AssignPayload {
  workerId: number;
  projectId: number | null;
  /** ISO date string captured at call time — used to detect stale-date callbacks. */
  date: string;
  /** Monotonic ID that uniquely identifies this write attempt. */
  opId: string;
}
interface AttendancePayload {
  workerId: number;
  present: boolean;
  /** ISO date string captured at call time. */
  date: string;
  /** Monotonic ID that uniquely identifies this write attempt. */
  opId: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function toLocalDateStr(d: Date): string {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, "0");
  const dy = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dy}`;
}
function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric", weekday: "short",
  });
}
function fmtTime(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
}

// ─── Project status helpers ───────────────────────────────────────────────────
function groupPriority(p: Project): number {
  const g = (p.mondayGroupTitle ?? "").toLowerCase();
  const s = (p.status ?? "").toLowerCase();
  // Check explicit "done" status FIRST — takes priority over group name.
  // This handles the common Monday pattern where the status column is updated
  // to "Done" but the item hasn't been moved to the Done group yet.
  if (
    ["completed", "cancelled", "canceled", "done"].includes(s) ||
    p.archived ||
    g.includes("done") || g.includes("complete") || g.includes("finish")
  ) return 3;
  if (g.includes("working on it") || g.includes("working")) return 0;
  if (g.includes("start soon") || g.includes("soon"))        return 1;
  return 2;
}

function statusLabel(p: Project): string {
  if (p.mondayGroupTitle) return p.mondayGroupTitle;
  const s = (p.status ?? "").toLowerCase();
  if (s === "active")                        return "진행 중";
  if (s === "on_hold")                       return "보류";
  if (s === "completed")                     return "완료";
  if (s === "cancelled" || s === "canceled") return "취소";
  return p.status ?? "";
}

// Monday.com status label → official Monday colour palette
// Colors verified against the Monday.com status column UI.
const MONDAY_STATUS_COLORS: Record<string, string> = {
  // Monday standard labels
  "working on it": "#fdab3d",
  "stuck":         "#e2445c",
  "done":          "#00c875",
  "quote only":    "#c4c4c4",
  "start soon":    "#579bfc",
  "not started":   "#c4c4c4",
  "in progress":   "#0086c0",
  "waiting":       "#ffcb00",
  "on hold":       "#c4c4c4",
  // Variants
  "cancelled":     "#808080",
  "canceled":      "#808080",
  "completed":     "#00c875",
  // Legacy VoltStock enum values (stored before raw-label sync)
  "active":        "#fdab3d",   // was "Working on it"
  "on_hold":       "#c4c4c4",   // was "Quote Only" / hold states
};

// Old VoltStock enum → Monday display label
const ENUM_TO_MONDAY_LABEL: Record<string, string> = {
  "active":    "Working on it",
  "on_hold":   "On Hold",
  "completed": "Done",
  "cancelled": "Cancelled",
  "canceled":  "Cancelled",
};

function statusColors(p: Project): { bg: string; text: string } {
  const raw = (p.status ?? "").trim();
  const key = raw.toLowerCase();
  const bg  = MONDAY_STATUS_COLORS[key];
  if (bg) {
    // Use dark text on light colours (grey, yellow)
    const light = ["#c4c4c4", "#ffcb00"].includes(bg);
    return { bg, text: light ? "#333333" : "#ffffff" };
  }
  // Fallback for any unmapped label
  const pri = groupPriority(p);
  if (pri === 3) return { bg: "#c4c4c4", text: "#333333" };
  return { bg: "#fdab3d", text: "#ffffff" };
}

/** Monday status label shown on cards — translates legacy enum values */
function cardStatusLabel(p: Project): string {
  const raw = p.status?.trim() || "";
  return ENUM_TO_MONDAY_LABEL[raw.toLowerCase()] ?? (raw || "—");
}

/** Returns true for Korean-nationality workers — always treated as on-site */
function isKorean(w: Worker): boolean {
  const n = (w.nationality ?? "").toLowerCase();
  return n.includes("korea") || n === "kr";
}

/** Role category used for sort ordering and visual styling.
 *  General Manager / Manager are excluded from field-trade badges. */
function tradeCategory(w: Worker): "foreman" | "helper" | "safety" | "management" {
  const t = (w.trade ?? "").toLowerCase().trim();
  if (t === "general manager" || t === "manager") return "management";
  if (t === "safety")                             return "safety";
  if (t === "foreman")                            return "foreman";
  return "helper";
}

/** Sort rank inside a project card: Management/Foreman 0 → Helper 1 → Safety 2 */
function projectWorkerRank(w: Worker): number {
  const cat = tradeCategory(w);
  if (cat === "management" || cat === "foreman") return 0;
  if (cat === "safety")                          return 2;
  return 1;
}

/** Visual role chip config — returns null for management (no badge) */
function tradeInfo(w: Worker): {
  Icon: React.ElementType;
  bg: string;
  text: string;
  label: string;
} | null {
  const cat = tradeCategory(w);
  if (cat === "management") return null;
  if (cat === "foreman")    return { Icon: HardHat,    bg: "#fef3c7", text: "#92400e", label: "Foreman" };
  if (cat === "safety")     return { Icon: ShieldCheck, bg: "#d1fae5", text: "#065f46", label: "Safety"  };
  return                           { Icon: Wrench,      bg: "#dbeafe", text: "#1e40af", label: "Helper"  };
}

/** General Manager → Manager → 나머지 순 (left-panel sort only) */
function managerRank(w: Worker): number {
  const t = (w.trade ?? "").toLowerCase().trim();
  if (t === "general manager") return 0;
  if (t === "manager")         return 1;
  return 2;
}

function sortProjects(list: Project[]): Project[] {
  return [...list].sort((a, b) => {
    const diff = groupPriority(a) - groupPriority(b);
    return diff !== 0 ? diff : a.name.localeCompare(b.name);
  });
}

function workerOnSiteScore(
  w: Worker,
  jibbleMap: Map<number, JibbleEntry>,
  koreanPresentFn: (id: number) => boolean = () => true,
): number {
  if (isKorean(w)) return koreanPresentFn(w.id) ? 2 : 0;
  const j = jibbleMap.get(w.id);
  return j && !j.lastOut ? 2 : j ? 1 : 0;
}

function sortWorkers(
  list: Worker[],
  jibbleMap: Map<number, JibbleEntry>,
  koreanPresentFn: (id: number) => boolean = () => true,
): Worker[] {
  return [...list].filter((w) => w.isActive).sort((a, b) => {
    const ra = managerRank(a), rb = managerRank(b);
    if (ra !== rb) return ra - rb;
    const scoreA = workerOnSiteScore(a, jibbleMap, koreanPresentFn);
    const scoreB = workerOnSiteScore(b, jibbleMap, koreanPresentFn);
    if (scoreA !== scoreB) return scoreB - scoreA;
    return a.fullName.localeCompare(b.fullName);
  });
}

// ─── localStorage helpers ─────────────────────────────────────────────────────
const LS_GROUP_ORDER    = "voltstock_cd_group_order_v1";
const LS_COLLAPSED      = "voltstock_cd_group_collapsed_v1";
const LS_WORKER_FILTER  = "voltstock_cd_worker_filter_v1";
const LS_FILTER_STATUSES = "voltstock_cd_filter_statuses_v1";

function loadGroupOrder(): string[] {
  try { const s = localStorage.getItem(LS_GROUP_ORDER); if (s) return JSON.parse(s) as string[]; } catch {}
  return [];
}
function saveGroupOrder(order: string[]) {
  try { localStorage.setItem(LS_GROUP_ORDER, JSON.stringify(order)); } catch {}
}
function loadCollapsedGroups(): Set<string> {
  try { const s = localStorage.getItem(LS_COLLAPSED); if (s) return new Set(JSON.parse(s) as string[]); } catch {}
  return new Set();
}
function saveCollapsedGroups(s: Set<string>) {
  try { localStorage.setItem(LS_COLLAPSED, JSON.stringify(Array.from(s))); } catch {}
}
function loadWorkerFilter(): "all" | "onsite" | "unassigned" {
  try {
    const s = localStorage.getItem(LS_WORKER_FILTER);
    if (s === "all" || s === "onsite" || s === "unassigned") return s;
  } catch {}
  return "all";
}
function loadFilterStatuses(): Set<string> {
  try { const s = localStorage.getItem(LS_FILTER_STATUSES); if (s) return new Set(JSON.parse(s) as string[]); } catch {}
  return new Set();
}

// ─── Shared types ─────────────────────────────────────────────────────────────
interface CustomerGroup { customer: string; projects: Project[] }

// ─── Avatar ───────────────────────────────────────────────────────────────────
function WorkerAvatar({ photoUrl, name, small }: { photoUrl?: string | null; name: string; small?: boolean }) {
  const initials = name.trim().split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  const cls = small ? "w-8 h-8" : "w-10 h-10";
  if (photoUrl) return (
    <img src={photoUrl} alt={name} className={`${cls} rounded-full object-cover shrink-0 border border-slate-200`} />
  );
  return (
    <div className={`${cls} rounded-full shrink-0 bg-slate-100 border border-slate-200 flex items-center justify-center`}>
      <span className={`${small ? "text-[9px]" : "text-xs"} font-semibold text-slate-500`}>{initials || "?"}</span>
    </div>
  );
}

// ─── WorkerRow (small-screen dropdown fallback) ───────────────────────────────
function WorkerRow({ worker, jibble, assignedProjectId, activeByCustomer, doneProjects, onAssign, koreanPresent, onAttendanceToggle }: {
  worker: Worker;
  jibble?: JibbleEntry;
  assignedProjectId: number | null;
  activeByCustomer: CustomerGroup[];
  doneProjects: Project[];
  onAssign: (projectId: number | null) => void;
  /** Only provided for Korean workers */
  koreanPresent?: boolean;
  onAttendanceToggle?: (present: boolean) => void;
}) {
  const { t } = useLanguage();
  const [showCompleted, setShowCompleted] = useState(false);
  const korean    = isKorean(worker);
  const isOnSite  = korean ? (koreanPresent !== false) : (!!jibble && !jibble.lastOut);
  const checkedIn = !!jibble;
  const assignedDoneProject = doneProjects.find((p) => p.id === assignedProjectId);

  function handleValueChange(v: string) {
    if (v === "__show_completed__") { setShowCompleted((s) => !s); return; }
    onAssign(v === "__none__" ? null : parseInt(v, 10));
  }

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <WorkerAvatar photoUrl={worker.photoUrl} name={worker.fullName} />
            <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
              isOnSite ? "bg-emerald-500" : checkedIn ? "bg-amber-400" : "bg-slate-300"
            }`} title={isOnSite ? t.cdStatusOnSite : checkedIn ? t.cdStatusCheckedOut : t.cdStatusAbsent} />
          </div>
          <div>
            <p className="font-medium text-slate-800 text-sm leading-tight">{worker.fullName}</p>
            {worker.trade && <p className="text-xs text-slate-400 leading-tight">{worker.trade}</p>}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 tabular-nums whitespace-nowrap">
        {korean && onAttendanceToggle ? (
          <label className="flex items-center gap-1.5 cursor-pointer select-none" onClick={e => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={koreanPresent !== false}
              onChange={e => onAttendanceToggle(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
            <span className={`text-xs font-medium ${koreanPresent !== false ? "text-emerald-600" : "text-slate-400"}`}>
              {koreanPresent !== false ? t.cdAttPresent : t.cdAttAbsent}
            </span>
          </label>
        ) : checkedIn ? (
          <span className="text-sm text-emerald-600 font-semibold">{fmtTime(jibble!.firstIn)}</span>
        ) : (
          <span className="text-sm text-slate-300">—</span>
        )}
      </td>
      <td className="px-4 py-3 tabular-nums whitespace-nowrap">
        {korean ? null : jibble?.lastOut
          ? <span className="text-sm text-slate-500 font-semibold">{fmtTime(jibble.lastOut)}</span>
          : isOnSite
            ? <span className="text-xs text-emerald-500 font-medium">{t.cdWorkingNow}</span>
            : <span className="text-sm text-slate-300">—</span>}
      </td>
      <td className="px-4 py-3">
        <Select value={assignedProjectId !== null ? String(assignedProjectId) : "__none__"} onValueChange={handleValueChange}>
          <SelectTrigger className={`h-8 text-sm max-w-[280px] ${
            assignedProjectId !== null ? "border-amber-300 bg-amber-50 text-amber-800" : "border-slate-200 text-slate-400"
          }`}>
            <SelectValue placeholder={t.cdUnassigned} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__"><span className="text-slate-400">— {t.cdUnassigned}</span></SelectItem>
            {activeByCustomer.map(({ customer, projects }) => (
              <SelectGroup key={customer}>
                <SelectLabel className="text-[10px] text-slate-500 font-bold uppercase tracking-wider px-2 py-1 bg-slate-50">{customer === "고객사 미지정" ? t.cdNoCustomer : customer}</SelectLabel>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    <div className="flex items-center gap-2">
                      {p.poNumber && <span className="text-xs font-mono text-slate-400 shrink-0">{p.poNumber}</span>}
                      <span>{p.name}</span>
                      {p.jobLocation && (
                        <span className="flex items-center gap-0.5 text-xs text-slate-400 shrink-0">
                          <MapPin className="w-2.5 h-2.5" />{p.jobLocation}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
            {doneProjects.length > 0 && (
              <>
                <SelectSeparator />
                {assignedDoneProject && !showCompleted && (
                  <SelectItem key={assignedDoneProject.id} value={String(assignedDoneProject.id)}>
                    <div className="flex items-center gap-2 opacity-60">
                      {assignedDoneProject.poNumber && <span className="text-xs font-mono text-slate-400 shrink-0">{assignedDoneProject.poNumber}</span>}
                      <span>{assignedDoneProject.name}</span>
                    </div>
                  </SelectItem>
                )}
                {showCompleted && doneProjects.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    <div className="flex items-center gap-2 opacity-60">
                      {p.poNumber && <span className="text-xs font-mono text-slate-400 shrink-0">{p.poNumber}</span>}
                      <span>{p.name}</span>
                    </div>
                  </SelectItem>
                ))}
                <SelectItem value="__show_completed__" className="text-slate-400 italic text-xs">
                  {showCompleted ? t.cdCollapseCompleted : t.cdExpandCompleted.replace("{n}", String(doneProjects.length))}
                </SelectItem>
              </>
            )}
          </SelectContent>
        </Select>
      </td>
    </tr>
  );
}


// ─── Compact worker item (mobile narrow-column) ───────────────────────────────
function CompactWorkerItem({ worker, jibble, assignedProjectId, activeByCustomer, doneProjects, onAssign, koreanPresent, onAttendanceToggle }: {
  worker: Worker;
  jibble?: JibbleEntry;
  assignedProjectId: number | null;
  activeByCustomer: CustomerGroup[];
  doneProjects: Project[];
  onAssign: (projectId: number | null) => void;
  koreanPresent?: boolean;
  onAttendanceToggle?: (present: boolean) => void;
}) {
  const { t } = useLanguage();
  const [showCompleted, setShowCompleted] = useState(false);
  const korean    = isKorean(worker);
  const isOnSite  = korean ? (koreanPresent !== false) : (!!jibble && !jibble.lastOut);
  const checkedIn = !!jibble;
  const assignedDoneProject = doneProjects.find((p) => p.id === assignedProjectId);

  function handleValueChange(v: string) {
    if (v === "__show_completed__") { setShowCompleted((s) => !s); return; }
    onAssign(v === "__none__" ? null : parseInt(v, 10));
  }

  return (
    <div className="px-2 py-2 border-b border-slate-100 last:border-0">
      {/* Name + status dot */}
      <div className="flex items-center gap-1.5 mb-1.5 min-w-0">
        <span className={`w-2 h-2 rounded-full shrink-0 ${
          isOnSite ? "bg-emerald-500" : checkedIn ? "bg-amber-400" : "bg-slate-300"
        }`} />
        <span className="text-[11px] font-semibold text-slate-800 leading-tight truncate">{worker.fullName}</span>
      </div>
      {/* Korean attendance */}
      {korean && onAttendanceToggle && (
        <label className="flex items-center gap-1 mb-1.5 cursor-pointer select-none" onClick={e => e.stopPropagation()}>
          <input type="checkbox" checked={koreanPresent !== false}
            onChange={e => onAttendanceToggle(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer" />
          <span className={`text-[10px] font-medium ${koreanPresent !== false ? "text-emerald-600" : "text-slate-400"}`}>
            {koreanPresent !== false ? t.cdAttPresent : t.cdAttAbsent}
          </span>
        </label>
      )}
      {/* Project select */}
      <Select value={assignedProjectId !== null ? String(assignedProjectId) : "__none__"} onValueChange={handleValueChange}>
        <SelectTrigger className={`h-7 text-[11px] w-full ${
          assignedProjectId !== null ? "border-amber-300 bg-amber-50 text-amber-800" : "border-slate-200 text-slate-400"
        }`}>
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__"><span className="text-slate-400">— {t.cdUnassigned}</span></SelectItem>
          {activeByCustomer.map(({ customer, projects }) => (
            <SelectGroup key={customer}>
              <SelectLabel className="text-[10px] text-slate-500 font-bold uppercase tracking-wider px-2 py-1 bg-slate-50">
                {customer === "고객사 미지정" ? t.cdNoCustomer : customer}
              </SelectLabel>
              {projects.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  <div className="flex items-center gap-1.5">
                    {p.poNumber && <span className="text-xs font-mono text-slate-400 shrink-0">{p.poNumber}</span>}
                    <span>{p.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
          {doneProjects.length > 0 && (
            <>
              <SelectSeparator />
              {assignedDoneProject && !showCompleted && (
                <SelectItem value={String(assignedDoneProject.id)}>
                  <div className="flex items-center gap-1.5 opacity-60">
                    {assignedDoneProject.poNumber && <span className="text-xs font-mono text-slate-400 shrink-0">{assignedDoneProject.poNumber}</span>}
                    <span>{assignedDoneProject.name}</span>
                  </div>
                </SelectItem>
              )}
              {showCompleted && doneProjects.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  <div className="flex items-center gap-1.5 opacity-60">
                    {p.poNumber && <span className="text-xs font-mono text-slate-400 shrink-0">{p.poNumber}</span>}
                    <span>{p.name}</span>
                  </div>
                </SelectItem>
              ))}
              <SelectItem value="__show_completed__" className="text-slate-400 italic text-xs">
                {showCompleted ? t.cdCollapseCompleted : t.cdExpandCompleted.replace("{n}", String(doneProjects.length))}
              </SelectItem>
            </>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

// ─── Group accent color ───────────────────────────────────────────────────────
const GROUP_PALETTE = [
  "#0073EA","#00C875","#A25DDC","#FDBC64","#FF7575",
  "#579BFC","#9CD326","#FF9F43","#FF3D57","#7E5CB5",
];
function groupAccentColor(name: string): string {
  if (!name || name === "고객사 미지정") return "#C4C4C4";
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h * 31) + name.charCodeAt(i)) | 0;
  return GROUP_PALETTE[Math.abs(h) % GROUP_PALETTE.length];
}

// ─── Dynamic status options from project list ────────────────────────────────
/** Build sorted, deduplicated list of Monday status labels from the project list. */
function buildStatusOptions(projects: Project[]): { label: string; bg: string; text: string }[] {
  const seen = new Set<string>();
  const out: { label: string; pri: number; bg: string; text: string }[] = [];
  for (const p of projects) {
    const label = p.status?.trim();
    if (!label || seen.has(label)) continue;
    seen.add(label);
    const sc = statusColors(p);
    out.push({ label, pri: groupPriority(p), bg: sc.bg, text: sc.text });
  }
  return out.sort((a, b) => a.pri - b.pri || a.label.localeCompare(b.label));
}

// ─── Sortable group wrapper ───────────────────────────────────────────────────
function SortableGroup({ id, children }: {
  id: string;
  children: (handleProps: { attributes: any; listeners: any }) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 50 : undefined, position: "relative" }}>
      {children({ attributes, listeners })}
    </div>
  );
}

// ─── Draggable compact worker row (split-pane left panel) ─────────────────────
function TradeBadge({ worker, small }: { worker: Worker; small?: boolean }) {
  const { t } = useLanguage();
  const info = tradeInfo(worker);
  if (!info) return null;
  const { Icon, bg, text, label } = info;
  const displayLabel = label === "Foreman" ? t.cdTradeForeman : label === "Safety" ? t.cdTradeSafety : t.cdTradeHelper;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded font-bold leading-none shrink-0 ${small ? "px-1 py-0.5 text-[9px]" : "px-1.5 py-0.5 text-[10px]"}`}
      style={{ backgroundColor: bg, color: text }}
    >
      <Icon className={small ? "w-2.5 h-2.5" : "w-3 h-3"} />
      {displayLabel}
    </span>
  );
}

function DraggableWorkerRow({ worker, jibble, assignedProject, onUnassign, koreanPresent, onAttendanceToggle }: {
  worker: Worker;
  jibble?: JibbleEntry;
  assignedProject?: Project | null;
  onUnassign?: () => void;
  /** Only provided for Korean workers */
  koreanPresent?: boolean;
  onAttendanceToggle?: (present: boolean) => void;
}) {
  const { t } = useLanguage();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `worker-${worker.id}` });
  const korean    = isKorean(worker);
  const isOnSite  = korean ? (koreanPresent !== false) : (!!jibble && !jibble.lastOut);
  const checkedIn = !!jibble;
  return (
    <div
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0.35 : 1 }}
      className={`flex items-center gap-1.5 px-2 py-2 rounded-lg border transition-all select-none ${
        assignedProject
          ? "border-amber-300 bg-amber-50 hover:border-amber-400 hover:shadow-sm"
          : "border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm"
      }`}
    >
      {/* An explicit handle keeps vertical swipes on the compact mobile list from
          starting a drag. The row remains draggable through this handle at every size. */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="w-4 h-8 flex items-center justify-center shrink-0 rounded text-slate-300 hover:text-blue-500 hover:bg-blue-50 cursor-grab active:cursor-grabbing touch-none"
        aria-label={`${worker.fullName} ${t.cdPanelDragHint}`}
        title={t.cdPanelDragHint}
        data-testid={`worker-drag-handle-${worker.id}`}
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>
      <div className="flex items-center gap-1.5 lg:gap-2.5 flex-1 min-w-0">
        <div className="relative shrink-0">
          <WorkerAvatar photoUrl={worker.photoUrl} name={worker.fullName} small />
          <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
            isOnSite ? "bg-emerald-500" : checkedIn ? "bg-amber-400" : "bg-slate-300"
          }`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] lg:text-[13px] font-semibold text-slate-800 leading-tight truncate">{worker.fullName}</p>
          <span className="hidden lg:block"><TradeBadge worker={worker} small /></span>
        </div>
      </div>
      {/* Korean attendance toggle — hidden on narrow mobile column */}
      {korean && onAttendanceToggle && (
        <label
          className="hidden lg:flex items-center gap-1 shrink-0 cursor-pointer select-none"
          title={koreanPresent !== false ? t.cdAttPresentTitle : t.cdAttAbsentTitle}
          onClick={e => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={koreanPresent !== false}
            onChange={e => onAttendanceToggle(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
          />
          <span className={`text-[10px] font-semibold ${koreanPresent !== false ? "text-emerald-600" : "text-slate-400"}`}>
            {koreanPresent !== false ? t.cdAttPresent : t.cdAttAbsent}
          </span>
        </label>
      )}
      {/* Right: unassign X (always) + project name text (lg+ only) */}
      {assignedProject ? (
        <div className="flex items-center gap-1 shrink-0">
          <span className="hidden lg:inline text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 max-w-[80px] truncate leading-tight">
            {assignedProject.name}
          </span>
          {onUnassign && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onUnassign(); }}
              className="w-5 h-5 flex items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
              title={t.cdUnassignBtn}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      ) : (
        <span className="hidden lg:inline text-[10px] text-slate-300 shrink-0">{t.cdUnassigned}</span>
      )}
    </div>
  );
}

// ─── Droppable project card wrapper ──────────────────────────────────────────
function DroppableProjectCard({ projectId, children }: {
  projectId: number;
  children: (isOver: boolean) => React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `project-${projectId}` });
  return <div ref={setNodeRef}>{children(isOver)}</div>;
}

// ─── Worker drag overlay (shown during drag) ──────────────────────────────────
function WorkerDragOverlay({ worker, jibble }: { worker: Worker; jibble?: JibbleEntry }) {
  const { t } = useLanguage();
  const isOnSite  = !!jibble && !jibble.lastOut;
  const checkedIn = !!jibble;
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border-2 border-blue-400 bg-white shadow-2xl w-[220px]">
      <div className="relative shrink-0">
        <WorkerAvatar photoUrl={worker.photoUrl} name={worker.fullName} small />
        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
          isOnSite ? "bg-emerald-500" : checkedIn ? "bg-amber-400" : "bg-slate-300"
        }`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-slate-800 leading-tight truncate">{worker.fullName}</p>
        <p className="text-[11px] text-blue-500 leading-tight">{t.cdDropHint}</p>
      </div>
    </div>
  );
}

// ─── API helpers ──────────────────────────────────────────────────────────────
async function fetchLayoutPrefs(): Promise<{ groupOrder: string[] | null; collapsedGroups: string[] | null }> {
  const res = await fetch("/api/crew-dispatch/layout-prefs");
  if (!res.ok) throw new Error("Failed to load layout prefs");
  return res.json();
}

// ─── ProjectCardView ──────────────────────────────────────────────────────────
// NOTE: No DndContext inside — uses the ancestor DndContext at the page level.
// SortableContext for group reordering still works with an ancestor DndContext.
function ProjectCardView({
  allProjects,
  workerList,
  jibbleMap,
  getAssignment,
  groupOrder,
  onGroupOrderChange,
  isDragActive,
  koreanPresentFn,
}: {
  allProjects: Project[];
  workerList: Worker[];
  jibbleMap: Map<number, JibbleEntry>;
  getAssignment: (workerId: number) => number | null;
  groupOrder: string[];
  onGroupOrderChange: (order: string[]) => void;
  isDragActive?: boolean;
  koreanPresentFn?: (id: number) => boolean;
}) {
  const { t } = useLanguage();
  const [expandedId,       setExpandedId]      = useState<number | null>(null);
  const [collapsedGroups,  setCollapsedGroups] = useState<Set<string>>(loadCollapsedGroups);
  const [searchQuery,      setSearchQuery]     = useState("");
  const [filterStatuses, setFilterStatuses] = useState<Set<string>>(loadFilterStatuses);
  const [showFilterMenu,   setShowFilterMenu]  = useState(false);

  // Persist project status filter to localStorage whenever it changes
  useEffect(() => {
    try { localStorage.setItem(LS_FILTER_STATUSES, JSON.stringify(Array.from(filterStatuses))); } catch {}
  }, [filterStatuses]);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  // ── Server sync for collapsedGroups ──────────────────────────────────────
  const collapsedServerApplied  = useRef(false);
  const pendingCollapsedChange   = useRef(false);
  const isInitialCollapsedEffect = useRef(true);
  const collapsedGroupsRef       = useRef(collapsedGroups);

  const { data: serverPrefs } = useQuery({
    queryKey: ["crew-dispatch-layout-prefs"],
    queryFn: fetchLayoutPrefs,
    staleTime: Infinity,
    retry: false,
  });

  useEffect(() => {
    if (!serverPrefs || collapsedServerApplied.current) return;
    collapsedServerApplied.current = true;
    if (pendingCollapsedChange.current) {
      saveLayoutPrefs({ collapsedGroups: Array.from(collapsedGroupsRef.current) }).catch(() => {});
    } else if (serverPrefs.collapsedGroups !== null) {
      const s = new Set(serverPrefs.collapsedGroups);
      setCollapsedGroups(s);
      saveCollapsedGroups(s);
    } else {
      saveLayoutPrefs({ collapsedGroups: Array.from(collapsedGroupsRef.current) }).catch(() => {});
    }
  }, [serverPrefs]);

  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    collapsedGroupsRef.current = collapsedGroups;
    saveCollapsedGroups(collapsedGroups);
    if (!collapsedServerApplied.current) {
      if (isInitialCollapsedEffect.current) { isInitialCollapsedEffect.current = false; }
      else { pendingCollapsedChange.current = true; }
      return;
    }
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      saveLayoutPrefs({ collapsedGroups: Array.from(collapsedGroups) }).catch(() => {});
    }, 800);
  }, [collapsedGroups]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!showFilterMenu) return;
    function handler(e: MouseEvent) {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) setShowFilterMenu(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showFilterMenu]);

  // ── Groups ────────────────────────────────────────────────────────────────
  const groups = useMemo(() => {
    const sorted = sortProjects(allProjects.filter((p) => !p.archived));
    const map = new Map<string, Project[]>();
    for (const p of sorted) {
      const key = p.customerName?.trim() || "고객사 미지정";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    const entries = Array.from(map.entries() as IterableIterator<[string, Project[]]>).sort(([a], [b]) => {
      if (a === "고객사 미지정") return 1;
      if (b === "고객사 미지정") return -1;
      return a.localeCompare(b);
    });
    if (groupOrder.length === 0) return entries;
    const byName = new Map(entries);
    const ordered   = groupOrder.map((k) => byName.get(k) ? ([k, byName.get(k)!] as [string, Project[]]) : null).filter(Boolean) as [string, Project[]][];
    const remaining = entries.filter(([k]) => !groupOrder.includes(k));
    return [...ordered, ...remaining];
  }, [allProjects, groupOrder]);

  const groupIds = useMemo(() => groups.map(([owner]) => owner), [groups]);

  const isFiltering = searchQuery.trim().length > 0 || filterStatuses.size > 0;
  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return groups
      .map(([owner, projects]) => {
        let filtered = projects;
        if (q) filtered = filtered.filter((p) =>
          p.name.toLowerCase().includes(q) ||
          (p.poNumber ?? "").toLowerCase().includes(q) ||
          (p.jobLocation ?? "").toLowerCase().includes(q)
        );
        if (filterStatuses.size > 0) filtered = filtered.filter((p) =>
          filterStatuses.has(p.status?.trim() ?? "")
        );
        return [owner, filtered] as [string, Project[]];
      })
      .filter(([, ps]) => ps.length > 0);
  }, [groups, searchQuery, filterStatuses]);

  const totalCount    = useMemo(() => groups.reduce((s, [, ps]) => s + ps.length, 0), [groups]);
  const filteredCount = useMemo(() => filteredGroups.reduce((s, [, ps]) => s + ps.length, 0), [filteredGroups]);

  function toggleGroup(key: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function getProjectWorkers(projectId: number) {
    return workerList
      .filter((w) => w.isActive && getAssignment(w.id) === projectId)
      .sort((a, b) => {
        const diff = projectWorkerRank(a) - projectWorkerRank(b);
        return diff !== 0 ? diff : a.fullName.localeCompare(b.fullName);
      })
      .map((w) => ({ worker: w, jibble: jibbleMap.get(w.id) }));
  }

  return (
    <div className="space-y-3">
      {/* ── Toolbar ── */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder={t.cdProjectSearch}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-8 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 placeholder:text-slate-400"
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="relative" ref={filterMenuRef}>
            <button type="button" onClick={() => setShowFilterMenu((v) => !v)}
              className={`h-9 px-3 flex items-center gap-1.5 text-xs font-medium border rounded-lg transition-colors whitespace-nowrap ${
                filterStatuses.size > 0 ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500 bg-white hover:bg-slate-50"
              }`}>
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {filterStatuses.size > 0 ? t.cdFilterActive.replace("{n}", String(filterStatuses.size)) : t.cdFilterBtn}
            </button>
            {showFilterMenu && (
              <div className="absolute right-0 top-10 z-50 bg-white border border-slate-200 rounded-xl shadow-lg p-2 min-w-[190px]">
                {buildStatusOptions(allProjects).map(({ label, bg, text }) => (
                  <label key={label} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={filterStatuses.has(label)}
                      onChange={() => {
                        setFilterStatuses((prev) => {
                          const next = new Set(prev);
                          next.has(label) ? next.delete(label) : next.add(label);
                          return next;
                        });
                      }}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-[11px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: bg, color: text }}>{label}</span>
                  </label>
                ))}
                {filterStatuses.size > 0 && (
                  <button type="button" onClick={() => setFilterStatuses(new Set())}
                    className="w-full mt-1 pt-1 border-t border-slate-100 text-xs text-slate-400 hover:text-slate-600 py-1 text-center">
                    {t.cdFilterReset}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        {isFiltering && <p className="text-xs text-slate-400">{t.cdFilterResult.replace("{filtered}", String(filteredCount)).replace("{total}", String(totalCount))}</p>}
      </div>

      {filteredGroups.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-12">
          {isFiltering ? t.cdNoSearchResult : t.cdNoProjects}
        </p>
      )}

      {/* SortableContext — uses ancestor DndContext at page level */}
      <SortableContext items={groupIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {filteredGroups.map(([owner, projects]) => {
            const color     = groupAccentColor(owner);
            const collapsed = collapsedGroups.has(owner);
            return (
              <SortableGroup key={owner} id={owner}>
                {({ attributes, listeners }) => (
                  <div>
                    {/* Group header */}
                    <div
                      className="w-full flex items-center h-10 bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-200 rounded-lg select-none mb-1"
                      style={{ borderLeftWidth: 4, borderLeftColor: color }}
                    >
                      <div
                        {...attributes}
                        {...listeners}
                        className="w-8 flex items-center justify-center flex-shrink-0 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 transition-colors"
                      >
                        <GripVertical className="w-4 h-4" />
                      </div>
                      <button type="button" onClick={() => toggleGroup(owner)} className="flex items-center gap-2 flex-1 min-w-0 pr-3 h-full text-left">
                        <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
                        <span className="font-semibold text-[13px] text-slate-800 truncate">{owner === "고객사 미지정" ? t.cdNoCustomer : owner}</span>
                        <span className="text-[11px] text-slate-400 font-medium ml-1 shrink-0">{projects.length}</span>
                        <span className="ml-auto shrink-0">
                          {collapsed ? <ChevronRight className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                        </span>
                      </button>
                    </div>

                    {/* Project cards */}
                    {!collapsed && (
                      <div className="space-y-2 mb-1 pl-1">
                        {projects.map((p) => {
                          const workers    = getProjectWorkers(p.id);
                          const isExpanded = expandedId === p.id;
                          const sc         = statusColors(p);
                          return (
                            <DroppableProjectCard key={p.id} projectId={p.id}>
                              {(isOver) => (
                                <Card
                                  className={`transition-all duration-150 cursor-pointer border bg-white ${
                                    isDragActive && isOver
                                      ? "border-blue-400 shadow-md ring-2 ring-blue-300 ring-offset-1"
                                      : "border-slate-200 hover:shadow-md"
                                  }`}
                                  onClick={() => { if (!isDragActive) setExpandedId(isExpanded ? null : p.id); }}
                                >
                                    <CardContent className="px-3 py-3 relative overflow-hidden">
                                      {/* Drop hint overlay */}
                                      {isDragActive && isOver && (
                                        <div className="absolute inset-0 rounded-lg bg-blue-50/70 flex items-center justify-center z-10 pointer-events-none">
                                          <span className="text-sm font-bold text-blue-600">{t.cdDropHereHint}</span>
                                        </div>
                                      )}
                                      {/* Row 1: PO# · Status badge · Worker count · Chevron */}
                                      <div className="flex items-center gap-1 mb-1.5 w-full min-w-0 overflow-hidden">
                                        {p.poNumber && (
                                          <span className="text-[10px] font-mono text-slate-400 shrink truncate min-w-0 max-w-[72px]">{p.poNumber}</span>
                                        )}
                                        <span
                                          className="text-[10px] font-bold px-1.5 py-0.5 rounded truncate shrink min-w-0 max-w-[90px]"
                                          style={{ backgroundColor: sc.bg, color: sc.text }}
                                        >
                                          {cardStatusLabel(p)}
                                        </span>
                                        <span className="flex-1" />
                                        <span className={`flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
                                          workers.length > 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-400"
                                        }`}>
                                          <Users className="w-3 h-3" />{workers.length}{t.cdPersonUnit}
                                        </span>
                                        {isExpanded
                                          ? <ChevronUp   className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                          : <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                                      </div>
                                      {/* Row 2: Project name — max 2 lines */}
                                      <p className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2 mb-1">{p.name}</p>
                                      {/* Row 3: Location */}
                                      {p.jobLocation && (
                                        <div className="flex items-center gap-1 text-xs text-slate-500">
                                          <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
                                          <span className="truncate">{p.jobLocation}</span>
                                        </div>
                                      )}
                                      {/* Expanded: assigned worker list */}
                                      {isExpanded && (
                                        <div className="mt-2 pt-2 border-t border-slate-100">
                                          {workers.length === 0 ? (
                                            <p className="text-sm text-slate-400 italic py-1">{t.cdNoWorkersInProject}</p>
                                          ) : (
                                            <div className="space-y-1.5 pt-1">
                                              {workers.map(({ worker, jibble }) => {
                                                const korean    = isKorean(worker);
                                                const isOnSite  = korean
                                                  ? (koreanPresentFn ? koreanPresentFn(worker.id) : true)
                                                  : (!!jibble && !jibble.lastOut);
                                                const checkedIn = !!jibble;
                                                const tradeBg = tradeInfo(worker)?.bg ?? "transparent";
                                                return (
                                                  <div key={worker.id}
                                                    className="flex items-center gap-3 px-2 py-1.5 rounded-lg"
                                                    style={{ borderLeft: `3px solid ${tradeBg}`, backgroundColor: `${tradeBg}18` }}
                                                  >
                                                    <div className="relative shrink-0">
                                                      <WorkerAvatar photoUrl={worker.photoUrl} name={worker.fullName} small />
                                                      <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                                                        isOnSite ? "bg-emerald-500" : checkedIn ? "bg-amber-400" : "bg-slate-300"
                                                      }`} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                      <p className="text-sm font-medium text-slate-800 leading-tight truncate">{worker.fullName}</p>
                                                      <TradeBadge worker={worker} small />
                                                    </div>
                                                    <div className="flex items-center gap-4 tabular-nums shrink-0">
                                                      <div className="text-right">
                                                        <p className="text-[9px] text-slate-400 uppercase tracking-widest font-semibold leading-tight">{t.cdColCheckIn}</p>
                                                        <p className={`text-sm font-semibold leading-tight ${checkedIn ? "text-emerald-600" : "text-slate-300"}`}>
                                                          {fmtTime(jibble?.firstIn)}
                                                        </p>
                                                      </div>
                                                      <div className="text-right">
                                                        <p className="text-[9px] text-slate-400 uppercase tracking-widest font-semibold leading-tight">{t.cdColCheckOut}</p>
                                                        <p className={`text-sm font-semibold leading-tight ${jibble?.lastOut ? "text-slate-600" : "text-slate-300"}`}>
                                                          {jibble?.lastOut
                                                            ? fmtTime(jibble.lastOut)
                                                            : isOnSite
                                                              ? <span className="text-xs text-emerald-500 font-medium">{t.cdWorkingNow}</span>
                                                              : "—"}
                                                        </p>
                                                      </div>
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </CardContent>
                                </Card>
                              )}
                            </DroppableProjectCard>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </SortableGroup>
            );
          })}
        </div>
      </SortableContext>
    </div>
  );
}

// ─── Save status ──────────────────────────────────────────────────────────────
type SaveStatus = "idle" | "saving" | "saved" | "error";

function SaveStatusChip({
  status, lastSavedAt, onRetry,
}: {
  status: SaveStatus;
  lastSavedAt: Date | null;
  onRetry: () => void;
}) {
  const { t } = useLanguage();
  if (status === "idle") return (
    <div style={{
      display: "flex", alignItems: "center", gap: 5,
      padding: "4px 10px", borderRadius: 20,
      background: "#f8fafc", border: "1px solid #e2e8f0",
      fontSize: 12, color: "#cbd5e1", fontWeight: 500, whiteSpace: "nowrap",
    }}>
      {t.cdSaveIdle}
    </div>
  );

  if (status === "saving") return (
    <div style={{
      display: "flex", alignItems: "center", gap: 5,
      padding: "4px 10px", borderRadius: 20,
      background: "#eff6ff", border: "1px solid #bfdbfe",
      fontSize: 12, color: "#3b82f6", fontWeight: 600, whiteSpace: "nowrap",
    }}>
      <Loader2 className="w-3 h-3 animate-spin" />
      {t.cdSaveSaving}
    </div>
  );

  if (status === "saved") {
    const timeStr = lastSavedAt
      ? lastSavedAt.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      : undefined;
    return (
      <div
        title={timeStr ? t.cdSaveLastSaved + timeStr : undefined}
        style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "4px 10px", borderRadius: 20,
          background: "#f8fafc", border: "1px solid #e2e8f0",
          fontSize: 12, color: "#94a3b8", fontWeight: 500,
          whiteSpace: "nowrap", cursor: timeStr ? "help" : "default",
        }}
      >
        <CheckCircle2 className="w-3 h-3" style={{ color: "#22c55e" }} />
        {t.cdSaveSaved}
      </div>
    );
  }

  // error state
  return (
    <button
      type="button"
      onClick={onRetry}
      style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "4px 10px", borderRadius: 20,
        background: "#fff1f2", border: "1px solid #fecdd3",
        fontSize: 12, color: "#e11d48", fontWeight: 600,
        whiteSpace: "nowrap", cursor: "pointer",
        transition: "background 0.12s",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#ffe4e6"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#fff1f2"; }}
    >
      <AlertCircle className="w-3 h-3" />
      {t.cdSaveError}
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function CrewDispatchAssignment() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [dateStr,    setDateStr]    = useState<string>(() => toLocalDateStr(new Date()));
  const [groupOrder, setGroupOrder] = useState<string[]>(loadGroupOrder);
  // (tab view removed — both panels always shown side-by-side at all breakpoints)

  // Worker drag state
  const [activeWorker,  setActiveWorker]  = useState<Worker | null>(null);

  // ── Save status state ──────────────────────────────────────────────────────
  // inFlightCount (state): mirrors inFlightByDate for the CURRENT date only — drives UI
  // Shared between assignment writes AND Korean attendance writes.
  const [inFlightCount, setInFlightCount] = useState(0);
  // failedOpsByDate: assignment failures survive date navigation.
  // Structure: Map<dateStr, Map<opId, AssignPayload>>
  const [failedOpsByDate, setFailedOpsByDate] = useState<Map<string, Map<string, AssignPayload>>>(new Map());
  // failedAttByDate: attendance failures survive date navigation.
  // Structure: Map<dateStr, Map<opId, AttendancePayload>>
  const [failedAttByDate, setFailedAttByDate] = useState<Map<string, Map<string, AttendancePayload>>>(new Map());
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Always-current ref for dateStr — read inside async mutation callbacks
  const dateStrRef = useRef(dateStr);
  const opIdCounter = useRef(0);

  // Per-date in-flight counts — old-date callbacks decrement their own bucket,
  // never touching the current date's UI state.
  const inFlightByDate = useRef<Map<string, number>>(new Map());
  function adjustInFlight(date: string, delta: number) {
    const next = Math.max(0, (inFlightByDate.current.get(date) ?? 0) + delta);
    inFlightByDate.current.set(date, next);
    // Only trigger a re-render for the currently displayed date
    if (date === dateStrRef.current) setInFlightCount(next);
  }

  // Latest opId per "workerId:date" — lets onError skip stale failures when a
  // newer write for the same slot was queued after this one started.
  const latestOpId = useRef<Map<string, string>>(new Map());

  // Current-date view of failures — used for save status and retry UI
  const currentFailedOps = failedOpsByDate.get(dateStr) ?? new Map<string, AssignPayload>();
  const currentFailedAtt = failedAttByDate.get(dateStr) ?? new Map<string, AttendancePayload>();

  // Derived — no extra useState lag
  const saveStatus: SaveStatus =
    currentFailedOps.size > 0 || currentFailedAtt.size > 0 ? "error" :
    inFlightCount > 0 ? "saving" :
    lastSavedAt !== null ? "saved" : "idle";

  // Undo-unassign state
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  // Always-current ref so handleAssign can read undoState without stale closure
  const undoStateRef = useRef<UndoState | null>(null);
  useEffect(() => { undoStateRef.current = undoState; }, [undoState]);
  // Per-worker write queues: serializes all server writes for a given worker so
  // a slow PUT can never arrive after a later one and overwrite the newer value.
  const workerWriteQueues = useRef<Map<number, Promise<void>>>(new Map());

  // Left-panel search/filter
  const [workerSearch, setWorkerSearch] = useState("");
  const [workerFilter, setWorkerFilter] = useState<"all" | "onsite" | "unassigned">(loadWorkerFilter);

  // Persist worker filter to localStorage whenever it changes
  useEffect(() => {
    try { localStorage.setItem(LS_WORKER_FILTER, workerFilter); } catch {}
  }, [workerFilter]);

  // Cleanup: cancel any pending undo timer when leaving the page
  useEffect(() => {
    return () => {
      setUndoState((prev) => { if (prev) clearTimeout(prev.timerId); return null; });
    };
  }, []);

  // ── Server prefs: groupOrder ──────────────────────────────────────────────
  const groupOrderServerApplied  = useRef(false);
  const pendingGroupOrderChange   = useRef(false);
  const isInitialGroupOrderEffect = useRef(true);
  const groupOrderRef             = useRef(groupOrder);

  const { data: serverPrefs } = useQuery({
    queryKey: ["crew-dispatch-layout-prefs"],
    queryFn: fetchLayoutPrefs,
    staleTime: Infinity,
    retry: false,
  });

  useEffect(() => {
    if (!serverPrefs || groupOrderServerApplied.current) return;
    groupOrderServerApplied.current = true;
    if (pendingGroupOrderChange.current) {
      saveLayoutPrefs({ groupOrder: groupOrderRef.current }).catch(() => {});
    } else if (serverPrefs.groupOrder !== null) {
      setGroupOrder(serverPrefs.groupOrder);
      saveGroupOrder(serverPrefs.groupOrder);
    } else {
      saveLayoutPrefs({ groupOrder: groupOrderRef.current }).catch(() => {});
    }
  }, [serverPrefs]);

  const groupOrderSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    groupOrderRef.current = groupOrder;
    saveGroupOrder(groupOrder);
    if (!groupOrderServerApplied.current) {
      if (isInitialGroupOrderEffect.current) { isInitialGroupOrderEffect.current = false; }
      else { pendingGroupOrderChange.current = true; }
      return;
    }
    if (groupOrderSyncTimer.current) clearTimeout(groupOrderSyncTimer.current);
    groupOrderSyncTimer.current = setTimeout(() => {
      saveLayoutPrefs({ groupOrder }).catch(() => {});
    }, 800);
  }, [groupOrder]); // eslint-disable-line react-hooks/exhaustive-deps

  function changeDate(delta: number) {
    const hasPendingSaves = inFlightCount > 0;
    const hasFailures     = currentFailedOps.size > 0;
    if (hasPendingSaves || hasFailures) {
      const msg = hasFailures
        ? t.cdConfirmChangeFailed
        : t.cdConfirmChangePending;
      if (!window.confirm(msg)) return;
    }
    const d = new Date(dateStr + "T00:00:00");
    d.setDate(d.getDate() + delta);
    setDateStr(toLocalDateStr(d));
  }

  function handleRetry() {
    const hasAssignFailures = currentFailedOps.size > 0;
    const hasAttFailures    = currentFailedAtt.size > 0;
    if (!hasAssignFailures && !hasAttFailures) return;

    // Retry assignment failures
    if (hasAssignFailures) {
      const ops = Array.from(currentFailedOps.values());
      setFailedOpsByDate((prev) => { const next = new Map(prev); next.delete(dateStr); return next; });
      for (const op of ops) handleAssign(op.workerId, op.projectId);
    }

    // Retry attendance failures
    if (hasAttFailures) {
      const atts = Array.from(currentFailedAtt.values());
      setFailedAttByDate((prev) => { const next = new Map(prev); next.delete(dateStr); return next; });
      for (const att of atts) handleAttendanceToggle(att.workerId, att.present, false);
    }
  }

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data: workerList = [], isLoading: workersLoading } = useQuery<Worker[]>({ queryKey: ["/api/workers"] });

  const { data: jibbleData } = useQuery<{ active: JibbleActive[] }>({
    queryKey: ["/api/jibble/active"],
    refetchInterval: 5 * 60 * 1000,
  });
  const jibbleMap = useMemo(() => {
    const m = new Map<number, JibbleEntry>();
    (jibbleData?.active ?? []).forEach(({ entry, worker }) => {
      if (worker) m.set(worker.id, { firstIn: entry.firstIn, lastOut: entry.lastOut });
    });
    return m;
  }, [jibbleData]);

  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery<Assignment[]>({
    queryKey: ["/api/crew-dispatch/assignments", dateStr],
    queryFn: async () => {
      const r = await fetch(`/api/crew-dispatch/assignments?date=${dateStr}`, { credentials: "include" });
      if (!r.ok) throw new Error(`assignments fetch failed: ${r.status}`);
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });
  const assignmentMap = useMemo(
    () => new Map((Array.isArray(assignments) ? assignments : []).map((a) => [a.workerId, a.projectId])),
    [assignments],
  );

  const { data: allProjects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    // Don't re-fetch on window focus — avoids spurious refetches that could
    // interrupt an in-progress drag and remount DroppableProjectCard nodes.
    refetchOnWindowFocus: false,
  });

  // ── isDragging guard ──────────────────────────────────────────────────────
  // Freeze the project list while a worker drag is active so that any
  // background data refresh (e.g. Jibble polling triggers a cascade refetch)
  // cannot remount DroppableProjectCard nodes mid-drag, which would silently
  // drop the active drag or misroute the drop event.
  const isDragActive = activeWorker !== null;
  const frozenProjectsRef = useRef<Project[]>(allProjects);
  // Only update the snapshot between drags (safe: ref mutation during render).
  if (!isDragActive) {
    frozenProjectsRef.current = allProjects;
  }
  const displayedProjects = isDragActive ? frozenProjectsRef.current : allProjects;

  const { activeByCustomer, doneProjects } = useMemo(() => {
    const sorted = sortProjects(allProjects);
    const active = sorted.filter((p) => groupPriority(p) < 3);
    const done   = sorted.filter((p) => groupPriority(p) >= 3);
    const map = new Map<string, Project[]>();
    for (const p of active) {
      const key = p.customerName?.trim() || "고객사 미지정";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    const alphabetical = Array.from(map.entries() as IterableIterator<[string, Project[]]>)
      .sort(([a], [b]) => {
        if (a === "고객사 미지정") return 1;
        if (b === "고객사 미지정") return -1;
        return a.localeCompare(b);
      });
    let ordered: [string, Project[]][];
    if (groupOrder.length > 0) {
      const byName    = new Map(alphabetical);
      const inOrder   = groupOrder.map((k) => byName.has(k) ? ([k, byName.get(k)!] as [string, Project[]]) : null).filter(Boolean) as [string, Project[]][];
      const remaining = alphabetical.filter(([k]) => !groupOrder.includes(k));
      ordered = [...inOrder, ...remaining];
    } else {
      ordered = alphabetical;
    }
    return { activeByCustomer: ordered.map(([customer, projects]) => ({ customer, projects })), doneProjects: done };
  }, [allProjects, groupOrder]);

  // ── Korean attendance data ────────────────────────────────────────────────
  const { data: koreanAttendanceData = [] } = useQuery<KoreanAttendanceRow[]>({
    queryKey: ["/api/crew-dispatch/korean-attendance", dateStr],
    queryFn: async () => {
      const r = await fetch(`/api/crew-dispatch/korean-attendance?date=${dateStr}`, { credentials: "include" });
      if (!r.ok) throw new Error(`attendance fetch failed: ${r.status}`);
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });
  // Persistent server map (null = use default = present)
  const koreanAttendanceServerMap = useMemo(
    () => new Map((koreanAttendanceData as KoreanAttendanceRow[]).map((r) => [r.workerId, r.present])),
    [koreanAttendanceData],
  );

  // ── Optimistic assignment state ───────────────────────────────────────────
  const [localOverride, setLocalOverride] = useState<Map<number, number | null>>(new Map());
  // Optimistic attendance overrides (cleared on date change)
  const [localAttOverride, setLocalAttOverride] = useState<Map<number, boolean>>(new Map());

  /** Returns true if the given Korean worker is present on the current date.
   *  Defaults to true (present) when no server record exists. */
  function isKoreanPresent(workerId: number): boolean {
    if (localAttOverride.has(workerId)) return localAttOverride.get(workerId)!;
    return koreanAttendanceServerMap.get(workerId) ?? true;
  }

  useEffect(() => {
    // Keep dateStrRef in sync so async callbacks can compare dates
    dateStrRef.current = dateStr;
    setLocalOverride(new Map());
    setLocalAttOverride(new Map());
    // Discard pending undo when navigating to a different date
    setUndoState((prev) => { if (prev) clearTimeout(prev.timerId); return null; });
    // Restore the in-flight count for this date (0 if never visited).
    // Old-date callbacks write to their own inFlightByDate bucket and will not
    // touch this state (adjustInFlight gates on date === dateStrRef.current).
    setInFlightCount(inFlightByDate.current.get(dateStr) ?? 0);
    // Do NOT clear failedOpsByDate / failedAttByDate — failures survive navigation
    // and are shown again when the user returns to the affected date.
    setLastSavedAt(null);
  }, [dateStr]);

  const assignMutation = useMutation({
    mutationFn: ({ workerId, projectId, date }: AssignPayload) =>
      fetch(`/api/crew-dispatch/assignments/${workerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        // Use the captured date from variables — not the closure's dateStr which may
        // have advanced if the user navigated dates while the request was queued.
        body: JSON.stringify({ date, projectId }),
      }).then(async (r) => { if (!r.ok) throw new Error(await r.text()); return r.json(); }),

    onMutate: ({ date }) => {
      adjustInFlight(date, +1);
    },

    onSuccess: (_, { date }) => {
      adjustInFlight(date, -1);
      // Invalidate the query for the exact date this mutation targeted
      qc.invalidateQueries({ queryKey: ["/api/crew-dispatch/assignments", date] });
      // Only advance the "saved" timestamp for the currently visible date
      if (date === dateStrRef.current) setLastSavedAt(new Date());
    },

    onError: (err: any, variables) => {
      const { workerId, date, opId } = variables;
      adjustInFlight(date, -1);
      // Only register this failure if no newer write for the same worker+date has
      // been queued since this op started (latestOpId tracks the current authority).
      if (opId === latestOpId.current.get(`${workerId}:${date}`)) {
        // Roll back the optimistic override only if we are still on this date
        // (localOverride only exists for the currently displayed date)
        if (date === dateStrRef.current) {
          setLocalOverride((prev) => { const next = new Map(prev); next.delete(workerId); return next; });
        }
        // Persist the failure in its own date bucket — survives date navigation
        setFailedOpsByDate((prev) => {
          const dateMap = new Map(prev.get(date) ?? new Map<string, AssignPayload>()).set(opId, variables);
          return new Map(prev).set(date, dateMap);
        });
      }
      toast({ title: t.cdToastAssignFailed, description: err.message, variant: "destructive" });
    },
  });

  /** Serializes all server writes per worker so a slow PUT can never arrive after a
   *  newer one and overwrite it.  Also dismisses any pending undo for that worker
   *  when a new non-null assignment comes in (the user has moved on). */
  function handleAssign(workerId: number, projectId: number | null): Promise<void> {
    setLocalOverride((prev) => new Map(prev).set(workerId, projectId));

    // A new explicit assignment invalidates any pending undo for this worker
    if (projectId !== null) {
      const current = undoStateRef.current;
      if (current && current.workerId === workerId) {
        clearTimeout(current.timerId);
        undoStateRef.current = null;
        setUndoState(null);
      }
    }

    // Capture date + opId at call time so callbacks can detect stale-date writes
    const date  = dateStrRef.current;
    const opId  = `op-${++opIdCounter.current}`;

    // Register this as the authoritative write for this worker+date slot.
    // onError will check this before adding to failedOps — if a newer write has
    // been queued since this one, this slot will already point to the newer opId.
    latestOpId.current.set(`${workerId}:${date}`, opId);

    // A newer queued write supersedes any prior failed op for the same worker+date.
    // Clear it immediately so the error chip doesn't show a stale retry option.
    setFailedOpsByDate((prev) => {
      const dateMap = prev.get(date);
      if (!dateMap) return prev;
      const staleIds = Array.from(dateMap.keys()).filter((id) => dateMap.get(id)?.workerId === workerId);
      if (staleIds.length === 0) return prev;
      const newDateMap = new Map(dateMap);
      staleIds.forEach((id) => newDateMap.delete(id));
      return new Map(prev).set(date, newDateMap);
    });

    // Chain this write after any pending write for this worker (FIFO serialization)
    const prevWrite = workerWriteQueues.current.get(workerId) ?? Promise.resolve();
    const thisWrite = prevWrite.then(() =>
      assignMutation.mutateAsync({ workerId, projectId, date, opId }).then(() => {}, () => {})
    );
    workerWriteQueues.current.set(workerId, thisWrite);
    return thisWrite;
  }

  /** Unassign a worker and open a 5-second undo window. */
  function handleUnassign(workerId: number, prevProjectId: number, workerName: string, projectName: string) {
    // Confirm any existing undo window (previous unassignment is now permanent)
    setUndoState((prev) => { if (prev) clearTimeout(prev.timerId); return null; });
    // Perform the unassignment (queued — will serialize with any later restore)
    handleAssign(workerId, null);
    // Open the new undo window
    const timerId = setTimeout(() => setUndoState(null), 5000);
    setUndoState({ workerId, prevProjectId, workerName, projectName, timerId });
  }

  /** Restore the previous assignment.  Because handleAssign queues writes per worker,
   *  this restore is automatically serialized after the preceding unassign PUT. */
  function handleUndo() {
    if (!undoState) return;
    clearTimeout(undoState.timerId);
    const { workerId, prevProjectId } = undoState;
    setUndoState(null);
    handleAssign(workerId, prevProjectId);
  }

  function getAssignment(workerId: number): number | null {
    if (localOverride.has(workerId)) return localOverride.get(workerId) ?? null;
    return assignmentMap.get(workerId) ?? null;
  }

  // ── Korean attendance mutation ─────────────────────────────────────────────
  const attendanceMutation = useMutation({
    mutationFn: ({ workerId, present, date }: AttendancePayload) =>
      fetch(`/api/crew-dispatch/korean-attendance/${workerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ date, present }),
      }).then(async (r) => { if (!r.ok) throw new Error(await r.text()); return r.json(); }),

    onMutate: ({ date }) => {
      adjustInFlight(date, +1);
    },

    onSuccess: (_, { date }) => {
      adjustInFlight(date, -1);
      qc.invalidateQueries({ queryKey: ["/api/crew-dispatch/korean-attendance", date] });
      if (date === dateStrRef.current) setLastSavedAt(new Date());
    },

    onError: (err: any, variables) => {
      const { workerId, date, opId } = variables;
      adjustInFlight(date, -1);
      // Only register a failure if this is still the authoritative op for this worker+date
      if (opId === latestOpId.current.get(`att:${workerId}:${date}`)) {
        // Roll back the optimistic override for the current date
        if (date === dateStrRef.current) {
          setLocalAttOverride((prev) => { const next = new Map(prev); next.delete(workerId); return next; });
        }
        setFailedAttByDate((prev) => {
          const dateMap = new Map(prev.get(date) ?? new Map<string, AttendancePayload>()).set(opId, variables);
          return new Map(prev).set(date, dateMap);
        });
      }
      toast({ title: t.cdToastAttFailed, description: err.message, variant: "destructive" });
    },
  });

  /** Toggle Korean worker attendance and persist to server. */
  function handleAttendanceToggle(workerId: number, present: boolean, clearStale = true): void {
    setLocalAttOverride((prev) => new Map(prev).set(workerId, present));

    const date = dateStrRef.current;
    const opId = `op-${++opIdCounter.current}`;

    latestOpId.current.set(`att:${workerId}:${date}`, opId);

    if (clearStale) {
      // Clear any prior failed att op for the same worker+date
      setFailedAttByDate((prev) => {
        const dateMap = prev.get(date);
        if (!dateMap) return prev;
        const staleIds = Array.from(dateMap.keys()).filter((id) => dateMap.get(id)?.workerId === workerId);
        if (staleIds.length === 0) return prev;
        const newDateMap = new Map(dateMap);
        staleIds.forEach((id) => newDateMap.delete(id));
        return new Map(prev).set(date, newDateMap);
      });
    }

    attendanceMutation.mutate({ workerId, present, date, opId });
  }

  // ── DnD (single DndContext at page level) ─────────────────────────────────
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Compute groups at page level for group-reorder routing in onDragEnd.
  // Uses displayedProjects (frozen during drag) so group IDs stay stable.
  const pageGroups = useMemo(() => {
    const sorted = sortProjects(displayedProjects.filter((p) => !p.archived));
    const map = new Map<string, Project[]>();
    for (const p of sorted) {
      const key = p.customerName?.trim() || "고객사 미지정";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    const entries = Array.from(map.entries() as IterableIterator<[string, Project[]]>).sort(([a], [b]) => {
      if (a === "고객사 미지정") return 1;
      if (b === "고객사 미지정") return -1;
      return a.localeCompare(b);
    });
    if (groupOrder.length === 0) return entries;
    const byName    = new Map(entries);
    const ordered   = groupOrder.map((k) => byName.has(k) ? ([k, byName.get(k)!] as [string, Project[]]) : null).filter(Boolean) as [string, Project[]][];
    const remaining = entries.filter(([k]) => !groupOrder.includes(k));
    return [...ordered, ...remaining];
  }, [displayedProjects, groupOrder]); // eslint-disable-line react-hooks/exhaustive-deps

  const pageGroupIds = useMemo(() => pageGroups.map(([k]) => k), [pageGroups]);

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    if (id.startsWith("worker-")) {
      const workerId = parseInt(id.replace("worker-", ""), 10);
      setActiveWorker(workerList.find((w) => w.id === workerId) ?? null);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveWorker(null);
    const activeId = String(active.id);

    // ── Worker → project drop ──────────────────────────────────────────────
    if (activeId.startsWith("worker-")) {
      const workerId = parseInt(activeId.replace("worker-", ""), 10);
      if (!over) {
        // Dropped outside a project — unassign with undo
        const prevProjectId = getAssignment(workerId);
        if (prevProjectId !== null) {
          const worker  = workerList.find((w) => w.id === workerId);
          const project = allProjects.find((p) => p.id === prevProjectId);
          handleUnassign(workerId, prevProjectId, worker?.fullName ?? t.cdWorkerFallback, project?.name ?? t.cdProjectFallback);
        }
        return;
      }
      const overId = String(over.id);
      if (overId.startsWith("project-")) {
        const projectId = parseInt(overId.replace("project-", ""), 10);
        if (getAssignment(workerId) === projectId) return; // no-op
        const project = allProjects.find((p) => p.id === projectId);
        const worker  = workerList.find((w) => w.id === workerId);
        handleAssign(workerId, projectId);
        toast({ title: t.cdToastAssigned.replace("{worker}", worker?.fullName ?? t.cdWorkerFallback).replace("{project}", project?.name ?? t.cdProjectFallback) });
      }
      return;
    }

    // ── Group reorder ──────────────────────────────────────────────────────
    if (!over || activeId === String(over.id)) return;
    const oldIndex = pageGroupIds.indexOf(activeId);
    const newIndex = pageGroupIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    setGroupOrder(arrayMove(pageGroupIds, oldIndex, newIndex));
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const assignedCount = workerList.filter((w) => getAssignment(w.id) !== null).length;
  const onSiteCount   = workerList.filter((w) => {
    if (isKorean(w)) return isKoreanPresent(w.id);
    const j = jibbleMap.get(w.id);
    return !!j && !j.lastOut;
  }).length;
  const isToday   = dateStr === toLocalDateStr(new Date());
  const isLoading = workersLoading || assignmentsLoading;

  const sortedWorkers = useMemo(
    () => sortWorkers(workerList, jibbleMap, isKoreanPresent),
    [workerList, jibbleMap, koreanAttendanceServerMap, localAttOverride], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const filteredWorkers = useMemo(() => {
    const q = workerSearch.trim().toLowerCase();
    return sortedWorkers.filter((w) => {
      if (q && !w.fullName.toLowerCase().includes(q) && !(w.trade ?? "").toLowerCase().includes(q)) return false;
      if (workerFilter === "onsite") {
        if (isKorean(w)) return isKoreanPresent(w.id);
        const j = jibbleMap.get(w.id);
        return !!j && !j.lastOut;
      }
      if (workerFilter === "unassigned") return getAssignment(w.id) === null;
      // "all" tab: show everyone so assigned workers are visible (with X button) after navigation
      return true;
    });
  }, [sortedWorkers, workerSearch, workerFilter, jibbleMap, localOverride, assignmentMap, localAttOverride, koreanAttendanceServerMap]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.body.classList.add("crew-dispatch-assignment-active");
    document.documentElement.classList.add("crew-dispatch-assignment-active");
    return () => {
      document.body.classList.remove("crew-dispatch-assignment-active");
      document.documentElement.classList.remove("crew-dispatch-assignment-active");
    };
  }, []);

  return (
    <div className="crew-dispatch-assignment space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">{t.cdPageTitle}</h1>
          <p className="text-slate-500 mt-1 text-sm">{t.cdPageSubtitle}</p>
        </div>
        <div className="shrink-0 pt-1">
          <SaveStatusChip
            status={saveStatus}
            lastSavedAt={lastSavedAt}
            onRetry={handleRetry}
          />
        </div>
      </div>

      {/* ── Date navigator ── */}
      <div className="flex items-center gap-3">
        <button onClick={() => changeDate(-1)}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-800">{fmtDate(dateStr)}</span>
          {isToday && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 uppercase tracking-wide">{t.cdTodayBadge}</span>
          )}
        </div>
        <button onClick={() => changeDate(1)} disabled={isToday}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-slate-200 bg-white shadow-none rounded-lg overflow-hidden">
          <CardContent className="border-l-[3px] border-emerald-500 px-3.5 py-3.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <p className="text-[10px] text-slate-500 uppercase tracking-[0.12em] font-bold leading-none">
                {t.cdKpiOnSite}
              </p>
            </div>
            <p className="mt-2 text-[28px] font-bold text-slate-900 leading-none tabular-nums">
              {onSiteCount}
              <span className="text-xs text-slate-500 ml-1 font-semibold">{t.cdPersonUnit}</span>
            </p>
            <p className="mt-2 text-[10px] text-slate-400 leading-none">{t.cdStatusOnSite}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-white shadow-none rounded-lg overflow-hidden">
          <CardContent className="border-l-[3px] border-amber-400 px-3.5 py-3.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
              <p className="text-[10px] text-slate-500 uppercase tracking-[0.12em] font-bold leading-none">
                {t.cdKpiAssigned}
              </p>
            </div>
            <p className="mt-2 text-[28px] font-bold text-slate-900 leading-none tabular-nums">
              {assignedCount}
              <span className="text-xs text-slate-500 ml-1 font-semibold">/ {workerList.length}</span>
            </p>
            <div className="mt-2 h-1 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-400 transition-[width] duration-300"
                style={{ width: `${workerList.length > 0 ? Math.min(100, (assignedCount / workerList.length) * 100) : 0}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Single DndContext wrapping all views ── */}
      <DndContext
        sensors={sensors}
        collisionDetection={(args) =>
          String(args.active.id).startsWith("worker-")
            ? pointerWithin(args)
            : closestCenter(args)
        }
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveWorker(null)}
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
            <p className="text-sm text-slate-400">{t.cdLoading}</p>
          </div>
        ) : (
          <>
            {/* ── Unified split pane — always side-by-side at all breakpoints ── */}
            <div className="crew-dispatch-split flex gap-0 items-stretch border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">

              {/* Left: worker panel — narrow on mobile, full on lg+ */}
              <div className="crew-dispatch-worker-panel w-[136px] sm:w-[200px] lg:w-[300px] xl:w-[340px] shrink-0 flex flex-col border-r border-slate-200">

                {/* Panel header */}
                <div className="px-2 lg:px-4 pt-3 lg:pt-4 pb-2 lg:pb-3 border-b border-slate-100 bg-slate-50 space-y-2 lg:space-y-2.5">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] lg:text-xs font-bold text-slate-500 uppercase tracking-wider leading-tight">
                      {t.cdPanelTitle.replace("{n}", String(sortedWorkers.length))}
                    </span>
                    <span className="hidden lg:inline text-[10px] text-slate-400 shrink-0">{t.cdPanelDragHint}</span>
                  </div>
                  {/* Search + filter: only on lg+ */}
                  {/* Mobile-only compact 2-tab filter: all / 미배치만 */}
                  <div className="flex lg:hidden gap-1">
                    {(["all", "unassigned"] as const).map((f) => (
                      <button key={f} type="button" onClick={() => setWorkerFilter(f as "all" | "onsite" | "unassigned")}
                        className={`flex-1 text-[10px] font-semibold py-1 rounded border transition-colors ${
                          workerFilter === f
                            ? "bg-slate-800 border-slate-800 text-white"
                            : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                        }`}>
                        {f === "all" ? t.cdFilterAll : t.cdFilterUnassigned}
                      </button>
                    ))}
                  </div>
                  <div className="hidden lg:block space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        placeholder={t.cdWorkerSearch}
                        value={workerSearch}
                        onChange={(e) => setWorkerSearch(e.target.value)}
                        className="w-full h-8 pl-9 pr-8 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 placeholder:text-slate-400"
                      />
                      {workerSearch && (
                        <button type="button" onClick={() => setWorkerSearch("")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      {(["all", "onsite", "unassigned"] as const).map((f) => (
                        <button key={f} type="button" onClick={() => setWorkerFilter(f)}
                          className={`flex-1 text-xs font-medium py-1 rounded-md border transition-colors ${
                            workerFilter === f
                              ? "bg-slate-800 border-slate-800 text-white"
                              : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                          }`}>
                          {f === "all" ? t.cdFilterAll : f === "onsite" ? t.cdFilterOnSite : t.cdFilterUnassigned}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Worker list — draggable cards on all screen sizes */}
                <div className="crew-dispatch-scroll-panel flex-1 overflow-y-auto overflow-x-hidden no-scrollbar min-h-0 p-2 lg:p-3 space-y-1.5">
                  {filteredWorkers.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-10">{t.cdNoWorkersFiltered}</p>
                  ) : (
                    filteredWorkers.map((w) => {
                      const assignedId = getAssignment(w.id);
                      const korean = isKorean(w);
                      return (
                        <DraggableWorkerRow
                          key={w.id}
                          worker={w}
                          jibble={jibbleMap.get(w.id)}
                          assignedProject={allProjects.find((p) => p.id === assignedId)}
                          onUnassign={assignedId !== null ? () => {
                            const project = allProjects.find((p) => p.id === assignedId);
                            handleUnassign(w.id, assignedId, w.fullName, project?.name ?? t.cdProjectFallback);
                          } : undefined}
                          koreanPresent={korean ? isKoreanPresent(w.id) : undefined}
                          onAttendanceToggle={korean ? (present) => handleAttendanceToggle(w.id, present) : undefined}
                        />
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right: project cards */}
              <div className="crew-dispatch-scroll-panel crew-dispatch-project-panel flex-1 min-w-0 overflow-y-auto overflow-x-hidden no-scrollbar p-2 lg:p-4">
                <ProjectCardView
                  allProjects={displayedProjects}
                  workerList={workerList}
                  jibbleMap={jibbleMap}
                  getAssignment={getAssignment}
                  groupOrder={groupOrder}
                  onGroupOrderChange={setGroupOrder}
                  isDragActive={isDragActive}
                  koreanPresentFn={isKoreanPresent}
                />
              </div>
            </div>
          </>
        )}

        {/* ── DragOverlay ── */}
        <DragOverlay dropAnimation={null}>
          {activeWorker && (
            <WorkerDragOverlay worker={activeWorker} jibble={jibbleMap.get(activeWorker.id)} />
          )}
        </DragOverlay>

      </DndContext>

      {/* ── Undo toast (fixed bottom-center) ── */}
      {undoState && (
        <>
          <style>{`
            @keyframes _cdUndoSlideUp {
              from { opacity: 0; transform: translate(-50%, 14px); }
              to   { opacity: 1; transform: translate(-50%, 0); }
            }
            @keyframes _cdUndoBar {
              from { width: 100%; }
              to   { width: 0%; }
            }
          `}</style>
          <div
            role="status"
            aria-live="polite"
            style={{
              position: "fixed", bottom: 28, left: "50%",
              transform: "translateX(-50%)",
              zIndex: 9999,
              display: "flex", alignItems: "center", gap: 10,
              padding: "13px 12px 16px 16px",
              borderRadius: 14,
              background: "#1e293b",
              boxShadow: "0 8px 32px rgba(0,0,0,0.28), 0 2px 8px rgba(0,0,0,0.16)",
              animation: "_cdUndoSlideUp 0.22s ease-out",
              minWidth: 280,
            }}
          >
            {/* Text */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9", lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {undoState.workerName}
                <span style={{ fontSize: 11, fontWeight: 400, color: "#64748b", marginLeft: 6 }}>{t.cdUndoUnassigned}</span>
              </div>
              <div style={{ fontSize: 11, color: "#475569", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {undoState.projectName}
              </div>
            </div>
            {/* Undo button */}
            <button
              type="button"
              onClick={handleUndo}
              style={{
                padding: "6px 13px", borderRadius: 8,
                background: "#3b82f6", color: "#fff",
                border: "none", fontSize: 12, fontWeight: 700,
                cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                transition: "background 0.12s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#2563eb"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#3b82f6"; }}
            >
              {t.cdUndoBtn}
            </button>
            {/* Dismiss button */}
            <button
              type="button"
              aria-label={t.cdUndoDismiss}
              onClick={() => { clearTimeout(undoState.timerId); setUndoState(null); }}
              style={{
                width: 22, height: 22, borderRadius: "50%",
                background: "rgba(255,255,255,0.07)", border: "none",
                color: "#64748b", fontSize: 11, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, transition: "color 0.12s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#e2e8f0"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#64748b"; }}
            >
              ✕
            </button>
            {/* 5-second countdown bar */}
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0, height: 3,
              borderBottomLeftRadius: 14, borderBottomRightRadius: 14,
              background: "rgba(255,255,255,0.07)", overflow: "hidden",
            }}>
              <div style={{
                height: "100%", background: "#3b82f6",
                animation: "_cdUndoBar 5s linear forwards",
              }} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

async function saveLayoutPrefs(prefs: { groupOrder?: string[]; collapsedGroups?: string[] }): Promise<void> {
  const res = await fetch("/api/crew-dispatch/layout-prefs", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(prefs),
  });
  if (!res.ok) throw new Error("Failed to save layout prefs");
}
