import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Briefcase, MapPin, Calendar, ChevronRight, ChevronDown,
  Search, ClipboardList, FileText, CheckCircle2, Loader2,
  BarChart3, Filter,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Project } from "@shared/schema";
import { useLanguage } from "@/hooks/use-language";

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
  { keys: ["working on it", "in progress"],         bg: "#FDAB3D", text: "#1a1a1a" },
  { keys: ["on_hold", "on hold"],                   bg: "#FDBC64", text: "#1a1a1a" },
  { keys: ["quote only"],                           bg: "#C4C4C4", text: "#1a1a1a" },
  { keys: ["stuck"],                                bg: "#E2445C" },
  { keys: ["start soon"],                           bg: "#00C4F4", text: "#1a1a1a" },
  { keys: ["completed", "done"],                    bg: "#00C875" },
  { keys: ["cancelled", "canceled"],                bg: "#E2445C" },
];
function statusBg(s: string)   { const l = s.toLowerCase(); return STATUS_COLOR_MAP.find(e => e.keys.includes(l))?.bg   ?? "#C4C4C4"; }
function statusFg(s: string)   { const l = s.toLowerCase(); return STATUS_COLOR_MAP.find(e => e.keys.includes(l))?.text ?? "#ffffff"; }

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

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, accent, iconBg, iconColor, borderColor }: {
  icon: React.ElementType; label: string; value: string;
  accent: string; iconBg: string; iconColor: string; borderColor: string;
}) {
  return (
    <Card className={`overflow-hidden border ${borderColor}`}>
      <div className={`h-1 ${accent}`} />
      <CardContent className="px-5 py-5">
        <div className="flex items-start gap-4">
          <div className={`flex items-center justify-center w-11 h-11 rounded-xl shrink-0 ${iconBg}`}>
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-slate-400 uppercase tracking-widest font-semibold">{label}</p>
            <p className="text-3xl font-bold text-slate-800 leading-tight mt-0.5">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Project card ─────────────────────────────────────────────────────────────
function ProjectCard({ project, summary, onOpen }: {
  project: Project; summary: ReportSummary; onOpen: () => void;
}) {
  const { t } = useLanguage();
  const loc = projectLocation(project);

  return (
    <Card
      data-testid={`card-project-${project.id}`}
      className="hover:shadow-md transition-all duration-150 cursor-pointer group border border-slate-200"
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
              className="font-semibold text-slate-800 text-sm leading-tight"
            >
              {project.name}
            </span>
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
            className="gap-1 text-xs group-hover:bg-blue-50 group-hover:text-blue-700 group-hover:border-blue-200 transition-colors"
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
function CustomerGroup({ groupKey, displayName, projects, summaryMap, collapsed, onToggle, onOpen }: {
  groupKey: string; displayName: string; projects: Project[];
  summaryMap: Record<number, ReportSummary>;
  collapsed: boolean; onToggle: () => void; onOpen: (id: number) => void;
}) {
  const isNone = groupKey === "__none__";
  const color  = groupAccentColor(groupKey);

  return (
    <div>
      <button
        type="button"
        className="w-full flex items-center h-10 bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-200 rounded-lg text-left select-none mb-1"
        style={{ borderLeftWidth: 4, borderLeftColor: color }}
        onClick={onToggle}
        data-testid={`group-header-${groupKey}`}
      >
        <div className="w-8 flex items-center justify-center flex-shrink-0">
          {collapsed
            ? <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
            : <ChevronDown  className="w-3.5 h-3.5 text-slate-500" />}
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-0 pr-3">
          <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
          <span className="font-semibold text-[13px] text-slate-800 truncate">
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

  const [search,          setSearch]          = useState("");
  const [hiddenStatuses,  setHiddenStatuses]  = useState<Set<string>>(loadHidden);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(loadCollapsed);

  useEffect(() => {
    try { localStorage.setItem(LS_HIDDEN,   JSON.stringify([...hiddenStatuses]));   } catch {}
  }, [hiddenStatuses]);
  useEffect(() => {
    try { localStorage.setItem(LS_COLLAPSE, JSON.stringify([...collapsedGroups])); } catch {}
  }, [collapsedGroups]);

  // Real-time Monday sync: refetch every 30 s so status changes propagate quickly
  const { data: allProjects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
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

  const filtered = useMemo(() => allProjects.filter((p) => {
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
  }), [allProjects, hiddenStatuses, search]);

  // Group by customer (customerName first, then ownerName)
  const groups = useMemo(() => {
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

  // KPI always uses full project list
  const totalCount     = allProjects.length;
  const activeCount    = allProjects.filter((p) => !["completed","cancelled","canceled","done"].includes((p.status ?? "").toLowerCase())).length;
  const completedCount = allProjects.filter((p) => ["completed","done"].includes((p.status ?? "").toLowerCase())).length;
  const visibleCount   = filtered.length;

  // How many visible statuses vs total
  const visibleStatusCount = allStatusOptions.filter(s => !hiddenStatuses.has(s.toLowerCase())).length;

  return (
    <div className="space-y-6">

      {/* ── Page header ── */}
      <div>
        <h1 className="text-3xl font-display font-bold text-slate-900">{t.dailyReportTitle}</h1>
        <p className="text-slate-500 mt-1">{t.dailyReportSubtitle}</p>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          icon={BarChart3}     label={t.dailyReportTotalProjects}
          value={String(totalCount)}
          accent="bg-gradient-to-r from-slate-400 to-slate-500"
          iconBg="bg-slate-100" iconColor="text-slate-600" borderColor="border-slate-200"
        />
        <KpiCard
          icon={Briefcase}     label={t.dailyReportActiveProjects}
          value={String(activeCount)}
          accent="bg-gradient-to-r from-emerald-400 to-green-500"
          iconBg="bg-emerald-50" iconColor="text-emerald-600" borderColor="border-emerald-200"
        />
        <KpiCard
          icon={CheckCircle2}  label={t.dailyReportCompletedProjects}
          value={String(completedCount)}
          accent="bg-gradient-to-r from-teal-400 to-blue-500"
          iconBg="bg-teal-50" iconColor="text-teal-600" borderColor="border-teal-200"
        />
      </div>

      {/* ── Project List ── */}
      <div className="space-y-3">

        {/* Section header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50">
              <Briefcase className="w-4 h-4 text-blue-600" />
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
            />
          </div>

          {/* Status filter popover */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                className={`h-9 flex items-center gap-1.5 px-3 rounded-md border text-sm font-medium transition-colors ${
                  hiddenStatuses.size > 0
                    ? "border-blue-400 bg-blue-50 text-blue-700"
                    : "border-slate-300 text-slate-600 hover:border-slate-400 hover:bg-slate-50"
                }`}
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
                <p className="text-sm font-medium text-slate-600">{t.dailyReportNoProjectsFound}</p>
                <p className="text-xs text-slate-400 mt-0.5">{t.dailyReportTryAdjusting}</p>
              </div>
            </CardContent>
          </Card>

        ) : (
          <div className="space-y-1">
            {groups.map(([key, { displayName, projects }]) => (
              <CustomerGroup
                key={key}
                groupKey={key}
                displayName={displayName}
                projects={projects}
                summaryMap={summaryMap}
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
