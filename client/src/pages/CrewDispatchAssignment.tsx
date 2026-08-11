import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Users, CheckCircle2, MapPin, Loader2, GripVertical,
  Search, SlidersHorizontal, X,
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
import type { Worker, Project } from "@shared/schema";

// ─── Types ────────────────────────────────────────────────────────────────────
interface JibbleEntry { firstIn: string; lastOut?: string }
interface JibbleActive { entry: JibbleEntry; worker: { id: number } | null }
interface Assignment { workerId: number; projectId: number | null; date: string }

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

function statusColors(p: Project): { bg: string; text: string } {
  const pri = groupPriority(p);
  if (pri === 0) return { bg: "#dcfce7", text: "#15803d" };
  if (pri === 1) return { bg: "#dbeafe", text: "#1d4ed8" };
  if (pri === 3) return { bg: "#f1f5f9", text: "#94a3b8" };
  return { bg: "#fef9c3", text: "#a16207" };
}

/** Raw Monday status label shown on cards */
function cardStatusLabel(p: Project): string {
  return p.status?.trim() || "—";
}

/** General Manager → Manager → 나머지 순 */
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

function sortWorkers(list: Worker[], jibbleMap: Map<number, JibbleEntry>): Worker[] {
  return [...list].filter((w) => w.isActive).sort((a, b) => {
    const ra = managerRank(a), rb = managerRank(b);
    if (ra !== rb) return ra - rb;
    const ja = jibbleMap.get(a.id);
    const jb = jibbleMap.get(b.id);
    const scoreA = ja && !ja.lastOut ? 2 : ja ? 1 : 0;
    const scoreB = jb && !jb.lastOut ? 2 : jb ? 1 : 0;
    if (scoreA !== scoreB) return scoreB - scoreA;
    return a.fullName.localeCompare(b.fullName);
  });
}

// ─── localStorage helpers ─────────────────────────────────────────────────────
const LS_GROUP_ORDER = "voltstock_cd_group_order_v1";
const LS_COLLAPSED   = "voltstock_cd_group_collapsed_v1";

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
function WorkerRow({ worker, jibble, assignedProjectId, activeByCustomer, doneProjects, onAssign }: {
  worker: Worker;
  jibble?: JibbleEntry;
  assignedProjectId: number | null;
  activeByCustomer: CustomerGroup[];
  doneProjects: Project[];
  onAssign: (projectId: number | null) => void;
}) {
  const [showCompleted, setShowCompleted] = useState(false);
  const isOnSite  = !!jibble && !jibble.lastOut;
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
            }`} title={isOnSite ? "현장 근무 중" : checkedIn ? "퇴근" : "미출근"} />
          </div>
          <div>
            <p className="font-medium text-slate-800 text-sm leading-tight">{worker.fullName}</p>
            {worker.trade && <p className="text-xs text-slate-400 leading-tight">{worker.trade}</p>}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 tabular-nums whitespace-nowrap">
        {checkedIn
          ? <span className="text-sm text-emerald-600 font-semibold">{fmtTime(jibble!.firstIn)}</span>
          : <span className="text-sm text-slate-300">—</span>}
      </td>
      <td className="px-4 py-3 tabular-nums whitespace-nowrap">
        {jibble?.lastOut
          ? <span className="text-sm text-slate-500 font-semibold">{fmtTime(jibble.lastOut)}</span>
          : isOnSite
            ? <span className="text-xs text-emerald-500 font-medium">근무 중</span>
            : <span className="text-sm text-slate-300">—</span>}
      </td>
      <td className="px-4 py-3">
        <Select value={assignedProjectId !== null ? String(assignedProjectId) : "__none__"} onValueChange={handleValueChange}>
          <SelectTrigger className={`h-8 text-sm max-w-[280px] ${
            assignedProjectId !== null ? "border-amber-300 bg-amber-50 text-amber-800" : "border-slate-200 text-slate-400"
          }`}>
            <SelectValue placeholder="미배치" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__"><span className="text-slate-400">— 미배치</span></SelectItem>
            {activeByCustomer.map(({ customer, projects }) => (
              <SelectGroup key={customer}>
                <SelectLabel className="text-[10px] text-slate-500 font-bold uppercase tracking-wider px-2 py-1 bg-slate-50">{customer}</SelectLabel>
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
                  {showCompleted ? "▲ 완료 프로젝트 접기" : `▼ 완료된 프로젝트 보기 (${doneProjects.length}개)`}
                </SelectItem>
              </>
            )}
          </SelectContent>
        </Select>
      </td>
    </tr>
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
function DraggableWorkerRow({ worker, jibble, assignedProject, onUnassign }: {
  worker: Worker;
  jibble?: JibbleEntry;
  assignedProject?: Project | null;
  onUnassign?: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `worker-${worker.id}` });
  const isOnSite  = !!jibble && !jibble.lastOut;
  const checkedIn = !!jibble;
  return (
    <div
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0.35 : 1 }}
      className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm transition-all select-none"
    >
      {/* Drag handle area */}
      <div {...attributes} {...listeners} className="flex items-center gap-2.5 flex-1 min-w-0 cursor-grab active:cursor-grabbing touch-none">
        <div className="relative shrink-0">
          <WorkerAvatar photoUrl={worker.photoUrl} name={worker.fullName} small />
          <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
            isOnSite ? "bg-emerald-500" : checkedIn ? "bg-amber-400" : "bg-slate-300"
          }`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-slate-800 leading-tight truncate">{worker.fullName}</p>
          {worker.trade && <p className="text-[11px] text-slate-400 leading-tight truncate">{worker.trade}</p>}
        </div>
      </div>
      {/* Right: assignment badge or unassign button */}
      {assignedProject ? (
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 max-w-[80px] truncate leading-tight">
            {assignedProject.name}
          </span>
          {onUnassign && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onUnassign(); }}
              className="w-5 h-5 flex items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
              title="배치 취소"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      ) : (
        <span className="text-[10px] text-slate-300 shrink-0">미배치</span>
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
        <p className="text-[11px] text-blue-500 leading-tight">드롭하여 배치</p>
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
}: {
  allProjects: Project[];
  workerList: Worker[];
  jibbleMap: Map<number, JibbleEntry>;
  getAssignment: (workerId: number) => number | null;
  groupOrder: string[];
  onGroupOrderChange: (order: string[]) => void;
  isDragActive?: boolean;
}) {
  const [expandedId,       setExpandedId]      = useState<number | null>(null);
  const [collapsedGroups,  setCollapsedGroups] = useState<Set<string>>(loadCollapsedGroups);
  const [searchQuery,      setSearchQuery]     = useState("");
  const [filterStatuses, setFilterStatuses] = useState<Set<string>>(new Set());
  const [showFilterMenu,   setShowFilterMenu]  = useState(false);
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
              placeholder="프로젝트명, PO 번호, 위치로 검색..."
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
              {filterStatuses.size > 0 ? `▼ ${filterStatuses.size}개` : "▼ 필터"}
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
                    필터 초기화
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        {isFiltering && <p className="text-xs text-slate-400">총 {totalCount}개 중 {filteredCount}개 표시</p>}
      </div>

      {filteredGroups.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-12">
          {isFiltering ? "검색 결과가 없습니다." : "등록된 프로젝트가 없습니다."}
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
                        <span className="font-semibold text-[13px] text-slate-800 truncate">{owner}</span>
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
                                  <CardContent className="px-5 py-4 flex gap-4 relative">
                                    {/* Drop hint overlay */}
                                    {isDragActive && isOver && (
                                      <div className="absolute inset-0 rounded-lg bg-blue-50/70 flex items-center justify-center z-10 pointer-events-none">
                                        <span className="text-sm font-bold text-blue-600">여기에 배치</span>
                                      </div>
                                    )}
                                    {/* Main content */}
                                    <div className="flex-1 min-w-0 space-y-1.5">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        {p.poNumber && <span className="text-xs font-mono text-slate-400 shrink-0">{p.poNumber}</span>}
                                        <span className="font-semibold text-slate-800 text-sm leading-tight">{p.name}</span>
                                      </div>
                                      {p.jobLocation && (
                                        <div className="flex items-center gap-1 text-xs text-slate-500">
                                          <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
                                          <span>{p.jobLocation}</span>
                                        </div>
                                      )}
                                      {isExpanded && (
                                        <div className="mt-2 pt-2 border-t border-slate-100">
                                          {workers.length === 0 ? (
                                            <p className="text-sm text-slate-400 italic py-1">배치된 작업자가 없습니다.</p>
                                          ) : (
                                            <div className="space-y-2 pt-1">
                                              {workers.map(({ worker, jibble }) => {
                                                const isOnSite  = !!jibble && !jibble.lastOut;
                                                const checkedIn = !!jibble;
                                                return (
                                                  <div key={worker.id} className="flex items-center gap-3">
                                                    <div className="relative shrink-0">
                                                      <WorkerAvatar photoUrl={worker.photoUrl} name={worker.fullName} small />
                                                      <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                                                        isOnSite ? "bg-emerald-500" : checkedIn ? "bg-amber-400" : "bg-slate-300"
                                                      }`} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                      <p className="text-sm font-medium text-slate-800 leading-tight truncate">{worker.fullName}</p>
                                                      {worker.trade && <p className="text-xs text-slate-400">{worker.trade}</p>}
                                                    </div>
                                                    <div className="flex items-center gap-4 tabular-nums shrink-0">
                                                      <div className="text-right">
                                                        <p className="text-[9px] text-slate-400 uppercase tracking-widest font-semibold leading-tight">출근</p>
                                                        <p className={`text-sm font-semibold leading-tight ${checkedIn ? "text-emerald-600" : "text-slate-300"}`}>
                                                          {fmtTime(jibble?.firstIn)}
                                                        </p>
                                                      </div>
                                                      <div className="text-right">
                                                        <p className="text-[9px] text-slate-400 uppercase tracking-widest font-semibold leading-tight">퇴근</p>
                                                        <p className={`text-sm font-semibold leading-tight ${jibble?.lastOut ? "text-slate-600" : "text-slate-300"}`}>
                                                          {jibble?.lastOut
                                                            ? fmtTime(jibble.lastOut)
                                                            : isOnSite
                                                              ? <span className="text-xs text-emerald-500 font-medium">근무 중</span>
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
                                    </div>
                                    {/* Right: status chip + worker count + expand */}
                                    <div className="shrink-0 flex flex-col items-end justify-start gap-1.5 pl-2 pt-0.5 min-w-[88px]">
                                      <span
                                        className="text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap text-right"
                                        style={{ backgroundColor: sc.bg, color: sc.text }}
                                      >
                                        {cardStatusLabel(p)}
                                      </span>
                                      <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
                                        workers.length > 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-400"
                                      }`}>
                                        <Users className="w-3 h-3" />{workers.length}명
                                      </span>
                                      {isExpanded
                                        ? <ChevronUp   className="w-4 h-4 text-slate-400" />
                                        : <ChevronDown className="w-4 h-4 text-slate-400" />}
                                    </div>
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

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function CrewDispatchAssignment() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dateStr,    setDateStr]    = useState<string>(() => toLocalDateStr(new Date()));
  const [groupOrder, setGroupOrder] = useState<string[]>(loadGroupOrder);
  // Small-screen tab state (lg+ always shows split pane)
  const [viewMode,   setViewMode]   = useState<"worker" | "project">("worker");

  // Worker drag state
  const [activeWorker,  setActiveWorker]  = useState<Worker | null>(null);

  // Left-panel search/filter
  const [workerSearch, setWorkerSearch] = useState("");
  const [workerFilter, setWorkerFilter] = useState<"all" | "onsite" | "unassigned">("all");

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
    const d = new Date(dateStr + "T00:00:00");
    d.setDate(d.getDate() + delta);
    setDateStr(toLocalDateStr(d));
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

  // ── Optimistic assignment state ───────────────────────────────────────────
  const [localOverride, setLocalOverride] = useState<Map<number, number | null>>(new Map());
  useEffect(() => { setLocalOverride(new Map()); }, [dateStr]);

  const assignMutation = useMutation({
    mutationFn: ({ workerId, projectId }: { workerId: number; projectId: number | null }) =>
      fetch(`/api/crew-dispatch/assignments/${workerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ date: dateStr, projectId }),
      }).then(async (r) => { if (!r.ok) throw new Error(await r.text()); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/crew-dispatch/assignments", dateStr] }); },
    onError: (err: any, variables) => {
      setLocalOverride((prev) => { const next = new Map(prev); next.delete(variables.workerId); return next; });
      toast({ title: "배치 저장 실패", description: err.message, variant: "destructive" });
    },
  });

  function handleAssign(workerId: number, projectId: number | null) {
    setLocalOverride((prev) => new Map(prev).set(workerId, projectId));
    assignMutation.mutate({ workerId, projectId });
  }

  function getAssignment(workerId: number): number | null {
    if (localOverride.has(workerId)) return localOverride.get(workerId) ?? null;
    return assignmentMap.get(workerId) ?? null;
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
        // Dropped outside a project — unassign
        if (getAssignment(workerId) !== null) {
          handleAssign(workerId, null);
          const worker = workerList.find((w) => w.id === workerId);
          toast({ title: `${worker?.fullName ?? "작업자"} 배치 해제` });
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
        toast({ title: `${worker?.fullName ?? "작업자"} → ${project?.name ?? "프로젝트"} 배치 완료` });
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
  const onSiteCount   = workerList.filter((w) => { const j = jibbleMap.get(w.id); return !!j && !j.lastOut; }).length;
  const isToday   = dateStr === toLocalDateStr(new Date());
  const isLoading = workersLoading || assignmentsLoading;

  const sortedWorkers = useMemo(() => sortWorkers(workerList, jibbleMap), [workerList, jibbleMap]);

  const filteredWorkers = useMemo(() => {
    const q = workerSearch.trim().toLowerCase();
    return sortedWorkers.filter((w) => {
      if (q && !w.fullName.toLowerCase().includes(q) && !(w.trade ?? "").toLowerCase().includes(q)) return false;
      if (workerFilter === "onsite") { const j = jibbleMap.get(w.id); return !!j && !j.lastOut; }
      if (workerFilter === "unassigned") return getAssignment(w.id) === null;
      return true;
    });
  }, [sortedWorkers, workerSearch, workerFilter, jibbleMap, localOverride, assignmentMap]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div>
        <h1 className="text-3xl font-display font-bold text-slate-900">작업자 배치</h1>
        <p className="text-slate-500 mt-1 text-sm">오늘 출근한 작업자를 프로젝트에 배치하세요.</p>
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
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 uppercase tracking-wide">오늘</span>
          )}
        </div>
        <button onClick={() => changeDate(1)} disabled={isToday}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 pt-4 pb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-50 shrink-0">
              <Users className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 uppercase tracking-wide font-semibold">현장 출근</p>
              <p className="text-2xl font-bold text-slate-800 leading-tight">{onSiteCount}명</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 pt-4 pb-4">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-50 shrink-0">
              <CheckCircle2 className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 uppercase tracking-wide font-semibold">배치 완료</p>
              <p className="text-2xl font-bold text-slate-800 leading-tight">
                {assignedCount}
                <span className="text-sm text-slate-400 ml-1 font-normal">/ {workerList.length}</span>
              </p>
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
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
            <p className="text-sm text-slate-400">불러오는 중...</p>
          </div>
        ) : (
          <>
            {/* ── lg+ : split pane ── */}
            <div className="hidden lg:flex gap-0 items-start border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">

              {/* Left: worker list */}
              <div className="w-[300px] xl:w-[340px] shrink-0 flex flex-col border-r border-slate-200">
                {/* Panel header */}
                <div className="px-4 pt-4 pb-3 border-b border-slate-100 bg-slate-50 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">작업자 ({sortedWorkers.length})</span>
                    <span className="text-[10px] text-slate-400">← 드래그하여 배치</span>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="이름으로 검색..."
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
                        {f === "all" ? "전체" : f === "onsite" ? "현장" : "미배치"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Worker list */}
                <div className="flex-1 overflow-y-auto p-3 space-y-1.5" style={{ maxHeight: "calc(100vh - 420px)" }}>
                  {filteredWorkers.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-10">해당하는 작업자가 없습니다.</p>
                  ) : (
                    filteredWorkers.map((w) => {
                      const assignedId = getAssignment(w.id);
                      return (
                      <DraggableWorkerRow
                        key={w.id}
                        worker={w}
                        jibble={jibbleMap.get(w.id)}
                        assignedProject={allProjects.find((p) => p.id === assignedId)}
                        onUnassign={assignedId !== null ? () => {
                          handleAssign(w.id, null);
                          toast({ title: `${w.fullName} 배치 취소` });
                        } : undefined}
                      />
                    );
                    })
                  )}
                </div>
              </div>

              {/* Right: project cards */}
              <div className="flex-1 min-w-0 overflow-y-auto p-4" style={{ maxHeight: "calc(100vh - 380px)" }}>
                <ProjectCardView
                  allProjects={displayedProjects}
                  workerList={workerList}
                  jibbleMap={jibbleMap}
                  getAssignment={getAssignment}
                  groupOrder={groupOrder}
                  onGroupOrderChange={setGroupOrder}
                  isDragActive={isDragActive}
                />
              </div>
            </div>

            {/* ── < lg: tab view ── */}
            <div className="lg:hidden space-y-4">
              <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 w-fit">
                {(["worker", "project"] as const).map((mode) => (
                  <button key={mode} type="button" onClick={() => setViewMode(mode)}
                    className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      viewMode === mode ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    }`}>
                    {mode === "worker" ? "👷 작업자별" : "🏗️ 프로젝트별"}
                  </button>
                ))}
              </div>

              {viewMode === "worker" && (
                <Card>
                  <CardContent className="p-0">
                    {workerList.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 gap-2">
                        <Users className="w-8 h-8 text-slate-200" />
                        <p className="text-sm text-slate-400">등록된 작업자가 없습니다.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-100 bg-slate-50">
                              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">작업자</th>
                              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">출근</th>
                              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">퇴근</th>
                              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">배치 프로젝트</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedWorkers.map((worker) => (
                              <WorkerRow
                                key={worker.id}
                                worker={worker}
                                jibble={jibbleMap.get(worker.id)}
                                assignedProjectId={getAssignment(worker.id)}
                                activeByCustomer={activeByCustomer}
                                doneProjects={doneProjects}
                                onAssign={(pid) => handleAssign(worker.id, pid)}
                              />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {viewMode === "project" && (
                <ProjectCardView
                  allProjects={displayedProjects}
                  workerList={workerList}
                  jibbleMap={jibbleMap}
                  getAssignment={getAssignment}
                  groupOrder={groupOrder}
                  onGroupOrderChange={setGroupOrder}
                />
              )}
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
