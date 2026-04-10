import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Plus, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCreateLocation } from "@/hooks/use-reference-data";

interface LocationComboboxProps {
  value: number | null;
  onChange: (id: number | null) => void;
  locations: any[];
}

export function LocationCombobox({ value, onChange, locations }: LocationComboboxProps) {
  const { toast } = useToast();
  const createLocation = useCreateLocation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });

  const selected = locations.find(l => l.id === value);
  const filtered = search.trim() ? locations.filter(l => l.name.toLowerCase().includes(search.toLowerCase())) : locations;
  const showCreate = search.trim().length > 0 && !locations.some(l => l.name.trim().toLowerCase() === search.trim().toLowerCase());

  function recalcPos() {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setDropPos({ top: r.bottom + 2, left: r.left, width: Math.max(r.width, 208) });
  }

  useEffect(() => {
    if (!open) return;
    recalcPos();
    const h = (e: MouseEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    window.addEventListener("scroll", recalcPos, true);
    window.addEventListener("resize", recalcPos);
    return () => {
      document.removeEventListener("mousedown", h);
      window.removeEventListener("scroll", recalcPos, true);
      window.removeEventListener("resize", recalcPos);
    };
  }, [open]);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 40); }, [open]);

  async function handleCreate() {
    try {
      const loc = await createLocation.mutateAsync(search.trim());
      onChange(loc.id); setSearch(""); setOpen(false);
      toast({ title: "Location created", description: `"${loc.name}" added.` });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  }

  return (
    <div className="w-full">
      <button ref={triggerRef} type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between text-xs border border-slate-300 rounded px-2 py-1.5 bg-white hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-brand-500 text-left min-h-[30px]"
        data-testid="inline-location-trigger">
        <span className={selected ? "text-slate-900 truncate" : "text-slate-400"}>{selected ? selected.name : "Select…"}</span>
        <ChevronDown className="w-3 h-3 text-slate-400 shrink-0 ml-1" />
      </button>
      {open && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: "fixed", top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 9999 }}
          className="bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden"
        >
          <div className="p-1.5 border-b border-slate-100 flex items-center gap-1.5 bg-slate-50">
            <Search className="w-3 h-3 text-slate-400 shrink-0" />
            <input ref={inputRef} type="text" placeholder="Filter or create…" value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 text-xs outline-none bg-transparent text-slate-900 placeholder:text-slate-400" />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {value != null && (
              <button type="button" onClick={() => { onChange(null); setSearch(""); setOpen(false); }}
                className="w-full text-left px-2.5 py-1.5 text-xs text-slate-400 hover:bg-slate-50 italic border-b border-slate-100">Clear</button>
            )}
            {filtered.map(l => (
              <button key={l.id} type="button" onClick={() => { onChange(l.id); setSearch(""); setOpen(false); }}
                className={`w-full text-left px-2.5 py-1.5 text-xs hover:bg-brand-50 ${l.id === value ? "bg-brand-50 font-medium" : "text-slate-800"}`}>
                {l.name}
              </button>
            ))}
            {filtered.length === 0 && !showCreate && <p className="text-center text-xs text-slate-400 py-2">No locations</p>}
            {showCreate && (
              <button type="button" onClick={handleCreate} disabled={createLocation.isPending}
                className="w-full text-left px-2.5 py-1.5 text-xs text-brand-700 font-medium flex items-center gap-1 hover:bg-brand-50 border-t border-slate-100">
                <Plus className="w-3 h-3" />{createLocation.isPending ? "Creating…" : `Create "${search.trim()}"`}
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
