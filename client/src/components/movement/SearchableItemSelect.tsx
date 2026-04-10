import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Search, X, ChevronDown, ImageOff } from "lucide-react";

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
