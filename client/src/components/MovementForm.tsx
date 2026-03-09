import { useState, useRef, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useItems } from "@/hooks/use-items";
import { useLocations, useProjects, useCreateLocation, useDeleteLocation } from "@/hooks/use-reference-data";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Search, X, ChevronDown, ChevronLeft, ChevronRight, Plus, Trash2, ImageOff } from "lucide-react";
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
        const tokens = search.toLowerCase().split(/\s+/).filter(Boolean);
        const haystack = [i.name, i.sku, i.sizeLabel, i.description, i.brand, i.manufacturer]
          .filter(Boolean).join(" ").toLowerCase();
        return tokens.every(t => haystack.includes(t));
      })
    : items;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function handleOpen() {
    setOpen(true);
    setSearch("");
    setTimeout(() => inputRef.current?.focus(), 20);
  }

  function handleSelect(id: number) {
    onChange(id);
    setOpen(false);
    setSearch("");
  }

  return (
    <div ref={ref} className="relative" data-testid="searchable-item-select">

      {/* ── Trigger: input-like container that toggles search mode ── */}
      <div
        className={`w-full flex items-center justify-between px-3 text-sm border rounded-md bg-background min-h-[42px] cursor-text transition-colors ${
          open
            ? "border-brand-400 ring-1 ring-brand-300 bg-white"
            : "border-input hover:bg-slate-50"
        }`}
        onClick={handleOpen}
        data-testid="item-select-trigger"
      >
        {open ? (
          /* ── Search mode: input appears directly in the trigger ── */
          <>
            <Search className="w-4 h-4 text-slate-400 shrink-0 mr-2" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search by name, SKU, or size…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onClick={e => e.stopPropagation()}
              className="flex-1 py-2 text-sm outline-none bg-transparent text-slate-900 placeholder:text-slate-400"
              data-testid="item-search-input"
            />
            {search && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setSearch(""); inputRef.current?.focus(); }}
                className="p-0.5 ml-1"
              >
                <X className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
              </button>
            )}
          </>
        ) : selected ? (
          /* ── Closed + item selected ── */
          <>
            <span className="flex items-center gap-2.5 min-w-0 flex-1 py-1">
              <span className="font-mono text-xs text-slate-400 shrink-0 w-20 truncate">{selected.sku}</span>
              <span className="w-8 h-8 shrink-0 rounded overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center">
                {selected.imageUrl ? (
                  <img src={selected.imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImageOff className="w-4 h-4 text-slate-300" />
                )}
              </span>
              <span className="truncate text-slate-900 text-sm">{selected.name}</span>
            </span>
            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
          </>
        ) : (
          /* ── Closed + no selection ── */
          <>
            <span className="text-muted-foreground py-2 flex-1 text-sm">Search by name, SKU, or size…</span>
            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
          </>
        )}
      </div>

      {/* ── Dropdown list: max 6 items, internal scroll only ── */}
      {open && (
        <div
          className="absolute z-[60] mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden"
          style={{ maxHeight: `${6 * 44}px` }}
        >
          <div className="overflow-y-auto h-full" style={{ maxHeight: `${6 * 44}px` }}>
            {filtered.length === 0 ? (
              <div className="flex items-center justify-center h-11">
                <p className="text-sm text-slate-400">No items found</p>
              </div>
            ) : (
              filtered.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item.id)}
                  style={{ height: "44px", minHeight: "44px" }}
                  className={`w-full flex items-center gap-2 px-3 text-left hover:bg-brand-50 transition-colors border-b border-slate-50 last:border-0 ${item.id === value ? "bg-brand-50" : ""}`}
                  data-testid={`item-option-${item.id}`}
                >
                  <span className="font-mono text-xs text-slate-400 w-16 shrink-0 truncate">{item.sku}</span>
                  <span className="w-8 h-8 shrink-0 rounded overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ImageOff className="w-4 h-4 text-slate-300" />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate leading-tight">{item.name}</p>
                    {item.sizeLabel && <p className="text-xs text-slate-400 leading-tight">{item.sizeLabel}</p>}
                  </div>
                  <span className="text-xs text-slate-400 shrink-0 whitespace-nowrap">{item.quantityOnHand} {item.unitOfMeasure}</span>
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
  const deleteLocation = useDeleteLocation();
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

  async function handleDelete(e: React.MouseEvent, loc: any) {
    e.stopPropagation();
    try {
      await deleteLocation.mutateAsync(loc.id);
      if (value === loc.id) onChange(0 as any);
      toast({ title: "Location removed", description: `"${loc.name}" has been deleted.` });
    } catch (err: any) {
      toast({ title: "Failed to delete location", description: err.message, variant: "destructive" });
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
              <div
                key={loc.id}
                className={`group flex items-center hover:bg-brand-50 transition-colors ${loc.id === value ? "bg-brand-50" : ""}`}
                data-testid={`${testId}-option-${loc.id}`}
              >
                <button
                  type="button"
                  onClick={() => { onChange(loc.id); setSearch(""); setOpen(false); }}
                  className={`flex-1 text-left px-3 py-2 text-sm ${loc.id === value ? "font-medium text-slate-900" : "text-slate-800"}`}
                >
                  {loc.name}
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDelete(e, loc)}
                  disabled={deleteLocation.isPending}
                  className="opacity-0 group-hover:opacity-100 mr-2 p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                  data-testid={`${testId}-delete-${loc.id}`}
                  title="Delete location"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
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
  hideCreate = false,
}: {
  value?: number | null;
  onChange: (id: number | undefined) => void;
  projects: any[];
  hideCreate?: boolean;
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
          {!hideCreate && (
            <div className="border-t border-slate-100 px-3 py-2">
              <a
                href="/projects"
                onClick={() => setOpen(false)}
                className="flex items-center gap-1.5 text-xs text-brand-700 hover:text-brand-800 font-medium"
                data-testid="project-create-link"
              >
                <Plus className="w-3 h-3" />
                Create new project
              </a>
            </div>
          )}
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
  allowedTypes?: string[];
  fieldMode?: boolean;
}

export function MovementForm({ defaultType = "receive", defaultItemId, onSuccess, onCancel, readOnly = false, allowedTypes, fieldMode = false }: MovementFormProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
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
      const results = await Promise.all(
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
      const createdIds: number[] = results.map((r: any) => r.id).filter(Boolean);
      const txPath = fieldMode ? "/field/transactions" : "/transactions";

      const dismissRef = { fn: () => {} };

      const { dismiss } = toast({
        title: count === 1 ? "Movement logged" : `${count} movements logged`,
        description: (
          <div>
            <p>{count} item{count > 1 ? "s" : ""} recorded as {shared.movementType}.</p>
            <div className="flex gap-3 mt-2">
              <button
                type="button"
                className="text-xs font-medium text-brand-700 hover:text-brand-900 underline underline-offset-2"
                onClick={() => { navigate(txPath); dismissRef.fn(); }}
              >
                View Transactions
              </button>
              {createdIds.length > 0 && (
                <button
                  type="button"
                  className="text-xs font-medium text-slate-500 hover:text-slate-700 underline underline-offset-2"
                  onClick={async () => {
                    dismissRef.fn();
                    try {
                      await fetch("/api/movements/bulk-delete", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                        body: JSON.stringify({ ids: createdIds }),
                      });
                      await qc.invalidateQueries({ queryKey: [api.movements.list.path] });
                      await qc.invalidateQueries({ queryKey: [api.items.list.path] });
                      await qc.invalidateQueries({ queryKey: [api.dashboard.stats.path] });
                      toast({ title: "Undone", description: `${count} movement${count > 1 ? "s" : ""} removed.` });
                    } catch (err: any) {
                      toast({ title: "Undo failed", description: err.message, variant: "destructive" });
                    }
                  }}
                >
                  Undo
                </button>
              )}
            </div>
          </div>
        ) as any,
      });
      dismissRef.fn = dismiss;

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
        className="space-y-0"
      >

        {/* ── SECTION A: Shared fields ── */}
        <div className="space-y-3 pb-3">

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
                  {MOVEMENT_TYPES.filter(t => !allowedTypes || allowedTypes.includes(t.value)).map(t => (
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

          <div className="space-y-4">
            {/* Row 1: primary location + project (or both locations for transfer) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left: source (receive/return/transfer) OR destination (issue) */}
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

              {/* Right: project (receive/issue/return) OR dest (transfer) */}
              {needsProject && (
                <FormField control={form.control} name="projectId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project (Optional)</FormLabel>
                    <FormControl>
                      <SearchableProjectSelect
                        value={field.value ?? null}
                        onChange={(id) => field.onChange(id)}
                        projects={projects || []}
                        hideCreate={fieldMode}
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

            {/* Row 2: secondary location — Receiving Location (receive/return) or Sending Location (issue) */}
            {(movType === "receive" || movType === "return") && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="destinationLocationId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Receiving Location</FormLabel>
                    <FormControl>
                      <SearchableLocationSelect
                        value={field.value ?? null}
                        onChange={(id) => field.onChange(id)}
                        locations={locations || []}
                        placeholder="Search or type to create…"
                        testId="select-dest-location"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            )}
            {movType === "issue" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="sourceLocationId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sending Location</FormLabel>
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
              </div>
            )}
          </div>

        </div>

        {/* ── SECTION B: Items ── */}
        <div className="border-t border-slate-100 pt-3">

          <div className="flex items-center gap-2 mb-2">
            <p className="text-sm font-semibold text-slate-700">Items</p>
            <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-2 py-0.5 font-medium">
              {itemRows.length}
            </span>
            <div className="h-px flex-1 bg-slate-100" />
            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 hover:bg-brand-50 px-2 py-1 rounded-md transition-all shrink-0"
              data-testid="btn-add-item"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Another Item
            </button>
          </div>

          <div className="space-y-2">
            {itemRows.map((row, idx) => {
              const selectedItem = items?.find((i: any) => i.id === row.itemId);
              return (
                <div
                  key={row.rowId}
                  style={{ position: 'relative', zIndex: itemRows.length - idx }}
                  className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-2 hover:border-brand-200 transition-colors"
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

                  <div className="shrink-0">
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() => updateRow(row.rowId, { quantity: Math.max(0, row.quantity - 1) })}
                        className="w-9 h-9 flex items-center justify-center rounded-l-md border border-r-0 border-slate-200 bg-slate-50 hover:bg-brand-50 hover:text-brand-600 transition-colors text-slate-600"
                        data-testid={`btn-qty-dec-${idx}`}
                        title="Decrease"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={row.quantity}
                        onChange={(e) => {
                          const val = parseInt(e.target.value.replace(/\D/g, ''), 10);
                          updateRow(row.rowId, { quantity: isNaN(val) || val < 0 ? 0 : val });
                        }}
                        onBlur={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (isNaN(val) || val < 0) updateRow(row.rowId, { quantity: 0 });
                        }}
                        style={{ textAlign: "center", paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0 }}
                        className="h-9 w-16 text-sm font-semibold border-y border-slate-200 bg-white focus:outline-none focus:border-brand-300"
                        data-testid={`input-quantity-${idx}`}
                      />
                      <button
                        type="button"
                        onClick={() => updateRow(row.rowId, { quantity: row.quantity + 1 })}
                        className="w-9 h-9 flex items-center justify-center rounded-r-md border border-l-0 border-slate-200 bg-slate-50 hover:bg-brand-50 hover:text-brand-600 transition-colors text-slate-600"
                        data-testid={`btn-qty-inc-${idx}`}
                        title="Increase"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      {selectedItem && (
                        <span className="ml-2 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap min-w-[28px] text-center">
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

                  <div className="shrink-0">
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

        {/* ── NOTE: below Items ── */}
        <div className="flex-shrink-0 pt-3 border-t border-slate-100 mt-2">
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

        {/* ── Confirm footer: slim sticky action bar ── */}
        <div className="sticky bottom-0 z-10 flex items-center justify-end gap-2 py-3 mt-4 -mx-4 md:-mx-6 px-4 md:px-6">
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
