import { useState } from "react";
import { useMovements } from "@/hooks/use-transactions";
import { useProjects } from "@/hooks/use-reference-data";
import { TransactionTypeBadge } from "@/components/StatusBadge";
import { Search, ClipboardList, ImageOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, subDays, startOfDay } from "date-fns";

const DATE_PRESETS = [
  { label: "Last 7 days",  days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
];

const TH = "text-xs font-semibold text-slate-400 uppercase tracking-wide py-2.5 whitespace-nowrap";

function PhotoCell({ imageUrl, name }: { imageUrl?: string | null; name: string }) {
  if (!imageUrl) {
    return (
      <div className="w-9 h-9 rounded-md bg-slate-100 flex items-center justify-center flex-shrink-0">
        <ImageOff className="w-4 h-4 text-slate-300" />
      </div>
    );
  }
  return (
    <img
      src={imageUrl}
      alt={name}
      className="w-9 h-9 rounded-md object-cover flex-shrink-0"
      onError={e => {
        const p = e.currentTarget.parentElement;
        if (p) p.innerHTML = '<div class="w-9 h-9 rounded-md bg-slate-100 flex items-center justify-center"><svg class="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg></div>';
      }}
    />
  );
}

export default function FieldTransactions() {
  const [search, setSearch]         = useState("");
  const [typeFilter, setType]       = useState("all");
  const [datePreset, setPreset]     = useState("30");
  const [projectFilter, setProject] = useState("all");

  const { data: movements, isLoading } = useMovements();
  const { data: projects } = useProjects();

  const projectMap = Object.fromEntries((projects ?? []).map(p => [p.id, p]));

  const cutoff = startOfDay(subDays(new Date(), parseInt(datePreset)));

  const filtered = (movements ?? []).filter(m => {
    const item     = (m as any).item;
    const itemName = item?.name?.toLowerCase() ?? "";
    const sku      = item?.sku?.toLowerCase() ?? "";
    const q        = search.toLowerCase();
    if (q && !itemName.includes(q) && !sku.includes(q) && !String(m.id).includes(q)) return false;
    if (typeFilter !== "all" && m.movementType !== typeFilter) return false;
    if (projectFilter !== "all" && String(m.projectId) !== projectFilter) return false;
    const moved = new Date(m.createdAt ?? "");
    if (moved < cutoff) return false;
    return true;
  });

  const COLS = 11; // No. Type Photo Size Item Qty From To Project/PO Note Date

  return (
    <div className="space-y-5 pt-6 pb-12">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <ClipboardList className="w-5 h-5 text-brand-700" />
          <h1 className="text-2xl font-display font-bold text-slate-900">Transactions</h1>
        </div>
        <p className="text-slate-500 text-sm">View-only transaction history.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search item / SKU / ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
            data-testid="field-tx-search"
          />
        </div>
        <Select value={typeFilter} onValueChange={setType}>
          <SelectTrigger className="w-36 h-9 text-sm" data-testid="field-tx-type-filter">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="receive">Receive</SelectItem>
            <SelectItem value="issue">Issue</SelectItem>
            <SelectItem value="return">Return</SelectItem>
            <SelectItem value="transfer">Transfer</SelectItem>
          </SelectContent>
        </Select>
        <Select value={datePreset} onValueChange={setPreset}>
          <SelectTrigger className="w-36 h-9 text-sm" data-testid="field-tx-date-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATE_PRESETS.map(p => (
              <SelectItem key={p.days} value={String(p.days)}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(projects ?? []).length > 0 && (
          <Select value={projectFilter} onValueChange={setProject}>
            <SelectTrigger className="w-44 h-9 text-sm" data-testid="field-tx-project-filter">
              <SelectValue placeholder="Project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {(projects ?? []).map(p => (
                <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Table */}
      <div className="premium-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table style={{ minWidth: 1100 }}>
            <TableHeader>
              <TableRow className="bg-slate-50 border-b border-slate-200">
                <TableHead className={`${TH} pl-5 w-14`}>No.</TableHead>
                <TableHead className={`${TH} w-28`}>Type</TableHead>
                <TableHead className={`${TH} w-14`}>Photo</TableHead>
                <TableHead className={`${TH} w-20`}>Size</TableHead>
                <TableHead className={`${TH} min-w-[180px]`}>Item</TableHead>
                <TableHead className={`${TH} w-16 text-right`}>Qty</TableHead>
                <TableHead className={`${TH} min-w-[120px]`}>From</TableHead>
                <TableHead className={`${TH} min-w-[120px]`}>To</TableHead>
                <TableHead className={`${TH} min-w-[200px]`}>Project / PO Number</TableHead>
                <TableHead className={`${TH} min-w-[140px]`}>Note</TableHead>
                <TableHead className={`${TH} w-40 pr-5`}>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={COLS} className="text-center py-12 text-slate-400">Loading…</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={COLS} className="text-center py-12 text-slate-400">No transactions found.</TableCell>
                </TableRow>
              ) : filtered.map(m => {
                const mx      = m as any;
                const item    = mx.item;
                const project = mx.project ?? (m.projectId ? projectMap[m.projectId] : null);
                const fromLoc = mx.sourceLocation;
                const toLoc   = mx.destinationLocation;

                const projectPoLabel = project
                  ? project.poNumber
                    ? `${project.name} / ${project.poNumber}`
                    : project.name
                  : "—";

                return (
                  <TableRow
                    key={m.id}
                    className="hover:bg-slate-50/60 transition-colors"
                    data-testid={`field-tx-row-${m.id}`}
                  >
                    {/* No. */}
                    <TableCell className="py-3 pl-5 font-mono text-xs text-slate-400 w-14">
                      #{m.id}
                    </TableCell>

                    {/* Type */}
                    <TableCell className="py-3 w-28">
                      <TransactionTypeBadge type={m.movementType} />
                    </TableCell>

                    {/* Photo */}
                    <TableCell className="py-3 w-14">
                      <PhotoCell imageUrl={item?.imageUrl} name={item?.name ?? ""} />
                    </TableCell>

                    {/* Size */}
                    <TableCell className="py-3 w-20 text-sm text-slate-600 font-medium">
                      {item?.sizeLabel || "—"}
                    </TableCell>

                    {/* Item */}
                    <TableCell className="py-3 min-w-[180px]">
                      {item ? (
                        <div>
                          <p className="text-sm font-medium text-slate-800 leading-tight">{item.name}</p>
                          <p className="text-xs text-slate-400 font-mono">{item.sku}</p>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-sm">#{m.itemId}</span>
                      )}
                    </TableCell>

                    {/* Qty */}
                    <TableCell className="py-3 w-16 text-right font-semibold text-slate-900 tabular-nums">
                      {m.quantity}
                    </TableCell>

                    {/* From */}
                    <TableCell className="py-3 min-w-[120px] text-sm text-slate-600">
                      {fromLoc?.name ?? "—"}
                    </TableCell>

                    {/* To */}
                    <TableCell className="py-3 min-w-[120px] text-sm text-slate-600">
                      {toLoc?.name ?? "—"}
                    </TableCell>

                    {/* Project / PO Number */}
                    <TableCell className="py-3 min-w-[200px] text-sm text-slate-700 font-medium">
                      {projectPoLabel}
                    </TableCell>

                    {/* Note */}
                    <TableCell className="py-3 min-w-[140px] text-sm text-slate-500">
                      {m.note || "—"}
                    </TableCell>

                    {/* Date */}
                    <TableCell className="py-3 pr-5 w-40 text-sm text-slate-500 whitespace-nowrap">
                      {m.createdAt ? format(new Date(m.createdAt), "MMM d, yyyy HH:mm") : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {filtered.length > 0 && (
          <div className="px-5 py-2.5 border-t border-slate-100 text-xs text-slate-400">
            Showing {filtered.length} transaction{filtered.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
}
