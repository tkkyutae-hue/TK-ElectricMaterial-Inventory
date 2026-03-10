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

const FM_CSS = `
.fm-dark label {
  color: #527856 !important;
  font-family: 'Barlow Condensed', sans-serif !important;
  font-size: 11px !important;
  font-weight: 700 !important;
  text-transform: uppercase !important;
  letter-spacing: 1px !important;
  margin-bottom: 5px !important;
  display: block;
}
.fm-dark [data-testid="select-movement-type"] {
  background: #141e17 !important;
  border: 1px solid #203023 !important;
  border-radius: 10px !important;
  color: #c8deca !important;
  font-size: 13px !important;
  min-height: 42px !important;
}
.fm-dark [data-testid="select-movement-type"]:focus-within {
  border-color: #2ddb6f !important;
  box-shadow: 0 0 0 3px rgba(45,219,111,0.12) !important;
}
.fm-dark [data-testid="select-movement-type"] span {
  color: #c8deca !important;
}
.fm-dark textarea {
  background: #141e17 !important;
  border: 1px solid #203023 !important;
  border-radius: 10px !important;
  color: #c8deca !important;
  font-size: 13px !important;
  padding: 10px 14px !important;
  min-height: 72px !important;
}
.fm-dark textarea::placeholder { color: #2b3f2e !important; }
.fm-dark textarea:focus {
  border-color: #2ddb6f !important;
  box-shadow: 0 0 0 3px rgba(45,219,111,0.12) !important;
  outline: none !important;
}
.fm-dark p[id^="form-item-message"] { color: #f87171 !important; font-size: 11px !important; }
.fm-dark-select-content {
  background: #0f1612 !important;
  border: 1px solid #203023 !important;
  border-radius: 10px !important;
}
.fm-dark-select-content [role="option"] {
  color: #c8deca !important;
  font-size: 13px !important;
  cursor: pointer;
}
.fm-dark-select-content [role="option"]:focus,
.fm-dark-select-content [role="option"]:hover {
  background: #141e17 !important;
}
.fm-dark-select-content [role="option"][data-state="checked"] {
  color: #2ddb6f !important;
}
`;


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
  value, onChange, items, dark = false,
}: {
  value?: number | null;
  onChange: (id: number) => void;
  items: any[];
  dark?: boolean;
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

  const D = dark;

  return (
    <div ref={ref} className="relative" data-testid="searchable-item-select">

      {/* ── Trigger ── */}
      <div
        style={D ? {
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 14px", fontSize: 13, borderRadius: 10, minHeight: 42, cursor: "text",
          background: open ? "#141e17" : "#141e17",
          border: `1px solid ${open ? "#2ddb6f" : "#203023"}`,
          boxShadow: open ? "0 0 0 3px rgba(45,219,111,0.12)" : "none",
          transition: "border-color 0.15s, box-shadow 0.15s",
          color: "#c8deca",
        } : undefined}
        className={D ? undefined : `w-full flex items-center justify-between px-3 text-sm border rounded-md bg-background min-h-[42px] cursor-text transition-colors ${
          open ? "border-brand-400 ring-1 ring-brand-300 bg-white" : "border-input hover:bg-slate-50"
        }`}
        onClick={handleOpen}
        data-testid="item-select-trigger"
      >
        {open ? (
          <>
            <Search style={{ width: 14, height: 14, color: D ? "#527856" : undefined, flexShrink: 0, marginRight: 8 }} className={D ? undefined : "w-4 h-4 text-slate-400 shrink-0 mr-2"} />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search by name, SKU, or size…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onClick={e => e.stopPropagation()}
              style={D ? { flex: 1, paddingTop: 10, paddingBottom: 10, fontSize: 13, outline: "none", background: "transparent", color: "#c8deca" } : undefined}
              className={D ? undefined : "flex-1 py-2 text-sm outline-none bg-transparent text-slate-900 placeholder:text-slate-400"}
              data-testid="item-search-input"
            />
            {search && (
              <button type="button" onClick={e => { e.stopPropagation(); setSearch(""); inputRef.current?.focus(); }} className="p-0.5 ml-1">
                <X style={{ width: 13, height: 13, color: D ? "#527856" : undefined }} className={D ? undefined : "w-3.5 h-3.5 text-slate-400 hover:text-slate-600"} />
              </button>
            )}
          </>
        ) : selected ? (
          <>
            <span className="flex items-center gap-2.5 min-w-0 flex-1 py-1">
              <span style={D ? { color: "#527856", fontSize: 11, flexShrink: 0, width: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace" } : undefined} className={D ? undefined : "font-mono text-xs text-slate-400 shrink-0 w-20 truncate"}>{selected.sku}</span>
              <span style={D ? { width: 28, height: 28, flexShrink: 0, borderRadius: 6, overflow: "hidden", border: "1px solid #203023", background: "#0f1612", display: "flex", alignItems: "center", justifyContent: "center" } : undefined} className={D ? undefined : "w-8 h-8 shrink-0 rounded overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center"}>
                {selected.imageUrl ? (
                  <img src={selected.imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImageOff style={{ width: 13, height: 13, color: D ? "#2b3f2e" : undefined }} className={D ? undefined : "w-4 h-4 text-slate-300"} />
                )}
              </span>
              <span style={D ? { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#c8deca", fontSize: 13 } : undefined} className={D ? undefined : "truncate text-slate-900 text-sm"}>{selected.name}</span>
            </span>
            <ChevronDown style={{ width: 14, height: 14, color: D ? "#527856" : undefined, flexShrink: 0, marginLeft: 8 }} className={D ? undefined : "w-4 h-4 text-slate-400 shrink-0 ml-2"} />
          </>
        ) : (
          <>
            <span style={D ? { color: "#2b3f2e", paddingTop: 10, paddingBottom: 10, flex: 1, fontSize: 13 } : undefined} className={D ? undefined : "text-muted-foreground py-2 flex-1 text-sm"}>Search by name, SKU, or size…</span>
            <ChevronDown style={{ width: 14, height: 14, color: D ? "#527856" : undefined, flexShrink: 0, marginLeft: 8 }} className={D ? undefined : "w-4 h-4 text-slate-400 shrink-0 ml-2"} />
          </>
        )}
      </div>

      {/* ── Dropdown list ── */}
      {open && (
        <div
          style={D ? { position: "absolute", zIndex: 60, marginTop: 4, width: "100%", background: "#0f1612", border: "1px solid #203023", borderRadius: 10, boxShadow: "0 12px 32px rgba(0,0,0,0.6)", overflow: "hidden", maxHeight: `${6 * 44}px` } : { maxHeight: `${6 * 44}px` }}
          className={D ? undefined : "absolute z-[60] mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden"}
        >
          <div className="overflow-y-auto h-full" style={{ maxHeight: `${6 * 44}px` }}>
            {filtered.length === 0 ? (
              <div className="flex items-center justify-center h-11">
                <p style={D ? { fontSize: 12, color: "#527856" } : undefined} className={D ? undefined : "text-sm text-slate-400"}>No items found</p>
              </div>
            ) : (
              filtered.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item.id)}
                  style={D ? { height: 44, minHeight: 44, width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "0 12px", textAlign: "left", background: item.id === value ? "#141e17" : "transparent", borderBottom: "1px solid #0f1612", cursor: "pointer" } : { height: "44px", minHeight: "44px" }}
                  className={D ? undefined : `w-full flex items-center gap-2 px-3 text-left hover:bg-brand-50 transition-colors border-b border-slate-50 last:border-0 ${item.id === value ? "bg-brand-50" : ""}`}
                  data-testid={`item-option-${item.id}`}
                  onMouseEnter={D ? e => { (e.currentTarget as HTMLButtonElement).style.background = "#141e17"; } : undefined}
                  onMouseLeave={D ? e => { (e.currentTarget as HTMLButtonElement).style.background = item.id === value ? "#141e17" : "transparent"; } : undefined}
                >
                  <span style={D ? { color: "#527856", fontSize: 11, width: 64, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace" } : undefined} className={D ? undefined : "font-mono text-xs text-slate-400 w-16 shrink-0 truncate"}>{item.sku}</span>
                  <span style={D ? { width: 28, height: 28, flexShrink: 0, borderRadius: 5, overflow: "hidden", border: "1px solid #203023", background: "#141e17", display: "flex", alignItems: "center", justifyContent: "center" } : undefined} className={D ? undefined : "w-8 h-8 shrink-0 rounded overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center"}>
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ImageOff style={{ width: 13, height: 13, color: D ? "#2b3f2e" : undefined }} className={D ? undefined : "w-4 h-4 text-slate-300"} />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p style={D ? { fontSize: 13, fontWeight: 500, color: item.id === value ? "#2ddb6f" : "#c8deca", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.3, margin: 0 } : undefined} className={D ? undefined : "text-sm font-medium text-slate-900 truncate leading-tight"}>{item.name}</p>
                    {item.sizeLabel && <p style={D ? { fontSize: 11, color: "#527856", lineHeight: 1.3, margin: 0 } : undefined} className={D ? undefined : "text-xs text-slate-400 leading-tight"}>{item.sizeLabel}</p>}
                  </div>
                  <span style={D ? { fontSize: 11, color: "#527856", flexShrink: 0, whiteSpace: "nowrap" } : undefined} className={D ? undefined : "text-xs text-slate-400 shrink-0 whitespace-nowrap"}>{item.quantityOnHand} {item.unitOfMeasure}</span>
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
  dark = false,
}: {
  value?: number | null;
  onChange: (id: number) => void;
  locations: any[];
  placeholder?: string;
  testId?: string;
  dark?: boolean;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
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

      const dismissRef = { fn: () => {} };
      const { dismiss } = toast({
        title: "Location removed",
        description: (
          <div className="flex items-center justify-between gap-3 mt-0.5">
            <span className="text-sm">"{loc.name}" has been deleted.</span>
            <button
              type="button"
              className="text-xs font-semibold text-brand-700 hover:text-brand-900 underline underline-offset-2 shrink-0"
              onClick={async () => {
                dismissRef.fn();
                try {
                  await fetch(`/api/locations/${loc.id}/restore`, {
                    method: "POST",
                    credentials: "include",
                  });
                  await qc.invalidateQueries({ queryKey: ["/api/locations"] });
                  toast({ title: "Undone", description: `"${loc.name}" has been restored.` });
                } catch {
                  toast({ title: "Undo failed", variant: "destructive" });
                }
              }}
            >
              Undo
            </button>
          </div>
        ) as any,
      });
      dismissRef.fn = dismiss;
    } catch (err: any) {
      toast({ title: "Failed to delete location", description: err.message, variant: "destructive" });
    }
  }

  const D = dark;

  return (
    <div ref={ref} className="relative" data-testid={testId}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={D ? { width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", fontSize: 13, background: "#141e17", border: `1px solid ${open ? "#2ddb6f" : "#203023"}`, borderRadius: 10, color: selected ? "#c8deca" : "#2b3f2e", cursor: "pointer", textAlign: "left", minHeight: 42, boxShadow: open ? "0 0 0 3px rgba(45,219,111,0.12)" : "none", transition: "border-color 0.15s" } : undefined}
        className={D ? undefined : "w-full flex items-center justify-between px-3 py-2 text-sm border border-input rounded-md bg-background hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-ring text-left min-h-[38px]"}
        data-testid={`${testId}-trigger`}
      >
        {selected ? (
          <span style={D ? { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } : undefined} className={D ? undefined : "truncate text-slate-900"}>{selected.name}</span>
        ) : (
          <span style={D ? { color: "#2b3f2e" } : undefined} className={D ? undefined : "text-muted-foreground"}>{placeholder}</span>
        )}
        <ChevronDown style={{ width: 14, height: 14, color: D ? "#527856" : undefined, flexShrink: 0, marginLeft: 8 }} className={D ? undefined : "w-4 h-4 text-slate-400 shrink-0 ml-2"} />
      </button>

      {open && (
        <div style={D ? { position: "absolute", zIndex: 50, marginTop: 4, width: "100%", background: "#0f1612", border: "1px solid #203023", borderRadius: 10, boxShadow: "0 12px 32px rgba(0,0,0,0.6)", overflow: "hidden" } : undefined} className={D ? undefined : "absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden"}>
          <div style={D ? { padding: "8px 12px", borderBottom: "1px solid #203023", display: "flex", alignItems: "center", gap: 8, background: "#0f1612" } : undefined} className={D ? undefined : "p-2 border-b border-slate-100 flex items-center gap-2 bg-slate-50/80"}>
            <Search style={{ width: 13, height: 13, color: D ? "#527856" : undefined, flexShrink: 0 }} className={D ? undefined : "w-4 h-4 text-slate-400 shrink-0"} />
            <input
              ref={inputRef}
              type="text"
              placeholder="Type to filter or create…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={D ? { flex: 1, fontSize: 13, outline: "none", background: "transparent", color: "#c8deca" } : undefined}
              className={D ? undefined : "flex-1 text-sm outline-none bg-transparent text-slate-900 placeholder:text-slate-400"}
              data-testid={`${testId}-search`}
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="p-0.5">
                <X style={{ width: 13, height: 13, color: D ? "#527856" : undefined }} className={D ? undefined : "w-3.5 h-3.5 text-slate-400 hover:text-slate-600"} />
              </button>
            )}
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.map(loc => (
              <div
                key={loc.id}
                style={D ? { display: "flex", alignItems: "center", background: loc.id === value ? "#141e17" : "transparent" } : undefined}
                className={D ? "group" : `group flex items-center hover:bg-brand-50 transition-colors ${loc.id === value ? "bg-brand-50" : ""}`}
                data-testid={`${testId}-option-${loc.id}`}
                onMouseEnter={D ? e => { (e.currentTarget as HTMLDivElement).style.background = "#141e17"; } : undefined}
                onMouseLeave={D ? e => { (e.currentTarget as HTMLDivElement).style.background = loc.id === value ? "#141e17" : "transparent"; } : undefined}
              >
                <button
                  type="button"
                  onClick={() => { onChange(loc.id); setSearch(""); setOpen(false); }}
                  style={D ? { flex: 1, textAlign: "left", padding: "9px 12px", fontSize: 13, color: loc.id === value ? "#2ddb6f" : "#c8deca", fontWeight: loc.id === value ? 600 : 400, background: "none", border: "none", cursor: "pointer" } : undefined}
                  className={D ? undefined : `flex-1 text-left px-3 py-2 text-sm ${loc.id === value ? "font-medium text-slate-900" : "text-slate-800"}`}
                >
                  {loc.name}
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDelete(e, loc)}
                  disabled={deleteLocation.isPending}
                  style={D ? { opacity: 0, marginRight: 8, padding: 4, borderRadius: 4, color: "#527856", background: "none", border: "none", cursor: "pointer", transition: "opacity 0.15s" } : undefined}
                  className={D ? "group-hover:opacity-100" : "opacity-0 group-hover:opacity-100 mr-2 p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"}
                  data-testid={`${testId}-delete-${loc.id}`}
                  title="Delete location"
                >
                  <Trash2 style={{ width: 13, height: 13 }} className={D ? undefined : "w-3.5 h-3.5"} />
                </button>
              </div>
            ))}
            {filtered.length === 0 && !showCreate && (
              <p style={D ? { textAlign: "center", fontSize: 12, color: "#527856", padding: "12px 0" } : undefined} className={D ? undefined : "text-center text-sm text-slate-400 py-3"}>No locations found</p>
            )}
            {showCreate && (
              <button
                type="button"
                onClick={handleCreate}
                disabled={createLocation.isPending}
                style={D ? { width: "100%", textAlign: "left", padding: "9px 12px", fontSize: 13, color: "#2ddb6f", fontWeight: 500, display: "flex", alignItems: "center", gap: 6, borderTop: "1px solid #203023", background: "none", border: "none", borderTop: "1px solid #203023", cursor: "pointer" } as any : undefined}
                className={D ? undefined : "w-full text-left px-3 py-2 text-sm text-brand-700 font-medium flex items-center gap-2 hover:bg-brand-50 border-t border-slate-100 transition-colors"}
                data-testid={`${testId}-create`}
              >
                <Plus style={{ width: 13, height: 13 }} className={D ? undefined : "w-3.5 h-3.5"} />
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
  dark = false,
}: {
  value?: number | null;
  onChange: (id: number | undefined) => void;
  projects: any[];
  hideCreate?: boolean;
  dark?: boolean;
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

  const D = dark;

  return (
    <div ref={ref} className="relative" data-testid="project-select">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={D ? { width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", fontSize: 13, background: "#141e17", border: `1px solid ${open ? "#2ddb6f" : "#203023"}`, borderRadius: 10, color: selected ? "#c8deca" : "#2b3f2e", cursor: "pointer", textAlign: "left", minHeight: 42, boxShadow: open ? "0 0 0 3px rgba(45,219,111,0.12)" : "none", transition: "border-color 0.15s" } : undefined}
        className={D ? undefined : "w-full flex items-center justify-between px-3 py-2 text-sm border border-input rounded-md bg-background hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-ring text-left min-h-[38px]"}
        data-testid="project-select-trigger"
      >
        {selected ? (
          <span style={D ? { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } : undefined} className={D ? undefined : "truncate text-slate-900"}>{label(selected)}</span>
        ) : (
          <span style={D ? { color: "#2b3f2e" } : undefined} className={D ? undefined : "text-muted-foreground"}>Select project…</span>
        )}
        <ChevronDown style={{ width: 14, height: 14, color: D ? "#527856" : undefined, flexShrink: 0, marginLeft: 8 }} className={D ? undefined : "w-4 h-4 text-slate-400 shrink-0 ml-2"} />
      </button>

      {open && (
        <div style={D ? { position: "absolute", zIndex: 50, marginTop: 4, width: "100%", background: "#0f1612", border: "1px solid #203023", borderRadius: 10, boxShadow: "0 12px 32px rgba(0,0,0,0.6)", overflow: "hidden" } : undefined} className={D ? undefined : "absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden"}>
          <div style={D ? { padding: "8px 12px", borderBottom: "1px solid #203023", display: "flex", alignItems: "center", gap: 8, background: "#0f1612" } : undefined} className={D ? undefined : "p-2 border-b border-slate-100 flex items-center gap-2 bg-slate-50/80"}>
            <Search style={{ width: 13, height: 13, color: D ? "#527856" : undefined, flexShrink: 0 }} className={D ? undefined : "w-4 h-4 text-slate-400 shrink-0"} />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search by PO or project name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={D ? { flex: 1, fontSize: 13, outline: "none", background: "transparent", color: "#c8deca" } : undefined}
              className={D ? undefined : "flex-1 text-sm outline-none bg-transparent text-slate-900 placeholder:text-slate-400"}
              data-testid="project-search-input"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="p-0.5">
                <X style={{ width: 13, height: 13, color: D ? "#527856" : undefined }} className={D ? undefined : "w-3.5 h-3.5 text-slate-400 hover:text-slate-600"} />
              </button>
            )}
          </div>
          <div className="max-h-48 overflow-y-auto">
            {value != null && (
              <button
                type="button"
                onClick={() => { onChange(undefined); setSearch(""); setOpen(false); }}
                style={D ? { width: "100%", textAlign: "left", padding: "8px 12px", fontSize: 12, color: "#527856", background: "none", border: "none", borderBottom: "1px solid #203023", cursor: "pointer", fontStyle: "italic" } : undefined}
                className={D ? undefined : "w-full text-left px-3 py-2 text-xs text-slate-400 hover:bg-slate-50 italic border-b border-slate-100"}
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
                style={D ? { width: "100%", textAlign: "left", padding: "9px 12px", fontSize: 13, color: p.id === value ? "#2ddb6f" : "#c8deca", fontWeight: p.id === value ? 600 : 400, background: p.id === value ? "#141e17" : "transparent", border: "none", cursor: "pointer", display: "block" } : undefined}
                className={D ? undefined : `w-full text-left px-3 py-2 text-sm hover:bg-brand-50 transition-colors ${p.id === value ? "bg-brand-50 font-medium" : "text-slate-800"}`}
                data-testid={`project-option-${p.id}`}
                onMouseEnter={D ? e => { (e.currentTarget as HTMLButtonElement).style.background = "#141e17"; } : undefined}
                onMouseLeave={D ? e => { (e.currentTarget as HTMLButtonElement).style.background = p.id === value ? "#141e17" : "transparent"; } : undefined}
              >
                {p.poNumber && (
                  <span style={D ? { color: "#527856", fontSize: 11, marginRight: 6, fontFamily: "monospace" } : undefined} className={D ? undefined : "font-mono text-xs text-slate-500 mr-1.5"}>{p.poNumber} —</span>
                )}
                {p.name}
              </button>
            ))}
            {filtered.length === 0 && (
              <p style={D ? { textAlign: "center", fontSize: 12, color: "#527856", padding: "12px 0" } : undefined} className={D ? undefined : "text-center text-sm text-slate-400 py-3"}>No active projects found</p>
            )}
          </div>
          {!hideCreate && (
            <div style={D ? { borderTop: "1px solid #203023", padding: "8px 12px" } : undefined} className={D ? undefined : "border-t border-slate-100 px-3 py-2"}>
              <a
                href="/projects"
                onClick={() => setOpen(false)}
                style={D ? { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#2ddb6f", fontWeight: 500, textDecoration: "none" } : undefined}
                className={D ? undefined : "flex items-center gap-1.5 text-xs text-brand-700 hover:text-brand-800 font-medium"}
                data-testid="project-create-link"
              >
                <Plus style={{ width: 12, height: 12 }} className={D ? undefined : "w-3 h-3"} />
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
  const saveOnlyRef = useRef(false);

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
      if (saveOnlyRef.current) {
        saveOnlyRef.current = false;
      } else {
        form.reset({ movementType: shared.movementType });
        onSuccess?.();
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      {fieldMode && <style>{FM_CSS}</style>}
      <div className={fieldMode ? "fm-dark" : undefined}>
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
                <SelectContent className={fieldMode ? "fm-dark-select-content" : undefined}>
                  {MOVEMENT_TYPES.filter(t => !allowedTypes || allowedTypes.includes(t.value)).map(t => (
                    <SelectItem key={t.value} value={t.value}>
                      <span className="font-medium">{t.label}</span>
                      <span className={fieldMode ? undefined : "text-slate-400 text-xs ml-2"} style={fieldMode ? { color: "#527856", fontSize: 11, marginLeft: 6 } : undefined}>— {t.desc}</span>
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
                        dark={fieldMode}
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
                        dark={fieldMode}
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
                        dark={fieldMode}
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
                        dark={fieldMode}
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
                        dark={fieldMode}
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
                        dark={fieldMode}
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
        <div style={fieldMode ? { borderTop: "1px solid #203023", paddingTop: 16 } : undefined} className={fieldMode ? undefined : "border-t border-slate-100 pt-3"}>

          <div className="flex items-center gap-2 mb-2">
            <p style={fieldMode ? { fontSize: 13, fontWeight: 600, color: "#527856", margin: 0 } : undefined} className={fieldMode ? undefined : "text-sm font-semibold text-slate-700"}>Items</p>
            <span style={fieldMode ? { fontSize: 11, color: "#2ddb6f", background: "#0b1a0f", borderRadius: 12, padding: "1px 8px", fontWeight: 600 } : undefined} className={fieldMode ? undefined : "text-xs text-slate-400 bg-slate-100 rounded-full px-2 py-0.5 font-medium"}>
              {itemRows.length}
            </span>
            <div style={fieldMode ? { height: 1, flex: 1, background: "#203023" } : undefined} className={fieldMode ? undefined : "h-px flex-1 bg-slate-100"} />
            <button
              type="button"
              onClick={addRow}
              style={fieldMode ? { display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: "#2ddb6f", background: "rgba(45,219,111,0.06)", border: "none", borderRadius: 6, padding: "5px 10px", cursor: "pointer", flexShrink: 0 } : undefined}
              className={fieldMode ? undefined : "flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 hover:bg-brand-50 px-2 py-1 rounded-md transition-all shrink-0"}
              data-testid="btn-add-item"
            >
              <Plus style={{ width: 13, height: 13 }} className={fieldMode ? undefined : "w-3.5 h-3.5"} />
              Add Another Item
            </button>
          </div>

          <div className="space-y-2">
            {itemRows.map((row, idx) => {
              const selectedItem = items?.find((i: any) => i.id === row.itemId);
              return (
                <div
                  key={row.rowId}
                  style={fieldMode ? { position: "relative", zIndex: itemRows.length - idx, display: "flex", alignItems: "center", gap: 8, background: "#0b1a0f", border: "1px solid #203023", borderRadius: 10, padding: 8 } : { position: 'relative', zIndex: itemRows.length - idx }}
                  className={fieldMode ? undefined : "flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-2 hover:border-brand-200 transition-colors"}
                  data-testid={`item-row-${idx}`}
                >
                  <div className="flex-[3] min-w-0">
                    <SearchableItemSelect
                      value={row.itemId}
                      onChange={(id) => updateRow(row.rowId, { itemId: id })}
                      items={items || []}
                      dark={fieldMode}
                    />
                    {row.errors.itemId && (
                      <p style={fieldMode ? { fontSize: 10, color: "#ff5555", marginTop: 3, marginLeft: 2 } : undefined} className={fieldMode ? undefined : "text-[10px] text-red-500 mt-1 ml-1"} data-testid={`error-item-${idx}`}>
                        {row.errors.itemId}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0">
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() => updateRow(row.rowId, { quantity: Math.max(0, row.quantity - 1) })}
                        style={fieldMode ? { width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "8px 0 0 8px", border: "1px solid #203023", borderRight: "none", background: "#141e17", color: "#527856", cursor: "pointer" } : undefined}
                        className={fieldMode ? undefined : "w-9 h-9 flex items-center justify-center rounded-l-md border border-r-0 border-slate-200 bg-slate-50 hover:bg-brand-50 hover:text-brand-600 transition-colors text-slate-600"}
                        data-testid={`btn-qty-dec-${idx}`}
                        title="Decrease"
                      >
                        <ChevronLeft style={{ width: 14, height: 14 }} className={fieldMode ? undefined : "w-4 h-4"} />
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
                        style={fieldMode ? { textAlign: "center", height: 34, width: 56, fontSize: 13, fontWeight: 700, border: "1px solid #203023", borderLeft: "none", borderRight: "none", background: "#0f1612", color: "#c8deca", outline: "none", padding: 0 } : { textAlign: "center", paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0 }}
                        className={fieldMode ? undefined : "h-9 w-16 text-sm font-semibold border-y border-slate-200 bg-white focus:outline-none focus:border-brand-300"}
                        data-testid={`input-quantity-${idx}`}
                      />
                      <button
                        type="button"
                        onClick={() => updateRow(row.rowId, { quantity: row.quantity + 1 })}
                        style={fieldMode ? { width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "0 8px 8px 0", border: "1px solid #203023", borderLeft: "none", background: "#141e17", color: "#527856", cursor: "pointer" } : undefined}
                        className={fieldMode ? undefined : "w-9 h-9 flex items-center justify-center rounded-r-md border border-l-0 border-slate-200 bg-slate-50 hover:bg-brand-50 hover:text-brand-600 transition-colors text-slate-600"}
                        data-testid={`btn-qty-inc-${idx}`}
                        title="Increase"
                      >
                        <ChevronRight style={{ width: 14, height: 14 }} className={fieldMode ? undefined : "w-4 h-4"} />
                      </button>
                      {selectedItem && (
                        <span style={fieldMode ? { marginLeft: 6, fontSize: 11, fontWeight: 700, color: "#527856", textTransform: "uppercase", whiteSpace: "nowrap", minWidth: 24, textAlign: "center" } : undefined} className={fieldMode ? undefined : "ml-2 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap min-w-[28px] text-center"}>
                          {selectedItem.unitOfMeasure}
                        </span>
                      )}
                    </div>
                    {row.errors.quantity && (
                      <p style={fieldMode ? { fontSize: 10, color: "#ff5555", marginTop: 3, textAlign: "center" } : undefined} className={fieldMode ? undefined : "text-[10px] text-red-500 mt-1 text-center"} data-testid={`error-qty-${idx}`}>
                        {row.errors.quantity}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0">
                    <button
                      type="button"
                      onClick={() => removeRow(row.rowId)}
                      disabled={itemRows.length === 1}
                      style={fieldMode ? { padding: 6, borderRadius: 6, color: "#2b3f2e", background: "none", border: "none", cursor: "pointer", transition: "opacity 0.15s" } : undefined}
                      className={fieldMode ? undefined : "p-1.5 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-0 transition-all"}
                      data-testid={`btn-remove-row-${idx}`}
                      title="Remove item"
                    >
                      <Trash2 style={{ width: 15, height: 15 }} className={fieldMode ? undefined : "w-4 h-4"} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── NOTE: below Items ── */}
        <div style={fieldMode ? { flexShrink: 0, paddingTop: 16, borderTop: "1px solid #203023", marginTop: 8 } : undefined} className={fieldMode ? undefined : "flex-shrink-0 pt-3 border-t border-slate-100 mt-2"}>
          <FormField control={form.control} name="note" render={({ field }) => (
            <FormItem>
              <FormLabel>Note (Optional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Reference number, PO, reason…"
                  style={fieldMode ? { background: "#141e17", border: "1px solid #203023", borderRadius: 10, color: "#c8deca", fontSize: 13, resize: "none" } : undefined}
                  className={fieldMode ? "resize-none" : "resize-none"}
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
        <div style={fieldMode ? { position: "sticky", bottom: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, padding: "12px 0", marginTop: 16, marginLeft: -16, marginRight: -16, paddingLeft: 16, paddingRight: 16 } : undefined} className={fieldMode ? undefined : "sticky bottom-0 z-10 flex items-center justify-end gap-2 py-3 mt-4 -mx-4 md:-mx-6 px-4 md:px-6"}>
          <div className="flex items-center gap-2">
            {onCancel && (
              <Button
                type="button"
                variant={fieldMode ? undefined : "outline"}
                onClick={onCancel}
                disabled={submitting}
                style={fieldMode ? { background: "#141e17", border: "1px solid #203023", color: "#527856", borderRadius: 10, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, fontSize: 14, height: 40, padding: "0 18px" } : undefined}
                className={fieldMode ? undefined : undefined}
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
                      style={fieldMode ? { background: "#1a2a1d", border: "1px solid #203023", color: "#2b3f2e", borderRadius: 10, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, fontSize: 14, height: 40, padding: "0 20px", cursor: "not-allowed" } : undefined}
                      className={fieldMode ? undefined : "bg-slate-300 text-slate-500 min-w-[100px] cursor-not-allowed"}
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
              <>
                <Button
                  type="button"
                  disabled={submitting}
                  variant={fieldMode ? undefined : "outline"}
                  style={fieldMode ? { background: "#141e17", border: "1px solid #203023", color: "#527856", borderRadius: 10, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, fontSize: 14, height: 40, padding: "0 18px", minWidth: 72 } : undefined}
                  className={fieldMode ? undefined : "min-w-[80px]"}
                  data-testid="button-save-movement"
                  onClick={() => {
                    saveOnlyRef.current = true;
                    form.handleSubmit(onSubmit)();
                  }}
                >
                  {submitting && saveOnlyRef.current ? "Saving…" : "Save"}
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  style={fieldMode ? { background: "#2ddb6f", color: "#07090a", borderRadius: 10, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14, height: 40, padding: "0 22px", minWidth: 100, border: "none", letterSpacing: "0.03em" } : undefined}
                  className={fieldMode ? undefined : "bg-brand-700 hover:bg-brand-800 min-w-[100px]"}
                  data-testid="button-submit-movement"
                >
                  {submitting ? "Saving…" : `Confirm${itemRows.length > 1 ? ` (${itemRows.length})` : ""}`}
                </Button>
              </>
            )}
          </div>
        </div>

      </form>
      </div>
    </Form>
  );
}
