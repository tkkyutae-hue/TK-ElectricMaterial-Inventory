import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Search, X, ChevronDown, Plus, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useCreateLocation, useDeleteLocation } from "@/hooks/use-reference-data";

function useIsMobileInline() {
  const [mobile, setMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );
  useEffect(() => {
    function onResize() { setMobile(window.innerWidth < 768); }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return mobile;
}

export function SearchableLocationSelect({
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
  const isMobile = useIsMobileInline();

  const selected = locations.find(l => l.id === value);

  // Guard: skip locations where name is null/undefined to prevent crashes
  const validLocations = locations.filter(l => l.name != null);

  const filtered = search.trim()
    ? validLocations.filter(l =>
        (l.name as string).toLowerCase().includes(search.toLowerCase())
      )
    : validLocations;

  const showCreate =
    search.trim().length > 0 &&
    !validLocations.some(
      l => (l.name as string).trim().toLowerCase() === search.trim().toLowerCase()
    );

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (isMobile) return;
      if (
        ref.current && !ref.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, isMobile]);

  useEffect(() => {
    if (!open || !ref.current || isMobile) return;
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
  }, [open, isMobile]);

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
                  await fetch(`/api/locations/${loc.id}/restore`, { method: "POST", credentials: "include" });
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

  function handleClose() {
    setOpen(false);
    setSearch("");
  }

  const D = dark;

  const resultList = (listStyle: React.CSSProperties = {}) => (
    <div style={{ overflowY: "auto", ...listStyle }}>
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
          style={D ? { width: "100%", textAlign: "left", padding: "9px 12px", fontSize: 13, color: "#2ddb6f", fontWeight: 500, display: "flex", alignItems: "center", gap: 6, borderTop: "1px solid #203023", background: "none", border: "none", borderTopStyle: "solid", cursor: "pointer" } : undefined}
          className={D ? undefined : "w-full text-left px-3 py-2 text-sm text-brand-700 font-medium flex items-center gap-2 hover:bg-brand-50 border-t border-slate-100 transition-colors"}
          data-testid={`${testId}-create`}
        >
          <Plus style={{ width: 13, height: 13 }} className={D ? undefined : "w-3.5 h-3.5"} />
          {createLocation.isPending ? "Creating…" : `Create location "${search.trim()}"`}
        </button>
      )}
    </div>
  );

  return (
    <div ref={ref} className="relative" data-testid={testId}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={D ? { width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", fontSize: 13, background: "#141e17", border: `1px solid ${open ? "#2ddb6f" : "#203023"}`, borderRadius: open && !isMobile ? "10px 10px 0 0" : 10, color: selected ? "#c8deca" : "#2b3f2e", cursor: "pointer", textAlign: "left", minHeight: 42, boxShadow: "none", transition: "border-color 0.15s" } : undefined}
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
        isMobile ? (
          <>
            {/* Backdrop */}
            <div
              style={{ position: "fixed", inset: 0, zIndex: 9990, background: "rgba(0,0,0,0.72)" }}
              onMouseDown={handleClose}
            />
            {/* Bottom sheet */}
            <div
              ref={dropdownRef}
              style={{
                position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9991,
                background: D ? "#0d1410" : "#ffffff",
                borderTop: `2px solid ${D ? "#2ddb6f" : "#e2e8f0"}`,
                borderRadius: "18px 18px 0 0",
                boxShadow: "0 -8px 40px rgba(0,0,0,0.72)",
                display: "flex", flexDirection: "column",
                maxHeight: "72vh",
              }}
            >
              {/* Search header */}
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "14px 16px 10px",
                borderBottom: `1px solid ${D ? "#1e2e21" : "#e2e8f0"}`,
                flexShrink: 0,
              }}>
                <Search style={{ width: 15, height: 15, color: D ? "#527856" : "#94a3b8", flexShrink: 0 }} />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder={placeholder}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{
                    flex: 1, fontSize: 14, outline: "none",
                    background: "transparent",
                    color: D ? "#c8deca" : "#0f172a",
                    border: "none", minWidth: 0,
                  }}
                  data-testid={`${testId}-search`}
                />
                {search && (
                  <button
                    type="button"
                    onMouseDown={e => { e.stopPropagation(); setSearch(""); inputRef.current?.focus(); }}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: D ? "#527856" : "#94a3b8" }}
                  >
                    <X style={{ width: 14, height: 14 }} />
                  </button>
                )}
                <button
                  type="button"
                  onMouseDown={handleClose}
                  style={{
                    background: "none", border: `1px solid ${D ? "#2a4030" : "#cbd5e1"}`,
                    cursor: "pointer", color: D ? "#7aab82" : "#475569",
                    padding: "4px 10px", borderRadius: 7,
                    fontSize: 13, fontWeight: 600,
                    fontFamily: "'Barlow Condensed', sans-serif",
                    flexShrink: 0,
                  }}
                  data-testid={`${testId}-close`}
                >
                  Done
                </button>
              </div>
              {/* Results */}
              {resultList({ flex: 1, WebkitOverflowScrolling: "touch" as any })}
            </div>
          </>
        ) : (
          /* Desktop: fixed dropdown below trigger */
          <div
            ref={dropdownRef}
            style={D ? {
              position: "fixed", top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width,
              zIndex: 9999, background: "#0f1612", border: "1px solid #2ddb6f",
              borderTop: "none", borderRadius: "0 0 10px 10px",
              boxShadow: "0 10px 28px rgba(0,0,0,0.6)", overflow: "hidden",
              maxHeight: 260,
            } : {
              position: "fixed", top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width,
              zIndex: 9999,
            }}
            className={D ? undefined : "bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden max-h-60"}
          >
            {/* Search bar */}
            <div style={D ? { padding: "8px 12px", borderBottom: "1px solid #203023", display: "flex", alignItems: "center", gap: 8, background: "#0f1612" } : undefined} className={D ? undefined : "p-2 border-b border-slate-100 flex items-center gap-2 bg-slate-50/80"}>
              <Search style={{ width: 13, height: 13, color: D ? "#527856" : undefined, flexShrink: 0 }} className={D ? undefined : "w-4 h-4 text-slate-400 shrink-0"} />
              <input
                ref={inputRef}
                type="text"
                placeholder="Type to filter or create…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={D ? { flex: 1, fontSize: 13, outline: "none", background: "transparent", color: "#c8deca", border: "none" } : undefined}
                className={D ? undefined : "flex-1 text-sm outline-none bg-transparent text-slate-900 placeholder:text-slate-400"}
                data-testid={`${testId}-search`}
              />
              {search && (
                <button type="button" onClick={() => setSearch("")} className="p-0.5">
                  <X style={{ width: 13, height: 13, color: D ? "#527856" : undefined }} className={D ? undefined : "w-3.5 h-3.5 text-slate-400 hover:text-slate-600"} />
                </button>
              )}
            </div>
            {resultList({ maxHeight: 200, overflowY: "auto" })}
          </div>
        ),
        document.body
      )}
    </div>
  );
}
