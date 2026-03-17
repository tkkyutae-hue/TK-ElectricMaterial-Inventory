import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRef, useState } from "react";
import {
  ArrowLeft, HardHat, Pencil, Save, X, Loader2,
  Star, ClipboardList, Calendar, Zap, LayoutGrid,
  Camera, StickyNote, Award, PlusCircle, Trash2,
  Check, ChevronDown, ChevronUp, History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { type Worker, type WorkerAttendance, type WorkerEvaluation } from "@shared/schema";

// ─── Constants ────────────────────────────────────────────────────────────────
export const TRADE_OPTIONS = [
  { value: "General Manager",        label: "부장 — General Manager"        },
  { value: "Deputy General Manager", label: "차장 — Deputy General Manager" },
  { value: "Manager",                label: "과장 — Manager"                },
  { value: "Assistant Manager",      label: "대리 — Assistant Manager"      },
  { value: "Staff",                  label: "사원 — Staff"                  },
  { value: "Project Engineer",       label: "공무 — Project Engineer"       },
  { value: "Foreman",                label: "팀장 — Foreman"                },
  { value: "Helper",                 label: "조공 — Helper"                 },
  { value: "Safety",                 label: "안전관리자 — Safety"            },
];

const SKILL_CATEGORIES = [
  "Work Schedule / Reading / Plan",
  "Drawings / Reading / Check",
  "Materials / Order / Check",
  "Cable Tray / Support",
  "Power / LV / Conduit / Connection",
  "Grounding / Lightning Protection",
  "Lighting / Indoor / Outdoor / Exit",
  "Team Member Control",
  "Attitude / Safety / Compliance",
];

const ATTENDANCE_STATUS_OPTIONS = [
  { value: "ATTEND",      label: "Attend",       score: 10  },
  { value: "PTO",         label: "PTO",          score: 8   },
  { value: "SICK",        label: "Sick",         score: 7   },
  { value: "ABSENT",      label: "Absent",       score: 0   },
  { value: "LATE",        label: "Late",         score: 5   },
  { value: "EARLY_LEAVE", label: "Early Leave",  score: 4   },
  { value: "WFH",         label: "WFH",          score: 8   },
  { value: "TRAINING",    label: "Training",     score: 9   },
  { value: "SUSPENDED",   label: "Suspended",    score: 0   },
  { value: "OFF",         label: "Off",          score: null }, // excluded
  { value: "TERMINATED",  label: "Terminated",   score: null }, // excluded
];

const ATTENDANCE_SCORES: Record<string, number | null> = Object.fromEntries(
  ATTENDANCE_STATUS_OPTIONS.map((o) => [o.value, o.score])
);

const SCORE_OPTIONS = ["1","2","3","4","5","6","7","8","9","10"];
const GENDER_OPTIONS = ["Male","Female","Other"];

// ─── Helper functions ─────────────────────────────────────────────────────────
function computeAttendanceScore(records: WorkerAttendance[]): number | null {
  const scored = records.filter((r) => ATTENDANCE_SCORES[r.status] !== null && ATTENDANCE_SCORES[r.status] !== undefined);
  if (scored.length === 0) return null;
  const total = scored.reduce((sum, r) => sum + (ATTENDANCE_SCORES[r.status] ?? 0), 0);
  return Math.round((total / scored.length) * 10) / 10;
}

function getGrade(score: number): string {
  if (score >= 9.0) return "A";
  if (score >= 8.0) return "B";
  if (score >= 7.0) return "C";
  if (score >= 5.0) return "D";
  return "F";
}

function getInterpretation(score: number): string {
  if (score >= 9.0) return "Excellent / Ready to lead";
  if (score >= 7.0) return "Strong / Reliable";
  if (score >= 5.0) return "Average / Needs improvement";
  if (score >= 3.0) return "Weak / Needs training";
  return "Critical / Immediate improvement needed";
}

function getPips(score: number): number {
  if (score >= 9.0) return 5;
  if (score >= 7.0) return 4;
  if (score >= 5.0) return 3;
  if (score >= 3.0) return 2;
  return 1;
}

function getSkillLabel(score: number): string {
  if (score >= 9.0) return "Excellent";
  if (score >= 7.0) return "Strong";
  if (score >= 5.0) return "Average";
  if (score >= 3.0) return "Weak";
  return "Critical";
}

function parseSkillBoard(raw?: string | null): (number | null)[] {
  try {
    const parsed = JSON.parse(raw ?? "[]");
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return Array(9).fill(null);
}

function getStatusStyle(status: string): string {
  const map: Record<string, string> = {
    ATTEND:      "bg-emerald-100 text-emerald-700 border-emerald-200",
    PTO:         "bg-blue-100 text-blue-700 border-blue-200",
    SICK:        "bg-yellow-100 text-yellow-700 border-yellow-200",
    ABSENT:      "bg-red-100 text-red-700 border-red-200",
    LATE:        "bg-orange-100 text-orange-700 border-orange-200",
    EARLY_LEAVE: "bg-amber-100 text-amber-700 border-amber-200",
    WFH:         "bg-cyan-100 text-cyan-700 border-cyan-200",
    TRAINING:    "bg-violet-100 text-violet-700 border-violet-200",
    SUSPENDED:   "bg-red-200 text-red-800 border-red-300",
    OFF:         "bg-slate-100 text-slate-500 border-slate-200",
    TERMINATED:  "bg-stone-200 text-stone-700 border-stone-300",
  };
  return map[status] ?? "bg-slate-100 text-slate-500 border-slate-200";
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function WorkerAvatar({ photoUrl, name, size }: { photoUrl?: string | null; name: string; size: "sm" | "md" | "lg" }) {
  const dims = { sm: "w-10 h-10", md: "w-16 h-16", lg: "w-24 h-24" };
  const texts = { sm: "text-sm", md: "text-lg", lg: "text-3xl" };
  const initials = name.trim().split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  if (photoUrl) return (
    <img src={photoUrl} alt={name}
      className={`${dims[size]} rounded-full object-cover border-2 border-white shadow-md shrink-0`} />
  );
  return (
    <div className={`${dims[size]} rounded-full shrink-0 bg-slate-100 border-2 border-white shadow-md flex items-center justify-center`}>
      {initials
        ? <span className={`font-bold text-slate-500 ${texts[size]}`}>{initials}</span>
        : <HardHat className={size === "lg" ? "w-10 h-10 text-slate-300" : "w-5 h-5 text-slate-300"} />
      }
    </div>
  );
}

function PhotoUpload({ value, onChange }: { value?: string | null; onChange: (v: string | null) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
  }
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="w-24 h-24 rounded-full border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden cursor-pointer hover:border-blue-400 transition-colors"
        onClick={() => fileRef.current?.click()}
      >
        {value
          ? <img src={value} alt="Preview" className="w-full h-full object-cover" />
          : <Camera className="w-8 h-8 text-slate-300" />
        }
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" className="text-xs gap-1 h-7"
          onClick={() => fileRef.current?.click()}>
          <Camera className="w-3 h-3" />{value ? "Change" : "Upload"}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm"
            className="text-xs text-red-400 hover:text-red-600 h-7"
            onClick={() => { onChange(null); if (fileRef.current) fileRef.current.value = ""; }}>
            Remove
          </Button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
        className="hidden" onChange={handleFile} />
    </div>
  );
}

function PipsRow({ score }: { score: number | null }) {
  const count = score !== null ? getPips(score) : 0;
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map((i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full ${i <= count
            ? count >= 5 ? "bg-emerald-500"
              : count >= 4 ? "bg-blue-500"
              : count >= 3 ? "bg-amber-500"
              : count >= 2 ? "bg-orange-500"
              : "bg-red-500"
            : "bg-slate-200"
          }`}
        />
      ))}
    </div>
  );
}

function ScoreSelect({ label, field }: { label: string; field: { value: any; onChange: (v: any) => void } }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-slate-500">{label}</label>
      <Select
        value={field.value !== null && field.value !== undefined ? String(field.value) : "__none__"}
        onValueChange={(v) => field.onChange(v === "__none__" ? null : Number(v))}
      >
        <SelectTrigger className="h-9 text-sm">
          <SelectValue placeholder="Select score…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">— Not rated —</SelectItem>
          {SCORE_OPTIONS.map((s) => (
            <SelectItem key={s} value={s}>{s} / 10</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
      <span className="text-xs font-medium text-slate-400 w-28 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-slate-700 flex-1">{value || <span className="text-slate-300">—</span>}</span>
    </div>
  );
}

// ─── Form Schemas ─────────────────────────────────────────────────────────────
const profileSchema = z.object({
  fullName:    z.string().min(1, "Name is required"),
  trade:       z.string().optional().nullable(),
  photoUrl:    z.string().optional().nullable(),
  isActive:    z.boolean().optional(),
  gender:      z.string().optional().nullable(),
  nationality: z.string().optional().nullable(),
  workerState: z.string().optional().nullable(),
  dateOfTk:    z.string().optional().nullable(),
  project:     z.string().optional().nullable(),
});

const evalSchema = z.object({
  skill:          z.coerce.number().int().min(1).max(10).optional().nullable(),
  control:        z.coerce.number().int().min(1).max(10).optional().nullable(),
  attitude:       z.coerce.number().int().min(1).max(10).optional().nullable(),
  specialAbility: z.string().optional().nullable(),
  notes:          z.string().optional().nullable(),
});

type ProfileValues = z.infer<typeof profileSchema>;
type EvalValues    = z.infer<typeof evalSchema>;

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function WorkerDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const workerId = parseInt(id ?? "0", 10);

  const [editingProfile, setEditingProfile] = useState(false);
  const [editingEval, setEditingEval]        = useState(false);
  const [editingSkillBoard, setEditingSkillBoard] = useState(false);
  const [sbScores, setSbScores]              = useState<(number | null)[]>(Array(9).fill(null));
  const [showAttendForm, setShowAttendForm]  = useState(false);
  const [attendDate, setAttendDate]          = useState(() => new Date().toISOString().slice(0, 10));
  const [attendStatus, setAttendStatus]      = useState("ATTEND");
  const [attendNotes, setAttendNotes]        = useState("");
  const [showEvalSnapshot, setShowEvalSnapshot] = useState(false);
  const [snapshotEvaluator, setSnapshotEvaluator] = useState("");
  const [snapshotProject, setSnapshotProject]     = useState("");
  const [confirmDeleteAttId, setConfirmDeleteAttId] = useState<number | null>(null);

  // ── Queries ──
  const { data: worker, isLoading } = useQuery<Worker>({
    queryKey: ["/api/workers", workerId],
    queryFn: async () => {
      const res = await fetch(`/api/workers/${workerId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Worker not found");
      return res.json();
    },
    enabled: !isNaN(workerId) && workerId > 0,
  });

  const { data: attendanceRecords = [] } = useQuery<WorkerAttendance[]>({
    queryKey: ["/api/workers", workerId, "attendance"],
    queryFn: async () => {
      const res = await fetch(`/api/workers/${workerId}/attendance`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !isNaN(workerId) && workerId > 0,
  });

  const { data: evaluationHistory = [] } = useQuery<WorkerEvaluation[]>({
    queryKey: ["/api/workers", workerId, "evaluations"],
    queryFn: async () => {
      const res = await fetch(`/api/workers/${workerId}/evaluations`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !isNaN(workerId) && workerId > 0,
  });

  // ── Mutations ──
  const profileMutation = useMutation({
    mutationFn: (data: ProfileValues) => apiRequest("PUT", `/api/workers/${workerId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workers", workerId] });
      toast({ title: "Profile updated." });
      setEditingProfile(false);
    },
    onError: (err: any) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  const evalMutation = useMutation({
    mutationFn: (data: EvalValues) => apiRequest("PUT", `/api/workers/${workerId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workers", workerId] });
      toast({ title: "Evaluation saved." });
      setEditingEval(false);
    },
    onError: (err: any) => toast({ title: "Save failed", description: err.message, variant: "destructive" }),
  });

  const skillBoardMutation = useMutation({
    mutationFn: (scores: (number | null)[]) =>
      apiRequest("PUT", `/api/workers/${workerId}`, { skillBoard: JSON.stringify(scores) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workers", workerId] });
      toast({ title: "Skill Board saved." });
      setEditingSkillBoard(false);
    },
    onError: (err: any) => toast({ title: "Save failed", description: err.message, variant: "destructive" }),
  });

  const addAttendanceMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/workers/${workerId}/attendance`, {
        workerId, date: attendDate, status: attendStatus, notes: attendNotes || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workers", workerId, "attendance"] });
      toast({ title: "Attendance record added." });
      setShowAttendForm(false);
      setAttendDate(new Date().toISOString().slice(0, 10));
      setAttendStatus("ATTEND");
      setAttendNotes("");
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const deleteAttendanceMutation = useMutation({
    mutationFn: (recordId: number) =>
      apiRequest("DELETE", `/api/workers/${workerId}/attendance/${recordId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workers", workerId, "attendance"] });
      setConfirmDeleteAttId(null);
      toast({ title: "Record removed." });
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const saveSnapshotMutation = useMutation({
    mutationFn: () => {
      const attScore = computeAttendanceScore(attendanceRecords);
      return apiRequest("POST", `/api/workers/${workerId}/evaluations`, {
        workerId,
        evaluationDate: new Date().toISOString().slice(0, 10),
        evaluatorName: snapshotEvaluator || null,
        project: snapshotProject || null,
        skill: worker?.skill ?? null,
        control: worker?.control ?? null,
        attitude: worker?.attitude ?? null,
        attendance: attScore !== null ? Math.round(attScore) : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workers", workerId, "evaluations"] });
      toast({ title: "Evaluation snapshot saved." });
      setShowEvalSnapshot(false);
      setSnapshotEvaluator("");
      setSnapshotProject("");
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  // ── Forms ──
  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: "", trade: null, photoUrl: null, isActive: true, gender: null, nationality: null, workerState: null, dateOfTk: null, project: null },
  });

  const evalForm = useForm<EvalValues>({
    resolver: zodResolver(evalSchema),
    defaultValues: { skill: null, control: null, attitude: null, specialAbility: "", notes: "" },
  });

  function startEditProfile() {
    if (!worker) return;
    profileForm.reset({
      fullName: worker.fullName,
      trade: worker.trade ?? null,
      photoUrl: worker.photoUrl ?? null,
      isActive: worker.isActive,
      gender: worker.gender ?? null,
      nationality: worker.nationality ?? null,
      workerState: worker.workerState ?? null,
      dateOfTk: worker.dateOfTk ?? null,
      project: worker.project ?? null,
    });
    setEditingProfile(true);
  }

  function startEditEval() {
    if (!worker) return;
    evalForm.reset({
      skill:          worker.skill ?? null,
      control:        worker.control ?? null,
      attitude:       worker.attitude ?? null,
      specialAbility: worker.specialAbility ?? "",
      notes:          worker.notes ?? "",
    });
    setEditingEval(true);
  }

  function startEditSkillBoard() {
    const parsed = parseSkillBoard(worker?.skillBoard);
    setSbScores(Array(9).fill(null).map((_, i) => parsed[i] ?? null));
    setEditingSkillBoard(true);
  }

  // ── Loading / error ──
  if (isLoading) return (
    <div className="flex items-center justify-center py-32 gap-3">
      <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
      <p className="text-sm text-slate-400">Loading worker…</p>
    </div>
  );
  if (!worker) return (
    <div className="flex flex-col items-center justify-center py-32 gap-3 text-center">
      <HardHat className="w-10 h-10 text-slate-300" />
      <p className="text-sm font-medium text-slate-500">Worker not found</p>
      <Button variant="outline" size="sm" onClick={() => navigate("/manpower")}>
        <ArrowLeft className="w-4 h-4 mr-2" />Back to Manpower
      </Button>
    </div>
  );

  // ── Computed values ──
  const tradeLabel    = TRADE_OPTIONS.find((o) => o.value === worker.trade)?.label ?? worker.trade ?? "Unclassified";
  const attendScore   = computeAttendanceScore(attendanceRecords);
  const sbParsed      = parseSkillBoard(worker.skillBoard);

  const scores = [worker.skill, worker.control, worker.attitude, attendScore !== null ? Math.round(attendScore * 10) / 10 : null];
  const validScores = scores.filter((s) => s !== null) as number[];
  const totalScore = validScores.length === 4 ? Math.round((validScores.reduce((a, b) => a + b, 0) / 4) * 10) / 10 : null;

  // Attendance status counts
  const statusCounts = attendanceRecords.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  // Skill board avg (of rated categories, including auto attendance)
  const sbAll = [...sbParsed.slice(0, 9), attendScore !== null ? attendScore : null];
  const sbRated = sbAll.filter((s) => s !== null) as number[];
  const sbAvg = sbRated.length > 0 ? Math.round((sbRated.reduce((a, b) => a + b, 0) / sbRated.length) * 100) / 100 : null;

  return (
    <div className="space-y-5 max-w-4xl">

      {/* ── Breadcrumb ── */}
      <Button variant="ghost" size="sm"
        className="gap-1.5 text-slate-500 hover:text-slate-700 -ml-1"
        data-testid="btn-back-manpower"
        onClick={() => navigate("/manpower")}
      >
        <ArrowLeft className="w-4 h-4" /> Back to Manpower
      </Button>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* A. HEADER IDENTITY BANNER                                             */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <Card className="overflow-hidden">
        {/* Colored top bar */}
        <div className="h-2 bg-gradient-to-r from-blue-500 via-blue-400 to-indigo-500" />

        <CardContent className="pt-6 pb-6">
          {editingProfile ? (
            <Form {...profileForm}>
              <form onSubmit={profileForm.handleSubmit((v) => profileMutation.mutate(v))} className="space-y-5">
                <div className="flex gap-6 flex-wrap items-start">
                  {/* Photo */}
                  <FormField control={profileForm.control} name="photoUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <PhotoUpload value={field.value} onChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  {/* Identity fields */}
                  <div className="flex-1 min-w-[200px] grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField control={profileForm.control} name="fullName"
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Full Name <span className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <Input data-testid="input-detail-name" autoFocus {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField control={profileForm.control} name="trade"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Trade / Classification</FormLabel>
                          <Select value={field.value ?? "__none__"}
                            onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}>
                            <FormControl>
                              <SelectTrigger data-testid="select-detail-trade">
                                <SelectValue placeholder="Select…" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="__none__">— None —</SelectItem>
                              {TRADE_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField control={profileForm.control} name="isActive"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select value={field.value ? "active" : "inactive"}
                            onValueChange={(v) => field.onChange(v === "active")}>
                            <FormControl>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <FormField control={profileForm.control} name="project"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Project</FormLabel>
                          <FormControl>
                            <Input placeholder="Current project…" {...field} value={field.value ?? ""} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField control={profileForm.control} name="dateOfTk"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date of TK</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} value={field.value ?? ""} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField control={profileForm.control} name="gender"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gender</FormLabel>
                          <Select value={field.value ?? "__none__"}
                            onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="__none__">— None —</SelectItem>
                              {GENDER_OPTIONS.map((g) => (
                                <SelectItem key={g} value={g}>{g}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <FormField control={profileForm.control} name="nationality"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nationality</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Korean, American…" {...field} value={field.value ?? ""} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField control={profileForm.control} name="workerState"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. TX, CA…" {...field} value={field.value ?? ""} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button type="submit" data-testid="btn-profile-save" disabled={profileMutation.isPending} className="gap-1.5">
                    {profileMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Profile
                  </Button>
                  <Button type="button" variant="outline" className="gap-1.5"
                    onClick={() => setEditingProfile(false)} disabled={profileMutation.isPending}>
                    <X className="w-4 h-4" />Cancel
                  </Button>
                </div>
              </form>
            </Form>
          ) : (
            <div className="flex items-start gap-5 flex-wrap">
              <WorkerAvatar photoUrl={worker.photoUrl} name={worker.fullName} size="lg" />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h1 className="text-2xl font-bold text-slate-900 leading-tight" data-testid="text-worker-fullname">
                      {worker.fullName}
                    </h1>
                    <p className="text-slate-500 mt-0.5 font-medium" data-testid="text-worker-trade-detail">
                      {tradeLabel}
                    </p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {worker.isActive ? (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 border font-semibold" data-testid="badge-worker-active">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200 font-semibold" data-testid="badge-worker-inactive">
                          Inactive
                        </Badge>
                      )}
                      {totalScore !== null && (
                        <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 font-semibold">
                          Grade {getGrade(totalScore)}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="gap-1.5 shrink-0"
                    data-testid="btn-edit-profile" onClick={startEditProfile}>
                    <Pencil className="w-3.5 h-3.5" /> Edit Profile
                  </Button>
                </div>

                {/* Identity meta */}
                <div className="flex flex-wrap gap-x-6 gap-y-1 mt-4 text-xs text-slate-500">
                  <span><span className="font-medium text-slate-400">ID</span> #{worker.id}</span>
                  {worker.project && (
                    <span><span className="font-medium text-slate-400">Project</span> {worker.project}</span>
                  )}
                  {worker.dateOfTk && (
                    <span>
                      <span className="font-medium text-slate-400">Date of TK</span>{" "}
                      {new Date(worker.dateOfTk).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                    </span>
                  )}
                  {worker.nationality && (
                    <span><span className="font-medium text-slate-400">Nationality</span> {worker.nationality}</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* B + C. BASIC INFO + EVALUATION SUMMARY (2-col grid)                  */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* B. Basic Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <HardHat className="w-4 h-4 text-slate-400" />
              Basic Info
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-5">
            <InfoRow label="Gender"     value={worker.gender} />
            <InfoRow label="Nationality" value={worker.nationality} />
            <InfoRow label="State"      value={worker.workerState} />
            <InfoRow label="Registered" value={
              worker.createdAt
                ? new Date(worker.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
                : undefined
            } />
          </CardContent>
        </Card>

        {/* C. Evaluation Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Award className="w-4 h-4 text-slate-400" />
              Evaluation Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-5">
            {/* 4 score pills */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { label: "Skill",      value: worker.skill,    color: "text-blue-600",    bg: "bg-blue-50"    },
                { label: "Control",    value: worker.control,  color: "text-violet-600",  bg: "bg-violet-50"  },
                { label: "Attitude",   value: worker.attitude, color: "text-amber-600",   bg: "bg-amber-50"   },
                { label: "Attendance", value: attendScore,     color: "text-emerald-600", bg: "bg-emerald-50" },
              ].map(({ label, value, color, bg }) => (
                <div key={label} className={`rounded-xl p-3 ${bg} flex items-center gap-2`}>
                  <div className="flex-1">
                    <p className="text-xs text-slate-500 font-medium">{label}</p>
                    <p className={`text-xl font-bold ${value !== null && value !== undefined ? color : "text-slate-300"}`}>
                      {value !== null && value !== undefined
                        ? <>{typeof value === "number" && !Number.isInteger(value) ? value.toFixed(1) : value}<span className="text-xs font-normal text-slate-400">/10</span></>
                        : "—"}
                    </p>
                  </div>
                  {label === "Attendance" && value !== null && (
                    <span className="text-[10px] text-slate-400 leading-tight text-right">{attendanceRecords.length} records</span>
                  )}
                </div>
              ))}
            </div>

            {/* Total score */}
            {totalScore !== null ? (
              <div className="border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Total Score</p>
                    <p className="text-2xl font-bold text-slate-800 mt-0.5">
                      {totalScore.toFixed(1)}<span className="text-sm font-normal text-slate-400"> / 10</span>
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs font-bold border-blue-200 bg-blue-50 text-blue-700">
                        Grade {getGrade(totalScore)}
                      </Badge>
                      <span className="text-xs text-slate-500">{getInterpretation(totalScore)}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-slate-300">
                      {Math.round(totalScore * 10)}
                      <span className="text-sm font-normal">%</span>
                    </p>
                  </div>
                </div>
                {/* Total bar */}
                <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      totalScore >= 7 ? "bg-emerald-500" : totalScore >= 5 ? "bg-amber-500" : "bg-red-500"
                    }`}
                    style={{ width: `${totalScore * 10}%` }}
                  />
                </div>
              </div>
            ) : (
              <p className="text-center text-xs text-slate-300 mt-2 border-t border-slate-50 pt-3">
                Total score requires all 4 categories to be rated.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* EVALUATION (Skill / Control / Attitude) + Special Ability + Notes    */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Star className="w-4 h-4 text-slate-400" />
              Skill / Control / Attitude
            </CardTitle>
            {!editingEval && (
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7"
                data-testid="btn-edit-eval" onClick={startEditEval}>
                <Pencil className="w-3 h-3" /> Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pb-5">
          {editingEval ? (
            <Form {...evalForm}>
              <form onSubmit={evalForm.handleSubmit((v) => evalMutation.mutate(v))} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <FormField control={evalForm.control} name="skill"
                    render={({ field }) => <FormItem><FormControl><ScoreSelect label="Skill" field={field} /></FormControl><FormMessage /></FormItem>}
                  />
                  <FormField control={evalForm.control} name="control"
                    render={({ field }) => <FormItem><FormControl><ScoreSelect label="Control" field={field} /></FormControl><FormMessage /></FormItem>}
                  />
                  <FormField control={evalForm.control} name="attitude"
                    render={({ field }) => <FormItem><FormControl><ScoreSelect label="Attitude" field={field} /></FormControl><FormMessage /></FormItem>}
                  />
                </div>

                <div className="border-t border-slate-50 pt-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />Special Ability
                  </p>
                  <FormField control={evalForm.control} name="specialAbility"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input data-testid="input-special-ability"
                            placeholder="e.g. High voltage work, Conduit bending…"
                            {...field} value={field.value ?? ""} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="border-t border-slate-50 pt-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <StickyNote className="w-3.5 h-3.5 text-slate-400" />Evaluator Notes
                  </p>
                  <FormField control={evalForm.control} name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea data-testid="textarea-notes"
                            placeholder="Internal notes about this worker…"
                            rows={3} {...field} value={field.value ?? ""} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex gap-2 pt-1 border-t border-slate-100">
                  <Button type="submit" data-testid="btn-eval-save" disabled={evalMutation.isPending} className="gap-1.5">
                    {evalMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Evaluation
                  </Button>
                  <Button type="button" variant="outline" className="gap-1.5"
                    onClick={() => setEditingEval(false)} disabled={evalMutation.isPending}>
                    <X className="w-4 h-4" />Cancel
                  </Button>
                </div>
              </form>
            </Form>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2.5">
                {[
                  { label: "Skill",    value: worker.skill,    color: "bg-blue-500"  },
                  { label: "Control",  value: worker.control,  color: "bg-violet-500"},
                  { label: "Attitude", value: worker.attitude, color: "bg-amber-500" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className="text-xs font-medium text-slate-500 w-16 shrink-0">{label}</span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      {value !== null && value !== undefined && (
                        <div className={`h-full ${color} rounded-full`} style={{ width: `${(value / 10) * 100}%` }} />
                      )}
                    </div>
                    <span className="text-sm font-semibold text-slate-700 w-8 text-right">
                      {value !== null && value !== undefined ? value : <span className="text-slate-300">—</span>}
                    </span>
                  </div>
                ))}
              </div>

              {/* Special Ability */}
              <div className="border-t border-slate-50 pt-3 flex items-start gap-3">
                <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-slate-400 mb-0.5">Special Ability</p>
                  <p className="text-sm text-slate-700">
                    {worker.specialAbility || <span className="text-slate-300">—</span>}
                  </p>
                </div>
              </div>

              {/* Notes */}
              <div className="border-t border-slate-50 pt-3 flex items-start gap-3">
                <StickyNote className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-slate-400 mb-0.5">Evaluator Notes</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">
                    {worker.notes || <span className="text-slate-300">—</span>}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* D. SKILL EVALUATION BOARD                                             */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <LayoutGrid className="w-4 h-4 text-slate-400" />
              Skill Evaluation Board
            </CardTitle>
            {!editingSkillBoard ? (
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7"
                data-testid="btn-edit-skillboard" onClick={startEditSkillBoard}>
                <Pencil className="w-3 h-3" /> Edit
              </Button>
            ) : (
              <div className="flex gap-1">
                <Button size="sm" className="gap-1 h-7 text-xs"
                  onClick={() => skillBoardMutation.mutate(sbScores)} disabled={skillBoardMutation.isPending}>
                  {skillBoardMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  Save
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                  onClick={() => setEditingSkillBoard(false)} disabled={skillBoardMutation.isPending}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="pb-5">
          <div className="space-y-0 divide-y divide-slate-50">
            {SKILL_CATEGORIES.map((cat, i) => {
              const score = editingSkillBoard ? sbScores[i] : (sbParsed[i] ?? null);
              return (
                <div key={cat} className="flex items-center gap-3 py-2.5">
                  <div className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-slate-400">{i + 1}</span>
                  </div>
                  <span className="text-sm text-slate-700 flex-1 min-w-0 leading-tight">{cat}</span>
                  {editingSkillBoard ? (
                    <Select
                      value={score !== null ? String(score) : "__none__"}
                      onValueChange={(v) => {
                        const copy = [...sbScores];
                        copy[i] = v === "__none__" ? null : Number(v);
                        setSbScores(copy);
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs w-24 shrink-0">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— N/A —</SelectItem>
                        {SCORE_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <>
                      <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden shrink-0">
                        {score !== null && (
                          <div
                            className={`h-full rounded-full ${score >= 8 ? "bg-emerald-500" : score >= 5 ? "bg-amber-500" : "bg-red-500"}`}
                            style={{ width: `${(score / 10) * 100}%` }}
                          />
                        )}
                      </div>
                      <PipsRow score={score} />
                      <span className="text-sm font-bold text-slate-700 w-6 text-right shrink-0">
                        {score !== null ? score : <span className="text-slate-300 font-normal">—</span>}
                      </span>
                      <span className="text-xs text-slate-400 w-14 shrink-0">
                        {score !== null ? getSkillLabel(score) : ""}
                      </span>
                    </>
                  )}
                </div>
              );
            })}

            {/* Attendance row (auto) */}
            <div className="flex items-center gap-3 py-2.5 bg-slate-50/60 rounded-b-lg -mx-1 px-1">
              <div className="w-6 h-6 rounded-md bg-emerald-100 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-emerald-600">10</span>
              </div>
              <span className="text-sm text-slate-700 flex-1">Attendance / Punctuality / Reliability</span>
              <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-200 bg-emerald-50 h-5 px-1.5 shrink-0">
                Auto
              </Badge>
              <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden shrink-0">
                {attendScore !== null && (
                  <div
                    className={`h-full rounded-full ${attendScore >= 8 ? "bg-emerald-500" : attendScore >= 5 ? "bg-amber-500" : "bg-red-500"}`}
                    style={{ width: `${(attendScore / 10) * 100}%` }}
                  />
                )}
              </div>
              <PipsRow score={attendScore} />
              <span className="text-sm font-bold text-slate-700 w-6 text-right shrink-0">
                {attendScore !== null ? attendScore.toFixed(1) : <span className="text-slate-300 font-normal">—</span>}
              </span>
              <span className="text-xs text-slate-400 w-14 shrink-0">
                {attendScore !== null ? (attendScore >= 7 ? "Reliable" : getSkillLabel(attendScore)) : ""}
              </span>
            </div>
          </div>

          {/* Footer */}
          {sbAvg !== null && (
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Average Board Score</span>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-slate-700">{sbAvg.toFixed(2)} / 10</span>
                <Badge variant="outline" className="text-xs font-medium text-slate-500 border-slate-200">
                  {getSkillLabel(sbAvg)}
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* E. ATTENDANCE RECORD                                                  */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              Attendance Record
            </CardTitle>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7"
              data-testid="btn-add-attendance" onClick={() => setShowAttendForm((v) => !v)}>
              {showAttendForm ? <ChevronUp className="w-3 h-3" /> : <PlusCircle className="w-3 h-3" />}
              {showAttendForm ? "Close" : "Add Record"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pb-5">
          {/* Status counts + score */}
          <div className="flex items-start gap-4 flex-wrap mb-4">
            <div className="flex-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                Status Summary
              </p>
              {Object.keys(statusCounts).length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {ATTENDANCE_STATUS_OPTIONS.filter((o) => statusCounts[o.value]).map((o) => (
                    <div key={o.value}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium ${getStatusStyle(o.value)}`}>
                      {o.label}
                      <span className="font-bold">{statusCounts[o.value]}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-300">No records yet</p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Attendance Score</p>
              {attendScore !== null ? (
                <>
                  <p className="text-2xl font-bold text-emerald-600">{attendScore.toFixed(1)}<span className="text-sm font-normal text-slate-400"> / 10</span></p>
                  <p className="text-xs text-slate-500">{getInterpretation(attendScore)}</p>
                </>
              ) : (
                <p className="text-sm text-slate-300">—</p>
              )}
            </div>
          </div>

          {/* Add record inline form */}
          {showAttendForm && (
            <div className="mb-4 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Add Attendance Record</p>
              <div className="flex gap-3 flex-wrap items-end">
                <div className="space-y-1">
                  <label className="text-xs text-slate-500">Date</label>
                  <Input type="date" value={attendDate} onChange={(e) => setAttendDate(e.target.value)}
                    className="h-8 text-sm w-36 bg-white" data-testid="input-attend-date" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-500">Status</label>
                  <Select value={attendStatus} onValueChange={setAttendStatus}>
                    <SelectTrigger className="h-8 text-sm w-36 bg-white" data-testid="select-attend-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ATTENDANCE_STATUS_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 flex-1 min-w-[120px]">
                  <label className="text-xs text-slate-500">Notes (optional)</label>
                  <Input value={attendNotes} onChange={(e) => setAttendNotes(e.target.value)}
                    placeholder="Optional note…" className="h-8 text-sm bg-white" data-testid="input-attend-notes" />
                </div>
                <Button size="sm" className="h-8 gap-1 text-xs"
                  onClick={() => addAttendanceMutation.mutate()} disabled={addAttendanceMutation.isPending}>
                  {addAttendanceMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  Save
                </Button>
              </div>
            </div>
          )}

          {/* Recent log */}
          {attendanceRecords.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">Date</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">Status</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">Score</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">Notes</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {attendanceRecords.slice(0, 20).map((rec) => {
                    const statusOpt = ATTENDANCE_STATUS_OPTIONS.find((o) => o.value === rec.status);
                    const isConfirming = confirmDeleteAttId === rec.id;
                    return (
                      <tr key={rec.id} className={`transition-colors ${isConfirming ? "bg-red-50" : "hover:bg-slate-50"}`}>
                        <td className="px-3 py-2 text-slate-600 tabular-nums text-xs">
                          {new Date(rec.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${getStatusStyle(rec.status)}`}>
                            {statusOpt?.label ?? rec.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs font-medium text-slate-600">
                          {statusOpt?.score !== null && statusOpt?.score !== undefined
                            ? statusOpt.score
                            : <span className="text-slate-300">excl.</span>}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-500">{rec.notes || <span className="text-slate-200">—</span>}</td>
                        <td className="px-3 py-2 text-right">
                          {isConfirming ? (
                            <div className="flex items-center justify-end gap-1">
                              <Button size="sm" variant="destructive" className="h-6 px-2 text-xs gap-0.5"
                                onClick={() => deleteAttendanceMutation.mutate(rec.id)}
                                disabled={deleteAttendanceMutation.isPending}>
                                {deleteAttendanceMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                              </Button>
                              <Button size="sm" variant="outline" className="h-6 w-6 p-0"
                                onClick={() => setConfirmDeleteAttId(null)}>
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          ) : (
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-200 hover:text-red-500"
                              onClick={() => setConfirmDeleteAttId(rec.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {attendanceRecords.length > 20 && (
                <p className="text-xs text-slate-400 text-center pt-3">
                  Showing 20 of {attendanceRecords.length} records
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-center text-slate-300 py-6">No attendance records yet</p>
          )}
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* F. EVALUATION HISTORY                                                  */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <History className="w-4 h-4 text-slate-400" />
              Evaluation History
            </CardTitle>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7"
              data-testid="btn-save-snapshot" onClick={() => setShowEvalSnapshot((v) => !v)}>
              {showEvalSnapshot ? <ChevronUp className="w-3 h-3" /> : <ClipboardList className="w-3 h-3" />}
              {showEvalSnapshot ? "Close" : "Save Snapshot"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pb-5">
          {/* Snapshot form */}
          {showEvalSnapshot && (
            <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Save Evaluation Snapshot</p>
              <p className="text-xs text-slate-500 mb-3">
                This will save current scores (SK:{worker.skill ?? "—"} CT:{worker.control ?? "—"} AT:{worker.attitude ?? "—"} ATT:{attendScore !== null ? attendScore.toFixed(1) : "—"}) to history.
              </p>
              <div className="flex gap-3 flex-wrap items-end">
                <div className="space-y-1">
                  <label className="text-xs text-slate-500">Evaluator Name</label>
                  <Input value={snapshotEvaluator} onChange={(e) => setSnapshotEvaluator(e.target.value)}
                    placeholder="Your name…" className="h-8 text-sm w-40" data-testid="input-snapshot-evaluator" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-500">Project</label>
                  <Input value={snapshotProject} onChange={(e) => setSnapshotProject(e.target.value)}
                    placeholder="Project name…" className="h-8 text-sm w-40" data-testid="input-snapshot-project" />
                </div>
                <Button size="sm" className="h-8 gap-1 text-xs"
                  onClick={() => saveSnapshotMutation.mutate()} disabled={saveSnapshotMutation.isPending}>
                  {saveSnapshotMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  Save
                </Button>
              </div>
            </div>
          )}

          {/* History table */}
          {evaluationHistory.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {["Date","Evaluator","Project","SK","CT","AT","ATT","Total","Grade"].map((h) => (
                      <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {evaluationHistory.map((ev) => {
                    const scores4 = [ev.skill, ev.control, ev.attitude, ev.attendance].filter(s => s !== null) as number[];
                    const evTotal = scores4.length === 4
                      ? Math.round((scores4.reduce((a, b) => a + b, 0) / 4) * 10) / 10
                      : null;
                    return (
                      <tr key={ev.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-xs text-slate-600 tabular-nums whitespace-nowrap">
                          {new Date(ev.evaluationDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-600">{ev.evaluatorName || <span className="text-slate-300">—</span>}</td>
                        <td className="px-3 py-2 text-xs text-slate-600">{ev.project || <span className="text-slate-300">—</span>}</td>
                        <td className="px-3 py-2 text-xs font-medium text-slate-700">{ev.skill ?? <span className="text-slate-300">—</span>}</td>
                        <td className="px-3 py-2 text-xs font-medium text-slate-700">{ev.control ?? <span className="text-slate-300">—</span>}</td>
                        <td className="px-3 py-2 text-xs font-medium text-slate-700">{ev.attitude ?? <span className="text-slate-300">—</span>}</td>
                        <td className="px-3 py-2 text-xs font-medium text-emerald-700">{ev.attendance ?? <span className="text-slate-300">—</span>}</td>
                        <td className="px-3 py-2 text-xs font-bold text-slate-800">{evTotal !== null ? evTotal.toFixed(1) : <span className="text-slate-300 font-normal">—</span>}</td>
                        <td className="px-3 py-2">
                          {evTotal !== null ? (
                            <Badge variant="outline" className={`text-xs font-bold h-5 px-1.5 ${
                              getGrade(evTotal) === "A" ? "border-emerald-200 text-emerald-700 bg-emerald-50" :
                              getGrade(evTotal) === "B" ? "border-blue-200 text-blue-700 bg-blue-50" :
                              getGrade(evTotal) === "C" ? "border-amber-200 text-amber-700 bg-amber-50" :
                              getGrade(evTotal) === "D" ? "border-orange-200 text-orange-700 bg-orange-50" :
                              "border-red-200 text-red-700 bg-red-50"
                            }`}>
                              {getGrade(evTotal)}
                            </Badge>
                          ) : <span className="text-slate-300">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-center text-slate-300 py-6">
              No evaluation history yet — use "Save Snapshot" to record the current evaluation.
            </p>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
