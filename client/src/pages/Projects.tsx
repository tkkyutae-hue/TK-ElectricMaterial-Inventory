import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useProjects, useCreateProject, useUpdateProject } from "@/hooks/use-reference-data";
import {
  Briefcase, MapPin, Calendar, ChevronRight, Search,
  ChevronDown, ChevronUp, Users, Check, Plus, X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import { format } from "date-fns";

// ─────────────────────────────────────────────────────────────────────────────
// Status config
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// Resizable column widths
// ─────────────────────────────────────────────────────────────────────────────
const LS_KEY = "tkelectric_project_col_widths";
const MIN_COL_WIDTH = 60;

type ColWidths = {
  po: number;
  name: number;
  customer: number;
  location: number;
  started: number;
  ended: number;
  status: number;
};

const DEFAULT_WIDTHS: ColWidths = {
  po: 128,
  name: 260,
  customer: 144,
  location: 152,
  started: 112,
  ended: 112,
  status: 128,
};

function loadWidths(): ColWidths {
  try {
    const s = localStorage.getItem(LS_KEY);
    if (s) return { ...DEFAULT_WIDTHS, ...JSON.parse(s) };
  } catch {}
  return { ...DEFAULT_WIDTHS };
}

// ─────────────────────────────────────────────────────────────────────────────
// Resize handle
// ─────────────────────────────────────────────────────────────────────────────
function ResizeHandle({
  col, currentWidth, setColWidths,
}: {
  col: keyof ColWidths;
  currentWidth: number;
  setColWidths: React.Dispatch<React.SetStateAction<ColWidths>>;
}) {
  const startX = useRef(0);
  const startW = useRef(0);

  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startX.current = e.clientX;
    startW.current = currentWidth;

    function onMove(ev: MouseEvent) {
      const delta = ev.clientX - startX.current;
      const newW  = Math.max(MIN_COL_WIDTH, startW.current + delta);
      setColWidths(prev => ({ ...prev, [col]: newW }));
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup",   onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup",   onUp);
  }

  return (
    <div
      className="absolute right-0 top-0 h-full w-3 cursor-col-resize flex items-center justify-center group/rh select-none z-10"
      onMouseDown={onMouseDown}
      title="Drag to resize"
    >
      <div className="w-px h-4 rounded-full bg-slate-200 group-hover/rh:bg-brand-400 transition-colors" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline Status Chip + Popover
// ─────────────────────────────────────────────────────────────────────────────
function StatusChip({
  projectId, status, onChangeStart, openPopoverId, setOpenPopoverId,
}: {
  projectId: number;
  status: string;
  onChangeStart: (id: number, newStatus: string) => void;
  openPopoverId: number | null;
  setOpenPopoverId: (id: number | null) => void;
}) {
  const cfg    = getStatusCfg(status);
  const isOpen = openPopoverId === projectId;
  const ref    = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function outside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpenPopoverId(null);
    }
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, [isOpen, setOpenPopoverId]);

  return (
    <div className="relative" ref={ref}>
      <button
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold border leading-none whitespace-nowrap transition-colors cursor-pointer ${cfg.chipClass}`}
        data-testid={`chip-status-${projectId}`}
        onClick={(e) => { e.stopPropagation(); setOpenPopoverId(isOpen ? null : projectId); }}
      >
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dotClass}`} />
        {cfg.label}
        <ChevronDown className="w-2.5 h-2.5 ml-0.5 opacity-60" />
      </button>
      {isOpen && (
        <div className="absolute z-50 top-full mt-1 right-0 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[140px]" onClick={(e) => e.stopPropagation()}>
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 transition-colors text-left"
              data-testid={`status-option-${opt.value}`}
              onClick={(e) => { e.stopPropagation(); setOpenPopoverId(null); if (opt.value !== status) onChangeStart(projectId, opt.value); }}
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

// ─────────────────────────────────────────────────────────────────────────────
// Inline Editable Cell
// ─────────────────────────────────────────────────────────────────────────────
type EditKey = { id: number; field: string } | null;

function EditableCell({
  projectId, field, value, type = "text",
  editKey, setEditKey, onSave, className = "",
}: {
  projectId: number;
  field: string;
  value: string | null | undefined;
  type?: "text" | "date";
  editKey: EditKey;
  setEditKey: (k: EditKey) => void;
  onSave: (id: number, field: string, value: string | null) => void;
  className?: string;
}) {
  const isEditing = editKey?.id === projectId && editKey?.field === field;
  const inputRef  = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(value ?? "");

  useEffect(() => {
    if (isEditing) {
      setDraft(value ?? "");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isEditing]);

  function commit() {
    const trimmed = draft.trim();
    onSave(projectId, field, trimmed === "" ? null : trimmed);
    setEditKey(null);
  }
  function cancel() { setDraft(value ?? ""); setEditKey(null); }

  function displayDate(d: string | null | undefined) {
    if (!d) return null;
    try { return format(new Date(d + "T00:00:00"), "MMM d, yyyy"); } catch { return d; }
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter")  { e.preventDefault(); commit(); }
          if (e.key === "Escape") { e.preventDefault(); cancel(); }
        }}
        className={`w-full bg-white border border-brand-300 rounded px-2 py-1 text-sm text-slate-900 outline-none ring-2 ring-brand-200 ${className}`}
        onClick={(e) => e.stopPropagation()}
        data-testid={`input-edit-${field}-${projectId}`}
      />
    );
  }

  const display = type === "date" ? displayDate(value) : (value || null);
  return (
    <div
      className={`cursor-text truncate rounded px-1 -mx-1 py-0.5 hover:bg-slate-100/80 transition-colors ${className}`}
      onClick={(e) => { e.stopPropagation(); setEditKey({ id: projectId, field }); }}
      data-testid={`cell-${field}-${projectId}`}
    >
      {display
        ? <span className="text-sm text-slate-700">{display}</span>
        : <span className="text-slate-300 text-sm select-none">—</span>
      }
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Column header label style
// ─────────────────────────────────────────────────────────────────────────────
const CH = "text-[10px] font-bold text-slate-400 uppercase tracking-widest";

// ─────────────────────────────────────────────────────────────────────────────
// Inline Add-Project Row
// ─────────────────────────────────────────────────────────────────────────────
function AddProjectRow({
  defaultCustomer, onCreate, onClose, cw,
}: {
  defaultCustomer: string;
  onCreate: (data: any) => void;
  onClose: () => void;
  cw: ColWidths;
}) {
  const [name,     setName]     = useState("");
  const [po,       setPo]       = useState("");
  const [customer, setCustomer] = useState(defaultCustomer);
  const [location, setLocation] = useState("");
  const [started,  setStarted]  = useState("");
  const [ended,    setEnded]    = useState("");
  const [status,   setStatus]   = useState("active");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => nameRef.current?.focus(), 0); }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") onClose();
    if (e.key === "Enter" && name.trim()) submit();
  }

  function submit() {
    if (!name.trim()) return;
    const code = `PRJ-${Date.now().toString(36).toUpperCase()}`;
    onCreate({
      name:         name.trim(),
      poNumber:     po.trim() || null,
      customerName: customer.trim() || null,
      jobLocation:  location.trim() || null,
      startDate:    started || null,
      endDate:      ended || null,
      status,
      code,
    });
  }

  const inputCls = "h-7 text-sm px-2 bg-white border-slate-200 focus:border-brand-400 focus:ring-1 focus:ring-brand-200 rounded w-full";

  return (
    <div className="flex items-center px-4 py-2 gap-2 bg-brand-50/40 border-t border-brand-100" onClick={(e) => e.stopPropagation()}>
      {/* PO */}
      <div className="flex-shrink-0 hidden lg:block" style={{ width: cw.po }}>
        <Input className={inputCls} placeholder="PO / Code" value={po} onChange={e => setPo(e.target.value)} onKeyDown={handleKeyDown} data-testid="add-row-po" />
      </div>
      {/* Name */}
      <div className="flex-shrink-0 min-w-0" style={{ width: cw.name }}>
        <Input ref={nameRef} className={inputCls} placeholder="Project name *" value={name} onChange={e => setName(e.target.value)} onKeyDown={handleKeyDown} data-testid="add-row-name" />
      </div>
      {/* Customer */}
      <div className="flex-shrink-0 hidden xl:block" style={{ width: cw.customer }}>
        <Input className={inputCls} placeholder="Customer" value={customer} onChange={e => setCustomer(e.target.value)} onKeyDown={handleKeyDown} data-testid="add-row-customer" />
      </div>
      {/* Location */}
      <div className="flex-shrink-0 hidden xl:block" style={{ width: cw.location }}>
        <Input className={inputCls} placeholder="Location" value={location} onChange={e => setLocation(e.target.value)} onKeyDown={handleKeyDown} data-testid="add-row-location" />
      </div>
      {/* Started */}
      <div className="flex-shrink-0 hidden xl:block" style={{ width: cw.started }}>
        <input type="date" className={inputCls} value={started} onChange={e => setStarted(e.target.value)} onKeyDown={handleKeyDown} data-testid="add-row-started" />
      </div>
      {/* Ended */}
      <div className="flex-shrink-0 hidden xl:block" style={{ width: cw.ended }}>
        <input type="date" className={inputCls} value={ended} onChange={e => setEnded(e.target.value)} onKeyDown={handleKeyDown} data-testid="add-row-ended" />
      </div>
      {/* Status */}
      <div className="flex-shrink-0" style={{ width: cw.status }}>
        <select
          className="h-7 text-[11px] font-bold rounded border border-slate-200 bg-white px-2 w-full focus:outline-none focus:border-brand-400"
          value={status}
          onChange={e => setStatus(e.target.value)}
          data-testid="add-row-status"
        >
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      {/* Actions — fixed 64px */}
      <div className="flex-shrink-0 flex items-center gap-1 justify-end" style={{ width: 64 }}>
        <button
          className="h-7 px-2.5 rounded bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold disabled:opacity-40 transition-colors"
          disabled={!name.trim()}
          onClick={submit}
          data-testid="add-row-save"
        >
          Add
        </button>
        <button className="h-7 w-7 flex items-center justify-center rounded hover:bg-slate-200 text-slate-400 transition-colors" onClick={onClose} data-testid="add-row-cancel">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Customer Group Section
// ─────────────────────────────────────────────────────────────────────────────
function CustomerGroup({
  customerName, projects, collapsed, onToggle,
  openPopoverId, setOpenPopoverId, onStatusChange, onFieldSave,
  editKey, setEditKey, onCreate,
  cw, setColWidths,
}: {
  customerName: string;
  projects: any[];
  collapsed: boolean;
  onToggle: () => void;
  openPopoverId: number | null;
  setOpenPopoverId: (id: number | null) => void;
  onStatusChange: (id: number, status: string) => void;
  onFieldSave: (id: number, field: string, value: string | null) => void;
  editKey: EditKey;
  setEditKey: (k: EditKey) => void;
  onCreate: (data: any) => void;
  cw: ColWidths;
  setColWidths: React.Dispatch<React.SetStateAction<ColWidths>>;
}) {
  const isNoCustomer = customerName === "__none__";
  const [showAdd, setShowAdd] = useState(false);

  function handleCreate(data: any) {
    onCreate(data);
    setShowAdd(false);
  }

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
        <span className="text-[11px] font-bold text-slate-400 bg-slate-200/60 px-2 py-0.5 rounded-full">{projects.length}</span>
        {collapsed
          ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
          : <ChevronUp   className="w-4 h-4 text-slate-400 flex-shrink-0" />
        }
      </button>

      {!collapsed && (
        <>
          {/* ── Column headers (desktop) ── */}
          <div className="hidden md:flex items-center px-4 py-2 border-b border-slate-100 bg-white/60 select-none overflow-x-auto">
            {/* PO / Code */}
            <div className="relative flex-shrink-0 pr-3 hidden lg:flex items-center" style={{ width: cw.po }}>
              <span className={CH}>PO / Code</span>
              <ResizeHandle col="po" currentWidth={cw.po} setColWidths={setColWidths} />
            </div>
            {/* Project Name */}
            <div className="relative flex-shrink-0 pr-4" style={{ width: cw.name }}>
              <span className={CH}>Project Name</span>
              <ResizeHandle col="name" currentWidth={cw.name} setColWidths={setColWidths} />
            </div>
            {/* Customer */}
            <div className="relative flex-shrink-0 pr-3 hidden xl:flex items-center" style={{ width: cw.customer }}>
              <span className={CH}>Customer</span>
              <ResizeHandle col="customer" currentWidth={cw.customer} setColWidths={setColWidths} />
            </div>
            {/* Location */}
            <div className="relative flex-shrink-0 pr-3 hidden xl:flex items-center" style={{ width: cw.location }}>
              <span className={CH}>Location</span>
              <ResizeHandle col="location" currentWidth={cw.location} setColWidths={setColWidths} />
            </div>
            {/* Started */}
            <div className="relative flex-shrink-0 pr-3 hidden xl:flex items-center" style={{ width: cw.started }}>
              <span className={CH}>Started</span>
              <ResizeHandle col="started" currentWidth={cw.started} setColWidths={setColWidths} />
            </div>
            {/* Ended */}
            <div className="relative flex-shrink-0 pr-3 hidden xl:flex items-center" style={{ width: cw.ended }}>
              <span className={CH}>Ended</span>
              <ResizeHandle col="ended" currentWidth={cw.ended} setColWidths={setColWidths} />
            </div>
            {/* Status */}
            <div className="relative flex-shrink-0" style={{ width: cw.status }}>
              <span className={CH}>Status</span>
              <ResizeHandle col="status" currentWidth={cw.status} setColWidths={setColWidths} />
            </div>
            {/* Open — fixed */}
            <div className="flex-shrink-0" style={{ width: 64 }} />
          </div>

          {/* ── Project rows ── */}
          <div className="divide-y divide-slate-50">
            {projects.map((project: any) => (
              <div
                key={project.id}
                className="flex items-center px-4 py-2.5 hover:bg-slate-50/50 transition-colors group"
                data-testid={`row-project-${project.id}`}
              >
                {/* PO / Code */}
                <div className="flex-shrink-0 pr-3 hidden lg:block" style={{ width: cw.po }}>
                  <EditableCell
                    projectId={project.id} field="poNumber" value={project.poNumber}
                    editKey={editKey} setEditKey={setEditKey} onSave={onFieldSave}
                  />
                </div>

                {/* Project Name */}
                <div className="flex-shrink-0 min-w-0 pr-4" style={{ width: cw.name }}>
                  <EditableCell
                    projectId={project.id} field="name" value={project.name}
                    editKey={editKey} setEditKey={setEditKey} onSave={onFieldSave}
                    className="font-semibold text-slate-900 group-hover:text-brand-700"
                  />
                  {project.ownerName && (
                    <p className="text-[11px] text-slate-400 truncate mt-0.5 pl-1">{project.ownerName}</p>
                  )}
                  {/* Mobile status */}
                  <div className="flex items-center gap-2 mt-1.5 md:hidden">
                    <StatusChip
                      projectId={project.id} status={project.status}
                      onChangeStart={onStatusChange} openPopoverId={openPopoverId} setOpenPopoverId={setOpenPopoverId}
                    />
                  </div>
                </div>

                {/* Customer */}
                <div className="flex-shrink-0 pr-3 hidden xl:block" style={{ width: cw.customer }}>
                  <EditableCell
                    projectId={project.id} field="customerName" value={project.customerName}
                    editKey={editKey} setEditKey={setEditKey} onSave={onFieldSave}
                  />
                </div>

                {/* Location */}
                <div className="flex-shrink-0 pr-3 hidden xl:flex items-center gap-1" style={{ width: cw.location }}>
                  {project.jobLocation ? <MapPin className="w-3 h-3 text-slate-300 flex-shrink-0 mt-0.5" /> : null}
                  <div className="flex-1 min-w-0">
                    <EditableCell
                      projectId={project.id} field="jobLocation" value={project.jobLocation}
                      editKey={editKey} setEditKey={setEditKey} onSave={onFieldSave}
                    />
                  </div>
                </div>

                {/* Started */}
                <div className="flex-shrink-0 pr-3 hidden xl:flex items-center gap-1" style={{ width: cw.started }}>
                  {project.startDate ? <Calendar className="w-3 h-3 text-slate-300 flex-shrink-0 mt-0.5" /> : null}
                  <div className="flex-1 min-w-0">
                    <EditableCell
                      projectId={project.id} field="startDate" value={project.startDate}
                      type="date" editKey={editKey} setEditKey={setEditKey} onSave={onFieldSave}
                    />
                  </div>
                </div>

                {/* Ended */}
                <div className="flex-shrink-0 pr-3 hidden xl:flex items-center gap-1" style={{ width: cw.ended }}>
                  {project.endDate ? <Calendar className="w-3 h-3 text-slate-300 flex-shrink-0 mt-0.5" /> : null}
                  <div className="flex-1 min-w-0">
                    <EditableCell
                      projectId={project.id} field="endDate" value={project.endDate}
                      type="date" editKey={editKey} setEditKey={setEditKey} onSave={onFieldSave}
                    />
                  </div>
                </div>

                {/* Status */}
                <div className="flex-shrink-0 hidden md:flex" style={{ width: cw.status }} onClick={(e) => e.stopPropagation()}>
                  <StatusChip
                    projectId={project.id} status={project.status}
                    onChangeStart={onStatusChange} openPopoverId={openPopoverId} setOpenPopoverId={setOpenPopoverId}
                  />
                </div>

                {/* Open — fixed */}
                <div className="flex-shrink-0 flex justify-end" style={{ width: 64 }}>
                  <Link href={`/projects/${project.id}`} onClick={(e) => e.stopPropagation()}>
                    <span
                      className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-brand-600 font-medium px-2 py-1 rounded hover:bg-brand-50 transition-colors"
                      data-testid={`link-open-project-${project.id}`}
                    >
                      Open <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Inline add row */}
          {showAdd ? (
            <AddProjectRow
              defaultCustomer={isNoCustomer ? "" : customerName}
              onCreate={handleCreate}
              onClose={() => setShowAdd(false)}
              cw={cw}
            />
          ) : (
            <button
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-400 hover:text-brand-600 hover:bg-brand-50/40 transition-colors border-t border-slate-50"
              onClick={() => setShowAdd(true)}
              data-testid={`btn-add-project-${customerName}`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="font-medium">Add project</span>
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function Projects() {
  const { data: projects, isLoading } = useProjects();
  const createMutation = useCreateProject();
  const updateMutation = useUpdateProject();

  const [statusFilter,    setStatusFilter]    = useState("all");
  const [search,          setSearch]          = useState("");
  const [openPopoverId,   setOpenPopoverId]   = useState<number | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [editKey,         setEditKey]         = useState<EditKey>(null);
  const [colWidths,       setColWidths]       = useState<ColWidths>(loadWidths);

  // Persist column widths to localStorage whenever they change
  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(colWidths)); } catch {}
  }, [colWidths]);

  const allProjects: any[] = projects ?? [];

  // Filter
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

  // Group by customer
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

  const handleStatusChange = useCallback((id: number, newStatus: string) => {
    updateMutation.mutate({ id, status: newStatus });
  }, [updateMutation]);

  const handleFieldSave = useCallback((id: number, field: string, value: string | null) => {
    updateMutation.mutate({ id, [field]: value });
  }, [updateMutation]);

  const handleCreate = useCallback((data: any) => {
    createMutation.mutate(data);
  }, [createMutation]);

  return (
    <div className="space-y-5">

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3">
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
      </div>

      {/* Clear filters */}
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
                <div key={r} className="px-4 py-3 border-b border-slate-50 flex items-center gap-4">
                  <div className="h-4 flex-1 bg-slate-100 rounded animate-pulse" />
                  <div className="h-5 w-20 bg-slate-100 rounded-md animate-pulse hidden md:block" />
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
              : <p className="text-sm text-slate-500 mt-1">Projects will appear here grouped by customer.</p>
          }
          {(search || statusFilter !== "all") && (
            <button className="mt-3 text-sm text-brand-600 hover:text-brand-800 font-medium transition-colors" onClick={() => { setSearch(""); setStatusFilter("all"); }}>
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
              onFieldSave={handleFieldSave}
              editKey={editKey}
              setEditKey={setEditKey}
              onCreate={handleCreate}
              cw={colWidths}
              setColWidths={setColWidths}
            />
          ))}
        </div>
      )}
    </div>
  );
}
