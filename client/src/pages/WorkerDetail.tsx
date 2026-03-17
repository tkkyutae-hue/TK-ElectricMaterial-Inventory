import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRef, useState } from "react";
import {
  ArrowLeft, HardHat, Pencil, Save, X, Loader2,
  Star, ClipboardList, Calendar, Zap, LayoutGrid,
  Users, Camera, CheckCircle2, StickyNote,
  ShieldCheck, Award,
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
import { type Worker } from "@shared/schema";

// ─── Trade options ────────────────────────────────────────────────────────────
const TRADE_OPTIONS = [
  { value: "General Manager",        label: "부장 — General Manager"        },
  { value: "Deputy General Manager", label: "차장 — Deputy General Manager" },
  { value: "Manager",                label: "과장 — Manager"                },
  { value: "Assistant Manager",      label: "대리 — Assistant Manager"      },
  { value: "Staff",                  label: "사원 — Staff"                  },
  { value: "Project Engineer",       label: "공무 — Project Engineer"       },
  { value: "Foreman",                label: "Foreman"                       },
  { value: "Helper",                 label: "Helper"                        },
  { value: "Safety",                 label: "Safety"                        },
];

const SCORE_OPTIONS = ["1","2","3","4","5","6","7","8","9","10"];

// ─── Form schemas ─────────────────────────────────────────────────────────────
const basicSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  trade:    z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
});

const evalSchema = z.object({
  skill:         z.coerce.number().int().min(1).max(10).optional().nullable(),
  control:       z.coerce.number().int().min(1).max(10).optional().nullable(),
  attitude:      z.coerce.number().int().min(1).max(10).optional().nullable(),
  specialAbility: z.string().optional().nullable(),
  notes:         z.string().optional().nullable(),
});

type BasicValues = z.infer<typeof basicSchema>;
type EvalValues  = z.infer<typeof evalSchema>;

// ─── Avatar ───────────────────────────────────────────────────────────────────
function WorkerAvatar({
  photoUrl, name, size,
}: {
  photoUrl?: string | null; name: string; size: "sm" | "lg";
}) {
  const dim  = size === "lg" ? "w-24 h-24" : "w-10 h-10";
  const text = size === "lg" ? "text-3xl"  : "text-sm";
  const initials = name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  if (photoUrl) return (
    <img src={photoUrl} alt={name}
      className={`${dim} rounded-full object-cover border-2 border-slate-200 shrink-0`} />
  );
  return (
    <div className={`${dim} rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center shrink-0`}>
      {initials
        ? <span className={`font-semibold text-slate-500 ${text}`}>{initials}</span>
        : <HardHat className={size === "lg" ? "w-10 h-10 text-slate-300" : "w-5 h-5 text-slate-300"} />
      }
    </div>
  );
}

// ─── Photo upload ─────────────────────────────────────────────────────────────
function PhotoUpload({
  value, onChange,
}: {
  value?: string | null; onChange: (v: string | null) => void;
}) {
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
        className="w-24 h-24 rounded-full border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden cursor-pointer hover:border-slate-400 transition-colors"
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

// ─── Score display pill ───────────────────────────────────────────────────────
function ScorePill({
  label, value, max = 10, color,
}: {
  label: string; value?: number | null; max?: number; color: string;
}) {
  const hasValue = value !== null && value !== undefined;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`text-2xl font-bold ${hasValue ? color : "text-slate-300"}`}>
        {hasValue ? value : "—"}
        {hasValue && <span className="text-xs font-normal text-slate-400">/{max}</span>}
      </div>
      <p className="text-xs text-slate-400 font-medium">{label}</p>
    </div>
  );
}

// ─── Score ring ───────────────────────────────────────────────────────────────
function TotalScoreRing({ score, max }: { score: number | null; max: number }) {
  const hasScore = score !== null;
  const pct = hasScore ? Math.round((score! / max) * 100) : 0;
  const circumference = 2 * Math.PI * 28;
  const dashOffset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-16 h-16">
        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="28" fill="none" stroke="#f1f5f9" strokeWidth="6" />
          {hasScore && (
            <circle
              cx="32" cy="32" r="28" fill="none"
              stroke={pct >= 70 ? "#10b981" : pct >= 40 ? "#f59e0b" : "#ef4444"}
              strokeWidth="6"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
            />
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-sm font-bold ${hasScore ? "text-slate-700" : "text-slate-300"}`}>
            {hasScore ? score : "—"}
          </span>
        </div>
      </div>
      <p className="text-xs text-slate-400 font-medium">Total</p>
      <p className="text-[10px] text-slate-300">/ {max}</p>
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({
  icon: Icon, title, onEdit, isEditing,
}: {
  icon: React.ElementType; title: string; onEdit?: () => void; isEditing?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <CardTitle className="text-base font-semibold flex items-center gap-2">
        <Icon className="w-4 h-4 text-slate-400" />
        {title}
      </CardTitle>
      {onEdit && !isEditing && (
        <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7" onClick={onEdit}>
          <Pencil className="w-3 h-3" /> Edit
        </Button>
      )}
    </div>
  );
}

// ─── Read-only row ─────────────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
      <span className="text-xs font-medium text-slate-400 w-28 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-slate-700 flex-1">{value || <span className="text-slate-300">—</span>}</span>
    </div>
  );
}

// ─── Score select field ───────────────────────────────────────────────────────
function ScoreSelect({
  label, field,
}: {
  label: string;
  field: { value: any; onChange: (v: any) => void };
}) {
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

// ─── Main page ────────────────────────────────────────────────────────────────
export default function WorkerDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [editingBasic, setEditingBasic] = useState(false);
  const [editingEval,  setEditingEval]  = useState(false);

  const workerId = parseInt(id ?? "0", 10);

  // ── Fetch worker ──
  const { data: worker, isLoading } = useQuery<Worker>({
    queryKey: ["/api/workers", workerId],
    queryFn: async () => {
      const res = await fetch(`/api/workers/${workerId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Worker not found");
      return res.json();
    },
    enabled: !isNaN(workerId) && workerId > 0,
  });

  // ── Basic info form ──
  const basicForm = useForm<BasicValues>({
    resolver: zodResolver(basicSchema),
    defaultValues: { fullName: "", trade: "", photoUrl: null },
  });

  function startEditBasic() {
    if (!worker) return;
    basicForm.reset({
      fullName: worker.fullName,
      trade: worker.trade ?? "",
      photoUrl: worker.photoUrl ?? null,
    });
    setEditingBasic(true);
  }

  const basicMutation = useMutation({
    mutationFn: (data: BasicValues) => apiRequest("PUT", `/api/workers/${workerId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workers", workerId] });
      toast({ title: "Basic info updated." });
      setEditingBasic(false);
    },
    onError: (err: any) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  // ── Evaluation form ──
  const evalForm = useForm<EvalValues>({
    resolver: zodResolver(evalSchema),
    defaultValues: {
      skill: null, control: null, attitude: null,
      specialAbility: "", notes: "",
    },
  });

  function startEditEval() {
    if (!worker) return;
    evalForm.reset({
      skill:          worker.skill          ?? null,
      control:        worker.control        ?? null,
      attitude:       worker.attitude       ?? null,
      specialAbility: worker.specialAbility ?? "",
      notes:          worker.notes          ?? "",
    });
    setEditingEval(true);
  }

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

  // ── Loading / not found ──
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

  const tradeLabel = TRADE_OPTIONS.find((o) => o.value === worker.trade)?.label ?? worker.trade ?? "—";
  const totalScore = (
    (worker.skill    ?? 0) +
    (worker.control  ?? 0) +
    (worker.attitude ?? 0)
  );
  const hasAnyScore = worker.skill !== null || worker.control !== null || worker.attitude !== null;
  const totalDisplay = hasAnyScore ? totalScore : null;

  return (
    <div className="space-y-5 max-w-3xl">

      {/* ── Breadcrumb + title ── */}
      <div>
        <Button
          variant="ghost" size="sm"
          className="gap-1.5 text-slate-500 hover:text-slate-700 -ml-1 mb-3"
          data-testid="btn-back-manpower"
          onClick={() => navigate("/manpower")}
        >
          <ArrowLeft className="w-4 h-4" /> Back to Manpower
        </Button>
        <h1 className="text-3xl font-display font-bold text-slate-900">Worker Profile</h1>
        <p className="text-slate-500 mt-1 text-sm">
          {worker.fullName} · {tradeLabel}
        </p>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 1. BASIC INFO                                                        */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader className="pb-3">
          <SectionHeader icon={HardHat} title="Basic Info"
            onEdit={startEditBasic} isEditing={editingBasic} />
        </CardHeader>
        <CardContent className="pb-5">
          {editingBasic ? (
            <Form {...basicForm}>
              <form onSubmit={basicForm.handleSubmit((v) => basicMutation.mutate(v))}
                className="space-y-4">
                <div className="flex gap-6 flex-wrap">
                  <FormField control={basicForm.control} name="photoUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <PhotoUpload value={field.value} onChange={(v) => field.onChange(v)} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <div className="flex-1 min-w-[180px] space-y-3">
                    <FormField control={basicForm.control} name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name <span className="text-red-500">*</span></FormLabel>
                          <FormControl>
                            <Input data-testid="input-detail-name" autoFocus {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField control={basicForm.control} name="trade"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Trade / Classification</FormLabel>
                          <Select
                            value={field.value ?? ""}
                            onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-detail-trade">
                                <SelectValue placeholder="Select trade…" />
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
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button type="submit" data-testid="btn-basic-save"
                    disabled={basicMutation.isPending} className="gap-1.5">
                    {basicMutation.isPending
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Save className="w-4 h-4" />}
                    Save
                  </Button>
                  <Button type="button" variant="outline" className="gap-1.5"
                    onClick={() => setEditingBasic(false)} disabled={basicMutation.isPending}>
                    <X className="w-4 h-4" />Cancel
                  </Button>
                </div>
              </form>
            </Form>
          ) : (
            <div className="flex items-start gap-5 flex-wrap">
              <WorkerAvatar photoUrl={worker.photoUrl} name={worker.fullName} size="lg" />
              <div className="flex-1 min-w-0 space-y-0">
                <InfoRow label="Full Name" value={worker.fullName} />
                <InfoRow label="Trade" value={tradeLabel} />
                <InfoRow
                  label="Status"
                  value={worker.isActive ? "Active" : "Inactive"}
                />
                <InfoRow
                  label="Registered"
                  value={worker.createdAt
                    ? new Date(worker.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
                    : undefined}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 2. EVALUATION SUMMARY                                                */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader className="pb-3">
          <SectionHeader icon={Award} title="Evaluation Summary" />
        </CardHeader>
        <CardContent className="pb-5">
          <div className="flex items-center justify-around gap-4 flex-wrap">
            <ScorePill label="Skill"    value={worker.skill}    color="text-blue-600" />
            <ScorePill label="Control"  value={worker.control}  color="text-violet-600" />
            <ScorePill label="Attitude" value={worker.attitude} color="text-amber-600" />
            <div className="w-px h-12 bg-slate-100 hidden sm:block" />
            <TotalScoreRing score={totalDisplay} max={30} />
          </div>
          {!hasAnyScore && (
            <p className="text-center text-xs text-slate-300 mt-4">
              No evaluation scores yet — use the Skill / Control / Attitude section below to rate this worker.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 3 & 4 & 6. SKILL / CONTROL / ATTITUDE + SPECIAL ABILITY + NOTES      */}
      {/*   (all in one editable form for this step)                            */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader className="pb-3">
          <SectionHeader icon={Star} title="Skill / Control / Attitude"
            onEdit={startEditEval} isEditing={editingEval} />
        </CardHeader>
        <CardContent className="pb-5">
          {editingEval ? (
            <Form {...evalForm}>
              <form onSubmit={evalForm.handleSubmit((v) => evalMutation.mutate(v))}
                className="space-y-5">

                {/* ── Scores ── */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                    Scores (1 – 10)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <FormField control={evalForm.control} name="skill"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <ScoreSelect label="Skill" field={field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField control={evalForm.control} name="control"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <ScoreSelect label="Control" field={field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField control={evalForm.control} name="attitude"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <ScoreSelect label="Attitude" field={field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* ── Special Ability ── */}
                <div className="border-t border-slate-50 pt-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />Special Ability
                  </p>
                  <FormField control={evalForm.control} name="specialAbility"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            data-testid="input-special-ability"
                            placeholder="e.g. High voltage work, Conduit bending, Panel wiring…"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* ── Notes ── */}
                <div className="border-t border-slate-50 pt-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <StickyNote className="w-3.5 h-3.5 text-slate-400" />Notes
                  </p>
                  <FormField control={evalForm.control} name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea
                            data-testid="textarea-notes"
                            placeholder="Internal notes about this worker…"
                            rows={3}
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex gap-2 pt-1 border-t border-slate-100">
                  <Button type="submit" data-testid="btn-eval-save"
                    disabled={evalMutation.isPending} className="gap-1.5">
                    {evalMutation.isPending
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Save className="w-4 h-4" />}
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
            /* ── Read-only view ── */
            <div className="space-y-4">
              {/* Score bars */}
              <div className="space-y-2">
                {[
                  { label: "Skill",    value: worker.skill,    color: "bg-blue-500" },
                  { label: "Control",  value: worker.control,  color: "bg-violet-500" },
                  { label: "Attitude", value: worker.attitude, color: "bg-amber-500" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center gap-3">
                    <span className="text-xs font-medium text-slate-500 w-16 shrink-0">{label}</span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      {value !== null && value !== undefined && (
                        <div
                          className={`h-full ${color} rounded-full transition-all`}
                          style={{ width: `${(value / 10) * 100}%` }}
                        />
                      )}
                    </div>
                    <span className="text-sm font-semibold text-slate-700 w-8 text-right">
                      {value !== null && value !== undefined ? value : <span className="text-slate-300 font-normal">—</span>}
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
                  <p className="text-xs font-medium text-slate-400 mb-0.5">Notes</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">
                    {worker.notes || <span className="text-slate-300">—</span>}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 5. SKILL BOARD (placeholder)                                         */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <LayoutGrid className="w-4 h-4 text-slate-400" />
              Skill Board
            </CardTitle>
            <Badge variant="outline"
              className="text-[10px] text-slate-400 border-slate-200 bg-slate-50 font-medium">
              Coming soon
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pb-6">
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
            <LayoutGrid className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-xs font-medium text-slate-400">Skill Board</p>
            <p className="text-xs text-slate-300 mt-1">
              A visual skill map will appear here once evaluation data is collected.
            </p>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
