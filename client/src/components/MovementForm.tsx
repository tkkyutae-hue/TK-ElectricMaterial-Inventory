import { useState, useRef, useEffect } from "react";
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
import { Search, X, ChevronDown } from "lucide-react";

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
  { value: "receive",  label: "Receive",  desc: "Stock arriving from a supplier" },
  { value: "issue",    label: "Issue",    desc: "Material going out to a jobsite" },
  { value: "return",   label: "Return",   desc: "Material returned from the field" },
  { value: "transfer", label: "Transfer", desc: "Move between locations" },
];

export function SearchableItemSelect({
  value, onChange, items,
}: {
  value?: number;
  onChange: (id: number) => void;
  items: any[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = items.find(i => i.id === value);

  const filtered = search.trim()
    ? items.filter(i => {
        const q = search.toLowerCase();
        return (
          i.name?.toLowerCase().includes(q) ||
          i.sku?.toLowerCase().includes(q) ||
          i.sizeLabel?.toLowerCase().includes(q)
        );
      })
    : items;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 60);
  }, [open]);

  return (
    <div ref={ref} className="relative" data-testid="searchable-item-select">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm border border-input rounded-md bg-background hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-ring text-left min-h-[38px]"
        data-testid="item-select-trigger"
      >
        {selected ? (
          <span className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-xs text-slate-400 shrink-0">{selected.sku}</span>
            <span className="truncate text-slate-900">{selected.name}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">Search or select an item…</span>
        )}
        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-slate-100 flex items-center gap-2 bg-slate-50/80">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search by name, SKU, or size…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 text-sm outline-none bg-transparent text-slate-900 placeholder:text-slate-400"
              data-testid="item-search-input"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="p-0.5">
                <X className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
              </button>
            )}
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-4">No items found</p>
            ) : (
              filtered.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { onChange(item.id); setOpen(false); setSearch(""); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-brand-50 transition-colors ${item.id === value ? 'bg-brand-50' : ''}`}
                  data-testid={`item-option-${item.id}`}
                >
                  <span className="font-mono text-xs text-slate-400 w-24 shrink-0 truncate">{item.sku}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{item.name}</p>
                    {item.sizeLabel && <p className="text-xs text-slate-400">{item.sizeLabel}</p>}
                  </div>
                  <span className="text-xs text-slate-400 shrink-0">{item.quantityOnHand} {item.unitOfMeasure}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

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

  // Direction semantics:
  // Receive → "Receive From" = sourceLocationId (external supplier location)
  // Issue → "Issue To" = destinationLocationId (jobsite/project location)
  // Return → "Return From" = sourceLocationId (returning from jobsite)
  // Transfer → From (sourceLocationId) + To (destinationLocationId)
  const needsSource      = ["receive", "return", "transfer"].includes(movType);
  const needsDestination = ["issue", "transfer"].includes(movType);
  const needsProject     = ["receive", "issue", "return"].includes(movType);

  const sourceLabel      = movType === "receive" ? "Receive From" : movType === "return" ? "Return From" : "From Location";
  const destLabel        = movType === "issue" ? "Issue To" : "To Location";

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
              <FormControl>
                <SelectTrigger data-testid="select-movement-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {MOVEMENT_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>
                    <span className="font-medium">{t.label}</span>
                    <span className="text-slate-400 text-xs ml-2">— {t.desc}</span>
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
            <FormLabel>Quantity {selectedItem ? `(${selectedItem.unitOfMeasure})` : ""}</FormLabel>
            <FormControl>
              <Input type="number" min={1} {...field} data-testid="input-quantity" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <div className="grid grid-cols-2 gap-4">
          {needsSource && (
            <FormField control={form.control} name="sourceLocationId" render={({ field }) => (
              <FormItem>
                <FormLabel>{sourceLabel}</FormLabel>
                <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value?.toString()}>
                  <FormControl><SelectTrigger data-testid="select-source-location"><SelectValue placeholder="Select location…" /></SelectTrigger></FormControl>
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
                <FormLabel>{destLabel}</FormLabel>
                <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value?.toString()}>
                  <FormControl><SelectTrigger data-testid="select-dest-location"><SelectValue placeholder="Select location…" /></SelectTrigger></FormControl>
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
                <FormControl><SelectTrigger data-testid="select-project"><SelectValue placeholder="Select project" /></SelectTrigger></FormControl>
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
            <FormControl>
              <Textarea placeholder="Reference number, PO, reason…" className="resize-none" rows={2} {...field} data-testid="input-note" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={createMutation.isPending} className="bg-brand-700 hover:bg-brand-800 min-w-[140px]" data-testid="button-submit-movement">
            {createMutation.isPending ? "Logging…" : "Log Movement"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
