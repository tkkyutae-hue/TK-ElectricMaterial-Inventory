import { useState } from "react";
import { useTransactions, useCreateTransaction } from "@/hooks/use-transactions";
import { useItems } from "@/hooks/use-items";
import { useProjects } from "@/hooks/use-reference-data";
import { TransactionTypeBadge } from "@/components/StatusBadge";
import { Plus, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTransactionSchema } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { format } from "date-fns";
import { z } from "zod";

export default function Transactions() {
  const { data: transactions, isLoading } = useTransactions();
  const { data: items } = useItems();
  const { data: projects } = useProjects();
  
  const createMutation = useCreateTransaction();
  const [dialogOpen, setDialogOpen] = useState(false);

  const form = useForm<z.infer<typeof insertTransactionSchema>>({
    resolver: zodResolver(insertTransactionSchema),
    defaultValues: {
      actionType: "receive",
      quantity: 1,
    }
  });

  const watchActionType = form.watch("actionType");

  function onSubmit(data: z.infer<typeof insertTransactionSchema>) {
    createMutation.mutate(data, {
      onSuccess: () => {
        setDialogOpen(false);
        form.reset();
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Transactions</h1>
          <p className="text-slate-500 mt-1">Log and view all inventory movements.</p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20">
              <ArrowRightLeft className="w-4 h-4 mr-2" />
              Log Movement
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Log Inventory Movement</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <FormField control={form.control} name="actionType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Action Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select Action" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="receive">Receive Stock (In)</SelectItem>
                        <SelectItem value="issue">Issue Stock (Out to Project)</SelectItem>
                        <SelectItem value="return">Return to Stock (In from Project)</SelectItem>
                        <SelectItem value="adjust">Adjustment (Correction)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="itemId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item</FormLabel>
                    <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString()}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select Item" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {items?.map(i => <SelectItem key={i.id} value={i.id.toString()}>{i.sku} - {i.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="quantity" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                {(watchActionType === 'issue' || watchActionType === 'return') && (
                  <FormField control={form.control} name="projectId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project</FormLabel>
                      <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString()}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select Project" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {projects?.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.code} - {p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}

                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl><Input placeholder="Reason or reference number" {...field} value={field.value || ''} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={createMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
                    {createMutation.isPending ? "Logging..." : "Log Transaction"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="premium-card bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow>
                <TableHead className="font-semibold text-slate-600">Date</TableHead>
                <TableHead className="font-semibold text-slate-600">Item</TableHead>
                <TableHead className="font-semibold text-slate-600">Type</TableHead>
                <TableHead className="font-semibold text-slate-600 text-right">Quantity</TableHead>
                <TableHead className="font-semibold text-slate-600">Reference / Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-500">Loading transactions...</TableCell></TableRow>
              ) : transactions?.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-500">No transactions found.</TableCell></TableRow>
              ) : (
                transactions?.map((tx) => (
                  <TableRow key={tx.id} className="hover:bg-slate-50/50">
                    <TableCell className="text-sm text-slate-600">{format(new Date(tx.createdAt), 'MMM d, yyyy HH:mm')}</TableCell>
                    <TableCell className="font-medium text-slate-900">{tx.item?.name || `Item #${tx.itemId}`}</TableCell>
                    <TableCell><TransactionTypeBadge type={tx.actionType} /></TableCell>
                    <TableCell className="text-right font-semibold">
                      {['issue'].includes(tx.actionType) ? <span className="text-red-600">-{tx.quantity}</span> : <span className="text-emerald-600">+{tx.quantity}</span>}
                    </TableCell>
                    <TableCell className="text-sm text-slate-500 max-w-xs truncate">
                      {tx.project && <span className="mr-2 font-medium text-slate-700">[{tx.project.code}]</span>}
                      {tx.notes}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
