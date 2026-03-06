import { useState } from "react";
import { useMovements } from "@/hooks/use-transactions";
import { useItems } from "@/hooks/use-items";
import { useProjects } from "@/hooks/use-reference-data";
import { TransactionTypeBadge } from "@/components/StatusBadge";
import { Search, ClipboardList, CalendarIcon } from "lucide-react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, subDays, startOfDay, endOfDay } from "date-fns";

const DATE_PRESETS = [
  { label: "Last 7 days",  days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
];

export default function FieldTransactions() {
  const [search, setSearch]     = useState("");
  const [typeFilter, setType]   = useState("all");
  const [datePreset, setPreset] = useState("30");
  const [projectFilter, setProject] = useState("all");

  const { data: movements, isLoading } = useMovements();
  const { data: items }    = useItems();
  const { data: projects } = useProjects();

  const itemMap    = Object.fromEntries((items ?? []).map(i => [i.id, i]));
  const projectMap = Object.fromEntries((projects ?? []).map(p => [p.id, p]));

  const cutoff = startOfDay(subDays(new Date(), parseInt(datePreset)));

  const filtered = (movements ?? []).filter(m => {
    const item     = itemMap[m.itemId];
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

  return (
    <div className="space-y-5">
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
            <SelectTrigger className="w-40 h-9 text-sm" data-testid="field-tx-project-filter">
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
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 border-b border-slate-200">
                <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-2 pl-5">ID</TableHead>
                <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-2">Type</TableHead>
                <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-2">Item</TableHead>
                <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-2 text-right">Qty</TableHead>
                <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-2">Project</TableHead>
                <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-2">Note</TableHead>
                <TableHead className="text-xs font-semibold text-slate-400 uppercase tracking-wide py-2 pr-5">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-slate-400">Loading…</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-slate-400">No transactions found.</TableCell>
                </TableRow>
              ) : filtered.map(m => {
                const item    = itemMap[m.itemId];
                const project = m.projectId ? projectMap[m.projectId] : null;
                const dateStr = m.movedAt ?? m.createdAt;
                return (
                  <TableRow key={m.id} className="hover:bg-slate-50/60 transition-colors" data-testid={`field-tx-row-${m.id}`}>
                    <TableCell className="py-2.5 pl-5 font-mono text-xs text-slate-400">#{m.id}</TableCell>
                    <TableCell className="py-2.5">
                      <TransactionTypeBadge type={m.movementType} />
                    </TableCell>
                    <TableCell className="py-2.5">
                      {item ? (
                        <div>
                          <p className="text-sm font-medium text-slate-800 leading-tight">{item.name}</p>
                          <p className="text-xs text-slate-400 font-mono">{item.sku}</p>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-sm">#{m.itemId}</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2.5 text-right font-semibold text-slate-900 tabular-nums">
                      {m.quantity}
                    </TableCell>
                    <TableCell className="py-2.5 text-sm text-slate-600">
                      {project?.name ?? "—"}
                    </TableCell>
                    <TableCell className="py-2.5 text-sm text-slate-500 max-w-[160px] truncate">
                      {m.note || "—"}
                    </TableCell>
                    <TableCell className="py-2.5 pr-5 text-sm text-slate-500 whitespace-nowrap">
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
