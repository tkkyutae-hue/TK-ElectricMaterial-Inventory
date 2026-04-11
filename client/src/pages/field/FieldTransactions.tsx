import { useState, useMemo } from "react";
import { useSearch } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMovements, useBulkDeleteMovements, useBulkRestoreMovements } from "@/hooks/use-transactions";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { FieldMovementBadge } from "@/components/StatusBadge";
import DraftMovementsList from "./DraftMovementsList";
import FieldRequestsList from "./FieldRequestsList";
import {
  Search, ClipboardList, ImageOff, CalendarDays,
  Trash2, X, AlertTriangle, FileText, Pencil,
  ClipboardCheck,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, startOfDay, endOfDay, formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { EditTransactionDrawer, EditSuccessToast } from "@/components/EditTransactionDrawer";
import { F } from "@/lib/fieldTokens";

// ─── Types ────────────────────────────────────────────────────────────────────

type MovementTypeFilter = "all" | "receive" | "issue" | "return" | "transfer" | "adjust";

// ─── Photo Cell — React state fallback (no innerHTML) ─────────────────────────

function PhotoCell({ imageUrl, name }: { imageUrl?: string | null; name: string }) {
  const [broken, setBroken] = useState(false);

  const placeholder = (
    <div style={{
      width: 36, height: 36, borderRadius: 6, background: F.surface2,
      border: `1px solid ${F.borderStrong}`, display: "flex", alignItems: "center",
      justifyContent: "center", flexShrink: 0, margin: "0 auto",
    }}>
      <ImageOff style={{ width: 15, height: 15, color: F.textDim }} />
    </div>
  );

  if (!imageUrl || broken) return placeholder;

  return (
    <img
      src={imageUrl}
      alt={name}
      style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover", flexShrink: 0, border: `1px solid ${F.borderStrong}`, display: "block", margin: "0 auto" }}
      onError={() => setBroken(true)}
    />
  );
}

// ─── Qty colour helper ────────────────────────────────────────────────────────

function qtyColor(type: string): string {
  if (type === "issue")    return F.danger;
  if (type === "transfer") return F.info;
  if (type === "adjust")   return F.warning;
  return F.accent;
}

// ─── Shared input / label styles ──────────────────────────────────────────────

const INPUT_STYLE: React.CSSProperties = {
  background: F.surface, border: `1px solid ${F.borderStrong}`, borderRadius: 7,
  padding: "8px 10px", color: F.text, fontSize: 12, width: "100%", outline: "none",
};

const LABEL_STYLE: React.CSSProperties = {
  display: "block", fontSize: 9, fontWeight: 700, color: F.textMuted,
  textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: 5,
};

// ─── Type Quick-Filter Pill ───────────────────────────────────────────────────

const TYPE_PILLS: { value: MovementTypeFilter; label: string; color: string; activeBg: string; activeBorder: string }[] = [
  { value: "all",      label: "ALL",      color: "#7aab82", activeBg: "rgba(122,171,130,0.14)", activeBorder: "rgba(122,171,130,0.40)" },
  { value: "receive",  label: "RECEIVE",  color: "#2ddb6f", activeBg: "rgba(45,219,111,0.13)",  activeBorder: "rgba(45,219,111,0.40)" },
  { value: "return",   label: "RETURN",   color: "#2ddb6f", activeBg: "rgba(45,219,111,0.13)",  activeBorder: "rgba(45,219,111,0.40)" },
  { value: "issue",    label: "ISSUE",    color: "#ff5050", activeBg: "rgba(255,80,80,0.12)",   activeBorder: "rgba(255,80,80,0.40)" },
  { value: "transfer", label: "TRANSFER", color: "#5b9cf6", activeBg: "rgba(91,156,246,0.13)",  activeBorder: "rgba(91,156,246,0.40)" },
  { value: "adjust",   label: "ADJUST",   color: "#f5a623", activeBg: "rgba(245,166,35,0.12)",  activeBorder: "rgba(245,166,35,0.40)" },
];

function TypePillFilter({
  value,
  onChange,
}: { value: MovementTypeFilter; onChange: (v: MovementTypeFilter) => void }) {
  return (
    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
      {TYPE_PILLS.map(p => {
        const active = value === p.value;
        return (
          <button
            key={p.value}
            type="button"
            onClick={() => onChange(p.value)}
            data-testid={`field-tx-type-${p.value}`}
            style={{
              padding: "4px 11px", borderRadius: 6, cursor: "pointer",
              fontSize: 10, fontWeight: 800, letterSpacing: "0.07em",
              fontFamily: "'Barlow Condensed', sans-serif",
              color: p.color,
              background: active ? p.activeBg : "rgba(255,255,255,0.03)",
              border: `1px solid ${active ? p.activeBorder : "rgba(255,255,255,0.06)"}`,
              transition: "background 0.12s, border-color 0.12s",
            }}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Field Input with focus ring ──────────────────────────────────────────────

function FieldInput(props: React.InputHTMLAttributes<HTMLInputElement> & { icon?: React.ReactNode }) {
  const { icon, style, onFocus, onBlur, ...rest } = props;
  return (
    <div style={{ position: "relative" }}>
      {icon && (
        <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
          {icon}
        </span>
      )}
      <input
        style={{ ...INPUT_STYLE, paddingLeft: icon ? 28 : undefined, ...style }}
        onFocus={e => {
          e.currentTarget.style.borderColor = F.accent;
          e.currentTarget.style.boxShadow = `0 0 0 3px ${F.accentBg}`;
          onFocus?.(e);
        }}
        onBlur={e => {
          e.currentTarget.style.borderColor = F.borderStrong;
          e.currentTarget.style.boxShadow = "none";
          onBlur?.(e);
        }}
        {...rest}
      />
    </div>
  );
}

// ─── TH style ─────────────────────────────────────────────────────────────────

const TH: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, color: F.textMuted,
  textTransform: "uppercase", letterSpacing: "1px",
  padding: "10px 8px", whiteSpace: "nowrap", background: F.surface2,
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FieldTransactions() {
  const { user }  = useAuth();
  const { t }     = useLanguage();
  const { toast } = useToast();
  const hasDeletePerm = user?.role === "staff" || user?.role === "manager" || user?.role === "admin";

  const urlSearch = useSearch();
  const urlSearchParams = new URLSearchParams(urlSearch);
  const rawTab = urlSearchParams.get("tab");
  const [activeTab, setActiveTab] = useState<"history" | "drafts" | "requests">(
    rawTab === "drafts" ? "drafts"
      : rawTab === "requests" ? "requests"
      : "history"
  );

  // ── Filters ──
  const [search,        setSearch]        = useState("");
  const [typeFilter,    setTypeFilter]    = useState<MovementTypeFilter>("all");
  const [fromFilter,    setFrom]          = useState("all");
  const [toFilter,      setTo]            = useState("all");
  const [projectFilter, setProj]          = useState("all");
  const [dateFrom,      setDateFrom]      = useState("");
  const [dateTo,        setDateTo]        = useState("");

  // ── Selection ──
  const [selectedIds,   setSelectedIds]   = useState<Set<number>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [confirmOpen,   setConfirmOpen]   = useState(false);
  const [editTx,        setEditTx]        = useState<any | null>(null);
  const [successToast,  setSuccessToast]  = useState<{ txId: number } | null>(null);

  // ── Pagination ──
  const [pageSize,     setPageSize]     = useState(10);
  const [currentPage,  setCurrentPage]  = useState(1);
  const [pageSizeOpen, setPageSizeOpen] = useState(false);

  const { data: movements, isLoading } = useMovements();
  const bulkDelete  = useBulkDeleteMovements();
  const bulkRestore = useBulkRestoreMovements();

  // ── Derived filter options ──
  const { fromOptions, toOptions, projectOptions } = useMemo(() => {
    const froms = new Map<string, string>();
    const tos   = new Map<string, string>();
    const projs = new Map<string, string>();
    (movements ?? []).forEach(m => {
      const mx = m as any;
      if (mx.sourceLocation)      froms.set(String(mx.sourceLocation.id), mx.sourceLocation.name);
      if (mx.destinationLocation) tos.set(String(mx.destinationLocation.id), mx.destinationLocation.name);
      if (mx.project)             projs.set(String(mx.project.id), mx.project.poNumber ? `${mx.project.name} / ${mx.project.poNumber}` : mx.project.name);
    });
    return {
      fromOptions:    Array.from(froms.entries()),
      toOptions:      Array.from(tos.entries()),
      projectOptions: Array.from(projs.entries()),
    };
  }, [movements]);

  // ── Filtering ──
  const filtered = useMemo(() => (movements ?? []).filter(m => {
    const mx       = m as any;
    const item     = mx.item;
    const q        = search.toLowerCase();
    if (q && !item?.name?.toLowerCase().includes(q) && !item?.sku?.toLowerCase().includes(q) && !String(m.id).includes(q)) return false;
    if (typeFilter !== "all" && m.movementType !== typeFilter) return false;
    if (fromFilter !== "all" && String(mx.sourceLocation?.id) !== fromFilter) return false;
    if (toFilter   !== "all" && String(mx.destinationLocation?.id) !== toFilter) return false;
    if (projectFilter !== "all" && String(mx.project?.id) !== projectFilter) return false;
    const moved = new Date(m.createdAt ?? "");
    if (dateFrom && moved < startOfDay(new Date(dateFrom + "T00:00:00"))) return false;
    if (dateTo   && moved > endOfDay(new Date(dateTo + "T00:00:00")))     return false;
    return true;
  }), [movements, search, typeFilter, fromFilter, toFilter, projectFilter, dateFrom, dateTo]);

  const totalPages  = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage    = Math.min(currentPage, totalPages);
  const paginated   = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const paginatedIds = paginated.map(m => m.id);
  const allSelected  = paginatedIds.length > 0 && paginatedIds.every(id => selectedIds.has(id));

  function toggleRow(id: number) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(prev => { const n = new Set(prev); paginatedIds.forEach(id => n.delete(id)); return n; });
    } else {
      setSelectedIds(prev => { const n = new Set(prev); paginatedIds.forEach(id => n.add(id)); return n; });
    }
  }

  function clearSelection() { setSelectedIds(new Set()); }

  async function handleDelete() {
    const ids = Array.from(selectedIds);
    const count = ids.length;
    const snapshots = (movements ?? [])
      .filter(m => selectedIds.has(m.id))
      .map(m => {
        const raw = m as any;
        return {
          itemId: raw.itemId, movementType: raw.movementType,
          quantity: raw.quantity, previousQuantity: raw.previousQuantity,
          newQuantity: raw.newQuantity, sourceLocationId: raw.sourceLocationId ?? null,
          destinationLocationId: raw.destinationLocationId ?? null,
          projectId: raw.projectId ?? null, unitCostSnapshot: raw.unitCostSnapshot ?? null,
          referenceType: raw.referenceType ?? null, referenceId: raw.referenceId ?? null,
          note: raw.note ?? null, reason: raw.reason ?? null,
          createdBy: raw.createdBy ?? null, createdAt: raw.createdAt ?? null,
        };
      });
    try {
      await bulkDelete.mutateAsync(ids);
      clearSelection();
      setConfirmOpen(false);
      toast({
        title: `${count} transaction${count !== 1 ? "s" : ""} deleted`,
        duration: 8000,
        action: (
          <button
            className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
            onClick={async () => {
              try {
                await bulkRestore.mutateAsync(snapshots);
                toast({ title: `${count} transaction${count !== 1 ? "s" : ""} restored` });
              } catch (err: any) {
                toast({ title: "Restore failed", description: err.message, variant: "destructive" });
              }
            }}
          >
            Undo
          </button>
        ) as any,
      });
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
  }

  function exportCsv() {
    const rows = [
      ["#", "Type", "SKU", "Item", "Size", "Qty", "Unit", "From", "To", "Project", "PO", "Note", "Date"],
      ...filtered.map((m, idx) => {
        const mx = m as any;
        const item = mx.item;
        return [
          idx + 1, m.movementType, item?.sku ?? "", item?.name ?? m.itemId,
          item?.sizeLabel ?? "", m.quantity, item?.unitOfMeasure ?? "",
          mx.sourceLocation?.name ?? "", mx.destinationLocation?.name ?? "",
          mx.project?.name ?? "", mx.project?.poNumber ?? "", m.note ?? "",
          m.createdAt ? format(new Date(m.createdAt), "yyyy-MM-dd HH:mm") : "",
        ];
      }),
    ];
    const csv  = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `transactions-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const selCount   = selectedIds.size;
  const canEdit    = selCount === 1;
  const canDelete  = selCount >= 1;
  const selectedTx = selCount === 1 ? (filtered ?? []).find(m => selectedIds.has(m.id)) ?? null : null;
  const hasActiveFilters = typeFilter !== "all" || fromFilter !== "all" || toFilter !== "all" || projectFilter !== "all" || !!dateFrom || !!dateTo;

  const COLS_COUNT = 11;

  return (
    <div className="space-y-4 pt-5 pb-8">

      {/* ── Header ── */}
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <ClipboardList style={{ width: 20, height: 20, color: F.accent }} />
          <h1 style={{ fontSize: 24, fontWeight: 700, color: F.text, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.04em" }}>
            {t.transactions}
          </h1>
        </div>
        <p style={{ fontSize: 13, color: F.textMuted }}>
          {selCount > 0 ? `${selCount} ${t.selected}` : t.viewHistory}
        </p>
      </div>

      {/* ── Tab Switcher + Export CSV ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", gap: 2, background: F.bg, border: `1px solid ${F.borderStrong}`, borderRadius: 10, padding: 3, width: "fit-content", flexWrap: "wrap" }}>
          {/* History */}
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            data-testid="tab-history"
            style={{ background: activeTab === "history" ? F.surface : "transparent", border: activeTab === "history" ? `1px solid ${F.borderStrong}` : "1px solid transparent", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, color: activeTab === "history" ? F.text : F.textDim, cursor: "pointer", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5, transition: "all 0.15s" }}
          >
            {t.txHistoryTab}
          </button>
          {/* Requests */}
          <button
            type="button"
            onClick={() => setActiveTab("requests")}
            data-testid="tab-requests"
            style={{ background: activeTab === "requests" ? F.surface : "transparent", border: activeTab === "requests" ? `1px solid ${F.borderStrong}` : "1px solid transparent", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, color: activeTab === "requests" ? F.info : F.textDim, cursor: "pointer", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5, transition: "all 0.15s", display: "flex", alignItems: "center", gap: 5 }}
          >
            <ClipboardCheck style={{ width: 12, height: 12 }} />
            {t.txRequestsTab}
          </button>
          {/* Drafts */}
          <button
            type="button"
            onClick={() => setActiveTab("drafts")}
            data-testid="tab-drafts"
            style={{ background: activeTab === "drafts" ? F.surface : "transparent", border: activeTab === "drafts" ? `1px solid ${F.borderStrong}` : "1px solid transparent", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, color: activeTab === "drafts" ? F.warning : F.textDim, cursor: "pointer", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5, transition: "all 0.15s", display: "flex", alignItems: "center", gap: 5 }}
          >
            <FileText style={{ width: 12, height: 12 }} />
            {t.txDraftsTab}
          </button>
        </div>

        {activeTab === "history" && filtered.length > 0 && (
          <button
            onClick={exportCsv}
            data-testid="btn-export-csv"
            style={{ fontSize: 11, color: F.textMuted, background: F.surface, border: `1px solid ${F.borderStrong}`, borderRadius: 7, padding: "5px 13px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600 }}
          >
            {t.exportCsv} ↓
          </button>
        )}
      </div>

      {/* ── Requests Tab ── */}
      {activeTab === "requests" && <FieldRequestsList />}

      {/* ── Drafts Tab ── */}
      {activeTab === "drafts" && <DraftMovementsList />}

      {/* ── History Tab ── */}
      {activeTab === "history" && (
        <>
          {/* ── Filter Panel ── */}
          <div style={{ background: F.surface2, border: `1px solid ${F.borderStrong}`, borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Row 1: Type quick-filter pills */}
            <div>
              <label style={LABEL_STYLE}>{t.colType}</label>
              <TypePillFilter value={typeFilter} onChange={v => { setTypeFilter(v); setCurrentPage(1); }} />
            </div>

            {/* Row 2: Search + location + project selects */}
            <div className="grid gap-3" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr" }}>
              {/* Search */}
              <div>
                <label style={LABEL_STYLE}>{t.txSearch}</label>
                <FieldInput
                  type="text"
                  placeholder={t.txSearchPlaceholder}
                  value={search}
                  onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                  data-testid="field-tx-search"
                  icon={<Search style={{ width: 13, height: 13, color: F.textDim }} />}
                  style={{ fontFamily: "'Barlow', sans-serif" }}
                />
              </div>

              {/* From */}
              <div>
                <label style={LABEL_STYLE}>{t.txFrom}</label>
                <Select value={fromFilter} onValueChange={v => { setFrom(v); setCurrentPage(1); }}>
                  <SelectTrigger className="w-full h-[37px] text-xs" style={{ background: F.surface, border: `1px solid ${F.borderStrong}`, color: F.text, borderRadius: 7 }} data-testid="field-tx-from-filter">
                    <SelectValue placeholder={t.allFilter} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t.allFilter}</SelectItem>
                    {fromOptions.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* To */}
              <div>
                <label style={LABEL_STYLE}>{t.txTo}</label>
                <Select value={toFilter} onValueChange={v => { setTo(v); setCurrentPage(1); }}>
                  <SelectTrigger className="w-full h-[37px] text-xs" style={{ background: F.surface, border: `1px solid ${F.borderStrong}`, color: F.text, borderRadius: 7 }} data-testid="field-tx-to-filter">
                    <SelectValue placeholder={t.allFilter} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t.allFilter}</SelectItem>
                    {toOptions.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Project */}
              <div>
                <label style={LABEL_STYLE}>{t.txProject}</label>
                <Select value={projectFilter} onValueChange={v => { setProj(v); setCurrentPage(1); }}>
                  <SelectTrigger className="w-full h-[37px] text-xs" style={{ background: F.surface, border: `1px solid ${F.borderStrong}`, color: F.text, borderRadius: 7 }} data-testid="field-tx-project-filter">
                    <SelectValue placeholder={t.allFilter} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t.allFilter}</SelectItem>
                    {projectOptions.map(([id, label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 3: Date range */}
            <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr auto" }}>
              <div>
                <label style={LABEL_STYLE}>{t.txDateFrom}</label>
                <FieldInput
                  type="date"
                  value={dateFrom}
                  onChange={e => { setDateFrom(e.target.value); setCurrentPage(1); }}
                  data-testid="field-tx-date-from"
                  style={{ colorScheme: "dark" }}
                  icon={<CalendarDays style={{ width: 12, height: 12, color: F.textDim }} />}
                />
              </div>
              <div>
                <label style={LABEL_STYLE}>{t.txDateTo}</label>
                <FieldInput
                  type="date"
                  value={dateTo}
                  onChange={e => { setDateTo(e.target.value); setCurrentPage(1); }}
                  data-testid="field-tx-date-to"
                  style={{ colorScheme: "dark" }}
                  icon={<CalendarDays style={{ width: 12, height: 12, color: F.textDim }} />}
                />
              </div>
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                {hasActiveFilters && (
                  <button
                    onClick={() => {
                      setSearch(""); setTypeFilter("all"); setFrom("all"); setTo("all");
                      setProj("all"); setDateFrom(""); setDateTo(""); setCurrentPage(1);
                    }}
                    data-testid="field-tx-date-clear"
                    style={{ fontSize: 11, color: F.textMuted, background: "none", border: `1px solid ${F.borderStrong}`, borderRadius: 6, padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}
                  >
                    <X style={{ width: 11, height: 11 }} /> Clear all
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── Table ── */}
          <div style={{ border: `1px solid ${F.borderStrong}`, borderRadius: 12, overflow: "hidden" }}>
            <table style={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse" }}>
              <colgroup>
                {/* #, Type, Photo, Item, Size, Qty, From→To, Project, Date, Note, Select */}
                <col style={{ width: 36 }} />
                <col style={{ width: 82 }} />
                <col style={{ width: 42 }} />
                <col />
                <col style={{ width: 56 }} />
                <col style={{ width: 62 }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 70 }} />
                <col style={{ width: 68 }} />
              </colgroup>
              <thead>
                <tr style={{ borderBottom: `1px solid ${F.borderStrong}` }}>
                  <th style={{ ...TH, textAlign: "center" }}>#</th>
                  <th style={{ ...TH, textAlign: "center" }}>{t.colType}</th>
                  <th style={TH}>{t.colPhoto}</th>
                  <th style={TH}>{t.colItem}</th>
                  <th style={{ ...TH, textAlign: "center" }}>{t.colSize}</th>
                  <th style={{ ...TH, textAlign: "center" }}>{t.colQtyUnit}</th>
                  <th style={{ ...TH, textAlign: "center" }}>{t.colFromTo}</th>
                  <th style={{ ...TH, textAlign: "center" }}>{t.colProjectPo}</th>
                  <th style={{ ...TH, textAlign: "center" }}>{t.colDate}</th>
                  <th style={{ ...TH, textAlign: "center" }}>{t.colNote}</th>
                  <th style={{ ...TH, padding: "8px 6px", textAlign: "center", borderLeft: `1px solid ${F.borderStrong}`, background: selectionMode ? F.surface : F.surface2 }}>
                    {selectionMode ? (
                      <div
                        role="checkbox"
                        aria-checked={allSelected}
                        onClick={toggleAll}
                        data-testid="field-checkbox-select-all-right"
                        title="Select all"
                        style={{ width: 15, height: 15, borderRadius: 4, border: `1.5px solid ${allSelected ? F.accent : F.textDim}`, background: allSelected ? F.accent : "transparent", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}
                      >
                        {allSelected && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke={F.accentText} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setSelectionMode(true); setSelectedIds(new Set()); }}
                        data-testid="btn-selection-mode-toggle"
                        onMouseEnter={e => { const el = e.currentTarget as HTMLButtonElement; el.style.background = "rgba(45,219,111,0.16)"; el.style.borderColor = "rgba(45,219,111,0.55)"; el.style.color = F.accent; }}
                        onMouseLeave={e => { const el = e.currentTarget as HTMLButtonElement; el.style.background = F.accentBg; el.style.borderColor = F.accentBorder; el.style.color = F.textMuted; }}
                        style={{ display: "block", width: "100%", padding: "6px 0", background: F.accentBg, border: `1px solid ${F.accentBorder}`, borderRadius: 6, color: F.textMuted, fontSize: 10, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.10em", textTransform: "uppercase", cursor: "pointer", lineHeight: 1, textAlign: "center" }}
                      >
                        {t.selectBtn}
                      </button>
                    )}
                  </th>
                </tr>
              </thead>

              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={COLS_COUNT} style={{ textAlign: "center", padding: "48px 0", fontSize: 13, color: F.textMuted }}>{t.loading}</td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={COLS_COUNT} style={{ textAlign: "center", padding: "48px 0", fontSize: 13, color: F.textMuted }}>{t.noTransactions}</td>
                  </tr>
                ) : paginated.map((m, idx) => {
                  const mx        = m as any;
                  const item      = mx.item;
                  const fromLoc   = mx.sourceLocation;
                  const toLoc     = mx.destinationLocation;
                  const project   = mx.project;
                  const isSelected = selectedIds.has(m.id);
                  const isEdited   = !!(mx.editedAt);
                  const editHistory: any[] = Array.isArray(mx.editHistory) ? mx.editHistory : [];
                  const lastEdit = editHistory[editHistory.length - 1];
                  const editLabel = lastEdit
                    ? `edited by ${(lastEdit.editedBy ?? "").replace("@tkelectricllc.us","").split("_").map((p: string) => p[0]?.toUpperCase() + p.slice(1)).join(" ")} · ${formatDistanceToNow(new Date(lastEdit.editedAt), { addSuffix: true })}`
                    : "edited";

                  return (
                    <tr
                      key={m.id}
                      data-testid={`field-tx-row-${m.id}`}
                      style={{
                        background: isSelected ? F.accentBg : F.surface2,
                        borderBottom: `1px solid ${F.border}`,
                        borderLeft: isSelected ? `3px solid ${F.accent}` : "3px solid transparent",
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = F.surface; }}
                      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = F.surface2; }}
                    >
                      {/* # */}
                      <td style={{ padding: "12px 8px", fontFamily: "monospace", fontSize: 11, color: F.textMuted, textAlign: "center" }}>
                        {(safePage - 1) * pageSize + idx + 1}
                      </td>

                      {/* Type */}
                      <td style={{ padding: "10px 8px", textAlign: "center" }}>
                        <FieldMovementBadge type={m.movementType} past />
                      </td>

                      {/* Photo */}
                      <td style={{ padding: "8px 2px", textAlign: "center" }}>
                        <PhotoCell imageUrl={item?.imageUrl} name={item?.name ?? ""} />
                      </td>

                      {/* Item name + subcategory (highest priority) */}
                      <td style={{ padding: "12px 8px" }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: F.text, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item?.name ?? `#${m.itemId}`}
                        </p>
                        {item?.extractedSubcategory && (
                          <p style={{ fontSize: 10, color: F.textMuted, lineHeight: 1.3, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.extractedSubcategory}
                          </p>
                        )}
                      </td>

                      {/* Size */}
                      <td style={{ padding: "12px 6px", fontSize: 11, color: F.textSub, whiteSpace: "nowrap", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 0 }}>
                        {item?.sizeLabel || <span style={{ color: F.textDim }}>—</span>}
                      </td>

                      {/* Qty + Unit (large, high-contrast) */}
                      <td style={{ padding: "12px 8px", whiteSpace: "nowrap", textAlign: "center" }}>
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 18, color: qtyColor(m.movementType), letterSpacing: "-0.01em" }}>
                          {m.quantity}
                        </span>
                        {item?.unitOfMeasure && (
                          <span style={{ marginLeft: 4, fontSize: 9, color: F.textMuted, textTransform: "uppercase", display: "block", marginTop: 1 }}>
                            {item.unitOfMeasure}
                          </span>
                        )}
                      </td>

                      {/* From → To (location) */}
                      <td style={{ padding: "12px 8px", textAlign: "center" }}>
                        <div style={{ fontSize: 11, lineHeight: 1.5, display: "flex", flexDirection: "column", alignItems: "center" }}>
                          <span style={{ color: F.textSub, fontWeight: 500, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
                            {fromLoc?.name ?? <span style={{ color: F.textDim }}>—</span>}
                          </span>
                          <span style={{ color: F.textMuted, fontSize: 9 }}>↓</span>
                          <span style={{ color: F.text, fontWeight: 700, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
                            {toLoc?.name ?? "—"}
                          </span>
                        </div>
                      </td>

                      {/* Project / PO */}
                      <td style={{ padding: "12px 8px", textAlign: "center" }}>
                        {project?.name || project?.poNumber ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "center" }}>
                            {project?.name && (
                              <span style={{ fontSize: 11, fontWeight: 600, color: F.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block", maxWidth: "100%" }}>
                                {project.name}
                              </span>
                            )}
                            {project?.poNumber && (
                              <span style={{ fontSize: 9, color: F.textMuted }}>{project.poNumber}</span>
                            )}
                          </div>
                        ) : <span style={{ color: F.textDim, fontSize: 12 }}>—</span>}
                      </td>

                      {/* Date (secondary — moved after primary info) */}
                      <td style={{ padding: "12px 8px", textAlign: "center" }}>
                        {m.createdAt ? (
                          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.5, alignItems: "center" }}>
                            <span style={{ fontSize: 11, fontWeight: 500, color: F.text }}>
                              {format(new Date(m.createdAt), "MMM d, yyyy")}
                            </span>
                            <span style={{ fontSize: 10, color: F.textMuted }}>
                              {format(new Date(m.createdAt), "HH:mm")}
                            </span>
                            {isEdited && (
                              <span
                                title={editLabel}
                                data-testid={`field-edited-tag-${m.id}`}
                                style={{ marginTop: 3, display: "inline-flex", alignItems: "center", gap: 2, background: "rgba(167,139,250,0.10)", border: "1px solid rgba(167,139,250,0.28)", color: "#a78bfa", padding: "1px 5px", borderRadius: 3, fontSize: 7, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap", cursor: "default" }}
                              >
                                ✎ EDITED
                              </span>
                            )}
                          </div>
                        ) : <span style={{ color: F.textDim }}>—</span>}
                      </td>

                      {/* Note */}
                      <td style={{ padding: "12px 8px", fontSize: 11, color: F.textMuted, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {m.note || <span style={{ color: F.textDim }}>—</span>}
                      </td>

                      {/* Select */}
                      <td
                        style={{ padding: "12px 6px", textAlign: "center", borderLeft: `1px solid ${F.borderStrong}`, background: isSelected ? F.accentBg : selectionMode ? F.surface : F.surface2 }}
                        onClick={e => { if (selectionMode) { e.stopPropagation(); toggleRow(m.id); } }}
                      >
                        {selectionMode ? (
                          <div
                            role="checkbox"
                            aria-checked={isSelected}
                            data-testid={`field-checkbox-sel-${m.id}`}
                            style={{ width: 15, height: 15, borderRadius: 4, border: `1.5px solid ${isSelected ? F.accent : F.textDim}`, background: isSelected ? F.accent : "transparent", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}
                          >
                            {isSelected && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke={F.accentText} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          </div>
                        ) : (
                          <span style={{ color: F.textDim, fontSize: 10 }}>·</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* ── Persistent action bar (bottom of table) ── */}
            <div style={{ borderTop: `1px solid ${F.borderStrong}`, background: F.bg, padding: "10px 16px", display: "flex", alignItems: "center", fontFamily: "'Barlow Condensed', sans-serif" }}>
              {/* Left: showing count */}
              <span style={{ fontSize: 11, color: F.textMuted, flex: 1 }}>
                Showing{" "}
                <strong style={{ color: F.text }}>
                  {filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)}
                </strong>
                {" "}of <strong style={{ color: F.text }}>{filtered.length}</strong>
              </span>

              {/* Center: page-size + pagination */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ position: "relative" }}>
                  <button
                    type="button"
                    onClick={() => setPageSizeOpen(o => !o)}
                    data-testid="btn-page-size-toggle"
                    style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 9px", borderRadius: 7, background: pageSizeOpen ? F.accentBg : F.surface2, border: `1px solid ${pageSizeOpen ? F.accentBorder : F.borderStrong}`, color: pageSizeOpen ? F.accent : F.textMuted, fontSize: 11, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.04em", cursor: "pointer" }}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.7 }}><rect x="1" y="2" width="10" height="1.5" rx="0.75" fill="currentColor"/><rect x="1" y="5.25" width="10" height="1.5" rx="0.75" fill="currentColor"/><rect x="1" y="8.5" width="10" height="1.5" rx="0.75" fill="currentColor"/></svg>
                    {pageSize}
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ opacity: 0.6 }}><path d="M1.5 3L4 5.5L6.5 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                  {pageSizeOpen && (
                    <div style={{ position: "absolute", bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)", background: F.surface2, border: `1px solid ${F.borderStrong}`, borderRadius: 9, padding: 4, zIndex: 50, display: "flex", flexDirection: "column", gap: 2, minWidth: 72, boxShadow: "0 4px 16px rgba(0,0,0,0.45)" }}>
                      {[10, 15, 25, 35, 45].map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => { setPageSize(n); setCurrentPage(1); setPageSizeOpen(false); }}
                          data-testid={`btn-page-size-${n}`}
                          style={{ padding: "6px 10px", borderRadius: 6, textAlign: "center", background: pageSize === n ? F.accentBg : "transparent", border: `1px solid ${pageSize === n ? F.accentBorder : "transparent"}`, color: pageSize === n ? F.accent : F.textMuted, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.04em" }}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button type="button" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={safePage <= 1} data-testid="btn-page-prev" style={{ padding: "5px 10px", borderRadius: 7, background: F.surface2, border: `1px solid ${F.borderStrong}`, color: safePage <= 1 ? F.borderStrong : F.textMuted, fontSize: 13, fontWeight: 700, cursor: safePage <= 1 ? "default" : "pointer", fontFamily: "monospace" }}>‹</button>
                <span style={{ fontSize: 11, color: F.textMuted, fontFamily: "monospace", minWidth: 52, textAlign: "center" }}>{safePage} / {totalPages}</span>
                <button type="button" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages} data-testid="btn-page-next" style={{ padding: "5px 10px", borderRadius: 7, background: F.surface2, border: `1px solid ${F.borderStrong}`, color: safePage >= totalPages ? F.borderStrong : F.textMuted, fontSize: 13, fontWeight: 700, cursor: safePage >= totalPages ? "default" : "pointer", fontFamily: "monospace" }}>›</button>
              </div>

              {/* Right: selection actions */}
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                {selectionMode ? (
                  <>
                    {selCount > 0 && <span style={{ fontSize: 11, color: F.textDim, marginRight: 2 }}>{selCount} {t.selected}</span>}
                    <button type="button" onClick={() => { setSelectionMode(false); setSelectedIds(new Set()); }} data-testid="button-field-cancel-select" style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 11px", borderRadius: 7, background: F.surface2, border: `1px solid ${F.borderStrong}`, color: F.textMuted, fontSize: 11, fontWeight: 700, cursor: "pointer", letterSpacing: "0.04em", fontFamily: "'Barlow Condensed', sans-serif" }}>
                      <X style={{ width: 10, height: 10 }} /> {t.cancel}
                    </button>
                    {canEdit && hasDeletePerm && (
                      <button type="button" onClick={() => selectedTx && setEditTx(selectedTx)} disabled={selCount !== 1} data-testid="button-field-edit-selected" style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 11px", borderRadius: 7, background: selCount === 1 ? "rgba(91,156,246,0.12)" : F.surface2, border: `1px solid ${selCount === 1 ? "rgba(91,156,246,0.35)" : F.borderStrong}`, color: selCount === 1 ? "#5b9cf6" : F.textDim, fontSize: 11, fontWeight: 700, cursor: selCount === 1 ? "pointer" : "default", letterSpacing: "0.04em", fontFamily: "'Barlow Condensed', sans-serif" }}>
                        <Pencil style={{ width: 10, height: 10 }} /> Edit
                      </button>
                    )}
                    {canDelete && hasDeletePerm && (
                      <button type="button" onClick={() => setConfirmOpen(true)} data-testid="button-field-delete-selected" style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 11px", borderRadius: 7, background: "rgba(255,80,80,0.14)", border: "1px solid rgba(255,80,80,0.35)", color: "#ff5050", fontSize: 11, fontWeight: 700, cursor: "pointer", letterSpacing: "0.04em", fontFamily: "'Barlow Condensed', sans-serif" }}>
                        <Trash2 style={{ width: 10, height: 10 }} /> Delete ({selCount})
                      </button>
                    )}
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Edit Drawer ── */}
      {editTx && (
        <EditTransactionDrawer
          tx={editTx}
          open={!!editTx}
          onClose={() => setEditTx(null)}
          dark={true}
          onSaved={(updated) => {
            setEditTx(null);
            setSelectedIds(new Set());
            setSuccessToast({ txId: updated.id ?? editTx.id });
          }}
        />
      )}

      {/* ── Edit success toast ── */}
      {successToast && (
        <EditSuccessToast
          txId={successToast.txId}
          dark={true}
          onDismiss={() => setSuccessToast(null)}
        />
      )}

      {/* ── Confirm delete dialog ── */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent style={{ background: F.bg, border: `1px solid ${F.borderStrong}`, borderRadius: 14, maxWidth: 400 }} className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle style={{ color: F.text, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
              <AlertTriangle style={{ width: 18, height: 18, color: "#ff5050" }} />
              Delete {selectedIds.size} Transaction{selectedIds.size !== 1 ? "s" : ""}?
            </DialogTitle>
          </DialogHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 4 }}>
            <p style={{ fontSize: 13, color: F.textMuted, lineHeight: 1.55 }}>
              Inventory counts will be reversed for all selected transactions. You can undo this within 8 seconds after deletion.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" onClick={() => setConfirmOpen(false)} style={{ background: F.surface, border: `1px solid ${F.borderStrong}`, borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, color: F.textMuted, cursor: "pointer", fontFamily: "'Barlow Condensed', sans-serif" }}>
                {t.cancel}
              </button>
              <button type="button" onClick={handleDelete} disabled={bulkDelete.isPending} data-testid="button-confirm-delete" style={{ background: "rgba(255,80,80,0.15)", border: "1px solid rgba(255,80,80,0.35)", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 700, color: "#ff5050", cursor: bulkDelete.isPending ? "not-allowed" : "pointer", fontFamily: "'Barlow Condensed', sans-serif", opacity: bulkDelete.isPending ? 0.7 : 1, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Trash2 style={{ width: 13, height: 13 }} />
                {bulkDelete.isPending ? "Deleting…" : `Delete ${selectedIds.size}`}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
