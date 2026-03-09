import { useState, useMemo } from "react";
import { useMovements } from "@/hooks/use-transactions";
import { TransactionTypeBadge } from "@/components/StatusBadge";
import { Search, ClipboardList, ImageOff, ArrowRightLeft, Navigation, FolderKanban, CalendarDays } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, startOfDay, endOfDay } from "date-fns";

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
  const [search, setSearch]       = useState("");
  const [fromFilter, setFrom]     = useState("all");
  const [toFilter, setTo]         = useState("all");
  const [projectFilter, setProj]  = useState("all");
  const [dateFrom, setDateFrom]   = useState("");
  const [dateTo, setDateTo]       = useState("");

  const { data: movements, isLoading } = useMovements();

  // Derive unique from/to/project options from movement data
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

  const COLS = 11;

  return (
    <div className="space-y-4 pt-5 pb-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <ClipboardList className="w-5 h-5 text-brand-700" />
          <h1 className="text-2xl font-display font-bold text-slate-900">Transactions</h1>
        </div>
        <p className="text-slate-500 text-sm">View-only transaction history.</p>
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
        {/* From */}
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

        {/* To */}
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

        {/* Project / PO */}
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

        {/* Date range */}
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

      {/* Table — no horizontal scroll */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <Table className="w-full table-fixed">
          <colgroup>
            <col style={{ width: "46px" }} />
            <col style={{ width: "76px" }} />
            <col style={{ width: "42px" }} />
            <col style={{ width: "44px" }} />
            <col />
            <col style={{ width: "72px" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "118px" }} />
          </colgroup>
          <TableHeader>
            <TableRow className="border-b-2 border-slate-200" style={{ background: "#F8FAFA" }}>
              <TableHead className={`${TH} pl-4 text-center`}>No.</TableHead>
              <TableHead className={`${TH} text-center`}>Type</TableHead>
              <TableHead className={TH}>Photo</TableHead>
              <TableHead className={`${TH} pl-4`}>Size</TableHead>
              <TableHead className={TH}>Item</TableHead>
              <TableHead className={`${TH} text-right`}>Qty / Unit</TableHead>
              <TableHead className={TH}>From</TableHead>
              <TableHead className={TH}>To</TableHead>
              <TableHead className={TH}>Project / PO</TableHead>
              <TableHead className={TH}>Note</TableHead>
              <TableHead className={`${TH} pr-4`}>Date</TableHead>
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

              const projectName = project?.name ?? null;
              const projectPo   = project?.poNumber ?? null;

              return (
                <TableRow
                  key={m.id}
                  className="group transition-colors duration-100 cursor-default"
                  style={{ borderLeft: "3px solid transparent" }}
                  onMouseEnter={e => (e.currentTarget.style.borderLeft = "3px solid #0A6B24")}
                  onMouseLeave={e => (e.currentTarget.style.borderLeft = "3px solid transparent")}
                  data-testid={`field-tx-row-${m.id}`}
                >
                  {/* No. */}
                  <TableCell className="py-3 pl-3 font-mono text-[11px] text-slate-400 group-hover:text-slate-600 transition-colors text-center">
                    {idx + 1}
                  </TableCell>

                  {/* Type */}
                  <TableCell className="py-3 pl-2 pr-1">
                    <span className="inline-block scale-[0.85] origin-left">
                      <TransactionTypeBadge type={m.movementType} />
                    </span>
                  </TableCell>

                  {/* Photo */}
                  <TableCell className="py-3 px-2">
                    <PhotoCell imageUrl={item?.imageUrl} name={item?.name ?? ""} />
                  </TableCell>

                  {/* Size */}
                  <TableCell className="py-3 pl-4 pr-2 text-xs font-semibold text-slate-500">
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
                  <TableCell className="py-3 px-2 text-xs text-slate-500 truncate group-hover:text-slate-700 transition-colors">
                    {fromLoc?.name ?? <span className="text-slate-300">—</span>}
                  </TableCell>

                  {/* To */}
                  <TableCell className="py-3 px-2 text-xs text-slate-500 truncate group-hover:text-slate-700 transition-colors">
                    {toLoc?.name ?? <span className="text-slate-300">—</span>}
                  </TableCell>

                  {/* Project / PO — stacked */}
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

                  {/* Note */}
                  <TableCell className="py-3 px-2 text-xs text-slate-400 truncate">
                    {m.note || <span className="text-slate-300">—</span>}
                  </TableCell>

                  {/* Date — date on top, time below */}
                  <TableCell className="py-3 px-2 pr-4 group-hover:text-slate-800 transition-colors">
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
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {filtered.length > 0 && (
          <div className="px-4 py-2.5 border-t border-slate-100 text-xs text-slate-400 bg-slate-50/50">
            Showing <span className="font-semibold text-slate-600">{filtered.length}</span> transaction{filtered.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
}
