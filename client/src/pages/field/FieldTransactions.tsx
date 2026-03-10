import { useState, useMemo } from "react";
import { useMovements, useBulkDeleteMovements, useBulkRestoreMovements } from "@/hooks/use-transactions";
import { useAuth } from "@/hooks/use-auth";
import { Search, ClipboardList, ImageOff, CalendarDays, CheckSquare, Square, Trash2, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format, startOfDay, endOfDay } from "date-fns";
import { useToast } from "@/hooks/use-toast";

// ─── Field Type Badge ─────────────────────────────────────────────────────────

function FieldTypeBadge({ type }: { type: string }) {
  const config: Record<string, { label: string; bg: string; color: string; border: string }> = {
    issue:    { label: "ISSUED",    bg: "rgba(255,80,80,0.10)",   color: "#ff5050", border: "1px solid rgba(255,80,80,0.22)" },
    receive:  { label: "RECEIVED",  bg: "rgba(45,219,111,0.10)",  color: "#2ddb6f", border: "1px solid rgba(45,219,111,0.22)" },
    return:   { label: "RETURNED",  bg: "rgba(45,219,111,0.10)",  color: "#2ddb6f", border: "1px solid rgba(45,219,111,0.22)" },
    transfer: { label: "TRANSFER",  bg: "rgba(91,156,246,0.12)",  color: "#5b9cf6", border: "1px solid rgba(91,156,246,0.22)" },
    adjust:   { label: "ADJUSTED",  bg: "rgba(245,166,35,0.10)",  color: "#f5a623", border: "1px solid rgba(245,166,35,0.22)" },
  };
  const { label, bg, color, border } = config[type] || { label: type.toUpperCase(), bg: "rgba(100,116,139,0.10)", color: "#7aab82", border: "1px solid rgba(100,116,139,0.25)" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      background: bg, color, border, borderRadius: 5,
      fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em",
      padding: "2px 7px", whiteSpace: "nowrap",
      fontFamily: "'Barlow Condensed', sans-serif",
    }}>
      {label}
    </span>
  );
}

// ─── Photo Cell ───────────────────────────────────────────────────────────────

function PhotoCell({ imageUrl, name }: { imageUrl?: string | null; name: string }) {
  if (!imageUrl) {
    return (
      <div style={{ width: 32, height: 32, borderRadius: 6, background: "#162019", border: "1px solid #2a4030", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <ImageOff style={{ width: 13, height: 13, color: "#4a7052" }} />
      </div>
    );
  }
  return (
    <img
      src={imageUrl}
      alt={name}
      style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover", flexShrink: 0, border: "1px solid #2a4030" }}
      onError={e => {
        const p = e.currentTarget.parentElement;
        if (p) p.innerHTML = '<div style="width:32px;height:32px;border-radius:6px;background:#162019;border:1px solid #2a4030;display:flex;align-items:center;justify-content:center"><svg style="width:13px;height:13px;color:#4a7052" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg></div>';
      }}
    />
  );
}

// ─── Qty color ────────────────────────────────────────────────────────────────

function qtyColor(type: string): string {
  if (type === "issue") return "#ff5050";
  if (type === "transfer") return "#5b9cf6";
  return "#2ddb6f"; // receive, return, adjust
}

// ─── Shared input style ───────────────────────────────────────────────────────

const INPUT_STYLE: React.CSSProperties = {
  background: "#1c2b1f",
  border: "1px solid #2a4030",
  borderRadius: 7,
  padding: "8px 10px",
  color: "#e2f0e5",
  fontSize: 12,
  width: "100%",
  outline: "none",
};

const LABEL_STYLE: React.CSSProperties = {
  display: "block",
  fontSize: 9,
  fontWeight: 700,
  color: "#4a7052",
  textTransform: "uppercase",
  letterSpacing: "1.2px",
  marginBottom: 5,
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FieldTransactions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const canDelete = user?.role === "staff" || user?.role === "admin";

  const [search, setSearch]       = useState("");
  const [fromFilter, setFrom]     = useState("all");
  const [toFilter, setTo]         = useState("all");
  const [projectFilter, setProj]  = useState("all");
  const [dateFrom, setDateFrom]   = useState("");
  const [dateTo, setDateTo]       = useState("");

  const [selectMode, setSelectMode]   = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: movements, isLoading } = useMovements();
  const bulkDelete  = useBulkDeleteMovements();
  const bulkRestore = useBulkRestoreMovements();

  const { fromOptions, toOptions, projectOptions } = useMemo(() => {
    const froms = new Map<string, string>();
    const tos   = new Map<string, string>();
    const projs = new Map<string, string>();
    (movements ?? []).forEach(m => {
      const mx = m as any;
      if (mx.sourceLocation) froms.set(String(mx.sourceLocation.id), mx.sourceLocation.name);
      if (mx.destinationLocation) tos.set(String(mx.destinationLocation.id), mx.destinationLocation.name);
      if (mx.project) projs.set(String(mx.project.id), mx.project.poNumber
        ? `${mx.project.name} / ${mx.project.poNumber}`
        : mx.project.name);
    });
    return {
      fromOptions:    Array.from(froms.entries()),
      toOptions:      Array.from(tos.entries()),
      projectOptions: Array.from(projs.entries()),
    };
  }, [movements]);

  const filtered = (movements ?? []).filter(m => {
    const mx      = m as any;
    const item    = mx.item;
    const itemName = item?.name?.toLowerCase() ?? "";
    const sku      = item?.sku?.toLowerCase() ?? "";
    const q        = search.toLowerCase();
    if (q && !itemName.includes(q) && !sku.includes(q) && !String(m.id).includes(q)) return false;
    if (fromFilter !== "all" && String(mx.sourceLocation?.id) !== fromFilter) return false;
    if (toFilter   !== "all" && String(mx.destinationLocation?.id) !== toFilter) return false;
    if (projectFilter !== "all" && String(mx.project?.id) !== projectFilter) return false;
    const moved = new Date(m.createdAt ?? "");
    if (dateFrom) {
      const from = startOfDay(new Date(dateFrom + "T00:00:00"));
      if (moved < from) return false;
    }
    if (dateTo) {
      const to = endOfDay(new Date(dateTo + "T00:00:00"));
      if (moved > to) return false;
    }
    return true;
  });

  const filteredIds = filtered.map(m => m.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.has(id));

  function toggleRow(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredIds.forEach(id => next.add(id));
        return next;
      });
    }
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  async function handleDelete() {
    const ids = Array.from(selectedIds);
    const count = ids.length;

    const snapshots = (movements ?? [])
      .filter(m => selectedIds.has(m.id))
      .map(m => {
        const raw = m as any;
        return {
          itemId: raw.itemId,
          movementType: raw.movementType,
          quantity: raw.quantity,
          previousQuantity: raw.previousQuantity,
          newQuantity: raw.newQuantity,
          sourceLocationId: raw.sourceLocationId ?? null,
          destinationLocationId: raw.destinationLocationId ?? null,
          projectId: raw.projectId ?? null,
          unitCostSnapshot: raw.unitCostSnapshot ?? null,
          referenceType: raw.referenceType ?? null,
          referenceId: raw.referenceId ?? null,
          note: raw.note ?? null,
          reason: raw.reason ?? null,
          createdBy: raw.createdBy ?? null,
          createdAt: raw.createdAt ?? null,
        };
      });

    try {
      await bulkDelete.mutateAsync(ids);
      exitSelectMode();
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
          idx + 1,
          m.movementType,
          item?.sku ?? "",
          item?.name ?? m.itemId,
          item?.sizeLabel ?? "",
          m.quantity,
          item?.unitOfMeasure ?? "",
          mx.sourceLocation?.name ?? "",
          mx.destinationLocation?.name ?? "",
          mx.project?.name ?? "",
          mx.project?.poNumber ?? "",
          m.note ?? "",
          m.createdAt ? format(new Date(m.createdAt), "yyyy-MM-dd HH:mm") : "",
        ];
      }),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const COLS_COUNT = selectMode ? 11 : 10;

  // ── TH style ──
  const TH: React.CSSProperties = {
    fontSize: 9,
    fontWeight: 700,
    color: "#7aab82",
    textTransform: "uppercase",
    letterSpacing: "1px",
    padding: "10px 8px",
    whiteSpace: "nowrap",
    background: "#162019",
  };

  return (
    <div className="space-y-4 pt-5 pb-8">

      {/* ── Header ── */}
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <ClipboardList style={{ width: 20, height: 20, color: "#2ddb6f" }} />
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#e2f0e5", fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.04em" }}>
            Transactions
          </h1>
        </div>
        <p style={{ fontSize: 13, color: "#7aab82" }}>
          {selectMode ? `${selectedIds.size} selected` : "View transaction history."}
        </p>
      </div>

      {/* ── Filter Bar ── */}
      <div style={{ background: "#162019", border: "1px solid #2a4030", borderRadius: 12, padding: "14px 16px" }}>
        <div className="grid gap-3" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr" }}>

          {/* Search */}
          <div>
            <label style={LABEL_STYLE}>Search</label>
            <div style={{ position: "relative" }}>
              <Search style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", width: 13, height: 13, color: "#4a7052", pointerEvents: "none" }} />
              <input
                type="text"
                placeholder="Item / SKU / ID…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                data-testid="field-tx-search"
                style={{ ...INPUT_STYLE, paddingLeft: 28, fontFamily: "'Barlow', sans-serif" }}
                onFocus={e => { e.currentTarget.style.borderColor = "#2ddb6f"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(45,219,111,0.12)"; }}
                onBlur={e => { e.currentTarget.style.borderColor = "#2a4030"; e.currentTarget.style.boxShadow = "none"; }}
              />
            </div>
          </div>

          {/* From */}
          <div>
            <label style={LABEL_STYLE}>From</label>
            <Select value={fromFilter} onValueChange={setFrom}>
              <SelectTrigger
                className="w-full h-[37px] text-xs"
                style={{ background: "#1c2b1f", border: "1px solid #2a4030", color: "#e2f0e5", borderRadius: 7 }}
                data-testid="field-tx-from-filter"
              >
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {fromOptions.map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* To */}
          <div>
            <label style={LABEL_STYLE}>To</label>
            <Select value={toFilter} onValueChange={setTo}>
              <SelectTrigger
                className="w-full h-[37px] text-xs"
                style={{ background: "#1c2b1f", border: "1px solid #2a4030", color: "#e2f0e5", borderRadius: 7 }}
                data-testid="field-tx-to-filter"
              >
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {toOptions.map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Project */}
          <div>
            <label style={LABEL_STYLE}>Project</label>
            <Select value={projectFilter} onValueChange={setProj}>
              <SelectTrigger
                className="w-full h-[37px] text-xs"
                style={{ background: "#1c2b1f", border: "1px solid #2a4030", color: "#e2f0e5", borderRadius: 7 }}
                data-testid="field-tx-project-filter"
              >
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {projectOptions.map(([id, label]) => (
                  <SelectItem key={id} value={id}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date From */}
          <div>
            <label style={LABEL_STYLE}>Date From</label>
            <div style={{ position: "relative" }}>
              <CalendarDays style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", width: 12, height: 12, color: "#4a7052", pointerEvents: "none" }} />
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                data-testid="field-tx-date-from"
                style={{ ...INPUT_STYLE, paddingLeft: 26, colorScheme: "dark" }}
                onFocus={e => { e.currentTarget.style.borderColor = "#2ddb6f"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(45,219,111,0.12)"; }}
                onBlur={e => { e.currentTarget.style.borderColor = "#2a4030"; e.currentTarget.style.boxShadow = "none"; }}
              />
            </div>
          </div>

          {/* Date To */}
          <div>
            <label style={LABEL_STYLE}>Date To</label>
            <div style={{ position: "relative" }}>
              <CalendarDays style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", width: 12, height: 12, color: "#4a7052", pointerEvents: "none" }} />
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                data-testid="field-tx-date-to"
                style={{ ...INPUT_STYLE, paddingLeft: 26, colorScheme: "dark" }}
                onFocus={e => { e.currentTarget.style.borderColor = "#2ddb6f"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(45,219,111,0.12)"; }}
                onBlur={e => { e.currentTarget.style.borderColor = "#2a4030"; e.currentTarget.style.boxShadow = "none"; }}
              />
            </div>
          </div>

        </div>

        {/* Clear dates row */}
        {(dateFrom || dateTo) && (
          <div className="flex justify-end mt-2">
            <button
              onClick={() => { setDateFrom(""); setDateTo(""); }}
              data-testid="field-tx-date-clear"
              style={{ fontSize: 11, color: "#7aab82", background: "none", border: "1px solid #2a4030", borderRadius: 6, padding: "3px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
            >
              <X style={{ width: 11, height: 11 }} /> Clear dates
            </button>
          </div>
        )}
      </div>

      {/* ── Table ── */}
      <div style={{ border: "1px solid #2a4030", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ minWidth: 860, width: "100%", tableLayout: "fixed", borderCollapse: "collapse" }}>
            <colgroup>
              {selectMode && <col style={{ width: 40 }} />}
              <col style={{ width: 46 }} />
              <col style={{ width: 82 }} />
              <col style={{ width: 42 }} />
              <col style={{ width: 64 }} />
              <col />
              <col style={{ width: 80 }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: 55 }} />
              <col style={{ width: 105 }} />
              <col style={{ width: 96 }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: "1px solid #2a4030" }}>
                {selectMode && (
                  <th style={{ ...TH, textAlign: "center" }}>
                    <button
                      type="button"
                      onClick={toggleAll}
                      style={{ background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                      data-testid="button-select-all"
                    >
                      {allSelected
                        ? <CheckSquare style={{ width: 15, height: 15, color: "#2ddb6f" }} />
                        : <Square style={{ width: 15, height: 15, color: "#4a7052" }} />}
                    </button>
                  </th>
                )}
                <th style={{ ...TH, textAlign: "center", paddingLeft: 12 }}>#</th>
                <th style={{ ...TH, textAlign: "center" }}>Type</th>
                <th style={TH}>Photo</th>
                <th style={{ ...TH, paddingLeft: 12 }}>Size</th>
                <th style={TH}>Item</th>
                <th style={{ ...TH, textAlign: "right" }}>Qty / Unit</th>
                <th style={TH}>From → To</th>
                <th style={TH}>Project / PO</th>
                <th style={{ ...TH, textAlign: "center" }}>Note</th>
                <th style={TH}>Date</th>
                <th style={{ ...TH, textAlign: "right", paddingRight: 12 }}>
                  {canDelete && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                      {selectMode ? (
                        <>
                          {selectedIds.size > 0 && (
                            <button
                              type="button"
                              onClick={() => setConfirmOpen(true)}
                              style={{ display: "inline-flex", alignItems: "center", gap: 4, borderRadius: 6, background: "rgba(255,80,80,0.15)", border: "1px solid rgba(255,80,80,0.3)", padding: "3px 8px", fontSize: 10, fontWeight: 700, color: "#ff5050", cursor: "pointer" }}
                              data-testid="button-delete-selected"
                            >
                              <Trash2 style={{ width: 11, height: 11 }} />
                              Delete ({selectedIds.size})
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={exitSelectMode}
                            style={{ display: "inline-flex", alignItems: "center", gap: 4, borderRadius: 6, background: "#1c2b1f", border: "1px solid #2a4030", padding: "3px 8px", fontSize: 10, fontWeight: 700, color: "#7aab82", cursor: "pointer" }}
                            data-testid="button-cancel-select"
                          >
                            <X style={{ width: 11, height: 11 }} />
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSelectMode(true)}
                          style={{ display: "inline-flex", alignItems: "center", gap: 4, borderRadius: 6, background: "#1c2b1f", border: "1px solid #2a4030", padding: "3px 8px", fontSize: 10, fontWeight: 700, color: "#7aab82", cursor: "pointer" }}
                          data-testid="button-select-mode"
                        >
                          <CheckSquare style={{ width: 11, height: 11 }} />
                          Select
                        </button>
                      )}
                    </div>
                  )}
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={COLS_COUNT} style={{ textAlign: "center", padding: "48px 0", fontSize: 13, color: "#7aab82" }}>Loading…</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={COLS_COUNT} style={{ textAlign: "center", padding: "48px 0", fontSize: 13, color: "#7aab82" }}>No transactions found.</td>
                </tr>
              ) : filtered.map((m, idx) => {
                const mx      = m as any;
                const item    = mx.item;
                const fromLoc = mx.sourceLocation;
                const toLoc   = mx.destinationLocation;
                const project = mx.project;
                const isSelected = selectedIds.has(m.id);
                const projectName = project?.name ?? null;
                const projectPo   = project?.poNumber ?? null;

                return (
                  <tr
                    key={m.id}
                    style={{
                      background: isSelected ? "rgba(45,219,111,0.06)" : "#162019",
                      borderBottom: "1px solid #1e2e21",
                      borderLeft: isSelected ? "3px solid #2ddb6f" : "3px solid transparent",
                      cursor: selectMode ? "pointer" : "default",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "#1c2b1f"; }}
                    onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "#162019"; }}
                    onClick={selectMode ? () => toggleRow(m.id) : undefined}
                    data-testid={`field-tx-row-${m.id}`}
                  >
                    {/* Checkbox */}
                    {selectMode && (
                      <td style={{ padding: "12px 8px", textAlign: "center" }} onClick={e => { e.stopPropagation(); toggleRow(m.id); }}>
                        {isSelected
                          ? <CheckSquare style={{ width: 15, height: 15, color: "#2ddb6f", margin: "0 auto" }} />
                          : <Square style={{ width: 15, height: 15, color: "#4a7052", margin: "0 auto" }} />}
                      </td>
                    )}

                    {/* No. */}
                    <td style={{ padding: "12px 8px", paddingLeft: 12, fontFamily: "monospace", fontSize: 11, color: "#7aab82", textAlign: "center" }}>
                      {idx + 1}
                    </td>

                    {/* Type */}
                    <td style={{ padding: "12px 4px", textAlign: "center" }}>
                      <FieldTypeBadge type={m.movementType} />
                    </td>

                    {/* Photo */}
                    <td style={{ padding: "10px 8px" }}>
                      <PhotoCell imageUrl={item?.imageUrl} name={item?.name ?? ""} />
                    </td>

                    {/* Size */}
                    <td style={{ padding: "12px 4px", paddingLeft: 12, fontSize: 11, color: "#7aab82", whiteSpace: "nowrap" }}>
                      {item?.sizeLabel || <span style={{ color: "#2a4030" }}>—</span>}
                    </td>

                    {/* Item */}
                    <td style={{ padding: "12px 8px" }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "#e2f0e5", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item?.name ?? `#${m.itemId}`}
                      </p>
                      {item?.extractedSubcategory && (
                        <p style={{ fontSize: 10, color: "#7aab82", lineHeight: 1.3, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.extractedSubcategory}
                        </p>
                      )}
                    </td>

                    {/* Qty + Unit */}
                    <td style={{ padding: "12px 8px", textAlign: "right", whiteSpace: "nowrap" }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, color: qtyColor(m.movementType) }}>
                        {m.quantity}
                      </span>
                      {item?.unitOfMeasure && (
                        <span style={{ marginLeft: 4, fontSize: 9, color: "#7aab82", textTransform: "uppercase" }}>
                          {item.unitOfMeasure}
                        </span>
                      )}
                    </td>

                    {/* From → To (stacked) */}
                    <td style={{ padding: "12px 8px" }}>
                      <div style={{ fontSize: 11, lineHeight: 1.5 }}>
                        <span style={{ color: "#e2f0e5", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {fromLoc?.name ?? <span style={{ color: "#2a4030" }}>—</span>}
                        </span>
                        <span style={{ color: "#4a7052", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          → {toLoc?.name ?? "—"}
                        </span>
                      </div>
                    </td>

                    {/* Project / PO */}
                    <td style={{ padding: "12px 8px" }}>
                      {projectName || projectPo ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          {projectName && (
                            <span style={{ fontSize: 11, fontWeight: 600, color: "#e2f0e5", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                              {projectName}
                            </span>
                          )}
                          {projectPo && (
                            <span style={{ fontSize: 9, color: "#7aab82", lineHeight: 1.3 }}>
                              {projectPo}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: "#2a4030", fontSize: 12 }}>—</span>
                      )}
                    </td>

                    {/* Note */}
                    <td style={{ padding: "12px 8px", fontSize: 11, color: "#7aab82", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {m.note || <span style={{ color: "#2a4030" }}>—</span>}
                    </td>

                    {/* Date */}
                    <td style={{ padding: "12px 8px" }}>
                      {m.createdAt ? (
                        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.5 }}>
                          <span style={{ fontSize: 11, fontWeight: 500, color: "#e2f0e5" }}>
                            {format(new Date(m.createdAt), "MMM d, yyyy")}
                          </span>
                          <span style={{ fontSize: 10, color: "#7aab82" }}>
                            {format(new Date(m.createdAt), "HH:mm")}
                          </span>
                        </div>
                      ) : <span style={{ color: "#2a4030" }}>—</span>}
                    </td>

                    {/* Actions column — empty in rows */}
                    <td style={{ padding: "12px 12px 12px 0" }} />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{ padding: "10px 16px", borderTop: "1px solid #1e2e21", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: "#7aab82" }}>
            Showing <strong style={{ color: "#e2f0e5" }}>{filtered.length}</strong> transaction{filtered.length !== 1 ? "s" : ""}
            {selectMode && selectedIds.size > 0 && (
              <span style={{ marginLeft: 8, color: "#2ddb6f", fontWeight: 600 }}>· {selectedIds.size} selected</span>
            )}
          </span>
          {filtered.length > 0 && (
            <button
              onClick={exportCsv}
              data-testid="btn-export-csv"
              style={{ fontSize: 11, color: "#7aab82", background: "#1c2b1f", border: "1px solid #2a4030", borderRadius: 7, padding: "4px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
            >
              Export CSV ↓
            </button>
          )}
        </div>
      </div>

      {/* Confirm delete dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Delete Transactions
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <p className="text-sm text-slate-600">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-slate-900">{selectedIds.size} transaction{selectedIds.size !== 1 ? "s" : ""}</span>?
              Inventory counts will be reversed. You can undo within 8 seconds after deletion.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={bulkDelete.isPending}
                data-testid="button-confirm-delete"
              >
                {bulkDelete.isPending ? "Deleting…" : `Delete ${selectedIds.size}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
