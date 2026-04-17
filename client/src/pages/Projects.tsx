import { useState } from "react";
import { useProjects, useCreateProject } from "@/hooks/use-reference-data";
import { Briefcase, MapPin, Plus, Calendar, ChevronRight, Search, FileText, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { QuickEntryInput } from "@/components/QuickEntryInput";
import { useForm } from "react-hook-form";
import { Link } from "wouter";
import { format } from "date-fns";
import { PageHeader } from "@/components/shared/PageHeader";

const statusConfig: Record<string, { label: string; className: string; dotClass: string }> = {
  active:    { label: "Active",    className: "bg-emerald-100 text-emerald-700 border-emerald-200", dotClass: "bg-emerald-500" },
  completed: { label: "Completed", className: "bg-slate-100 text-slate-600 border-slate-200",       dotClass: "bg-slate-400" },
  on_hold:   { label: "On Hold",   className: "bg-amber-100 text-amber-700 border-amber-200",       dotClass: "bg-amber-500" },
  cancelled: { label: "Cancelled", className: "bg-rose-100 text-rose-700 border-rose-200",         dotClass: "bg-rose-500" },
};

function ProjectStatusChip({ status }: { status: string }) {
  const cfg = statusConfig[status] || { label: status, className: "bg-slate-100 text-slate-700 border-slate-200", dotClass: "bg-slate-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold border ${cfg.className} leading-none whitespace-nowrap`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dotClass}`} />
      {cfg.label}
    </span>
  );
}

const COL_HEADER = "text-[10px] font-bold text-slate-400 uppercase tracking-widest";

export default function Projects() {
  const { data: projects, isLoading } = useProjects();
  const createMutation = useCreateProject();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const allProjects: any[] = projects ?? [];
  const customerSuggestions = [...new Set(allProjects.map((p: any) => p.customerName).filter(Boolean))] as string[];
  const ownerSuggestions    = [...new Set(allProjects.map((p: any) => p.ownerName).filter(Boolean))] as string[];
  const locationSuggestions = [...new Set(allProjects.map((p: any) => p.jobLocation).filter(Boolean))] as string[];

  const form = useForm({
    defaultValues: { name: "", customerName: "", ownerName: "", jobLocation: "", poNumber: "", status: "active", notes: "" }
  });

  const filtered = allProjects.filter((p: any) => {
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    if (!search.trim()) return matchStatus;
    const q = search.toLowerCase();
    const matchSearch =
      p.name?.toLowerCase().includes(q) ||
      p.customerName?.toLowerCase().includes(q) ||
      p.ownerName?.toLowerCase().includes(q) ||
      p.jobLocation?.toLowerCase().includes(q) ||
      p.poNumber?.toLowerCase().includes(q) ||
      p.status?.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  function onSubmit(data: any) {
    const code = `PRJ-${Date.now().toString(36).toUpperCase()}`;
    const clean: any = { ...data, code };
    ["customerName", "ownerName", "jobLocation", "poNumber", "notes"].forEach(f => {
      if (clean[f] === "") clean[f] = null;
    });
    createMutation.mutate(clean, {
      onSuccess: () => { setDialogOpen(false); form.reset(); }
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader size="lg" title="Projects" subtitle="Active job sites and material tracking by project." className="flex-col sm:flex-row sm:items-center">
        <div className="flex gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] bg-white" data-testid="select-status-filter"><SelectValue /></SelectTrigger>
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
              <Button className="bg-brand-700 hover:bg-brand-800 text-white shadow-sm shadow-brand-700/20" data-testid="btn-new-project">
                <Plus className="w-4 h-4 mr-2" />New Project
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[550px]">
              <DialogHeader><DialogTitle>Create Project</DialogTitle></DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem><FormLabel>Project Name <span className="text-red-500">*</span></FormLabel><FormControl><Input placeholder="Downtown Office Renovation" {...field} data-testid="input-create-project-name" /></FormControl><FormMessage /></FormItem>
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

                  <FormField control={form.control} name="customerName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer</FormLabel>
                      <FormControl>
                        <QuickEntryInput value={field.value ?? ""} onChange={field.onChange} suggestions={customerSuggestions} placeholder="Apex Commercial Group" testId="input-create-customer" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="ownerName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Owner</FormLabel>
                        <FormControl>
                          <QuickEntryInput value={field.value ?? ""} onChange={field.onChange} suggestions={ownerSuggestions} placeholder="John Kim" testId="input-create-owner" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="poNumber" render={({ field }) => (
                      <FormItem><FormLabel>PO Number</FormLabel><FormControl><Input placeholder="PO-2026-001" {...field} data-testid="input-create-po" /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>

                  <FormField control={form.control} name="jobLocation" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job Location</FormLabel>
                      <FormControl>
                        <QuickEntryInput value={field.value ?? ""} onChange={field.onChange} suggestions={locationSuggestions} placeholder="123 Main St, Dallas TX" testId="input-create-location" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea rows={2} className="resize-none" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />

                  <div className="flex justify-end pt-2">
                    <Button type="submit" disabled={createMutation.isPending} className="bg-brand-700 hover:bg-brand-800">
                      {createMutation.isPending ? "Creating..." : "Create Project"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </PageHeader>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search by project name, customer, owner, location, PO…"
          className="pl-9 bg-white border-slate-200"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="input-project-search"
        />
      </div>

      {/* Project count summary */}
      {!isLoading && allProjects.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span data-testid="text-project-count">
            {filtered.length === allProjects.length
              ? `${allProjects.length} project${allProjects.length !== 1 ? "s" : ""}`
              : `${filtered.length} of ${allProjects.length} projects`}
          </span>
          {(search || statusFilter !== "all") && (
            <button
              className="text-brand-600 hover:text-brand-800 font-medium text-xs transition-colors"
              onClick={() => { setSearch(""); setStatusFilter("all"); }}
              data-testid="btn-clear-filters"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Board */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center gap-4">
            <div className="h-3 bg-slate-200 rounded w-24 animate-pulse" />
            <div className="h-3 bg-slate-200 rounded w-16 animate-pulse" />
            <div className="h-3 bg-slate-200 rounded w-20 animate-pulse" />
          </div>
          {[1, 2, 3].map(i => (
            <div key={i} className="px-4 py-4 border-b border-slate-50 flex items-center gap-4">
              <div className="h-4 bg-slate-100 rounded flex-1 animate-pulse" />
              <div className="h-5 bg-slate-100 rounded w-20 animate-pulse" />
              <div className="h-3 bg-slate-100 rounded w-32 animate-pulse hidden md:block" />
              <div className="h-3 bg-slate-100 rounded w-36 animate-pulse hidden lg:block" />
              <div className="h-3 bg-slate-100 rounded w-24 animate-pulse hidden lg:block" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <Briefcase className="w-7 h-7 text-slate-400" />
          </div>
          <p className="font-semibold text-slate-900">No projects found</p>
          {search
            ? <p className="text-sm text-slate-500 mt-1">No results for "<span className="font-medium">{search}</span>" — try different terms.</p>
            : statusFilter !== "all"
              ? <p className="text-sm text-slate-500 mt-1">No projects match the selected status filter.</p>
              : <p className="text-sm text-slate-500 mt-1">Create your first project to get started.</p>
          }
          {(search || statusFilter !== "all") && (
            <button
              className="mt-3 text-sm text-brand-600 hover:text-brand-800 font-medium transition-colors"
              onClick={() => { setSearch(""); setStatusFilter("all"); }}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Column header */}
          <div className="hidden md:flex items-center gap-0 px-4 py-2.5 border-b border-slate-100 bg-slate-50/80 select-none">
            <div className="flex-1 min-w-0 pr-4">
              <span className={COL_HEADER}>Project Name</span>
            </div>
            <div className="w-28 flex-shrink-0">
              <span className={COL_HEADER}>Status</span>
            </div>
            <div className="w-44 flex-shrink-0 hidden lg:block">
              <span className={COL_HEADER}>Customer</span>
            </div>
            <div className="w-52 flex-shrink-0 hidden xl:block">
              <span className={COL_HEADER}>Location</span>
            </div>
            <div className="w-32 flex-shrink-0 hidden xl:block">
              <span className={COL_HEADER}>Started</span>
            </div>
            <div className="w-32 flex-shrink-0 hidden lg:block">
              <span className={COL_HEADER}>Code / PO</span>
            </div>
            <div className="w-8 flex-shrink-0" />
          </div>

          {/* Project rows */}
          <div className="divide-y divide-slate-50">
            {filtered.map((project: any) => (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <div
                  className="flex items-center gap-0 px-4 py-3.5 hover:bg-slate-50/80 cursor-pointer transition-colors group"
                  data-testid={`row-project-${project.id}`}
                >
                  {/* Project name + owner */}
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="font-semibold text-slate-900 text-sm truncate leading-snug group-hover:text-brand-700 transition-colors" data-testid={`text-project-name-${project.id}`}>
                      {project.name}
                    </p>
                    {project.ownerName && (
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">{project.ownerName}</p>
                    )}
                    {/* Mobile-only secondary info */}
                    <div className="flex items-center gap-2 mt-1 md:hidden">
                      <ProjectStatusChip status={project.status} />
                      {project.customerName && (
                        <span className="text-[11px] text-slate-400 truncate">{project.customerName}</span>
                      )}
                    </div>
                  </div>

                  {/* Status */}
                  <div className="w-28 flex-shrink-0 hidden md:flex">
                    <ProjectStatusChip status={project.status} />
                  </div>

                  {/* Customer */}
                  <div className="w-44 flex-shrink-0 hidden lg:block pr-2">
                    <p className="text-sm text-slate-600 truncate" data-testid={`text-project-customer-${project.id}`}>
                      {project.customerName || <span className="text-slate-300">—</span>}
                    </p>
                  </div>

                  {/* Location */}
                  <div className="w-52 flex-shrink-0 hidden xl:flex items-center gap-1.5 pr-2">
                    {project.jobLocation ? (
                      <>
                        <MapPin className="w-3 h-3 text-slate-300 flex-shrink-0" />
                        <span className="text-sm text-slate-600 truncate" data-testid={`text-project-location-${project.id}`}>{project.jobLocation}</span>
                      </>
                    ) : (
                      <span className="text-slate-300 text-sm">—</span>
                    )}
                  </div>

                  {/* Started */}
                  <div className="w-32 flex-shrink-0 hidden xl:flex items-center gap-1.5 pr-2">
                    {project.startDate ? (
                      <>
                        <Calendar className="w-3 h-3 text-slate-300 flex-shrink-0" />
                        <span className="text-sm text-slate-600 whitespace-nowrap">
                          {format(new Date(project.startDate + "T00:00:00"), "MMM d, yyyy")}
                        </span>
                      </>
                    ) : (
                      <span className="text-slate-300 text-sm">—</span>
                    )}
                  </div>

                  {/* Code / PO */}
                  <div className="w-32 flex-shrink-0 hidden lg:block pr-2">
                    {project.poNumber ? (
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] text-brand-700 font-semibold bg-brand-50 px-2 py-1 rounded border border-brand-100 truncate max-w-full">
                        <FileText className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{project.poNumber}</span>
                      </span>
                    ) : project.code ? (
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-500 bg-slate-50 px-2 py-1 rounded border border-slate-100 truncate max-w-full">
                        <Hash className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{project.code}</span>
                      </span>
                    ) : (
                      <span className="text-slate-300 text-sm">—</span>
                    )}
                  </div>

                  {/* Arrow */}
                  <div className="w-8 flex-shrink-0 flex justify-end">
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-brand-500 transition-colors" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
