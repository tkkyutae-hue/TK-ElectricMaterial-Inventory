import { useState } from "react";
import { Briefcase, MapPin, Calendar, ChevronRight, Search, ClipboardList, FileText, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ─── Mock data ────────────────────────────────────────────────────────────────
type ProjectStatus = "active" | "on_hold" | "completed" | "cancelled";

interface MockProject {
  id: number;
  name: string;
  code: string;
  location: string;
  status: ProjectStatus;
  lastReportDate: string | null;
  reportCount: number;
}

const MOCK_PROJECTS: MockProject[] = [
  {
    id: 1,
    name: "Riverside Office Complex",
    code: "TK-2025-001",
    location: "3200 Riverside Dr, Los Angeles, CA",
    status: "active",
    lastReportDate: "2026-03-16",
    reportCount: 42,
  },
  {
    id: 2,
    name: "Harbor Light Industrial",
    code: "TK-2025-002",
    location: "8800 Harbor Blvd, Long Beach, CA",
    status: "active",
    lastReportDate: "2026-03-15",
    reportCount: 28,
  },
  {
    id: 3,
    name: "Sunset Mall Renovation",
    code: "TK-2025-003",
    location: "1100 Sunset Strip, West Hollywood, CA",
    status: "on_hold",
    lastReportDate: "2026-02-28",
    reportCount: 17,
  },
  {
    id: 4,
    name: "Northgate Warehouse Fit-Out",
    code: "TK-2025-004",
    location: "4450 Northgate Pkwy, Burbank, CA",
    status: "active",
    lastReportDate: "2026-03-17",
    reportCount: 63,
  },
  {
    id: 5,
    name: "Pacific View High School",
    code: "TK-2024-018",
    location: "700 Pacific View Ave, Santa Monica, CA",
    status: "completed",
    lastReportDate: "2026-01-10",
    reportCount: 91,
  },
  {
    id: 6,
    name: "Cerritos Medical Center",
    code: "TK-2025-005",
    location: "2255 Medical Center Dr, Cerritos, CA",
    status: "active",
    lastReportDate: "2026-03-14",
    reportCount: 11,
  },
  {
    id: 7,
    name: "Downtown Loft Tower",
    code: "TK-2025-006",
    location: "500 S Grand Ave, Los Angeles, CA",
    status: "cancelled",
    lastReportDate: null,
    reportCount: 0,
  },
];

// ─── Status badge ─────────────────────────────────────────────────────────────
const STATUS_CFG: Record<ProjectStatus, { label: string; className: string }> = {
  active:    { label: "Active",    className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  completed: { label: "Completed", className: "bg-slate-100 text-slate-500 border-slate-200" },
  on_hold:   { label: "On Hold",   className: "bg-amber-100 text-amber-700 border-amber-200" },
  cancelled: { label: "Cancelled", className: "bg-rose-100 text-rose-700 border-rose-200" },
};

function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const cfg = STATUS_CFG[status];
  return (
    <Badge variant="outline" className={`${cfg.className} text-xs font-semibold px-2 py-0.5`}>
      {cfg.label}
    </Badge>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatReportDate(dateStr: string | null) {
  if (!dateStr) return "No reports yet";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DailyReport() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ProjectStatus>("all");

  const filtered = MOCK_PROJECTS.filter((p) => {
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    if (!search.trim()) return matchStatus;
    const q = search.toLowerCase();
    return (
      matchStatus &&
      (p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q))
    );
  });

  const activeCount    = MOCK_PROJECTS.filter((p) => p.status === "active").length;
  const totalReports   = MOCK_PROJECTS.reduce((s, p) => s + p.reportCount, 0);
  const lastReportDate = MOCK_PROJECTS
    .map((p) => p.lastReportDate)
    .filter(Boolean)
    .sort()
    .reverse()[0];

  return (
    <div className="space-y-6">

      {/* ── Page header ── */}
      <div>
        <h1 className="text-3xl font-display font-bold text-slate-900">Daily Report Mode</h1>
        <p className="text-slate-500 mt-1">
          Log project-based daily field reports, track manpower, and record progress by jobsite.
        </p>
      </div>

      {/* ── Summary stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            icon: Briefcase,
            label: "Active Projects",
            value: String(activeCount),
            color: "text-blue-600",
            bg: "bg-blue-50",
          },
          {
            icon: ClipboardList,
            label: "Total Reports Filed",
            value: String(totalReports),
            color: "text-indigo-600",
            bg: "bg-indigo-50",
          },
          {
            icon: Clock,
            label: "Last Report",
            value: lastReportDate ? formatReportDate(lastReportDate) : "—",
            color: "text-slate-600",
            bg: "bg-slate-100",
            small: true,
          },
        ].map(({ icon: Icon, label, value, color, bg, small }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 pt-5 pb-5">
              <div className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${bg}`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">
                  {label}
                </p>
                <p className={`font-bold text-slate-700 leading-tight truncate ${small ? "text-lg" : "text-2xl"}`}>
                  {value}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
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
              <h2 className="text-base font-semibold text-slate-800 leading-tight">Project List</h2>
              <p className="text-xs text-slate-400">Select a project to file or view a daily report</p>
            </div>
          </div>
          <span className="text-xs text-slate-400">{filtered.length} project{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Filters row */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input
              data-testid="input-project-search"
              placeholder="Search by name, code, or location…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
          {(["all", "active", "on_hold", "completed", "cancelled"] as const).map((s) => (
            <Button
              key={s}
              data-testid={`filter-status-${s}`}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              className="h-9 text-xs"
              onClick={() => setStatusFilter(s)}
            >
              {s === "all" ? "All" : STATUS_CFG[s as ProjectStatus].label}
            </Button>
          ))}
        </div>

        {/* Project cards */}
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-100">
                <FileText className="w-7 h-7 text-slate-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-slate-600">No projects found</p>
                <p className="text-xs text-slate-400 mt-0.5">Try adjusting your search or filter</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((project) => (
              <Card
                key={project.id}
                data-testid={`card-project-${project.id}`}
                className="hover:shadow-md transition-shadow duration-150 cursor-pointer group"
              >
                <CardContent className="flex items-center gap-4 px-5 py-4">

                  {/* Icon column */}
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-100 shrink-0">
                    <Briefcase className="w-5 h-5 text-slate-500" />
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        data-testid={`text-project-name-${project.id}`}
                        className="font-semibold text-slate-800 text-sm truncate"
                      >
                        {project.name}
                      </span>
                      <span
                        data-testid={`text-project-code-${project.id}`}
                        className="text-xs text-slate-400 font-mono shrink-0"
                      >
                        {project.code}
                      </span>
                      <ProjectStatusBadge status={project.status} />
                    </div>

                    <div className="flex items-center gap-4 mt-1 flex-wrap">
                      <span
                        data-testid={`text-project-location-${project.id}`}
                        className="flex items-center gap-1 text-xs text-slate-500"
                      >
                        <MapPin className="w-3 h-3 shrink-0" />
                        {project.location}
                      </span>
                      <span
                        data-testid={`text-project-last-report-${project.id}`}
                        className="flex items-center gap-1 text-xs text-slate-400"
                      >
                        <Calendar className="w-3 h-3 shrink-0" />
                        Last report: {formatReportDate(project.lastReportDate)}
                      </span>
                    </div>
                  </div>

                  {/* Report count pill */}
                  <div className="shrink-0 text-center hidden sm:block">
                    <p className="text-lg font-bold text-slate-700 leading-tight">
                      {project.reportCount}
                    </p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide">
                      {project.reportCount === 1 ? "Report" : "Reports"}
                    </p>
                  </div>

                  {/* Open button */}
                  <Button
                    data-testid={`btn-open-project-${project.id}`}
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1 text-xs group-hover:bg-blue-50 group-hover:text-blue-700 group-hover:border-blue-200 transition-colors"
                    disabled
                  >
                    Open
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>

                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
