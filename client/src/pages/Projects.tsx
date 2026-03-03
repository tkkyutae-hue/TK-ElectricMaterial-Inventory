import { useState } from "react";
import { useProjects, useCreateProject } from "@/hooks/use-reference-data";
import { Briefcase, MapPin, Plus, Calendar, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { Link } from "wouter";
import { format } from "date-fns";

const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  completed: { label: "Completed", className: "bg-slate-100 text-slate-600 border-slate-200" },
  on_hold: { label: "On Hold", className: "bg-amber-100 text-amber-700 border-amber-200" },
  cancelled: { label: "Cancelled", className: "bg-rose-100 text-rose-700 border-rose-200" },
};

function ProjectStatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] || { label: status, className: "bg-slate-100 text-slate-700" };
  return <Badge variant="outline" className={`${cfg.className} text-xs font-semibold`}>{cfg.label}</Badge>;
}

export default function Projects() {
  const { data: projects, isLoading } = useProjects();
  const createMutation = useCreateProject();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  const form = useForm({
    defaultValues: { code: "", name: "", customerName: "", city: "", state: "", status: "active", notes: "" }
  });

  const filtered = projects?.filter((p: any) => statusFilter === "all" || p.status === statusFilter);

  function onSubmit(data: any) {
    createMutation.mutate(data, {
      onSuccess: () => { setDialogOpen(false); form.reset(); }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Projects</h1>
          <p className="text-slate-500 mt-1">Active job sites and material tracking by project.</p>
        </div>
        <div className="flex gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="on_hold">On Hold</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-600/20">
                <Plus className="w-4 h-4 mr-2" />New Project
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[550px]">
              <DialogHeader><DialogTitle>Create Project</DialogTitle></DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="code" render={({ field }) => (
                      <FormItem><FormLabel>Project Code</FormLabel><FormControl><Input placeholder="PRJ-2025-001" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="status" render={({ field }) => (
                      <FormItem><FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
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
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Project Name</FormLabel><FormControl><Input placeholder="Downtown Office Renovation" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="customerName" render={({ field }) => (
                    <FormItem><FormLabel>Customer / Owner</FormLabel><FormControl><Input placeholder="Apex Commercial Group" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="city" render={({ field }) => (
                      <FormItem><FormLabel>City</FormLabel><FormControl><Input placeholder="Dallas" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="state" render={({ field }) => (
                      <FormItem><FormLabel>State</FormLabel><FormControl><Input placeholder="TX" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea rows={2} className="resize-none" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="flex justify-end pt-2">
                    <Button type="submit" disabled={createMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
                      {createMutation.isPending ? "Creating..." : "Create Project"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => <div key={i} className="h-44 bg-slate-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : filtered?.length === 0 ? (
        <div className="premium-card bg-white p-16 text-center">
          <Briefcase className="w-12 h-12 mx-auto text-slate-300 mb-4" />
          <p className="font-semibold text-slate-900">No projects found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered?.map((project: any) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="premium-card border-none hover:-translate-y-0.5 cursor-pointer transition-all">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-3">
                    <span className="font-mono text-xs text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded">{project.code}</span>
                    <ProjectStatusBadge status={project.status} />
                  </div>
                  <h3 className="font-display font-bold text-slate-900 text-lg leading-snug mb-1">{project.name}</h3>
                  {project.customerName && (
                    <p className="text-sm text-slate-500 mb-3">{project.customerName}</p>
                  )}
                  <div className="space-y-1.5 text-sm text-slate-500">
                    {(project.city || project.state) && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        {[project.city, project.state].filter(Boolean).join(", ")}
                      </div>
                    )}
                    {project.startDate && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        Started {format(new Date(project.startDate), 'MMM d, yyyy')}
                      </div>
                    )}
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-400">View details</span>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
