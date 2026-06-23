import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Search, X, ChevronDown, Plus } from "lucide-react";
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

export function SearchableProjectSelect({
  value,
  onChange,
  projects,
  hideCreate = false,
  dark = false,
  placeholder,
}: {
  value?: number | null;
  onChange: (id: number | undefined) => void;
  projects: any[];
  hideCreate?: boolean;
  dark?: boolean;
  placeholder?: string;
}) {
  const { t } = useLanguage();
  const { F } = useFieldTheme();
  placeholder = placeholder ?? t.movSearchProjPlaceholder;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const isMobile = useIsMobileInline();

  const ONGOING = new Set(["active", "working on it", "in progress", "start soon", "stuck"]);
  const [showAll, setShowAll] = useState(false);

  const allProjects = (projects || []);
  const ongoingProjects = allProjects.filter(p => ONGOING.has((p.status || "").toLowerCase()));
  const inactiveProjects = allProjects.filter(p => !ONGOING.has((p.status || "").toLowerCase()));
  const visiblePool = showAll ? allProjects : ongoingProjects;
  const selected = allProjects.find(p => p.id === value);

  function label(p: any) {
    return p.poNumber ? `${p.poNumber} — ${p.name}` : p.name;
  }

  const filtered = search.trim()
    ? visiblePool.filter(p => {
        const q = search.toLowerCase();
        return p.name?.toLowerCase().includes(q) || p.poNumber?.toLowerCase().includes(q);
      })
    : visiblePool;

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
  }, [open, isMobile]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 60);
  }, [open]);

  function handleClose() {
    setOpen(false);
    setSearch("");
  }

  const D = dark;

  const projectList = (listStyle: React.CSSProperties = {}) => (
    <div style={{ overflowY: "auto", ...listStyle }}>
      {value != null && (
        <button
          type="button"
          onClick={() => { onChange(undefined); setSearch(""); setOpen(false); }}
          style={D ? { width: "100%", textAlign: "left", padding: "8px 12px", fontSize: 12, color: F.textMuted, background: "none", border: "none", borderBottom: `1px solid ${F.borderStrong}`, cursor: "pointer", fontStyle: "italic" } : undefined}
          className={D ? undefined : "w-full text-left px-3 py-2 text-xs text-slate-400 hover:bg-slate-50 italic border-b border-slate-100"}
          data-testid="project-clear"
        >
          {t.movSearchProjClear}
        </button>
      )}
      {filtered.map(p => (
        <button
          key={p.id}
          type="button"
          onClick={() => { onChange(p.id); setSearch(""); setOpen(false); }}
          style={D ? { width: "100%", textAlign: "left", padding: "9px 12px", fontSize: 13, color: p.id === value ? F.accent : F.text, fontWeight: p.id === value ? 600 : 400, background: p.id === value ? F.surface : "transparent", border: "none", cursor: "pointer", display: "block" } : undefined}
          className={D ? undefined : `w-full text-left px-3 py-2 text-sm hover:bg-brand-50 transition-colors ${p.id === value ? "bg-brand-50 font-medium" : "text-slate-800"}`}
          data-testid={`project-option-${p.id}`}
          onMouseEnter={D ? e => { (e.currentTarget as HTMLButtonElement).style.background = F.surface; } : undefined}
          onMouseLeave={D ? e => { (e.currentTarget as HTMLButtonElement).style.background = p.id === value ? F.surface : "transparent"; } : undefined}
        >
          {p.poNumber && (
            <span style={D ? { color: F.textMuted, fontSize: 11, marginRight: 6, fontFamily: "monospace" } : undefined} className={D ? undefined : "font-mono text-xs text-slate-500 mr-1.5"}>{p.poNumber} —</span>
          )}
          {p.name}
        </button>
      ))}
      {filtered.length === 0 && (
        <p style={D ? { textAlign: "center", fontSize: 12, color: F.textMuted, padding: "12px 0" } : undefined} className={D ? undefined : "text-center text-sm text-slate-400 py-3"}>{t.movSearchProjNone}</p>
      )}
      {inactiveProjects.length > 0 && (
        <div
          style={D ? { borderTop: `1px solid ${F.borderStrong}`, padding: "6px 12px" } : undefined}
          className={D ? undefined : "border-t border-slate-100 px-3 py-1.5"}
        >
          <button
            type="button"
            onClick={() => setShowAll(v => !v)}
            style={D ? { display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: F.textMuted, background: "none", border: "none", cursor: "pointer", width: "100%", textAlign: "left" } : undefined}
            className={D ? undefined : "flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 w-full"}
            data-testid="project-toggle-inactive"
          >
            <span style={D ? { fontSize: 10 } : undefined} className={D ? undefined : "text-[10px]"}>
              {showAll ? "▲" : "▼"}
            </span>
            {showAll ? t.projOngoingOnly : `${t.projInactiveLabel} (${inactiveProjects.length})`}
          </button>
        </div>
      )}
      {!hideCreate && (
        <div style={D ? { borderTop: `1px solid ${F.borderStrong}`, padding: "8px 12px" } : undefined} className={D ? undefined : "border-t border-slate-100 px-3 py-2"}>
          <a
            href="/projects"
            onClick={() => setOpen(false)}
            style={D ? { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: F.accent, fontWeight: 500, textDecoration: "none" } : undefined}
            className={D ? undefined : "flex items-center gap-1.5 text-xs text-brand-700 hover:text-brand-800 font-medium"}
            data-testid="project-create-link"
          >
            <Plus style={{ width: 12, height: 12 }} className={D ? undefined : "w-3 h-3"} />
            {t.movSearchProjCreate}
          </a>
        </div>
      )}
    </div>
  );

  return (
    <div ref={ref} className="relative" data-testid="project-select">
      <div
        onClick={() => { if (!open) { setOpen(true); setSearch(""); } }}
        style={D ? { width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", fontSize: 13, background: F.surface, border: `1px solid ${open ? F.accent : F.borderStrong}`, borderRadius: 10, color: selected ? F.text : F.textDim, cursor: "pointer", textAlign: "left", minHeight: 42, boxShadow: open && !isMobile ? `0 0 0 3px ${F.accentBg}` : "none", transition: "border-color 0.15s" } : undefined}
        className={D ? undefined : `w-full flex items-center px-3 py-2 text-sm border border-input rounded-md bg-background cursor-pointer text-left min-h-[38px] ${open ? "ring-2 ring-ring" : "hover:bg-slate-50"}`}
        data-testid="project-select-trigger"
      >
        {open && !isMobile ? (
          <>
            <Search style={{ width: 13, height: 13, color: D ? F.textMuted : undefined, flexShrink: 0 }} className={D ? undefined : "w-4 h-4 text-slate-400 shrink-0"} />
            <input
              ref={inputRef}
              type="text"
              placeholder={t.movSearchProjSearchPh}
              value={search}
              onChange={e => setSearch(e.target.value)}
              onClick={e => e.stopPropagation()}
              style={D ? { flex: 1, fontSize: 13, outline: "none", background: "transparent", color: F.text, border: "none", marginLeft: 6 } : undefined}
              className={D ? undefined : "flex-1 py-1 mx-2 text-sm outline-none bg-transparent text-slate-900 placeholder:text-slate-400"}
              data-testid="project-search-input"
            />
            {search && (
              <button type="button" onClick={e => { e.stopPropagation(); setSearch(""); inputRef.current?.focus(); }} className="p-0.5">
                <X style={{ width: 13, height: 13, color: D ? F.textMuted : undefined }} className={D ? undefined : "w-3.5 h-3.5 text-slate-400 hover:text-slate-600"} />
              </button>
            )}
          </>
        ) : selected ? (
          <>
            <span style={D ? { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 } : undefined} className={D ? undefined : "truncate text-slate-900 flex-1"}>{label(selected)}</span>
            <ChevronDown style={{ width: 14, height: 14, color: D ? F.textMuted : undefined, flexShrink: 0, marginLeft: 8 }} className={D ? undefined : "w-4 h-4 text-slate-400 shrink-0 ml-2"} />
          </>
        ) : (
          <>
            <span style={D ? { color: F.textDim, flex: 1 } : undefined} className={D ? undefined : "text-muted-foreground flex-1"}>{placeholder}</span>
            <ChevronDown style={{ width: 14, height: 14, color: D ? F.textMuted : undefined, flexShrink: 0, marginLeft: 8 }} className={D ? undefined : "w-4 h-4 text-slate-400 shrink-0 ml-2"} />
          </>
        )}
      </div>

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
              {/* Search header */}
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
                  placeholder={t.movSearchProjSearchPh}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{
                    flex: 1, fontSize: 14, outline: "none",
                    background: "transparent",
                    color: D ? F.text : "#0f172a",
                    border: "none", minWidth: 0,
                  }}
                  data-testid="project-search-input"
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
                  data-testid="project-picker-close"
                >
                  {t.movSearchProjDone}
                </button>
              </div>
              {/* Results */}
              {projectList({ flex: 1, minHeight: 0, WebkitOverflowScrolling: "touch" as any })}
            </div>
          </>
        ) : (
          /* Desktop: fixed-position dropdown */
          <div
            ref={dropdownRef}
            style={D ? {
              position: "fixed", top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width,
              zIndex: 9999, background: F.bg, border: `1px solid ${F.borderStrong}`,
              borderRadius: 10, boxShadow: "0 12px 32px rgba(0,0,0,0.6)", overflow: "hidden",
              maxHeight: 240,
            } : {
              position: "fixed", top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width,
              zIndex: 9999,
            }}
            className={D ? undefined : "bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden"}
          >
            {projectList({ maxHeight: 240, overflowY: "auto" })}
          </div>
        ),
        document.body
      )}
    </div>
  );
}
