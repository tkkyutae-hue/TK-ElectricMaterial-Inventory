import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useItems } from "@/hooks/use-items";
import { useLocations, useProjects } from "@/hooks/use-reference-data";
import { useCreateMovement } from "@/hooks/use-transactions";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const schema = z.object({
  movementType: z.string().min(1),
  itemId: z.coerce.number().min(1, "Item is required"),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  sourceLocationId: z.coerce.number().optional(),
  destinationLocationId: z.coerce.number().optional(),
  projectId: z.coerce.number().optional(),
  note: z.string().optional(),
  reason: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const MOVEMENT_TYPES = [
  { value: "receive", label: "Receive", desc: "Stock arriving from a supplier" },
  { value: "issue", label: "Issue", desc: "Material going out to a jobsite" },
  { value: "return", label: "Return", desc: "Material returned from the field" },
  { value: "adjust", label: "Adjust", desc: "Cycle count or count correction" },
  { value: "transfer", label: "Transfer", desc: "Move between locations" },
];

interface MovementFormProps {
  defaultType?: string;
  defaultItemId?: number;
  onSuccess?: () => void;
}

export function MovementForm({ defaultType = "receive", defaultItemId, onSuccess }: MovementFormProps) {
  const { toast } = useToast();
  const { data: items } = useItems();
  const { data: locations } = useLocations();
  const { data: projects } = useProjects();
  const createMutation = useCreateMovement();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      movementType: defaultType,
      itemId: defaultItemId,
      quantity: 1,
    },
  });

  const movType = form.watch("movementType");
  const selectedItem = items?.find((i: any) => i.id === form.watch("itemId"));

  const needsSource = ["issue", "transfer"].includes(movType);
  const needsDestination = ["receive", "return", "transfer"].includes(movType);
  const needsProject = ["issue", "return"].includes(movType);
  const needsReason = movType === "adjust";
  const isAdjust = movType === "adjust";

  async function onSubmit(data: FormData) {
    try {
      await createMutation.mutateAsync({
        movementType: data.movementType,
        itemId: data.itemId,
        quantity: data.quantity,
        sourceLocationId: data.sourceLocationId || null,
        destinationLocationId: data.destinationLocationId || null,
        projectId: data.projectId || null,
        note: data.note || null,
        reason: data.reason || null,
      });
      toast({ title: "Movement logged", description: `${data.movementType} recorded successfully.` });
      form.reset({ movementType: data.movementType, quantity: 1 });
      onSuccess?.();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="movementType" render={({ field }) => (
          <FormItem>
            <FormLabel>Movement Type</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
              <SelectContent>
                {MOVEMENT_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>
                    <span className="font-medium">{t.label}</span>
                    <span className="text-slate-400 text-xs ml-2">– {t.desc}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="itemId" render={({ field }) => (
          <FormItem>
            <FormLabel>Item</FormLabel>
            <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value?.toString()}>
              <FormControl><SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger></FormControl>
              <SelectContent className="max-h-60">
                {items?.map((i: any) => (
                  <SelectItem key={i.id} value={i.id.toString()}>
                    <span className="font-mono text-xs text-slate-400 mr-2">{i.sku}</span>{i.name}
                    <span className="text-slate-400 text-xs ml-2">({i.quantityOnHand} {i.unitOfMeasure})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )} />

        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="quantity" render={({ field }) => (
            <FormItem>
              <FormLabel>{isAdjust ? "Corrected Quantity" : "Quantity"} {selectedItem ? `(${selectedItem.unitOfMeasure})` : ""}</FormLabel>
              {isAdjust && selectedItem && (
                <p className="text-xs text-slate-500">Current: {selectedItem.quantityOnHand} {selectedItem.unitOfMeasure}</p>
              )}
              <FormControl><Input type="number" min="0" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />

          {needsReason && (
            <FormField control={form.control} name="reason" render={({ field }) => (
              <FormItem>
                <FormLabel>Reason</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="Cycle Count Correction">Cycle Count</SelectItem>
                    <SelectItem value="Physical Inventory">Physical Inventory</SelectItem>
                    <SelectItem value="Damage/Shrinkage">Damage / Shrinkage</SelectItem>
                    <SelectItem value="Found Stock">Found Stock</SelectItem>
                    <SelectItem value="Data Entry Error">Data Entry Error</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {needsSource && (
            <FormField control={form.control} name="sourceLocationId" render={({ field }) => (
              <FormItem>
                <FormLabel>From Location</FormLabel>
                <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value?.toString()}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Source location" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {locations?.map((l: any) => (
                      <SelectItem key={l.id} value={l.id.toString()}>{l.name}</SelectItem>
                    ))}
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
                  <FormControl><SelectTrigger><SelectValue placeholder="Destination" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {locations?.map((l: any) => (
                      <SelectItem key={l.id} value={l.id.toString()}>{l.name}</SelectItem>
                    ))}
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
                  {projects?.filter((p: any) => p.status === 'active').map((p: any) => (
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
            <FormLabel>Note (Optional)</FormLabel>
            <FormControl><Textarea placeholder="Reference number, PO, reason..." className="resize-none" rows={2} {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={createMutation.isPending} className="bg-blue-600 hover:bg-blue-700 min-w-[140px]">
            {createMutation.isPending ? "Logging..." : "Log Movement"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
