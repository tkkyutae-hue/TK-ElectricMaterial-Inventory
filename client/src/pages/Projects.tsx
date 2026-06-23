import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useProjects } from "@/hooks/use-reference-data";
import { useAuth } from "@/hooks/use-auth";
import {
  Briefcase, MapPin, Calendar, ChevronRight,
  ChevronDown, ArrowUp, ArrowDown, ChevronsUpDown, ExternalLink,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { useLanguage } from "@/hooks/use-language";

// ─────────────────────────────────────────────────────────────────────────────
// Status colors — handles both legacy VoltStock enums and raw Monday labels
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_COLOR_MAP: Array<{ keys: string[]; bg: string; text?: string }> = [
  { keys: ["active", "working on it", "in progress"],          bg: "#0073EA" },
  { keys: ["on_hold", "quote only", "stuck", "on hold"],       bg: "#FDBC64", text: "#1a1a1a" },
  { keys: ["completed", "done"],                               bg: "#00C875" },
  { keys: ["cancelled", "canceled"],                           bg: "#E2445C" },
];

function statusBg(status: string): string {
  const lower = (status || "").toLowerCase();
  return STATUS_COLOR_MAP.find(e => e.keys.includes(lower))?.bg ?? "#C4C4C4";
}
function statusTextColor(status: string): string {
  const lower = (status || "").toLowerCase();
  return STATUS_COLOR_MAP.find(e => e.keys.includes(lower))?.text ?? "#ffffff";
}

const STATUS_ORDER: Record<string, number> = { active: 0, "working on it": 0, on_hold: 1, "quote only": 1, completed: 2, done: 2, cancelled: 3, canceled: 3 };

function statusLabelOf(value: string, t: any): string {
  switch (value) {
    case "active":    return t.projStatusActive;
    case "on_hold":   return t.projStatusOnHold;
    case "completed": return t.projStatusCompleted;
    case "cancelled": return t.projStatusCancelled;
    default:          return value;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Group accent color
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// Column widths
// ─────────────────────────────────────────────────────────────────────────────
const LS_COL  = "tkelectric_project_col_widths_v2";
const MIN_COL = 60;

type ColWidths = { po: number; name: number; customer: number; location: number; timeline: number; status: number };
const DEFAULT_WIDTHS: ColWidths = { po: 128, name: 260, customer: 144, location: 152, timeline: 200, status: 128 };

function loadWidths(): ColWidths {
  try { const s = localStorage.getItem(LS_COL); if (s) return { ...DEFAULT_WIDTHS, ...JSON.parse(s) }; } catch {}
  return { ...DEFAULT_WIDTHS };
}

function ResizeHandle({ col, cw, setColWidths }: { col: keyof ColWidths; cw: ColWidths; setColWidths: React.Dispatch<React.SetStateAction<ColWidths>> }) {
  const startX = useRef(0), startW = useRef(0);
  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    startX.current = e.clientX; startW.current = cw[col];
    function onMove(ev: MouseEvent) { setColWidths(p => ({ ...p, [col]: Math.max(MIN_COL, startW.current + ev.clientX - startX.current) })); }
    function onUp()  { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); }
    document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp);
  }
  return (
    <div className="absolute right-0 top-0 h-full w-3 cursor-col-resize flex items-center justify-center group/rh select-none z-10" onMouseDown={onMouseDown}>
      <div className="w-px h-4 rounded-full bg-slate-300 group-hover/rh:bg-brand-400 transition-colors" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sort
// ─────────────────────────────────────────────────────────────────────────────
type SortCol = "po" | "name" | "customer" | "location" | "timeline" | "status";
type SortDir = "asc" | "desc" | null;
type SortState = { col: SortCol | null; dir: SortDir };

function cmpProjects(a: any, b: any, col: SortCol, dir: SortDir): number {
  let av: any = "", bv: any = "";
  if (col === "po")       { av = a.poNumber || ""; bv = b.poNumber || ""; }
  if (col === "name")     { av = a.name || ""; bv = b.name || ""; }
  if (col === "customer") { av = a.customerName || ""; bv = b.customerName || ""; }
  if (col === "location") { av = a.jobLocation || ""; bv = b.jobLocation || ""; }
  if (col === "status")   { av = STATUS_ORDER[a.status] ?? 99; bv = STATUS_ORDER[b.status] ?? 99; }
  if (col === "timeline") {
    av = a.startDate || "9999"; bv = b.startDate || "9999";
    if (av === bv) { av = a.endDate || "9999"; bv = b.endDate || "9999"; }
  }
  const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
  return dir === "asc" ? cmp : -cmp;
}

function SortIcon({ col, ss }: { col: SortCol; ss: SortState }) {
  const cls = "w-3 h-3 flex-shrink-0";
  if (ss.col !== col) return <ChevronsUpDown className={`${cls} text-slate-400 group-hover/hdr:text-slate-600 transition-colors`} />;
  if (ss.dir === "asc")  return <ArrowUp   className={`${cls} text-brand-500`} />;
  return <ArrowDown className={`${cls} text-brand-500`} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Read-only status cell
// ─────────────────────────────────────────────────────────────────────────────
function MondayStatusCell({ projectId, status }: { projectId: number; status: string }) {
  const { t } = useLanguage();
  return (
    <div
      className="w-full h-full flex items-center justify-center text-[11px] font-bold select-none"
      style={{ backgroundColor: statusBg(status), color: statusTextColor(status) }}
      data-testid={`chip-status-${projectId}`}
    >
      {statusLabelOf(status, t)}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Read-only timeline cell
// ─────────────────────────────────────────────────────────────────────────────
function TimelineCell({ startDate, endDate }: { startDate?: string | null; endDate?: string | null }) {
  function fmtShort(d: string | null | undefined) {
    if (!d) return "—";
    try { return format(new Date(d + "T00:00:00"), "MMM d"); } catch { return d; }
  }
  const isEmpty = !startDate && !endDate;
  return (
    <div className="flex items-center gap-1 truncate">
      {isEmpty
        ? <span className="text-slate-300 text-sm select-none">—</span>
        : <>
            <Calendar className="w-3 h-3 text-slate-300 flex-shrink-0" />
            <span className="text-sm text-slate-700 truncate">{fmtShort(startDate)} – {fmtShort(endDate)}</span>
          </>
      }
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sortable column header cell
// ─────────────────────────────────────────────────────────────────────────────
const CH = "text-[10px] font-bold text-slate-500 uppercase tracking-widest";

function SortableHeader({ label, col, ss, onSort, cw, cwKey, setColWidths, className = "" }: {
  label: string; col: SortCol; ss: SortState; onSort: (c: SortCol) => void;
  cw: ColWidths; cwKey: keyof ColWidths; setColWidths: React.Dispatch<React.SetStateAction<ColWidths>>;
  className?: string;
}) {
  return (
    <div
      className={`relative flex-shrink-0 flex items-center gap-1 cursor-pointer group/hdr select-none pr-3 border-r border-slate-200 last:border-r-0 ${className}`}
      style={{ width: cw[cwKey] }}
      onClick={() => onSort(col)}
    >
      <span className={CH}>{label}</span>
      <SortIcon col={col} ss={ss} />
      <ResizeHandle col={cwKey} cw={cw} setColWidths={setColWidths} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Customer Group
// ─────────────────────────────────────────────────────────────────────────────
function CustomerGroup({
  customerName, projects, collapsed, onToggle,
  cw, mondayBoardId, onRowClick,
}: {
  customerName: string; projects: any[]; collapsed: boolean; onToggle: () => void;
  cw: ColWidths;
  mondayBoardId: string | null;
  onRowClick: (id: number) => void;
}) {
  const { t } = useLanguage();
  const isNoCustomer = customerName === "__none__";
  const color = groupAccentColor(customerName);
  const isMondaySynced = projects.some((p: any) => p.source === "monday");

  return (
    <div>
      {/* Group header */}
      <button
        className="w-full flex items-center h-10 bg-[#F5F6F8] hover:bg-[#EEF0F3] transition-colors border-b border-slate-200 text-left select-none"
        style={{ borderLeft: `4px solid ${color}` }}
        onClick={onToggle}
        data-testid={`group-header-${customerName}`}
      >
        <div className="w-8 flex items-center justify-center flex-shrink-0">
          {collapsed
            ? <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
            : <ChevronDown  className="w-3.5 h-3.5 text-slate-500" />}
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-0 pr-3">
          <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
          <span className="font-semibold text-[13px] text-slate-800 truncate">
            {isNoCustomer ? t.projNoCustomer : customerName}
          </span>
          {isMondaySynced && (
            <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-full shrink-0 ml-1">
              Synced from Monday
            </span>
          )}
        </div>
        <span className="mr-4 text-[11px] font-bold text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded-full flex-shrink-0">
          {projects.length}
        </span>
      </button>

      {/* Project rows */}
      {!collapsed && projects.map(project => (
        <div
          key={project.id}
          className="flex items-stretch border-b border-slate-100 hover:bg-[#E8F5FF] group/row transition-colors cursor-pointer"
          style={{ borderLeft: `4px solid ${color}20` }}
          data-testid={`row-project-${project.id}`}
          onClick={() => onRowClick(project.id)}
        >
          {/* Sticky name group */}
          <div className="sticky left-0 z-10 flex items-stretch bg-white group-hover/row:bg-[#E8F5FF] transition-colors">
            <div className="w-8 flex-shrink-0 flex items-center" />

            {/* PO */}
            <div className="flex-shrink-0 hidden lg:flex items-center pr-2 py-2" style={{ width: cw.po }}>
              <span className="text-sm text-slate-700 truncate" data-testid={`cell-poNumber-${project.id}`}>
                {project.poNumber
                  ? project.poNumber
                  : <span className="text-slate-300">—</span>}
              </span>
            </div>

            {/* Name + owner */}
            <div className="flex-shrink-0 min-w-0 flex items-center pr-2 py-2" style={{ width: cw.name }}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-semibold text-slate-900 text-sm truncate" data-testid={`cell-name-${project.id}`}>
                    {project.name || <span className="text-slate-300">—</span>}
                  </span>
                  {project.mondayItemId && (
                    <a
                      href={
                        project.mondayUrl ||
                        (mondayBoardId
                          ? `https://monday.com/boards/${mondayBoardId}/pulses/${project.mondayItemId}`
                          : "https://monday.com")
                      }
                      target="_blank"
                      rel="noreferrer"
                      title={`Monday.com에서 동기화됨${project.mondayGroupTitle ? ` — ${project.mondayGroupTitle}` : ""}`}
                      className="flex-shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#FF3D57]/10 text-[#FF3D57] hover:bg-[#FF3D57]/20 transition-colors"
                      data-testid={`badge-monday-${project.id}`}
                      onClick={e => e.stopPropagation()}
                    >
                      <ExternalLink className="w-2.5 h-2.5" />
                      Mon
                    </a>
                  )}
                </div>
                {project.ownerName && (
                  <span className="text-[11px] text-slate-400 truncate block mt-0.5" data-testid={`cell-ownerName-${project.id}`}>
                    {project.ownerName}
                  </span>
                )}
                {/* Mobile status */}
                <div className="flex items-center gap-2 mt-1 md:hidden">
                  <MondayStatusCell projectId={project.id} status={project.status} />
                </div>
              </div>
            </div>
          </div>

          {/* Customer */}
          <div className="flex-shrink-0 hidden xl:flex items-center pr-2 py-2" style={{ width: cw.customer }}>
            <span className="text-sm text-slate-700 truncate" data-testid={`cell-customerName-${project.id}`}>
              {project.customerName || <span className="text-slate-300">—</span>}
            </span>
          </div>

          {/* Location */}
          <div className="flex-shrink-0 hidden xl:flex items-center pr-2 py-2 gap-1" style={{ width: cw.location }}>
            {project.jobLocation ? <MapPin className="w-3 h-3 text-slate-300 flex-shrink-0" /> : null}
            <span className="text-sm text-slate-700 truncate" data-testid={`cell-jobLocation-${project.id}`}>
              {project.jobLocation || <span className="text-slate-300">—</span>}
            </span>
          </div>

          {/* Timeline */}
          <div className="flex-shrink-0 hidden xl:flex items-center pr-2 py-2" style={{ width: cw.timeline }}>
            <TimelineCell startDate={project.startDate} endDate={project.endDate} />
          </div>

          {/* Status */}
          <div className="flex-shrink-0 self-stretch hidden md:flex" style={{ width: cw.status }}>
            <MondayStatusCell projectId={project.id} status={project.status} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function Projects() {
  const { isAdminRole } = useAuth();
  const { data: projects, isLoading } = useProjects();
  const { data: mondayBoardData } = useQuery<{ boardId: string | null }>({
    queryKey: ["/api/monday/board-id"],
    staleTime: 5 * 60 * 1000,
  });
  const mondayBoardId = mondayBoardData?.boardId ?? null;

  const { t } = useLanguage();
  const [, navigate] = useLocation();

  const [statusFilter,    setStatusFilter]    = useState("all");
  const [search,          setSearch]          = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [colWidths,       setColWidths]       = useState<ColWidths>(loadWidths);
  const [sortState,       setSortState]       = useState<SortState>({ col: null, dir: null });
  const [showArchived,    setShowArchived]    = useState(false);

  useEffect(() => {
    try { localStorage.setItem(LS_COL, JSON.stringify(colWidths)); } catch {}
  }, [colWidths]);

  const allProjects: any[] = projects ?? [];

  const filtered = useMemo(() => allProjects.filter((p: any) => {
    if (!showArchived && p.archived) return false;
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    if (!search.trim()) return matchStatus;
    const q = search.toLowerCase();
    return matchStatus && (
      p.name?.toLowerCase().includes(q) ||
      p.customerName?.toLowerCase().includes(q) ||
      p.ownerName?.toLowerCase().includes(q) ||
      p.jobLocation?.toLowerCase().includes(q) ||
      p.poNumber?.toLowerCase().includes(q) ||
      p.status?.toLowerCase().includes(q)
    );
  }), [allProjects, statusFilter, search, showArchived]);

  const sorted = useMemo(() => {
    if (!sortState.col || !sortState.dir) return filtered;
    return [...filtered].sort((a, b) => cmpProjects(a, b, sortState.col!, sortState.dir));
  }, [filtered, sortState]);

  const groups = useMemo(() => {
    const map = new Map<string, { displayName: string; projects: any[] }>();
    sorted.forEach((p: any) => {
      const raw = p.customerName?.trim() || "";
      const k = raw ? raw.toLowerCase() : "__none__";
      if (!map.has(k)) map.set(k, { displayName: raw || "__none__", projects: [] });
      map.get(k)!.projects.push(p);
    });
    return [...map.entries()].sort(([a], [b]) => {
      if (a === "__none__") return 1;
      if (b === "__none__") return -1;
      return a.localeCompare(b);
    });
  }, [sorted]);

  function toggleGroup(key: string) {
    setCollapsedGroups(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }

  function handleSort(col: SortCol) {
    setSortState(prev => {
      if (prev.col !== col) return { col, dir: "asc" };
      if (prev.dir === "asc") return { col, dir: "desc" };
      return { col: null, dir: null };
    });
  }

  const ColumnHeaderRow = (
    <div className="hidden md:flex items-center h-8 bg-[#F5F6F8] border-b border-slate-200 sticky top-0 z-20 select-none">
      <div className="sticky left-0 z-20 flex items-center h-8 bg-[#F5F6F8]">
        <div className="w-[calc(4px+32px)] flex-shrink-0" />
        <SortableHeader label={t.projColPo}   col="po"   ss={sortState} onSort={handleSort} cw={colWidths} cwKey="po"   setColWidths={setColWidths} className="hidden lg:flex" />
        <SortableHeader label={t.projColName} col="name" ss={sortState} onSort={handleSort} cw={colWidths} cwKey="name" setColWidths={setColWidths} />
      </div>
      <SortableHeader label={t.projColCustomer} col="customer" ss={sortState} onSort={handleSort} cw={colWidths} cwKey="customer" setColWidths={setColWidths} className="hidden xl:flex" />
      <SortableHeader label={t.projColLocation} col="location" ss={sortState} onSort={handleSort} cw={colWidths} cwKey="location" setColWidths={setColWidths} className="hidden xl:flex" />
      <SortableHeader label={t.projColTimeline} col="timeline" ss={sortState} onSort={handleSort} cw={colWidths} cwKey="timeline" setColWidths={setColWidths} className="hidden xl:flex" />
      <SortableHeader label={t.projColStatus}   col="status"   ss={sortState} onSort={handleSort} cw={colWidths} cwKey="status"   setColWidths={setColWidths} />
    </div>
  );

  return (
    <div className="space-y-5">

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-baseline gap-2 mr-1">
          <h1 className="text-2xl font-display font-bold text-slate-900 leading-none">{t.projTitle}</h1>
          {!isLoading && allProjects.length > 0 && (
            <span className="text-sm font-medium text-slate-400" data-testid="text-project-count">
              {filtered.length === allProjects.length
                ? `${allProjects.length}`
                : `${filtered.length} / ${allProjects.length}`}
            </span>
          )}
        </div>

        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Input
            placeholder={t.projSearchPlaceholder}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 text-sm pl-3"
            data-testid="input-search-projects"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-40 text-sm" data-testid="select-status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.projAllStatuses}</SelectItem>
            {[...new Set(allProjects.map((p: any) => p.status).filter(Boolean))].sort().map((s: string) => (
              <SelectItem key={s} value={s}>{statusLabelOf(s, t)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isAdminRole && allProjects.some((p: any) => p.archived) && (
          <button
            className={`h-9 text-sm shrink-0 px-3 rounded-md border font-medium transition-colors ${showArchived ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-500" : "border-slate-300 text-slate-500 hover:border-amber-400 hover:text-amber-700 hover:bg-amber-50"}`}
            onClick={() => setShowArchived(v => !v)}
            data-testid="btn-toggle-archived"
          >
            {showArchived ? "아카이브 숨기기" : "아카이브 포함"}
          </button>
        )}
      </div>

      {/* Active filter summary */}
      {(search || statusFilter !== "all") && !isLoading && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span>
            {filtered.length === allProjects.length
              ? `${allProjects.length} ${allProjects.length !== 1 ? t.projUnitProjects : t.projUnitProject}`
              : `${filtered.length} / ${allProjects.length} ${t.projMatchingLabel}`}
          </span>
          <button
            className="text-brand-600 hover:text-brand-800 font-medium text-xs transition-colors"
            onClick={() => { setSearch(""); setStatusFilter("all"); }}
            data-testid="btn-clear-filters"
          >
            {t.projClearFiltersBtn}
          </button>
        </div>
      )}

      {/* Board */}
      {isLoading ? (
        <div className="border border-slate-200 rounded-xl bg-white">
          <div className="h-8 bg-[#F5F6F8] border-b border-slate-200 rounded-tl-xl rounded-tr-xl" />
          {[1, 2].map(g => (
            <div key={g}>
              <div className="h-10 bg-[#F5F6F8] border-b border-slate-200 flex items-center px-4 gap-3">
                <div className="h-3 w-32 bg-slate-200 rounded animate-pulse" />
                <div className="h-3 w-6 bg-slate-200 rounded-full animate-pulse" />
              </div>
              {[1, 2, 3].map(r => (
                <div key={r} className="h-10 border-b border-slate-100 flex items-center px-4 gap-4">
                  <div className="h-4 flex-1 bg-slate-100 rounded animate-pulse" />
                  <div className="h-full w-[128px] bg-slate-100 animate-pulse" />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-slate-200 rounded-xl bg-white">
          {ColumnHeaderRow}
          <div className="p-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Briefcase className="w-7 h-7 text-slate-400" />
            </div>
            <p className="font-semibold text-slate-900">{t.projNoneFound}</p>
            {search
              ? <p className="text-sm text-slate-500 mt-1">{t.projNoResultsFor} "<span className="font-medium">{search}</span>" — {t.projTryDifferentTerms}</p>
              : statusFilter !== "all"
                ? <p className="text-sm text-slate-500 mt-1">{t.projNoMatchStatus}</p>
                : <p className="text-sm text-slate-500 mt-1">{t.projAppearGrouped}</p>}
            {(search || statusFilter !== "all") && (
              <button
                className="mt-3 text-sm text-brand-600 hover:text-brand-800 font-medium transition-colors"
                onClick={() => { setSearch(""); setStatusFilter("all"); }}
              >
                {t.projClearFiltersBtn}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-xl bg-white overflow-auto max-h-[calc(100vh-14rem)]">
          {ColumnHeaderRow}
          {groups.map(([customerKey, { displayName, projects: groupProjects }]) => (
            <CustomerGroup
              key={customerKey}
              customerName={displayName}
              projects={groupProjects}
              collapsed={collapsedGroups.has(customerKey)}
              onToggle={() => toggleGroup(customerKey)}
              onRowClick={(id) => navigate(`/projects/${id}`)}
              cw={colWidths}
              mondayBoardId={mondayBoardId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
