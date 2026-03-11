import { useState, useMemo } from "react";
import { useMovements, useBulkDeleteMovements } from "@/hooks/use-transactions";
import { useProjects } from "@/hooks/use-reference-data";
import { TransactionTypeBadge } from "@/components/StatusBadge";
import { MovementForm } from "@/components/MovementForm";
import { EditTransactionDrawer, EditSuccessToast } from "@/components/EditTransactionDrawer";
import { Search, ArrowRightLeft, Trash2, AlertTriangle, CalendarIcon, Edit2, X } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format, startOfDay, endOfDay, subDays, formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const todayStr = () => new Date().toISOString().split("T")[0];
const thirtyAgoStr = () => subDays(new Date(), 30).toISOString().split("T")[0];

export default function Transactions() {
  const [search, setSearch]         = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [startDate, setStartDate]   = useState(thirtyAgoStr());
  const [endDate, setEndDate]       = useState(todayStr());
  const [logOpen, setLogOpen]       = useState(false);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Edit drawer
  const [editTx, setEditTx] = useState<any | null>(null);

  // Toast
  const [toast, setToast] = useState<{ txId: number } | null>(null);

  // Delete confirm
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Pagination
  const [pageSize, setPageSize]         = useState(10);
  const [currentPage, setCurrentPage]   = useState(1);
  const [pageSizeOpen, setPageSizeOpen] = useState(false);

  const { toast: shadcnToast } = useToast();
  const bulkDelete = useBulkDeleteMovements();

  const { data: movements, isLoading } = useMovements(
    typeFilter !== "all" ? { movementType: typeFilter } : {}
  );
  const { data: projects } = useProjects();

  const filtered = movements?.filter((tx: any) => {
    const matchSearch = !search ||
      tx.item?.name?.toLowerCase().includes(search.toLowerCase()) ||
      tx.item?.sku?.toLowerCase().includes(search.toLowerCase());
    const matchProject = projectFilter === "all" || tx.projectId === Number(projectFilter);
    const txDate = new Date(tx.createdAt);
    const matchStart = !startDate || txDate >= startOfDay(new Date(startDate + "T00:00:00"));
    const matchEnd = !endDate || txDate <= endOfDay(new Date(endDate + "T00:00:00"));
    return matchSearch && matchProject && matchStart && matchEnd;
  });

  const filteredIds = useMemo(() => (filtered ?? []).map((tx: any) => tx.id as number), [filtered]);
  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.has(id));
  const selCount = selectedIds.size;

  const totalPages = Math.max(1, Math.ceil((filtered?.length ?? 0) / pageSize));
  const safePage   = Math.min(Math.max(1, currentPage), totalPages);
  const paginated  = (filtered ?? []).slice((safePage - 1) * pageSize, safePage * pageSize);

  function toggleRow(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredIds));
    }
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    try {
      const result = await bulkDelete.mutateAsync(ids);
      const count = result.deleted?.length ?? ids.length;
      shadcnToast({ title: `${count} transaction${count !== 1 ? "s" : ""} deleted` });
      if (result.errors?.length) {
        shadcnToast({ title: `${result.errors.length} failed to delete`, variant: "destructive" });
      }
      setSelectedIds(new Set());
    } catch (err: any) {
      shadcnToast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
    setConfirmDelete(false);
  }

  const selectedTx = selCount === 1
    ? (filtered ?? []).find((tx: any) => selectedIds.has(tx.id)) ?? null
    : null;

  // Determine action bar state
  const canEdit = selCount === 1;
  const canDelete = selCount >= 1;

  const CHECKBOX_SIZE = 15;

  const checkboxStyle = (checked: boolean): React.CSSProperties => ({
    width: CHECKBOX_SIZE,
    height: CHECKBOX_SIZE,
    borderRadius: 4,
    border: `1.5px solid ${checked ? "#16a34a" : "#cbd5e1"}`,
    background: checked ? "#16a34a" : "white",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    transition: "all 0.1s",
  });

  const selectedRowStyle: React.CSSProperties = {
    background: "rgba(22,163,74,0.07)",
    borderLeft: "3px solid #16a34a",
    borderRadius: "0 2px 2px 0",
  };

  return (
    <div className="space-y-6" style={{ position: "relative" }}>
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Transaction History</h1>
          <p className="text-slate-500 mt-1">Full log of all inventory movements.</p>
        </div>
        <Dialog open={logOpen} onOpenChange={setLogOpen}>
          <Button
            className="bg-brand-700 hover:bg-brand-800 text-white shadow-sm shadow-brand-700/20"
            onClick={() => setLogOpen(true)}
            data-testid="button-log-movement"
          >
            <ArrowRightLeft className="w-4 h-4 mr-2" />
            Log Movement
          </Button>
          <DialogContent className="sm:max-w-[760px] flex flex-col max-h-[90vh] gap-0 p-0">
            <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 shrink-0">
              <DialogTitle>Log Inventory Movement</DialogTitle>
            </DialogHeader>
            <div className="flex-1 flex flex-col min-h-0 px-6 pt-4 pb-6 overflow-hidden">
              <MovementForm onSuccess={() => setLogOpen(false)} onCancel={() => setLogOpen(false)} />
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Table card ── */}
      <div className="premium-card bg-white overflow-hidden" style={{ position: "relative" }}>
        {/* Filters */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search by item name or SKU…"
                className="pl-9 bg-white border-slate-200"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-tx-search"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px] bg-white" data-testid="select-tx-type">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="receive">Receive</SelectItem>
                <SelectItem value="issue">Issue</SelectItem>
                <SelectItem value="return">Return</SelectItem>
                <SelectItem value="transfer">Transfer</SelectItem>
              </SelectContent>
            </Select>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-[170px] bg-white">
                <SelectValue placeholder="All projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects?.map((p: any) => (
                  <SelectItem key={p.id} value={p.id.toString()}>{p.poNumber || p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
              <span className="whitespace-nowrap text-xs font-medium text-slate-500">Date range:</span>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                className="h-8 w-[140px] bg-white border-slate-200 text-sm"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="input-tx-start-date"
              />
              <span className="text-slate-400 text-xs">to</span>
              <Input
                type="date"
                className="h-8 w-[140px] bg-white border-slate-200 text-sm"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="input-tx-end-date"
              />
            </div>
            {(startDate !== thirtyAgoStr() || endDate !== todayStr()) && (
              <button
                onClick={() => { setStartDate(thirtyAgoStr()); setEndDate(todayStr()); }}
                className="text-xs text-slate-400 hover:text-brand-600 transition-colors"
                data-testid="button-reset-dates"
              >
                Reset to 30 days
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80">
                {/* Checkbox col */}
                <TableHead className="w-[42px] pl-3 pr-0">
                  <div
                    style={checkboxStyle(allSelected)}
                    onClick={toggleAll}
                    data-testid="checkbox-select-all"
                    role="checkbox"
                    aria-checked={allSelected}
                  >
                    {allSelected && (
                      <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                        <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide w-[90px]">Date</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide w-[100px]">Type</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide w-[90px]">Size</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Item</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-right w-[80px]">Qty</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide w-[130px]">From</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide w-[130px]">To</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide w-[160px] min-w-[160px]">Project</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(10)].map((__, j) => (
                      <TableCell key={j}><div className="h-4 bg-slate-100 rounded animate-pulse" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !filtered?.length ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12 text-slate-500">
                    <ArrowRightLeft className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                    <p className="font-medium text-slate-900">No transactions found</p>
                    <p className="text-sm">Try adjusting filters or log a new movement.</p>
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((tx: any) => {
                  const isSelected = selectedIds.has(tx.id);
                  const isEdited = !!tx.editedAt;
                  const lastEditor = isEdited ? (tx.editHistory as any[])?.[((tx.editHistory as any[])?.length ?? 1) - 1] : null;
                  const editLabel = lastEditor
                    ? `edited by ${lastEditor.editedBy?.replace("@tkelectricllc.us","").split("_").map((p: string) => p[0]?.toUpperCase() + p.slice(1)).join(" ")} · ${formatDistanceToNow(new Date(lastEditor.editedAt), { addSuffix: true })}`
                    : "edited";
                  return (
                    <TableRow
                      key={tx.id}
                      data-testid={`row-tx-${tx.id}`}
                      onClick={() => toggleRow(tx.id)}
                      style={{
                        ...(isSelected ? selectedRowStyle : {}),
                        cursor: "pointer",
                        transition: "background 0.1s",
                      }}
                      className={`hover:bg-slate-50/50 ${isSelected ? "" : ""}`}
                    >
                      {/* Checkbox */}
                      <TableCell className="pl-3 pr-0" onClick={(e) => { e.stopPropagation(); toggleRow(tx.id); }}>
                        <div
                          style={checkboxStyle(isSelected)}
                          data-testid={`checkbox-tx-${tx.id}`}
                          role="checkbox"
                          aria-checked={isSelected}
                        >
                          {isSelected && (
                            <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                              <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </div>
                      </TableCell>

                      {/* Date */}
                      <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                        {format(new Date(tx.createdAt), "MMM d, yy")}<br />
                        <span className="text-slate-400">{format(new Date(tx.createdAt), "HH:mm")}</span>
                        {isEdited && (
                          <TooltipProvider delayDuration={100}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  data-testid={`edited-tag-${tx.id}`}
                                  style={{
                                    marginTop: 3,
                                    display: "inline-flex", alignItems: "center", gap: 2,
                                    background: "rgba(167,139,250,0.10)",
                                    border: "1px solid rgba(167,139,250,0.28)",
                                    color: "#7c3aed",
                                    padding: "1px 5px", borderRadius: 3,
                                    fontSize: 7, fontWeight: 700, letterSpacing: "0.06em",
                                    textTransform: "uppercase", whiteSpace: "nowrap",
                                    cursor: "default",
                                  }}
                                >
                                  ✎ EDITED
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="text-xs max-w-[180px]">
                                {editLabel}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </TableCell>

                      <TableCell><TransactionTypeBadge type={tx.movementType} /></TableCell>
                      <TableCell className="text-xs text-slate-600 font-medium whitespace-nowrap">
                        {tx.item?.sizeLabel || <span className="text-slate-300">—</span>}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-slate-900 text-sm">{tx.item?.name || `Item #${tx.itemId}`}</p>
                        <p className="text-xs font-mono text-slate-400">{tx.item?.sku}</p>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {tx.movementType === "issue" ? (
                          <span className="text-rose-600">-{tx.quantity}</span>
                        ) : (
                          <span className="text-emerald-600">+{tx.quantity}</span>
                        )}
                        <span className="text-slate-400 text-xs ml-1">{tx.item?.unitOfMeasure}</span>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">{tx.sourceLocation?.name || "—"}</TableCell>
                      <TableCell className="text-xs text-slate-500">{tx.destinationLocation?.name || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {tx.project ? (
                          <TooltipProvider delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Link
                                  href={`/projects/${tx.project.id}`}
                                  className="inline-flex items-center text-xs font-mono bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded hover:bg-brand-100 transition-colors cursor-pointer max-w-[120px] truncate"
                                  onClick={(e) => e.stopPropagation()}
                                  data-testid={`link-project-${tx.project.id}`}
                                >
                                  {tx.project.poNumber || tx.project.name}
                                </Link>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-[220px] text-xs">
                                {tx.project.poNumber && <p className="font-semibold font-mono">{tx.project.poNumber}</p>}
                                <p className="text-slate-300 mt-0.5">{tx.project.name}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : <span className="text-slate-300">—</span>}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 max-w-[140px] truncate">
                        {tx.note || tx.reason || "—"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* ── Footer: showing count · pagination · action buttons ── */}
        <div
          data-testid="tx-action-bar"
          className="border-t border-slate-100 bg-slate-50/60"
          style={{ padding: "8px 16px", display: "flex", alignItems: "center", minHeight: 46, fontFamily: "inherit" }}
        >
          {/* Left: showing count */}
          <span className="text-xs text-slate-400" style={{ flex: 1 }}>
            Showing{" "}
            <strong className="text-slate-700">
              {(filtered?.length ?? 0) === 0 ? 0 : (safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered?.length ?? 0)}
            </strong>
            {" "}of{" "}
            <strong className="text-slate-700">{filtered?.length ?? 0}</strong>
          </span>

          {/* Center: page-size dropdown + pagination */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Compact page-size button */}
            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setPageSizeOpen(o => !o)}
                data-testid="btn-page-size-toggle"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "4px 9px", borderRadius: 7,
                  background: pageSizeOpen ? "rgba(22,163,74,0.08)" : "white",
                  border: `1px solid ${pageSizeOpen ? "rgba(22,163,74,0.30)" : "#e2e8f0"}`,
                  color: pageSizeOpen ? "#16a34a" : "#64748b",
                  fontSize: 11, fontWeight: 700, cursor: "pointer",
                }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.6 }}>
                  <rect x="1" y="2" width="10" height="1.5" rx="0.75" fill="currentColor"/>
                  <rect x="1" y="5.25" width="10" height="1.5" rx="0.75" fill="currentColor"/>
                  <rect x="1" y="8.5" width="10" height="1.5" rx="0.75" fill="currentColor"/>
                </svg>
                {pageSize}
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ opacity: 0.5 }}>
                  <path d="M1.5 3L4 5.5L6.5 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              {pageSizeOpen && (
                <div style={{
                  position: "absolute", bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)",
                  background: "white", border: "1px solid #e2e8f0", borderRadius: 9,
                  padding: "4px", zIndex: 50,
                  display: "flex", flexDirection: "column", gap: 2, minWidth: 72,
                  boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
                }}>
                  {[10, 15, 25, 35, 45].map(n => {
                    const active = pageSize === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => { setPageSize(n); setCurrentPage(1); setPageSizeOpen(false); }}
                        data-testid={`btn-page-size-${n}`}
                        style={{
                          padding: "6px 10px", borderRadius: 6, textAlign: "center",
                          background: active ? "rgba(22,163,74,0.08)" : "transparent",
                          border: `1px solid ${active ? "rgba(22,163,74,0.28)" : "transparent"}`,
                          color: active ? "#16a34a" : "#475569",
                          fontSize: 12, fontWeight: 700, cursor: "pointer",
                        }}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Prev / page indicator / Next */}
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              data-testid="btn-page-prev"
              style={{ padding: "4px 10px", borderRadius: 7, background: "white", border: "1px solid #e2e8f0", color: safePage <= 1 ? "#cbd5e1" : "#64748b", fontSize: 13, fontWeight: 700, cursor: safePage <= 1 ? "default" : "pointer" }}
            >‹</button>
            <span style={{ fontSize: 11, color: "#64748b", minWidth: 52, textAlign: "center" }}>
              {safePage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              data-testid="btn-page-next"
              style={{ padding: "4px 10px", borderRadius: 7, background: "white", border: "1px solid #e2e8f0", color: safePage >= totalPages ? "#cbd5e1" : "#64748b", fontSize: 13, fontWeight: 700, cursor: safePage >= totalPages ? "default" : "pointer" }}
            >›</button>
          </div>

          {/* Right: action buttons (always present; dimmed when nothing selected) */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
            {selCount > 0 && (
              <span className="text-xs text-slate-400" style={{ marginRight: 2 }}>
                {selCount} selected
              </span>
            )}
            <button
              type="button"
              data-testid="btn-tx-edit"
              onClick={() => canEdit && selectedTx && setEditTx(selectedTx)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "4px 11px", borderRadius: 7,
                background: canEdit ? "rgba(22,163,74,0.08)" : "white",
                border: `1px solid ${canEdit ? "rgba(22,163,74,0.25)" : "#e2e8f0"}`,
                color: canEdit ? "#16a34a" : "#cbd5e1",
                fontSize: 11, fontWeight: 700,
                cursor: canEdit ? "pointer" : "default",
              }}
            >
              <Edit2 style={{ width: 10, height: 10 }} /> Edit
            </button>
            <button
              type="button"
              data-testid="btn-tx-delete"
              onClick={() => canDelete && setConfirmDelete(true)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "4px 11px", borderRadius: 7,
                background: canDelete ? "rgba(220,38,38,0.07)" : "white",
                border: `1px solid ${canDelete ? "rgba(220,38,38,0.22)" : "#e2e8f0"}`,
                color: canDelete ? "#dc2626" : "#cbd5e1",
                fontSize: 11, fontWeight: 700,
                cursor: canDelete ? "pointer" : "default",
              }}
            >
              <Trash2 style={{ width: 10, height: 10 }} /> Delete
            </button>
            <button
              type="button"
              data-testid="btn-tx-cancel"
              onClick={clearSelection}
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "4px 11px", borderRadius: 7,
                background: "white",
                border: "1px solid #e2e8f0",
                color: selCount > 0 ? "#475569" : "#cbd5e1",
                fontSize: 11, fontWeight: 700,
                cursor: selCount > 0 ? "pointer" : "default",
              }}
            >
              <X style={{ width: 10, height: 10 }} /> Cancel
            </button>
          </div>
        </div>

        {/* ── Edit Drawer (inside the card, absolutely positioned) ── */}
        {editTx && (
          <EditTransactionDrawer
            tx={editTx}
            open={!!editTx}
            onClose={() => setEditTx(null)}
            dark={false}
            onSaved={(updated) => {
              setEditTx(null);
              clearSelection();
              setToast({ txId: updated.id ?? editTx.id });
            }}
          />
        )}
      </div>

      {/* ── Confirm bulk delete ── */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
              Delete {selCount} transaction{selCount !== 1 ? "s" : ""}?
            </DialogTitle>
            <p className="text-sm text-slate-500 mt-1">
              This will permanently delete the selected transactions and reverse their effect on inventory. This cannot be undone.
            </p>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)} disabled={bulkDelete.isPending}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-rose-600 hover:bg-rose-700 text-white"
              onClick={handleBulkDelete}
              disabled={bulkDelete.isPending}
              data-testid="button-confirm-delete"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              {bulkDelete.isPending ? "Deleting…" : `Delete ${selCount}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Success toast with Undo ── */}
      {toast && (
        <EditSuccessToast
          txId={toast.txId}
          dark={false}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
}
