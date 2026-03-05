import { useState, useRef, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useItems } from "@/hooks/use-items";
import { useLocations, useProjects } from "@/hooks/use-reference-data";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Search, X, ChevronDown, Plus, Trash2 } from "lucide-react";
import { api } from "@shared/routes";

const sharedSchema = z.object({
  movementType: z.string().min(1, "Movement type is required"),
  sourceLocationId: z.coerce.number().optional(),
  destinationLocationId: z.coerce.number().optional(),
  projectId: z.coerce.number().optional(),
  note: z.string().optional(),
});

type SharedData = z.infer<typeof sharedSchema>;

type ItemRowError = { itemId?: string; quantity?: string };

type ItemRow = {
  rowId: string;
  itemId: number | null;
  quantity: number;
  errors: ItemRowError;
};

const MOVEMENT_TYPES = [
  { value: "receive",  label: "Receive",  desc: "Stock arriving from a supplier" },
  { value: "issue",    label: "Issue",    desc: "Material going out to a jobsite" },
  { value: "return",   label: "Return",   desc: "Material returned from the field" },
  { value: "transfer", label: "Transfer", desc: "Move between locations" },
];

function makeRow(): ItemRow {
  return { rowId: crypto.randomUUID(), itemId: null, quantity: 1, errors: {} };
}

export function SearchableItemSelect({
  value, onChange, items,
}: {
  value?: number | null;
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
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-4">No items found</p>
            ) : (
              filtered.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { onChange(item.id); setOpen(false); setSearch(""); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-brand-50 transition-colors ${item.id === value ? "bg-brand-50" : ""}`}
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
  const qc = useQueryClient();
  const { data: items } = useItems();
  const { data: locations } = useLocations();
  const { data: projects } = useProjects();
  const [submitting, setSubmitting] = useState(false);

  const initialRow = makeRow();
  if (defaultItemId) initialRow.itemId = defaultItemId;

  const [itemRows, setItemRows] = useState<ItemRow[]>([initialRow]);

  const form = useForm<SharedData>({
    resolver: zodResolver(sharedSchema),
    defaultValues: {
      movementType: defaultType,
    },
  });

  const movType = form.watch("movementType");

  const needsSource      = ["receive", "return", "transfer"].includes(movType);
  const needsDestination = ["issue", "transfer"].includes(movType);
  const needsProject     = ["receive", "issue", "return"].includes(movType);
  const sourceLabel      = movType === "receive" ? "Receive From" : movType === "return" ? "Return From" : "From Location";
  const destLabel        = movType === "issue" ? "Issue To" : "To Location";

  const addRow = useCallback(() => {
    setItemRows(prev => [...prev, makeRow()]);
  }, []);

  const removeRow = useCallback((rowId: string) => {
    setItemRows(prev => prev.length > 1 ? prev.filter(r => r.rowId !== rowId) : prev);
  }, []);

  const updateRow = useCallback((rowId: string, patch: Partial<Pick<ItemRow, "itemId" | "quantity">>) => {
    setItemRows(prev => prev.map(r => r.rowId === rowId ? { ...r, ...patch, errors: {} } : r));
  }, []);

  function validateRows(): boolean {
    let valid = true;
    setItemRows(prev => prev.map(r => {
      const errors: ItemRowError = {};
      if (!r.itemId) { errors.itemId = "Item is required"; valid = false; }
      if (!r.quantity || r.quantity < 1) { errors.quantity = "Must be ≥ 1"; valid = false; }
      return { ...r, errors };
    }));
    return valid;
  }

  async function onSubmit(shared: SharedData) {
    if (!validateRows()) return;

    const validRows = itemRows.filter(r => r.itemId && r.quantity >= 1);
    setSubmitting(true);

    try {
      await Promise.all(
        validRows.map(row =>
          fetch(api.movements.create.path, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              movementType: shared.movementType,
              itemId: row.itemId,
              quantity: row.quantity,
              sourceLocationId: shared.sourceLocationId || null,
              destinationLocationId: shared.destinationLocationId || null,
              projectId: shared.projectId || null,
              note: shared.note || null,
            }),
          }).then(async res => {
            if (!res.ok) {
              const err = await res.json();
              throw new Error(err.message || `Failed for item #${row.itemId}`);
            }
            return res.json();
          })
        )
      );

      await qc.invalidateQueries({ queryKey: [api.movements.list.path] });
      await qc.invalidateQueries({ queryKey: [api.items.list.path] });
      await qc.invalidateQueries({ queryKey: [api.dashboard.stats.path] });
      await qc.invalidateQueries({ queryKey: [api.projects.list.path] });

      const count = validRows.length;
      toast({
        title: count === 1 ? "Movement logged" : `${count} movements logged`,
        description: `${count} item${count > 1 ? "s" : ""} recorded as ${shared.movementType}.`,
      });

      setItemRows([makeRow()]);
      form.reset({ movementType: shared.movementType });
      onSuccess?.();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

        {/* ── Shared top-level fields ── */}
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

        <div className="grid grid-cols-2 gap-4">
          {needsSource && (
            <FormField control={form.control} name="sourceLocationId" render={({ field }) => (
              <FormItem>
                <FormLabel>{sourceLabel}</FormLabel>
                <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value?.toString()}>
                  <FormControl>
                    <SelectTrigger data-testid="select-source-location">
                      <SelectValue placeholder="Select location…" />
                    </SelectTrigger>
                  </FormControl>
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
                  <FormControl>
                    <SelectTrigger data-testid="select-dest-location">
                      <SelectValue placeholder="Select location…" />
                    </SelectTrigger>
                  </FormControl>
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
                <FormControl>
                  <SelectTrigger data-testid="select-project">
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {projects?.filter((p: any) => p.status === "active").map((p: any) => (
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
              <Textarea
                placeholder="Reference number, PO, reason…"
                className="resize-none"
                rows={2}
                {...field}
                data-testid="input-note"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        {/* ── Item rows ── */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">
              Items <span className="text-xs font-normal text-slate-400 ml-1">({itemRows.length} {itemRows.length === 1 ? "item" : "items"})</span>
            </p>
            <div className="h-px flex-1 bg-slate-100 mx-3" />
          </div>

          {itemRows.map((row, idx) => {
            const selectedItem = items?.find((i: any) => i.id === row.itemId);
            return (
              <div
                key={row.rowId}
                className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2"
                data-testid={`item-row-${idx}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Item {idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeRow(row.rowId)}
                    disabled={itemRows.length === 1}
                    className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    data-testid={`btn-remove-row-${idx}`}
                    title="Remove item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Item</label>
                  <SearchableItemSelect
                    value={row.itemId}
                    onChange={(id) => updateRow(row.rowId, { itemId: id })}
                    items={items || []}
                  />
                  {row.errors.itemId && (
                    <p className="text-xs text-red-500 mt-0.5" data-testid={`error-item-${idx}`}>{row.errors.itemId}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">
                    Quantity{selectedItem ? ` (${selectedItem.unitOfMeasure})` : ""}
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={row.quantity}
                    onChange={(e) => updateRow(row.rowId, { quantity: Number(e.target.value) })}
                    className="h-9 text-sm"
                    data-testid={`input-quantity-${idx}`}
                  />
                  {row.errors.quantity && (
                    <p className="text-xs text-red-500 mt-0.5" data-testid={`error-qty-${idx}`}>{row.errors.quantity}</p>
                  )}
                </div>
              </div>
            );
          })}

          <button
            type="button"
            onClick={addRow}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 border-2 border-dashed border-slate-200 rounded-lg text-sm font-medium text-slate-500 hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50 transition-all"
            data-testid="btn-add-item"
          >
            <Plus className="w-4 h-4" />
            Add Item
          </button>
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-slate-400">
            {itemRows.length} item{itemRows.length !== 1 ? "s" : ""} will be logged as {movType}
          </span>
          <Button
            type="submit"
            disabled={submitting}
            className="bg-brand-700 hover:bg-brand-800 min-w-[140px]"
            data-testid="button-submit-movement"
          >
            {submitting
              ? `Logging ${itemRows.length > 1 ? `${itemRows.length} items` : ""}…`
              : `Log Movement${itemRows.length > 1 ? ` (${itemRows.length})` : ""}`}
          </Button>
        </div>
      </form>
    </Form>
  );
}
