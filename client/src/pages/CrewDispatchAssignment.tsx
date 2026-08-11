import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Users, CheckCircle2, MapPin, Loader2, Building2, GripVertical,
} from "lucide-react";
import {
  DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors, closestCenter,
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
/**
 * Sort priority: 0 = Working on it, 1 = Start soon, 2 = other active, 3 = done/completed
 */
function groupPriority(p: Project): number {
  const g = (p.mondayGroupTitle ?? "").toLowerCase();
  const s = (p.status ?? "").toLowerCase();
  if (g.includes("working on it") || g.includes("working")) return 0;
  if (g.includes("start soon") || g.includes("soon"))        return 1;
  if (
    ["completed", "cancelled", "canceled", "done"].includes(s) ||
    p.archived ||
    g.includes("done") || g.includes("complete") || g.includes("finish")
  ) return 3;
  return 2;
}

function statusLabel(p: Project): string {
  if (p.mondayGroupTitle) return p.mondayGroupTitle;
  const s = (p.status ?? "").toLowerCase();
  if (s === "active")                      return "진행 중";
  if (s === "on_hold")                     return "보류";
  if (s === "completed")                   return "완료";
  if (s === "cancelled" || s === "canceled") return "취소";
  return p.status ?? "";
}

function statusColors(p: Project): { bg: string; text: string } {
  const pri = groupPriority(p);
  if (pri === 0) return { bg: "#dcfce7", text: "#15803d" };   // green  — working on it
  if (pri === 1) return { bg: "#dbeafe", text: "#1d4ed8" };   // blue   — start soon
  if (pri === 3) return { bg: "#f1f5f9", text: "#94a3b8" };   // gray   — done
  return { bg: "#fef9c3", text: "#a16207" };                   // yellow — other
}

function sortProjects(list: Project[]): Project[] {
  return [...list].sort((a, b) => {
    const diff = groupPriority(a) - groupPriority(b);
    return diff !== 0 ? diff : a.name.localeCompare(b.name);
  });
}

// ─── localStorage persistence ─────────────────────────────────────────────────
const LS_GROUP_ORDER = "voltstock_cd_group_order_v1";
const LS_COLLAPSED   = "voltstock_cd_group_collapsed_v1";

function loadGroupOrder(): string[] {
  try {
    const s = localStorage.getItem(LS_GROUP_ORDER);
    if (s) return JSON.parse(s) as string[];
  } catch {}
  return [];
}
function saveGroupOrder(order: string[]) {
  try { localStorage.setItem(LS_GROUP_ORDER, JSON.stringify(order)); } catch {}
}
function loadCollapsedGroups(): Set<string> {
  try {
    const s = localStorage.getItem(LS_COLLAPSED);
    if (s) return new Set(JSON.parse(s) as string[]);
  } catch {}
  return new Set();
}
function saveCollapsedGroups(s: Set<string>) {
  try { localStorage.setItem(LS_COLLAPSED, JSON.stringify(Array.from(s))); } catch {}
}

// ─── Types ────────────────────────────────────────────────────────────────────
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

// ─── Worker row (worker-centric view) ─────────────────────────────────────────
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

  // If the assigned project is a completed one, always show it so the current value is visible
  const assignedDoneProject = doneProjects.find((p) => p.id === assignedProjectId);

  function handleValueChange(v: string) {
    if (v === "__show_completed__") { setShowCompleted((s) => !s); return; }
    onAssign(v === "__none__" ? null : parseInt(v));
  }

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">

      {/* Worker */}
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <WorkerAvatar photoUrl={worker.photoUrl} name={worker.fullName} />
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                isOnSite ? "bg-emerald-500" : checkedIn ? "bg-amber-400" : "bg-slate-300"
              }`}
              title={isOnSite ? "현장 근무 중" : checkedIn ? "퇴근" : "미출근"}
            />
          </div>
          <div>
            <p className="font-medium text-slate-800 text-sm leading-tight">{worker.fullName}</p>
            {worker.trade && <p className="text-xs text-slate-400 leading-tight">{worker.trade}</p>}
          </div>
        </div>
      </td>

      {/* 출근 시간 */}
      <td className="px-4 py-3 tabular-nums whitespace-nowrap">
        {checkedIn ? (
          <span className="text-sm text-emerald-600 font-semibold">{fmtTime(jibble!.firstIn)}</span>
        ) : (
          <span className="text-sm text-slate-300">—</span>
        )}
      </td>

      {/* 퇴근 시간 */}
      <td className="px-4 py-3 tabular-nums whitespace-nowrap">
        {jibble?.lastOut ? (
          <span className="text-sm text-slate-500 font-semibold">{fmtTime(jibble.lastOut)}</span>
        ) : isOnSite ? (
          <span className="text-xs text-emerald-500 font-medium">근무 중</span>
        ) : (
          <span className="text-sm text-slate-300">—</span>
        )}
      </td>

      {/* Project assignment */}
      <td className="px-4 py-3">
        <Select
          value={assignedProjectId !== null ? String(assignedProjectId) : "__none__"}
          onValueChange={handleValueChange}
        >
          <SelectTrigger
            className={`h-8 text-sm max-w-[280px] ${
              assignedProjectId !== null
                ? "border-amber-300 bg-amber-50 text-amber-800"
                : "border-slate-200 text-slate-400"
            }`}
          >
            <SelectValue placeholder="미배치" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">
              <span className="text-slate-400">— 미배치</span>
            </SelectItem>

            {/* Active projects grouped by 발주처 (customerName) */}
            {activeByCustomer.map(({ customer, projects }) => (
              <SelectGroup key={customer}>
                <SelectLabel className="text-[10px] text-slate-500 font-bold uppercase tracking-wider px-2 py-1 bg-slate-50">
                  {customer}
                </SelectLabel>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    <div className="flex items-center gap-2">
                      {p.poNumber && (
                        <span className="text-xs font-mono text-slate-400 shrink-0">{p.poNumber}</span>
                      )}
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

            {/* Completed projects — hidden by default */}
            {doneProjects.length > 0 && (
              <>
                <SelectSeparator />
                {/* Always show if currently assigned to a completed project */}
                {assignedDoneProject && !showCompleted && (
                  <SelectItem key={assignedDoneProject.id} value={String(assignedDoneProject.id)}>
                    <div className="flex items-center gap-2 opacity-60">
                      {assignedDoneProject.poNumber && (
                        <span className="text-xs font-mono text-slate-400 shrink-0">{assignedDoneProject.poNumber}</span>
                      )}
                      <span>{assignedDoneProject.name}</span>
                    </div>
                  </SelectItem>
                )}
                {showCompleted && doneProjects.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    <div className="flex items-center gap-2 opacity-60">
                      {p.poNumber && (
                        <span className="text-xs font-mono text-slate-400 shrink-0">{p.poNumber}</span>
                      )}
                      <span>{p.name}</span>
                    </div>
                  </SelectItem>
                ))}
                <SelectItem value="__show_completed__" className="text-slate-400 italic text-xs">
                  {showCompleted
                    ? "▲ 완료 프로젝트 접기"
                    : `▼ 완료된 프로젝트 보기 (${doneProjects.length}개)`}
                </SelectItem>
              </>
            )}
          </SelectContent>
        </Select>
      </td>
    </tr>
  );
}

// ─── Group accent color (mirrors DailyReport.tsx) ────────────────────────────
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

// ─── Sortable group wrapper ────────────────────────────────────────────────────
function SortableGroup({ id, children }: {
  id: string;
  children: (dragHandleProps: { attributes: any; listeners: any }) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 50 : undefined,
        position: "relative",
      }}
    >
      {children({ attributes, listeners })}
    </div>
  );
}

function ProjectCardView({
  allProjects,
  workerList,
  jibbleMap,
  getAssignment,
}: {
  allProjects: Project[];
  workerList: Worker[];
  jibbleMap: Map<number, JibbleEntry>;
  getAssignment: (workerId: number) => number | null;
}) {
  const [expandedId,      setExpandedId]      = useState<number | null>(null);
  const [hideCompleted,   setHideCompleted]   = useState<boolean>(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(loadCollapsedGroups);
  const [groupOrder,      setGroupOrder]      = useState<string[]>(loadGroupOrder);

  // Persist state to localStorage
  useEffect(() => { saveCollapsedGroups(collapsedGroups); }, [collapsedGroups]);
  useEffect(() => { saveGroupOrder(groupOrder); }, [groupOrder]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const completedCount = useMemo(
    () => allProjects.filter((p) => !p.archived && groupPriority(p) >= 3).length,
    [allProjects],
  );

  // Build groups; apply saved groupOrder to reorder them
  const groups = useMemo(() => {
    const nonArchived = allProjects.filter((p) => !p.archived);
    const visible     = hideCompleted ? nonArchived.filter((p) => groupPriority(p) < 3) : nonArchived;
    const sorted      = sortProjects(visible);
    const map         = new Map<string, Project[]>();
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
    // Reorder by saved groupOrder; append new groups not yet in order
    const byName = new Map(entries);
    const ordered   = groupOrder.map((k) => byName.get(k) ? ([k, byName.get(k)!] as [string, Project[]]) : null).filter(Boolean) as [string, Project[]][];
    const remaining = entries.filter(([k]) => !groupOrder.includes(k));
    return [...ordered, ...remaining];
  }, [allProjects, hideCompleted, groupOrder]);

  const groupIds = useMemo(() => groups.map(([owner]) => owner), [groups]);

  function toggleGroup(key: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = groupIds.indexOf(String(active.id));
    const newIndex = groupIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    setGroupOrder(arrayMove(groupIds, oldIndex, newIndex));
  }

  function getProjectWorkers(projectId: number) {
    return workerList
      .filter((w) => w.isActive && getAssignment(w.id) === projectId)
      .map((w) => ({ worker: w, jibble: jibbleMap.get(w.id) }));
  }

  return (
    <div className="space-y-3">
      {/* Completed filter toggle */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setHideCompleted((v) => !v)}
          className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
            hideCompleted
              ? "bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200"
              : "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
          }`}
        >
          {hideCompleted
            ? `완료 ${completedCount}개 숨김 — 보기`
            : `완료 ${completedCount}개 포함 — 숨기기`}
        </button>
      </div>

      {groups.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-12">
          {hideCompleted && completedCount > 0
            ? `활성 프로젝트가 없습니다. 완료 프로젝트 ${completedCount}개를 보려면 위 버튼을 누르세요.`
            : "등록된 프로젝트가 없습니다."}
        </p>
      )}

      {/* Single DndContext for group-level reordering */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={groupIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {groups.map(([owner, projects]) => {
              const color     = groupAccentColor(owner);
              const collapsed = collapsedGroups.has(owner);

              return (
                <SortableGroup key={owner} id={owner}>
                  {({ attributes, listeners }) => (
                    <div>
                      {/* Group header with drag handle */}
                      <div
                        className="w-full flex items-center h-10 bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-200 rounded-lg select-none mb-1"
                        style={{ borderLeftWidth: 4, borderLeftColor: color }}
                      >
                        {/* Drag handle — only this area drags */}
                        <div
                          {...attributes}
                          {...listeners}
                          className="w-8 flex items-center justify-center flex-shrink-0 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 transition-colors"
                        >
                          <GripVertical className="w-4 h-4" />
                        </div>

                        {/* Name + count — click to collapse */}
                        <button
                          type="button"
                          onClick={() => toggleGroup(owner)}
                          className="flex items-center gap-2 flex-1 min-w-0 pr-3 h-full text-left"
                        >
                          <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
                          <span className="font-semibold text-[13px] text-slate-800 truncate">{owner}</span>
                          <span className="text-[11px] text-slate-400 font-medium ml-1 shrink-0">{projects.length}</span>
                          <span className="ml-auto shrink-0">
                            {collapsed
                              ? <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                              : <ChevronDown  className="w-3.5 h-3.5 text-slate-400" />}
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
                              <Card
                                key={p.id}
                                className="hover:shadow-md transition-all duration-150 cursor-pointer border border-slate-200 bg-white"
                                onClick={() => setExpandedId(isExpanded ? null : p.id)}
                              >
                                <CardContent className="px-5 py-4 flex gap-4">
                                  {/* Main content */}
                                  <div className="flex-1 min-w-0 space-y-1.5">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {p.poNumber && (
                                        <span className="text-xs font-mono text-slate-400 shrink-0">{p.poNumber}</span>
                                      )}
                                      <span className="font-semibold text-slate-800 text-sm leading-tight">{p.name}</span>
                                      <span
                                        className="text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ml-auto"
                                        style={{ backgroundColor: sc.bg, color: sc.text }}
                                      >
                                        {statusLabel(p)}
                                      </span>
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
                                  {/* Right: worker count + expand */}
                                  <div className="shrink-0 flex flex-col items-end justify-start gap-2 pl-1 pt-0.5">
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
      </DndContext>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function CrewDispatchAssignment() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dateStr,  setDateStr]  = useState<string>(() => toLocalDateStr(new Date()));
  const [viewMode, setViewMode] = useState<"worker" | "project">("worker");

  function changeDate(delta: number) {
    const d = new Date(dateStr + "T00:00:00");
    d.setDate(d.getDate() + delta);
    setDateStr(toLocalDateStr(d));
  }

  // Workers
  const { data: workerList = [], isLoading: workersLoading } = useQuery<Worker[]>({
    queryKey: ["/api/workers"],
  });

  // Jibble active cache
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

  // Assignments for this date
  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery<Assignment[]>({
    queryKey: ["/api/crew-dispatch/assignments", dateStr],
    queryFn: async () => {
      const r = await fetch(`/api/crew-dispatch/assignments?date=${dateStr}`, { credentials: "include" });
      if (!r.ok) throw new Error(`assignments fetch failed: ${r.status}`);
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });
  const safeAssignments = Array.isArray(assignments) ? assignments : [];
  const assignmentMap = useMemo(
    () => new Map(safeAssignments.map((a) => [a.workerId, a.projectId])),
    [safeAssignments],
  );

  // All projects (sorted; split into active vs done for dropdown)
  const { data: allProjects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });
  // Build activeByCustomer groups for WorkerRow dropdown, plus doneProjects
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
    const activeByCustomer = Array.from(map.entries() as IterableIterator<[string, Project[]]>)
      .sort(([a], [b]) => {
        if (a === "고객사 미지정") return 1;
        if (b === "고객사 미지정") return -1;
        return a.localeCompare(b);
      })
      .map(([customer, projects]) => ({ customer, projects }));
    return { activeByCustomer, doneProjects: done };
  }, [allProjects]);

  // Optimistic local state — scoped to current dateStr
  const [localOverride, setLocalOverride] = useState<Map<number, number | null>>(new Map());
  useEffect(() => { setLocalOverride(new Map()); }, [dateStr]);

  const assignMutation = useMutation({
    mutationFn: ({ workerId, projectId }: { workerId: number; projectId: number | null }) =>
      fetch(`/api/crew-dispatch/assignments/${workerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ date: dateStr, projectId }),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/crew-dispatch/assignments", dateStr] }); },
    onError: (err: any, variables) => {
      setLocalOverride((prev) => {
        const next = new Map(prev);
        next.delete(variables.workerId);
        return next;
      });
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

  const assignedCount = workerList.filter((w) => getAssignment(w.id) !== null).length;
  const onSiteCount   = workerList.filter((w) => { const j = jibbleMap.get(w.id); return !!j && !j.lastOut; }).length;
  const isToday   = dateStr === toLocalDateStr(new Date());
  const isLoading = workersLoading || assignmentsLoading;

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
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 uppercase tracking-wide">
              오늘
            </span>
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

      {/* ── View toggle ── */}
      <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 w-fit">
        {(["worker", "project"] as const).map((mode) => (
          <button key={mode} type="button"
            onClick={() => setViewMode(mode)}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
              viewMode === mode
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}>
            {mode === "worker" ? "👷 작업자별" : "🏗️ 프로젝트별"}
          </button>
        ))}
      </div>

      {/* ── Worker-centric table ── */}
      {viewMode === "worker" && (
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
                <p className="text-sm text-slate-400">불러오는 중...</p>
              </div>
            ) : workerList.length === 0 ? (
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
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">출근 시간</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">퇴근 시간</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">배치 프로젝트</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workerList
                      .filter((w) => w.isActive)
                      .sort((a, b) => {
                        const ja = jibbleMap.get(a.id);
                        const jb = jibbleMap.get(b.id);
                        const scoreA = ja && !ja.lastOut ? 2 : ja ? 1 : 0;
                        const scoreB = jb && !jb.lastOut ? 2 : jb ? 1 : 0;
                        if (scoreA !== scoreB) return scoreB - scoreA;
                        return a.fullName.localeCompare(b.fullName);
                      })
                      .map((worker) => (
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

      {/* ── Project-centric card view ── */}
      {viewMode === "project" && (
        isLoading ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
            <p className="text-sm text-slate-400">불러오는 중...</p>
          </div>
        ) : (
          <ProjectCardView
            allProjects={allProjects}
            workerList={workerList}
            jibbleMap={jibbleMap}
            getAssignment={getAssignment}
          />
        )
      )}

    </div>
  );
}
