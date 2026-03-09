import { useState, useMemo } from "react";
import { useMovements, useBulkDeleteMovements, useBulkRestoreMovements } from "@/hooks/use-transactions";
import { useAuth } from "@/hooks/use-auth";
import { TransactionTypeBadge } from "@/components/StatusBadge";
import { Search, ClipboardList, ImageOff, ArrowRightLeft, Navigation, FolderKanban, CalendarDays, CheckSquare, Square, Trash2, X, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format, startOfDay, endOfDay } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const TH = "text-[10px] font-bold text-slate-400 uppercase tracking-widest py-3 px-2 whitespace-nowrap";

function PhotoCell({ imageUrl, name }: { imageUrl?: string | null; name: string }) {
  if (!imageUrl) {
    return (
      <div className="w-8 h-8 rounded-md bg-slate-100 ring-1 ring-slate-200 flex items-center justify-center flex-shrink-0">
        <ImageOff className="w-3.5 h-3.5 text-slate-300" />
      </div>
    );
  }
  return (
    <img
      src={imageUrl}
      alt={name}
      className="w-8 h-8 rounded-md object-cover flex-shrink-0 ring-1 ring-slate-200"
      onError={e => {
        const p = e.currentTarget.parentElement;
        if (p) p.innerHTML = '<div class="w-8 h-8 rounded-md bg-slate-100 ring-1 ring-slate-200 flex items-center justify-center"><svg class="w-3.5 h-3.5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg></div>';
      }}
    />
  );
}

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

    // Save raw snapshots for undo (raw movement fields only, no joins)
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

      // Show toast with Undo button
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

  // COLS: checkbox(optional) + No + Type + Photo + Size + Item + Qty + From + To + Project + Note + Date + Actions
  const COLS = selectMode ? 13 : 12;

  return (
    <div className="space-y-4 pt-5 pb-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <ClipboardList className="w-5 h-5 text-brand-700" />
          <h1 className="text-2xl font-display font-bold text-slate-900">Transactions</h1>
        </div>
        <p className="text-slate-500 text-sm">
          {selectMode ? `${selectedIds.size} selected` : "View-only transaction history."}
        </p>
      </div>

      {/* Filters row 1: search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search item / SKU / ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
            data-testid="field-tx-search"
          />
        </div>
      </div>

      {/* Filters — grid: From | To | Project | Date range */}
      <div className="grid grid-cols-[1fr_1fr_1fr_1.6fr] gap-2 items-center">
        <Select value={fromFilter} onValueChange={setFrom}>
          <SelectTrigger className="w-full h-8 text-xs" data-testid="field-tx-from-filter">
            <span className="flex items-center gap-1 min-w-0 overflow-hidden">
              <Navigation className="w-3 h-3 text-slate-400 flex-shrink-0" />
              <SelectValue placeholder="All From" />
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All From</SelectItem>
            {fromOptions.map(([id, name]) => (
              <SelectItem key={id} value={id}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={toFilter} onValueChange={setTo}>
          <SelectTrigger className="w-full h-8 text-xs" data-testid="field-tx-to-filter">
            <span className="flex items-center gap-1 min-w-0 overflow-hidden">
              <ArrowRightLeft className="w-3 h-3 text-slate-400 flex-shrink-0" />
              <SelectValue placeholder="All To" />
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All To</SelectItem>
            {toOptions.map(([id, name]) => (
              <SelectItem key={id} value={id}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={projectFilter} onValueChange={setProj}>
          <SelectTrigger className="w-full h-8 text-xs" data-testid="field-tx-project-filter">
            <span className="flex items-center gap-1 min-w-0 overflow-hidden">
              <FolderKanban className="w-3 h-3 text-slate-400 flex-shrink-0" />
              <SelectValue placeholder="All Projects" />
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projectOptions.map(([id, label]) => (
              <SelectItem key={id} value={id}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1">
          <div className="relative flex-1 min-w-0">
            <CalendarDays className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              data-testid="field-tx-date-from"
              className="w-full h-8 pl-6 pr-1 text-xs rounded-md border border-input bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0"
            />
          </div>
          <span className="text-slate-400 text-xs select-none flex-shrink-0">—</span>
          <div className="relative flex-1 min-w-0">
            <CalendarDays className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              data-testid="field-tx-date-to"
              className="w-full h-8 pl-6 pr-1 text-xs rounded-md border border-input bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0"
            />
          </div>
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(""); setDateTo(""); }}
              className="h-8 px-2 text-xs text-slate-400 border border-slate-200 rounded-md hover:bg-slate-50 transition-colors flex-shrink-0"
              data-testid="field-tx-date-clear"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Table — horizontal scroll for narrow viewports */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table style={{ minWidth: "960px" }} className="w-full table-fixed">
            <colgroup>
              {selectMode && <col style={{ width: "40px" }} />}
              <col style={{ width: "46px" }} />
              <col style={{ width: "76px" }} />
              <col style={{ width: "42px" }} />
              <col style={{ width: "62px" }} />
              <col />
              <col style={{ width: "72px" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "60px" }} />
              <col style={{ width: "105px" }} />
              <col style={{ width: "96px" }} />
            </colgroup>
            <TableHeader>
              <TableRow className="border-b-2 border-slate-200" style={{ background: "#F8FAFA" }}>
                {selectMode && (
                  <TableHead className={`${TH} pl-3 text-center`}>
                    <button
                      type="button"
                      onClick={toggleAll}
                      className="inline-flex items-center justify-center"
                      data-testid="button-select-all"
                    >
                      {allSelected
                        ? <CheckSquare className="w-4 h-4 text-brand-600" />
                        : <Square className="w-4 h-4 text-slate-300" />}
                    </button>
                  </TableHead>
                )}
                <TableHead className={`${TH} pl-4 text-center`}>No.</TableHead>
                <TableHead className={`${TH} text-center`}>Type</TableHead>
                <TableHead className={TH}>Photo</TableHead>
                <TableHead className={`${TH} pl-4`}>Size</TableHead>
                <TableHead className={TH}>Item</TableHead>
                <TableHead className={`${TH} text-right`}>Qty / Unit</TableHead>
                <TableHead className={`${TH} pl-4`}>From</TableHead>
                <TableHead className={TH}>To</TableHead>
                <TableHead className={TH}>Project / PO</TableHead>
                <TableHead className={`${TH} text-center`}>Note</TableHead>
                <TableHead className={TH}>Date</TableHead>
                {/* Select / Delete / Cancel controls in header */}
                <TableHead className={`${TH} pr-3 text-right`}>
                  {canDelete && (
                    <div className="flex items-center justify-end gap-1.5">
                      {selectMode ? (
                        <>
                          {selectedIds.size > 0 && (
                            <button
                              type="button"
                              onClick={() => setConfirmOpen(true)}
                              className="inline-flex items-center gap-1 rounded-md bg-red-500 px-2 py-1 text-[10px] font-bold text-white hover:bg-red-600 transition-colors"
                              data-testid="button-delete-selected"
                            >
                              <Trash2 className="w-3 h-3" />
                              Delete ({selectedIds.size})
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={exitSelectMode}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                            data-testid="button-cancel-select"
                          >
                            <X className="w-3 h-3" />
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSelectMode(true)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                          data-testid="button-select-mode"
                        >
                          <CheckSquare className="w-3 h-3" />
                          Select
                        </button>
                      )}
                    </div>
                  )}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-100">
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={COLS} className="text-center py-12 text-slate-400">Loading…</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={COLS} className="text-center py-12 text-slate-400">No transactions found.</TableCell>
                </TableRow>
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
                  <TableRow
                    key={m.id}
                    className={`group transition-colors duration-100 ${selectMode ? "cursor-pointer" : "cursor-default"} ${isSelected ? "bg-brand-50/60" : ""}`}
                    style={{ borderLeft: isSelected ? "3px solid #0A6B24" : "3px solid transparent" }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderLeft = "3px solid #0A6B24"; }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderLeft = "3px solid transparent"; }}
                    onClick={selectMode ? () => toggleRow(m.id) : undefined}
                    data-testid={`field-tx-row-${m.id}`}
                  >
                    {/* Checkbox */}
                    {selectMode && (
                      <TableCell className="py-3 pl-3 text-center" onClick={e => { e.stopPropagation(); toggleRow(m.id); }}>
                        {isSelected
                          ? <CheckSquare className="w-4 h-4 text-brand-600 mx-auto" />
                          : <Square className="w-4 h-4 text-slate-300 mx-auto" />}
                      </TableCell>
                    )}

                    {/* No. */}
                    <TableCell className="py-3 pl-3 font-mono text-[11px] text-slate-400 group-hover:text-slate-600 transition-colors text-center">
                      {idx + 1}
                    </TableCell>

                    {/* Type */}
                    <TableCell className="py-3 px-1 text-center">
                      <span className="inline-block scale-[0.85] origin-center">
                        <TransactionTypeBadge type={m.movementType} />
                      </span>
                    </TableCell>

                    {/* Photo */}
                    <TableCell className="py-3 px-2">
                      <PhotoCell imageUrl={item?.imageUrl} name={item?.name ?? ""} />
                    </TableCell>

                    {/* Size — nowrap prevents wrapping */}
                    <TableCell className="py-3 pl-4 pr-1 text-xs font-semibold text-slate-500 whitespace-nowrap">
                      {item?.sizeLabel || <span className="text-slate-300">—</span>}
                    </TableCell>

                    {/* Item */}
                    <TableCell className="py-3 px-2">
                      <p className="text-sm font-semibold text-slate-800 leading-tight truncate group-hover:text-slate-900 transition-colors">
                        {item?.name ?? `#${m.itemId}`}
                      </p>
                    </TableCell>

                    {/* Qty + Unit */}
                    <TableCell className="py-3 px-2 text-right tabular-nums">
                      {(() => {
                        const isIncrease = m.movementType === "receive" || m.movementType === "return";
                        const color = isIncrease ? "#0A6B24" : "#DC2626";
                        return (
                          <div className="flex items-baseline justify-end gap-1">
                            <span className="text-sm font-bold" style={{ color }}>
                              {m.quantity}
                            </span>
                            {item?.unitOfMeasure && (
                              <span className="text-[10px] font-medium text-slate-400 uppercase">
                                {item.unitOfMeasure}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </TableCell>

                    {/* From */}
                    <TableCell className="py-3 pl-4 pr-2 text-xs text-slate-500 truncate group-hover:text-slate-700 transition-colors">
                      {fromLoc?.name ?? <span className="text-slate-300">—</span>}
                    </TableCell>

                    {/* To */}
                    <TableCell className="py-3 px-2 text-xs text-slate-500 truncate group-hover:text-slate-700 transition-colors">
                      {toLoc?.name ?? <span className="text-slate-300">—</span>}
                    </TableCell>

                    {/* Project / PO */}
                    <TableCell className="py-3 px-2">
                      {projectName || projectPo ? (
                        <div className="flex flex-col gap-0.5">
                          {projectName && (
                            <span className="text-xs font-semibold text-slate-700 leading-tight break-words">
                              {projectName}
                            </span>
                          )}
                          {projectPo && (
                            <span className="text-[11px] text-slate-400 leading-tight">
                              {projectPo}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </TableCell>

                    {/* Note — centered */}
                    <TableCell className="py-3 px-2 text-xs text-slate-400 truncate text-center">
                      {m.note || <span className="text-slate-300">—</span>}
                    </TableCell>

                    {/* Date */}
                    <TableCell className="py-3 px-2 group-hover:text-slate-800 transition-colors">
                      {m.createdAt ? (
                        <div className="flex flex-col leading-tight">
                          <span className="text-xs font-medium text-slate-600">
                            {format(new Date(m.createdAt), "MMM d, yyyy")}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {format(new Date(m.createdAt), "HH:mm")}
                          </span>
                        </div>
                      ) : "—"}
                    </TableCell>

                    {/* Actions column — empty in rows */}
                    <TableCell className="py-3 pr-3" />
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {filtered.length > 0 && (
          <div className="px-4 py-2.5 border-t border-slate-100 text-xs text-slate-400 bg-slate-50/50">
            Showing <span className="font-semibold text-slate-600">{filtered.length}</span> transaction{filtered.length !== 1 ? "s" : ""}
            {selectMode && selectedIds.size > 0 && (
              <span className="ml-2 text-brand-600 font-semibold">· {selectedIds.size} selected</span>
            )}
          </div>
        )}
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
