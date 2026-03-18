import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useProjects, useProject, useUpdateProject, useDeleteProject } from "@/hooks/use-reference-data";
import { TransactionTypeBadge } from "@/components/StatusBadge";
import { MovementForm } from "@/components/MovementForm";
import {
  ArrowLeft, MapPin, Calendar, Package, ArrowUpRight, ArrowDownRight,
  Users, Edit, Save, X, Trash2, Plus, Pencil, CheckCircle2, MinusCircle,
  LayoutList, Hash, TrendingUp, AlertCircle,
} from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { QuickEntryInput } from "@/components/QuickEntryInput";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { ProjectScopeItem } from "@shared/schema";

const statusConfig: Record<string, { label: string; className: string }> = {
  active:    { label: "Active",    className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  completed: { label: "Completed", className: "bg-slate-100 text-slate-600 border-slate-200" },
  on_hold:   { label: "On Hold",   className: "bg-amber-100 text-amber-700 border-amber-200" },
  cancelled: { label: "Cancelled", className: "bg-rose-100 text-rose-700 border-rose-200" },
};

// ── Edit project schema ────────────────────────────────────────────────────────
const editSchema = z.object({
  name:         z.string().min(1, "Project name is required"),
  customerName: z.string().optional(),
  ownerName:    z.string().optional(),
  jobLocation:  z.string().optional(),
  poNumber:     z.string().optional(),
  status:       z.string().min(1),
  startDate:    z.string().optional(),
  endDate:      z.string().optional(),
  notes:        z.string().optional(),
});
type EditFormData = z.infer<typeof editSchema>;

function cleanFormData(data: EditFormData) {
  const clean: any = { ...data };
  const optionalFields: (keyof EditFormData)[] = [
    "customerName", "ownerName", "jobLocation", "poNumber", "startDate", "endDate", "notes",
  ];
  optionalFields.forEach(f => { if (clean[f] === "") clean[f] = null; });
  return clean;
}

// ── Scope Item schema ──────────────────────────────────────────────────────────
const scopeItemSchema = z.object({
  itemName:     z.string().min(1, "Item name is required"),
  unit:         z.string().min(1, "Unit is required"),
  estimatedQty: z.string().min(1, "Qty is required"),
  category:     z.string().optional(),
  remarks:      z.string().optional(),
  isActive:     z.boolean().default(true),
});
type ScopeItemFormData = z.infer<typeof scopeItemSchema>;

const COMMON_UNITS = ["LF", "EA", "FT", "SF", "CY", "LB", "HR", "DAY", "GAL", "TON"];

// ── Edit Project Dialog ────────────────────────────────────────────────────────
function EditProjectDialog({
  project, open, onClose, allProjects,
}: {
  project: any; open: boolean; onClose: () => void; allProjects: any[];
}) {
  const { toast } = useToast();
  const updateMutation = useUpdateProject();
  const deleteMutation = useDeleteProject();
  const [, navigate] = useLocation();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const customerSuggestions = [...new Set(allProjects.map((p: any) => p.customerName).filter(Boolean))] as string[];
  const ownerSuggestions    = [...new Set(allProjects.map((p: any) => p.ownerName).filter(Boolean))] as string[];
  const locationSuggestions = [...new Set(allProjects.map((p: any) => p.jobLocation).filter(Boolean))] as string[];

  const form = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: project.name || "", customerName: project.customerName || "",
      ownerName: project.ownerName || "", jobLocation: project.jobLocation || "",
      poNumber: project.poNumber || "", status: project.status || "active",
      startDate: project.startDate || "", endDate: project.endDate || "", notes: project.notes || "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: project.name || "", customerName: project.customerName || "",
        ownerName: project.ownerName || "", jobLocation: project.jobLocation || "",
        poNumber: project.poNumber || "", status: project.status || "active",
        startDate: project.startDate || "", endDate: project.endDate || "", notes: project.notes || "",
      });
      setShowDeleteConfirm(false);
    }
  }, [open, project.id]);

  async function onSubmit(data: EditFormData) {
    try {
      await updateMutation.mutateAsync({ id: project.id, code: project.code, ...cleanFormData(data) });
      toast({ title: "Project updated", description: `${data.name} has been saved.` });
      onClose();
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    }
  }

  async function handleDelete() {
    try {
      await deleteMutation.mutateAsync(project.id);
      toast({ title: "Project deleted", description: `${project.name} has been removed.` });
      onClose();
      navigate("/projects");
    } catch (err: any) {
      toast({ title: "Cannot delete", description: err.message, variant: "destructive" });
      setShowDeleteConfirm(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit Project</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Name <span className="text-red-500">*</span></FormLabel>
                  <FormControl><Input {...field} data-testid="edit-project-name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger data-testid="edit-project-status"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="customerName" render={({ field }) => (
              <FormItem>
                <FormLabel>Customer</FormLabel>
                <FormControl>
                  <QuickEntryInput value={field.value ?? ""} onChange={field.onChange} suggestions={customerSuggestions} placeholder="e.g. Apex Commercial Group" testId="edit-customer-name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="ownerName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Owner</FormLabel>
                  <FormControl>
                    <QuickEntryInput value={field.value ?? ""} onChange={field.onChange} suggestions={ownerSuggestions} placeholder="e.g. John Kim" testId="edit-owner-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="poNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>PO Number</FormLabel>
                  <FormControl><Input placeholder="e.g. PO-2026-001" {...field} data-testid="edit-po-number" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="jobLocation" render={({ field }) => (
              <FormItem>
                <FormLabel>Job Location</FormLabel>
                <FormControl>
                  <QuickEntryInput value={field.value ?? ""} onChange={field.onChange} suggestions={locationSuggestions} placeholder="e.g. 123 Main St, Dallas TX" testId="edit-job-location" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="startDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Date</FormLabel>
                  <FormControl><Input type="date" {...field} data-testid="edit-start-date" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="endDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>End Date</FormLabel>
                  <FormControl><Input type="date" {...field} data-testid="edit-end-date" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl><Textarea rows={2} className="resize-none" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="flex justify-between items-center pt-2">
              <Button type="button" variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50 gap-1.5"
                onClick={() => setShowDeleteConfirm(true)} disabled={updateMutation.isPending || deleteMutation.isPending} data-testid="button-delete-project">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </Button>
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={onClose} disabled={updateMutation.isPending || deleteMutation.isPending}>
                  <X className="w-4 h-4 mr-1" /> Cancel
                </Button>
                <Button type="submit" className="bg-brand-700 hover:bg-brand-800" disabled={updateMutation.isPending || deleteMutation.isPending} data-testid="button-save-project">
                  <Save className="w-4 h-4 mr-1" />
                  {updateMutation.isPending ? "Saving…" : "Save Changes"}
                </Button>
              </div>
            </div>
            {showDeleteConfirm && (
              <div className="mt-2 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-semibold text-red-900 mb-1">Delete "{project.name}"?</p>
                <p className="text-xs text-red-700 mb-3">This action cannot be undone. Projects with logged movements cannot be deleted — set status to "Cancelled" instead.</p>
                <div className="flex gap-2 justify-end">
                  <Button type="button" size="sm" variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={deleteMutation.isPending}>Cancel</Button>
                  <Button type="button" size="sm" variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending} data-testid="button-confirm-delete-project">
                    {deleteMutation.isPending ? "Deleting…" : "Yes, Delete"}
                  </Button>
                </div>
              </div>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ── Scope Item Form Dialog ─────────────────────────────────────────────────────
function ScopeItemDialog({
  projectId, item, open, onClose,
}: {
  projectId: number;
  item?: ProjectScopeItem | null;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const isEdit = !!item;

  const form = useForm<ScopeItemFormData>({
    resolver: zodResolver(scopeItemSchema),
    defaultValues: {
      itemName: "", unit: "", estimatedQty: "", category: "", remarks: "", isActive: true,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        itemName:     item?.itemName ?? "",
        unit:         item?.unit ?? "",
        estimatedQty: item?.estimatedQty ? String(item.estimatedQty) : "",
        category:     item?.category ?? "",
        remarks:      item?.remarks ?? "",
        isActive:     item?.isActive ?? true,
      });
    }
  }, [open, item?.id]);

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/projects/${projectId}/scope-items`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "scope-items"] });
      toast({ title: "Scope item added" });
      onClose();
    },
    onError: (err: any) => toast({ title: "Failed to add", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/scope-items/${item!.id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "scope-items"] });
      toast({ title: "Scope item updated" });
      onClose();
    },
    onError: (err: any) => toast({ title: "Failed to update", description: err.message, variant: "destructive" }),
  });

  function onSubmit(data: ScopeItemFormData) {
    const payload = { ...data, estimatedQty: String(data.estimatedQty) };
    if (isEdit) updateMutation.mutate(payload);
    else createMutation.mutate(payload);
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Scope Item" : "Add Scope Item"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <FormField control={form.control} name="itemName" render={({ field }) => (
              <FormItem>
                <FormLabel>Item Name <span className="text-red-500">*</span></FormLabel>
                <FormControl>
                  <Input placeholder="e.g. EMT Conduit 3/4&quot;" {...field} data-testid="input-scope-item-name" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="unit" render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit <span className="text-red-500">*</span></FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-scope-unit"><SelectValue placeholder="Select unit" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {COMMON_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="estimatedQty" render={({ field }) => (
                <FormItem>
                  <FormLabel>Est. Qty <span className="text-red-500">*</span></FormLabel>
                  <FormControl>
                    <Input type="number" min="0" step="any" placeholder="0" {...field} data-testid="input-scope-qty" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="category" render={({ field }) => (
              <FormItem>
                <FormLabel>Category <span className="text-slate-400 font-normal">(optional)</span></FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Conduit, Wire, Devices…" {...field} data-testid="input-scope-category" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="remarks" render={({ field }) => (
              <FormItem>
                <FormLabel>Remarks <span className="text-slate-400 font-normal">(optional)</span></FormLabel>
                <FormControl>
                  <Textarea rows={2} className="resize-none" placeholder="Any notes…" {...field} data-testid="input-scope-remarks" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            {isEdit && (
              <FormField control={form.control} name="isActive" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={(v) => field.onChange(v === "true")} value={String(field.value)}>
                    <FormControl>
                      <SelectTrigger data-testid="select-scope-status"><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="true">Active</SelectItem>
                      <SelectItem value="false">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            )}
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
              <Button type="submit" className="bg-brand-700 hover:bg-brand-800" disabled={isPending} data-testid="button-save-scope-item">
                <Save className="w-4 h-4 mr-1" />
                {isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Item"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ── Scope Items Tab ────────────────────────────────────────────────────────────
function ScopeItemsTab({ projectId }: { projectId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<ProjectScopeItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectScopeItem | null>(null);

  const { data: scopeItems = [], isLoading } = useQuery<ProjectScopeItem[]>({
    queryKey: ["/api/projects", projectId, "scope-items"],
    queryFn: () => fetch(`/api/projects/${projectId}/scope-items`, { credentials: "include" }).then(r => r.json()),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/scope-items/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "scope-items"] });
      toast({ title: "Scope item deleted" });
      setDeleteTarget(null);
    },
    onError: (err: any) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiRequest("PATCH", `/api/scope-items/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/projects", projectId, "scope-items"] }),
    onError: (err: any) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  const totalItems = scopeItems.length;
  const totalQty = scopeItems.reduce((s, i) => s + parseFloat(String(i.estimatedQty || 0)), 0);
  const activeCount = scopeItems.filter(i => i.isActive).length;

  function openAdd() { setEditItem(null); setDialogOpen(true); }
  function openEdit(item: ProjectScopeItem) { setEditItem(item); setDialogOpen(true); }

  return (
    <div className="space-y-5">
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Scope Items", value: totalItems, icon: LayoutList, color: "text-brand-600", bg: "bg-brand-50" },
          { label: "Total Est. Qty",    value: totalQty.toLocaleString(), icon: Hash, color: "text-indigo-600", bg: "bg-indigo-50" },
          { label: "Active Items",      value: activeCount, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
        ].map((s, i) => (
          <div key={i} className="premium-card bg-white p-4 flex items-center gap-3" data-testid={`scope-kpi-${i}`}>
            <div className={`p-2 rounded-xl ${s.bg}`}><s.icon className={`w-4 h-4 ${s.color}`} /></div>
            <div>
              <p className="text-xs text-slate-400">{s.label}</p>
              <p className="text-xl font-display font-bold text-slate-900">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table card */}
      <div className="premium-card bg-white overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">Scope Items</h3>
            <p className="text-xs text-slate-400 mt-0.5">Baseline quantities used as progress reference</p>
          </div>
          <Button size="sm" className="bg-brand-700 hover:bg-brand-800 text-white" onClick={openAdd} data-testid="button-add-scope-item">
            <Plus className="w-4 h-4 mr-1" /> Add Item
          </Button>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Loading…</div>
        ) : scopeItems.length === 0 ? (
          <div className="p-12 text-center">
            <LayoutList className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No scope items yet</p>
            <p className="text-xs text-slate-400 mt-1">Add items to define the project's estimated work quantities.</p>
            <Button size="sm" variant="outline" className="mt-4" onClick={openAdd} data-testid="button-add-scope-item-empty">
              <Plus className="w-4 h-4 mr-1" /> Add First Item
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600 w-[35%]">Item</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 w-[8%]">Unit</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 w-[12%]">Est. Qty</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 w-[15%]">Category</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 w-[12%]">Status</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 w-[18%]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {scopeItems.map((item) => (
                  <tr key={item.id} className={`hover:bg-slate-50 transition-colors ${!item.isActive ? "opacity-50" : ""}`} data-testid={`scope-row-${item.id}`}>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-slate-900 leading-snug">{item.itemName}</p>
                      {item.remarks && <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{item.remarks}</p>}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-mono text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-100 px-2 py-0.5 rounded">{item.unit}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-bold text-slate-900 tabular-nums">
                      {parseFloat(String(item.estimatedQty)).toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 text-xs">{item.category || "—"}</td>
                    <td className="px-4 py-3.5">
                      {item.isActive ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                          <MinusCircle className="w-3 h-3" /> Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm" variant="ghost"
                          className="h-7 w-7 p-0 text-slate-400 hover:text-brand-700 hover:bg-brand-50"
                          onClick={() => toggleMutation.mutate({ id: item.id, isActive: !item.isActive })}
                          title={item.isActive ? "Deactivate" : "Activate"}
                          data-testid={`button-toggle-scope-${item.id}`}
                        >
                          {item.isActive ? <MinusCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        </Button>
                        <Button
                          size="sm" variant="ghost"
                          className="h-7 w-7 p-0 text-slate-400 hover:text-brand-700 hover:bg-brand-50"
                          onClick={() => openEdit(item)}
                          data-testid={`button-edit-scope-${item.id}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm" variant="ghost"
                          className="h-7 w-7 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => setDeleteTarget(item)}
                          data-testid={`button-delete-scope-${item.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit dialog */}
      <ScopeItemDialog
        projectId={projectId}
        item={editItem}
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditItem(null); }}
      />

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>Delete Scope Item?</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600 py-2">
            Remove <span className="font-semibold">"{deleteTarget?.itemName}"</span> from this project's scope?
            This cannot be undone.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleteMutation.isPending}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} disabled={deleteMutation.isPending} data-testid="button-confirm-delete-scope">
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Progress Tab ──────────────────────────────────────────────────────────────
function ProgressTab({ projectId }: { projectId: number }) {
  const { data, isLoading } = useQuery<{
    scopeItems: any[];
    progress: Record<number, { cumulative: number; remaining: number; pct: number }>;
    summary: { overallPct: number; estTotal: number; installed: number; remaining: number };
  }>({
    queryKey: ["/api/projects", projectId, "progress"],
    queryFn: () => fetch(`/api/projects/${projectId}/progress`, { credentials: "include" }).then(r => r.json()),
  });

  if (isLoading) return <div className="p-8 text-center text-slate-400">Loading progress…</div>;

  const scopeItems = data?.scopeItems ?? [];
  const progress   = data?.progress ?? {};
  const summary    = data?.summary ?? { overallPct: 0, estTotal: 0, installed: 0, remaining: 0 };
  const hasScopes  = scopeItems.length > 0;

  const pctColor = (pct: number) =>
    pct >= 100 ? "bg-emerald-500" : pct >= 70 ? "bg-brand-500" : pct >= 40 ? "bg-blue-400" : "bg-slate-300";

  const summaryPctColor =
    summary.overallPct >= 100 ? "text-emerald-600" :
    summary.overallPct >= 70  ? "text-brand-600"   :
    summary.overallPct >= 40  ? "text-blue-600"    : "text-slate-500";

  return (
    <div className="space-y-5">
      {/* No scope items yet */}
      {!hasScopes && (
        <div className="premium-card bg-white p-12 text-center">
          <TrendingUp className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No scope items defined</p>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
            Add scope items in the <strong>Scope Items</strong> tab to enable progress tracking.
          </p>
        </div>
      )}

      {hasScopes && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="premium-card bg-white p-5 col-span-2 sm:col-span-1 flex flex-col items-center justify-center gap-1" data-testid="progress-overall">
              <p className="text-xs text-slate-400 uppercase tracking-wide">Overall Progress</p>
              <p className={`text-4xl font-display font-bold ${summaryPctColor}`}>{summary.overallPct.toFixed(1)}%</p>
              <div className="w-full bg-slate-100 rounded-full h-2 mt-1">
                <div className={`h-2 rounded-full transition-all ${pctColor(summary.overallPct)}`} style={{ width: `${Math.min(100, summary.overallPct)}%` }} />
              </div>
            </div>
            {[
              { label: "Est. Total",  value: summary.estTotal.toLocaleString(),   icon: Hash,       color: "text-slate-600",   bg: "bg-slate-50"   },
              { label: "Installed",   value: summary.installed.toLocaleString(),  icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
              { label: "Remaining",   value: summary.remaining.toLocaleString(),  icon: AlertCircle, color: "text-amber-600",   bg: "bg-amber-50"   },
            ].map((s, i) => (
              <div key={i} className="premium-card bg-white p-5 flex items-start gap-3" data-testid={`progress-kpi-${i}`}>
                <div className={`p-2 rounded-xl ${s.bg}`}><s.icon className={`w-4 h-4 ${s.color}`} /></div>
                <div>
                  <p className="text-xs text-slate-400">{s.label}</p>
                  <p className="text-2xl font-display font-bold text-slate-900">{s.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* No submitted reports yet */}
          {summary.installed === 0 && (
            <div className="premium-card bg-white px-5 py-4 flex items-center gap-3 text-sm text-amber-700 bg-amber-50/40 border border-amber-100">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>No submitted daily reports yet — submit a report with linked scope items to see progress update.</span>
            </div>
          )}

          {/* Progress table */}
          <div className="premium-card bg-white overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900 text-sm">Progress by Scope Item</h3>
              <p className="text-xs text-slate-400 mt-0.5">Only submitted daily reports are counted — draft reports are excluded</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/80">
                  <tr>
                    <th className="text-left px-5 py-3 font-semibold text-slate-600 w-[30%]">Item</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 w-[7%]">Unit</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600 w-[12%]">Est. Qty</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600 w-[13%]">Installed</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600 w-[12%]">Remaining</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 w-[26%]">Progress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {scopeItems.map((scope) => {
                    const p = progress[scope.id] ?? { cumulative: 0, remaining: parseFloat(String(scope.estimatedQty)), pct: 0 };
                    const estQty = parseFloat(String(scope.estimatedQty));
                    return (
                      <tr key={scope.id} className={`hover:bg-slate-50 transition-colors ${!scope.isActive ? "opacity-50" : ""}`} data-testid={`progress-row-${scope.id}`}>
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-slate-900">{scope.itemName}</p>
                          {scope.category && <p className="text-xs text-slate-400">{scope.category}</p>}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="font-mono text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-100 px-2 py-0.5 rounded">{scope.unit}</span>
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-slate-700">
                          {estQty.toLocaleString()}
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-emerald-700">
                          {p.cumulative.toLocaleString()}
                        </td>
                        <td className="px-4 py-3.5 text-right tabular-nums text-amber-700">
                          {p.remaining.toLocaleString()}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-100 rounded-full h-2 min-w-[60px]">
                              <div
                                className={`h-2 rounded-full transition-all ${pctColor(p.pct)}`}
                                style={{ width: `${Math.min(100, p.pct)}%` }}
                              />
                            </div>
                            <span className={`text-xs font-bold tabular-nums w-12 text-right ${
                              p.pct >= 100 ? "text-emerald-600" : p.pct > 0 ? "text-brand-600" : "text-slate-400"
                            }`}>
                              {p.pct.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Project Details Sidebar ────────────────────────────────────────────────────
function ProjectDetailsSidebar({ project }: { project: any }) {
  return (
    <Card className="premium-card border-none">
      <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
        <CardTitle className="text-sm font-semibold text-slate-700">Project Details</CardTitle>
      </CardHeader>
      <CardContent className="p-5 space-y-4 text-sm">
        {project.poNumber && (
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">PO Number</p>
            <p className="font-semibold text-brand-700">{project.poNumber}</p>
          </div>
        )}
        {project.ownerName && (
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Project Owner</p>
            <p className="font-semibold text-slate-900">{project.ownerName}</p>
          </div>
        )}
        {project.jobLocation && (
          <div className="flex gap-3">
            <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <p className="text-slate-600">{project.jobLocation}</p>
          </div>
        )}
        {(project.startDate || project.endDate) && (
          <div className="flex gap-3">
            <Calendar className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-0.5">
              {project.startDate && (
                <p className="text-slate-600">
                  <span className="text-slate-400">Start: </span>
                  {format(new Date(project.startDate + "T00:00:00"), 'MMM d, yyyy')}
                </p>
              )}
              {project.endDate && (
                <p className="text-slate-600">
                  <span className="text-slate-400">End: </span>
                  {format(new Date(project.endDate + "T00:00:00"), 'MMM d, yyyy')}
                </p>
              )}
            </div>
          </div>
        )}
        {project.notes && (
          <div className="pt-3 border-t border-slate-100">
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Notes</p>
            <p className="text-slate-600 leading-relaxed">{project.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function ProjectDetail() {
  const [, params] = useRoute("/projects/:id");
  const id = Number(params?.id || "0");
  const { data: project, isLoading } = useProject(id);
  const { data: allProjects = [] } = useProjects();
  const [logOpen, setLogOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  if (isLoading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-slate-200 w-64 rounded" />
      <div className="h-48 bg-slate-200 rounded-2xl" />
    </div>
  );
  if (!project) return <div className="p-8 text-center text-slate-500">Project not found.</div>;

  const statusCfg = statusConfig[project.status] || { label: project.status, className: "" };

  const usageMap: Record<number, { itemName: string; sku: string; unit: string; issued: number; returned: number }> = {};
  project.recentActivity?.forEach((tx: any) => {
    if (!tx.item) return;
    const key = tx.item.id;
    if (!usageMap[key]) usageMap[key] = { itemName: tx.item.name, sku: tx.item.sku, unit: tx.item.unitOfMeasure, issued: 0, returned: 0 };
    if (tx.movementType === 'issue') usageMap[key].issued += tx.quantity;
    if (tx.movementType === 'return') usageMap[key].returned += tx.quantity;
  });
  const usageSummary = Object.values(usageMap).sort((a, b) => b.issued - a.issued);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/projects" className="p-2 hover:bg-white rounded-full text-slate-500 transition-colors mt-1">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="outline" className={`${statusCfg.className} text-xs font-semibold`}>{statusCfg.label}</Badge>
            {project.poNumber && (
              <span className="text-sm font-mono font-bold text-brand-700 bg-brand-50 border border-brand-100 px-2.5 py-1 rounded-lg">
                PO: {project.poNumber}
              </span>
            )}
          </div>
          <h1 className="text-3xl font-display font-bold text-slate-900 mt-2">{project.name}</h1>
          {project.customerName && <p className="text-slate-500 mt-1">{project.customerName}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="bg-white" onClick={() => setEditOpen(true)} data-testid="button-edit-project">
            <Edit className="w-4 h-4 mr-2" /> Edit
          </Button>
          <Dialog open={logOpen} onOpenChange={setLogOpen}>
            <Button className="bg-brand-700 hover:bg-brand-800 text-white shadow-sm" onClick={() => setLogOpen(true)}>
              <ArrowUpRight className="w-4 h-4 mr-2" />Log Material
            </Button>
            <DialogContent className="sm:max-w-[760px] flex flex-col max-h-[90vh] gap-0 p-0">
              <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 shrink-0">
                <DialogTitle>Log Material for {project.code}</DialogTitle>
              </DialogHeader>
              <div className="flex-1 flex flex-col min-h-0 px-6 pt-4 pb-6 overflow-hidden">
                <MovementForm defaultType="issue" onSuccess={() => setLogOpen(false)} onCancel={() => setLogOpen(false)} />
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <EditProjectDialog project={project} open={editOpen} onClose={() => setEditOpen(false)} allProjects={allProjects} />

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Issued",   value: project.totalIssued || 0,  icon: ArrowUpRight,   color: "text-brand-600",   bg: "bg-brand-50" },
          { label: "Total Returned", value: project.totalReturned || 0, icon: ArrowDownRight, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Net Used",       value: (project.totalIssued || 0) - (project.totalReturned || 0), icon: Package, color: "text-slate-600", bg: "bg-slate-50" },
          { label: "Transactions",   value: project.recentActivity?.length || 0, icon: Users, color: "text-indigo-600", bg: "bg-indigo-50" },
        ].map((s, i) => (
          <div key={i} className="premium-card bg-white p-5 flex items-start gap-3" data-testid={`kpi-${s.label.toLowerCase().replace(/\s/g,'-')}`}>
            <div className={`p-2 rounded-xl ${s.bg}`}><s.icon className={`w-5 h-5 ${s.color}`} /></div>
            <div>
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className="text-2xl font-display font-bold text-slate-900">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main tabs */}
      <Tabs defaultValue="activity">
        <TabsList className="bg-slate-100 p-1 rounded-xl mb-4">
          <TabsTrigger value="activity" className="rounded-lg">Transaction History</TabsTrigger>
          <TabsTrigger value="summary" className="rounded-lg">Usage Summary</TabsTrigger>
          <TabsTrigger value="scope" className="rounded-lg" data-testid="tab-scope-items">
            <LayoutList className="w-3.5 h-3.5 mr-1.5" />Scope Items
          </TabsTrigger>
          <TabsTrigger value="progress" className="rounded-lg" data-testid="tab-progress">
            <TrendingUp className="w-3.5 h-3.5 mr-1.5" />Progress
          </TabsTrigger>
        </TabsList>

        {/* Transaction History */}
        <TabsContent value="activity">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="premium-card bg-white overflow-hidden">
                <div className="divide-y divide-slate-100">
                  {!project.recentActivity?.length ? (
                    <div className="p-8 text-center text-slate-500">No transactions for this project yet.</div>
                  ) : project.recentActivity.map((tx: any) => (
                    <div key={tx.id} className="px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors" data-testid={`project-tx-${tx.id}`}>
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${tx.movementType === 'issue' ? 'bg-brand-50 text-brand-600' : 'bg-emerald-50 text-emerald-600'}`}>
                          {tx.movementType === 'issue' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 text-sm">{tx.item?.name}</p>
                          <p className="text-xs text-slate-400">{format(new Date(tx.createdAt), 'MMM d, yyyy • HH:mm')}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <TransactionTypeBadge type={tx.movementType} />
                        <p className="text-sm font-semibold text-slate-900 mt-1">
                          {tx.movementType === 'issue' ? '-' : '+'}{tx.quantity} {tx.item?.unitOfMeasure}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div><ProjectDetailsSidebar project={project} /></div>
          </div>
        </TabsContent>

        {/* Usage Summary */}
        <TabsContent value="summary">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="premium-card bg-white overflow-hidden">
                {usageSummary.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">No material usage recorded yet.</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50/80">
                      <tr>
                        <th className="text-left p-4 font-semibold text-slate-600">Item</th>
                        <th className="text-right p-4 font-semibold text-slate-600">Issued</th>
                        <th className="text-right p-4 font-semibold text-slate-600">Returned</th>
                        <th className="text-right p-4 font-semibold text-slate-600">Net Used</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {usageSummary.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="p-4">
                            <p className="font-medium text-slate-900">{row.itemName}</p>
                            <p className="text-xs font-mono text-slate-400">{row.sku}</p>
                          </td>
                          <td className="p-4 text-right text-brand-600 font-semibold">{row.issued} {row.unit}</td>
                          <td className="p-4 text-right text-emerald-600 font-semibold">{row.returned} {row.unit}</td>
                          <td className="p-4 text-right font-bold text-slate-900">{row.issued - row.returned} {row.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
            <div><ProjectDetailsSidebar project={project} /></div>
          </div>
        </TabsContent>

        {/* Scope Items */}
        <TabsContent value="scope">
          <ScopeItemsTab projectId={id} />
        </TabsContent>

        {/* Progress */}
        <TabsContent value="progress">
          <ProgressTab projectId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
