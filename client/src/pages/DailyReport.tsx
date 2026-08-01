import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Briefcase, MapPin, Calendar, ChevronRight, ChevronDown,
  Search, ClipboardList, FileText, CheckCircle2, Loader2,
  User, BarChart3, Hash, Filter,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  STATUS_CFG, type ProjectStatus,
} from "@/lib/mock-daily-report";
import type { Project } from "@shared/schema";
import { useLanguage } from "@/hooks/use-language";

// ─── localStorage keys ───────────────────────────────────────────────────────
const LS_HIDDEN   = "voltstock_dr_hidden_statuses_v1";
const LS_COLLAPSE = "voltstock_dr_collapsed_groups_v1";

// completed + cancelled hidden by default
const DEFAULT_HIDDEN = new Set<string>(["completed", "cancelled"]);

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

// ─── Palette (mirrors Projects.tsx) ──────────────────────────────────────────
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

// ─── Status badge ─────────────────────────────────────────────────────────────
function ProjectStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status as ProjectStatus] ?? {
    label: status,
    className: "bg-slate-100 text-slate-500 border-slate-200",
  };
  return (
    <Badge variant="outline" className={`${cfg.className} text-xs font-semibold px-2 py-0.5`}>
      {cfg.label}
    </Badge>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
  icon: Icon, label, value, accent, iconBg, iconColor, borderColor,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  accent: string;
  iconBg: string;
  iconColor: string;
  borderColor: string;
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
function ProjectCard({
  project, summary, onOpen,
}: {
  project: Project;
  summary: ReportSummary;
  onOpen: () => void;
}) {
  const { t } = useLanguage();
  const loc   = projectLocation(project);
  const owner = project.ownerName || project.customerName;

  return (
    <Card
      key={project.id}
      data-testid={`card-project-${project.id}`}
      className="hover:shadow-md transition-all duration-150 cursor-pointer group border border-slate-200"
      onClick={onOpen}
    >
      <CardContent className="px-5 py-4 flex gap-4">

        {/* Left icon */}
        <div className="flex items-start pt-0.5">
          <div className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${
            project.status === "active"    ? "bg-emerald-50" :
            project.status === "completed" ? "bg-teal-50"    :
            project.status === "on_hold"   ? "bg-amber-50"   :
                                             "bg-slate-100"
          }`}>
            <Briefcase className={`w-5 h-5 ${
              project.status === "active"    ? "text-emerald-600" :
              project.status === "completed" ? "text-teal-600"    :
              project.status === "on_hold"   ? "text-amber-600"   :
                                               "text-slate-400"
            }`} />
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-2">

          {/* Row 1: Name + PO + Status */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              data-testid={`text-project-name-${project.id}`}
              className="font-semibold text-slate-800 text-sm leading-tight"
            >
              {project.name}
            </span>
            <span
              data-testid={`text-project-po-${project.id}`}
              className="flex items-center gap-1 text-xs text-slate-400 font-medium shrink-0"
            >
              <Hash className="w-3 h-3" />
              {project.poNumber ? `${t.dailyReportPoPrefix} ${project.poNumber}` : t.dailyReportNoPo}
            </span>
            <ProjectStatusBadge status={project.status} />
          </div>

          {/* Row 2: Location + Owner */}
          <div className="flex items-center gap-4 flex-wrap">
            <span
              data-testid={`text-project-location-${project.id}`}
              className="flex items-center gap-1 text-xs text-slate-500"
            >
              <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
              {loc}
            </span>
            {owner && (
              <span
                data-testid={`text-project-owner-${project.id}`}
                className="flex items-center gap-1 text-xs text-slate-500 ml-auto"
              >
                <User className="w-3 h-3 shrink-0 text-slate-400" />
                {owner}
              </span>
            )}
          </div>

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
function CustomerGroup({
  groupKey, displayName, projects, summaryMap, collapsed, onToggle, onOpen,
}: {
  groupKey:    string;
  displayName: string;
  projects:    Project[];
  summaryMap:  Record<number, ReportSummary>;
  collapsed:   boolean;
  onToggle:    () => void;
  onOpen:      (id: number) => void;
}) {
  const isNone = groupKey === "__none__";
  const color  = groupAccentColor(groupKey);

  return (
    <div>
      {/* Group header */}
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
          <span className="text-[11px] text-slate-400 font-medium ml-1 shrink-0">
            {projects.length}
          </span>
        </div>
      </button>

      {/* Cards */}
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

  // Persist to localStorage
  useEffect(() => {
    try { localStorage.setItem(LS_HIDDEN,   JSON.stringify([...hiddenStatuses]));   } catch {}
  }, [hiddenStatuses]);
  useEffect(() => {
    try { localStorage.setItem(LS_COLLAPSE, JSON.stringify([...collapsedGroups])); } catch {}
  }, [collapsedGroups]);

  const { data: allProjects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: reportSummaries = [] } = useQuery<ReportSummary[]>({
    queryKey: ["/api/daily-reports-summary"],
    queryFn: async () => {
      const res = await fetch("/api/daily-reports-summary", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const summaryMap = useMemo(
    () => reportSummaries.reduce<Record<number, ReportSummary>>((acc, s) => {
      acc[s.projectId] = s;
      return acc;
    }, {}),
    [reportSummaries],
  );

  // All unique statuses present in the data
  const allStatusOptions = useMemo(
    () => [...new Set(allProjects.map((p) => p.status).filter(Boolean))]
            .sort() as ProjectStatus[],
    [allProjects],
  );

  // Filtered list (respects hidden statuses + search)
  const filtered = useMemo(() => allProjects.filter((p) => {
    if (hiddenStatuses.has(p.status ?? "")) return false;
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

  // Group by customer
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
    setHiddenStatuses(prev => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });
  }
  function toggleGroup(key: string) {
    setCollapsedGroups(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }

  // KPI counts always use full project list (unaffected by filter)
  const totalCount     = allProjects.length;
  const activeCount    = allProjects.filter((p) => p.status === "active").length;
  const completedCount = allProjects.filter((p) => p.status === "completed").length;

  const visibleCount = filtered.length;

  return (
    <div className="space-y-6">

      {/* ── Page header ── */}
      <div>
        <h1 className="text-3xl font-display font-bold text-slate-900">{t.dailyReportTitle}</h1>
        <p className="text-slate-500 mt-1">{t.dailyReportSubtitle}</p>
      </div>

      {/* ── KPI Cards (always full counts) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          icon={BarChart3}
          label={t.dailyReportTotalProjects}
          value={String(totalCount)}
          accent="bg-gradient-to-r from-slate-400 to-slate-500"
          iconBg="bg-slate-100"
          iconColor="text-slate-600"
          borderColor="border-slate-200"
        />
        <KpiCard
          icon={Briefcase}
          label={t.dailyReportActiveProjects}
          value={String(activeCount)}
          accent="bg-gradient-to-r from-emerald-400 to-green-500"
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          borderColor="border-emerald-200"
        />
        <KpiCard
          icon={CheckCircle2}
          label={t.dailyReportCompletedProjects}
          value={String(completedCount)}
          accent="bg-gradient-to-r from-teal-400 to-blue-500"
          iconBg="bg-teal-50"
          iconColor="text-teal-600"
          borderColor="border-teal-200"
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
                ? `${totalCount} ${totalCount !== 1 ? t.dailyReportProjectPlural : t.dailyReportProjectSingular}`
                : `${visibleCount} / ${totalCount}`}
          </span>
        </div>

        {/* Filters row */}
        <div className="flex gap-2 flex-wrap">
          {/* Search */}
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
                {hiddenStatuses.size === 0
                  ? t.dailyReportAll
                  : `${allStatusOptions.length - hiddenStatuses.size} / ${allStatusOptions.length}`}
                <ChevronDown className="w-3 h-3 ml-0.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-2" align="start">
              <div className="mb-1.5 flex items-center justify-between px-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status</span>
                {hiddenStatuses.size > 0 && (
                  <button
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-medium"
                    onClick={() => setHiddenStatuses(new Set())}
                  >
                    {t.dailyReportAll} 보기
                  </button>
                )}
              </div>
              {allStatusOptions.map((s) => {
                const visible = !hiddenStatuses.has(s);
                const cfg = STATUS_CFG[s] ?? { label: s, className: "" };
                return (
                  <label
                    key={s}
                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer hover:bg-slate-50 select-none"
                  >
                    <input
                      type="checkbox"
                      checked={visible}
                      onChange={() => toggleHidden(s)}
                      className="w-3.5 h-3.5 accent-blue-600 cursor-pointer"
                    />
                    <Badge variant="outline" className={`${cfg.className} text-xs font-semibold px-2 py-0`}>
                      {cfg.label}
                    </Badge>
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

        /* No projects at all */
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

        /* Nothing matches filters */
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

        /* Grouped project cards */
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
