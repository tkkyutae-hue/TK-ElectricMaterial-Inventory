import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Briefcase, MapPin, Calendar, ChevronRight,
  Search, ClipboardList, FileText, CheckCircle2, Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  STATUS_CFG, type ProjectStatus,
} from "@/lib/mock-daily-report";
import type { Project } from "@shared/schema";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function projectLocation(p: Project): string {
  if (p.jobLocation) return p.jobLocation;
  const parts = [p.city, p.state].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "—";
}

function projectStartDate(p: Project): string {
  if (!p.startDate) return "—";
  return new Date(p.startDate).toLocaleDateString("en-US", {
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

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DailyReport() {
  const [, navigate] = useLocation();
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ProjectStatus>("all");

  const { data: allProjects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const filtered = allProjects.filter((p) => {
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    if (!search.trim()) return matchStatus;
    const q = search.toLowerCase();
    return (
      matchStatus &&
      (p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        projectLocation(p).toLowerCase().includes(q))
    );
  });

  const activeCount    = allProjects.filter((p) => p.status === "active").length;
  const totalCount     = allProjects.length;
  const completedCount = allProjects.filter((p) => p.status === "completed").length;

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
          { icon: Briefcase,    label: "Active Projects",    value: String(activeCount),    color: "text-blue-600",    bg: "bg-blue-50"    },
          { icon: ClipboardList, label: "Total Projects",    value: String(totalCount),     color: "text-indigo-600",  bg: "bg-indigo-50"  },
          { icon: CheckCircle2,  label: "Completed",         value: String(completedCount), color: "text-slate-600",   bg: "bg-slate-100"  },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 pt-5 pb-5">
              <div className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${bg}`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">{label}</p>
                <p className="font-bold text-slate-700 leading-tight truncate text-2xl">{value}</p>
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
          <span className="text-xs text-slate-400">
            {isLoading ? "Loading…" : `${filtered.length} project${filtered.length !== 1 ? "s" : ""}`}
          </span>
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

        {/* Loading state */}
        {isLoading ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-8 h-8 text-slate-300 animate-spin" />
              <p className="text-sm text-slate-400">Loading projects…</p>
            </CardContent>
          </Card>

        /* Empty states */
        ) : allProjects.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-100">
                <Briefcase className="w-7 h-7 text-slate-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-slate-600">No projects yet</p>
                <p className="text-xs text-slate-400 mt-0.5">Create projects in Admin Mode to get started</p>
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
                <p className="text-sm font-medium text-slate-600">No projects found</p>
                <p className="text-xs text-slate-400 mt-0.5">Try adjusting your search or filter</p>
              </div>
            </CardContent>
          </Card>

        /* Project cards */
        ) : (
          <div className="space-y-2">
            {filtered.map((project) => (
              <Card
                key={project.id}
                data-testid={`card-project-${project.id}`}
                className="hover:shadow-md transition-shadow duration-150 cursor-pointer group"
                onClick={() => navigate(`/daily-report/${project.id}`)}
              >
                <CardContent className="flex items-center gap-4 px-5 py-4">

                  {/* Icon */}
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
                        {projectLocation(project)}
                      </span>
                      {project.startDate && (
                        <span
                          data-testid={`text-project-start-${project.id}`}
                          className="flex items-center gap-1 text-xs text-slate-400"
                        >
                          <Calendar className="w-3 h-3 shrink-0" />
                          Started: {projectStartDate(project)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Open */}
                  <Button
                    data-testid={`btn-open-project-${project.id}`}
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1 text-xs group-hover:bg-blue-50 group-hover:text-blue-700 group-hover:border-blue-200 transition-colors"
                    onClick={(e) => { e.stopPropagation(); navigate(`/daily-report/${project.id}`); }}
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
