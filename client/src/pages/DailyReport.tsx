import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Briefcase, MapPin, Calendar, ChevronRight, ChevronDown,
  Search, ClipboardList, FileText, Loader2,
  Filter, Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Project, Worker } from "@shared/schema";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/hooks/use-auth";
import { FT } from "@/pages/daily-report/fieldTicketTheme";

// ─── localStorage keys (v2 — new defaults) ────────────────────────────────────
const LS_HIDDEN   = "voltstock_dr_hidden_statuses_v2";
const LS_COLLAPSE = "voltstock_dr_collapsed_groups_v1";

// Show ONLY "working on it" and "start soon" by default.
// Everything else is hidden until the user explicitly enables it.
const SHOW_BY_DEFAULT = new Set(["working on it", "start soon"]);
const ALL_KNOWN_STATUSES = [
  "active", "in progress", "on_hold", "on hold", "quote only",
  "stuck", "completed", "done", "cancelled", "canceled",
];
const DEFAULT_HIDDEN = new Set<string>(ALL_KNOWN_STATUSES);

function loadHidden(): Set<string> {
  try {
    const s = localStorage.getItem(LS_HIDDEN);
    if (s !== null) return new Set(JSON.parse(s));
  } catch {}
  return new Set(DEFAULT_HIDDEN);
}

function loadCollapsed(): Set<string> {
  try {
    const s = localStorage.getItem(LS_COLLAPSE);
    if (s !== null) return new Set(JSON.parse(s));
  } catch {}
  return new Set();
}

// ─── Monday status colors (mirrors Projects.tsx) ──────────────────────────────
const STATUS_COLOR_MAP: Array<{ keys: string[]; bg: string; text?: string }> = [
  { keys: ["active"],                               bg: "#00C875" },
  { keys: ["working on it", "in progress"],         bg: "#E8920B" },
  { keys: ["on_hold", "on hold"],                   bg: "#E09A2F" },
  { keys: ["quote only"],                           bg: "#8E8B82" },
  { keys: ["stuck"],                                bg: "#E2445C" },
  { keys: ["start soon"],                           bg: "#0095BD" },
  { keys: ["completed", "done"],                    bg: "#00C875" },
  { keys: ["cancelled", "canceled"],                bg: "#E2445C" },
];
function statusBg(s: string)   { const l = s.toLowerCase(); return STATUS_COLOR_MAP.find(e => e.keys.includes(l))?.bg   ?? "#C4C4C4"; }
// Field-Ticket: status chips are solid fill + white text (mapping logic unchanged)
function statusFg(_s: string)  { return "#ffffff"; }

// ─── Group palette (mirrors Projects.tsx) ─────────────────────────────────────
const GROUP_PALETTE = [
  "#0073EA","#00C875","#A25DDC","#FDBC64","#FF7575",
  "#579BFC","#9CD326","#FF9F43","#FF3D57","#7E5CB5",
];
function groupAccentColor(name: string): string {
  if (!name || name === "__none__") return "#C4C4C4";
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h * 31) + name.charCodeAt(i)) | 0;
  return GROUP_PALETTE[Math.abs(h) % GROUP_PALETTE.length];
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface ReportSummary {
  projectId: number;
  total:     number;
  draft:     number;
  submitted: number;
  lastDate:  string | null;
}

interface CrewAssignment {
  workerId:  number;
  projectId: number | null;
}

function todayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function projectLocation(p: Project): string {
  if (p.jobLocation) return p.jobLocation;
  const parts = [p.city, p.state].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "—";
}

function formatLastDate(date: string | null, noReportsLabel: string): string {
  if (!date) return noReportsLabel;
  return new Date(date).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

// ─── KPI Card (Field-Ticket) ──────────────────────────────────────────────────
function KpiCard({ label, value, ruleColor, valueColor }: {
  label: string; value: string; ruleColor: string; valueColor: string;
}) {
  return (
    <div
      className="min-w-0"
      style={{
        backgroundColor: FT.PAPER,
        border: `1px solid ${FT.RULE}`,
        borderTop: `3px solid ${ruleColor}`,
        borderRadius: 6,
      }}
    >
      <div className="px-3 py-2.5">
        <p
          className="text-[10px] uppercase tracking-tight font-semibold leading-tight"
          style={{ color: FT.TEXT_MUTED }}
        >
          {label}
        </p>
        <p
          className="leading-tight mt-0.5"
          style={{ fontFamily: FT.FONT, fontWeight: 800, fontSize: 25, color: valueColor }}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

// ─── Project card ─────────────────────────────────────────────────────────────
function ProjectCard({ project, summary, assignedCount, onOpen }: {
  project: Project; summary: ReportSummary; assignedCount?: number; onOpen: () => void;
}) {
  const { t } = useLanguage();
  const loc = projectLocation(project);

  return (
    <Card
      data-testid={`card-project-${project.id}`}
      className="hover:shadow-md transition-all duration-150 cursor-pointer group"
      style={{ backgroundColor: FT.PAPER, border: `1px solid ${FT.RULE}` }}
      onClick={onOpen}
    >
      <CardContent className="px-5 py-4 flex gap-4">

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-2">

          {/* Row 1: PO · Name · Monday status chip */}
          <div className="flex items-center gap-2 flex-wrap">
            {project.poNumber && (
              <span
                data-testid={`text-project-po-${project.id}`}
                className="text-xs font-mono text-slate-400 shrink-0"
              >
                {project.poNumber}
              </span>
            )}
            <span
              data-testid={`text-project-name-${project.id}`}
              className="font-bold leading-tight"
              style={{ fontSize: 15, color: FT.INK }}
            >
              {project.name}
            </span>
            {/* Crew assignment badge */}
            {assignedCount != null && assignedCount > 0 && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
                style={{ backgroundColor: "transparent", color: FT.INK, border: `1px solid ${FT.INK}` }}
              >
                <Users className="w-2.5 h-2.5" />
                {assignedCount}명
              </span>
            )}
            {/* Monday-style status chip */}
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ml-auto"
              style={{ backgroundColor: statusBg(project.status ?? ""), color: statusFg(project.status ?? "") }}
              data-testid={`chip-status-${project.id}`}
            >
              {project.status}
            </span>
          </div>

          {/* Row 2: Location */}
          {loc && loc !== "—" && (
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
              <span data-testid={`text-project-location-${project.id}`}>{loc}</span>
            </div>
          )}

          {/* Row 3: Report mini-stats */}
          <div className="flex items-center gap-4 pt-1 border-t border-slate-100 flex-wrap">
            <div className="flex items-center gap-1">
              <ClipboardList className="w-3 h-3 text-slate-300 shrink-0" />
              <span className="text-xs text-slate-400">{t.dailyReportTotal}</span>
              <span className="text-xs font-semibold text-slate-700 ml-0.5">{summary.total}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
              <span className="text-xs text-slate-400">{t.dailyReportDraft}</span>
              <span className="text-xs font-semibold text-amber-600 ml-0.5">{summary.draft}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-xs text-slate-400">{t.dailyReportSubmitted}</span>
              <span className="text-xs font-semibold text-emerald-700 ml-0.5">{summary.submitted}</span>
            </div>
            <div className="flex items-center gap-1 ml-auto">
              <Calendar className="w-3 h-3 text-slate-300 shrink-0" />
              <span className="text-xs text-slate-400">{t.dailyReportLast}</span>
              <span
                data-testid={`text-project-last-report-${project.id}`}
                className="text-xs font-medium text-slate-600 ml-0.5"
              >
                {formatLastDate(summary.lastDate, t.dailyReportNoReports)}
              </span>
            </div>
          </div>

        </div>

        {/* Right: Open button */}
        <div className="shrink-0 flex items-center self-center pl-2">
          <Button
            data-testid={`btn-open-project-${project.id}`}
            variant="outline"
            size="sm"
            className="gap-1 text-xs transition-colors bg-transparent hover:bg-transparent"
            style={{ border: `1.5px solid ${FT.INK}`, color: FT.INK, fontFamily: FT.FONT, fontWeight: 700, backgroundColor: "transparent" }}
            onClick={(e) => { e.stopPropagation(); onOpen(); }}
          >
            {t.dailyReportOpen}
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>

      </CardContent>
    </Card>
  );
}

// ─── Customer group ───────────────────────────────────────────────────────────
function CustomerGroup({ groupKey, displayName, projects, summaryMap, assignedCountMap, collapsed, onToggle, onOpen }: {
  groupKey: string; displayName: string; projects: Project[];
  summaryMap: Record<number, ReportSummary>;
  assignedCountMap: Map<number, number>;
  collapsed: boolean; onToggle: () => void; onOpen: (id: number) => void;
}) {
  const isNone = groupKey === "__none__";
  const color  = groupAccentColor(groupKey);

  return (
    <div>
      <button
        type="button"
        className="w-full flex items-center h-10 transition-colors rounded-lg text-left select-none mb-1"
        style={{ backgroundColor: FT.PAPER_MUTED, border: `1px solid ${FT.RULE}`, borderLeftWidth: 4, borderLeftColor: color }}
        onClick={onToggle}
        data-testid={`group-header-${groupKey}`}
      >
        <div className="w-8 flex items-center justify-center flex-shrink-0">
          {collapsed
            ? <ChevronRight className="w-3.5 h-3.5" style={{ color: FT.TEXT_MUTED }} />
            : <ChevronDown  className="w-3.5 h-3.5" style={{ color: FT.TEXT_MUTED }} />}
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-0 pr-3">
          <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
          <span className="font-semibold text-[13px] truncate" style={{ color: FT.INK }}>
            {isNone ? "고객사 미지정" : displayName}
          </span>
          <span className="text-[11px] text-slate-400 font-medium ml-1 shrink-0">{projects.length}</span>
        </div>
      </button>

      {!collapsed && (
        <div className="space-y-2 mb-3 pl-1">
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              summary={summaryMap[p.id] ?? { total: 0, draft: 0, submitted: 0, lastDate: null }}
              assignedCount={assignedCountMap.get(p.id)}
              onOpen={() => onOpen(p.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DailyReport() {
  const [, navigate] = useLocation();
  const { t } = useLanguage();
  const { user } = useAuth();

  const [search,          setSearch]          = useState("");
  const [hiddenStatuses,  setHiddenStatuses]  = useState<Set<string>>(loadHidden);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(loadCollapsed);
  const [othersCollapsed, setOthersCollapsed] = useState(true);

  useEffect(() => {
    try { localStorage.setItem(LS_HIDDEN,   JSON.stringify([...hiddenStatuses]));   } catch {}
  }, [hiddenStatuses]);
  useEffect(() => {
    try { localStorage.setItem(LS_COLLAPSE, JSON.stringify([...collapsedGroups])); } catch {}
  }, [collapsedGroups]);

  // Real-time Monday sync: refetch every 30 s so status changes propagate quickly
  const { data: allProjects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["/api/daily-report-projects"],
    refetchInterval: 30_000,
  });

  const { data: reportSummaries = [] } = useQuery<ReportSummary[]>({
    queryKey: ["/api/daily-reports-summary"],
    queryFn: async () => {
      const res = await fetch("/api/daily-reports-summary", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 30_000,
  });

  // Today's crew dispatch assignments — used to surface assigned projects at the top
  const todayStr = useMemo(() => todayDateStr(), []);
  const { data: crewAssignments = [] } = useQuery<CrewAssignment[]>({
    queryKey: ["/api/crew-dispatch/assignments", todayStr],
    queryFn: async () => {
      const res = await fetch(`/api/crew-dispatch/assignments?date=${todayStr}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 60_000,
  });

  // Worker record linked to the current user (if any) — used to filter assigned projects for non-admin users
  const { data: linkedWorker = null } = useQuery<Worker | null>({
    queryKey: ["/api/me/worker"],
    queryFn: async () => {
      const res = await fetch("/api/me/worker", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  // projectId → number of assigned workers today
  const assignedCountMap = useMemo(() => {
    const m = new Map<number, number>();
    crewAssignments.forEach((a) => {
      if (a.projectId == null) return;
      m.set(a.projectId, (m.get(a.projectId) ?? 0) + 1);
    });
    return m;
  }, [crewAssignments]);

  // Set of projectIds where the linked worker (if any) is assigned today.
  // Used to personalise the "오늘 배치된 프로젝트" section for non-admin managers.
  const myWorkerProjectIds = useMemo(() => {
    if (!linkedWorker) return null; // no linked worker → no filtering
    const ids = new Set<number>();
    crewAssignments.forEach((a) => {
      if (a.workerId === linkedWorker.id && a.projectId != null) ids.add(a.projectId);
    });
    return ids;
  }, [linkedWorker, crewAssignments]);

  // Whether to show only the current user's assigned projects in the highlighted section.
  // DailyReport is accessible to "manager", "staff" and "admin" roles (see useAuth/App.tsx).
  // - admin: always sees everything regardless of linked worker.
  // - manager with a linked worker record: sees only their own dispatched projects
  //   (treated as a foreman-manager / 작업반장).
  // - manager without a linked worker: falls back to seeing all (existing behaviour).
  // - staff: restricted to their own assigned projects only (see staffProjectIds below).
  const isStaff = user?.role === "staff";
  const isSelfFilterActive = (user?.role === "manager" || isStaff) && myWorkerProjectIds !== null;

  // Staff-only: distinct projectIds (across all dates) where this user's linked worker
  // was dispatched. null → no linked worker (staff sees nothing until an admin links one).
  const { data: staffProjectIds = null, isLoading: staffIdsLoading } = useQuery<number[] | null>({
    queryKey: ["/api/me/worker-project-ids"],
    queryFn: async () => {
      const res = await fetch("/api/me/worker-project-ids", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: isStaff,
    staleTime: 1000 * 60 * 5,
  });

  const summaryMap = useMemo(
    () => reportSummaries.reduce<Record<number, ReportSummary>>((acc, s) => { acc[s.projectId] = s; return acc; }, {}),
    [reportSummaries],
  );

  // All statuses present in the data (for the filter popover)
  const allStatusOptions = useMemo(
    () => [...new Set(allProjects.map((p) => p.status).filter(Boolean))].sort() as string[],
    [allProjects],
  );

  // On first load with the new v2 key, dynamically hide any status not in SHOW_BY_DEFAULT
  // that isn't already in DEFAULT_HIDDEN (covers unexpected Monday label values).
  useEffect(() => {
    if (localStorage.getItem(LS_HIDDEN) !== null) return; // user already has a preference
    const extra = allStatusOptions.filter(s => !SHOW_BY_DEFAULT.has(s.toLowerCase()) && !DEFAULT_HIDDEN.has(s.toLowerCase()));
    if (extra.length === 0) return;
    setHiddenStatuses(prev => new Set([...prev, ...extra]));
  }, [allStatusOptions]);

  // Staff only see projects they've been dispatched to (any date)
  const staffIdSet = useMemo(
    () => (isStaff ? new Set(staffProjectIds ?? []) : null),
    [isStaff, staffProjectIds],
  );

  const filtered = useMemo(() => allProjects.filter((p) => {
    if (staffIdSet && !staffIdSet.has(p.id)) return false;
    if (hiddenStatuses.has((p.status ?? "").toLowerCase())) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.poNumber ?? "").toLowerCase().includes(q) ||
      projectLocation(p).toLowerCase().includes(q) ||
      (p.customerName ?? "").toLowerCase().includes(q) ||
      (p.ownerName ?? "").toLowerCase().includes(q)
    );
  }), [allProjects, hiddenStatuses, search, staffIdSet]);

  // Split into assigned-today vs rest.
  // When isSelfFilterActive, "assigned" means ONLY projects where the current user's own
  // worker is dispatched (personalised view). Admins / users without a linked worker
  // see the full set of projects that have any crew assigned (original behaviour).
  const { assignedProjects, otherProjects } = useMemo(() => {
    const assigned: Project[] = [];
    const other:    Project[] = [];
    filtered.forEach((p) => {
      if (isSelfFilterActive) {
        // myWorkerProjectIds is non-null when isSelfFilterActive is true
        (myWorkerProjectIds!.has(p.id) ? assigned : other).push(p);
      } else {
        (assignedCountMap.has(p.id) ? assigned : other).push(p);
      }
    });
    return { assignedProjects: assigned, otherProjects: other };
  }, [filtered, assignedCountMap, isSelfFilterActive, myWorkerProjectIds]);

  const hasAssigned = assignedProjects.length > 0;

  // Group the "other" projects by customer (same logic as before)
  const otherGroups = useMemo(() => {
    const map = new Map<string, { displayName: string; projects: Project[] }>();
    otherProjects.forEach((p) => {
      const raw = p.customerName?.trim() || p.ownerName?.trim() || "";
      const k   = raw ? raw.toLowerCase() : "__none__";
      if (!map.has(k)) map.set(k, { displayName: raw || "__none__", projects: [] });
      map.get(k)!.projects.push(p);
    });
    return [...map.entries()].sort(([a], [b]) => {
      if (a === "__none__") return 1;
      if (b === "__none__") return -1;
      return a.localeCompare(b);
    });
  }, [otherProjects]);

  // Legacy: full group list used when there are no assigned projects
  const allGroups = useMemo(() => {
    const map = new Map<string, { displayName: string; projects: Project[] }>();
    filtered.forEach((p) => {
      const raw = p.customerName?.trim() || p.ownerName?.trim() || "";
      const k   = raw ? raw.toLowerCase() : "__none__";
      if (!map.has(k)) map.set(k, { displayName: raw || "__none__", projects: [] });
      map.get(k)!.projects.push(p);
    });
    return [...map.entries()].sort(([a], [b]) => {
      if (a === "__none__") return 1;
      if (b === "__none__") return -1;
      return a.localeCompare(b);
    });
  }, [filtered]);

  function toggleHidden(s: string) {
    setHiddenStatuses(prev => {
      const n = new Set(prev);
      n.has(s) ? n.delete(s) : n.add(s);
      return n;
    });
  }
  function toggleGroup(key: string) {
    setCollapsedGroups(prev => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  }

  // KPI uses the full project list for admin/manager, but only the staff-scoped
  // project set for staff (no totals disclosed for unassigned projects).
  const kpiProjects = useMemo(
    () => (staffIdSet ? allProjects.filter((p) => staffIdSet.has(p.id)) : allProjects),
    [allProjects, staffIdSet],
  );
  const totalCount     = kpiProjects.length;
  const activeCount    = kpiProjects.filter((p) => !["completed","cancelled","canceled","done"].includes((p.status ?? "").toLowerCase())).length;
  const completedCount = kpiProjects.filter((p) => ["completed","done"].includes((p.status ?? "").toLowerCase())).length;
  const visibleCount   = filtered.length;

  // How many visible statuses vs total
  const visibleStatusCount = allStatusOptions.filter(s => !hiddenStatuses.has(s.toLowerCase())).length;

  return (
    <div className="space-y-6" style={{ backgroundColor: FT.PAPER }}>

      {/* ── Page header ── */}
      <div>
        <h1
          className="uppercase"
          style={{ fontFamily: FT.FONT, fontWeight: 800, fontSize: 25, color: FT.INK, letterSpacing: "0.02em" }}
        >
          {t.dailyReportTitle}
        </h1>
        <p className="mt-1" style={{ fontSize: 13, color: FT.TEXT_MUTED }}>{t.dailyReportSubtitle}</p>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-3 gap-2">
        <KpiCard
          label={t.dailyReportTotalProjects}
          value={String(totalCount)}
          ruleColor={FT.INK} valueColor={FT.INK}
        />
        <KpiCard
          label={t.dailyReportActiveProjects}
          value={String(activeCount)}
          ruleColor={FT.ACCENT} valueColor={FT.ACCENT}
        />
        <KpiCard
          label={t.dailyReportCompletedProjects}
          value={String(completedCount)}
          ruleColor={FT.SUCCESS} valueColor={FT.SUCCESS}
        />
      </div>

      {/* ── Project List ── */}
      <div className="space-y-3">

        {/* Section header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ backgroundColor: FT.PAPER_MUTED }}>
              <Briefcase className="w-4 h-4" style={{ color: FT.TEXT_MUTED }} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-800 leading-tight">{t.dailyReportProjectList}</h2>
              <p className="text-xs text-slate-400">{t.dailyReportProjectListHint}</p>
            </div>
          </div>
          <span className="text-xs text-slate-400">
            {isLoading
              ? t.dailyReportLoading
              : visibleCount === totalCount
                ? `${totalCount}`
                : `${visibleCount} / ${totalCount}`}
          </span>
        </div>

        {/* Filters row */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input
              data-testid="input-project-search"
              placeholder={t.dailyReportSearchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
              style={{ backgroundColor: FT.PAPER, border: `1px solid ${FT.RULE}` }}
            />
          </div>

          {/* Status filter popover */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="h-9 flex items-center gap-1.5 px-3 rounded-md text-sm font-medium transition-colors"
                style={
                  hiddenStatuses.size > 0
                    ? { border: `1.5px solid ${FT.INK}`, color: FT.INK, backgroundColor: FT.PAPER_MUTED }
                    : { border: `1.5px solid ${FT.INK}`, color: FT.TEXT_MUTED, backgroundColor: "transparent" }
                }
                data-testid="btn-status-filter"
              >
                <Filter className="w-3.5 h-3.5" />
                {allStatusOptions.length === 0
                  ? "Status"
                  : `${visibleStatusCount} / ${allStatusOptions.length}`}
                <ChevronDown className="w-3 h-3 ml-0.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="start">
              <div className="mb-1.5 flex items-center justify-between px-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status</span>
                {hiddenStatuses.size > 0 && (
                  <button
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-medium"
                    onClick={() => setHiddenStatuses(new Set())}
                  >
                    모두 보기
                  </button>
                )}
              </div>
              {allStatusOptions.map((s) => {
                const visible = !hiddenStatuses.has(s.toLowerCase());
                return (
                  <label
                    key={s}
                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer hover:bg-slate-50 select-none"
                  >
                    <input
                      type="checkbox"
                      checked={visible}
                      onChange={() => toggleHidden(s.toLowerCase())}
                      className="w-3.5 h-3.5 accent-blue-600 cursor-pointer"
                    />
                    <span
                      className="text-[11px] font-bold px-2 py-0.5 rounded"
                      style={{ backgroundColor: statusBg(s), color: statusFg(s) }}
                    >
                      {s}
                    </span>
                  </label>
                );
              })}
            </PopoverContent>
          </Popover>
        </div>

        {/* Loading */}
        {isLoading ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-8 h-8 text-slate-300 animate-spin" />
              <p className="text-sm text-slate-400">{t.dailyReportLoadingProjects}</p>
            </CardContent>
          </Card>

        ) : allProjects.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-100">
                <Briefcase className="w-7 h-7 text-slate-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-slate-600">{t.dailyReportNoProjectsYet}</p>
                <p className="text-xs text-slate-400 mt-0.5">{t.dailyReportNoProjectsHint}</p>
              </div>
            </CardContent>
          </Card>

        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-100">
                <FileText className="w-7 h-7 text-slate-400" />
              </div>
              <div className="text-center">
                {isStaff && staffIdSet !== null && staffIdSet.size === 0 && !staffIdsLoading ? (
                  <>
                    <p className="text-sm font-medium text-slate-600">배치된 프로젝트가 없습니다</p>
                    <p className="text-xs text-slate-400 mt-0.5">프로젝트에 배치되면 여기에 표시됩니다. 계정이 작업자와 연결되지 않았다면 관리자에게 문의하세요.</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-slate-600">{t.dailyReportNoProjectsFound}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{t.dailyReportTryAdjusting}</p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

        ) : hasAssigned ? (
          <div className="space-y-4">

            {/* ── 오늘 배치된 프로젝트 ── */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 px-1 mb-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-md shrink-0" style={{ backgroundColor: FT.INK }}>
                  <Users className="w-3.5 h-3.5" style={{ color: FT.ACCENT }} />
                </span>
                <span className="text-sm font-semibold" style={{ color: FT.INK }}>
                  {isSelfFilterActive ? t.dailyReportMyProjects : t.dailyReportTodayProjects}
                </span>
                <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: FT.ACCENT, color: "#fff" }}>{assignedProjects.length}</span>
              </div>
              <div className="space-y-2">
                {assignedProjects.map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    summary={summaryMap[p.id] ?? { total: 0, draft: 0, submitted: 0, lastDate: null }}
                    assignedCount={assignedCountMap.get(p.id)}
                    onOpen={() => navigate(`/daily-report/${p.id}`)}
                  />
                ))}
              </div>
            </div>

            {/* ── 나머지 프로젝트 (접힘) ── */}
            {otherProjects.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setOthersCollapsed((v) => !v)}
                  className="w-full flex items-center h-9 px-3 rounded-lg text-left select-none transition-colors"
                  style={{ border: `1px solid ${FT.RULE}`, backgroundColor: FT.PAPER_MUTED }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = FT.RULE; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = FT.PAPER_MUTED; }}
                >
                  <div className="w-5 flex items-center justify-center flex-shrink-0 mr-2">
                    {othersCollapsed
                      ? <ChevronRight className="w-3.5 h-3.5" style={{ color: FT.TEXT_MUTED }} />
                      : <ChevronDown  className="w-3.5 h-3.5" style={{ color: FT.TEXT_MUTED }} />}
                  </div>
                  <span className="text-xs font-medium" style={{ color: FT.INK }}>{t.dailyReportOtherProjects}</span>
                  <span className="text-xs ml-1.5 font-medium" style={{ color: FT.TEXT_MUTED }}>{otherProjects.length}</span>
                </button>

                {!othersCollapsed && (
                  <div className="space-y-1 mt-2">
                    {otherGroups.map(([key, { displayName, projects }]) => (
                      <CustomerGroup
                        key={key}
                        groupKey={key}
                        displayName={displayName}
                        projects={projects}
                        summaryMap={summaryMap}
                        assignedCountMap={assignedCountMap}
                        collapsed={collapsedGroups.has(key)}
                        onToggle={() => toggleGroup(key)}
                        onOpen={(id) => navigate(`/daily-report/${id}`)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>

        ) : (
          // No assigned projects — show all groups as before
          <div className="space-y-1">
            {allGroups.map(([key, { displayName, projects }]) => (
              <CustomerGroup
                key={key}
                groupKey={key}
                displayName={displayName}
                projects={projects}
                summaryMap={summaryMap}
                assignedCountMap={assignedCountMap}
                collapsed={collapsedGroups.has(key)}
                onToggle={() => toggleGroup(key)}
                onOpen={(id) => navigate(`/daily-report/${id}`)}
              />
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
