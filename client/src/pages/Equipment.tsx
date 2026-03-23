import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Wrench, PlusCircle, Loader2, CheckCircle2, AlertTriangle,
  PauseCircle, Check, X, Trash2, Pencil, Search, MapPin, CheckCircle,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CreatableDropdown } from "@/components/ui/CreatableDropdown";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { type EquipmentWithProject, type Project } from "@shared/schema";
import { EQUIP_TYPE_CATALOGUE, EQUIP_TYPES } from "@/lib/equipmentCatalogue";

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CFG = [
  { value: "operational",   label: "Operational",   dot: "#10b981", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", row: "bg-emerald-50/30" },
  { value: "standby",       label: "Standby",       dot: "#60a5fa", badge: "bg-blue-50 text-blue-700 border-blue-200",          row: "" },
  { value: "partial_issue", label: "Partial Issue", dot: "#f59e0b", badge: "bg-amber-50 text-amber-700 border-amber-200",       row: "bg-amber-50/30" },
  { value: "broken_down",   label: "Broken Down",   dot: "#ef4444", badge: "bg-red-50 text-red-700 border-red-200",             row: "bg-red-50/20" },
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

// ─── Ownership config ─────────────────────────────────────────────────────────
const OWN_OPTS = ["Rental", "Company-owned"] as const;
type OwnType = typeof OWN_OPTS[number];

const OWN_CFG: Record<OwnType, { bg: string; border: string; color: string }> = {
  "Rental":        { bg: "#fff7ed", border: "#fed7aa", color: "#c2410c" },
  "Company-owned": { bg: "#f0fdf4", border: "#86efac", color: "#166534" },
};

function OwnershipBadge({ type }: { type: string | null }) {
  const t = (type ?? "Rental") as OwnType;
  const cfg = OWN_CFG[t] ?? OWN_CFG["Rental"];
  return (
    <span style={{
      background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color,
      fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
      padding: "2px 7px", borderRadius: 5, whiteSpace: "nowrap", display: "inline-block",
    }}>
      {t}
    </span>
  );
}

function OwnershipSelect({
  value, onChange, borderCls,
}: {
  value: string;
  onChange: (v: string) => void;
  borderCls?: string;
}) {
  const t = value as OwnType;
  const cfg = OWN_CFG[t] ?? OWN_CFG["Rental"];
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      data-testid="select-equip-ownership"
      style={{
        height: 28, fontSize: 11, fontWeight: 600, letterSpacing: "0.03em",
        background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color,
        borderRadius: 6, padding: "0 8px", cursor: "pointer", outline: "none",
        width: "100%",
      }}
    >
      {OWN_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
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

// ─── EQ# auto-generator ───────────────────────────────────────────────────────
const TYPE_ABBR: Record<string, string> = {
  "Air Compressor": "AC", "Generator": "GEN", "Forklift": "FK",
  "Scissor Lift": "SL", "Boom Lift": "BL", "Conduit Bender": "CB",
  "Wire Puller": "WP", "Drill": "DR", "Grinder": "GR",
  "Vacuum": "VAC", "Power Distribution": "PD", "Cable Puller": "CP", "Other": "EQ",
};

function autoGenEqNo(type: string, size: string, brand: string): string {
  const typeAbbr  = type  ? (TYPE_ABBR[type] ?? type.slice(0, 2).toUpperCase()) : "";
  const sizeShort = size  ? size.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 5) : "";
  const brandShort = brand ? brand.slice(0, 3).toUpperCase() : "";
  const parts = [typeAbbr, sizeShort, brandShort].filter(Boolean);
  return parts.length > 0 ? parts.join("-") : "";
}

const PAGE_SIZE = 15;

// ─── Common location datalist id ─────────────────────────────────────────────
const LOC_LIST_ID = "equip-location-list";
const COMMON_LOCATIONS = ["KDC / KISS", "Site A", "Site B", "Site C", "Warehouse", "Yard", "Storage", "Office"];

// ─── Shared row hook ──────────────────────────────────────────────────────────
function useEquipRowState(initType = "", initSize = "", initBrand = "") {
  const [equipType, setEquipTypeRaw] = useState(initType);
  const [typeOptions, setTypeOptions] = useState<string[]>([...EQUIP_TYPES]);
  const [sizeSpec, setSizeSpec]       = useState(initSize);
  const [sizeOptions, setSizeOptions] = useState<string[]>(
    initType ? [...(EQUIP_TYPE_CATALOGUE[initType]?.sizes ?? [])] : []
  );
  const [brand, setBrand]             = useState(initBrand);
  const [brandOptions, setBrandOptions] = useState<string[]>(
    initType ? [...(EQUIP_TYPE_CATALOGUE[initType]?.brands ?? [])] : []
  );

  function setEquipType(t: string) {
    setEquipTypeRaw(t);
    const cat = EQUIP_TYPE_CATALOGUE[t];
    if (cat) {
      setSizeOptions([...cat.sizes]);
      setBrandOptions([...cat.brands]);
      setSizeSpec("");
      setBrand("");
    } else {
      setSizeOptions([]);
      setBrandOptions([]);
    }
  }

  return {
    equipType, setEquipType, typeOptions, setTypeOptions,
    sizeSpec, setSizeSpec, sizeOptions, setSizeOptions,
    brand, setBrand, brandOptions, setBrandOptions,
  };
}

// ─── Inline Add Row ────────────────────────────────────────────────────────────
function AddEquipmentRow({
  onSaved, onCancel, autoFocus = false,
}: {
  onSaved: (id: number) => void;
  onCancel: () => void;
  autoFocus?: boolean;
}) {
  const { toast } = useToast();
  const [ownership, setOwnership] = useState<string>("Rental");
  const [equipNo, setEquipNo]     = useState("");
  const [name, setName]           = useState("");
  const [location, setLocation]   = useState("");
  const equipRef = useRef<HTMLInputElement>(null);

  const {
    equipType, setEquipType, typeOptions, setTypeOptions,
    sizeSpec, setSizeSpec, sizeOptions, setSizeOptions,
    brand, setBrand, brandOptions, setBrandOptions,
  } = useEquipRowState();

  useEffect(() => { if (autoFocus) equipRef.current?.focus(); }, [autoFocus]);

  const autoEq = autoGenEqNo(equipType, sizeSpec, brand);
  const showAutoPreview = !equipNo.trim() && autoEq;

  const createMutation = useMutation({
    mutationFn: () => {
      const resolvedEqNo = equipNo.trim() || autoEq || null;
      return apiRequest("POST", "/api/equipment", {
        equipNo: resolvedEqNo,
        name: name.trim() || equipType || "Equipment",
        equipType: equipType || null,
        sizeSpec: sizeSpec.trim() || null,
        brand: brand.trim() || null,
        location: location.trim() || null,
        ownershipType: ownership,
      });
    },
    onSuccess: async (res: any) => {
      const json = await res.json?.() ?? res;
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      onSaved(json.id ?? 0);
    },
    onError: (err: any) => toast({ title: "Failed to register equipment", description: err.message, variant: "destructive" }),
  });

  function handleSave() {
    if (!name.trim() && !equipType) return;
    createMutation.mutate();
  }

  const inputCls = "h-7 text-xs bg-white border-slate-200";

  return (
    <tr className="bg-blue-50/70 border-b border-blue-200">
      {/* OWN. */}
      <td className="px-3 py-2" style={{ minWidth: 110 }}>
        <OwnershipSelect value={ownership} onChange={setOwnership} />
      </td>
      {/* EQ # — optional */}
      <td className="px-3 py-2" style={{ minWidth: 120 }}>
        <div>
          <Input
            ref={equipRef}
            data-testid="input-equip-no"
            placeholder="Auto"
            value={equipNo}
            onChange={(e) => setEquipNo(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onCancel(); }}
            className={`${inputCls} w-24`}
          />
          {showAutoPreview && (
            <p style={{ fontSize: 9, color: "#16a34a", marginTop: 3, display: "flex", alignItems: "center", gap: 3 }}>
              <CheckCircle style={{ width: 9, height: 9 }} />
              Auto: {autoEq}
            </p>
          )}
        </div>
      </td>
      {/* NAME (Type dropdown + name text) */}
      <td className="px-3 py-2" style={{ minWidth: 160 }}>
        <div className="flex flex-col gap-1">
          <CreatableDropdown
            data-testid="select-equip-type"
            options={typeOptions}
            value={equipType}
            onChange={(v) => { setEquipType(v); if (v) setName(v); }}
            onOptionsChange={setTypeOptions}
            placeholder="Type…"
            className="w-full"
          />
          <Input
            data-testid="input-equip-name"
            placeholder="Equipment name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`${inputCls} w-full`}
          />
        </div>
      </td>
      {/* SIZE */}
      <td className="px-3 py-2" style={{ minWidth: 96 }}>
        <CreatableDropdown
          data-testid="select-equip-size"
          options={sizeOptions}
          value={sizeSpec}
          onChange={setSizeSpec}
          onOptionsChange={setSizeOptions}
          placeholder="Size…"
          className="w-full"
        />
      </td>
      {/* BRAND */}
      <td className="px-3 py-2" style={{ minWidth: 130 }}>
        <CreatableDropdown
          data-testid="select-equip-brand"
          options={brandOptions}
          value={brand}
          onChange={setBrand}
          onOptionsChange={setBrandOptions}
          placeholder="Brand…"
          className="w-full"
        />
      </td>
      {/* LOCATION */}
      <td className="px-3 py-2" style={{ minWidth: 110, borderRight: "1px solid #e2e8f0" }}>
        <Input
          data-testid="input-equip-location"
          placeholder="Location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          list={LOC_LIST_ID}
          className={`${inputCls} w-full`}
        />
      </td>
      {/* PROJECT — read-only */}
      <td className="px-3 py-2" style={{ minWidth: 192 }}>
        <span className="text-xs text-slate-400 italic">Auto</span>
      </td>
      {/* TEAM — read-only */}
      <td className="px-3 py-2" style={{ minWidth: 110 }}>
        <span className="text-xs text-slate-400 italic">Auto</span>
      </td>
      {/* STATUS — read-only */}
      <td className="px-3 py-2" style={{ minWidth: 132 }}>
        <span className="text-xs text-slate-400 italic">Auto</span>
      </td>
      {/* LAST UPDATED */}
      <td className="px-3 py-2" style={{ minWidth: 120 }} />
      {/* Actions */}
      <td className="px-3 py-2" style={{ minWidth: 64 }}>
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
  item, onSaved, onCancel,
}: {
  item: EquipmentWithProject;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const [ownership, setOwnership] = useState<string>(item.ownershipType ?? "Rental");
  const [equipNo, setEquipNo]     = useState(item.equipNo);
  const [name, setName]           = useState(item.name);
  const [location, setLocation]   = useState(item.location ?? "");

  const {
    equipType, setEquipType, typeOptions, setTypeOptions,
    sizeSpec, setSizeSpec, sizeOptions, setSizeOptions,
    brand, setBrand, brandOptions, setBrandOptions,
  } = useEquipRowState(
    item.equipType ?? "",
    item.sizeSpec ?? "",
    item.brand ?? ""
  );

  const autoEq = autoGenEqNo(equipType, sizeSpec, brand);
  const showAutoPreview = !equipNo.trim() && autoEq;

  const updateMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/equipment/${item.id}`, {
      equipNo: equipNo.trim() || autoEq || undefined,
      name: name.trim(),
      equipType: equipType || null,
      sizeSpec: sizeSpec.trim() || null,
      brand: brand.trim() || null,
      location: location.trim() || null,
      ownershipType: ownership,
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/equipment"] }); onSaved(); },
    onError: (err: any) => toast({ title: "Failed to update equipment", description: err.message, variant: "destructive" }),
  });

  const inputCls = "h-7 text-xs bg-white border-amber-200";

  return (
    <tr className="bg-amber-50/50 border-b border-amber-100">
      {/* OWN. */}
      <td className="px-3 py-2" style={{ minWidth: 110 }}>
        <OwnershipSelect value={ownership} onChange={setOwnership} />
      </td>
      {/* EQ # */}
      <td className="px-3 py-2" style={{ minWidth: 120 }}>
        <div>
          <Input
            data-testid="input-edit-equip-no"
            value={equipNo}
            onChange={(e) => setEquipNo(e.target.value)}
            className={`${inputCls} w-24`}
          />
          {showAutoPreview && (
            <p style={{ fontSize: 9, color: "#16a34a", marginTop: 3, display: "flex", alignItems: "center", gap: 3 }}>
              <CheckCircle style={{ width: 9, height: 9 }} />
              Auto: {autoEq}
            </p>
          )}
        </div>
      </td>
      {/* NAME */}
      <td className="px-3 py-2" style={{ minWidth: 160 }}>
        <div className="flex flex-col gap-1">
          <CreatableDropdown
            data-testid="select-equip-type"
            options={typeOptions}
            value={equipType}
            onChange={(v) => { setEquipType(v); if (v) setName(v); }}
            onOptionsChange={setTypeOptions}
            placeholder="Type…"
            className="w-full"
          />
          <Input
            data-testid="input-equip-name"
            placeholder="Equipment name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`${inputCls} w-full`}
          />
        </div>
      </td>
      {/* SIZE */}
      <td className="px-3 py-2" style={{ minWidth: 96 }}>
        <CreatableDropdown
          data-testid="select-equip-size"
          options={sizeOptions}
          value={sizeSpec}
          onChange={setSizeSpec}
          onOptionsChange={setSizeOptions}
          placeholder="Size…"
          className="w-full"
        />
      </td>
      {/* BRAND */}
      <td className="px-3 py-2" style={{ minWidth: 130 }}>
        <CreatableDropdown
          data-testid="select-equip-brand"
          options={brandOptions}
          value={brand}
          onChange={setBrand}
          onOptionsChange={setBrandOptions}
          placeholder="Brand…"
          className="w-full"
        />
      </td>
      {/* LOCATION */}
      <td className="px-3 py-2" style={{ minWidth: 110, borderRight: "1px solid #e2e8f0" }}>
        <Input
          data-testid="input-equip-location"
          placeholder="Location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          list={LOC_LIST_ID}
          className={`${inputCls} w-full`}
        />
      </td>
      {/* PROJECT — read-only */}
      <td className="px-3 py-2" style={{ minWidth: 192 }}>
        <span className="text-xs text-slate-400 italic">{item.project?.name ?? "—"}</span>
      </td>
      {/* TEAM — read-only */}
      <td className="px-3 py-2" style={{ minWidth: 110 }}>
        {(item as any).teamName ? (
          <span style={{ background: "#f0fdf4", border: "1px solid #86efac", color: "#166534", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 12, whiteSpace: "nowrap" }}>
            {(item as any).teamName}
          </span>
        ) : (
          <span className="text-xs" style={{ color: "#d1d5db" }}>—</span>
        )}
      </td>
      {/* STATUS — read-only */}
      <td className="px-3 py-2" style={{ minWidth: 132 }}>
        <StatusBadge status={item.status} />
      </td>
      {/* LAST UPDATED */}
      <td className="px-3 py-2" style={{ minWidth: 120 }} />
      {/* Actions */}
      <td className="px-3 py-2" style={{ minWidth: 64 }}>
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

  const [draftKeys, setDraftKeys]         = useState<number[]>([]);
  const [flashIds, setFlashIds]           = useState<Set<number>>(new Set());
  const [editingId, setEditingId]         = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [hoverRowId, setHoverRowId]       = useState<number | null>(null);
  const nextKey = useRef(0);

  const [search, setSearch]               = useState("");
  const [filterStatus, setFilterStatus]   = useState("");
  const [filterType, setFilterType]       = useState("");
  const [filterOwnership, setFilterOwnership] = useState("");
  const [filterProjectId, setFilterProjectId] = useState("");
  const [page, setPage]                   = useState(1);

  const { data: equipList = [], isLoading } = useQuery<EquipmentWithProject[]>({
    queryKey: ["/api/equipment"],
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

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

  const statusCounts = {
    total:         equipList.length,
    operational:   equipList.filter((e) => e.status === "operational").length,
    standby:       equipList.filter((e) => e.status === "standby").length,
    partial_issue: equipList.filter((e) => e.status === "partial_issue").length,
    broken_down:   equipList.filter((e) => e.status === "broken_down").length,
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return equipList.filter((e) => {
      if (q && !`${e.equipNo} ${e.name} ${e.sizeSpec ?? ""} ${e.brand ?? ""}`.toLowerCase().includes(q)) return false;
      if (filterStatus && e.status !== filterStatus) return false;
      if (filterType && e.equipType !== filterType) return false;
      if (filterOwnership && (e.ownershipType ?? "Rental") !== filterOwnership) return false;
      if (filterProjectId && String(e.assignedProjectId ?? "") !== filterProjectId) return false;
      return true;
    });
  }, [equipList, search, filterStatus, filterType, filterOwnership, filterProjectId]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => setPage(1), [search, filterStatus, filterType, filterOwnership, filterProjectId]);

  const chips: { label: string; clear: () => void }[] = [];
  if (search)         chips.push({ label: `"${search}"`,                                    clear: () => setSearch("") });
  if (filterStatus)   chips.push({ label: getStatusCfg(filterStatus).label,                 clear: () => setFilterStatus("") });
  if (filterType)     chips.push({ label: filterType,                                        clear: () => setFilterType("") });
  if (filterOwnership) chips.push({ label: filterOwnership,                                  clear: () => setFilterOwnership("") });
  if (filterProjectId) {
    const pName = projects.find((p) => String(p.id) === filterProjectId)?.name ?? filterProjectId;
    chips.push({ label: pName, clear: () => setFilterProjectId("") });
  }

  function flashRow(id: number) {
    setFlashIds((prev) => new Set([...prev, id]));
    setTimeout(() => setFlashIds((prev) => { const s = new Set(prev); s.delete(id); return s; }), 1200);
  }

  function removeDraft(key: number) { setDraftKeys((prev) => prev.filter((k) => k !== key)); }
  function handleAddClick() { const key = nextKey.current++; setDraftKeys((prev) => [...prev, key]); }

  function formatDate(d: Date | string | null | undefined) {
    if (!d) return null;
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return null;
    return {
      date: dt.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      time: dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    };
  }

  return (
    <div className="space-y-6">
      <datalist id={LOC_LIST_ID}>
        {COMMON_LOCATIONS.map((l) => <option key={l} value={l} />)}
      </datalist>

      {/* ── Page header ── */}
      <div>
        <h1 className="text-3xl font-display font-bold text-slate-900">Equipment Registry</h1>
        <p className="text-slate-500 mt-1">
          Master registry for all company equipment. Live fields (status, project, team) are updated from Daily Reports.
        </p>
      </div>

      {/* ── 5 Summary cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total",         value: statusCounts.total,         icon: Wrench,        iconCls: "text-slate-600",   bg: "bg-slate-100"  },
          { label: "Operational",   value: statusCounts.operational,   icon: CheckCircle2,  iconCls: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Standby",       value: statusCounts.standby,       icon: PauseCircle,   iconCls: "text-blue-500",    bg: "bg-blue-50"    },
          { label: "Partial Issue", value: statusCounts.partial_issue, icon: AlertTriangle, iconCls: "text-amber-600",   bg: "bg-amber-50"   },
          { label: "Broken Down",   value: statusCounts.broken_down,   icon: Wrench,        iconCls: "text-red-600",     bg: "bg-red-50"     },
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

        <Select value={filterOwnership || "__all__"} onValueChange={(v) => setFilterOwnership(v === "__all__" ? "" : v)}>
          <SelectTrigger data-testid="select-filter-ownership" className="h-9 text-sm w-36">
            <SelectValue placeholder="All ownership" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All ownership</SelectItem>
            {OWN_OPTS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
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
                <table style={{ width: "100%", minWidth: 1344, tableLayout: "auto", borderCollapse: "collapse" }}>

                  {/* ── Two-tier header ── */}
                  <thead>
                    {/* Tier 1: section labels */}
                    <tr style={{ background: "#f8f9fa", borderBottom: "1px solid #e5e7eb" }}>
                      <th
                        colSpan={6}
                        style={{ padding: "6px 12px", textAlign: "left", borderRight: "1px solid #e5e7eb" }}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#9ca3af", display: "inline-block" }} />
                          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6b7280" }}>
                            Master Data — Managed by Admin
                          </span>
                        </span>
                      </th>
                      <th
                        colSpan={4}
                        style={{ padding: "6px 12px", textAlign: "left", background: "#eff6ff", borderBottom: "1px solid #bfdbfe" }}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#3b82f6" }}>
                            Live — Updated from Daily Reports
                          </span>
                          <PulseDot />
                        </span>
                      </th>
                      <th style={{ padding: "6px 12px" }} />
                    </tr>
                    {/* Tier 2: column labels */}
                    <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                      {/* Master columns */}
                      {[
                        { label: "OWN.",         w: 110 },
                        { label: "EQ #",         w: 120 },
                        { label: "NAME",         w: 160 },
                        { label: "SIZE",         w: 96  },
                        { label: "BRAND",        w: 130 },
                      ].map(({ label, w }) => (
                        <th key={label} style={{ minWidth: w, padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#6b7280", letterSpacing: "0.05em", background: "#fff", borderBottom: "2px solid #e5e7eb" }}>
                          {label}
                        </th>
                      ))}
                      <th style={{ minWidth: 110, padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#6b7280", letterSpacing: "0.05em", background: "#fff", borderBottom: "2px solid #e5e7eb", borderRight: "1px solid #cbd5e1" }}>
                        LOCATION
                      </th>
                      {/* Live columns */}
                      {[
                        { label: "PROJECT",      w: 192 },
                        { label: "TEAM",         w: 110 },
                        { label: "STATUS",       w: 132 },
                        { label: "LAST UPDATED", w: 120 },
                      ].map(({ label, w }) => (
                        <th key={label} style={{ minWidth: w, padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#3b82f6", letterSpacing: "0.05em", background: "#f0f6ff", borderBottom: "2px solid #bfdbfe" }}>
                          {label}
                        </th>
                      ))}
                      <th style={{ minWidth: 64, padding: "10px 12px", background: "#fff", borderBottom: "2px solid #e5e7eb" }} />
                    </tr>
                  </thead>

                  <tbody>
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
                        <td colSpan={11} style={{ padding: "64px 12px", textAlign: "center" }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 48, height: 48, borderRadius: 16, background: "#f1f5f9" }}>
                              <Wrench style={{ width: 24, height: 24, color: "#94a3b8" }} />
                            </div>
                            <p style={{ fontSize: 14, fontWeight: 500, color: "#475569" }}>
                              {filtered.length === 0 && equipList.length > 0
                                ? "No equipment matches the current filters"
                                : "No equipment registered yet"}
                            </p>
                            <p style={{ fontSize: 12, color: "#94a3b8" }}>
                              {filtered.length === 0 && equipList.length > 0
                                ? "Clear filters to see all equipment"
                                : 'Click "Add Equipment" to register your first piece of equipment'}
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
                            onSaved={() => { setEditingId(null); flashRow(equip.id); }}
                            onCancel={() => setEditingId(null)}
                          />
                        );
                      }

                      const rowBg = isFlashing ? undefined : isConfirming ? "#fef2f2" : isHovered ? "#f8fafc" : undefined;

                      return (
                        <tr
                          key={equip.id}
                          data-testid={`row-equipment-${equip.id}`}
                          className={isFlashing ? "mat-row-flash" : ""}
                          style={{ borderBottom: "1px solid #f1f5f9", background: rowBg, transition: "background 0.15s" }}
                          onMouseEnter={() => setHoverRowId(equip.id)}
                          onMouseLeave={() => setHoverRowId(null)}
                        >
                          {/* OWN. badge */}
                          <td style={{ padding: "12px", minWidth: 110, overflowWrap: "break-word" }}>
                            <OwnershipBadge type={equip.ownershipType ?? "Rental"} />
                          </td>

                          {/* EQ # monospace badge */}
                          <td style={{ padding: "12px", minWidth: 120, overflowWrap: "break-word" }}>
                            <span
                              data-testid={`text-equip-no-${equip.id}`}
                              style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 600, color: "#374151", background: "#f1f5f9", padding: "2px 6px", borderRadius: 4, border: "1px solid #e2e8f0", whiteSpace: "nowrap" }}
                            >
                              {equip.equipNo}
                            </span>
                          </td>

                          {/* NAME — single line */}
                          <td style={{ padding: "12px", minWidth: 160, overflowWrap: "break-word" }}>
                            <p data-testid={`text-equip-name-${equip.id}`} style={{ fontWeight: 500, color: "#1e293b", fontSize: 13 }}>
                              {equip.name}
                            </p>
                          </td>

                          {/* SIZE badge */}
                          <td style={{ padding: "12px", minWidth: 96, overflowWrap: "break-word" }}>
                            {equip.sizeSpec ? (
                              <span
                                data-testid={`text-equip-size-${equip.id}`}
                                style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", fontSize: 11, fontWeight: 600, background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0", borderRadius: 4, whiteSpace: "nowrap" }}
                              >
                                {equip.sizeSpec}
                              </span>
                            ) : (
                              <span style={{ color: "#d1d5db", fontSize: 12 }}>—</span>
                            )}
                          </td>

                          {/* BRAND */}
                          <td style={{ padding: "12px", minWidth: 130, overflowWrap: "break-word" }}>
                            <span data-testid={`text-equip-brand-${equip.id}`} style={{ color: "#475569", fontSize: 12 }}>
                              {equip.brand ?? "—"}
                            </span>
                          </td>

                          {/* LOCATION */}
                          <td style={{ padding: "12px", minWidth: 110, borderRight: "1px solid #e2e8f0", overflowWrap: "break-word" }}>
                            {equip.location ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <MapPin style={{ width: 12, height: 12, color: "#94a3b8", flexShrink: 0 }} />
                                <span data-testid={`text-equip-location-${equip.id}`} style={{ color: "#475569", fontSize: 12 }}>
                                  {equip.location}
                                </span>
                              </div>
                            ) : (
                              <span style={{ color: "#d1d5db", fontSize: 12 }}>—</span>
                            )}
                          </td>

                          {/* PROJECT chip (live) */}
                          <td style={{ padding: "12px", minWidth: 192, background: "#fafcff", overflowWrap: "break-word" }}>
                            {equip.project ? (
                              <span
                                data-testid={`text-equip-project-${equip.id}`}
                                style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", fontSize: 11, fontWeight: 500, background: "#f5f3ff", color: "#6d28d9", border: "1px solid #ddd6fe", borderRadius: 12, whiteSpace: "nowrap" }}
                              >
                                {equip.project.name}
                              </span>
                            ) : (
                              <span style={{ fontSize: 11, color: "#d1d5db", border: "1px dashed #e2e8f0", padding: "2px 8px", borderRadius: 12 }}>
                                Unassigned
                              </span>
                            )}
                          </td>

                          {/* TEAM chip (live) */}
                          <td style={{ padding: "12px", minWidth: 110, background: "#fafcff", overflowWrap: "break-word" }}>
                            {(equip as any).teamName ? (
                              <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", fontSize: 11, fontWeight: 600, background: "#f0fdf4", color: "#166534", border: "1px solid #86efac", borderRadius: 12, whiteSpace: "nowrap" }}>
                                {(equip as any).teamName}
                              </span>
                            ) : (
                              <span style={{ color: "#d1d5db", fontSize: 12 }}>—</span>
                            )}
                          </td>

                          {/* STATUS dot + label (live) */}
                          <td style={{ padding: "12px", minWidth: 132, background: "#fafcff", overflowWrap: "break-word" }}>
                            <StatusBadge status={equip.status} />
                          </td>

                          {/* LAST UPDATED (live) */}
                          <td style={{ padding: "12px", minWidth: 120, background: "#fafcff", overflowWrap: "break-word" }}>
                            {updatedFmt ? (
                              <div>
                                <p style={{ fontSize: 11, fontWeight: 500, color: "#475569", lineHeight: 1 }}>{updatedFmt.date}</p>
                                <p style={{ fontSize: 10, color: "#94a3b8", marginTop: 3, lineHeight: 1 }}>{updatedFmt.time}</p>
                              </div>
                            ) : (
                              <span style={{ color: "#d1d5db", fontSize: 12 }}>—</span>
                            )}
                          </td>

                          {/* Hover-reveal actions */}
                          <td style={{ padding: "12px", minWidth: 64 }}>
                            <div
                              style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 2, transition: "opacity 0.15s", opacity: (isHovered || isConfirming) ? 1 : 0 }}
                            >
                              {isConfirming ? (
                                <>
                                  <span style={{ fontSize: 12, color: "#dc2626", fontWeight: 500, marginRight: 4, whiteSpace: "nowrap" }}>Remove?</span>
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
                    <Button data-testid="btn-page-prev" variant="outline" size="sm" className="h-7 w-7 p-0"
                      disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </Button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <Button key={p} data-testid={`btn-page-${p}`}
                        variant={p === page ? "default" : "outline"} size="sm"
                        className="h-7 w-7 p-0 text-xs" onClick={() => setPage(p)}>
                        {p}
                      </Button>
                    ))}
                    <Button data-testid="btn-page-next" variant="outline" size="sm" className="h-7 w-7 p-0"
                      disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
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
