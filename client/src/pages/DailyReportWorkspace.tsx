import { useState } from "react";
import { useParams } from "wouter";
import {
  MapPin, Calendar, ClipboardList, CheckCircle2, AlertCircle,
  Users, HardHat, FileText, PlusCircle, ChevronDown,
  BarChart3, Clock, Milestone,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MOCK_PROJECTS, STATUS_CFG, formatReportDate,
  type ProjectStatus,
} from "@/lib/mock-daily-report";

// ─── Status badge ─────────────────────────────────────────────────────────────
function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const cfg = STATUS_CFG[status];
  return (
    <Badge variant="outline" className={`${cfg.className} text-xs font-semibold px-2 py-0.5`}>
      {cfg.label}
    </Badge>
  );
}

// ─── Tab definition ───────────────────────────────────────────────────────────
type Tab = "new-report" | "history" | "progress";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "new-report", label: "New Report",     icon: <PlusCircle className="w-4 h-4" /> },
  { id: "history",    label: "Report History", icon: <ClipboardList className="w-4 h-4" /> },
  { id: "progress",   label: "Progress",       icon: <BarChart3 className="w-4 h-4" /> },
];

// ─── Mock report history ──────────────────────────────────────────────────────
const MOCK_HISTORY = [
  { id: 101, date: "2026-03-16", crew: 8,  hours: 64,  workDone: "Panel installation – Level 3 east wing. Conduit pull-through complete.", weather: "Clear", issues: false },
  { id: 102, date: "2026-03-15", crew: 7,  hours: 56,  workDone: "Branch circuit wiring – Rooms 301–312. Inspection passed.", weather: "Partly Cloudy", issues: false },
  { id: 103, date: "2026-03-14", crew: 9,  hours: 72,  workDone: "Main switchgear rough-in. Delays due to material delivery.", weather: "Clear", issues: true },
  { id: 104, date: "2026-03-13", crew: 6,  hours: 48,  workDone: "Ground fault circuit installation – Kitchen and restrooms.", weather: "Rain", issues: false },
  { id: 105, date: "2026-03-12", crew: 8,  hours: 64,  workDone: "Conduit installation – Basement electrical room.", weather: "Clear", issues: false },
];

// ─── Mock milestone progress ──────────────────────────────────────────────────
const MOCK_MILESTONES = [
  { label: "Site Survey & Scope",       pct: 100, status: "done" },
  { label: "Rough-In Conduit & Boxes",  pct: 100, status: "done" },
  { label: "Main Switchgear Install",   pct: 85,  status: "active" },
  { label: "Branch Circuit Wiring",     pct: 60,  status: "active" },
  { label: "Panel Trim & Devices",      pct: 20,  status: "upcoming" },
  { label: "Inspection & Sign-Off",     pct: 0,   status: "upcoming" },
  { label: "Final Cleanup & Closeout",  pct: 0,   status: "upcoming" },
];

// ─── Tab content components ───────────────────────────────────────────────────
function NewReportTab() {
  return (
    <div className="space-y-4">

      {/* Placeholder notice */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-blue-50 border border-blue-100">
        <FileText className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
        <p className="text-sm text-blue-700">
          The daily report form is coming soon. Below is a preview of the fields that will be available.
        </p>
      </div>

      {/* Form skeleton */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700">Report Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Date row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SkeletonField label="Report Date" icon={<Calendar className="w-3.5 h-3.5" />} placeholder="Mar 17, 2026" />
            <SkeletonField label="Shift" icon={<Clock className="w-3.5 h-3.5" />} placeholder="Day Shift" dropdown />
          </div>

          {/* Crew row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SkeletonField label="Crew Size" icon={<Users className="w-3.5 h-3.5" />} placeholder="0 workers" />
            <SkeletonField label="Foreman" icon={<HardHat className="w-3.5 h-3.5" />} placeholder="Foreman name" />
          </div>

          {/* Work description */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">
              Work Performed
            </label>
            <div className="w-full h-24 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center">
              <span className="text-xs text-slate-400">Description field — coming soon</span>
            </div>
          </div>

          {/* Issues / weather row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SkeletonField label="Weather" icon={<ChevronDown className="w-3.5 h-3.5" />} placeholder="Select weather" dropdown />
            <SkeletonField label="Issues / Delays" icon={<AlertCircle className="w-3.5 h-3.5" />} placeholder="None" />
          </div>
        </CardContent>
      </Card>

      {/* Submit placeholder */}
      <div className="flex justify-end">
        <Button
          data-testid="btn-submit-report"
          disabled
          className="gap-2"
        >
          <PlusCircle className="w-4 h-4" />
          Submit Daily Report
        </Button>
      </div>
    </div>
  );
}

function SkeletonField({
  label, icon, placeholder, dropdown = false,
}: {
  label: string; icon: React.ReactNode; placeholder: string; dropdown?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">
        {label}
      </label>
      <div className="flex items-center gap-2 h-10 px-3 rounded-lg border border-slate-200 bg-slate-50">
        <span className="text-slate-400">{icon}</span>
        <span className="text-sm text-slate-400 flex-1">{placeholder}</span>
        {dropdown && <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
      </div>
    </div>
  );
}

function HistoryTab() {
  if (MOCK_HISTORY.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-100">
            <ClipboardList className="w-7 h-7 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-600">No reports yet</p>
          <p className="text-xs text-slate-400">Submit the first daily report using the New Report tab.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {MOCK_HISTORY.map((r) => (
        <Card key={r.id} data-testid={`card-report-${r.id}`} className="hover:shadow-sm transition-shadow">
          <CardContent className="flex items-start gap-4 px-5 py-4">

            {/* Date column */}
            <div className="shrink-0 text-center w-14">
              <p className="text-xl font-bold text-slate-800 leading-none">
                {new Date(r.date).getDate()}
              </p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wide mt-0.5">
                {new Date(r.date).toLocaleDateString("en-US", { month: "short" })}
              </p>
            </div>

            {/* Divider */}
            <div className="w-px self-stretch bg-slate-200 shrink-0" />

            {/* Main info */}
            <div className="flex-1 min-w-0">
              <p
                data-testid={`text-report-work-${r.id}`}
                className="text-sm text-slate-700 line-clamp-2"
              >
                {r.workDone}
              </p>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <Users className="w-3 h-3" />{r.crew} workers
                </span>
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <Clock className="w-3 h-3" />{r.hours} hrs
                </span>
                <span className="text-xs text-slate-400">{r.weather}</span>
                {r.issues && (
                  <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 px-1.5 py-0 font-semibold">
                    Issue logged
                  </Badge>
                )}
              </div>
            </div>

            {/* View button — placeholder */}
            <Button
              data-testid={`btn-view-report-${r.id}`}
              variant="ghost"
              size="sm"
              className="shrink-0 text-xs text-slate-500 gap-1"
              disabled
            >
              <FileText className="w-3.5 h-3.5" />
              View
            </Button>

          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ProgressTab() {
  const overall = Math.round(
    MOCK_MILESTONES.reduce((s, m) => s + m.pct, 0) / MOCK_MILESTONES.length
  );

  return (
    <div className="space-y-4">

      {/* Overall progress card */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">Overall Completion</p>
              <p className="text-3xl font-bold text-slate-800 mt-0.5">{overall}%</p>
            </div>
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-50">
              <BarChart3 className="w-7 h-7 text-blue-600" />
            </div>
          </div>
          <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-500"
              style={{ width: `${overall}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Milestones */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Milestone className="w-4 h-4 text-slate-500" />
            Milestones
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {MOCK_MILESTONES.map((m) => {
            const isDone     = m.status === "done";
            const isActive   = m.status === "active";
            const isUpcoming = m.status === "upcoming";
            return (
              <div key={m.label} data-testid={`row-milestone-${m.label.replace(/\s+/g, "-").toLowerCase()}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {isDone ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : isActive ? (
                      <div className="w-4 h-4 rounded-full border-2 border-blue-500 shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0" />
                    )}
                    <span className={`text-sm ${isDone ? "text-slate-500 line-through" : isActive ? "text-slate-800 font-medium" : "text-slate-400"}`}>
                      {m.label}
                    </span>
                  </div>
                  <span className={`text-xs font-semibold ${isDone ? "text-emerald-600" : isActive ? "text-blue-600" : "text-slate-400"}`}>
                    {m.pct}%
                  </span>
                </div>
                <div className="ml-6 w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${isDone ? "bg-emerald-400" : isActive ? "bg-blue-400" : "bg-slate-300"}`}
                    style={{ width: `${m.pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Placeholder note */}
      <p className="text-xs text-slate-400 text-center">
        Progress data will sync from submitted daily reports when the backend is connected.
      </p>
    </div>
  );
}

// ─── Main workspace page ──────────────────────────────────────────────────────
export default function DailyReportWorkspace() {
  const { projectId } = useParams<{ projectId: string }>();
  const [activeTab, setActiveTab] = useState<Tab>("new-report");

  const project = MOCK_PROJECTS.find((p) => String(p.id) === projectId);

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-100">
          <AlertCircle className="w-8 h-8 text-slate-400" />
        </div>
        <p className="text-sm font-medium text-slate-600">Project not found</p>
        <p className="text-xs text-slate-400">ID: {projectId}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Project header card ── */}
      <Card>
        <CardContent className="flex items-center gap-4 px-5 py-4">
          <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-blue-50 shrink-0">
            <FileText className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1
                data-testid="text-workspace-project-name"
                className="text-lg font-bold text-slate-900 leading-tight"
              >
                {project.name}
              </h1>
              <span className="text-xs font-mono text-slate-400">{project.code}</span>
              <ProjectStatusBadge status={project.status} />
            </div>
            <div className="flex items-center gap-4 mt-1 flex-wrap">
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <MapPin className="w-3 h-3" />{project.location}
              </span>
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Calendar className="w-3 h-3" />
                Last report: {formatReportDate(project.lastReportDate)}
              </span>
            </div>
          </div>
          <div className="shrink-0 text-right hidden sm:block">
            <p className="text-2xl font-bold text-slate-700">{project.reportCount}</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">
              {project.reportCount === 1 ? "Report" : "Reports"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Tab bar ── */}
      <div
        className="flex border-b border-slate-200"
        data-testid="tab-bar-workspace"
        role="tablist"
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              data-testid={`tab-${tab.id}`}
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={[
                "flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                isActive
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300",
              ].join(" ")}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab content ── */}
      <div data-testid="tab-content-workspace">
        {activeTab === "new-report" && <NewReportTab />}
        {activeTab === "history"    && <HistoryTab />}
        {activeTab === "progress"   && <ProgressTab />}
      </div>

    </div>
  );
}
