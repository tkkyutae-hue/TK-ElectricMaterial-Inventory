import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { useProject, useUpdateProject } from "@/hooks/use-reference-data";
import { TransactionTypeBadge } from "@/components/StatusBadge";
import { MovementForm } from "@/components/MovementForm";
import { ArrowLeft, MapPin, Calendar, Package, ArrowUpRight, ArrowDownRight, Users, Edit, Save, X } from "lucide-react";
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

const statusConfig: Record<string, { label: string; className: string }> = {
  active:    { label: "Active",    className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  completed: { label: "Completed", className: "bg-slate-100 text-slate-600 border-slate-200" },
  on_hold:   { label: "On Hold",   className: "bg-amber-100 text-amber-700 border-amber-200" },
  cancelled: { label: "Cancelled", className: "bg-rose-100 text-rose-700 border-rose-200" },
};

const editSchema = z.object({
  name:         z.string().min(1, "Project name is required"),
  code:         z.string().min(1, "Project code is required"),
  customerName: z.string().optional(),
  poNumber:     z.string().optional(),
  status:       z.string().min(1),
  addressLine1: z.string().optional(),
  city:         z.string().optional(),
  state:        z.string().optional(),
  zipCode:      z.string().optional(),
  notes:        z.string().optional(),
});

type EditFormData = z.infer<typeof editSchema>;

function EditProjectDialog({ project, open, onClose }: { project: any; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const updateMutation = useUpdateProject();

  const form = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name:         project.name || "",
      code:         project.code || "",
      customerName: project.customerName || "",
      poNumber:     project.poNumber || "",
      status:       project.status || "active",
      addressLine1: project.addressLine1 || "",
      city:         project.city || "",
      state:        project.state || "",
      zipCode:      project.zipCode || "",
      notes:        project.notes || "",
    },
  });

  useEffect(() => {
    if (open) form.reset({
      name:         project.name || "",
      code:         project.code || "",
      customerName: project.customerName || "",
      poNumber:     project.poNumber || "",
      status:       project.status || "active",
      addressLine1: project.addressLine1 || "",
      city:         project.city || "",
      state:        project.state || "",
      zipCode:      project.zipCode || "",
      notes:        project.notes || "",
    });
  }, [open, project.id]);

  async function onSubmit(data: EditFormData) {
    try {
      await updateMutation.mutateAsync({ id: project.id, ...data });
      toast({ title: "Project updated", description: `${data.name} has been saved.` });
      onClose();
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Project — {project.code}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Name</FormLabel>
                  <FormControl><Input {...field} data-testid="edit-project-name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="code" render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Code</FormLabel>
                  <FormControl><Input {...field} data-testid="edit-project-code" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="customerName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer</FormLabel>
                  <FormControl><Input placeholder="Customer name" {...field} /></FormControl>
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

            <FormField control={form.control} name="addressLine1" render={({ field }) => (
              <FormItem>
                <FormLabel>Address</FormLabel>
                <FormControl><Input placeholder="Street address" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="city" render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="state" render={({ field }) => (
                <FormItem>
                  <FormLabel>State</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="zipCode" render={({ field }) => (
                <FormItem>
                  <FormLabel>Zip Code</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
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

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={updateMutation.isPending}>
                <X className="w-4 h-4 mr-1" /> Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={updateMutation.isPending} data-testid="button-save-project">
                <Save className="w-4 h-4 mr-1" />
                {updateMutation.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function ProjectDetail() {
  const [, params] = useRoute("/projects/:id");
  const id = Number(params?.id || "0");
  const { data: project, isLoading } = useProject(id);
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
    if (!usageMap[key]) {
      usageMap[key] = { itemName: tx.item.name, sku: tx.item.sku, unit: tx.item.unitOfMeasure, issued: 0, returned: 0 };
    }
    if (tx.movementType === 'issue') usageMap[key].issued += tx.quantity;
    if (tx.movementType === 'return') usageMap[key].returned += tx.quantity;
  });
  const usageSummary = Object.values(usageMap).sort((a, b) => b.issued - a.issued);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Link href="/projects" className="p-2 hover:bg-white rounded-full text-slate-500 transition-colors mt-1">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-sm text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded">{project.code}</span>
            <Badge variant="outline" className={`${statusCfg.className} text-xs font-semibold`}>{statusCfg.label}</Badge>
            {project.poNumber && (
              <span className="text-xs text-slate-500 font-medium bg-slate-100 px-2 py-1 rounded">
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
            <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm" onClick={() => setLogOpen(true)}>
              <ArrowUpRight className="w-4 h-4 mr-2" />Log Material
            </Button>
            <DialogContent className="sm:max-w-[550px]">
              <DialogHeader><DialogTitle>Log Material for {project.code}</DialogTitle></DialogHeader>
              <div className="pt-2">
                <MovementForm defaultType="issue" onSuccess={() => setLogOpen(false)} />
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <EditProjectDialog project={project} open={editOpen} onClose={() => setEditOpen(false)} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Issued",   value: project.totalIssued || 0,  icon: ArrowUpRight,   color: "text-blue-600",   bg: "bg-blue-50" },
          { label: "Total Returned", value: project.totalReturned || 0, icon: ArrowDownRight, color: "text-emerald-600",bg: "bg-emerald-50" },
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Tabs defaultValue="activity">
            <TabsList className="bg-slate-100 p-1 rounded-xl mb-4">
              <TabsTrigger value="activity" className="rounded-lg">Transaction History</TabsTrigger>
              <TabsTrigger value="summary" className="rounded-lg">Usage Summary</TabsTrigger>
            </TabsList>

            <TabsContent value="activity">
              <div className="premium-card bg-white overflow-hidden">
                <div className="divide-y divide-slate-100">
                  {!project.recentActivity?.length ? (
                    <div className="p-8 text-center text-slate-500">No transactions for this project yet.</div>
                  ) : project.recentActivity.map((tx: any) => (
                    <div key={tx.id} className="px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors" data-testid={`project-tx-${tx.id}`}>
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${tx.movementType === 'issue' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
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
            </TabsContent>

            <TabsContent value="summary">
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
                          <td className="p-4 text-right text-blue-600 font-semibold">{row.issued} {row.unit}</td>
                          <td className="p-4 text-right text-emerald-600 font-semibold">{row.returned} {row.unit}</td>
                          <td className="p-4 text-right font-bold text-slate-900">{row.issued - row.returned} {row.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div>
          <Card className="premium-card border-none">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
              <CardTitle className="text-sm font-semibold text-slate-700">Project Details</CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4 text-sm">
              {project.poNumber && (
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">PO Number</p>
                  <p className="font-semibold text-slate-900">{project.poNumber}</p>
                </div>
              )}
              {project.addressLine1 && (
                <div className="flex gap-3">
                  <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-slate-900">{project.addressLine1}</p>
                    <p className="text-slate-500">{[project.city, project.state, project.zipCode].filter(Boolean).join(", ")}</p>
                  </div>
                </div>
              )}
              {project.startDate && (
                <div className="flex gap-3">
                  <Calendar className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-slate-500">Start: {format(new Date(project.startDate), 'MMM d, yyyy')}</p>
                    {project.endDate && <p className="text-slate-500">End: {format(new Date(project.endDate), 'MMM d, yyyy')}</p>}
                  </div>
                </div>
              )}
              {project.notes && (
                <div className="pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-400 mb-1">Notes</p>
                  <p className="text-slate-600">{project.notes}</p>
                </div>
              )}
              {!project.poNumber && !project.addressLine1 && !project.startDate && !project.notes && (
                <p className="text-slate-400 text-sm">No additional details. Click Edit to add project metadata.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
