import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft, HardHat, Pencil, Save, X, Loader2,
  Star, ClipboardList, Calendar, Zap, LayoutGrid,
  Users, Lock, Camera, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { type Worker } from "@shared/schema";
import { useRef, useState } from "react";

// ─── Trade options ────────────────────────────────────────────────────────────
const TRADE_OPTIONS = [
  { value: "General Manager",         label: "부장 — General Manager"         },
  { value: "Deputy General Manager",  label: "차장 — Deputy General Manager"  },
  { value: "Manager",                 label: "과장 — Manager"                 },
  { value: "Assistant Manager",       label: "대리 — Assistant Manager"       },
  { value: "Staff",                   label: "사원 — Staff"                   },
  { value: "Project Engineer",        label: "공무 — Project Engineer"        },
  { value: "Foreman",                 label: "Foreman"                        },
  { value: "Helper",                  label: "Helper"                         },
  { value: "Safety",                  label: "Safety"                         },
];

// ─── Edit form schema ─────────────────────────────────────────────────────────
const editSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  trade: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
});
type EditValues = z.infer<typeof editSchema>;

// ─── Avatar ───────────────────────────────────────────────────────────────────
function WorkerAvatar({ photoUrl, name, size }: { photoUrl?: string | null; name: string; size: "sm" | "lg" }) {
  const dim  = size === "lg" ? "w-24 h-24" : "w-10 h-10";
  const text = size === "lg" ? "text-3xl" : "text-sm";
  const initials = name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  if (photoUrl) return (
    <img src={photoUrl} alt={name} className={`${dim} rounded-full object-cover border-2 border-slate-200`} />
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

// ─── Locked profile field ─────────────────────────────────────────────────────
function LockedField({ icon: Icon, label, hint }: { icon: React.ElementType; label: string; hint?: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-50 border border-slate-100">
      <Icon className="w-4 h-4 text-slate-300 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-400">{label}</p>
        {hint && <p className="text-xs text-slate-300 mt-0.5">{hint}</p>}
      </div>
      <Lock className="w-3.5 h-3.5 text-slate-300 shrink-0" />
    </div>
  );
}

// ─── Photo upload ─────────────────────────────────────────────────────────────
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
          <Button type="button" variant="ghost" size="sm" className="text-xs text-red-400 hover:text-red-600 h-7"
            onClick={() => { onChange(null); if (fileRef.current) fileRef.current.value = ""; }}>
            Remove
          </Button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFile} />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function WorkerDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);

  const workerId = parseInt(id ?? "0", 10);

  const { data: worker, isLoading } = useQuery<Worker>({
    queryKey: ["/api/workers", workerId],
    queryFn: async () => {
      const res = await fetch(`/api/workers/${workerId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Worker not found");
      return res.json();
    },
    enabled: !isNaN(workerId) && workerId > 0,
  });

  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { fullName: "", trade: "", photoUrl: null },
  });

  function startEdit() {
    if (!worker) return;
    form.reset({ fullName: worker.fullName, trade: worker.trade ?? "", photoUrl: worker.photoUrl ?? null });
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    form.reset();
  }

  const updateMutation = useMutation({
    mutationFn: (data: EditValues) => apiRequest("PUT", `/api/workers/${workerId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workers", workerId] });
      toast({ title: "Worker updated." });
      setEditing(false);
    },
    onError: (err: any) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

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

  return (
    <div className="space-y-6 max-w-2xl">

      {/* ── Back ── */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-slate-500 hover:text-slate-700 -ml-1 mb-4"
          data-testid="btn-back-manpower"
          onClick={() => navigate("/manpower")}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Manpower
        </Button>

        <h1 className="text-3xl font-display font-bold text-slate-900">Worker Profile</h1>
        <p className="text-slate-500 mt-1">
          Registration details and future evaluation record for this worker.
        </p>
      </div>

      {/* ── Profile card ── */}
      <Card>
        <CardContent className="pt-6 pb-6">
          {editing ? (
            /* ── Edit mode ── */
            <Form {...form}>
              <form onSubmit={form.handleSubmit((v) => updateMutation.mutate(v))} className="space-y-5">

                {/* Photo + basic info row */}
                <div className="flex gap-6 flex-wrap">
                  <FormField
                    control={form.control}
                    name="photoUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <PhotoUpload value={field.value} onChange={(v) => field.onChange(v)} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <div className="flex-1 min-w-[200px] space-y-3">
                    <FormField
                      control={form.control}
                      name="fullName"
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
                    <FormField
                      control={form.control}
                      name="trade"
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
                  <Button type="submit" data-testid="btn-detail-save" disabled={updateMutation.isPending} className="gap-1.5">
                    {updateMutation.isPending
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Save className="w-4 h-4" />}
                    Save Changes
                  </Button>
                  <Button type="button" variant="outline" onClick={cancelEdit} disabled={updateMutation.isPending} className="gap-1.5">
                    <X className="w-4 h-4" />Cancel
                  </Button>
                </div>
              </form>
            </Form>

          ) : (
            /* ── View mode ── */
            <div className="flex items-start gap-6 flex-wrap">
              <WorkerAvatar photoUrl={worker.photoUrl} name={worker.fullName} size="lg" />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h2
                      data-testid="text-detail-name"
                      className="text-2xl font-bold text-slate-800 leading-tight"
                    >
                      {worker.fullName}
                    </h2>
                    <p data-testid="text-detail-trade" className="text-slate-500 mt-0.5">
                      {tradeLabel}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {worker.isActive ? (
                      <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold text-xs">
                        Active
                      </Badge>
                    ) : (
                      <Badge className="bg-slate-100 text-slate-500 border border-slate-200 font-semibold text-xs">
                        Inactive
                      </Badge>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      data-testid="btn-detail-edit"
                      className="gap-1.5 text-xs"
                      onClick={startEdit}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </Button>
                  </div>
                </div>

                <div className="mt-3 flex gap-4 text-xs text-slate-400 flex-wrap">
                  {worker.createdAt && (
                    <span>Registered: {new Date(worker.createdAt).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Evaluation section (locked placeholder) ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-slate-400" />
              Evaluation
            </CardTitle>
            <span className="text-[10px] text-slate-400 bg-slate-100 rounded px-2 py-1 font-medium">
              Coming soon
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 pb-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <LockedField icon={Star}          label="Skill"           hint="Assessment pending" />
            <LockedField icon={ClipboardList} label="Control"         hint="Assessment pending" />
            <LockedField icon={Users}         label="Attitude"        hint="Assessment pending" />
            <LockedField icon={CheckCircle2}  label="Total Score"     hint="Calculated after evaluation" />
            <LockedField icon={Calendar}      label="Date of TK"      hint="Not yet assigned" />
            <LockedField icon={Zap}           label="Special Ability" hint="Not yet assigned" />
          </div>
          <div className="mt-1">
            <LockedField icon={LayoutGrid} label="Skill Board" hint="Visual skill summary — available after full evaluation" />
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
