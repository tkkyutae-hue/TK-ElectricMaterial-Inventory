import { useState } from "react";
import { useMovements } from "@/hooks/use-transactions";
import { useItems } from "@/hooks/use-items";
import { useLocations, useProjects } from "@/hooks/use-reference-data";
import { TransactionTypeBadge } from "@/components/StatusBadge";
import { MovementForm } from "@/components/MovementForm";
import { Plus, Search, Filter, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { format } from "date-fns";

export default function Transactions() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: movements, isLoading } = useMovements(
    typeFilter !== "all" ? { movementType: typeFilter } : {}
  );
  const { data: projects } = useProjects();

  const filtered = movements?.filter((tx: any) => {
    const matchSearch = !search || tx.item?.name?.toLowerCase().includes(search.toLowerCase()) || tx.item?.sku?.toLowerCase().includes(search.toLowerCase());
    const matchProject = projectFilter === "all" || tx.projectId === Number(projectFilter);
    return matchSearch && matchProject;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Transaction History</h1>
          <p className="text-slate-500 mt-1">Full log of all inventory movements.</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-600/20">
              <ArrowRightLeft className="w-4 h-4 mr-2" />
              Log Movement
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[550px]">
            <DialogHeader>
              <DialogTitle>Log Inventory Movement</DialogTitle>
            </DialogHeader>
            <div className="pt-2">
              <MovementForm onSuccess={() => setDialogOpen(false)} />
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="premium-card bg-white overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3 bg-slate-50/50">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by item name or SKU..."
              className="pl-9 bg-white border-slate-200"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[160px] bg-white"><SelectValue placeholder="All types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="receive">Receive</SelectItem>
              <SelectItem value="issue">Issue</SelectItem>
              <SelectItem value="return">Return</SelectItem>
              <SelectItem value="adjust">Adjust</SelectItem>
              <SelectItem value="transfer">Transfer</SelectItem>
            </SelectContent>
          </Select>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-[180px] bg-white"><SelectValue placeholder="All projects" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects?.map((p: any) => (
                <SelectItem key={p.id} value={String(p.id)}>{p.code}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-semibold text-slate-600 w-36">Date & Time</TableHead>
                <TableHead className="font-semibold text-slate-600">Type</TableHead>
                <TableHead className="font-semibold text-slate-600">Item</TableHead>
                <TableHead className="font-semibold text-slate-600 text-right">Qty</TableHead>
                <TableHead className="font-semibold text-slate-600">From</TableHead>
                <TableHead className="font-semibold text-slate-600">To</TableHead>
                <TableHead className="font-semibold text-slate-600">Project</TableHead>
                <TableHead className="font-semibold text-slate-600">Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [1,2,3,4,5].map(i => (
                  <TableRow key={i}>
                    {[...Array(8)].map((_, j) => (
                      <TableCell key={j}><div className="h-4 bg-slate-100 rounded animate-pulse" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-slate-500">
                    <ArrowRightLeft className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                    <p className="font-medium text-slate-900">No transactions found</p>
                    <p className="text-sm">Try adjusting filters or log a new movement.</p>
                  </TableCell>
                </TableRow>
              ) : (
                filtered?.map((tx: any) => (
                  <TableRow key={tx.id} className="hover:bg-slate-50/50">
                    <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                      {format(new Date(tx.createdAt), 'MMM d, yy')}<br />
                      <span className="text-slate-400">{format(new Date(tx.createdAt), 'HH:mm')}</span>
                    </TableCell>
                    <TableCell><TransactionTypeBadge type={tx.movementType} /></TableCell>
                    <TableCell>
                      <p className="font-medium text-slate-900 text-sm">{tx.item?.name || `Item #${tx.itemId}`}</p>
                      <p className="text-xs font-mono text-slate-400">{tx.item?.sku}</p>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {tx.movementType === 'issue' ? (
                        <span className="text-rose-600">-{tx.quantity}</span>
                      ) : tx.movementType === 'adjust' ? (
                        <span className="text-amber-600">{tx.newQuantity}</span>
                      ) : (
                        <span className="text-emerald-600">+{tx.quantity}</span>
                      )}
                      <span className="text-slate-400 text-xs ml-1">{tx.item?.unitOfMeasure}</span>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">{tx.sourceLocation?.name || '—'}</TableCell>
                    <TableCell className="text-xs text-slate-500">{tx.destinationLocation?.name || '—'}</TableCell>
                    <TableCell>
                      {tx.project ? (
                        <span className="text-xs font-mono bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{tx.project?.code}</span>
                      ) : <span className="text-slate-300">—</span>}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500 max-w-[140px] truncate">{tx.note || tx.reason || '—'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50">
          <p className="text-xs text-slate-500">{filtered?.length ?? 0} record{filtered?.length !== 1 ? 's' : ''}</p>
        </div>
      </div>
    </div>
  );
}
