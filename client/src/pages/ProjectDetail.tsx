import { useState, useEffect, Fragment } from "react";
import { useRoute, useLocation } from "wouter";
import { useProjects, useProject, useUpdateProject, useDeleteProject } from "@/hooks/use-reference-data";
import { MovementForm } from "@/components/MovementForm";
import {
  ArrowLeft, MapPin, Calendar, Package, ArrowUpRight, ArrowDownRight,
  Users, Edit, Save, X, Trash2, Plus, Pencil, CheckCircle2, MinusCircle,
  LayoutList, Hash, TrendingUp, AlertCircle, Download, Clock, FileText,
  ListTodo, Eye, Filter, FileBarChart, ChevronRight,
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
  itemName:              z.string().min(1, "Item name is required"),
  unit:                  z.string().min(1, "Unit is required"),
  estimatedQty:          z.string().min(1, "Qty is required"),
  category:              z.string().optional(),
  remarks:               z.string().optional(),
  isActive:              z.boolean().default(true),
  linkedInventoryItemId: z.number().nullable().optional(),
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

  const { data: allInventoryItems = [] } = useQuery<any[]>({ queryKey: ["/api/items"] });

  const [invSearch, setInvSearch]   = useState("");
  const [invOpen,   setInvOpen]     = useState(false);
  const [linkedInvId, setLinkedInvId] = useState<number | null>(null);

  const filteredInvItems = allInventoryItems
    .filter(it => !invSearch || it.name.toLowerCase().includes(invSearch.toLowerCase()))
    .slice(0, 12);

  const linkedInvName = allInventoryItems.find(it => it.id === linkedInvId)?.name ?? "";

  const form = useForm<ScopeItemFormData>({
    resolver: zodResolver(scopeItemSchema),
    defaultValues: {
      itemName: "", unit: "", estimatedQty: "", category: "", remarks: "", isActive: true,
      linkedInventoryItemId: null,
    },
  });

  useEffect(() => {
    if (open) {
      const lid = (item as any)?.linkedInventoryItemId ?? null;
      setLinkedInvId(lid);
      setInvSearch(lid ? (allInventoryItems.find(it => it.id === lid)?.name ?? "") : "");
      form.reset({
        itemName:              item?.itemName ?? "",
        unit:                  item?.unit ?? "",
        estimatedQty:          item?.estimatedQty ? String(item.estimatedQty) : "",
        category:              item?.category ?? "",
        remarks:               item?.remarks ?? "",
        isActive:              item?.isActive ?? true,
        linkedInventoryItemId: lid,
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
    const payload = {
      ...data,
      estimatedQty: String(data.estimatedQty),
      linkedInventoryItemId: linkedInvId,
    };
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
            {/* Inventory Item Link */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">
                Inventory Item Link <span className="text-slate-400 font-normal text-xs">(optional — enables auto-link in daily reports)</span>
              </label>
              <div className="relative">
                <Input
                  placeholder="Search inventory items to link…"
                  value={invSearch}
                  data-testid="input-scope-inv-link"
                  onChange={(e) => { setInvSearch(e.target.value); setInvOpen(true); if (!e.target.value) setLinkedInvId(null); }}
                  onFocus={() => setInvOpen(true)}
                  onBlur={() => setTimeout(() => setInvOpen(false), 150)}
                  className={linkedInvId ? "border-emerald-300 bg-emerald-50 text-emerald-800" : ""}
                />
                {linkedInvId && (
                  <button type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    onClick={() => { setLinkedInvId(null); setInvSearch(""); }}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                {invOpen && filteredInvItems.length > 0 && (
                  <div className="absolute z-[200] top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                    {filteredInvItems.map(it => (
                      <button key={it.id} type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { setLinkedInvId(it.id); setInvSearch(it.name); setInvOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center justify-between gap-2 transition-colors ${linkedInvId === it.id ? "bg-emerald-50 text-emerald-800 font-medium" : "text-slate-700"}`}>
                        <span className="truncate">{it.name}</span>
                        <span className="text-[10px] text-slate-400 shrink-0 font-mono">{it.unitOfMeasure ?? ""}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {linkedInvId && (
                <p className="text-[11px] text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Linked: {linkedInvName}
                </p>
              )}
            </div>
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
  const { data: allInvItems = [] } = useQuery<any[]>({ queryKey: ["/api/items"] });

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
                      {(item as any).linkedInventoryItemId && (() => {
                        const invItem = allInvItems.find(it => it.id === (item as any).linkedInventoryItemId);
                        return invItem ? (
                          <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded font-medium">
                            <Package className="w-2.5 h-2.5" /> {invItem.name}
                          </span>
                        ) : null;
                      })()}
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

// ── Progress Drill-Down Row ────────────────────────────────────────────────────
function DrillDownRows({
  entries, unit, estQty,
}: {
  entries: { reportId: number; reportNumber: string | null; reportDate: string; preparedBy: string | null; qty: number; runningTotal: number }[];
  unit: string;
  estQty: number;
}) {
  if (entries.length === 0) {
    return (
      <tr>
        <td />
        <td colSpan={6} className="px-4 pb-3 pt-0">
          <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs text-slate-400 italic">
            No submitted reports have logged quantities for this item yet.
          </div>
        </td>
      </tr>
    );
  }
  return (
    <tr>
      <td />
      <td colSpan={6} className="px-4 pb-4 pt-0">
        <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
          {/* Sub-table header */}
          <div className="grid grid-cols-[90px_110px_1fr_90px_110px] gap-0 bg-slate-100/80 border-b border-slate-200 px-4 py-2">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Report #</span>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Date</span>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Prepared By</span>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-right">Qty</span>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-right">Running Total</span>
          </div>
          {/* Sub-table rows */}
          {entries.map((e, i) => {
            const pct = estQty > 0 ? Math.min(100, Math.round((e.runningTotal / estQty) * 1000) / 10) : 0;
            return (
              <div
                key={`${e.reportId}-${i}`}
                className="grid grid-cols-[90px_110px_1fr_90px_110px] gap-0 px-4 py-2.5 border-b border-slate-100 last:border-0 hover:bg-white/70 transition-colors"
              >
                <span className="text-xs font-mono font-semibold text-brand-700">
                  {e.reportNumber ? `#${e.reportNumber}` : `ID ${e.reportId}`}
                </span>
                <span className="text-xs text-slate-600">
                  {e.reportDate ? format(new Date(e.reportDate + "T00:00:00"), "MMM d, yyyy") : "—"}
                </span>
                <span className="text-xs text-slate-600 truncate pr-2">{e.preparedBy || <span className="text-slate-300 italic">—</span>}</span>
                <span className="text-xs font-semibold text-emerald-700 tabular-nums text-right">
                  +{e.qty.toLocaleString()} {unit}
                </span>
                <div className="flex items-center justify-end gap-1.5">
                  <span className="text-xs tabular-nums text-slate-700 font-medium">{e.runningTotal.toLocaleString()}</span>
                  <span className="text-[10px] text-slate-400 font-mono">({pct.toFixed(1)}%)</span>
                </div>
              </div>
            );
          })}
          {/* Summary footer */}
          <div className="px-4 py-2 bg-slate-100/60 border-t border-slate-200 flex items-center justify-between">
            <span className="text-[10px] text-slate-400">{entries.length} submitted report{entries.length !== 1 ? "s" : ""} contributed</span>
            <span className="text-xs font-bold text-emerald-700">
              Total: {entries[entries.length - 1]?.runningTotal?.toLocaleString() ?? 0} / {estQty.toLocaleString()} {unit}
            </span>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ── Progress Tab ──────────────────────────────────────────────────────────────
function ProgressTab({ projectId }: { projectId: number }) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const { data, isLoading } = useQuery<{
    scopeItems: any[];
    progress: Record<number, { cumulative: number; remaining: number; pct: number }>;
    drillDown: Record<number, { reportId: number; reportNumber: string | null; reportDate: string; preparedBy: string | null; qty: number; runningTotal: number }[]>;
    summary: { overallPct: number; estTotal: number; installed: number; remaining: number };
  }>({
    queryKey: ["/api/projects", projectId, "progress"],
    queryFn: () => fetch(`/api/projects/${projectId}/progress`, { credentials: "include" }).then(r => r.json()),
  });

  if (isLoading) return <div className="p-8 text-center text-slate-400">Loading progress…</div>;

  const scopeItems = data?.scopeItems ?? [];
  const progress   = data?.progress ?? {};
  const drillDown  = data?.drillDown ?? {};
  const summary    = data?.summary ?? { overallPct: 0, estTotal: 0, installed: 0, remaining: 0 };
  const hasScopes  = scopeItems.length > 0;

  const pctColor = (pct: number) =>
    pct >= 100 ? "bg-emerald-500" : pct >= 70 ? "bg-brand-500" : pct >= 40 ? "bg-blue-400" : "bg-slate-300";

  const summaryPctColor =
    summary.overallPct >= 100 ? "text-emerald-600" :
    summary.overallPct >= 70  ? "text-brand-600"   :
    summary.overallPct >= 40  ? "text-blue-600"    : "text-slate-500";

  function toggleRow(id: number) {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

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
            <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Progress by Scope Item</h3>
                <p className="text-xs text-slate-400 mt-0.5">Click any row to see which submitted reports contributed to that item's total</p>
              </div>
              {expandedRows.size > 0 && (
                <button
                  onClick={() => setExpandedRows(new Set())}
                  className="text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2 transition-colors"
                >
                  Collapse all
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/80">
                  <tr>
                    <th className="w-9 px-2" />
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 w-[28%]">Item</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 w-[7%]">Unit</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600 w-[11%]">Est. Qty</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600 w-[12%]">Installed</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600 w-[11%]">Remaining</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {scopeItems.map((scope) => {
                    const p = progress[scope.id] ?? { cumulative: 0, remaining: parseFloat(String(scope.estimatedQty)), pct: 0 };
                    const estQty = parseFloat(String(scope.estimatedQty));
                    const entries = drillDown[scope.id] ?? [];
                    const isExpanded = expandedRows.has(scope.id);
                    const hasDrillDown = p.cumulative > 0;

                    return (
                      <Fragment key={scope.id}>
                        {/* Main progress row */}
                        <tr
                          data-testid={`progress-row-${scope.id}`}
                          onClick={() => hasDrillDown && toggleRow(scope.id)}
                          className={[
                            "transition-colors border-b border-slate-100",
                            hasDrillDown ? "cursor-pointer" : "",
                            isExpanded ? "bg-brand-50/30 border-b-0" : hasDrillDown ? "hover:bg-slate-50" : "",
                            !scope.isActive ? "opacity-50" : "",
                          ].join(" ")}
                        >
                          {/* Expand toggle */}
                          <td className="px-2 py-3.5 text-center">
                            {hasDrillDown ? (
                              <span className={`inline-flex items-center justify-center w-5 h-5 rounded transition-transform text-slate-400 ${isExpanded ? "rotate-90 text-brand-600" : ""}`}>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </span>
                            ) : (
                              <span className="inline-block w-5 h-5" />
                            )}
                          </td>
                          <td className="px-4 py-3.5">
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
                            {p.cumulative > 0 ? (
                              <span className="flex items-center justify-end gap-1">
                                {p.cumulative.toLocaleString()}
                                {entries.length > 0 && (
                                  <span className="text-[10px] font-normal text-slate-400 ml-0.5">({entries.length}r)</span>
                                )}
                              </span>
                            ) : (
                              <span className="text-slate-300">0</span>
                            )}
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

                        {/* Drill-down expanded row */}
                        {isExpanded && (
                          <DrillDownRows entries={entries} unit={scope.unit} estQty={estQty} />
                        )}
                      </Fragment>
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

// ── CSV Export ────────────────────────────────────────────────────────────────
function exportReportCsv(report: any, projectName: string) {
  const fd = report.formData ?? {};
  const rows: string[][] = [];
  rows.push(["VoltStock — Daily Report Export"]);
  rows.push(["Project:", projectName]);
  rows.push(["Report No.:", report.reportNumber ?? "—"]);
  rows.push(["Report Date:", report.reportDate ?? "—"]);
  rows.push(["Prepared By:", fd.preparedBy ?? "—"]);
  rows.push(["Shift:", fd.shift ?? "—"]);
  rows.push(["Weather:", fd.weather ?? "—"]);
  rows.push([]);
  rows.push(["── MANPOWER ──"]);
  rows.push(["Worker", "Trade", "Status", "Start", "End", "Hours", "Notes"]);
  (fd.manpower ?? []).forEach((r: any) =>
    rows.push([r.workerName ?? "", r.trade ?? "", r.attendanceStatus ?? "", r.startTime ?? "", r.endTime ?? "", String(r.hoursWorked ?? 0), r.notes ?? ""])
  );
  const totalHrs = (fd.manpower ?? []).reduce((s: number, r: any) => s + Number(r.hoursWorked ?? 0), 0);
  rows.push(["", "", "", "", "TOTAL HOURS", String(totalHrs)]);
  rows.push([]);
  rows.push(["── WORK TASKS ──"]);
  rows.push(["#", "Description", "Location", "Qty", "Unit", "Notes"]);
  (fd.tasks ?? []).forEach((t: any, i: number) =>
    rows.push([String(i + 1), t.description ?? "", t.location ?? "", String(t.qty ?? ""), t.unit ?? "", t.notes ?? ""])
  );
  rows.push([]);
  rows.push(["── MATERIALS ──"]);
  rows.push(["Material", "Unit", "Qty Used", "Notes"]);
  (fd.materials ?? []).forEach((m: any) =>
    rows.push([m.description ?? "", m.unit ?? "", String(m.qty ?? ""), m.notes ?? ""])
  );
  rows.push([]);
  rows.push(["── EQUIPMENT ──"]);
  rows.push(["Equipment", "Qty", "Hours", "Notes"]);
  (fd.equipment ?? []).forEach((e: any) =>
    rows.push([e.description ?? "", String(e.qty ?? ""), String(e.hours ?? ""), e.notes ?? ""])
  );
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `report-${report.reportNumber ?? report.id}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// ── Status badge ───────────────────────────────────────────────────────────────
function ReportStatusBadge({ status }: { status: string }) {
  if (status === "submitted") return (
    <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 px-2 py-0.5 font-semibold">
      Submitted
    </Badge>
  );
  return (
    <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 px-2 py-0.5 font-semibold">
      Draft
    </Badge>
  );
}

// ── Overview Tab ───────────────────────────────────────────────────────────────
function OverviewTab({ project, projectId }: { project: any; projectId: number }) {
  const { data: reports = [] } = useQuery<any[]>({
    queryKey: ["/api/daily-reports", projectId],
    queryFn: () => fetch(`/api/daily-reports?projectId=${projectId}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!projectId,
  });
  const { data: progressData } = useQuery<{
    scopeItems: any[];
    summary: { overallPct: number; estTotal: number; installed: number; remaining: number };
  }>({
    queryKey: ["/api/projects", projectId, "progress"],
    queryFn: () => fetch(`/api/projects/${projectId}/progress`, { credentials: "include" }).then(r => r.json()),
  });

  const totalReports    = reports.length;
  const draftCount      = reports.filter(r => r.status === "draft").length;
  const submittedCount  = reports.filter(r => r.status === "submitted").length;
  const overallPct      = progressData?.summary?.overallPct ?? 0;
  const totalScopeItems = progressData?.scopeItems?.length ?? 0;
  const totalEstQty     = progressData?.summary?.estTotal ?? 0;
  const statusCfg       = statusConfig[project.status] || { label: project.status, className: "bg-slate-100 text-slate-600" };

  const submittedReports = reports.filter(r => r.status === "submitted");
  const lastSubmittedDate = submittedReports.length > 0
    ? [...submittedReports].sort((a, b) => (b.reportDate ?? "") > (a.reportDate ?? "") ? 1 : -1)[0]?.reportDate ?? null
    : null;

  const pctColor = overallPct >= 100 ? "bg-emerald-500" : overallPct >= 70 ? "bg-brand-500" : overallPct >= 40 ? "bg-blue-400" : "bg-slate-300";
  const pctText  = overallPct >= 100 ? "text-emerald-600" : overallPct >= 70 ? "text-brand-600" : overallPct >= 40 ? "text-blue-600" : "text-slate-400";

  return (
    <div className="space-y-5">
      {/* ── Top row: project card + mini stats ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Project info */}
        <div className="lg:col-span-2 premium-card bg-white p-6 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Project</p>
              <h2 className="text-2xl font-display font-bold text-slate-900">{project.name}</h2>
              {project.customerName && <p className="text-sm text-slate-500 mt-0.5">{project.customerName}</p>}
            </div>
            <Badge variant="outline" className={`${statusCfg.className} text-xs font-semibold shrink-0`}>{statusCfg.label}</Badge>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
            {project.poNumber && (
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">PO Number</p>
                <p className="text-sm font-mono font-bold text-brand-700">{project.poNumber}</p>
              </div>
            )}
            {project.ownerName && (
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Owner / Manager</p>
                <p className="text-sm font-semibold text-slate-800">{project.ownerName}</p>
              </div>
            )}
            {project.jobLocation && (
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Location</p>
                <p className="text-sm text-slate-700 flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-slate-400" />{project.jobLocation}</p>
              </div>
            )}
            {project.startDate && (
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Start Date</p>
                <p className="text-sm text-slate-700">{format(new Date(project.startDate + "T00:00:00"), "MMM d, yyyy")}</p>
              </div>
            )}
            {project.endDate && (
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">End Date</p>
                <p className="text-sm text-slate-700">{format(new Date(project.endDate + "T00:00:00"), "MMM d, yyyy")}</p>
              </div>
            )}
          </div>

          {project.notes && (
            <div className="pt-3 border-t border-slate-100">
              <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Notes</p>
              <p className="text-sm text-slate-600 leading-relaxed">{project.notes}</p>
            </div>
          )}
        </div>

        {/* Right column: report stats + progress */}
        <div className="space-y-4">
          {/* Daily report stats */}
          <div className="premium-card bg-white p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />Daily Reports
            </p>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Total Reports</span>
                <span className="text-lg font-display font-bold text-slate-900">{totalReports}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: totalReports ? `${(submittedCount / totalReports) * 100}%` : "0%" }} />
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-1 text-center px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-100">
                  <p className="text-[10px] text-emerald-600 uppercase tracking-wide">Submitted</p>
                  <p className="text-xl font-bold text-emerald-700">{submittedCount}</p>
                </div>
                <div className="flex-1 text-center px-3 py-2 rounded-xl bg-amber-50 border border-amber-100">
                  <p className="text-[10px] text-amber-600 uppercase tracking-wide">Draft</p>
                  <p className="text-xl font-bold text-amber-700">{draftCount}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Progress summary */}
          <div className="premium-card bg-white p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />Overall Progress
            </p>
            <div className="flex items-end gap-2 mb-2">
              <span className={`text-4xl font-display font-bold ${pctText}`}>{overallPct.toFixed(1)}%</span>
              <span className="text-xs text-slate-400 mb-1">complete</span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${pctColor}`} style={{ width: `${Math.min(100, overallPct)}%` }} />
            </div>
            {progressData && (
              <div className="flex gap-3 mt-3 pt-3 border-t border-slate-100">
                <div className="flex-1">
                  <p className="text-[10px] text-slate-400">Installed</p>
                  <p className="text-sm font-bold text-emerald-700">{progressData.summary.installed.toLocaleString()}</p>
                </div>
                <div className="flex-1">
                  <p className="text-[10px] text-slate-400">Remaining</p>
                  <p className="text-sm font-bold text-amber-700">{progressData.summary.remaining.toLocaleString()}</p>
                </div>
                <div className="flex-1">
                  <p className="text-[10px] text-slate-400">Est. Total</p>
                  <p className="text-sm font-bold text-slate-700">{progressData.summary.estTotal.toLocaleString()}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Scope & Progress Summary strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="premium-card bg-white p-4 flex items-center gap-3" data-testid="overview-scope-count">
          <div className="p-2 rounded-xl bg-indigo-50"><LayoutList className="w-4 h-4 text-indigo-600" /></div>
          <div>
            <p className="text-xs text-slate-400">Scope Items</p>
            <p className="text-2xl font-display font-bold text-slate-900">{totalScopeItems}</p>
          </div>
        </div>
        <div className="premium-card bg-white p-4 flex items-center gap-3" data-testid="overview-est-qty">
          <div className="p-2 rounded-xl bg-brand-50"><Hash className="w-4 h-4 text-brand-600" /></div>
          <div>
            <p className="text-xs text-slate-400">Total Est. Qty</p>
            <p className="text-2xl font-display font-bold text-slate-900">{totalEstQty.toLocaleString()}</p>
          </div>
        </div>
        <div className="premium-card bg-white p-4 flex items-center gap-3 col-span-2 sm:col-span-1" data-testid="overview-last-submitted">
          <div className="p-2 rounded-xl bg-slate-50"><Clock className="w-4 h-4 text-slate-500" /></div>
          <div>
            <p className="text-xs text-slate-400">Last Submitted Report</p>
            <p className="text-sm font-semibold text-slate-800 mt-0.5">
              {lastSubmittedDate
                ? format(new Date(lastSubmittedDate + "T00:00:00"), "MMM d, yyyy")
                : <span className="text-slate-400 font-normal text-xs">No submitted reports yet</span>
              }
            </p>
          </div>
        </div>
      </div>

      {/* ── Material KPIs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Issued",   value: project.totalIssued || 0,  icon: ArrowUpRight,   color: "text-brand-600",   bg: "bg-brand-50" },
          { label: "Total Returned", value: project.totalReturned || 0, icon: ArrowDownRight, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Net Used",       value: (project.totalIssued || 0) - (project.totalReturned || 0), icon: Package, color: "text-slate-600", bg: "bg-slate-50" },
          { label: "Transactions",   value: project.recentActivity?.length || 0, icon: Users, color: "text-indigo-600", bg: "bg-indigo-50" },
        ].map((s, i) => (
          <div key={i} className="premium-card bg-white p-4 flex items-start gap-3">
            <div className={`p-2 rounded-xl ${s.bg}`}><s.icon className={`w-4 h-4 ${s.color}`} /></div>
            <div>
              <p className="text-xs text-slate-400">{s.label}</p>
              <p className="text-2xl font-display font-bold text-slate-900">{s.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Daily Reports Tab ──────────────────────────────────────────────────────────
function DailyReportsTab({ projectId, project }: { projectId: number; project: any }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [filter, setFilter] = useState<"all" | "draft" | "submitted">("all");

  const { data: reports = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/daily-reports", projectId],
    queryFn: () => fetch(`/api/daily-reports?projectId=${projectId}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!projectId,
  });

  const sorted = [...reports].sort((a, b) => {
    const da = a.reportDate ?? a.createdAt ?? "";
    const db = b.reportDate ?? b.createdAt ?? "";
    return da > db ? -1 : da < db ? 1 : 0;
  });
  const filtered = filter === "all" ? sorted : sorted.filter(r => r.status === filter);

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-2">
        <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        {(["all", "submitted", "draft"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            data-testid={`filter-reports-${f}`}
            className={[
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
              filter === f
                ? f === "submitted" ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                  : f === "draft" ? "bg-amber-100 text-amber-700 border border-amber-200"
                  : "bg-slate-800 text-white"
                : "bg-white text-slate-500 border border-slate-200 hover:border-slate-300",
            ].join(" ")}
          >
            {f === "all" ? `All (${reports.length})` : f === "submitted" ? `Submitted (${reports.filter(r=>r.status==="submitted").length})` : `Draft (${reports.filter(r=>r.status==="draft").length})`}
          </button>
        ))}
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          className="text-xs gap-1.5 h-8 bg-white"
          onClick={() => navigate(`/daily-report/${projectId}`)}
          data-testid="btn-goto-workspace"
        >
          <Plus className="w-3.5 h-3.5" />New Report
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="premium-card bg-white p-12 text-center text-slate-400 text-sm">Loading reports…</div>
      ) : filtered.length === 0 ? (
        <div className="premium-card bg-white p-12 text-center">
          <FileText className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No reports found</p>
          <p className="text-xs text-slate-400 mt-1">
            {filter === "all" ? "No daily reports yet for this project." : `No ${filter} reports.`}
          </p>
        </div>
      ) : (
        <div className="premium-card bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-daily-reports">
              <thead className="bg-slate-50/80 border-b border-slate-100">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs w-[80px]">Report #</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs w-[90px]">Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">Prepared By</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs w-[90px]">Status</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600 text-xs w-[70px]">Workers</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600 text-xs w-[80px]">Man-hrs</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600 text-xs w-[65px]">Tasks</th>
                  <th className="text-center px-4 py-3 font-semibold text-slate-600 text-xs w-[75px]">Materials</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 text-xs">Last Updated</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 text-xs w-[130px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r, idx) => {
                  const fd = r.formData ?? {};
                  const manpower  = Array.isArray(fd.manpower)  ? fd.manpower  : [];
                  const tasks     = Array.isArray(fd.tasks)     ? fd.tasks     : [];
                  const materials = Array.isArray(fd.materials) ? fd.materials : [];
                  const workers   = manpower.length;
                  const manHrs    = manpower.reduce((s: number, mp: any) => s + Number(mp.hoursWorked ?? 0), 0);
                  const submitted = r.status === "submitted";
                  const dateStr  = r.reportDate ?? null;
                  const updatedAt = r.updatedAt ? new Date(r.updatedAt) : null;

                  return (
                    <tr
                      key={r.id}
                      data-testid={`row-report-${r.id}`}
                      className={`hover:bg-slate-50 transition-colors ${submitted ? "" : "bg-amber-50/20"}`}
                    >
                      {/* Status accent line via left border */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-1 h-6 rounded-full shrink-0 ${submitted ? "bg-emerald-400" : "bg-amber-400"}`} />
                          <span className="font-mono text-xs font-semibold text-slate-700">
                            {r.reportNumber ? `#${r.reportNumber}` : `—`}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                        {dateStr ? format(new Date(dateStr + "T00:00:00"), "MMM d, yyyy") : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700">
                        {fd.preparedBy || <span className="text-slate-300 italic">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <ReportStatusBadge status={r.status} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {workers > 0 ? (
                          <span className="flex items-center justify-center gap-1 text-xs text-slate-600">
                            <Users className="w-3 h-3 text-slate-400" />{workers}
                          </span>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {manHrs > 0 ? (
                          <span className="flex items-center justify-center gap-1 text-xs text-slate-600">
                            <Clock className="w-3 h-3 text-slate-400" />{manHrs.toFixed(1)}
                          </span>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {tasks.length > 0 ? (
                          <span className="flex items-center justify-center gap-1 text-xs text-slate-600">
                            <ListTodo className="w-3 h-3 text-slate-400" />{tasks.length}
                          </span>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {materials.length > 0 ? (
                          <span className="flex items-center justify-center gap-1 text-xs text-slate-600">
                            <Package className="w-3 h-3 text-slate-400" />{materials.length}
                          </span>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {updatedAt ? updatedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-7 px-2.5 gap-1"
                            data-testid={`btn-edit-report-${r.id}`}
                            onClick={() => navigate(`/daily-report/${projectId}`)}
                          >
                            {submitted ? <Eye className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
                            {submitted ? "View" : "Edit"}
                          </Button>
                          {submitted && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs h-7 px-2.5 gap-1 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50"
                              data-testid={`btn-export-report-${r.id}`}
                              onClick={() => {
                                exportReportCsv(r, project.name);
                                toast({ title: "Exported", description: `Report #${r.reportNumber ?? r.id} downloaded as CSV.` });
                              }}
                            >
                              <Download className="w-3 h-3" />CSV
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
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

      {/* Main tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="bg-slate-100 p-1 rounded-xl mb-4">
          <TabsTrigger value="overview" className="rounded-lg" data-testid="tab-overview">
            <FileBarChart className="w-3.5 h-3.5 mr-1.5" />Overview
          </TabsTrigger>
          <TabsTrigger value="scope" className="rounded-lg" data-testid="tab-scope-items">
            <LayoutList className="w-3.5 h-3.5 mr-1.5" />Scope Items
          </TabsTrigger>
          <TabsTrigger value="reports" className="rounded-lg" data-testid="tab-reports">
            <FileText className="w-3.5 h-3.5 mr-1.5" />Daily Reports
          </TabsTrigger>
          <TabsTrigger value="progress" className="rounded-lg" data-testid="tab-progress">
            <TrendingUp className="w-3.5 h-3.5 mr-1.5" />Progress
          </TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview">
          <OverviewTab project={project} projectId={id} />
        </TabsContent>

        {/* Scope Items */}
        <TabsContent value="scope">
          <ScopeItemsTab projectId={id} />
        </TabsContent>

        {/* Daily Reports */}
        <TabsContent value="reports">
          <DailyReportsTab projectId={id} project={project} />
        </TabsContent>

        {/* Progress */}
        <TabsContent value="progress">
          <ProgressTab projectId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
