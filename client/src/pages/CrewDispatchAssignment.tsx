import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft, ChevronRight, Users, CheckCircle2, MapPin, Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { Worker, Project } from "@shared/schema";

// ─── Types ────────────────────────────────────────────────────────────────────
interface JibbleEntry { firstIn: string; lastOut?: string }
interface JibbleActive { entry: JibbleEntry; worker: { id: number } | null }
interface Assignment { workerId: number; projectId: number | null; date: string }

// ─── Helpers ─────────────────────────────────────────────────────────────────
function toLocalDateStr(d: Date): string {
  // Use local year/month/day to avoid UTC midnight rollover in KST (+09:00)
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, "0");
  const dy = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dy}`;
}
function fmtDate(iso: string): string {
  // Parse as local date by appending midnight in local time (no Z / no +00:00)
  return new Date(`${iso}T00:00:00`).toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric", weekday: "short",
  });
}
function fmtTime(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function WorkerAvatar({ photoUrl, name }: { photoUrl?: string | null; name: string }) {
  const initials = name.trim().split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  if (photoUrl) return (
    <img src={photoUrl} alt={name} className="w-10 h-10 rounded-full object-cover shrink-0 border border-slate-200" />
  );
  return (
    <div className="w-10 h-10 rounded-full shrink-0 bg-slate-100 border border-slate-200 flex items-center justify-center">
      <span className="text-xs font-semibold text-slate-500">{initials || "?"}</span>
    </div>
  );
}

// ─── Worker row ───────────────────────────────────────────────────────────────
function WorkerRow({ worker, jibble, assignedProjectId, projects, onAssign }: {
  worker: Worker;
  jibble?: JibbleEntry;
  assignedProjectId: number | null;
  projects: Project[];
  onAssign: (projectId: number | null) => void;
}) {
  const isOnSite = !!jibble && !jibble.lastOut;
  const checkedIn = !!jibble;

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
            {worker.trade && (
              <p className="text-xs text-slate-400 leading-tight">{worker.trade}</p>
            )}
          </div>
        </div>
      </td>

      {/* Jibble clock-in */}
      <td className="px-4 py-3">
        {checkedIn ? (
          <div className="text-sm text-slate-600 tabular-nums">
            <span className="text-emerald-600 font-medium">{fmtTime(jibble!.firstIn)}</span>
            {jibble!.lastOut && (
              <span className="text-slate-400 ml-1">→ {fmtTime(jibble!.lastOut)}</span>
            )}
          </div>
        ) : (
          <span className="text-sm text-slate-300">미출근</span>
        )}
      </td>

      {/* Project assignment */}
      <td className="px-4 py-3">
        <Select
          value={assignedProjectId !== null ? String(assignedProjectId) : "__none__"}
          onValueChange={(v) => onAssign(v === "__none__" ? null : parseInt(v))}
        >
          <SelectTrigger
            className={`h-8 text-sm max-w-[260px] ${
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
            {projects.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                <div className="flex items-center gap-2">
                  {p.poNumber && (
                    <span className="text-xs font-mono text-slate-400 shrink-0">{p.poNumber}</span>
                  )}
                  <span>{p.name}</span>
                  {p.jobLocation && (
                    <span className="flex items-center gap-0.5 text-xs text-slate-400 shrink-0">
                      <MapPin className="w-2.5 h-2.5" />
                      {p.jobLocation}
                    </span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
    </tr>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function CrewDispatchAssignment() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dateStr, setDateStr] = useState<string>(() => toLocalDateStr(new Date()));

  // Navigate date
  function changeDate(delta: number) {
    const d = new Date(dateStr + "T00:00:00");
    d.setDate(d.getDate() + delta);
    setDateStr(toLocalDateStr(d));
  }

  // Workers
  const { data: workerList = [], isLoading: workersLoading } = useQuery<Worker[]>({
    queryKey: ["/api/workers"],
  });

  // Jibble active cache (today only is fine — we show per-date but Jibble cache is today's data)
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

  // Active projects
  const { data: allProjects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });
  const activeProjects = useMemo(
    () => allProjects.filter((p) => !["completed", "cancelled", "canceled", "done"].includes((p.status ?? "").toLowerCase())),
    [allProjects],
  );

  // Optimistic local state — keyed by workerId, scoped to current dateStr
  const [localOverride, setLocalOverride] = useState<Map<number, number | null>>(new Map());

  // Clear overrides whenever the date changes so stale data from another date never leaks
  useEffect(() => {
    setLocalOverride(new Map());
  }, [dateStr]);

  // Upsert mutation with proper rollback on failure
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/crew-dispatch/assignments", dateStr] });
    },
    onError: (err: any, variables) => {
      // Roll back the optimistic override for this specific worker
      setLocalOverride((prev) => {
        const next = new Map(prev);
        next.delete(variables.workerId);
        return next;
      });
      toast({ title: "배치 저장 실패", description: err.message, variant: "destructive" });
    },
  });

  function handleAssign(workerId: number, projectId: number | null) {
    // Write optimistic override immediately for instant UI feedback
    setLocalOverride((prev) => new Map(prev).set(workerId, projectId));
    assignMutation.mutate({ workerId, projectId });
  }

  // Merge server data with optimistic local overrides
  function getAssignment(workerId: number): number | null {
    if (localOverride.has(workerId)) return localOverride.get(workerId) ?? null;
    return assignmentMap.get(workerId) ?? null;
  }
  const assignedCount = workerList.filter((w) => getAssignment(w.id) !== null).length;
  const onSiteCount   = workerList.filter((w) => {
    const j = jibbleMap.get(w.id);
    return !!j && !j.lastOut;
  }).length;

  const isToday = dateStr === toLocalDateStr(new Date());
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
        <button
          onClick={() => changeDate(-1)}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors"
        >
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
        <button
          onClick={() => changeDate(1)}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors"
          disabled={isToday}
        >
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

      {/* ── Worker table ── */}
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
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">출근</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">배치 프로젝트</th>
                  </tr>
                </thead>
                <tbody>
                  {workerList
                    .filter((w) => w.isActive)
                    .sort((a, b) => {
                      // On-site first, then checked-in, then untracked
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
                        projects={activeProjects}
                        onAssign={(pid) => handleAssign(worker.id, pid)}
                      />
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
