import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  HardHat, PlusCircle, Pencil, Loader2, Users,
  CheckCircle2, XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { insertWorkerSchema, type Worker } from "@shared/schema";

// ─── Form schema ──────────────────────────────────────────────────────────────
const workerFormSchema = insertWorkerSchema.extend({
  fullName: z.string().min(1, "Full name is required"),
  trade: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  notes: z.string().optional().nullable(),
});
type WorkerFormValues = z.infer<typeof workerFormSchema>;

// ─── Worker form dialog ───────────────────────────────────────────────────────
function WorkerDialog({
  open,
  worker,
  onClose,
}: {
  open: boolean;
  worker: Worker | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const isEdit = worker !== null;

  const form = useForm<WorkerFormValues>({
    resolver: zodResolver(workerFormSchema),
    defaultValues: {
      fullName: worker?.fullName ?? "",
      trade: worker?.trade ?? "",
      isActive: worker?.isActive ?? true,
      notes: worker?.notes ?? "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: WorkerFormValues) =>
      apiRequest("POST", "/api/workers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workers"] });
      toast({ title: "Worker registered successfully." });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Failed to register worker", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: WorkerFormValues) =>
      apiRequest("PUT", `/api/workers/${worker!.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workers"] });
      toast({ title: "Worker updated successfully." });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Failed to update worker", description: err.message, variant: "destructive" });
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function onSubmit(values: WorkerFormValues) {
    if (isEdit) {
      updateMutation.mutate(values);
    } else {
      createMutation.mutate(values);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardHat className="w-5 h-5 text-slate-500" />
            {isEdit ? "Edit Worker" : "Register New Worker"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name <span className="text-red-500">*</span></FormLabel>
                  <FormControl>
                    <Input
                      data-testid="input-worker-name"
                      placeholder="e.g. John Smith"
                      {...field}
                    />
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
                  <FormControl>
                    <Input
                      data-testid="input-worker-trade"
                      placeholder="e.g. Electrician, Foreman, Apprentice"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <FormLabel className="text-sm font-medium">Active</FormLabel>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Inactive workers will not appear in daily report selection
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      data-testid="switch-worker-active"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      data-testid="textarea-worker-notes"
                      placeholder="Optional notes…"
                      rows={3}
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                data-testid="btn-worker-cancel"
                onClick={onClose}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                data-testid="btn-worker-save"
                disabled={isPending}
              >
                {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isEdit ? "Save Changes" : "Register Worker"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Manpower() {
  const [dialogOpen, setDialogOpen]       = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);

  const { data: workerList = [], isLoading } = useQuery<Worker[]>({
    queryKey: ["/api/workers"],
  });

  const activeCount   = workerList.filter((w) => w.isActive).length;
  const inactiveCount = workerList.filter((w) => !w.isActive).length;

  function openNew() {
    setEditingWorker(null);
    setDialogOpen(true);
  }

  function openEdit(w: Worker) {
    setEditingWorker(w);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingWorker(null);
  }

  return (
    <div className="space-y-6">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Manpower</h1>
          <p className="text-slate-500 mt-1">
            Register and manage your workforce. Active workers are available for selection in Daily Reports.
          </p>
        </div>
        <Button
          data-testid="btn-register-worker"
          onClick={openNew}
          className="gap-2 shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          Register Worker
        </Button>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: Users,        label: "Total Workers", value: String(workerList.length), color: "text-blue-600",   bg: "bg-blue-50"   },
          { icon: CheckCircle2, label: "Active",        value: String(activeCount),       color: "text-emerald-600", bg: "bg-emerald-50" },
          { icon: XCircle,      label: "Inactive",      value: String(inactiveCount),     color: "text-slate-500",  bg: "bg-slate-100" },
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

      {/* ── Worker table ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <HardHat className="w-4 h-4 text-slate-500" />
            Worker Registry
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">

          {isLoading ? (
            <div className="flex items-center justify-center py-16 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
              <p className="text-sm text-slate-400">Loading workers…</p>
            </div>

          ) : workerList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-100">
                <HardHat className="w-7 h-7 text-slate-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-slate-600">No workers registered yet</p>
                <p className="text-xs text-slate-400 mt-0.5">Click "Register Worker" to add your first worker</p>
              </div>
            </div>

          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Trade / Classification</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Notes</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {workerList.map((worker) => (
                    <tr
                      key={worker.id}
                      data-testid={`row-worker-${worker.id}`}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <span
                          data-testid={`text-worker-name-${worker.id}`}
                          className="font-medium text-slate-800"
                        >
                          {worker.fullName}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          data-testid={`text-worker-trade-${worker.id}`}
                          className="text-slate-600"
                        >
                          {worker.trade || <span className="text-slate-300">—</span>}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
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
                      <td className="px-5 py-3.5 max-w-[200px]">
                        <span className="text-slate-500 text-xs truncate block">
                          {worker.notes || <span className="text-slate-300">—</span>}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Button
                          data-testid={`btn-edit-worker-${worker.id}`}
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-xs text-slate-500 hover:text-slate-700"
                          onClick={() => openEdit(worker)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </CardContent>
      </Card>

      {/* ── Dialog ── */}
      <WorkerDialog
        open={dialogOpen}
        worker={editingWorker}
        onClose={closeDialog}
      />

    </div>
  );
}
