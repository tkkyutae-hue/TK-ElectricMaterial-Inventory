import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Search, X, ChevronDown, ImageOff } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";
import { useFieldTheme } from "@/hooks/use-field-theme";

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

export function SearchableItemSelect({
  value, onChange, items, dark = false, isLoading = false, errorMessage = null,
  searchPlaceholder,
  loadingText,
  noResultsText,
  closeText,
}: {
  value?: number | null;
  onChange: (id: number) => void;
  items: any[];
  dark?: boolean;
  isLoading?: boolean;
  errorMessage?: string | null;
  searchPlaceholder?: string;
  loadingText?: string;
  noResultsText?: string;
  closeText?: string;
}) {
  const { t } = useLanguage();
  const { F } = useFieldTheme();
  searchPlaceholder = searchPlaceholder ?? t.movSearchItemPlaceholder;
  loadingText = loadingText ?? t.movSearchItemLoading;
  noResultsText = noResultsText ?? t.movSearchItemNoResults;
  closeText = closeText ?? t.movSearchItemDone;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const isMobile = useIsMobileInline();

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
      if (isMobile) return;
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
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  function handleOpen() {
    setOpen(true);
    setSearch("");
  }

  function handleClose() {
    setOpen(false);
    setSearch("");
  }

  function handleSelect(id: number) {
    onChange(id);
    setOpen(false);
    setSearch("");
  }

  const D = dark;

  const maxDropdownH = typeof window !== "undefined"
    ? Math.min(264, window.innerHeight - dropdownPos.top - 24)
    : 264;

  // Field Mode column widths (px) — shared between header and rows
  const COL = { sku: 58, brand: 74, photo: 44, size: 54, qty: 66 } as const;

  const HDR: React.CSSProperties = {
    fontSize: 9, fontWeight: 700, color: F.textDim,
    textTransform: "uppercase", letterSpacing: 1,
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
    flexShrink: 0,
  };

  const itemList = (listStyle: React.CSSProperties = {}) => (
    <div style={{ overflowY: "auto", ...listStyle }}>

      {/* ── Field Mode column header ── */}
      {D && !isLoading && !errorMessage && filtered.length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "5px 12px",
          borderBottom: `1px solid ${F.borderStrong}`,
          background: F.surface,
          position: "sticky", top: 0, zIndex: 1,
          flexShrink: 0,
        }}>
          <span style={{ ...HDR, width: COL.sku, fontFamily: "monospace" }}>{t.colSku}</span>
          <span style={{ ...HDR, width: COL.brand }}>{t.colBrand}</span>
          <span style={{ ...HDR, width: COL.photo, textAlign: "center" }}>{t.invPhotoCol}</span>
          <span style={{ ...HDR, width: COL.size }}>{t.invSizeCol}</span>
          <span style={{ ...HDR, flex: 1, minWidth: 0 }}>{t.colItem}</span>
          <span style={{ ...HDR, width: COL.qty, textAlign: "right" }}>{t.colStock}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-11">
          <p style={D ? { fontSize: 12, color: F.textMuted } : undefined}
            className={D ? undefined : "text-sm text-slate-400"}>{loadingText}</p>
        </div>
      ) : errorMessage ? (
        <div className="flex items-center justify-center h-11">
          <p style={D ? { fontSize: 12, color: F.danger } : undefined}
            className={D ? undefined : "text-sm text-red-500"}>{errorMessage}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex items-center justify-center h-11">
          <p style={D ? { fontSize: 12, color: F.textMuted } : undefined}
            className={D ? undefined : "text-sm text-slate-400"}>{noResultsText}</p>
        </div>
      ) : (
        filtered.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => handleSelect(item.id)}
            style={D ? {
              height: 40, width: "100%", display: "flex", alignItems: "center", gap: 8,
              padding: "0 12px", textAlign: "left", background: item.id === value ? F.surface : "transparent",
              borderBottom: `1px solid ${F.border}`, cursor: "pointer", border: "none",
              flexShrink: 0,
            } : { height: "44px", minHeight: "44px" }}
            className={D ? undefined : `w-full flex items-center gap-2 px-3 text-left hover:bg-brand-50 transition-colors border-b border-slate-50 last:border-0 ${item.id === value ? "bg-brand-50" : ""}`}
            data-testid={`item-option-${item.id}`}
            onMouseEnter={D ? e => { (e.currentTarget as HTMLButtonElement).style.background = F.surface; } : undefined}
            onMouseLeave={D ? e => { (e.currentTarget as HTMLButtonElement).style.background = item.id === value ? F.surface : "transparent"; } : undefined}
          >
            {/* SKU */}
            <span style={D ? { color: F.textMuted, fontSize: 11, width: COL.sku, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace" } : undefined}
              className={D ? undefined : "font-mono text-xs text-slate-400 w-16 shrink-0 truncate"}>{item.sku}</span>

            {/* Brand — Field Mode: bold text column; Admin Mode: handled inside name div below */}
            {D && (
              <span style={{ width: COL.brand, flexShrink: 0, fontSize: 11, fontWeight: 700, color: item.manufacturer?.trim() ? F.accent : "transparent", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.manufacturer?.trim() || "·"}
              </span>
            )}

            {/* Photo */}
            <span style={D ? { width: COL.photo, height: COL.photo, flexShrink: 0, borderRadius: 5, overflow: "hidden", border: `1px solid ${F.borderStrong}`, background: F.surface, display: "flex", alignItems: "center", justifyContent: "center" } : undefined}
              className={D ? undefined : "w-8 h-8 shrink-0 rounded overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center"}>
              {item.imageUrl ? (
                <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <ImageOff style={{ width: 13, height: 13, color: D ? F.textDim : undefined }}
                  className={D ? undefined : "w-4 h-4 text-slate-300"} />
              )}
            </span>

            {/* Size — Field Mode: fixed column after Photo; Admin Mode: inside name div below */}
            {D && (
              <span style={{ width: COL.size, flexShrink: 0, fontSize: 11, color: F.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.sizeLabel || ""}
              </span>
            )}

            {/* Name */}
            {D ? (
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, color: item.id === value ? F.accent : F.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.name}
              </span>
            ) : (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate leading-tight">
                  {item.manufacturer?.trim() && (
                    <span className="inline-block text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 mr-1.5 align-middle leading-relaxed">{item.manufacturer.trim()}</span>
                  )}
                  {item.name}
                </p>
                {item.sizeLabel && (
                  <p className="text-xs text-slate-400 leading-tight">{item.sizeLabel}</p>
                )}
              </div>
            )}

            {/* Qty */}
            <span style={D ? { fontSize: 11, color: F.textMuted, flexShrink: 0, whiteSpace: "nowrap", width: COL.qty, textAlign: "right" } : undefined}
              className={D ? undefined : "text-xs text-slate-400 shrink-0 whitespace-nowrap"}>{item.quantityOnHand} {item.unitOfMeasure}</span>
          </button>
        ))
      )}
    </div>
  );

  return (
    <div ref={ref} className="relative" data-testid="searchable-item-select">

      {/* ── Trigger ── */}
      <div
        style={D ? {
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 14px", fontSize: 13, minHeight: 42, cursor: "pointer",
          background: F.surface,
          border: `1px solid ${open && !isMobile ? F.accent : open && isMobile ? F.accent : F.borderStrong}`,
          borderRadius: open && !isMobile ? "10px 10px 0 0" : 10,
          boxShadow: "none",
          transition: "border-color 0.15s",
          color: F.text,
        } : undefined}
        className={D ? undefined : `w-full flex items-center justify-between px-3 text-sm border rounded-md bg-background min-h-[42px] cursor-pointer transition-colors ${
          open ? "border-brand-400 ring-1 ring-brand-300 bg-white" : "border-input hover:bg-slate-50"
        }`}
        onClick={() => { if (!open) handleOpen(); }}
        data-testid="item-select-trigger"
      >
        {selected ? (
          <>
            <span className="flex items-center gap-2.5 min-w-0 flex-1 py-1">
              <span style={D ? { color: F.textMuted, fontSize: 11, flexShrink: 0, width: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace" } : undefined}
                className={D ? undefined : "font-mono text-xs text-slate-400 shrink-0 w-20 truncate"}>{selected.sku}</span>
              <span style={D ? { width: 28, height: 28, flexShrink: 0, borderRadius: 6, overflow: "hidden", border: `1px solid ${F.borderStrong}`, background: F.bg, display: "flex", alignItems: "center", justifyContent: "center" } : undefined}
                className={D ? undefined : "w-8 h-8 shrink-0 rounded overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center"}>
                {selected.imageUrl ? (
                  <img src={selected.imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImageOff style={{ width: 13, height: 13, color: D ? F.textDim : undefined }}
                    className={D ? undefined : "w-4 h-4 text-slate-300"} />
                )}
              </span>
              <span style={D ? { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: F.text, fontSize: 13, display: "flex", alignItems: "center", gap: 0 } : undefined}
                className={D ? undefined : "truncate text-slate-900 text-sm flex items-center"}>
                {selected.manufacturer?.trim() && (
                  D ? (
                    <span style={{ fontWeight: 700, color: F.accent, fontSize: 12, flexShrink: 0, marginRight: 6, whiteSpace: "nowrap" }}>{selected.manufacturer.trim()}</span>
                  ) : (
                    <span className="inline-block text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 mr-1.5 shrink-0 leading-relaxed">{selected.manufacturer.trim()}</span>
                  )
                )}
                {selected.name}
              </span>
            </span>
            <ChevronDown style={{ width: 14, height: 14, color: D ? F.textMuted : undefined, flexShrink: 0, marginLeft: 8 }}
              className={D ? undefined : "w-4 h-4 text-slate-400 shrink-0 ml-2"} />
          </>
        ) : open && !isMobile ? (
          /* When open on desktop: trigger becomes the search input */
          <>
            <Search style={{ width: 13, height: 13, color: D ? F.textMuted : undefined, flexShrink: 0 }}
              className={D ? undefined : "w-4 h-4 text-slate-400 shrink-0"} />
            <input
              ref={inputRef}
              type="text"
              placeholder={searchPlaceholder}
              value={search}
              onChange={e => setSearch(e.target.value)}
              onClick={e => e.stopPropagation()}
              style={D ? { flex: 1, fontSize: 13, outline: "none", background: "transparent", color: F.text, border: "none", marginLeft: 6 } : undefined}
              className={D ? undefined : "flex-1 py-1 mx-2 text-sm outline-none bg-transparent text-slate-900 placeholder:text-slate-400"}
              data-testid="item-search-input"
            />
            {search && (
              <button type="button" onClick={e => { e.stopPropagation(); setSearch(""); inputRef.current?.focus(); }} className="p-0.5">
                <X style={{ width: 13, height: 13, color: D ? F.textMuted : undefined }}
                  className={D ? undefined : "w-3.5 h-3.5 text-slate-400 hover:text-slate-600"} />
              </button>
            )}
          </>
        ) : (
          <>
            <span style={D ? { color: F.textDim, paddingTop: 10, paddingBottom: 10, flex: 1, fontSize: 13 } : undefined}
              className={D ? undefined : "text-muted-foreground py-2 flex-1 text-sm"}>{searchPlaceholder}</span>
            <ChevronDown style={{ width: 14, height: 14, color: D ? F.textMuted : undefined, flexShrink: 0, marginLeft: 8 }}
              className={D ? undefined : "w-4 h-4 text-slate-400 shrink-0 ml-2"} />
          </>
        )}
      </div>

      {/* ── Dropdown / Bottom Sheet ── */}
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
                background: D ? F.bg : "#ffffff",
                borderTop: `2px solid ${D ? F.accent : "#e2e8f0"}`,
                borderRadius: "18px 18px 0 0",
                boxShadow: "0 -8px 40px rgba(0,0,0,0.72)",
                display: "flex", flexDirection: "column",
                maxHeight: "72vh", minHeight: "44vh",
              }}
            >
              {/* Sheet header — search + close */}
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "14px 16px 10px",
                borderBottom: `1px solid ${D ? F.border : "#e2e8f0"}`,
                flexShrink: 0,
              }}>
                <Search style={{ width: 15, height: 15, color: D ? F.textMuted : "#94a3b8", flexShrink: 0 }} />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder={searchPlaceholder}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{
                    flex: 1, fontSize: 14, outline: "none",
                    background: "transparent",
                    color: D ? F.text : "#0f172a",
                    border: "none", minWidth: 0,
                  }}
                  data-testid="item-search-input"
                />
                {search && (
                  <button
                    type="button"
                    onMouseDown={e => { e.stopPropagation(); setSearch(""); inputRef.current?.focus(); }}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: D ? F.textMuted : "#94a3b8" }}
                  >
                    <X style={{ width: 14, height: 14 }} />
                  </button>
                )}
                <button
                  type="button"
                  onMouseDown={handleClose}
                  style={{
                    background: "none", border: `1px solid ${D ? F.borderStrong : "#cbd5e1"}`,
                    cursor: "pointer", color: D ? F.textMuted : "#475569",
                    padding: "4px 10px", borderRadius: 7,
                    fontSize: 13, fontWeight: 600,
                    fontFamily: "'Barlow Condensed', sans-serif",
                    flexShrink: 0,
                  }}
                  data-testid="item-picker-close"
                >
                  {closeText}
                </button>
              </div>
              {/* Results */}
              {itemList({ flex: 1, minHeight: 0, WebkitOverflowScrolling: "touch" as any })}
            </div>
          </>
        ) : (
          /* Desktop: fixed-position dropdown below trigger */
          <div
            ref={dropdownRef}
            style={D ? {
              position: "fixed", top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width,
              zIndex: 9999, background: F.bg, border: `1px solid ${F.accent}`,
              borderTop: "none", borderRadius: "0 0 10px 10px",
              boxShadow: "0 10px 28px rgba(0,0,0,0.6)", overflow: "hidden",
              maxHeight: `${maxDropdownH}px`,
            } : {
              position: "fixed", top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width,
              zIndex: 9999, maxHeight: `${maxDropdownH}px`,
            }}
            className={D ? undefined : "bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden"}
          >
            {/* Search bar — only shown when an item is already selected so user can search to replace it */}
            {selected && (
              <div style={D ? { display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: `1px solid ${F.borderStrong}` } : undefined}
                className={D ? undefined : "flex items-center gap-2 px-3 py-2 border-b border-slate-100"}>
                <Search style={{ width: 13, height: 13, color: D ? F.textMuted : undefined, flexShrink: 0 }}
                  className={D ? undefined : "w-4 h-4 text-slate-400 shrink-0"} />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder={searchPlaceholder}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onClick={e => e.stopPropagation()}
                  style={D ? { flex: 1, fontSize: 13, outline: "none", background: "transparent", color: F.text, border: "none" } : undefined}
                  className={D ? undefined : "flex-1 py-1 text-sm outline-none bg-transparent text-slate-900 placeholder:text-slate-400"}
                  data-testid="item-search-input"
                />
                {search && (
                  <button type="button" onClick={e => { e.stopPropagation(); setSearch(""); inputRef.current?.focus(); }} className="p-0.5">
                    <X style={{ width: 13, height: 13, color: D ? F.textMuted : undefined }}
                      className={D ? undefined : "w-3.5 h-3.5 text-slate-400 hover:text-slate-600"} />
                  </button>
                )}
              </div>
            )}
            {itemList({ maxHeight: `${selected ? maxDropdownH - 42 : maxDropdownH}px` })}
          </div>
        ),
        document.body
      )}
    </div>
  );
}
