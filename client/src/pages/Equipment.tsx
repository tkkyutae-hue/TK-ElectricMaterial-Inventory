import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Wrench, PlusCircle, Loader2, CheckCircle2, AlertTriangle,
  PauseCircle, Check, X, Trash2, Pencil, Search, MapPin,
  ChevronLeft, ChevronRight,
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
import { type EquipmentWithProject, type Project } from "@shared/schema";
import { EQUIP_TYPE_CATALOGUE, EQUIP_TYPES } from "@/lib/equipmentCatalogue";

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CFG = [
  { value: "operational",    label: "Operational",    dot: "#10b981", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", row: "bg-emerald-50/30" },
  { value: "standby",        label: "Standby",        dot: "#60a5fa", badge: "bg-blue-50 text-blue-700 border-blue-200",          row: "" },
  { value: "partial_issue",  label: "Partial Issue",  dot: "#f59e0b", badge: "bg-amber-50 text-amber-700 border-amber-200",       row: "bg-amber-50/30" },
  { value: "broken_down",    label: "Broken Down",    dot: "#ef4444", badge: "bg-red-50 text-red-700 border-red-200",             row: "bg-red-50/20" },
] as const;
type StatusValue = typeof STATUS_CFG[number]["value"];

function getStatusCfg(status: string | null) {
  return STATUS_CFG.find((s) => s.value === status) ?? STATUS_CFG[1];
}

function StatusBadge({ status }: { status: string | null }) {
  const cfg = getStatusCfg(status);
  return (
    <div className="flex items-center gap-1.5">
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: cfg.dot, flexShrink: 0, display: "inline-block" }} />
      <Badge variant="outline" className={`text-xs font-semibold ${cfg.badge}`}>{cfg.label}</Badge>
    </div>
  );
}

// ─── Filter chip ──────────────────────────────────────────────────────────────
function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded-full border border-slate-200">
      {label}
      <button onClick={onRemove} className="ml-0.5 text-slate-400 hover:text-slate-700">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

// ─── Pulsing live dot ─────────────────────────────────────────────────────────
function PulseDot() {
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", marginLeft: 4 }}>
      <span style={{
        width: 7, height: 7, borderRadius: "50%", background: "#3b82f6", display: "inline-block",
        animation: "equipPulse 1.8s ease-in-out infinite",
      }} />
      <style>{`@keyframes equipPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(1.4)} }`}</style>
    </span>
  );
}

const PAGE_SIZE = 15;

// ─── Inline Add Row ────────────────────────────────────────────────────────────
function AddEquipmentRow({
  onSaved,
  onCancel,
  autoFocus = false,
}: {
  onSaved: (id: number) => void;
  onCancel: () => void;
  autoFocus?: boolean;
}) {
  const { toast } = useToast();
  const [equipNo, setEquipNo]   = useState("");
  const [equipType, setEquipType] = useState("");
  const [name, setName]         = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [sizeSpec, setSizeSpec] = useState("");
  const [brand, setBrand]       = useState("");
  const [location, setLocation] = useState("");
  const equipRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (autoFocus) equipRef.current?.focus(); }, [autoFocus]);

  // Cascade size/brand from type
  const typeCat = EQUIP_TYPE_CATALOGUE[equipType] ?? { sizes: [], brands: [] };

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/equipment", {
      equipNo: equipNo.trim(), name: name.trim() || equipType,
      serialNumber: serialNumber.trim() || null,
      sizeSpec: sizeSpec.trim() || null, brand: brand.trim() || null,
      location: location.trim() || null,
    }),
    onSuccess: async (res: any) => {
      const json = await res.json?.() ?? res;
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      onSaved(json.id ?? 0);
    },
    onError: (err: any) => toast({ title: "Failed to register equipment", description: err.message, variant: "destructive" }),
  });

  function handleSave() {
    if (!equipNo.trim()) { equipRef.current?.focus(); return; }
    if (!name.trim() && !equipType) return;
    createMutation.mutate();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") onCancel();
  }

  const inputCls = "h-7 text-xs bg-white border-slate-200";

  return (
    <tr className="bg-blue-50/70 border-b border-blue-200">
      {/* EQ # */}
      <td className="px-3 py-2">
        <Input ref={equipRef} data-testid="input-equip-no" placeholder="EQ-001" value={equipNo}
          onChange={(e) => setEquipNo(e.target.value)} onKeyDown={handleKeyDown}
          className={`${inputCls} w-20`} />
      </td>
      {/* Type → Name (cascading) */}
      <td className="px-3 py-2">
        <div className="flex flex-col gap-1">
          <Select value={equipType} onValueChange={(v) => {
            setEquipType(v === "__none__" ? "" : v);
            if (v !== "__none__" && v !== "Other") {
              setName(v);
              // Reset size/brand when type changes
              setSizeSpec(""); setBrand("");
            }
          }}>
            <SelectTrigger data-testid="select-equip-type" className={`${inputCls} w-40`}>
              <SelectValue placeholder="Type…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Select type —</SelectItem>
              {EQUIP_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input data-testid="input-equip-name" placeholder="Equipment name" value={name}
            onChange={(e) => setName(e.target.value)} onKeyDown={handleKeyDown}
            className={`${inputCls} w-40`} />
          <Input data-testid="input-equip-serial" placeholder="S/N (optional)" value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)} onKeyDown={handleKeyDown}
            className={`${inputCls} w-40 text-slate-400`} />
        </div>
      </td>
      {/* Size (cascade from type) */}
      <td className="px-3 py-2">
        {typeCat.sizes.length > 0 ? (
          <Select value={sizeSpec || "__none__"} onValueChange={(v) => setSizeSpec(v === "__none__" ? "" : v)}>
            <SelectTrigger data-testid="select-equip-size" className={`${inputCls} w-28`}>
              <SelectValue placeholder="Size…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Custom…</SelectItem>
              {typeCat.sizes.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <Input data-testid="input-equip-size" placeholder="Size/Spec" value={sizeSpec}
            onChange={(e) => setSizeSpec(e.target.value)} onKeyDown={handleKeyDown}
            className={`${inputCls} w-28`} />
        )}
      </td>
      {/* Brand (cascade from type) */}
      <td className="px-3 py-2">
        {typeCat.brands.length > 0 ? (
          <Select value={brand || "__none__"} onValueChange={(v) => setBrand(v === "__none__" ? "" : v)}>
            <SelectTrigger data-testid="select-equip-brand" className={`${inputCls} w-32`}>
              <SelectValue placeholder="Brand…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Other…</SelectItem>
              {typeCat.brands.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <Input data-testid="input-equip-brand" placeholder="Brand" value={brand}
            onChange={(e) => setBrand(e.target.value)} onKeyDown={handleKeyDown}
            className={`${inputCls} w-32`} />
        )}
      </td>
      {/* Location */}
      <td className="px-3 py-2">
        <Input data-testid="input-equip-location" placeholder="Location" value={location}
          onChange={(e) => setLocation(e.target.value)} onKeyDown={handleKeyDown}
          className={`${inputCls} w-28`} />
      </td>
      {/* Project — read-only in admin add form */}
      <td className="px-3 py-2">
        <span className="text-xs text-slate-400 italic">Auto</span>
      </td>
      {/* Status — read-only */}
      <td className="px-3 py-2">
        <span className="text-xs text-slate-400 italic">Auto</span>
      </td>
      {/* Last Updated */}
      <td className="px-3 py-2" />
      {/* Actions */}
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <Button data-testid="btn-equip-save" size="sm" className="gap-1 h-7 text-xs px-2.5"
            onClick={handleSave} disabled={createMutation.isPending}>
            {createMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Save
          </Button>
          <Button data-testid="btn-equip-cancel" variant="ghost" size="sm"
            className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600"
            onClick={onCancel} disabled={createMutation.isPending}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ─── Inline Edit Row ───────────────────────────────────────────────────────────
function EditEquipmentRow({
  item,
  onSaved,
  onCancel,
}: {
  item: EquipmentWithProject;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const [equipNo, setEquipNo]           = useState(item.equipNo);
  const [name, setName]                 = useState(item.name);
  const [serialNumber, setSerialNumber] = useState(item.serialNumber ?? "");
  const [sizeSpec, setSizeSpec]         = useState(item.sizeSpec ?? "");
  const [brand, setBrand]               = useState(item.brand ?? "");
  const [location, setLocation]         = useState(item.location ?? "");

  const updateMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/equipment/${item.id}`, {
      equipNo: equipNo.trim(), name: name.trim(),
      serialNumber: serialNumber.trim() || null,
      sizeSpec: sizeSpec.trim() || null, brand: brand.trim() || null,
      location: location.trim() || null,
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/equipment"] }); onSaved(); },
    onError: (err: any) => toast({ title: "Failed to update equipment", description: err.message, variant: "destructive" }),
  });

  const inputCls = "h-7 text-xs bg-white border-amber-200";

  return (
    <tr className="bg-amber-50/50 border-b border-amber-100">
      <td className="px-3 py-2">
        <Input data-testid="input-edit-equip-no" value={equipNo} onChange={(e) => setEquipNo(e.target.value)}
          className={`${inputCls} w-20`} />
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-col gap-1">
          <Input data-testid="input-edit-equip-name" value={name} onChange={(e) => setName(e.target.value)}
            className={`${inputCls} w-40`} />
          <Input data-testid="input-edit-equip-serial" value={serialNumber} placeholder="S/N"
            onChange={(e) => setSerialNumber(e.target.value)} className={`${inputCls} w-40 text-slate-400`} />
        </div>
      </td>
      <td className="px-3 py-2">
        <Input data-testid="input-edit-equip-size" value={sizeSpec} onChange={(e) => setSizeSpec(e.target.value)}
          className={`${inputCls} w-28`} />
      </td>
      <td className="px-3 py-2">
        <Input data-testid="input-edit-equip-brand" value={brand} onChange={(e) => setBrand(e.target.value)}
          className={`${inputCls} w-32`} />
      </td>
      <td className="px-3 py-2">
        <Input data-testid="input-edit-equip-location" value={location} onChange={(e) => setLocation(e.target.value)}
          className={`${inputCls} w-28`} />
      </td>
      <td className="px-3 py-2">
        <span className="text-xs text-slate-400 italic">{item.project?.name ?? "—"}</span>
      </td>
      <td className="px-3 py-2">
        <StatusBadge status={item.status} />
      </td>
      <td className="px-3 py-2" />
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <Button data-testid="btn-equip-update" size="sm" className="gap-1 h-7 text-xs px-2.5"
            onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Save
          </Button>
          <Button data-testid="btn-equip-edit-cancel" variant="ghost" size="sm"
            className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600"
            onClick={onCancel} disabled={updateMutation.isPending}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Equipment() {
  const { toast } = useToast();

  // ── State ──
  const [draftKeys, setDraftKeys]     = useState<number[]>([]);
  const [flashIds, setFlashIds]       = useState<Set<number>>(new Set());
  const [editingId, setEditingId]     = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [hoverRowId, setHoverRowId]   = useState<number | null>(null);
  const nextKey = useRef(0);

  // ── Filters ──
  const [search, setSearch]           = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType]   = useState("");
  const [filterProjectId, setFilterProjectId] = useState("");
  const [page, setPage]               = useState(1);

  const { data: equipList = [], isLoading } = useQuery<EquipmentWithProject[]>({
    queryKey: ["/api/equipment"],
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // ── Delete ──
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/equipment/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      setConfirmDeleteId(null);
      toast({ title: "Equipment removed." });
    },
    onError: (err: any) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
      setConfirmDeleteId(null);
    },
  });

  // ── Summary counts ──
  const statusCounts = {
    total:         equipList.length,
    operational:   equipList.filter((e) => e.status === "operational").length,
    standby:       equipList.filter((e) => e.status === "standby").length,
    partial_issue: equipList.filter((e) => e.status === "partial_issue").length,
    broken_down:   equipList.filter((e) => e.status === "broken_down").length,
  };

  // ── Filter logic ──
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return equipList.filter((e) => {
      if (q && !`${e.equipNo} ${e.name} ${e.sizeSpec ?? ""} ${e.brand ?? ""}`.toLowerCase().includes(q)) return false;
      if (filterStatus && e.status !== filterStatus) return false;
      if (filterType) {
        const nameMatch = EQUIP_TYPES.find((t) => e.name?.toLowerCase().includes(t.toLowerCase()));
        if (!nameMatch || nameMatch !== filterType) return false;
      }
      if (filterProjectId && String(e.assignedProjectId ?? "") !== filterProjectId) return false;
      return true;
    });
  }, [equipList, search, filterStatus, filterType, filterProjectId]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset page on filter change
  useEffect(() => setPage(1), [search, filterStatus, filterType, filterProjectId]);

  // ── Active filter chips ──
  const chips: { label: string; clear: () => void }[] = [];
  if (search)        chips.push({ label: `"${search}"`,                                        clear: () => setSearch("") });
  if (filterStatus)  chips.push({ label: getStatusCfg(filterStatus).label,                     clear: () => setFilterStatus("") });
  if (filterType)    chips.push({ label: filterType,                                            clear: () => setFilterType("") });
  if (filterProjectId) {
    const pName = projects.find((p) => String(p.id) === filterProjectId)?.name ?? filterProjectId;
    chips.push({ label: pName, clear: () => setFilterProjectId("") });
  }

  function flashRow(id: number) {
    setFlashIds((prev) => new Set([...prev, id]));
    setTimeout(() => setFlashIds((prev) => { const s = new Set(prev); s.delete(id); return s; }), 1200);
  }

  function removeDraft(key: number) {
    setDraftKeys((prev) => prev.filter((k) => k !== key));
  }

  function handleAddClick() {
    const key = nextKey.current++;
    setDraftKeys((prev) => [...prev, key]);
  }

  function formatDate(d: Date | string | null | undefined) {
    if (!d) return null;
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return null;
    return { date: dt.toLocaleDateString("en-US", { month: "short", day: "numeric" }), time: dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) };
  }

  return (
    <div className="space-y-6">

      {/* ── Page header ── */}
      <div>
        <h1 className="text-3xl font-display font-bold text-slate-900">Equipment Registry</h1>
        <p className="text-slate-500 mt-1">
          Master registry for all company equipment. Live fields (status, project) are updated from Daily Reports.
        </p>
      </div>

      {/* ── 5 Summary cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total",         value: statusCounts.total,         icon: Wrench,        iconCls: "text-slate-600",   bg: "bg-slate-100"   },
          { label: "Operational",   value: statusCounts.operational,   icon: CheckCircle2,  iconCls: "text-emerald-600", bg: "bg-emerald-50"  },
          { label: "Standby",       value: statusCounts.standby,       icon: PauseCircle,   iconCls: "text-blue-500",    bg: "bg-blue-50"     },
          { label: "Partial Issue", value: statusCounts.partial_issue, icon: AlertTriangle, iconCls: "text-amber-600",   bg: "bg-amber-50"    },
          { label: "Broken Down",   value: statusCounts.broken_down,   icon: Wrench,        iconCls: "text-red-600",     bg: "bg-red-50"      },
        ].map(({ label, value, icon: Icon, iconCls, bg }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-3 pt-4 pb-4 px-4">
              <div className={`flex items-center justify-center w-9 h-9 rounded-xl shrink-0 ${bg}`}>
                <Icon className={`w-4 h-4 ${iconCls}`} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium leading-none mb-0.5">{label}</p>
                <p className="text-xl font-bold text-slate-700 leading-tight">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input
            data-testid="input-equip-search"
            placeholder="Search EQ#, name, size, brand…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm w-64"
          />
        </div>

        <Select value={filterStatus || "__all__"} onValueChange={(v) => setFilterStatus(v === "__all__" ? "" : v)}>
          <SelectTrigger data-testid="select-filter-status" className="h-9 text-sm w-36">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All statuses</SelectItem>
            {STATUS_CFG.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterType || "__all__"} onValueChange={(v) => setFilterType(v === "__all__" ? "" : v)}>
          <SelectTrigger data-testid="select-filter-type" className="h-9 text-sm w-36">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All types</SelectItem>
            {EQUIP_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterProjectId || "__all__"} onValueChange={(v) => setFilterProjectId(v === "__all__" ? "" : v)}>
          <SelectTrigger data-testid="select-filter-project" className="h-9 text-sm w-40">
            <SelectValue placeholder="All projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All projects</SelectItem>
            {projects.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <span className="text-xs text-slate-400 font-medium ml-1">
          {filtered.length} result{filtered.length !== 1 ? "s" : ""}
        </span>

        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 ml-1">
            {chips.map((c) => <Chip key={c.label} label={c.label} onRemove={c.clear} />)}
          </div>
        )}

        <div className="ml-auto">
          <Button
            data-testid="btn-register-equipment"
            size="sm"
            className="gap-1.5 text-xs h-9"
            onClick={handleAddClick}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Add Equipment
          </Button>
        </div>
      </div>

      {/* ── Equipment Registry table ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Wrench className="w-4 h-4 text-slate-500" />
            Equipment Registry
            <span className="text-xs font-normal text-slate-400 ml-1">({equipList.length} registered)</span>
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
              <p className="text-sm text-slate-400">Loading equipment…</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <colgroup>
                    <col style={{ width: 72 }} />   {/* EQ # */}
                    <col />                          {/* Name + S/N */}
                    <col style={{ width: 96 }} />   {/* Size */}
                    <col style={{ width: 112 }} />  {/* Brand */}
                    <col style={{ width: 112 }} />  {/* Location */}
                    <col style={{ width: 128 }} />  {/* Project (live) */}
                    <col style={{ width: 120 }} />  {/* Status (live) */}
                    <col style={{ width: 96 }} />   {/* Last Updated (live) */}
                    <col style={{ width: 60 }} />   {/* Actions */}
                  </colgroup>

                  {/* ── Two-tier header ── */}
                  <thead>
                    {/* Tier 1: section labels */}
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th
                        colSpan={5}
                        className="px-3 py-1.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500"
                        style={{ borderRight: "1px solid #cbd5e1" }}
                      >
                        Master Data
                      </th>
                      <th
                        colSpan={3}
                        className="px-3 py-1.5 text-left text-[10px] font-bold uppercase tracking-widest text-blue-500"
                      >
                        Live <PulseDot />
                      </th>
                      <th className="px-3 py-1.5" />
                    </tr>
                    {/* Tier 2: column labels */}
                    <tr className="border-b border-slate-100 bg-white">
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">EQ #</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Name / S/N</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Size</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Brand</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ borderRight: "1px solid #cbd5e1" }}>Location</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-blue-400 uppercase tracking-wide">Project</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-blue-400 uppercase tracking-wide">Status</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-blue-400 uppercase tracking-wide">Last Updated</th>
                      <th className="px-3 py-2.5" />
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {/* Draft add rows */}
                    {draftKeys.map((key, idx) => (
                      <AddEquipmentRow
                        key={key}
                        autoFocus={idx === draftKeys.length - 1}
                        onSaved={(id) => { removeDraft(key); flashRow(id); }}
                        onCancel={() => removeDraft(key)}
                      />
                    ))}

                    {pageItems.length === 0 && draftKeys.length === 0 && (
                      <tr>
                        <td colSpan={9} className="py-16 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-100">
                              <Wrench className="w-6 h-6 text-slate-400" />
                            </div>
                            <p className="text-sm font-medium text-slate-600">
                              {filtered.length === 0 && equipList.length > 0
                                ? "No equipment matches the current filters"
                                : "No equipment registered yet"}
                            </p>
                            <p className="text-xs text-slate-400">
                              {filtered.length === 0 && equipList.length > 0
                                ? "Clear filters to see all equipment"
                                : "Click \"Add Equipment\" to register your first piece of equipment"}
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}

                    {pageItems.map((equip) => {
                      const isEditing    = editingId === equip.id;
                      const isConfirming = confirmDeleteId === equip.id;
                      const isDeleting   = deleteMutation.isPending && confirmDeleteId === equip.id;
                      const isHovered    = hoverRowId === equip.id;
                      const isFlashing   = flashIds.has(equip.id);
                      const statusCfg    = getStatusCfg(equip.status);
                      const updatedFmt   = formatDate(equip.lastReportedAt);

                      if (isEditing) {
                        return (
                          <EditEquipmentRow
                            key={equip.id}
                            item={equip}
                            onSaved={() => setEditingId(null)}
                            onCancel={() => setEditingId(null)}
                          />
                        );
                      }

                      return (
                        <tr
                          key={equip.id}
                          data-testid={`row-equipment-${equip.id}`}
                          className={`transition-colors ${
                            isFlashing ? "mat-row-flash" :
                            isConfirming ? "bg-red-50" :
                            isHovered ? "bg-slate-50" :
                            statusCfg.row
                          }`}
                          onMouseEnter={() => setHoverRowId(equip.id)}
                          onMouseLeave={() => setHoverRowId(null)}
                        >
                          {/* EQ # — monospace badge */}
                          <td className="px-3 py-3">
                            <span
                              data-testid={`text-equip-no-${equip.id}`}
                              className="font-mono text-[11px] font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200"
                            >
                              {equip.equipNo}
                            </span>
                          </td>

                          {/* Name + S/N — two-line */}
                          <td className="px-3 py-3">
                            <div>
                              <p data-testid={`text-equip-name-${equip.id}`} className="font-medium text-slate-800 leading-tight">
                                {equip.name}
                              </p>
                              {equip.serialNumber && (
                                <p className="text-[10px] text-slate-400 mt-0.5 leading-none">S/N {equip.serialNumber}</p>
                              )}
                            </div>
                          </td>

                          {/* Size badge */}
                          <td className="px-3 py-3">
                            {equip.sizeSpec ? (
                              <span
                                data-testid={`text-equip-size-${equip.id}`}
                                className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 rounded"
                              >
                                {equip.sizeSpec}
                              </span>
                            ) : (
                              <span className="text-slate-300 text-xs">—</span>
                            )}
                          </td>

                          {/* Brand */}
                          <td className="px-3 py-3">
                            <span data-testid={`text-equip-brand-${equip.id}`} className="text-slate-600 text-xs">
                              {equip.brand ?? "—"}
                            </span>
                          </td>

                          {/* Location + pin icon — master data */}
                          <td className="px-3 py-3" style={{ borderRight: "1px solid #e2e8f0" }}>
                            {equip.location ? (
                              <div className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                <span data-testid={`text-equip-location-${equip.id}`} className="text-slate-600 text-xs">
                                  {equip.location}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-300 text-xs">—</span>
                            )}
                          </td>

                          {/* Project chip (live) */}
                          <td className="px-3 py-3">
                            {equip.project ? (
                              <span
                                data-testid={`text-equip-project-${equip.id}`}
                                className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium bg-violet-50 text-violet-700 border border-violet-200 rounded-full"
                              >
                                {equip.project.name}
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-300 border border-dashed border-slate-200 px-2 py-0.5 rounded-full">
                                Unassigned
                              </span>
                            )}
                          </td>

                          {/* Status dot + label (live) */}
                          <td className="px-3 py-3">
                            <StatusBadge status={equip.status} />
                          </td>

                          {/* Last Updated two-line (live) */}
                          <td className="px-3 py-3">
                            {updatedFmt ? (
                              <div>
                                <p className="text-[11px] font-medium text-slate-600 leading-none">{updatedFmt.date}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5 leading-none">{updatedFmt.time}</p>
                              </div>
                            ) : (
                              <span className="text-slate-300 text-xs">—</span>
                            )}
                          </td>

                          {/* Hover-reveal actions */}
                          <td className="px-3 py-3">
                            <div
                              className="flex items-center justify-end gap-0.5 transition-opacity"
                              style={{ opacity: (isHovered || isConfirming) ? 1 : 0 }}
                            >
                              {isConfirming ? (
                                <>
                                  <span className="text-xs text-red-600 font-medium mr-1 whitespace-nowrap">Remove?</span>
                                  <Button
                                    data-testid={`btn-delete-confirm-${equip.id}`}
                                    size="sm" variant="destructive"
                                    className="h-7 px-2 text-xs gap-1"
                                    onClick={() => deleteMutation.mutate(equip.id)}
                                    disabled={isDeleting}
                                  >
                                    {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                    Yes
                                  </Button>
                                  <Button
                                    data-testid={`btn-delete-cancel-${equip.id}`}
                                    size="sm" variant="outline"
                                    className="h-7 w-7 p-0"
                                    onClick={() => setConfirmDeleteId(null)}
                                    disabled={isDeleting}
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    data-testid={`btn-edit-equipment-${equip.id}`}
                                    variant="ghost" size="sm"
                                    className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700"
                                    onClick={() => { setEditingId(equip.id); setConfirmDeleteId(null); }}
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    data-testid={`btn-delete-equipment-${equip.id}`}
                                    variant="ghost" size="sm"
                                    className="h-7 w-7 p-0 text-slate-300 hover:text-red-500 hover:bg-red-50"
                                    onClick={() => setConfirmDeleteId(equip.id)}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ── Pagination bar ── */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
                  <p className="text-xs text-slate-500">
                    Showing {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      data-testid="btn-page-prev"
                      variant="outline" size="sm"
                      className="h-7 w-7 p-0"
                      disabled={page === 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </Button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <Button
                        key={p}
                        data-testid={`btn-page-${p}`}
                        variant={p === page ? "default" : "outline"}
                        size="sm"
                        className="h-7 w-7 p-0 text-xs"
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </Button>
                    ))}
                    <Button
                      data-testid="btn-page-next"
                      variant="outline" size="sm"
                      className="h-7 w-7 p-0"
                      disabled={page === totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
