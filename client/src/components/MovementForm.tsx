import { useState, useRef, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useItems } from "@/hooks/use-items";
import { useLocations, useProjects, useCreateLocation } from "@/hooks/use-reference-data";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Search, X, ChevronDown, Plus, Trash2, ExternalLink } from "lucide-react";
import { api } from "@shared/routes";
import { Link } from "wouter";

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

// ── Searchable Item Select ──────────────────────────────────────────────────
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

// ── Searchable Location Select (with create-new) ────────────────────────────
function SearchableLocationSelect({
  value,
  onChange,
  locations,
  placeholder = "Search or type to create…",
  testId = "location-select",
}: {
  value?: number | null;
  onChange: (id: number) => void;
  locations: any[];
  placeholder?: string;
  testId?: string;
}) {
  const { toast } = useToast();
  const createLocation = useCreateLocation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = locations.find(l => l.id === value);

  const filtered = search.trim()
    ? locations.filter(l => l.name.toLowerCase().includes(search.toLowerCase()))
    : locations;

  const showCreate =
    search.trim().length > 0 &&
    !locations.some(l => l.name.trim().toLowerCase() === search.trim().toLowerCase());

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

  async function handleCreate() {
    const name = search.trim();
    if (!name) return;
    try {
      const loc = await createLocation.mutateAsync(name);
      onChange(loc.id);
      setSearch("");
      setOpen(false);
      toast({ title: "Location created", description: `"${loc.name}" added and selected.` });
    } catch (err: any) {
      toast({ title: "Failed to create location", description: err.message, variant: "destructive" });
    }
  }

  return (
    <div ref={ref} className="relative" data-testid={testId}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm border border-input rounded-md bg-background hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-ring text-left min-h-[38px]"
        data-testid={`${testId}-trigger`}
      >
        {selected ? (
          <span className="truncate text-slate-900">{selected.name}</span>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
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
              placeholder="Type to filter or create…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 text-sm outline-none bg-transparent text-slate-900 placeholder:text-slate-400"
              data-testid={`${testId}-search`}
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="p-0.5">
                <X className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
              </button>
            )}
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.map(loc => (
              <button
                key={loc.id}
                type="button"
                onClick={() => { onChange(loc.id); setSearch(""); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-brand-50 transition-colors ${loc.id === value ? "bg-brand-50 font-medium" : "text-slate-800"}`}
                data-testid={`${testId}-option-${loc.id}`}
              >
                {loc.name}
              </button>
            ))}
            {filtered.length === 0 && !showCreate && (
              <p className="text-center text-sm text-slate-400 py-3">No locations found</p>
            )}
            {showCreate && (
              <button
                type="button"
                onClick={handleCreate}
                disabled={createLocation.isPending}
                className="w-full text-left px-3 py-2 text-sm text-brand-700 font-medium flex items-center gap-2 hover:bg-brand-50 border-t border-slate-100 transition-colors"
                data-testid={`${testId}-create`}
              >
                <Plus className="w-3.5 h-3.5" />
                {createLocation.isPending ? "Creating…" : `Create location "${search.trim()}"`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Searchable Project Select ───────────────────────────────────────────────
function SearchableProjectSelect({
  value,
  onChange,
  projects,
}: {
  value?: number | null;
  onChange: (id: number | undefined) => void;
  projects: any[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeProjects = projects.filter(p => p.status === "active");
  const selected = activeProjects.find(p => p.id === value);

  function label(p: any) {
    return p.poNumber ? `${p.poNumber} — ${p.name}` : p.name;
  }

  const filtered = search.trim()
    ? activeProjects.filter(p => {
        const q = search.toLowerCase();
        return p.name?.toLowerCase().includes(q) || p.poNumber?.toLowerCase().includes(q);
      })
    : activeProjects;

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
    <div ref={ref} className="relative" data-testid="project-select">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm border border-input rounded-md bg-background hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-ring text-left min-h-[38px]"
        data-testid="project-select-trigger"
      >
        {selected ? (
          <span className="truncate text-slate-900">{label(selected)}</span>
        ) : (
          <span className="text-muted-foreground">Select project…</span>
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
              placeholder="Search by PO or project name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 text-sm outline-none bg-transparent text-slate-900 placeholder:text-slate-400"
              data-testid="project-search-input"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="p-0.5">
                <X className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
              </button>
            )}
          </div>
          <div className="max-h-48 overflow-y-auto">
            {value != null && (
              <button
                type="button"
                onClick={() => { onChange(undefined); setSearch(""); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-xs text-slate-400 hover:bg-slate-50 italic border-b border-slate-100"
                data-testid="project-clear"
              >
                Clear selection
              </button>
            )}
            {filtered.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => { onChange(p.id); setSearch(""); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-brand-50 transition-colors ${p.id === value ? "bg-brand-50 font-medium" : "text-slate-800"}`}
                data-testid={`project-option-${p.id}`}
              >
                {p.poNumber && (
                  <span className="font-mono text-xs text-slate-500 mr-1.5">{p.poNumber} —</span>
                )}
                {p.name}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-center text-sm text-slate-400 py-3">No active projects found</p>
            )}
          </div>
          <div className="border-t border-slate-100 px-3 py-2">
            <Link
              href="/projects"
              onClick={() => setOpen(false)}
              className="flex items-center gap-1.5 text-xs text-brand-700 hover:text-brand-800 font-medium"
              data-testid="project-create-link"
            >
              <ExternalLink className="w-3 h-3" />
              Create new project
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ── MovementForm ─────────────────────────────────────────────────────────────
interface MovementFormProps {
  defaultType?: string;
  defaultItemId?: number;
  onSuccess?: () => void;
  onCancel?: () => void;
  readOnly?: boolean;
}

export function MovementForm({ defaultType = "receive", defaultItemId, onSuccess, onCancel, readOnly = false }: MovementFormProps) {
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
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col min-h-0"
        style={{ maxHeight: "calc(85vh - 120px)" }}
      >

        {/* ── SECTION A: Shared fields (non-scroll) ── */}
        <div className="flex-shrink-0 space-y-3 overflow-visible pb-3">

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

          <div className="grid grid-cols-2 gap-3">
            {/* Left column: Source location (receive/return/transfer) or Destination (issue only) */}
            {needsSource && (
              <FormField control={form.control} name="sourceLocationId" render={({ field }) => (
                <FormItem>
                  <FormLabel>{sourceLabel}</FormLabel>
                  <FormControl>
                    <SearchableLocationSelect
                      value={field.value ?? null}
                      onChange={(id) => field.onChange(id)}
                      locations={locations || []}
                      placeholder="Search or type to create…"
                      testId="select-source-location"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            )}
            {!needsSource && needsDestination && (
              <FormField control={form.control} name="destinationLocationId" render={({ field }) => (
                <FormItem>
                  <FormLabel>{destLabel}</FormLabel>
                  <FormControl>
                    <SearchableLocationSelect
                      value={field.value ?? null}
                      onChange={(id) => field.onChange(id)}
                      locations={locations || []}
                      placeholder="Select destination…"
                      testId="select-dest-location"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            )}

            {/* Right column: Project (receive/issue/return) or Destination (transfer) */}
            {needsProject && (
              <FormField control={form.control} name="projectId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Project (Optional)</FormLabel>
                  <FormControl>
                    <SearchableProjectSelect
                      value={field.value ?? null}
                      onChange={(id) => field.onChange(id)}
                      projects={projects || []}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            )}
            {needsSource && needsDestination && (
              <FormField control={form.control} name="destinationLocationId" render={({ field }) => (
                <FormItem>
                  <FormLabel>{destLabel}</FormLabel>
                  <FormControl>
                    <SearchableLocationSelect
                      value={field.value ?? null}
                      onChange={(id) => field.onChange(id)}
                      locations={locations || []}
                      placeholder="Select destination…"
                      testId="select-dest-location"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            )}
          </div>

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
        </div>

        {/* ── SECTION B: Items header + scrollable list ── */}
        <div className="flex flex-col min-h-0 flex-1 border-t border-slate-100 pt-3">

          <div className="flex-shrink-0 flex items-center gap-2 mb-2">
            <p className="text-sm font-semibold text-slate-700">Items</p>
            <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-2 py-0.5 font-medium">
              {itemRows.length}
            </span>
            <div className="h-px flex-1 bg-slate-100" />
          </div>

          <div
            className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1 -mr-1"
            style={{ minHeight: "120px" }}
          >
            {itemRows.map((row, idx) => {
              const selectedItem = items?.find((i: any) => i.id === row.itemId);
              return (
                <div
                  key={row.rowId}
                  className="flex items-start gap-2 bg-white border border-slate-200 rounded-lg p-2 hover:border-brand-200 transition-colors"
                  data-testid={`item-row-${idx}`}
                >
                  <div className="flex-[3] min-w-0">
                    <SearchableItemSelect
                      value={row.itemId}
                      onChange={(id) => updateRow(row.rowId, { itemId: id })}
                      items={items || []}
                    />
                    {row.errors.itemId && (
                      <p className="text-[10px] text-red-500 mt-1 ml-1" data-testid={`error-item-${idx}`}>
                        {row.errors.itemId}
                      </p>
                    )}
                  </div>

                  <div className="flex-[0.8] min-w-0 shrink-0">
                    <div className="relative">
                      <Input
                        type="number"
                        min={1}
                        value={row.quantity}
                        onChange={(e) => updateRow(row.rowId, { quantity: Number(e.target.value) })}
                        className="h-9 text-sm text-center px-1 pr-6"
                        data-testid={`input-quantity-${idx}`}
                      />
                      {selectedItem && (
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400 pointer-events-none uppercase">
                          {selectedItem.unitOfMeasure}
                        </span>
                      )}
                    </div>
                    {row.errors.quantity && (
                      <p className="text-[10px] text-red-500 mt-1 text-center" data-testid={`error-qty-${idx}`}>
                        {row.errors.quantity}
                      </p>
                    )}
                  </div>

                  <div className="pt-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => removeRow(row.rowId)}
                      disabled={itemRows.length === 1}
                      className="p-1.5 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-0 transition-all"
                      data-testid={`btn-remove-row-${idx}`}
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── SECTION C: Sticky footer ── */}
        <div className="flex-shrink-0 flex items-center justify-between pt-3 mt-2 border-t border-slate-100 bg-white">
          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 hover:bg-brand-50 px-2.5 py-1.5 rounded-md transition-all"
            data-testid="btn-add-item"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Another Item
          </button>

          <div className="flex items-center gap-2">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={submitting}
                data-testid="button-cancel-movement"
              >
                Cancel
              </Button>
            )}
            {readOnly ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0}>
                    <Button
                      type="button"
                      disabled
                      className="bg-slate-300 text-slate-500 min-w-[100px] cursor-not-allowed"
                      data-testid="button-submit-movement"
                    >
                      Confirm
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Viewer role is read-only
                </TooltipContent>
              </Tooltip>
            ) : (
              <Button
                type="submit"
                disabled={submitting}
                className="bg-brand-700 hover:bg-brand-800 min-w-[100px]"
                data-testid="button-submit-movement"
              >
                {submitting ? "Saving…" : `Confirm${itemRows.length > 1 ? ` (${itemRows.length})` : ""}`}
              </Button>
            )}
          </div>
        </div>

      </form>
    </Form>
  );
}
