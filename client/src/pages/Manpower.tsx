import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  HardHat, PlusCircle, Loader2, Users, CheckCircle2, XCircle,
  ClipboardList, Check, X, UserCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { type Worker } from "@shared/schema";

// ─── Trade options (Korean label → English value) ─────────────────────────────
export const TRADE_OPTIONS = [
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

// ─── Avatar ───────────────────────────────────────────────────────────────────
function WorkerAvatar({ photoUrl, name }: { photoUrl?: string | null; name: string }) {
  const initials = name.trim()
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className="w-9 h-9 rounded-full object-cover shrink-0 border border-slate-200"
      />
    );
  }

  return (
    <div className="w-9 h-9 rounded-full shrink-0 bg-slate-100 border border-slate-200 flex items-center justify-center">
      {initials
        ? <span className="text-xs font-semibold text-slate-500">{initials}</span>
        : <UserCircle2 className="w-5 h-5 text-slate-300" />
      }
    </div>
  );
}

// ─── Inline "add worker" row ──────────────────────────────────────────────────
function AddWorkerRow({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const { toast } = useToast();
  const [fullName, setFullName] = useState("");
  const [trade, setTrade]       = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/workers", { fullName: fullName.trim(), trade: trade || null, isActive: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workers"] });
      onSaved();
    },
    onError: (err: any) => {
      toast({ title: "Failed to register worker", description: err.message, variant: "destructive" });
    },
  });

  function handleSave() {
    if (!fullName.trim()) {
      nameRef.current?.focus();
      return;
    }
    createMutation.mutate();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") onCancel();
  }

  return (
    <tr className="bg-blue-50/60 border-b border-blue-100">
      {/* Avatar placeholder */}
      <td className="px-5 py-2.5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full shrink-0 bg-slate-200 border border-slate-300 flex items-center justify-center">
            <UserCircle2 className="w-5 h-5 text-slate-400" />
          </div>
          <Input
            ref={nameRef}
            data-testid="input-inline-name"
            placeholder="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-8 text-sm max-w-[200px] bg-white"
          />
        </div>
      </td>

      {/* Trade select */}
      <td className="px-5 py-2.5">
        <Select value={trade} onValueChange={(v) => setTrade(v === "__none__" ? "" : v)}>
          <SelectTrigger
            data-testid="select-inline-trade"
            className="h-8 text-sm max-w-[220px] bg-white"
          >
            <SelectValue placeholder="Select trade…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— None —</SelectItem>
            {TRADE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>

      {/* Status placeholder */}
      <td className="px-5 py-2.5">
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-semibold">
          Active
        </Badge>
      </td>

      {/* Save / cancel */}
      <td className="px-5 py-2.5 text-right">
        <div className="flex items-center justify-end gap-1">
          <Button
            data-testid="btn-inline-save"
            size="sm"
            className="gap-1 h-7 text-xs px-2.5"
            onClick={handleSave}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Check className="w-3.5 h-3.5" />
            }
            Save
          </Button>
          <Button
            data-testid="btn-inline-cancel"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600"
            onClick={onCancel}
            disabled={createMutation.isPending}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Manpower() {
  const [, navigate]  = useLocation();
  const [adding, setAdding] = useState(false);

  const { data: workerList = [], isLoading } = useQuery<Worker[]>({
    queryKey: ["/api/workers"],
  });

  const activeCount   = workerList.filter((w) => w.isActive).length;
  const inactiveCount = workerList.filter((w) => !w.isActive).length;

  function handleWorkerClick(worker: Worker) {
    navigate(`/manpower/${worker.id}`);
  }

  function handleSaved() {
    setAdding(false);
  }

  function handleAddClick() {
    setAdding(true);
  }

  return (
    <div className="space-y-6">

      {/* ── Page header ── */}
      <div>
        <h1 className="text-3xl font-display font-bold text-slate-900">Manpower</h1>
        <p className="text-slate-500 mt-1">
          Register and manage your workforce. Click a worker to view their profile.
        </p>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: Users,        label: "Total Workers", value: String(workerList.length), color: "text-blue-600",    bg: "bg-blue-50"    },
          { icon: CheckCircle2, label: "Active",        value: String(activeCount),       color: "text-emerald-600", bg: "bg-emerald-50" },
          { icon: XCircle,      label: "Inactive",      value: String(inactiveCount),     color: "text-slate-500",   bg: "bg-slate-100"  },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 pt-5 pb-5">
              <div className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${bg}`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">{label}</p>
                <p className="text-2xl font-bold text-slate-700 leading-tight">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Worker Registry ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <HardHat className="w-4 h-4 text-slate-500" />
              Worker Registry
            </CardTitle>
            <Button
              data-testid="btn-register-worker"
              size="sm"
              className="gap-1.5 text-xs h-8"
              onClick={handleAddClick}
              disabled={adding}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Register Worker
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
              <p className="text-sm text-slate-400">Loading workers…</p>
            </div>

          ) : workerList.length === 0 && !adding ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-100">
                <HardHat className="w-7 h-7 text-slate-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-slate-600">No workers registered yet</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Use "Register Worker" above to add your first worker
                </p>
              </div>
            </div>

          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Worker
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Trade / Classification
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Status
                    </th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">

                  {/* Inline add row — appears at top */}
                  {adding && (
                    <AddWorkerRow
                      onSaved={handleSaved}
                      onCancel={() => setAdding(false)}
                    />
                  )}

                  {/* Saved worker rows */}
                  {workerList.map((worker) => {
                    const tradeLabel =
                      TRADE_OPTIONS.find((o) => o.value === worker.trade)?.label ?? worker.trade;

                    return (
                      <tr
                        key={worker.id}
                        data-testid={`row-worker-${worker.id}`}
                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                        onClick={() => handleWorkerClick(worker)}
                      >
                        {/* Avatar + name */}
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <WorkerAvatar photoUrl={worker.photoUrl} name={worker.fullName} />
                            <span
                              data-testid={`text-worker-name-${worker.id}`}
                              className="font-medium text-slate-800"
                            >
                              {worker.fullName}
                            </span>
                          </div>
                        </td>

                        {/* Trade */}
                        <td className="px-5 py-3">
                          <span
                            data-testid={`text-worker-trade-${worker.id}`}
                            className="text-slate-600"
                          >
                            {tradeLabel || <span className="text-slate-300">—</span>}
                          </span>
                        </td>

                        {/* Status badge */}
                        <td className="px-5 py-3">
                          {worker.isActive ? (
                            <Badge
                              variant="outline"
                              data-testid={`badge-worker-status-${worker.id}`}
                              className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-semibold"
                            >
                              Active
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              data-testid={`badge-worker-status-${worker.id}`}
                              className="bg-slate-100 text-slate-500 border-slate-200 text-xs font-semibold"
                            >
                              Inactive
                            </Badge>
                          )}
                        </td>

                        {/* Evaluate placeholder */}
                        <td className="px-5 py-3 text-right">
                          <Button
                            data-testid={`btn-evaluate-worker-${worker.id}`}
                            variant="ghost"
                            size="sm"
                            disabled
                            className="gap-1.5 text-xs text-slate-300 cursor-not-allowed"
                            title="Evaluation coming soon"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ClipboardList className="w-3.5 h-3.5" />
                            Evaluate
                          </Button>
                        </td>
                      </tr>
                    );
                  })}

                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
