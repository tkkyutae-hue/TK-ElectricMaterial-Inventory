import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { generateReelId } from "@/lib/reel-utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useItems } from "@/hooks/use-items";
import { useLocations, useProjects, useCreateLocation, useDeleteLocation } from "@/hooks/use-reference-data";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
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

type ReelSnapshot = { id: number; reelId: string; lengthFt: number; status: string | null };

type NewReel = { tempId: string; lengthFt: number; brand: string; reelId: string; locationId?: number | null; status?: string };

type ItemRow = {
  rowId: string;
  itemId: number | null;
  quantity: number;
  errors: ItemRowError;
  reelSelections: Record<number, number>;
  reelSnapshots: Record<number, ReelSnapshot>;
  newReels?: NewReel[];
};

const MOVEMENT_TYPES = [
  { value: "receive",  label: "Receive",  desc: "Stock arriving from a supplier" },
  { value: "issue",    label: "Issue",    desc: "Material going out to a jobsite" },
  { value: "return",   label: "Return",   desc: "Material returned from the field" },
  { value: "transfer", label: "Transfer", desc: "Move between locations" },
];

function makeRow(): ItemRow {
  return { rowId: crypto.randomUUID(), itemId: null, quantity: 1, errors: {}, reelSelections: {}, reelSnapshots: {} };
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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

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
      if (
        ref.current && !ref.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setDropdownPos({ top: r.bottom, left: r.left, width: r.width });

    function onScroll() {
      if (!ref.current || !dropdownRef.current) return;
      const rect = ref.current.getBoundingClientRect();
      dropdownRef.current.style.top = `${rect.bottom}px`;
      dropdownRef.current.style.left = `${rect.left}px`;
      dropdownRef.current.style.width = `${rect.width}px`;
    }

    function onResize() {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom, left: rect.left, width: rect.width });
    }

    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
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
          padding: "0 14px", fontSize: 13, minHeight: 42, cursor: "text",
          background: "#141e17",
          border: `1px solid ${open ? "#2ddb6f" : "#203023"}`,
          borderRadius: open ? "10px 10px 0 0" : 10,
          boxShadow: "none",
          transition: "border-color 0.15s",
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
      {open && createPortal(
        <div
          ref={dropdownRef}
          style={D ? { position: "fixed", top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, zIndex: 9999, background: "#0f1612", border: "1px solid #2ddb6f", borderTop: "none", borderRadius: "0 0 10px 10px", boxShadow: "0 10px 28px rgba(0,0,0,0.6)", overflow: "hidden", maxHeight: `${6 * 44}px` } : { position: "fixed", top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, zIndex: 9999, maxHeight: `${6 * 44}px` }}
          className={D ? undefined : "bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden"}
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
      , document.body)}
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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

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
      if (
        ref.current && !ref.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setDropdownPos({ top: r.bottom, left: r.left, width: r.width });

    function onScroll() {
      if (!ref.current || !dropdownRef.current) return;
      const rect = ref.current.getBoundingClientRect();
      dropdownRef.current.style.top = `${rect.bottom}px`;
      dropdownRef.current.style.left = `${rect.left}px`;
      dropdownRef.current.style.width = `${rect.width}px`;
    }

    function onResize() {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom, left: rect.left, width: rect.width });
    }

    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
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
        style={D ? { width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", fontSize: 13, background: "#141e17", border: `1px solid ${open ? "#2ddb6f" : "#203023"}`, borderRadius: open ? "10px 10px 0 0" : 10, color: selected ? "#c8deca" : "#2b3f2e", cursor: "pointer", textAlign: "left", minHeight: 42, boxShadow: "none", transition: "border-color 0.15s" } : undefined}
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

      {open && createPortal(
        <div ref={dropdownRef} style={D ? { position: "fixed", top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, zIndex: 9999, background: "#0f1612", border: "1px solid #2ddb6f", borderTop: "none", borderRadius: "0 0 10px 10px", boxShadow: "0 10px 28px rgba(0,0,0,0.6)", overflow: "hidden" } : { position: "fixed", top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, zIndex: 9999 }} className={D ? undefined : "bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden"}>
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
                style={D ? { width: "100%", textAlign: "left", padding: "9px 12px", fontSize: 13, color: "#2ddb6f", fontWeight: 500, display: "flex", alignItems: "center", gap: 6, borderTop: "1px solid #203023", background: "none", border: "none", cursor: "pointer" } as any : undefined}
                className={D ? undefined : "w-full text-left px-3 py-2 text-sm text-brand-700 font-medium flex items-center gap-2 hover:bg-brand-50 border-t border-slate-100 transition-colors"}
                data-testid={`${testId}-create`}
              >
                <Plus style={{ width: 13, height: 13 }} className={D ? undefined : "w-3.5 h-3.5"} />
                {createLocation.isPending ? "Creating…" : `Create location "${search.trim()}"`}
              </button>
            )}
          </div>
        </div>
      , document.body)}
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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

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
      if (
        ref.current && !ref.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setDropdownPos({ top: r.bottom + 4, left: r.left, width: r.width });

    function onScroll() {
      if (!ref.current || !dropdownRef.current) return;
      const rect = ref.current.getBoundingClientRect();
      dropdownRef.current.style.top = `${rect.bottom + 4}px`;
      dropdownRef.current.style.left = `${rect.left}px`;
      dropdownRef.current.style.width = `${rect.width}px`;
    }

    function onResize() {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }

    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
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

      {open && createPortal(
        <div ref={dropdownRef} style={D ? { position: "fixed", top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, zIndex: 9999, background: "#0f1612", border: "1px solid #203023", borderRadius: 10, boxShadow: "0 12px 32px rgba(0,0,0,0.6)", overflow: "hidden" } : { position: "fixed", top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, zIndex: 9999 }} className={D ? undefined : "bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden"}>
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
      , document.body)}
    </div>
  );
}

// ── Item Row (field mode — includes reel UX) ────────────────────────────────
function ItemRowField({
  row, idx, itemCount, items, locations, onUpdate, onRemove, movementType,
}: {
  row: ItemRow;
  idx: number;
  itemCount: number;
  items: any[];
  locations: any[];
  onUpdate: (rowId: string, patch: Partial<ItemRow>) => void;
  onRemove: (rowId: string) => void;
  movementType?: string;
}) {
  const selectedItem = items?.find((i: any) => i.id === row.itemId);

  const { data: reelsRaw = [] } = useQuery<any[]>({
    queryKey: ["/api/wire-reels", row.itemId],
    enabled: !!row.itemId,
  });
  const reels = reelsRaw as any[];
  const hasReels = reels.length > 0;

  const isReelItem = selectedItem?.unitOfMeasure === "FT" || hasReels;
  const isReceive = movementType === "receive";
  const showReceiveReelUI = isReceive && !!row.itemId && isReelItem;
  const showIssueReelUI = !isReceive && hasReels;

  const selections = row.reelSelections ?? {};
  const snapshots = row.reelSnapshots ?? {};
  const selectedCount = Object.keys(selections).length;
  const totalFt = Object.values(selections).reduce((a, b) => a + b, 0);

  const newReels = row.newReels ?? [];
  const newReelsTotalFt = newReels.reduce((s, r) => s + r.lengthFt, 0);

  const didInitRef = useRef(false);
  useEffect(() => {
    if (showIssueReelUI && !didInitRef.current) {
      didInitRef.current = true;
      onUpdate(row.rowId, { quantity: 0 });
    }
  }, [showIssueReelUI]);

  useEffect(() => {
    if (showReceiveReelUI && !didInitRef.current) {
      didInitRef.current = true;
      onUpdate(row.rowId, { quantity: 0, newReels: [] });
    }
  }, [showReceiveReelUI]);

  function toggleReel(reel: any) {
    const newSel = { ...selections };
    const newSnap = { ...snapshots };
    if (newSel[reel.id] !== undefined) {
      delete newSel[reel.id];
      delete newSnap[reel.id];
    } else {
      newSel[reel.id] = reel.lengthFt;
      newSnap[reel.id] = { id: reel.id, reelId: reel.reelId, lengthFt: reel.lengthFt, status: reel.status };
    }
    const total = Object.values(newSel).reduce((a, b) => a + b, 0);
    onUpdate(row.rowId, { reelSelections: newSel, reelSnapshots: newSnap, quantity: total });
  }

  function setReelFt(reelId: number, value: number, maxFt: number) {
    const newSel = { ...selections };
    const newSnap = { ...snapshots };
    if (value <= 0) {
      delete newSel[reelId];
      delete newSnap[reelId];
    } else {
      newSel[reelId] = Math.min(value, maxFt);
    }
    const total = Object.values(newSel).reduce((a, b) => a + b, 0);
    onUpdate(row.rowId, { reelSelections: newSel, reelSnapshots: newSnap, quantity: total });
  }

  function removeNewReel(tempId: string) {
    const updated = newReels.filter(r => r.tempId !== tempId);
    const total = updated.reduce((s, r) => s + r.lengthFt, 0);
    onUpdate(row.rowId, { newReels: updated, quantity: total });
  }

  function addNewReels(reels: NewReel[]) {
    const updated = [...newReels, ...reels];
    const total = updated.reduce((s, r) => s + r.lengthFt, 0);
    onUpdate(row.rowId, { newReels: updated, quantity: total });
  }

  const showQtyStepper = !showReceiveReelUI && !showIssueReelUI;

  return (
    <div
      style={{ position: "relative", zIndex: itemCount - idx, background: "#0b1a0f", border: "1px solid #203023", borderRadius: 10, padding: 8 }}
      data-testid={`item-row-${idx}`}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <SearchableItemSelect
            value={row.itemId}
            onChange={(id) => {
              didInitRef.current = false;
              onUpdate(row.rowId, { itemId: id, reelSelections: {}, reelSnapshots: {}, quantity: 1, newReels: [] });
            }}
            items={items || []}
            dark={true}
          />
          {row.errors.itemId && (
            <p style={{ fontSize: 10, color: "#ff5050", marginTop: 3, marginLeft: 2 }} data-testid={`error-item-${idx}`}>{row.errors.itemId}</p>
          )}
        </div>

        {showQtyStepper && (
          <div style={{ flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <button type="button" onClick={() => onUpdate(row.rowId, { quantity: Math.max(0, row.quantity - 1) })} style={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "8px 0 0 8px", border: "1px solid #203023", borderRight: "none", background: "#141e17", color: "#527856", cursor: "pointer" }} data-testid={`btn-qty-dec-${idx}`}>
                <ChevronLeft style={{ width: 14, height: 14 }} />
              </button>
              <input
                type="text" inputMode="numeric" pattern="[0-9]*" value={row.quantity}
                onChange={(e) => { const v = parseInt(e.target.value.replace(/\D/g, ""), 10); onUpdate(row.rowId, { quantity: isNaN(v) || v < 0 ? 0 : v }); }}
                onBlur={(e) => { const v = parseInt(e.target.value, 10); if (isNaN(v) || v < 0) onUpdate(row.rowId, { quantity: 0 }); }}
                style={{ textAlign: "center", height: 34, width: 56, fontSize: 13, fontWeight: 700, border: "1px solid #203023", borderLeft: "none", borderRight: "none", background: "#0f1612", color: "#c8deca", outline: "none", padding: 0 }}
                data-testid={`input-quantity-${idx}`}
              />
              <button type="button" onClick={() => onUpdate(row.rowId, { quantity: row.quantity + 1 })} style={{ width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "0 8px 8px 0", border: "1px solid #203023", borderLeft: "none", background: "#141e17", color: "#527856", cursor: "pointer" }} data-testid={`btn-qty-inc-${idx}`}>
                <ChevronRight style={{ width: 14, height: 14 }} />
              </button>
              {selectedItem && (
                <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: "#527856", textTransform: "uppercase", whiteSpace: "nowrap" }}>{selectedItem.unitOfMeasure}</span>
              )}
            </div>
            {row.errors.quantity && (
              <p style={{ fontSize: 10, color: "#ff5050", marginTop: 3, textAlign: "center" }} data-testid={`error-qty-${idx}`}>{row.errors.quantity}</p>
            )}
          </div>
        )}

        <div style={{ flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => onRemove(row.rowId)}
            disabled={itemCount === 1}
            style={{ padding: "5px 7px", borderRadius: 7, color: itemCount === 1 ? "#1e3524" : "#ff5050", background: "none", border: "none", cursor: itemCount === 1 ? "not-allowed" : "pointer", opacity: itemCount === 1 ? 0.35 : 0.65, transition: "opacity 0.15s, background 0.15s" }}
            onMouseEnter={itemCount > 1 ? e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,80,80,0.12)"; } : undefined}
            onMouseLeave={itemCount > 1 ? e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.65"; (e.currentTarget as HTMLButtonElement).style.background = "none"; } : undefined}
            data-testid={`btn-remove-row-${idx}`}
            title="Remove item"
          >
            <Trash2 style={{ width: 16, height: 16 }} />
          </button>
        </div>
      </div>

      {/* ── Receive Reel UI ─────────────────────────────────────────── */}
      {showReceiveReelUI && (
        <div style={{ marginTop: 10, borderTop: "1px solid #203023", paddingTop: 8 }}>
          {/* Active reels info */}
          <div style={{ fontSize: 10, fontWeight: 700, color: "#4a7052", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, fontFamily: "Barlow Condensed, sans-serif" }}>
            Active Reels on Hand
          </div>
          {reels.length === 0 ? (
            <div style={{ fontSize: 11, color: "#4a7052", padding: "4px 0 8px", fontStyle: "italic" }}>No active reels — all stock will come from new reels added below.</div>
          ) : (
            reels.map((reel: any) => {
              const isNew = reel.status === "new" || reel.status === "full";
              return (
                <div key={reel.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", marginBottom: 3, borderRadius: 7, background: "#111d14", border: "1px solid #1a2c1e" }}>
                  <span style={{ fontWeight: 600, fontSize: 12, color: "#c8deca", fontFamily: "Barlow Condensed, sans-serif", minWidth: 44 }}>{reel.reelId}</span>
                  <span style={{ fontSize: 13, color: "#2ddb6f", fontWeight: 600, fontFamily: "Barlow Condensed, sans-serif" }}>{reel.lengthFt} FT</span>
                  {reel.brand && <span style={{ fontSize: 11, color: "#7aab82" }}>{reel.brand}</span>}
                  {reel.location && <span style={{ fontSize: 11, color: "#527856" }}>{reel.location.name}</span>}
                  <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 10, background: isNew ? "rgba(45,219,111,0.1)" : "rgba(245,166,35,0.1)", color: isNew ? "#2ddb6f" : "#f5a623" }}>
                    {isNew ? "New" : "Used"}
                  </span>
                </div>
              );
            })
          )}

          {/* Pending new reels */}
          {newReels.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#2ddb6f", textTransform: "uppercase", letterSpacing: 1, marginBottom: 5, fontFamily: "Barlow Condensed, sans-serif" }}>
                Adding
              </div>
              {newReels.map(nr => (
                <div key={nr.tempId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", marginBottom: 3, borderRadius: 7, background: "rgba(45,219,111,0.06)", border: "1px solid rgba(45,219,111,0.2)" }} data-testid={`new-reel-pending-${nr.tempId}`}>
                  <span style={{ fontWeight: 700, fontSize: 12, color: "#2ddb6f", fontFamily: "Barlow Condensed, sans-serif", minWidth: 44 }}>{nr.reelId}</span>
                  <span style={{ fontSize: 13, color: "#e2f0e5", fontWeight: 600, fontFamily: "Barlow Condensed, sans-serif" }}>{nr.lengthFt} FT</span>
                  {nr.brand && <span style={{ fontSize: 11, color: "#7aab82" }}>{nr.brand}</span>}
                  <button type="button" onClick={() => removeNewReel(nr.tempId)} style={{ marginLeft: "auto", padding: 3, background: "none", border: "none", cursor: "pointer", color: "#4a7052" }} data-testid={`btn-remove-new-reel-${nr.tempId}`}>
                    <X style={{ width: 13, height: 13 }} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Bulk reel entry */}
          <BulkReelEntry item={selectedItem ?? null} pendingCount={newReels.length} onAddAll={addNewReels} locations={locations} />

          {/* Total summary */}
          {newReels.length > 0 && (
            <div style={{ textAlign: "right", marginTop: 6, fontSize: 12, color: "#7aab82" }}>
              {newReels.length} new reel{newReels.length !== 1 ? "s" : ""} · <span style={{ color: "#2ddb6f", fontWeight: 700 }}>{newReelsTotalFt.toLocaleString()} FT</span>
            </div>
          )}
          {row.errors.quantity && (
            <p style={{ fontSize: 10, color: "#ff5050", marginTop: 4 }} data-testid={`error-qty-${idx}`}>{row.errors.quantity}</p>
          )}
        </div>
      )}

      {/* ── Issue / Return Reel UI ───────────────────────────────────── */}
      {showIssueReelUI && (
        <div style={{ marginTop: 10, borderTop: "1px solid #203023", paddingTop: 8 }}>
          {reels.map((reel: any) => {
            const isSelected = selections[reel.id] !== undefined;
            const ftValue = selections[reel.id] ?? reel.lengthFt;
            const isNew = reel.status === "new" || reel.status === "full";
            return (
              <div
                key={reel.id}
                onClick={() => toggleReel(reel)}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", marginBottom: 4, borderRadius: 8, borderLeft: `3px solid ${isSelected ? "#2ddb6f" : "transparent"}`, background: isSelected ? "rgba(45,219,111,0.08)" : "transparent", cursor: "pointer", userSelect: "none" }}
                data-testid={`reel-row-${reel.id}`}
              >
                <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${isSelected ? "#2ddb6f" : "#2a4030"}`, background: isSelected ? "#2ddb6f" : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {isSelected && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#0b1a0f" }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 600, fontSize: 12, color: "#e2f0e5", fontFamily: "Barlow Condensed, sans-serif" }}>{reel.reelId}</span>
                    <span style={{ fontSize: 15, color: "#2ddb6f", fontFamily: "Barlow Condensed, sans-serif", fontWeight: 500 }}>{reel.lengthFt} FT</span>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 10, background: isNew ? "rgba(45,219,111,0.15)" : "rgba(245,166,35,0.15)", color: isNew ? "#2ddb6f" : "#f5a623" }}>
                      {isNew ? "New" : "Used"}
                    </span>
                    {reel.location && <span style={{ fontSize: 11, color: "#7aab82" }}>{reel.location.name}</span>}
                  </div>
                </div>
                {isSelected && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="number" min={1} max={reel.lengthFt} value={ftValue}
                      onChange={(e) => { const v = parseInt(e.target.value, 10); setReelFt(reel.id, isNaN(v) ? 0 : v, reel.lengthFt); }}
                      style={{ width: 70, height: 30, textAlign: "center", fontSize: 13, fontWeight: 700, background: "#1c2b1f", border: "1px solid #2a4030", borderRadius: 7, color: "#e2f0e5", outline: "none", padding: "0 6px" }}
                      data-testid={`reel-ft-input-${reel.id}`}
                    />
                    <span style={{ fontSize: 11, color: "#4a7052", whiteSpace: "nowrap" }}>/ {reel.lengthFt} FT</span>
                  </div>
                )}
              </div>
            );
          })}
          {row.errors.quantity && (
            <p style={{ fontSize: 10, color: "#ff5050", marginTop: 3, marginLeft: 2 }} data-testid={`error-qty-${idx}`}>{row.errors.quantity}</p>
          )}
          {selectedCount > 0 && (
            <div style={{ textAlign: "right", marginTop: 4, fontSize: 12, color: "#7aab82" }}>
              {selectedCount} reel{selectedCount !== 1 ? "s" : ""} · {totalFt.toLocaleString()} FT
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Brand combobox helpers ────────────────────────────────────────────────────
const KNOWN_BRANDS = [
  "Southwire", "Ideal", "Hubbell", "Leviton", "Siemens",
  "Square D", "Eaton", "Greenlee", "Milwaukee", "Klein",
  "Grainger", "3M", "Panduit", "Burndy", "ILSCO", "nVent",
  "Thomas & Betts", "ABB",
];

const LS_CUSTOM_BRANDS_KEY = "vstock_custom_brands";
function getStoredBrands(): string[] {
  try { return JSON.parse(localStorage.getItem(LS_CUSTOM_BRANDS_KEY) || "[]"); } catch { return []; }
}
function saveCustomBrands(brands: string[]) {
  const existing = getStoredBrands();
  const merged = [...existing];
  for (const b of brands) {
    if (b && !merged.some(x => x.toLowerCase() === b.toLowerCase())) merged.push(b);
  }
  localStorage.setItem(LS_CUSTOM_BRANDS_KEY, JSON.stringify(merged));
}

function BrandCombobox({
  value, onChange, allBrands, idx,
}: {
  value: string;
  onChange: (v: string) => void;
  allBrands: string[];
  idx: number;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const filtered = useMemo(() => {
    if (!query.trim()) return allBrands;
    const q = query.toLowerCase();
    return allBrands.filter(b => b.toLowerCase().includes(q));
  }, [query, allBrands]);

  function select(brand: string) {
    setQuery(brand);
    onChange(brand);
    setOpen(false);
  }

  const INPUT_STYLE: React.CSSProperties = {
    height: 32, padding: "0 8px", fontSize: 13, background: "#0b1a0f",
    border: "1px solid #2a4030", borderRadius: 7, color: "#e2f0e5",
    outline: "none", width: "100%", boxSizing: "border-box",
  };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <input
        type="text"
        value={query}
        placeholder="Southwire"
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
        onBlur={() => setTimeout(() => { setOpen(false); if (query.trim()) onChange(query.trim()); }, 160)}
        style={INPUT_STYLE}
        data-testid={`bulk-reel-brand-${idx}`}
      />
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 2px)", left: 0, right: 0, background: "#111d14", border: "1px solid #2a4030", borderRadius: 7, zIndex: 200, maxHeight: 150, overflowY: "auto", boxShadow: "0 4px 16px rgba(0,0,0,0.5)" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "7px 10px", fontSize: 11, color: "#4a7052", fontStyle: "italic" }}>
              Press Tab/Enter to use "{query}"
            </div>
          ) : (
            filtered.map(brand => (
              <div
                key={brand}
                onMouseDown={() => select(brand)}
                style={{ padding: "6px 10px", fontSize: 13, color: brand.toLowerCase() === query.toLowerCase() ? "#2ddb6f" : "#c8deca", cursor: "pointer", fontFamily: "Barlow Condensed, sans-serif", borderBottom: "1px solid #152118" }}
              >
                {brand}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Reel Location Select (attached dropdown, used in BulkReelEntry) ──────────
function ReelLocationSelect({
  value, onChange, locations, idx,
}: {
  value: string;
  onChange: (v: string) => void;
  locations: any[];
  idx: number;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = locations.find(l => String(l.id) === value);
  const filtered = search.trim()
    ? locations.filter(l => l.name.toLowerCase().includes(search.toLowerCase()))
    : locations;

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  const BTN: React.CSSProperties = {
    height: 32, width: "100%", display: "flex", alignItems: "center",
    justifyContent: "space-between", padding: "0 8px", fontSize: 13,
    background: "#0b1a0f", border: `1px solid ${open ? "#2ddb6f" : "#2a4030"}`,
    borderRadius: open ? "7px 7px 0 0" : 7, color: selected ? "#e2f0e5" : "#4a7052",
    cursor: "pointer", textAlign: "left", transition: "border-color 0.15s",
    boxSizing: "border-box",
  };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={BTN} data-testid={`bulk-reel-location-${idx}`}>
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selected ? selected.name : "Default"}
        </span>
        <ChevronDown style={{ width: 12, height: 12, color: "#527856", flexShrink: 0, marginLeft: 4 }} />
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 200,
          background: "#111d14", border: "1px solid #2ddb6f", borderTop: "none",
          borderRadius: "0 0 7px 7px", overflow: "hidden",
          boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        }}>
          <div style={{ padding: "5px 7px", borderBottom: "1px solid #1a2c1e", display: "flex", alignItems: "center", gap: 5 }}>
            <Search style={{ width: 11, height: 11, color: "#527856", flexShrink: 0 }} />
            <input
              ref={inputRef}
              type="text"
              placeholder="Filter…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ flex: 1, fontSize: 12, outline: "none", background: "transparent", color: "#c8deca", border: "none" }}
            />
          </div>
          <div style={{ maxHeight: 144, overflowY: "auto" }}>
            <button
              type="button"
              onMouseDown={() => { onChange(""); setOpen(false); setSearch(""); }}
              style={{ width: "100%", textAlign: "left", padding: "6px 10px", fontSize: 13, color: !value ? "#2ddb6f" : "#7aab82", background: "none", border: "none", borderBottom: "1px solid #0e1810", cursor: "pointer" }}
            >
              Default
            </button>
            {filtered.map(loc => (
              <button
                key={loc.id}
                type="button"
                onMouseDown={() => { onChange(String(loc.id)); setOpen(false); setSearch(""); }}
                style={{ width: "100%", textAlign: "left", padding: "6px 10px", fontSize: 13, color: String(loc.id) === value ? "#2ddb6f" : "#c8deca", background: "none", border: "none", borderBottom: "1px solid #0e1810", cursor: "pointer" }}
              >
                {loc.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Bulk Reel Entry (row-based multi-entry, used in receive mode) ─────────────
interface BulkReelRow {
  tempId: string;
  lengthFt: number | "";
  brand: string;
  locationId: string;
  status: string;
  error: string | null;
}

function makeBulkRow(): BulkReelRow {
  return { tempId: crypto.randomUUID(), lengthFt: 500, brand: "", locationId: "", status: "new", error: null };
}

function BulkReelEntry({
  item, pendingCount, onAddAll, locations,
}: {
  item: any | null;
  pendingCount: number;
  onAddAll: (reels: NewReel[]) => void;
  locations: any[];
}) {
  const [rows, setRows] = useState<BulkReelRow[]>([makeBulkRow()]);
  const [nextSeq, setNextSeq] = useState<number | null>(null);
  const [fetching, setFetching] = useState(false);
  const prevItemId = useRef<number | null>(null);

  const { data: dbBrands = [] } = useQuery<string[]>({ queryKey: ["/api/wire-reels/brands"] });

  const allBrands = useMemo(() => {
    const seen = new Set<string>();
    const merged: string[] = [];
    const push = (b: string) => { const k = b.toLowerCase(); if (b && !seen.has(k)) { seen.add(k); merged.push(b); } };
    (dbBrands as string[]).forEach(push);
    getStoredBrands().forEach(push);
    KNOWN_BRANDS.forEach(push);
    return merged;
  }, [dbBrands]);

  useEffect(() => {
    if (!item || item.id === prevItemId.current) return;
    prevItemId.current = item.id;
    setFetching(true);
    fetch(`/api/wire-reels/${item.id}/next-id`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { setNextSeq(typeof d.nextSeq === "number" ? d.nextSeq : 1); setFetching(false); })
      .catch(() => { setFetching(false); });
  }, [item?.id]);

  function getReelId(brand: string, rowIndex: number): string | null {
    if (nextSeq === null || !item) return null;
    return generateReelId(item, brand || "XX", nextSeq + pendingCount + rowIndex);
  }

  function updateRow(tempId: string, patch: Partial<BulkReelRow>) {
    setRows(prev => prev.map(r => r.tempId === tempId ? { ...r, ...patch, error: null } : r));
  }

  function removeRow(tempId: string) {
    setRows(prev => prev.length === 1 ? [makeBulkRow()] : prev.filter(r => r.tempId !== tempId));
  }

  function handleAddAll() {
    const validated = rows.map((row, idx) => {
      const ft = typeof row.lengthFt === "number" ? row.lengthFt : parseInt(String(row.lengthFt), 10);
      if (isNaN(ft) || ft <= 0) return { ...row, error: "Length required (> 0)" };
      if (!getReelId(row.brand, idx)) return { ...row, error: "Reel ID not ready" };
      return { ...row, error: null };
    });
    setRows(validated);
    if (validated.some(r => r.error)) return;

    const reels: NewReel[] = rows.map((row, idx) => {
      const ft = typeof row.lengthFt === "number" ? row.lengthFt : parseInt(String(row.lengthFt), 10);
      return {
        tempId: row.tempId,
        lengthFt: ft,
        brand: row.brand.trim(),
        reelId: getReelId(row.brand, idx)!,
        locationId: row.locationId ? parseInt(row.locationId, 10) : null,
        status: row.status,
      };
    });
    onAddAll(reels);
    const newBrands = rows.map(r => r.brand.trim()).filter(b => b && !allBrands.some(x => x.toLowerCase() === b.toLowerCase()));
    if (newBrands.length) saveCustomBrands(newBrands);
    setRows([makeBulkRow()]);
  }

  const LBL: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: "#527856", textTransform: "uppercase" as const, letterSpacing: 0.8, fontFamily: "Barlow Condensed, sans-serif" };
  const INPUT: React.CSSProperties = { height: 32, padding: "0 8px", fontSize: 13, background: "#0b1a0f", border: "1px solid #2a4030", borderRadius: 7, color: "#e2f0e5", outline: "none", width: "100%", boxSizing: "border-box" as const };
  const GRID: React.CSSProperties = { display: "grid", gridTemplateColumns: "minmax(100px,130px) 78px 1fr 1fr 68px 26px", gap: 6, alignItems: "center" };

  return (
    <div style={{ marginTop: 10, padding: "10px 12px", background: "#0f1a12", border: "1px solid rgba(45,219,111,0.2)", borderRadius: 9 }} data-testid="bulk-reel-entry">
      {/* Section label */}
      <div style={{ fontSize: 10, fontWeight: 700, color: "#2ddb6f", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, fontFamily: "Barlow Condensed, sans-serif" }}>
        New Reels
      </div>

      {/* Column headers */}
      <div style={{ ...GRID, marginBottom: 4 }}>
        <div style={LBL}>Reel ID</div>
        <div style={LBL}>Length FT</div>
        <div style={LBL}>Brand</div>
        <div style={LBL}>Location</div>
        <div style={LBL}>Status</div>
        <div />
      </div>

      {/* Input rows */}
      {rows.map((row, idx) => {
        const reelId = getReelId(row.brand, idx);
        return (
          <div key={row.tempId} style={{ marginBottom: 5 }}>
            <div style={GRID}>
              {/* Reel ID — read-only, auto-generated */}
              <div style={{ height: 32, display: "flex", alignItems: "center", background: "#080f09", border: "1px solid #1a2c1e", borderRadius: 7, padding: "0 8px", overflow: "hidden" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: fetching ? "#4a7052" : reelId ? "#2ddb6f" : "#4a7052", fontFamily: "Barlow Condensed, sans-serif", whiteSpace: "nowrap", letterSpacing: 0.3 }} data-testid={`bulk-reel-id-${idx}`}>
                  {fetching ? "…" : reelId ?? "—"}
                </span>
              </div>
              {/* Length */}
              <input
                type="number" min={1} value={row.lengthFt}
                onChange={e => { const v = parseInt(e.target.value, 10); updateRow(row.tempId, { lengthFt: isNaN(v) ? "" : v }); }}
                style={INPUT}
                data-testid={`bulk-reel-length-${idx}`}
              />
              {/* Brand — combobox with existing brands + type-in */}
              <BrandCombobox
                value={row.brand}
                onChange={v => updateRow(row.tempId, { brand: v })}
                allBrands={allBrands}
                idx={idx}
              />
              {/* Location */}
              <ReelLocationSelect
                value={row.locationId}
                onChange={v => updateRow(row.tempId, { locationId: v })}
                locations={locations}
                idx={idx}
              />
              {/* Status — simplified: New / Used only */}
              <select
                value={row.status}
                onChange={e => updateRow(row.tempId, { status: e.target.value })}
                style={INPUT}
                data-testid={`bulk-reel-status-${idx}`}
              >
                <option value="new">New</option>
                <option value="used">Used</option>
              </select>
              {/* Delete row */}
              <button
                type="button"
                onClick={() => removeRow(row.tempId)}
                title="Remove row"
                style={{ width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", color: "#ff5050", opacity: 0.6, borderRadius: 5, flexShrink: 0, transition: "opacity 0.15s, background 0.15s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,80,80,0.12)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.6"; (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                data-testid={`btn-remove-bulk-row-${idx}`}
              >
                <X style={{ width: 13, height: 13 }} />
              </button>
            </div>
            {row.error && (
              <p style={{ fontSize: 10, color: "#ff5050", marginTop: 2, paddingLeft: 2 }}>{row.error}</p>
            )}
          </div>
        );
      })}

      {/* Footer: Add Row | Clear · Add All Reels */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, gap: 6 }}>
        <button
          type="button"
          onClick={() => setRows(prev => [...prev, makeBulkRow()])}
          style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", background: "none", border: "1px dashed #2a4030", borderRadius: 7, color: "#527856", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "Barlow Condensed, sans-serif", letterSpacing: 0.3 }}
          data-testid="btn-add-reel-row"
        >
          <Plus style={{ width: 12, height: 12 }} />
          Add Reel Row
        </button>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={() => setRows([makeBulkRow()])}
            style={{ padding: "5px 12px", borderRadius: 7, background: "none", border: "1px solid #2a4030", color: "#7aab82", fontSize: 12, cursor: "pointer" }}
            data-testid="btn-bulk-reel-clear"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={handleAddAll}
            disabled={!nextSeq || fetching}
            style={{ padding: "5px 16px", borderRadius: 7, background: "#2ddb6f", border: "none", color: "#0b1a0f", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: (!nextSeq || fetching) ? 0.5 : 1, fontFamily: "Barlow Condensed, sans-serif", letterSpacing: 0.3 }}
            data-testid="btn-add-all-reels"
          >
            Add All Reels
          </button>
        </div>
      </div>
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
  draftId?: number;
}

export function MovementForm({ defaultType = "receive", defaultItemId, onSuccess, onCancel, readOnly = false, allowedTypes, fieldMode = false, draftId }: MovementFormProps) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const { data: items } = useItems();
  const { data: locations } = useLocations();
  const { data: projects } = useProjects();
  const [submitting, setSubmitting] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);

  const initialRow = makeRow();
  if (defaultItemId) initialRow.itemId = defaultItemId;

  const [itemRows, setItemRows] = useState<ItemRow[]>([initialRow]);
  const [resumingDraftId, setResumingDraftId] = useState<number | undefined>(draftId);

  const { data: draftData } = useQuery<any>({
    queryKey: ["/api/drafts", draftId],
    enabled: !!draftId,
  });

  const form = useForm<SharedData>({
    resolver: zodResolver(sharedSchema),
    defaultValues: {
      movementType: defaultType,
    },
  });

  useEffect(() => {
    if (!draftData || !items) return;
    form.setValue("movementType", draftData.movementType);
    if (draftData.sourceLocationId) form.setValue("sourceLocationId", draftData.sourceLocationId);
    if (draftData.destinationLocationId) form.setValue("destinationLocationId", draftData.destinationLocationId);
    if (draftData.projectId) form.setValue("projectId", draftData.projectId);
    if (draftData.note) form.setValue("note", draftData.note);
    try {
      const draftItems = JSON.parse(draftData.itemsJson || "[]");
      if (Array.isArray(draftItems) && draftItems.length > 0) {
        setItemRows(draftItems.map((di: any) => ({
          rowId: crypto.randomUUID(),
          itemId: di.itemId,
          quantity: di.qty,
          errors: {},
          reelSelections: di.reelSelections ? Object.fromEntries(Object.entries(di.reelSelections).map(([k, v]) => [Number(k), v as number])) : {},
          reelSnapshots: {},
        })));
      }
    } catch (_) {}
  }, [draftData, items]);

  const movType = form.watch("movementType");

  const needsSource      = ["receive", "return", "transfer"].includes(movType);
  const needsDestination = ["issue", "transfer"].includes(movType);
  const needsProject     = ["receive", "issue", "return"].includes(movType);
  const sourceLabel      = movType === "receive" ? t.receiveFrom : movType === "return" ? t.returnFrom : t.fromLocation;
  const destLabel        = movType === "issue" ? t.issueTo : t.toLocation;

  const addRow = useCallback(() => {
    setItemRows(prev => [...prev, makeRow()]);
  }, []);

  const removeRow = useCallback((rowId: string) => {
    setItemRows(prev => prev.length > 1 ? prev.filter(r => r.rowId !== rowId) : prev);
  }, []);

  const updateRow = useCallback((rowId: string, patch: Partial<ItemRow>) => {
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

  async function onSaveDraft() {
    const shared = form.getValues();
    if (!shared.movementType) {
      form.setError("movementType", { message: "Movement type is required" });
      return;
    }
    const validRows = itemRows.filter(r => r.itemId && r.quantity >= 1);
    if (validRows.length === 0) {
      toast({ title: "Add at least one item before saving", variant: "destructive" });
      return;
    }

    setDraftSaving(true);
    try {
      const itemsList = validRows.map(row => {
        const item = items?.find(i => i.id === row.itemId);
        return {
          itemId: row.itemId,
          itemName: item?.name ?? "",
          sku: item?.sku ?? "",
          qty: row.quantity,
          unit: item?.unitOfMeasure ?? "",
          reelIds: Object.entries(row.reelSelections ?? {}).filter(([, v]) => v > 0).map(([k]) => Number(k)),
          reelSelections: row.reelSelections ?? {},
        };
      });

      const res = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          movementType: shared.movementType,
          sourceLocationId: shared.sourceLocationId || null,
          destinationLocationId: shared.destinationLocationId || null,
          projectId: shared.projectId || null,
          note: shared.note || null,
          itemsJson: JSON.stringify(itemsList),
        }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.message || "Failed to save draft");
      }

      await qc.invalidateQueries({ queryKey: ["/api/drafts"] });

      const txPath = fieldMode ? "/field/transactions?tab=drafts" : "/transactions?tab=drafts";
      const { dismiss } = toast({
        title: "Draft saved",
        description: (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span>Draft saved — view in Transactions &gt; Draft Movements</span>
            <button
              type="button"
              style={{ textAlign: "left", textDecoration: "underline", fontSize: 12, background: "none", border: "none", padding: 0, cursor: "pointer", color: "inherit" }}
              onClick={() => { navigate(txPath); dismiss(); }}
            >
              View Draft Movements →
            </button>
          </div>
        ) as any,
        duration: 4000,
      });
    } catch (err: any) {
      toast({ title: "Failed to save draft", description: err.message, variant: "destructive" });
    } finally {
      setDraftSaving(false);
    }
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

      const reelOps: Promise<any>[] = [];
      for (const row of validRows) {
        // Issue/Return: update or delete consumed reels
        for (const [reelIdStr, ftUsed] of Object.entries(row.reelSelections ?? {})) {
          if (!ftUsed) continue;
          const reelId = Number(reelIdStr);
          const snapshot = row.reelSnapshots?.[reelId];
          if (!snapshot) continue;
          const newLength = snapshot.lengthFt - ftUsed;
          if (newLength <= 0) {
            reelOps.push(fetch(`/api/wire-reels/${reelId}`, { method: "DELETE", credentials: "include" }));
          } else {
            reelOps.push(fetch(`/api/wire-reels/${reelId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ lengthFt: newLength, status: "used" }) }));
          }
        }
        // Receive: create new reels sequentially (sequential IDs require serial creation)
        if (shared.movementType === "receive") {
          for (const nr of (row.newReels ?? [])) {
            await fetch("/api/wire-reels", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                itemId: row.itemId,
                reelId: nr.reelId,
                lengthFt: nr.lengthFt,
                brand: nr.brand || null,
                locationId: nr.locationId ?? shared.destinationLocationId ?? null,
                status: nr.status ?? "full",
              }),
            });
          }
        }
      }
      if (reelOps.length > 0) await Promise.all(reelOps);

      await qc.invalidateQueries({ queryKey: [api.movements.list.path] });
      await qc.invalidateQueries({ queryKey: [api.items.list.path] });
      await qc.invalidateQueries({ queryKey: [api.dashboard.stats.path] });
      await qc.invalidateQueries({ queryKey: [api.projects.list.path] });
      await qc.invalidateQueries({ queryKey: ["/api/wire-reels"] });
      await qc.invalidateQueries({ queryKey: ["/api/inventory/category"] });
      await qc.invalidateQueries({ queryKey: ["/api/inventory/categories/summary"] });
      await qc.invalidateQueries({ queryKey: ["/api/field/items"] });
      for (const row of validRows) {
        if (row.itemId) {
          await qc.invalidateQueries({ queryKey: [api.items.get.path, row.itemId] });
          await qc.invalidateQueries({ queryKey: ["/api/wire-reels", row.itemId] });
        }
      }

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

      if (resumingDraftId) {
        try {
          await fetch(`/api/drafts/${resumingDraftId}`, { method: "DELETE", credentials: "include" });
          await qc.invalidateQueries({ queryKey: ["/api/drafts"] });
          setResumingDraftId(undefined);
        } catch (_) {}
      }

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
              <FormLabel>{t.movementType}</FormLabel>
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
                    <FormLabel>{t.projectOptional}</FormLabel>
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
                    <FormLabel>{t.receivingLocation}</FormLabel>
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
                    <FormLabel>{t.sendingLocation}</FormLabel>
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
            <p style={fieldMode ? { fontSize: 13, fontWeight: 600, color: "#527856", margin: 0 } : undefined} className={fieldMode ? undefined : "text-sm font-semibold text-slate-700"}>{t.items}</p>
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
              {t.addAnotherItem}
            </button>
          </div>

          <div className="space-y-2">
            {itemRows.map((row, idx) => {
              if (fieldMode) {
                return (
                  <ItemRowField
                    key={row.rowId}
                    row={row}
                    idx={idx}
                    itemCount={itemRows.length}
                    items={items || []}
                    locations={locations || []}
                    onUpdate={updateRow}
                    onRemove={removeRow}
                    movementType={movType}
                  />
                );
              }
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
                      dark={false}
                    />
                    {row.errors.itemId && (
                      <p className="text-[10px] text-red-500 mt-1 ml-1" data-testid={`error-item-${idx}`}>{row.errors.itemId}</p>
                    )}
                  </div>
                  <div className="shrink-0">
                    <div className="flex items-center">
                      <button type="button" onClick={() => updateRow(row.rowId, { quantity: Math.max(0, row.quantity - 1) })} className="w-9 h-9 flex items-center justify-center rounded-l-md border border-r-0 border-slate-200 bg-slate-50 hover:bg-brand-50 hover:text-brand-600 transition-colors text-slate-600" data-testid={`btn-qty-dec-${idx}`} title="Decrease">
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <input type="text" inputMode="numeric" pattern="[0-9]*" value={row.quantity} onChange={(e) => { const val = parseInt(e.target.value.replace(/\D/g, ''), 10); updateRow(row.rowId, { quantity: isNaN(val) || val < 0 ? 0 : val }); }} onBlur={(e) => { const val = parseInt(e.target.value, 10); if (isNaN(val) || val < 0) updateRow(row.rowId, { quantity: 0 }); }} style={{ textAlign: "center", paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0 }} className="h-9 w-16 text-sm font-semibold border-y border-slate-200 bg-white focus:outline-none focus:border-brand-300" data-testid={`input-quantity-${idx}`} />
                      <button type="button" onClick={() => updateRow(row.rowId, { quantity: row.quantity + 1 })} className="w-9 h-9 flex items-center justify-center rounded-r-md border border-l-0 border-slate-200 bg-slate-50 hover:bg-brand-50 hover:text-brand-600 transition-colors text-slate-600" data-testid={`btn-qty-inc-${idx}`} title="Increase">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      {selectedItem && (
                        <span className="ml-2 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap min-w-[28px] text-center">{selectedItem.unitOfMeasure}</span>
                      )}
                    </div>
                    {row.errors.quantity && (
                      <p className="text-[10px] text-red-500 mt-1 text-center" data-testid={`error-qty-${idx}`}>{row.errors.quantity}</p>
                    )}
                  </div>
                  <div className="shrink-0">
                    <button type="button" onClick={() => removeRow(row.rowId)} disabled={itemRows.length === 1} className="p-1.5 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-0 transition-all" data-testid={`btn-remove-row-${idx}`} title="Remove item">
                      <Trash2 className="w-4 h-4" />
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
              <FormLabel>{t.noteOptional}</FormLabel>
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
        <div style={fieldMode ? { position: "sticky", bottom: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, padding: "12px 0", marginTop: 16, marginLeft: -16, marginRight: -16, paddingLeft: 16, paddingRight: 16, background: "#0d1410", borderTop: "1px solid #203023" } : undefined} className={fieldMode ? undefined : "sticky bottom-0 z-10 flex items-center justify-end gap-2 py-3 mt-4 -mx-4 md:-mx-6 px-4 md:px-6"}>
          <div className="flex items-center gap-2">
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
                  disabled={draftSaving || submitting}
                  variant={fieldMode ? undefined : "outline"}
                  style={fieldMode ? { background: "#141e17", border: "1px solid #203023", color: "#527856", borderRadius: 10, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, fontSize: 14, height: 40, padding: "0 18px", minWidth: 110 } : undefined}
                  className={fieldMode ? undefined : "min-w-[110px]"}
                  data-testid="button-save-draft"
                  onClick={onSaveDraft}
                >
                  {draftSaving ? t.saving : t.saveAsDraft}
                </Button>
                {onCancel && (
                  <Button
                    type="button"
                    variant={fieldMode ? undefined : "destructive"}
                    onClick={onCancel}
                    disabled={submitting}
                    style={fieldMode ? {
                      background: "rgba(255,80,80,0.08)",
                      border: "1px solid rgba(255,80,80,0.30)",
                      color: "#ff5050",
                      borderRadius: 10,
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontWeight: 700,
                      fontSize: 14,
                      height: 40,
                      padding: "0 22px",
                      minWidth: 100,
                    } : undefined}
                    data-testid="button-cancel-movement"
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  type="submit"
                  disabled={submitting}
                  style={fieldMode ? { background: "#2ddb6f", color: "#07090a", borderRadius: 10, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14, height: 40, padding: "0 22px", minWidth: 100, border: "none", letterSpacing: "0.03em" } : undefined}
                  className={fieldMode ? undefined : "bg-brand-700 hover:bg-brand-800 min-w-[100px]"}
                  data-testid="button-submit-movement"
                >
                  {submitting ? t.saving : `${t.confirm}${itemRows.length > 1 ? ` (${itemRows.length})` : ""}`}
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
