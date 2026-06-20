import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useProjects, useCreateProject, useUpdateProject, useDeleteProject } from "@/hooks/use-reference-data";
import { useAuth } from "@/hooks/use-auth";
import {
  Briefcase, MapPin, Calendar, ChevronRight, Search,
  ChevronDown, ChevronUp, Users, Check, Plus, X,
  ArrowUp, ArrowDown, ChevronsUpDown, UserPlus, Trash2, ExternalLink,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Link } from "wouter";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";

// ─────────────────────────────────────────────────────────────────────────────
// Monday.com status color palette
// ─────────────────────────────────────────────────────────────────────────────
const MONDAY_STATUS_BG: Record<string, string> = {
  active:    "#00C875",
  on_hold:   "#FDBC64",
  completed: "#C4C4C4",
  cancelled: "#E2445C",
};
const MONDAY_STATUS_TEXT: Record<string, string> = {
  on_hold: "#1a1a1a",  // dark text on yellow
};

// ─────────────────────────────────────────────────────────────────────────────
// Group accent color palette (deterministic hash)
// ─────────────────────────────────────────────────────────────────────────────
const GROUP_PALETTE = [
  "#0073EA","#00C875","#A25DDC","#FDBC64","#FF7575",
  "#579BFC","#9CD326","#FF9F43","#FF3D57","#7E5CB5",
];
function groupAccentColor(name: string): string {
  if (!name || name === "__none__") return "#C4C4C4";
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h * 31) + name.charCodeAt(i)) | 0;
  return GROUP_PALETTE[Math.abs(h) % GROUP_PALETTE.length];
}

// ─────────────────────────────────────────────────────────────────────────────
// Status config (kept for label lookups)
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_OPTIONS_BASE = [
  { value: "active",    dotClass: "bg-emerald-500", chipClass: "" },
  { value: "on_hold",   dotClass: "bg-amber-400",   chipClass: "" },
  { value: "completed", dotClass: "bg-slate-400",   chipClass: "" },
  { value: "cancelled", dotClass: "bg-rose-500",    chipClass: "" },
];
const STATUS_ORDER: Record<string, number> = { active: 0, on_hold: 1, completed: 2, cancelled: 3 };
function statusLabelOf(value: string, t: any): string {
  switch (value) {
    case "active":    return t.projStatusActive;
    case "on_hold":   return t.projStatusOnHold;
    case "completed": return t.projStatusCompleted;
    case "cancelled": return t.projStatusCancelled;
    default:          return value;
  }
}
function getStatusCfg(s: string, t: any) {
  const base = STATUS_OPTIONS_BASE.find(o => o.value === s);
  return base
    ? { ...base, label: statusLabelOf(base.value, t) }
    : { value: s, label: s, dotClass: "bg-slate-400", chipClass: "" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Resizable column widths
// ─────────────────────────────────────────────────────────────────────────────
const LS_COL  = "tkelectric_project_col_widths_v2";
const MIN_COL = 60;

type ColWidths = { po: number; name: number; customer: number; location: number; timeline: number; status: number };
const DEFAULT_WIDTHS: ColWidths = { po: 128, name: 260, customer: 144, location: 152, timeline: 200, status: 128 };

function loadWidths(): ColWidths {
  try { const s = localStorage.getItem(LS_COL); if (s) return { ...DEFAULT_WIDTHS, ...JSON.parse(s) }; } catch {}
  return { ...DEFAULT_WIDTHS };
}

function ResizeHandle({ col, cw, setColWidths }: { col: keyof ColWidths; cw: ColWidths; setColWidths: React.Dispatch<React.SetStateAction<ColWidths>> }) {
  const startX = useRef(0), startW = useRef(0);
  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    startX.current = e.clientX; startW.current = cw[col];
    function onMove(ev: MouseEvent) { setColWidths(p => ({ ...p, [col]: Math.max(MIN_COL, startW.current + ev.clientX - startX.current) })); }
    function onUp()  { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); }
    document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp);
  }
  return (
    <div className="absolute right-0 top-0 h-full w-3 cursor-col-resize flex items-center justify-center group/rh select-none z-10" onMouseDown={onMouseDown} title="Drag to resize">
      <div className="w-px h-4 rounded-full bg-slate-300 group-hover/rh:bg-brand-400 transition-colors" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sort
// ─────────────────────────────────────────────────────────────────────────────
type SortCol = "po" | "name" | "customer" | "location" | "timeline" | "status";
type SortDir = "asc" | "desc" | null;
type SortState = { col: SortCol | null; dir: SortDir };

function cmpProjects(a: any, b: any, col: SortCol, dir: SortDir): number {
  let av: any = "", bv: any = "";
  if (col === "po")       { av = a.poNumber || ""; bv = b.poNumber || ""; }
  if (col === "name")     { av = a.name || ""; bv = b.name || ""; }
  if (col === "customer") { av = a.customerName || ""; bv = b.customerName || ""; }
  if (col === "location") { av = a.jobLocation || ""; bv = b.jobLocation || ""; }
  if (col === "status")   { av = STATUS_ORDER[a.status] ?? 99; bv = STATUS_ORDER[b.status] ?? 99; }
  if (col === "timeline") {
    av = a.startDate || "9999"; bv = b.startDate || "9999";
    if (av === bv) { av = a.endDate || "9999"; bv = b.endDate || "9999"; }
  }
  const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
  return dir === "asc" ? cmp : -cmp;
}

function SortIcon({ col, ss }: { col: SortCol; ss: SortState }) {
  const cls = "w-3 h-3 flex-shrink-0";
  if (ss.col !== col) return <ChevronsUpDown className={`${cls} text-slate-400 group-hover/hdr:text-slate-600 transition-colors`} />;
  if (ss.dir === "asc")  return <ArrowUp   className={`${cls} text-brand-500`} />;
  return <ArrowDown className={`${cls} text-brand-500`} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Monday-style full-cell Status (replaces pill StatusChip)
// ─────────────────────────────────────────────────────────────────────────────
function MondayStatusCell({ projectId, status, onChangeStart, openPopoverId, setOpenPopoverId }: {
  projectId: number; status: string;
  onChangeStart: (id: number, s: string) => void;
  openPopoverId: number | null; setOpenPopoverId: (id: number | null) => void;
}) {
  const { t } = useLanguage();
  const cfg = getStatusCfg(status, t);
  const isOpen = openPopoverId === projectId;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function out(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpenPopoverId(null); }
    document.addEventListener("mousedown", out);
    return () => document.removeEventListener("mousedown", out);
  }, [isOpen, setOpenPopoverId]);

  const bg   = MONDAY_STATUS_BG[status]   ?? "#C4C4C4";
  const text = MONDAY_STATUS_TEXT[status] ?? "#ffffff";

  return (
    <div className="relative h-full w-full" ref={ref}>
      <button
        className="w-full h-full flex items-center justify-center text-[11px] font-bold cursor-pointer transition-opacity hover:opacity-85 select-none"
        style={{ backgroundColor: bg, color: text }}
        data-testid={`chip-status-${projectId}`}
        onClick={(e) => { e.stopPropagation(); setOpenPopoverId(isOpen ? null : projectId); }}
      >
        {cfg.label}
      </button>
      {isOpen && (
        <div className="absolute z-[200] top-full mt-1 right-0 bg-white border border-slate-200 rounded-lg shadow-xl py-1 min-w-[148px]" onClick={(e) => e.stopPropagation()}>
          {STATUS_OPTIONS_BASE.map(opt => (
            <button key={opt.value} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 transition-colors text-left"
              data-testid={`status-option-${opt.value}`}
              onClick={(e) => { e.stopPropagation(); setOpenPopoverId(null); if (opt.value !== status) onChangeStart(projectId, opt.value); }}
            >
              <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: MONDAY_STATUS_BG[opt.value] ?? "#C4C4C4" }} />
              <span className="flex-1 font-medium text-slate-700">{statusLabelOf(opt.value, t)}</span>
              {opt.value === status && <Check className="w-3.5 h-3.5 text-brand-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Compact suggestion input
// ─────────────────────────────────────────────────────────────────────────────
function CompactSuggestion({ value, onChange, suggestions, placeholder, testId, className = "" }: {
  value: string; onChange: (v: string) => void; suggestions: string[];
  placeholder?: string; testId?: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const filtered = suggestions.filter(s => s.toLowerCase().includes(value.toLowerCase()) && s.toLowerCase() !== value.toLowerCase()).slice(0, 8);

  useEffect(() => {
    if (!open) return;
    function out(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", out);
    return () => document.removeEventListener("mousedown", out);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <input
        className={`w-full text-sm px-2 bg-white border border-slate-200 rounded focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-200 ${className}`}
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
        placeholder={placeholder}
        autoComplete="off"
        data-testid={testId}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-[150] top-full left-0 right-0 mt-0.5 bg-white border border-slate-200 rounded shadow-lg max-h-40 overflow-y-auto">
          {filtered.map(s => (
            <button key={s} type="button" className="w-full text-left px-2 py-1.5 text-sm text-slate-700 hover:bg-brand-50 hover:text-brand-700 transition-colors"
              onMouseDown={() => { onChange(s); setOpen(false); }}>
              {s}
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

function EditableCell({ projectId, field, value, type = "text", editKey, setEditKey, onSave, className = "", valueClassName, suggestions }: {
  projectId: number; field: string; value: string | null | undefined;
  type?: "text" | "date"; editKey: EditKey; setEditKey: (k: EditKey) => void;
  onSave: (id: number, field: string, value: string | null) => void;
  className?: string; valueClassName?: string; suggestions?: string[];
}) {
  const isEditing = editKey?.id === projectId && editKey?.field === field;
  const inputRef  = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(value ?? "");

  useEffect(() => {
    if (isEditing) { setDraft(value ?? ""); setTimeout(() => inputRef.current?.focus(), 0); }
  }, [isEditing]);

  function commit() { const t = draft.trim(); onSave(projectId, field, t === "" ? null : t); setEditKey(null); }
  function cancel() { setDraft(value ?? ""); setEditKey(null); }

  function displayDate(d: string | null | undefined) {
    if (!d) return null;
    try { return format(new Date(d + "T00:00:00"), "MMM d, yyyy"); } catch { return d; }
  }

  if (isEditing) {
    const inputCls = `w-full bg-white border border-brand-300 rounded px-2 py-1 text-sm text-slate-900 outline-none ring-2 ring-brand-200 ${className}`;
    if (suggestions && suggestions.length > 0 && type === "text") {
      return (
        <CompactSuggestion
          value={draft}
          onChange={setDraft}
          suggestions={suggestions}
          className="h-7 py-1 border-brand-300 ring-2 ring-brand-200"
        />
      );
    }
    return (
      <input ref={inputRef} type={type} value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commit(); } if (e.key === "Escape") { e.preventDefault(); cancel(); } }}
        className={inputCls}
        onClick={e => e.stopPropagation()}
        data-testid={`input-edit-${field}-${projectId}`}
      />
    );
  }

  const display = type === "date" ? displayDate(value) : (value || null);
  const valCls  = valueClassName ?? "text-sm text-slate-700";
  const mtdCls  = valueClassName ?? "text-slate-300 text-sm";
  return (
    <div className={`cursor-text truncate rounded px-1 -mx-1 py-0.5 hover:bg-slate-100/80 transition-colors ${className}`}
      onClick={e => { e.stopPropagation(); setEditKey({ id: projectId, field }); }}
      data-testid={`cell-${field}-${projectId}`}
    >
      {display ? <span className={valCls}>{display}</span> : <span className={`${mtdCls} select-none`}>—</span>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Timeline Cell
// ─────────────────────────────────────────────────────────────────────────────
function TimelineCell({ projectId, startDate, endDate, onTimelineSave }: {
  projectId: number; startDate: string | null | undefined; endDate: string | null | undefined;
  onTimelineSave: (id: number, start: string | null, end: string | null) => void;
}) {
  const { t: tt } = useLanguage();
  const [open, setOpen] = useState(false);
  const [ds, setDs] = useState(startDate ?? "");
  const [de, setDe] = useState(endDate ?? "");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setDs(startDate ?? ""); setDe(endDate ?? "");
    function out(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", out);
    return () => document.removeEventListener("mousedown", out);
  }, [open]);

  function save() { onTimelineSave(projectId, ds || null, de || null); setOpen(false); }

  function fmtShort(d: string | null | undefined) {
    if (!d) return "—";
    try { return format(new Date(d + "T00:00:00"), "MMM d"); } catch { return d; }
  }

  const isEmpty = !startDate && !endDate;
  const dateCls = "w-full h-7 text-sm px-2 border border-slate-200 rounded focus:outline-none focus:border-brand-400 bg-white";

  return (
    <div className="relative" ref={ref}>
      <div
        className="cursor-text truncate rounded px-1 -mx-1 py-0.5 hover:bg-slate-100/80 transition-colors flex items-center gap-1"
        onClick={e => { e.stopPropagation(); setOpen(true); }}
        data-testid={`cell-timeline-${projectId}`}
      >
        {isEmpty
          ? <span className="text-slate-300 text-sm select-none">—</span>
          : <>
              <Calendar className="w-3 h-3 text-slate-300 flex-shrink-0" />
              <span className="text-sm text-slate-700 truncate">{fmtShort(startDate)} – {fmtShort(endDate)}</span>
            </>
        }
      </div>

      {open && (
        <div className="absolute z-[200] top-full mt-1 left-0 bg-white border border-slate-200 rounded-lg shadow-xl p-3 min-w-[268px]" onClick={e => e.stopPropagation()}>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">{tt.projTimelineLabel}</p>
          <div className="flex items-end gap-2 mb-3">
            <div className="flex-1">
              <label className="text-[10px] text-slate-400 font-medium block mb-1">{tt.projTimelineStart}</label>
              <input type="date" className={dateCls} value={ds} onChange={e => setDs(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setOpen(false); }} />
            </div>
            <span className="text-slate-400 text-sm pb-1.5">–</span>
            <div className="flex-1">
              <label className="text-[10px] text-slate-400 font-medium block mb-1">{tt.projTimelineEnd}</label>
              <input type="date" className={dateCls} value={de} onChange={e => setDe(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setOpen(false); }} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button className="h-6 px-3 text-xs rounded border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors" onClick={() => setOpen(false)}>{tt.projTimelineCancelBtn}</button>
            <button className="h-6 px-3 text-xs rounded bg-brand-600 hover:bg-brand-700 text-white font-semibold transition-colors" onClick={save} data-testid={`btn-save-timeline-${projectId}`}>{tt.projTimelineSaveBtn}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sortable column header cell
// ─────────────────────────────────────────────────────────────────────────────
const CH = "text-[10px] font-bold text-slate-500 uppercase tracking-widest";

function SortableHeader({ label, col, ss, onSort, cw, cwKey, setColWidths, className = "" }: {
  label: string; col: SortCol; ss: SortState; onSort: (c: SortCol) => void;
  cw: ColWidths; cwKey: keyof ColWidths; setColWidths: React.Dispatch<React.SetStateAction<ColWidths>>;
  className?: string;
}) {
  return (
    <div
      className={`relative flex-shrink-0 flex items-center gap-1 cursor-pointer group/hdr select-none pr-3 border-r border-slate-200 last:border-r-0 ${className}`}
      style={{ width: cw[cwKey] }}
      onClick={() => onSort(col)}
    >
      <span className={CH}>{label}</span>
      <SortIcon col={col} ss={ss} />
      <ResizeHandle col={cwKey} cw={cw} setColWidths={setColWidths} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline Add-Project Row (Monday style)
// ─────────────────────────────────────────────────────────────────────────────
function AddProjectRow({ defaultCustomer, onCreate, onClose, cw, customerSuggestions, locationSuggestions, accentColor }: {
  defaultCustomer: string; onCreate: (data: any) => void; onClose: () => void;
  cw: ColWidths; customerSuggestions: string[]; locationSuggestions: string[];
  accentColor: string;
}) {
  const { t } = useLanguage();
  const [name, setName]     = useState("");
  const [po,   setPo]       = useState("");
  const [cust, setCust]     = useState(defaultCustomer);
  const [loc,  setLoc]      = useState("");
  const [stat,  setStat]    = useState("active");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => nameRef.current?.focus(), 0); }, []);

  function kd(e: React.KeyboardEvent) { if (e.key === "Escape") onClose(); if (e.key === "Enter" && name.trim()) submit(); }

  function submit() {
    if (!name.trim()) return;
    onCreate({ name: name.trim(), poNumber: po.trim()||null, customerName: cust.trim()||null, jobLocation: loc.trim()||null, startDate: null, endDate: null, status: stat, code: `PRJ-${Date.now().toString(36).toUpperCase()}` });
  }

  const inputCls = "h-7 text-sm px-2 bg-white border border-slate-200 rounded focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-200 w-full";

  return (
    <div
      className="flex items-center py-1.5 gap-0 bg-[#F0F8FF] border-t border-slate-200"
      style={{ borderLeft: `4px solid ${accentColor}` }}
      onClick={e => e.stopPropagation()}
    >
      {/* chevron spacer */}
      <div className="w-8 flex-shrink-0" />

      <div className="flex items-center gap-2 flex-1 px-2">
        <div className="flex-shrink-0 hidden lg:block" style={{ width: cw.po }}>
          <input className={inputCls} placeholder={t.projAddRowPoPh} value={po} onChange={e => setPo(e.target.value)} onKeyDown={kd} data-testid="add-row-po" />
        </div>
        <div className="flex-shrink-0 min-w-0" style={{ width: cw.name }}>
          <input ref={nameRef} className={inputCls} placeholder={t.projAddRowNamePh} value={name} onChange={e => setName(e.target.value)} onKeyDown={kd} data-testid="add-row-name" />
        </div>
        <div className="flex-shrink-0 hidden xl:block" style={{ width: cw.customer }}>
          <CompactSuggestion value={cust} onChange={setCust} suggestions={customerSuggestions} placeholder={t.projAddRowCustomerPh} testId="add-row-customer" className="h-7" />
        </div>
        <div className="flex-shrink-0 hidden xl:block" style={{ width: cw.location }}>
          <CompactSuggestion value={loc} onChange={setLoc} suggestions={locationSuggestions} placeholder={t.projAddRowLocationPh} testId="add-row-location" className="h-7" />
        </div>
        <div className="flex-shrink-0 hidden xl:block" style={{ width: cw.timeline }} />
        <div className="flex-shrink-0" style={{ width: cw.status }}>
          <select className="h-7 text-[11px] font-bold rounded border border-slate-200 bg-white px-2 w-full focus:outline-none focus:border-brand-400"
            value={stat} onChange={e => setStat(e.target.value)} data-testid="add-row-status">
            {STATUS_OPTIONS_BASE.map(o => <option key={o.value} value={o.value}>{statusLabelOf(o.value, t)}</option>)}
          </select>
        </div>
        <div className="flex-shrink-0 flex items-center gap-1 justify-end" style={{ width: 88 }}>
          <button type="button" onClick={submit} disabled={!name.trim()}
            className="h-7 px-3 text-xs bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white font-semibold rounded transition-colors"
            data-testid="add-row-save">{t.projAddRowAddBtn}</button>
          <button type="button" onClick={onClose}
            className="h-7 w-7 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100 transition-colors"
            data-testid="add-row-cancel"><X className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Customer Group Section (Monday flat-table style)
// ─────────────────────────────────────────────────────────────────────────────
function CustomerGroup({
  customerName, projects, collapsed, onToggle,
  openPopoverId, setOpenPopoverId, onStatusChange, onFieldSave, onTimelineSave,
  editKey, setEditKey, onCreate, onDelete,
  cw, setColWidths, ss, onSort,
  customerSuggestions, locationSuggestions,
  autoOpenAdd, onAutoAddClosed,
  mondayBoardId,
}: {
  customerName: string; projects: any[]; collapsed: boolean; onToggle: () => void;
  openPopoverId: number | null; setOpenPopoverId: (id: number | null) => void;
  onStatusChange: (id: number, status: string) => void;
  onFieldSave: (id: number, field: string, value: string | null) => void;
  onTimelineSave: (id: number, start: string | null, end: string | null) => void;
  editKey: EditKey; setEditKey: (k: EditKey) => void;
  onCreate: (data: any) => void;
  onDelete: (id: number) => void;
  cw: ColWidths; setColWidths: React.Dispatch<React.SetStateAction<ColWidths>>;
  ss: SortState; onSort: (c: SortCol) => void;
  customerSuggestions: string[]; locationSuggestions: string[];
  autoOpenAdd?: boolean; onAutoAddClosed?: () => void;
  mondayBoardId: string | null;
}) {
  const { t } = useLanguage();
  const isNoCustomer = customerName === "__none__";
  const [showAdd, setShowAdd] = useState(false);
  const color = groupAccentColor(customerName);

  const isMondaySynced = projects.some((p: any) => p.source === "monday");

  useEffect(() => { if (autoOpenAdd) setShowAdd(true); }, [autoOpenAdd]);

  function handleCreate(data: any) { onCreate(data); setShowAdd(false); onAutoAddClosed?.(); }
  function handleClose()           { setShowAdd(false); onAutoAddClosed?.(); }

  return (
    <div>
      {/* Group header row */}
      <button
        className="w-full flex items-center h-10 bg-[#F5F6F8] hover:bg-[#EEF0F3] transition-colors border-b border-slate-200 text-left select-none"
        style={{ borderLeft: `4px solid ${color}` }}
        onClick={onToggle}
        data-testid={`group-header-${customerName}`}
      >
        {/* chevron */}
        <div className="w-8 flex items-center justify-center flex-shrink-0">
          {collapsed
            ? <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
            : <ChevronDown  className="w-3.5 h-3.5 text-slate-500" />}
        </div>

        {/* color dot + name */}
        <div className="flex items-center gap-2 flex-1 min-w-0 pr-3">
          <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
          <span className="font-semibold text-[13px] text-slate-800 truncate">
            {isNoCustomer ? t.projNoCustomer : customerName}
          </span>
          {isMondaySynced && (
            <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-full shrink-0 ml-1">
              Synced from Monday
            </span>
          )}
        </div>

        {/* count badge */}
        <span className="mr-4 text-[11px] font-bold text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded-full flex-shrink-0">
          {projects.length}
        </span>
      </button>

      {/* Project rows */}
      {!collapsed && (
        <>
          {projects.map(project => (
            <div
              key={project.id}
              className="flex items-stretch border-b border-slate-100 hover:bg-[#E8F5FF] group/row transition-colors"
              style={{ borderLeft: `4px solid ${color}20` }}
              data-testid={`row-project-${project.id}`}
            >
              {/* Sticky name group: chevron spacer + PO + Name */}
              <div className="sticky left-0 z-10 flex items-stretch bg-white group-hover/row:bg-[#E8F5FF] transition-colors">
                {/* chevron spacer */}
                <div className="w-8 flex-shrink-0 flex items-center" />

                {/* PO / Code */}
                <div className="flex-shrink-0 hidden lg:flex items-center pr-2 py-2" style={{ width: cw.po }}>
                  <EditableCell projectId={project.id} field="poNumber" value={project.poNumber} editKey={editKey} setEditKey={setEditKey} onSave={onFieldSave} />
                </div>

                {/* Project Name */}
                <div className="flex-shrink-0 min-w-0 flex items-center pr-2 py-2" style={{ width: cw.name }}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <EditableCell projectId={project.id} field="name" value={project.name} editKey={editKey} setEditKey={setEditKey} onSave={onFieldSave} className="font-semibold text-slate-900 min-w-0 flex-1" />
                      {(project as any).mondayItemId && (
                        <a
                          href={
                            (project as any).mondayUrl ||
                            (mondayBoardId
                              ? `https://monday.com/boards/${mondayBoardId}/pulses/${(project as any).mondayItemId}`
                              : `https://monday.com`)
                          }
                          target="_blank"
                          rel="noreferrer"
                          title={`Monday.com Item에서 동기화됨${(project as any).mondayGroupTitle ? ` — ${(project as any).mondayGroupTitle}` : ""} — 클릭하여 열기`}
                          className="flex-shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#FF3D57]/10 text-[#FF3D57] hover:bg-[#FF3D57]/20 transition-colors"
                          data-testid={`badge-monday-${project.id}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
                          Mon
                        </a>
                      )}
                    </div>
                    <EditableCell projectId={project.id} field="ownerName" value={project.ownerName} editKey={editKey} setEditKey={setEditKey} onSave={onFieldSave} valueClassName="text-[11px] text-slate-400" className="mt-0.5" />
                    {/* Mobile status */}
                    <div className="flex items-center gap-2 mt-1 md:hidden">
                      <MondayStatusCell projectId={project.id} status={project.status} onChangeStart={onStatusChange} openPopoverId={openPopoverId} setOpenPopoverId={setOpenPopoverId} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Customer */}
              <div className="flex-shrink-0 hidden xl:flex items-center pr-2 py-2" style={{ width: cw.customer }}>
                <EditableCell projectId={project.id} field="customerName" value={project.customerName} editKey={editKey} setEditKey={setEditKey} onSave={onFieldSave} suggestions={customerSuggestions} />
              </div>

              {/* Location */}
              <div className="flex-shrink-0 hidden xl:flex items-center pr-2 py-2 gap-1" style={{ width: cw.location }}>
                {project.jobLocation ? <MapPin className="w-3 h-3 text-slate-300 flex-shrink-0" /> : null}
                <div className="flex-1 min-w-0">
                  <EditableCell projectId={project.id} field="jobLocation" value={project.jobLocation} editKey={editKey} setEditKey={setEditKey} onSave={onFieldSave} suggestions={locationSuggestions} />
                </div>
              </div>

              {/* Timeline */}
              <div className="flex-shrink-0 hidden xl:flex items-center pr-2 py-2" style={{ width: cw.timeline }}>
                <TimelineCell projectId={project.id} startDate={project.startDate} endDate={project.endDate} onTimelineSave={onTimelineSave} />
              </div>

              {/* Status — self-stretch for full-height colored cell */}
              <div
                className="flex-shrink-0 self-stretch hidden md:flex"
                style={{ width: cw.status }}
                onClick={e => e.stopPropagation()}
              >
                <MondayStatusCell projectId={project.id} status={project.status} onChangeStart={onStatusChange} openPopoverId={openPopoverId} setOpenPopoverId={setOpenPopoverId} />
              </div>

              {/* Actions */}
              <div className="flex-shrink-0 flex items-center justify-end gap-0.5 px-2" style={{ width: 88 }}>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); onDelete(project.id); }}
                  data-testid={`btn-delete-project-${project.id}`}
                  className="opacity-0 pointer-events-none group-hover/row:opacity-100 group-hover/row:pointer-events-auto inline-flex items-center justify-center w-7 h-7 rounded text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all"
                  title={t.projDeleteProjectTooltip}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <Link href={`/projects/${project.id}`} onClick={e => e.stopPropagation()}>
                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-brand-600 font-medium px-2 py-1 rounded hover:bg-brand-50 transition-colors" data-testid={`link-open-project-${project.id}`}>
                    {t.projOpen} <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </Link>
              </div>
            </div>
          ))}

          {/* Add row — hidden for Monday-synced groups */}
          {!isMondaySynced && (
            showAdd ? (
              <AddProjectRow
                defaultCustomer={isNoCustomer ? "" : customerName}
                onCreate={handleCreate}
                onClose={handleClose}
                cw={cw}
                customerSuggestions={customerSuggestions}
                locationSuggestions={locationSuggestions}
                accentColor={color}
              />
            ) : (
              <button
                className="w-full flex items-center gap-1.5 h-9 text-sm text-slate-400 hover:text-[#0073EA] hover:bg-[#E8F5FF] transition-colors border-b border-slate-100"
                style={{ borderLeft: `4px solid ${color}20` }}
                onClick={() => setShowAdd(true)}
                data-testid={`btn-add-project-${customerName}`}
              >
                <div className="w-8 flex items-center justify-center">
                  <Plus className="w-3.5 h-3.5" />
                </div>
                <span className="font-medium text-[13px]">{t.projAddProject}</span>
              </button>
            )
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
  const { isAdminRole } = useAuth();
  const { data: projects, isLoading } = useProjects();
  const { data: mondayBoardData } = useQuery<{ boardId: string | null }>({
    queryKey: ["/api/monday/board-id"],
    staleTime: 5 * 60 * 1000,
  });
  const mondayBoardId = mondayBoardData?.boardId ?? null;

  const createMutation = useCreateProject();
  const updateMutation = useUpdateProject();
  const deleteMutation = useDeleteProject();
  const { toast } = useToast();
  const { t } = useLanguage();

  const [statusFilter,      setStatusFilter]      = useState("all");
  const [search,            setSearch]            = useState("");
  const [openPopoverId,     setOpenPopoverId]     = useState<number | null>(null);
  const [collapsedGroups,   setCollapsedGroups]   = useState<Set<string>>(new Set());
  const [editKey,           setEditKey]           = useState<EditKey>(null);
  const [colWidths,         setColWidths]         = useState<ColWidths>(loadWidths);
  const [sortState,         setSortState]         = useState<SortState>({ col: null, dir: null });
  const [newCustDialog,     setNewCustDialog]     = useState(false);
  const [newCustInput,      setNewCustInput]      = useState("");
  const [newCustomerForAdd, setNewCustomerForAdd] = useState<string | null>(null);
  const [deleteConfirmId,   setDeleteConfirmId]   = useState<number | null>(null);

  // Persist widths
  useEffect(() => {
    try { localStorage.setItem(LS_COL, JSON.stringify(colWidths)); } catch {}
  }, [colWidths]);

  const allProjects: any[] = projects ?? [];
  const [showArchived, setShowArchived] = useState(false);

  const customerSuggestions = useMemo(() => [...new Set(allProjects.map((p: any) => p.customerName).filter(Boolean))] as string[], [allProjects]);
  const locationSuggestions = useMemo(() => [...new Set(allProjects.map((p: any) => p.jobLocation).filter(Boolean))] as string[], [allProjects]);

  const filtered = useMemo(() => allProjects.filter((p: any) => {
    if (!showArchived && p.archived) return false;
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    if (!search.trim()) return matchStatus;
    const q = search.toLowerCase();
    return matchStatus && (p.name?.toLowerCase().includes(q) || p.customerName?.toLowerCase().includes(q) || p.ownerName?.toLowerCase().includes(q) || p.jobLocation?.toLowerCase().includes(q) || p.poNumber?.toLowerCase().includes(q) || p.status?.toLowerCase().includes(q));
  }), [allProjects, statusFilter, search, showArchived]);

  const sorted = useMemo(() => {
    if (!sortState.col || !sortState.dir) return filtered;
    return [...filtered].sort((a, b) => cmpProjects(a, b, sortState.col!, sortState.dir));
  }, [filtered, sortState]);

  const groups = useMemo(() => {
    const map = new Map<string, any[]>();
    sorted.forEach((p: any) => { const k = p.customerName?.trim() || "__none__"; if (!map.has(k)) map.set(k, []); map.get(k)!.push(p); });
    return [...map.entries()].sort(([a], [b]) => { if (a === "__none__") return 1; if (b === "__none__") return -1; return a.localeCompare(b); });
  }, [sorted]);

  const groupsWithNew = useMemo(() => {
    if (!newCustomerForAdd) return groups;
    if (groups.some(([k]) => k === newCustomerForAdd)) return groups;
    const entry: [string, any[]] = [newCustomerForAdd, []];
    const result = [...groups];
    const noneIdx = result.findIndex(([k]) => k === "__none__");
    const insertIdx = result.findIndex(([k]) => k !== "__none__" && k.localeCompare(newCustomerForAdd) > 0);
    if (insertIdx !== -1) result.splice(insertIdx, 0, entry);
    else if (noneIdx !== -1) result.splice(noneIdx, 0, entry);
    else result.push(entry);
    return result;
  }, [groups, newCustomerForAdd]);

  function toggleGroup(key: string) {
    setCollapsedGroups(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }

  function handleSort(col: SortCol) {
    setSortState(prev => {
      if (prev.col !== col) return { col, dir: "asc" };
      if (prev.dir === "asc") return { col, dir: "desc" };
      return { col: null, dir: null };
    });
  }

  const onUpdateError = useCallback((err: unknown) => {
    const msg = err instanceof Error ? err.message : t.projSaveFailedDesc;
    toast({ variant: "destructive", title: t.projSaveFailed, description: msg });
  }, [toast, t]);

  const handleStatusChange  = useCallback((id: number, s: string)                            => { updateMutation.mutate({ id, status: s },                    { onError: onUpdateError }); }, [updateMutation, onUpdateError]);
  const handleFieldSave     = useCallback((id: number, field: string, val: string | null)    => { updateMutation.mutate({ id, [field]: val },                 { onError: onUpdateError }); }, [updateMutation, onUpdateError]);
  const handleTimelineSave  = useCallback((id: number, s: string | null, e: string | null)  => { updateMutation.mutate({ id, startDate: s, endDate: e },    { onError: onUpdateError }); }, [updateMutation, onUpdateError]);
  const handleCreate        = useCallback((data: any)                                         => { createMutation.mutate(data); },                              [createMutation]);
  const handleDelete        = useCallback((id: number)                                        => { setDeleteConfirmId(id); },                                   []);
  const confirmDelete       = useCallback(() => {
    if (deleteConfirmId == null) return;
    deleteMutation.mutate(deleteConfirmId, {
      onSuccess: () => { setDeleteConfirmId(null); },
      onError: (err: unknown) => {
        setDeleteConfirmId(null);
        const msg = err instanceof Error ? err.message : t.projDeleteFailedDesc;
        toast({ variant: "destructive", title: t.projDeleteFailed, description: msg });
      },
    });
  }, [deleteConfirmId, deleteMutation, toast, t]);

  function startNewCustomer() {
    const name = newCustInput.trim();
    if (!name) return;
    setNewCustomerForAdd(name);
    setNewCustInput("");
    setNewCustDialog(false);
  }

  // Global column header row (shared across all groups)
  const ColumnHeaderRow = (
    <div className="hidden md:flex items-center h-8 bg-[#F5F6F8] border-b border-slate-200 sticky top-0 z-10 select-none rounded-tl-xl rounded-tr-xl">
      {/* Sticky name group: chevron spacer + PO + Name */}
      <div className="sticky left-0 z-20 flex items-center h-8 bg-[#F5F6F8]">
        <div className="w-[calc(4px+32px)] flex-shrink-0" />
        <SortableHeader label={t.projColPo}   col="po"   ss={sortState} onSort={handleSort} cw={colWidths} cwKey="po"   setColWidths={setColWidths} className="hidden lg:flex" />
        <SortableHeader label={t.projColName} col="name" ss={sortState} onSort={handleSort} cw={colWidths} cwKey="name" setColWidths={setColWidths} />
      </div>
      {/* Non-sticky columns */}
      <SortableHeader label={t.projColCustomer} col="customer" ss={sortState} onSort={handleSort} cw={colWidths} cwKey="customer" setColWidths={setColWidths} className="hidden xl:flex" />
      <SortableHeader label={t.projColLocation} col="location" ss={sortState} onSort={handleSort} cw={colWidths} cwKey="location" setColWidths={setColWidths} className="hidden xl:flex" />
      <SortableHeader label={t.projColTimeline} col="timeline" ss={sortState} onSort={handleSort} cw={colWidths} cwKey="timeline" setColWidths={setColWidths} className="hidden xl:flex" />
      <SortableHeader label={t.projColStatus}   col="status"   ss={sortState} onSort={handleSort} cw={colWidths} cwKey="status"   setColWidths={setColWidths} />
      <div className="flex-shrink-0" style={{ width: 88 }} />
    </div>
  );

  return (
    <div className="space-y-5">

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-baseline gap-2 mr-1">
          <h1 className="text-2xl font-display font-bold text-slate-900 leading-none">{t.projTitle}</h1>
          {!isLoading && allProjects.length > 0 && (
            <span className="text-sm font-medium text-slate-400" data-testid="text-project-count">
              {filtered.length === allProjects.length ? `${allProjects.length}` : `${filtered.length} / ${allProjects.length}`}
            </span>
          )}
        </div>

        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <Input placeholder={t.projSearchPlaceholder} className="pl-9 bg-white border-slate-200 h-9 text-sm" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-project-search" />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[138px] bg-white h-9 text-sm" data-testid="select-status-filter"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.projAllStatuses}</SelectItem>
            <SelectItem value="active">{t.projStatusActive}</SelectItem>
            <SelectItem value="on_hold">{t.projStatusOnHold}</SelectItem>
            <SelectItem value="completed">{t.projStatusCompleted}</SelectItem>
            <SelectItem value="cancelled">{t.projStatusCancelled}</SelectItem>
          </SelectContent>
        </Select>

        {isAdminRole && allProjects.some((p: any) => p.archived) && (
          <Button
            variant={showArchived ? "default" : "outline"}
            size="sm"
            className={`h-9 text-sm shrink-0 ${showArchived ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-500" : "border-slate-300 text-slate-500 hover:border-amber-400 hover:text-amber-700 hover:bg-amber-50"}`}
            onClick={() => setShowArchived(v => !v)}
            data-testid="btn-toggle-archived"
          >
            {showArchived ? "아카이브 숨기기" : "아카이브 포함"}
          </Button>
        )}
        <Button
          variant="outline"
          className="h-9 text-sm border-dashed border-slate-300 text-slate-600 hover:border-brand-400 hover:text-brand-700 hover:bg-brand-50 shrink-0"
          onClick={() => setNewCustDialog(true)}
          data-testid="btn-new-customer"
        >
          <UserPlus className="w-4 h-4 mr-1.5" />{t.projNewCustomer}
        </Button>
      </div>

      {/* Clear filters */}
      {!isLoading && (search || statusFilter !== "all") && (
        <div className="flex items-center gap-2 text-sm text-slate-500 -mt-1">
          <span>{filtered.length === allProjects.length ? `${allProjects.length} ${allProjects.length !== 1 ? t.projUnitProjects : t.projUnitProject}` : `${filtered.length} / ${allProjects.length} ${t.projMatchingLabel}`}</span>
          <button className="text-brand-600 hover:text-brand-800 font-medium text-xs transition-colors" onClick={() => { setSearch(""); setStatusFilter("all"); }} data-testid="btn-clear-filters">{t.projClearFiltersBtn}</button>
        </div>
      )}

      {/* Board — Monday flat table */}
      {isLoading ? (
        <div className="border border-slate-200 rounded-xl bg-white">
          {/* Skeleton header */}
          <div className="h-8 bg-[#F5F6F8] border-b border-slate-200 rounded-tl-xl rounded-tr-xl" />
          {[1, 2].map(g => (
            <div key={g}>
              <div className="h-10 bg-[#F5F6F8] border-b border-slate-200 flex items-center px-4 gap-3">
                <div className="h-3 w-32 bg-slate-200 rounded animate-pulse" />
                <div className="h-3 w-6 bg-slate-200 rounded-full animate-pulse" />
              </div>
              {[1, 2, 3].map(r => (
                <div key={r} className="h-10 border-b border-slate-100 flex items-center px-4 gap-4">
                  <div className="h-4 flex-1 bg-slate-100 rounded animate-pulse" />
                  <div className="h-full w-[128px] bg-slate-100 animate-pulse" />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : filtered.length === 0 && !newCustomerForAdd ? (
        /* Empty state — Monday style */
        <div className="border border-slate-200 rounded-xl bg-white">
          {ColumnHeaderRow}
          <div className="p-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Briefcase className="w-7 h-7 text-slate-400" />
            </div>
            <p className="font-semibold text-slate-900">{t.projNoneFound}</p>
            {search
              ? <p className="text-sm text-slate-500 mt-1">{t.projNoResultsFor} "<span className="font-medium">{search}</span>" — {t.projTryDifferentTerms}</p>
              : statusFilter !== "all"
                ? <p className="text-sm text-slate-500 mt-1">{t.projNoMatchStatus}</p>
                : <p className="text-sm text-slate-500 mt-1">{t.projAppearGrouped}</p>}
            {(search || statusFilter !== "all") && (
              <button className="mt-3 text-sm text-brand-600 hover:text-brand-800 font-medium transition-colors" onClick={() => { setSearch(""); setStatusFilter("all"); }}>{t.projClearFiltersBtn}</button>
            )}
          </div>
        </div>
      ) : (
        /* Main board — single flat container */
        <div className="border border-slate-200 rounded-xl bg-white">
          {ColumnHeaderRow}
          {groupsWithNew.map(([customerKey, groupProjects]) => (
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
              onTimelineSave={handleTimelineSave}
              editKey={editKey}
              setEditKey={setEditKey}
              onCreate={handleCreate}
              onDelete={handleDelete}
              cw={colWidths}
              setColWidths={setColWidths}
              ss={sortState}
              onSort={handleSort}
              customerSuggestions={customerSuggestions}
              locationSuggestions={locationSuggestions}
              autoOpenAdd={newCustomerForAdd === customerKey}
              onAutoAddClosed={() => setNewCustomerForAdd(null)}
              mondayBoardId={mondayBoardId}
            />
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={open => { if (!open) setDeleteConfirmId(null); }}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>{t.projDeleteTitle}</DialogTitle>
            <DialogDescription>{t.projDeleteBody}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteConfirmId(null)} disabled={deleteMutation.isPending} data-testid="btn-cancel-delete-project">
              {t.projCancelBtn}
            </Button>
            <Button size="sm" variant="destructive" onClick={confirmDelete} disabled={deleteMutation.isPending} data-testid="btn-confirm-delete-project">
              {deleteMutation.isPending ? t.projDeletingBtn : t.projDeleteBtn}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Customer Dialog */}
      <Dialog open={newCustDialog} onOpenChange={setNewCustDialog}>
        <DialogContent className="sm:max-w-[340px]">
          <DialogHeader><DialogTitle>{t.projNewCustomerGroup}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-1">
            <p className="text-sm text-slate-500">{t.projEnterCustomerName}</p>
            <Input
              placeholder={t.projCustomerName}
              value={newCustInput}
              onChange={e => setNewCustInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && newCustInput.trim()) startNewCustomer(); }}
              autoFocus
              data-testid="input-new-customer-name"
            />
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setNewCustDialog(false)}>{t.projDialogCancelBtn}</Button>
              <Button size="sm" disabled={!newCustInput.trim()} onClick={startNewCustomer} className="bg-brand-700 hover:bg-brand-800" data-testid="btn-confirm-new-customer">
                {t.projStartProject}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
