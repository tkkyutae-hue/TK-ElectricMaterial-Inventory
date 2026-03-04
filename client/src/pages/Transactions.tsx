import { useState } from "react";
import { useMovements, useUpdateMovement, useDeleteMovement } from "@/hooks/use-transactions";
import { useItems } from "@/hooks/use-items";
import { useLocations, useProjects } from "@/hooks/use-reference-data";
import { TransactionTypeBadge } from "@/components/StatusBadge";
import { MovementForm } from "@/components/MovementForm";
import { SearchableItemSelect } from "@/components/MovementForm";
import { Search, ArrowRightLeft, Edit2, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

const editSchema = z.object({
  movementType:        z.string().min(1),
  itemId:              z.coerce.number().min(1, "Item is required"),
  quantity:            z.coerce.number().min(1, "Must be at least 1"),
  sourceLocationId:    z.coerce.number().optional(),
  destinationLocationId: z.coerce.number().optional(),
  projectId:           z.coerce.number().optional(),
  note:                z.string().optional(),
});

type EditFormData = z.infer<typeof editSchema>;

const EDIT_MOVEMENT_TYPES = [
  { value: "receive",  label: "Receive" },
  { value: "issue",    label: "Issue" },
  { value: "return",   label: "Return" },
  { value: "transfer", label: "Transfer" },
];

function EditTransactionDialog({
  tx, open, onClose
}: { tx: any; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const updateMutation = useUpdateMovement();
  const deleteMutation = useDeleteMovement();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { data: items } = useItems();
  const { data: locations } = useLocations();
  const { data: projects } = useProjects();

  const form = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      movementType:          tx.movementType,
      itemId:                tx.itemId,
      quantity:              tx.quantity,
      sourceLocationId:      tx.sourceLocationId || undefined,
      destinationLocationId: tx.destinationLocationId || undefined,
      projectId:             tx.projectId || undefined,
      note:                  tx.note || "",
    },
  });

  const movType = form.watch("movementType");
  const needsSource      = ["issue", "transfer"].includes(movType);
  const needsDestination = ["receive", "return", "transfer"].includes(movType);
  const needsProject     = ["receive", "issue", "return"].includes(movType);

  async function onSubmit(data: EditFormData) {
    try {
      await updateMutation.mutateAsync({
        id: tx.id,
        movementType:          data.movementType,
        itemId:                data.itemId,
        quantity:              data.quantity,
        sourceLocationId:      data.sourceLocationId || null,
        destinationLocationId: data.destinationLocationId || null,
        projectId:             data.projectId || null,
        note:                  data.note || null,
      });
      toast({ title: "Transaction updated", description: "Stock balances have been recalculated." });
      onClose();
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    }
  }

  async function handleDelete() {
    try {
      await deleteMutation.mutateAsync(tx.id);
      toast({ title: "Transaction deleted", description: "Stock balances have been updated." });
      onClose();
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Transaction #{tx.id}</DialogTitle>
          <p className="text-xs text-slate-400 mt-1">
            Editing this transaction will recalculate item stock balances automatically.
          </p>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <FormField control={form.control} name="movementType" render={({ field }) => (
              <FormItem>
                <FormLabel>Movement Type</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger data-testid="edit-tx-type"><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    {EDIT_MOVEMENT_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="itemId" render={({ field }) => (
              <FormItem>
                <FormLabel>Item</FormLabel>
                <FormControl>
                  <SearchableItemSelect
                    value={field.value}
                    onChange={(id) => field.onChange(id)}
                    items={items || []}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="quantity" render={({ field }) => (
              <FormItem>
                <FormLabel>Quantity</FormLabel>
                <FormControl><Input type="number" min={1} {...field} data-testid="edit-tx-qty" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              {needsSource && (
                <FormField control={form.control} name="sourceLocationId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>From Location</FormLabel>
                    <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value?.toString()}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Source" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {locations?.map((l: any) => <SelectItem key={l.id} value={l.id.toString()}>{l.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
              {needsDestination && (
                <FormField control={form.control} name="destinationLocationId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>To Location</FormLabel>
                    <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value?.toString()}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Location" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {locations?.map((l: any) => <SelectItem key={l.id} value={l.id.toString()}>{l.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
            </div>

            {needsProject && (
              <FormField control={form.control} name="projectId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Project (Optional)</FormLabel>
                  <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value?.toString()}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {projects?.map((p: any) => (
                        <SelectItem key={p.id} value={p.id.toString()}>{p.code} — {p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            )}

            <FormField control={form.control} name="note" render={({ field }) => (
              <FormItem>
                <FormLabel>Note</FormLabel>
                <FormControl><Textarea rows={2} className="resize-none" {...field} data-testid="edit-tx-note" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {confirmDelete ? (
              <div className="border border-rose-200 bg-rose-50 rounded-xl p-4 space-y-3" data-testid="confirm-delete-panel">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-rose-900 text-sm">Delete this transaction?</p>
                    <p className="text-xs text-rose-700 mt-0.5">
                      This will permanently remove Transaction #{tx.id} and reverse its stock impact. This cannot be undone.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={() => setConfirmDelete(false)} disabled={deleteMutation.isPending}>
                    Keep it
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="bg-rose-600 hover:bg-rose-700 text-white"
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                    data-testid="button-confirm-delete"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    {deleteMutation.isPending ? "Deleting…" : "Yes, Delete"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                  onClick={() => setConfirmDelete(true)}
                  data-testid="button-delete-transaction"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Delete
                </Button>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={onClose} disabled={updateMutation.isPending}>Cancel</Button>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={updateMutation.isPending} data-testid="button-save-transaction">
                    {updateMutation.isPending ? "Saving…" : "Save Changes"}
                  </Button>
                </div>
              </div>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function Transactions() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [logOpen, setLogOpen] = useState(false);
  const [editTx, setEditTx] = useState<any | null>(null);

  const { data: movements, isLoading } = useMovements(
    typeFilter !== "all" ? { movementType: typeFilter } : {}
  );
  const { data: projects } = useProjects();

  const filtered = movements?.filter((tx: any) => {
    const matchSearch = !search ||
      tx.item?.name?.toLowerCase().includes(search.toLowerCase()) ||
      tx.item?.sku?.toLowerCase().includes(search.toLowerCase());
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

        <Dialog open={logOpen} onOpenChange={setLogOpen}>
          <Button
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-600/20"
            onClick={() => setLogOpen(true)}
            data-testid="button-log-movement"
          >
            <ArrowRightLeft className="w-4 h-4 mr-2" />
            Log Movement
          </Button>
          <DialogContent className="sm:max-w-[550px]">
            <DialogHeader>
              <DialogTitle>Log Inventory Movement</DialogTitle>
            </DialogHeader>
            <div className="pt-2">
              <MovementForm onSuccess={() => setLogOpen(false)} />
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="premium-card bg-white overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3 bg-slate-50/50">
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
            <SelectTrigger className="w-[160px] bg-white" data-testid="select-tx-type">
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
            <SelectTrigger className="w-[180px] bg-white">
              <SelectValue placeholder="All projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects?.map((p: any) => (
                <SelectItem key={p.id} value={p.id.toString()}>{p.code}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80">
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide w-[90px]">Date</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide w-[100px]">Type</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Item</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-right w-[80px]">Qty</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide w-[130px]">From</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide w-[130px]">To</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide w-[80px]">Project</TableHead>
                <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Note</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(9)].map((__, j) => (
                      <TableCell key={j}><div className="h-4 bg-slate-100 rounded animate-pulse" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : !filtered?.length ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-slate-500">
                    <ArrowRightLeft className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                    <p className="font-medium text-slate-900">No transactions found</p>
                    <p className="text-sm">Try adjusting filters or log a new movement.</p>
                  </TableCell>
                </TableRow>
              ) : (
                filtered?.map((tx: any) => (
                  <TableRow key={tx.id} className="hover:bg-slate-50/50 group" data-testid={`row-tx-${tx.id}`}>
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
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-7 h-7 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-slate-700"
                        onClick={() => setEditTx(tx)}
                        data-testid={`button-edit-tx-${tx.id}`}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
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

      {editTx && (
        <EditTransactionDialog
          tx={editTx}
          open={!!editTx}
          onClose={() => setEditTx(null)}
        />
      )}
    </div>
  );
}
