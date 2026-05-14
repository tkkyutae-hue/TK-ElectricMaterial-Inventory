import { useState, useMemo } from "react";
import { useMovements, useBulkDeleteMovements, useUpdateMovement } from "@/hooks/use-transactions";
import { useProjects, useLocations } from "@/hooks/use-reference-data";
import { TransactionTypeBadge } from "@/components/StatusBadge";
import { MovementForm } from "@/components/MovementForm";
import { EditSuccessToast } from "@/components/EditTransactionDrawer";
import { Search, ArrowRightLeft, Trash2, AlertTriangle, CalendarIcon, Edit2, X, Check } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format, startOfDay, endOfDay, subDays, formatDistanceToNow } from "date-fns";
import { ko as dfKo, es as dfEs } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import type { Lang } from "@/lib/i18n";

const DATE_FNS_LOCALE: Record<Lang, any> = { en: undefined, ko: dfKo, es: dfEs };

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

  // Inline editing
  interface EditDraft {
    movementType: string;
    quantity: string;
    sourceLocationId: string;
    destinationLocationId: string;
    projectId: string;
    note: string;
    transactionDate: string;
  }
  const [editingIds, setEditingIds] = useState<Set<number>>(new Set());
  const [editDrafts, setEditDrafts] = useState<Record<number, EditDraft>>({});
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());

  // Toast
  const [toast, setToast] = useState<{ txId: number } | null>(null);

  // Delete confirm
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Pagination
  const [pageSize, setPageSize]         = useState(10);
  const [currentPage, setCurrentPage]   = useState(1);
  const [pageSizeOpen, setPageSizeOpen] = useState(false);

  const { toast: shadcnToast } = useToast();
  const { t, lang } = useLanguage();
  const dfLocale = DATE_FNS_LOCALE[lang];
  const bulkDelete = useBulkDeleteMovements();
  const updateMovement = useUpdateMovement();

  const { data: movements, isLoading } = useMovements(
    typeFilter !== "all" ? { movementType: typeFilter } : {}
  );
  const { data: projects } = useProjects();
  const { data: locations } = useLocations();

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

  const totalPages = Math.max(1, Math.ceil((filtered?.length ?? 0) / pageSize));
  const safePage   = Math.min(Math.max(1, currentPage), totalPages);
  const paginated  = (filtered ?? []).slice((safePage - 1) * pageSize, safePage * pageSize);

  const filteredIds = useMemo(() => paginated.map((tx: any) => tx.id as number), [paginated]);
  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.has(id));
  const selCount = selectedIds.size;

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
      shadcnToast({ title: count === 1 ? t.txDeletedOne : t.txDeleted.replace("{n}", String(count)) });
      if (result.errors?.length) {
        shadcnToast({ title: `${result.errors.length} ${t.txAdminFailedDelete}`, variant: "destructive" });
      }
      setSelectedIds(new Set());
    } catch (err: any) {
      shadcnToast({ title: t.txAdminDeleteFailed, description: err.message, variant: "destructive" });
    }
    setConfirmDelete(false);
  }

  // Admin Mode: inline edit any number of selected rows
  const canEdit = selCount >= 1 && editingIds.size === 0;
  const canDelete = selCount >= 1;

  function openInlineEdit() {
    const ids = Array.from(selectedIds);
    const newDrafts: Record<number, any> = {};
    ids.forEach(id => {
      const tx = (filtered ?? []).find((t: any) => t.id === id);
      if (!tx) return;
      const datePart = tx.transactionDate
        ? new Date(tx.transactionDate).toISOString().split("T")[0]
        : new Date(tx.createdAt).toISOString().split("T")[0];
      newDrafts[id] = {
        movementType: tx.movementType,
        quantity: String(tx.quantity),
        sourceLocationId: String(tx.sourceLocationId ?? ""),
        destinationLocationId: String(tx.destinationLocationId ?? ""),
        projectId: tx.projectId ? String(tx.projectId) : "",
        note: tx.note ?? tx.reason ?? "",
        transactionDate: datePart,
      };
    });
    setEditDrafts(prev => ({ ...prev, ...newDrafts }));
    setEditingIds(new Set(ids));
  }

  function updateDraft(id: number, field: string, value: string) {
    setEditDrafts(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  }

  async function saveRow(id: number) {
    const draft = editDrafts[id];
    if (!draft) return;
    setSavingIds(prev => { const s = new Set(prev); s.add(id); return s; });
    try {
      await updateMovement.mutateAsync({
        id,
        movementType: draft.movementType,
        quantity: Number(draft.quantity),
        sourceLocationId: draft.sourceLocationId ? Number(draft.sourceLocationId) : null,
        destinationLocationId: draft.destinationLocationId ? Number(draft.destinationLocationId) : null,
        projectId: draft.projectId ? Number(draft.projectId) : null,
        note: draft.note || null,
        transactionDate: draft.transactionDate ? new Date(draft.transactionDate + "T12:00:00").toISOString() : null,
      });
      setToast({ txId: id });
      cancelRow(id);
    } catch (err: any) {
      shadcnToast({ title: t.txAdminSaveFailed, description: err.message, variant: "destructive" });
    } finally {
      setSavingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  }

  function cancelRow(id: number) {
    setEditingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    setEditDrafts(prev => { const d = { ...prev }; delete d[id]; return d; });
    setSelectedIds(prev => { const s = new Set(prev); s.delete(id); return s; });
  }

  function cancelAllEdits() {
    setEditingIds(new Set());
    setEditDrafts({});
    clearSelection();
  }

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
          <h1 className="text-3xl font-display font-bold text-slate-900">{t.txAdminTitle}</h1>
          <p className="text-slate-500 mt-1">{t.txAdminSubtitle}</p>
        </div>
        <Dialog open={logOpen} onOpenChange={setLogOpen}>
          <Button
            className="bg-brand-700 hover:bg-brand-800 text-white shadow-sm shadow-brand-700/20"
            onClick={() => setLogOpen(true)}
            data-testid="button-log-movement"
          >
            <ArrowRightLeft className="w-4 h-4 mr-2" />
            {t.txAdminLogMovement}
          </Button>
          <DialogContent className="sm:max-w-[760px] flex flex-col max-h-[90vh] gap-0 p-0">
            <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 shrink-0">
              <DialogTitle>{t.txAdminLogInventoryDialog}</DialogTitle>
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
                placeholder={t.txAdminSearchPh}
                className="pl-9 bg-white border-slate-200"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-tx-search"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px] bg-white" data-testid="select-tx-type">
                <SelectValue placeholder={t.txAdminAllTypesPh} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.txAdminAllTypesItem}</SelectItem>
                <SelectItem value="receive">{t.txAdminTypeReceive}</SelectItem>
                <SelectItem value="issue">{t.txAdminTypeIssue}</SelectItem>
                <SelectItem value="return">{t.txAdminTypeReturn}</SelectItem>
                <SelectItem value="transfer">{t.txAdminTypeTransfer}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-[170px] bg-white">
                <SelectValue placeholder={t.txAdminAllProjectsPh} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.txAdminAllProjectsItem}</SelectItem>
                {projects?.map((p: any) => (
                  <SelectItem key={p.id} value={p.id.toString()}>{p.poNumber || p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
              <span className="whitespace-nowrap text-xs font-medium text-slate-500">{t.txAdminDateRange}</span>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                className="h-8 w-[140px] bg-white border-slate-200 text-sm"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="input-tx-start-date"
              />
              <span className="text-slate-400 text-xs">–</span>
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
                {t.txAdminReset30}
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto" style={{ paddingRight: 16 }}>
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80">
                {/* Leftmost selection checkbox col */}
                <TableHead className="text-center" style={{ width: 36, minWidth: 36, padding: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div
                      role="checkbox"
                      aria-checked={allSelected}
                      onClick={toggleAll}
                      data-testid="checkbox-select-all"
                      style={checkboxStyle(allSelected)}
                    >
                      {allSelected && (
                        <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                          <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  </div>
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide w-[90px]">{t.txDate}</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide w-[100px]">{t.txAdminColType}</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide w-[90px]">{t.txAdminColSize}</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide w-12 text-center">{t.colPhoto}</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t.txItem}</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-right w-[80px]">{t.txAdminColQty}</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide w-[170px]">{t.txAdminColFrom} → {t.txAdminColTo}</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide w-[160px] min-w-[160px]">{t.txAdminColProject}</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide w-[120px]">{t.colSupplier}</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t.txAdminColNote}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(11)].map((__, j) => (
                      <TableCell key={j}><div className="h-4 bg-slate-100 rounded animate-pulse" /></TableCell>
                    ))}
                  </TableRow>
                ))

              ) : !filtered?.length ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-12 text-slate-500">
                    <ArrowRightLeft className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                    <p className="font-medium text-slate-900">{t.txAdminNoneFound}</p>
                    <p className="text-sm">{t.txAdminTryAdjusting}</p>
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((tx: any) => {
                  const isSelected = selectedIds.has(tx.id);
                  const isEditing = editingIds.has(tx.id);
                  const isSaving  = savingIds.has(tx.id);
                  const draft     = editDrafts[tx.id];
                  const isEdited  = !!tx.editedAt;
                  const lastEditor = isEdited ? (tx.editHistory as any[])?.[((tx.editHistory as any[])?.length ?? 1) - 1] : null;
                  const editLabel = lastEditor
                    ? `${t.txAdminEditedBy} ${lastEditor.editedBy?.replace("@tkelectricllc.us","").split("_").map((p: string) => p[0]?.toUpperCase() + p.slice(1)).join(" ")} · ${formatDistanceToNow(new Date(lastEditor.editedAt), { addSuffix: true, locale: dfLocale })}`
                    : t.txAdminEditedTag.toLowerCase();

                  const cellInput: React.CSSProperties = {
                    fontSize: 11, padding: "3px 5px", height: 26, borderRadius: 4,
                    border: "1px solid #cbd5e1", background: "#fff", color: "#1e293b", width: "100%",
                  };
                  const cellSelect: React.CSSProperties = { ...cellInput, cursor: "pointer" };

                  return (
                    <TableRow
                      key={tx.id}
                      data-testid={`row-tx-${tx.id}`}
                      style={{
                        ...(isEditing ? { background: "rgba(234,179,8,0.05)", outline: "1px solid rgba(234,179,8,0.20)" } : isSelected ? selectedRowStyle : {}),
                        transition: "background 0.1s",
                      }}
                      className={isEditing ? "" : "hover:bg-slate-50/50"}
                    >
                      {/* Leftmost: select checkbox or Save/Cancel when editing */}
                      <TableCell
                        className="text-center"
                        style={{ verticalAlign: "middle", width: 36, minWidth: 36, padding: 0 }}
                        onClick={(e) => { if (!isEditing) { e.stopPropagation(); toggleRow(tx.id); } }}
                      >
                        {isEditing ? (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}>
                            <button
                              type="button"
                              onClick={() => saveRow(tx.id)}
                              disabled={isSaving}
                              data-testid={`btn-save-row-${tx.id}`}
                              title={t.txAdminTooltipSave}
                              style={{
                                width: 22, height: 22, borderRadius: 4,
                                background: isSaving ? "#f1f5f9" : "rgba(22,163,74,0.10)",
                                border: "1px solid rgba(22,163,74,0.30)",
                                color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center",
                                cursor: isSaving ? "default" : "pointer",
                              }}
                            >
                              {isSaving ? (
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="animate-spin">
                                  <circle cx="12" cy="12" r="10" stroke="#cbd5e1" strokeWidth="3"/>
                                  <path d="M12 2a10 10 0 0 1 10 10" stroke="#16a34a" strokeWidth="3" strokeLinecap="round"/>
                                </svg>
                              ) : (
                                <Check style={{ width: 10, height: 10 }} />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => cancelRow(tx.id)}
                              disabled={isSaving}
                              data-testid={`btn-cancel-row-${tx.id}`}
                              title={t.txAdminTooltipCancel}
                              style={{
                                width: 22, height: 22, borderRadius: 4,
                                background: "rgba(100,116,139,0.08)",
                                border: "1px solid rgba(100,116,139,0.20)",
                                color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center",
                                cursor: isSaving ? "default" : "pointer",
                              }}
                            >
                              <X style={{ width: 10, height: 10 }} />
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
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
                          </div>
                        )}
                      </TableCell>

                      {/* Date */}
                      <TableCell className="text-xs text-slate-500 whitespace-nowrap" style={{ verticalAlign: "middle" }}>
                        {isEditing ? (
                          <input
                            type="date"
                            value={draft?.transactionDate ?? ""}
                            onChange={e => updateDraft(tx.id, "transactionDate", e.target.value)}
                            style={{ ...cellInput, width: 110 }}
                            data-testid={`input-date-${tx.id}`}
                          />
                        ) : (
                          <>
                            {format(new Date(tx.createdAt), "MMM d, yy", { locale: dfLocale })}<br />
                            <span className="text-slate-400">{format(new Date(tx.createdAt), "HH:mm", { locale: dfLocale })}</span>
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
                                      ✎ {t.txAdminEditedTag}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="right" className="text-xs max-w-[180px]">
                                    {editLabel}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </>
                        )}
                      </TableCell>

                      {/* Type */}
                      <TableCell style={{ verticalAlign: "middle" }}>
                        {isEditing ? (
                          <select
                            value={draft?.movementType ?? ""}
                            onChange={e => updateDraft(tx.id, "movementType", e.target.value)}
                            style={cellSelect}
                            data-testid={`select-type-${tx.id}`}
                          >
                            <option value="receive">{t.txAdminTypeReceive}</option>
                            <option value="issue">{t.txAdminTypeIssue}</option>
                            <option value="return">{t.txAdminTypeReturn}</option>
                            <option value="transfer">{t.txAdminTypeTransfer}</option>
                          </select>
                        ) : (
                          <TransactionTypeBadge type={tx.movementType} />
                        )}
                      </TableCell>

                      {/* Size (read-only) */}
                      <TableCell className="text-xs text-slate-600 font-medium whitespace-nowrap" style={{ verticalAlign: "middle" }}>
                        {tx.item?.sizeLabel || <span className="text-slate-300">—</span>}
                      </TableCell>

                      {/* Photo (read-only) */}
                      <TableCell className="py-2 pr-0" style={{ verticalAlign: "middle" }}>
                        {tx.item?.imageUrl ? (
                          <img
                            src={tx.item.imageUrl}
                            alt=""
                            className="w-8 h-8 rounded object-cover bg-slate-100 flex-shrink-0"
                            data-testid={`img-tx-item-${tx.id}`}
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-slate-100 flex-shrink-0" />
                        )}
                      </TableCell>

                      {/* Item (read-only) */}
                      <TableCell style={{ verticalAlign: "middle" }}>
                        <p className="font-medium text-slate-900 text-sm">{tx.item?.name || `${t.txItemFallback} #${tx.itemId}`}</p>
                      </TableCell>

                      {/* Qty */}
                      <TableCell className="text-right" style={{ verticalAlign: "middle" }}>
                        {isEditing ? (
                          <input
                            type="number"
                            min={0}
                            value={draft?.quantity ?? ""}
                            onChange={e => updateDraft(tx.id, "quantity", e.target.value)}
                            style={{ ...cellInput, width: 60, textAlign: "right" }}
                            data-testid={`input-qty-${tx.id}`}
                          />
                        ) : (
                          <span className="font-semibold">
                            {tx.movementType === "issue" ? (
                              <span className="text-rose-600">-{tx.quantity}</span>
                            ) : (
                              <span className="text-emerald-600">+{tx.quantity}</span>
                            )}
                            <span className="text-slate-400 text-xs ml-1">{tx.item?.unitOfMeasure}</span>
                          </span>
                        )}
                      </TableCell>

                      {/* From → To (merged, stacked) */}
                      <TableCell className="text-xs text-slate-500" style={{ verticalAlign: "middle" }}>
                        {isEditing ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                            <select
                              value={draft?.sourceLocationId ?? ""}
                              onChange={e => updateDraft(tx.id, "sourceLocationId", e.target.value)}
                              style={{ ...cellSelect, width: "100%" }}
                              data-testid={`select-from-${tx.id}`}
                            >
                              <option value="">{t.txAdminNoneOpt}</option>
                              {(locations ?? []).map((loc: any) => (
                                <option key={loc.id} value={String(loc.id)}>{loc.name}</option>
                              ))}
                            </select>
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <span className="text-slate-400" style={{ fontSize: 11, lineHeight: 1 }}>→</span>
                              <select
                                value={draft?.destinationLocationId ?? ""}
                                onChange={e => updateDraft(tx.id, "destinationLocationId", e.target.value)}
                                style={{ ...cellSelect, flex: 1, minWidth: 0 }}
                                data-testid={`select-to-${tx.id}`}
                              >
                                <option value="">{t.txAdminNoneOpt}</option>
                                {(locations ?? []).map((loc: any) => (
                                  <option key={loc.id} value={String(loc.id)}>{loc.name}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-start gap-0.5 leading-tight">
                            <span>{tx.sourceLocation?.name || "—"}</span>
                            <span>
                              <span className="text-slate-300 mr-1">→</span>
                              {tx.destinationLocation?.name || "—"}
                            </span>
                          </div>
                        )}
                      </TableCell>

                      {/* Project */}
                      <TableCell className="whitespace-nowrap" style={{ verticalAlign: "middle" }}>
                        {isEditing ? (
                          <select
                            value={draft?.projectId ?? ""}
                            onChange={e => updateDraft(tx.id, "projectId", e.target.value)}
                            style={{ ...cellSelect, maxWidth: 150 }}
                            data-testid={`select-project-${tx.id}`}
                          >
                            <option value="">{t.txAdminNoneOpt}</option>
                            {(projects ?? []).map((p: any) => (
                              <option key={p.id} value={String(p.id)}>{p.poNumber ? `${p.poNumber} — ${p.name}` : p.name}</option>
                            ))}
                          </select>
                        ) : tx.project ? (
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

                      {/* Supplier */}
                      <TableCell className="text-xs text-slate-500" style={{ verticalAlign: "middle" }}>
                        {tx.supplierName ? (
                          <span
                            data-testid={`tx-supplier-${tx.id}`}
                            style={{
                              display: "inline-flex", alignItems: "center",
                              background: "rgba(14,165,233,0.07)", border: "1px solid rgba(14,165,233,0.20)",
                              color: "#0369a1", padding: "2px 6px", borderRadius: 4,
                              fontSize: 10, fontWeight: 600, whiteSpace: "nowrap",
                              maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis",
                            }}
                            title={tx.supplierName}
                          >
                            {tx.supplierName}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </TableCell>

                      {/* Note */}
                      <TableCell className="text-xs text-slate-500" style={{ verticalAlign: "middle" }}>
                        {isEditing ? (
                          <input
                            type="text"
                            value={draft?.note ?? ""}
                            onChange={e => updateDraft(tx.id, "note", e.target.value)}
                            placeholder={t.txAdminAddNotePh}
                            style={{ ...cellInput, minWidth: 100 }}
                            data-testid={`input-note-${tx.id}`}
                          />
                        ) : (
                          <span className="max-w-[140px] truncate block">{tx.note || tx.reason || "—"}</span>
                        )}
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
            {t.txAdminShowing}{" "}
            <strong className="text-slate-700">
              {(filtered?.length ?? 0) === 0 ? 0 : (safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered?.length ?? 0)}
            </strong>
            {" "}{t.txAdminOf}{" "}
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
            {editingIds.size > 0 && (
              <span className="text-xs font-semibold" style={{ marginRight: 2, color: "#ca8a04" }}>
                {editingIds.size} {t.txAdminEditing}
              </span>
            )}
            {selCount > 0 && editingIds.size === 0 && (
              <span className="text-xs text-slate-400" style={{ marginRight: 2 }}>
                {selCount} {t.txAdminSelected}
              </span>
            )}
            <button
              type="button"
              data-testid="btn-tx-edit"
              onClick={() => { if (canEdit) openInlineEdit(); }}
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
              <Edit2 style={{ width: 10, height: 10 }} />
              {selCount > 1 ? `${t.txAdminEditBtn} (${selCount})` : t.txAdminEditBtn}
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
              <Trash2 style={{ width: 10, height: 10 }} /> {t.txAdminDeleteBtn}
            </button>
            <button
              type="button"
              data-testid="btn-tx-cancel"
              onClick={cancelAllEdits}
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "4px 11px", borderRadius: 7,
                background: "white",
                border: "1px solid #e2e8f0",
                color: (selCount > 0 || editingIds.size > 0) ? "#475569" : "#cbd5e1",
                fontSize: 11, fontWeight: 700,
                cursor: (selCount > 0 || editingIds.size > 0) ? "pointer" : "default",
              }}
            >
              <X style={{ width: 10, height: 10 }} /> {t.txAdminCancelBtn}
            </button>
          </div>
        </div>

      </div>

      {/* ── Confirm bulk delete ── */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
              {t.txAdminConfirmDelTitle.replace("{n}", String(selCount))}
            </DialogTitle>
            <p className="text-sm text-slate-500 mt-1">
              {t.txAdminConfirmDelBody}
            </p>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)} disabled={bulkDelete.isPending}>
              {t.txAdminCancelBtn}
            </Button>
            <Button
              size="sm"
              className="bg-rose-600 hover:bg-rose-700 text-white"
              onClick={handleBulkDelete}
              disabled={bulkDelete.isPending}
              data-testid="button-confirm-delete"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              {bulkDelete.isPending ? t.txAdminDeleting : `${t.txAdminConfirmDeleteBtn} ${selCount}`}
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
