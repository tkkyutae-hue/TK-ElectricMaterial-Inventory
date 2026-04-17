import { useState, useMemo, useEffect, useRef } from "react";
import { useProjects, useCreateProject, useUpdateProject } from "@/hooks/use-reference-data";
import {
  Briefcase, MapPin, Plus, Calendar, ChevronRight, Search,
  FileText, Hash, ChevronDown, ChevronUp, Users, Check,
} from "lucide-react";
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

// ── Status config ────────────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { value: "active",    label: "Active",    dotClass: "bg-emerald-500", chipClass: "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200" },
  { value: "on_hold",   label: "On Hold",   dotClass: "bg-amber-500",   chipClass: "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200" },
  { value: "completed", label: "Completed", dotClass: "bg-slate-400",   chipClass: "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200" },
  { value: "cancelled", label: "Cancelled", dotClass: "bg-rose-500",    chipClass: "bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-200" },
];
const statusMap = Object.fromEntries(STATUS_OPTIONS.map(s => [s.value, s]));

function getStatusCfg(status: string) {
  return statusMap[status] ?? { label: status, dotClass: "bg-slate-400", chipClass: "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200" };
}

// ── Inline status chip + popover ─────────────────────────────────────────────
function StatusChip({
  projectId, status, onChangeStart, openPopoverId, setOpenPopoverId,
}: {
  projectId: number;
  status: string;
  onChangeStart: (id: number, newStatus: string) => void;
  openPopoverId: number | null;
  setOpenPopoverId: (id: number | null) => void;
}) {
  const cfg = getStatusCfg(status);
  const isOpen = openPopoverId === projectId;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpenPopoverId(null);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [isOpen, setOpenPopoverId]);

  return (
    <div className="relative" ref={ref}>
      <button
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold border leading-none whitespace-nowrap transition-colors cursor-pointer ${cfg.chipClass}`}
        data-testid={`chip-status-${projectId}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpenPopoverId(isOpen ? null : projectId);
        }}
      >
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dotClass}`} />
        {cfg.label}
        <ChevronDown className="w-2.5 h-2.5 ml-0.5 opacity-60" />
      </button>

      {isOpen && (
        <div
          className="absolute z-50 top-full mt-1 right-0 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[140px]"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
        >
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 transition-colors text-left"
              data-testid={`status-option-${opt.value}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpenPopoverId(null);
                if (opt.value !== status) onChangeStart(projectId, opt.value);
              }}
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${opt.dotClass}`} />
              <span className="flex-1 font-medium text-slate-700">{opt.label}</span>
              {opt.value === status && <Check className="w-3.5 h-3.5 text-brand-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Column header label ──────────────────────────────────────────────────────
const CH = "text-[10px] font-bold text-slate-400 uppercase tracking-widest";

// ── Date formatter ───────────────────────────────────────────────────────────
function fmtDate(d: string | null | undefined) {
  if (!d) return null;
  try { return format(new Date(d + "T00:00:00"), "MMM d, yyyy"); } catch { return null; }
}

// ── Customer group section ───────────────────────────────────────────────────
function CustomerGroup({
  customerName, projects, collapsed, onToggle,
  openPopoverId, setOpenPopoverId, onStatusChange,
}: {
  customerName: string;
  projects: any[];
  collapsed: boolean;
  onToggle: () => void;
  openPopoverId: number | null;
  setOpenPopoverId: (id: number | null) => void;
  onStatusChange: (id: number, status: string) => void;
}) {
  const isNoCustomer = customerName === "__none__";

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Group header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50/80 hover:bg-slate-100/60 transition-colors border-b border-slate-100 text-left"
        onClick={onToggle}
        data-testid={`group-header-${customerName}`}
      >
        <Users className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
        <span className="font-semibold text-sm text-slate-700 flex-1 truncate">
          {isNoCustomer ? "No Customer" : customerName}
        </span>
        <span className="text-[11px] font-bold text-slate-400 bg-slate-200/60 px-2 py-0.5 rounded-full">
          {projects.length}
        </span>
        {collapsed
          ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
          : <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
        }
      </button>

      {!collapsed && (
        <>
          {/* Column headers */}
          <div className="hidden md:flex items-center px-4 py-2 border-b border-slate-100 bg-white/60 select-none">
            <div className="w-32 flex-shrink-0 pr-3 hidden lg:block"><span className={CH}>PO / Code</span></div>
            <div className="flex-1 min-w-0 pr-4"><span className={CH}>Project Name</span></div>
            <div className="w-44 flex-shrink-0 pr-3 hidden xl:block"><span className={CH}>Location</span></div>
            <div className="w-28 flex-shrink-0 pr-3 hidden xl:block"><span className={CH}>Started</span></div>
            <div className="w-28 flex-shrink-0 pr-3 hidden xl:block"><span className={CH}>Ended</span></div>
            <div className="w-32 flex-shrink-0"><span className={CH}>Status</span></div>
            <div className="w-8 flex-shrink-0" />
          </div>

          {/* Project rows */}
          <div className="divide-y divide-slate-50">
            {projects.map((project: any) => {
              const startFmt = fmtDate(project.startDate);
              const endFmt   = fmtDate(project.endDate);

              return (
                <Link key={project.id} href={`/projects/${project.id}`}>
                  <div
                    className="flex items-center px-4 py-3 hover:bg-slate-50/70 cursor-pointer transition-colors group"
                    data-testid={`row-project-${project.id}`}
                  >
                    {/* PO / Code */}
                    <div className="w-32 flex-shrink-0 pr-3 hidden lg:flex items-center">
                      {project.poNumber ? (
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-brand-700 font-semibold bg-brand-50 px-2 py-1 rounded border border-brand-100 max-w-full truncate">
                          <FileText className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{project.poNumber}</span>
                        </span>
                      ) : project.code ? (
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-100 max-w-full truncate">
                          <Hash className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{project.code}</span>
                        </span>
                      ) : (
                        <span className="text-slate-300 text-sm">—</span>
                      )}
                    </div>

                    {/* Project name + owner */}
                    <div className="flex-1 min-w-0 pr-4">
                      <p
                        className="font-semibold text-slate-900 text-sm truncate leading-snug group-hover:text-brand-700 transition-colors"
                        data-testid={`text-project-name-${project.id}`}
                      >
                        {project.name}
                      </p>
                      {project.ownerName && (
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{project.ownerName}</p>
                      )}
                      {/* Mobile: show status + code inline */}
                      <div className="flex items-center gap-2 mt-1.5 md:hidden flex-wrap">
                        <StatusChip
                          projectId={project.id}
                          status={project.status}
                          onChangeStart={onStatusChange}
                          openPopoverId={openPopoverId}
                          setOpenPopoverId={setOpenPopoverId}
                        />
                        {project.poNumber && (
                          <span className="font-mono text-[10px] text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded border border-brand-100">
                            {project.poNumber}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Location */}
                    <div className="w-44 flex-shrink-0 pr-3 hidden xl:flex items-center gap-1.5">
                      {project.jobLocation ? (
                        <>
                          <MapPin className="w-3 h-3 text-slate-300 flex-shrink-0" />
                          <span className="text-sm text-slate-600 truncate" data-testid={`text-project-location-${project.id}`}>
                            {project.jobLocation}
                          </span>
                        </>
                      ) : <span className="text-slate-300 text-sm">—</span>}
                    </div>

                    {/* Started */}
                    <div className="w-28 flex-shrink-0 pr-3 hidden xl:flex items-center gap-1.5">
                      {startFmt ? (
                        <>
                          <Calendar className="w-3 h-3 text-slate-300 flex-shrink-0" />
                          <span className="text-sm text-slate-600 whitespace-nowrap">{startFmt}</span>
                        </>
                      ) : <span className="text-slate-300 text-sm">—</span>}
                    </div>

                    {/* Ended */}
                    <div className="w-28 flex-shrink-0 pr-3 hidden xl:flex items-center gap-1.5">
                      {endFmt ? (
                        <>
                          <Calendar className="w-3 h-3 text-slate-300 flex-shrink-0" />
                          <span className="text-sm text-slate-600 whitespace-nowrap">{endFmt}</span>
                        </>
                      ) : <span className="text-slate-300 text-sm">—</span>}
                    </div>

                    {/* Status chip (desktop, interactive) */}
                    <div
                      className="w-32 flex-shrink-0 hidden md:flex"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    >
                      <StatusChip
                        projectId={project.id}
                        status={project.status}
                        onChangeStart={onStatusChange}
                        openPopoverId={openPopoverId}
                        setOpenPopoverId={setOpenPopoverId}
                      />
                    </div>

                    {/* Arrow */}
                    <div className="w-8 flex-shrink-0 flex justify-end">
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-brand-500 transition-colors" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function Projects() {
  const { data: projects, isLoading } = useProjects();
  const createMutation  = useCreateProject();
  const updateMutation  = useUpdateProject();

  const [dialogOpen,      setDialogOpen]      = useState(false);
  const [statusFilter,    setStatusFilter]    = useState("all");
  const [search,          setSearch]          = useState("");
  const [openPopoverId,   setOpenPopoverId]   = useState<number | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const allProjects: any[] = projects ?? [];
  const customerSuggestions = [...new Set(allProjects.map((p: any) => p.customerName).filter(Boolean))] as string[];
  const ownerSuggestions    = [...new Set(allProjects.map((p: any) => p.ownerName).filter(Boolean))] as string[];
  const locationSuggestions = [...new Set(allProjects.map((p: any) => p.jobLocation).filter(Boolean))] as string[];

  const form = useForm({
    defaultValues: { name: "", customerName: "", ownerName: "", jobLocation: "", poNumber: "", status: "active", notes: "" },
  });

  // ── Filter ──────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => allProjects.filter((p: any) => {
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    if (!search.trim()) return matchStatus;
    const q = search.toLowerCase();
    return matchStatus && (
      p.name?.toLowerCase().includes(q) ||
      p.customerName?.toLowerCase().includes(q) ||
      p.ownerName?.toLowerCase().includes(q) ||
      p.jobLocation?.toLowerCase().includes(q) ||
      p.poNumber?.toLowerCase().includes(q) ||
      p.status?.toLowerCase().includes(q)
    );
  }), [allProjects, statusFilter, search]);

  // ── Group by customer ───────────────────────────────────────────────────────
  const groups = useMemo(() => {
    const map = new Map<string, any[]>();
    filtered.forEach((p: any) => {
      const key = p.customerName?.trim() || "__none__";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    });
    return [...map.entries()].sort(([a], [b]) => {
      if (a === "__none__") return 1;
      if (b === "__none__") return -1;
      return a.localeCompare(b);
    });
  }, [filtered]);

  function toggleGroup(key: string) {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  // ── Inline status update ────────────────────────────────────────────────────
  function handleStatusChange(id: number, newStatus: string) {
    updateMutation.mutate({ id, status: newStatus });
  }

  // ── Create project ──────────────────────────────────────────────────────────
  function onSubmit(data: any) {
    const code = `PRJ-${Date.now().toString(36).toUpperCase()}`;
    const clean: any = { ...data, code };
    ["customerName", "ownerName", "jobLocation", "poNumber", "notes"].forEach(f => {
      if (clean[f] === "") clean[f] = null;
    });
    createMutation.mutate(clean, {
      onSuccess: () => { setDialogOpen(false); form.reset(); },
    });
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── One-row toolbar ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Title + count */}
        <div className="flex items-baseline gap-2 mr-1">
          <h1 className="text-2xl font-display font-bold text-slate-900 leading-none">Projects</h1>
          {!isLoading && allProjects.length > 0 && (
            <span className="text-sm font-medium text-slate-400" data-testid="text-project-count">
              {filtered.length === allProjects.length
                ? `${allProjects.length}`
                : `${filtered.length} / ${allProjects.length}`}
            </span>
          )}
        </div>

        {/* Search — flex-1 */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <Input
            placeholder="Search projects, customer, PO…"
            className="pl-9 bg-white border-slate-200 h-9 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-project-search"
          />
        </div>

        {/* Status filter */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[138px] bg-white h-9 text-sm" data-testid="select-status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        {/* New Project */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              className="bg-brand-700 hover:bg-brand-800 text-white shadow-sm shadow-brand-700/20 h-9 text-sm shrink-0"
              data-testid="btn-new-project"
            >
              <Plus className="w-4 h-4 mr-1.5" />New Project
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

      {/* ── Clear filters strip ── */}
      {!isLoading && (search || statusFilter !== "all") && (
        <div className="flex items-center gap-2 text-sm text-slate-500 -mt-1">
          <span>
            {filtered.length === allProjects.length
              ? `${allProjects.length} project${allProjects.length !== 1 ? "s" : ""}`
              : `${filtered.length} of ${allProjects.length} matching`}
          </span>
          <button
            className="text-brand-600 hover:text-brand-800 font-medium text-xs transition-colors"
            onClick={() => { setSearch(""); setStatusFilter("all"); }}
            data-testid="btn-clear-filters"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* ── Board ── */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map(g => (
            <div key={g} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center gap-3">
                <div className="h-3 w-32 bg-slate-200 rounded animate-pulse" />
                <div className="h-3 w-6 bg-slate-200 rounded-full animate-pulse" />
              </div>
              {[1, 2, 3].map(r => (
                <div key={r} className="px-4 py-3.5 border-b border-slate-50 flex items-center gap-4">
                  <div className="h-4 flex-1 bg-slate-100 rounded animate-pulse" />
                  <div className="h-5 w-20 bg-slate-100 rounded-md animate-pulse hidden md:block" />
                  <div className="h-3 w-28 bg-slate-100 rounded animate-pulse hidden xl:block" />
                </div>
              ))}
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
        <div className="space-y-3">
          {groups.map(([customerKey, groupProjects]) => (
            <CustomerGroup
              key={customerKey}
              customerName={customerKey}
              projects={groupProjects}
              collapsed={collapsedGroups.has(customerKey)}
              onToggle={() => toggleGroup(customerKey)}
              openPopoverId={openPopoverId}
              setOpenPopoverId={setOpenPopoverId}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
