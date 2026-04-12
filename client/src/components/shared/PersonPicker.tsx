/**
 * PersonPicker — manpower-based person selector
 *
 * Style: clean sheet / dropdown panel.
 * – Search input + Done button live INSIDE the picker (not the trigger).
 * – List: project-match → priority trade → alphabetical, fully scrollable.
 * – Rows: name + role only — no heavy badges or section headers.
 * – Clicking the trigger always reopens (reopen-after-selection works).
 */

import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { User, X as XIcon, ChevronDown, Check, Search } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";
import type { Worker } from "@shared/schema";
import { F } from "@/lib/fieldTokens";

function useIsMobile() {
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

const FONT_COND = "'Barlow Condensed', sans-serif";

const PRIORITY_TRADES = [
  "foreman", "general foreman", "superintendent", "general superintendent",
  "project manager", "pm", "supervisor", "manager",
  "electrician foreman", "lead electrician",
];

function isPriorityTrade(trade?: string | null) {
  if (!trade) return false;
  return PRIORITY_TRADES.includes(trade.toLowerCase().trim());
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PersonValue {
  name: string;
  role?: string;
}

export interface PersonPickerProps {
  value: PersonValue | null;
  onChange: (v: PersonValue | null) => void;
  workers: Worker[];
  projectName?: string | null;
  currentUserName?: string | null;
  placeholder?: string;
  dark?: boolean;
  testId?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PersonPicker({
  value,
  onChange,
  workers,
  projectName,
  currentUserName,
  placeholder,
  dark = false,
  testId = "input-person-picker",
}: PersonPickerProps) {
  const { t } = useLanguage();
  const tv = t as any;
  const isMobile = useIsMobile();

  const [open, setOpen]       = useState(false);
  const [query, setQuery]     = useState("");
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });

  const triggerRef = useRef<HTMLDivElement>(null);
  const searchRef  = useRef<HTMLInputElement>(null);
  const dropRef    = useRef<HTMLDivElement>(null);

  // Focus search every time the picker opens (desktop only; mobile users tap to type)
  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => searchRef.current?.focus(), 80);
    }
  }, [open]);

  // Update anchor position for dark desktop portal
  useEffect(() => {
    if (!open || !dark || isMobile) return;
    function update() {
      if (!triggerRef.current) return;
      const r = triggerRef.current.getBoundingClientRect();
      const p = { top: r.bottom + 4, left: r.left, width: r.width };
      setDropPos(p);
      if (dropRef.current) {
        dropRef.current.style.top   = `${p.top}px`;
        dropRef.current.style.left  = `${p.left}px`;
        dropRef.current.style.width = `${p.width}px`;
      }
    }
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, dark, isMobile]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const tgt = e.target as Node;
      if (triggerRef.current?.contains(tgt)) return;
      if (dropRef.current?.contains(tgt)) return;
      closePicker();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // ── Sorted + filtered list ─────────────────────────────────────────────────
  // Sort: project-match first, then priority trades, then alphabetical.
  // Query filters when the user types in the search box.
  const list = useMemo<Worker[]>(() => {
    const active = workers.filter(w => w.isActive);
    const q = query.trim().toLowerCase();
    const pool = q ? active.filter(w => w.fullName.toLowerCase().includes(q)) : active;
    return [...pool].sort((a, b) => {
      const ap = !!(projectName && a.project?.toLowerCase() === projectName.toLowerCase());
      const bp = !!(projectName && b.project?.toLowerCase() === projectName.toLowerCase());
      if (ap && !bp) return -1;
      if (!ap && bp) return 1;
      const at = isPriorityTrade(a.trade);
      const bt = isPriorityTrade(b.trade);
      if (at && !bt) return -1;
      if (!at && bt) return 1;
      return a.fullName.localeCompare(b.fullName);
    });
  }, [workers, query, projectName]);

  // "Me" self-entry shown at the bottom when not searching and not in the list
  const showSelf =
    !query.trim() &&
    !!currentUserName &&
    !list.some(w => w.fullName.toLowerCase() === currentUserName.toLowerCase());

  function openPicker() { setOpen(true); }

  function closePicker() {
    setOpen(false);
    setQuery("");
  }

  function selectWorker(w: Worker) {
    onChange({ name: w.fullName, role: w.trade ?? undefined });
    closePicker();
  }

  function selectSelf() {
    if (!currentUserName) return;
    onChange({ name: currentUserName });
    closePicker();
  }

  function clearSelection(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(null);
  }

  const selected = !!value;
  const ph = placeholder ?? tv.requesterSearchPlaceholder ?? "Search manpower…";

  // ── Trigger ────────────────────────────────────────────────────────────────

  const triggerStyle: React.CSSProperties = dark
    ? {
        display: "flex", alignItems: "center",
        background: F.surface2,
        border: `1px solid ${open ? F.accentBorder : F.borderStrong}`,
        borderRadius: 8,
        boxShadow: open ? `0 0 0 3px ${F.accentBg}` : "none",
        transition: "border-color 0.12s, box-shadow 0.12s",
        overflow: "hidden", cursor: "pointer", userSelect: "none", minHeight: 38,
      }
    : {
        display: "flex", alignItems: "center",
        background: "#ffffff",
        border: `1px solid ${open ? "#6366f1" : "#e2e8f0"}`,
        borderRadius: 8,
        boxShadow: open ? "0 0 0 2px rgba(99,102,241,0.15)" : "none",
        transition: "border-color 0.12s, box-shadow 0.12s",
        overflow: "hidden", cursor: "pointer", userSelect: "none", height: 40,
      };

  const iconColor = dark
    ? (selected ? F.accent : F.textDim)
    : (selected ? "#6366f1" : "#94a3b8");

  // ── Row renderer (shared between mobile and desktop) ───────────────────────

  function renderRows(rowDark: boolean, rowFontSize: number) {
    if (list.length === 0 && !showSelf) {
      return (
        <div style={{
          padding: "16px 14px", textAlign: "center",
          fontSize: 12, color: rowDark ? F.textDim : "#94a3b8",
          fontFamily: rowDark ? FONT_COND : undefined,
        }}>
          {tv.requesterNoMatch ?? "No matching manpower found"}
        </div>
      );
    }
    return (
      <>
        {list.map(w => {
          const isCurrent = value?.name === w.fullName;
          return (
            <button
              key={w.id}
              type="button"
              onMouseDown={e => { e.preventDefault(); selectWorker(w); }}
              data-testid={`${testId}-option-${w.id}`}
              style={{
                width: "100%",
                padding: rowFontSize >= 14 ? "10px 16px" : "8px 14px",
                textAlign: "left",
                background: isCurrent
                  ? (rowDark ? F.accentBg : "rgba(99,102,241,0.06)")
                  : "transparent",
                border: "none", cursor: "pointer",
                display: "flex", alignItems: "center",
                justifyContent: "space-between", gap: 8,
                borderTop: `1px solid ${rowDark ? "rgba(42,64,48,0.35)" : "#f8fafc"}`,
              }}
              onMouseEnter={e => {
                if (!isCurrent)
                  e.currentTarget.style.background = rowDark ? F.surface : "#f8fafc";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = isCurrent
                  ? (rowDark ? F.accentBg : "rgba(99,102,241,0.06)")
                  : "transparent";
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{
                  fontSize: rowFontSize, fontWeight: 700, margin: 0,
                  color: rowDark ? F.text : "#0f172a",
                  fontFamily: rowDark ? FONT_COND : undefined,
                  letterSpacing: rowDark ? "0.03em" : undefined,
                }}>
                  {w.fullName}
                </p>
                {w.trade && (
                  <p style={{
                    fontSize: rowFontSize - 3, margin: 0, marginTop: 1,
                    color: rowDark ? F.textMuted : "#94a3b8",
                    fontFamily: rowDark ? FONT_COND : undefined,
                  }}>
                    {w.trade}
                  </p>
                )}
              </div>
              {isCurrent && (
                <Check style={{
                  width: rowFontSize, height: rowFontSize, flexShrink: 0,
                  color: rowDark ? F.accent : "#6366f1",
                }} />
              )}
            </button>
          );
        })}
        {showSelf && (
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); selectSelf(); }}
            data-testid={`${testId}-option-self`}
            style={{
              width: "100%",
              padding: rowFontSize >= 14 ? "10px 16px" : "8px 14px",
              textAlign: "left",
              background: "transparent", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8,
              borderTop: `1px solid ${rowDark ? "rgba(42,64,48,0.35)" : "#f8fafc"}`,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = rowDark ? F.surface : "#f8fafc")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <User style={{ width: 11, height: 11, color: rowDark ? F.textDim : "#94a3b8", flexShrink: 0 }} />
            <p style={{
              fontSize: rowFontSize - 1, fontWeight: 600, margin: 0, fontStyle: "italic",
              color: rowDark ? F.textMuted : "#64748b",
              fontFamily: rowDark ? FONT_COND : undefined,
            }}>
              {currentUserName} {tv.requesterMeSuffix ?? "(me)"}
            </p>
          </button>
        )}
      </>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div ref={triggerRef} style={{ position: "relative" }}>

      {/* Trigger / display field — clicking always opens the picker */}
      <div style={triggerStyle} onClick={openPicker} data-testid={testId}>
        <div style={{ padding: "0 8px", display: "flex", alignItems: "center", flexShrink: 0, pointerEvents: "none" }}>
          <User style={{ width: 13, height: 13, color: iconColor }} />
        </div>

        <span style={{
          flex: 1, fontSize: 13,
          fontFamily: dark ? FONT_COND : undefined,
          fontWeight: selected ? 700 : 400,
          color: selected
            ? (dark ? F.text : "#0f172a")
            : (dark ? F.textDim : "#94a3b8"),
          padding: "9px 0",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {value?.name || ph}
        </span>

        {selected && (
          <button
            type="button"
            onClick={clearSelection}
            data-testid={`${testId}-clear`}
            style={{
              width: 28, height: 36, border: "none", background: "transparent",
              color: dark ? F.textDim : "#94a3b8",
              cursor: "pointer", display: "flex", alignItems: "center",
              justifyContent: "center", flexShrink: 0,
            }}
          >
            <XIcon style={{ width: 12, height: 12 }} />
          </button>
        )}

        <div style={{
          width: 28, height: 36, display: "flex", alignItems: "center",
          justifyContent: "center", flexShrink: 0, pointerEvents: "none",
          color: dark ? F.textDim : "#94a3b8",
        }}>
          <ChevronDown style={{
            width: 13, height: 13,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.15s",
          }} />
        </div>
      </div>

      {/* ── Picker panel ── */}
      {open && (() => {

        // ── Light / admin: absolute dropdown ────────────────────────────────
        if (!dark) {
          return (
            <div ref={dropRef} style={{
              position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              boxShadow: "0 4px 20px rgba(0,0,0,0.10)",
              zIndex: 200,
              minHeight: 240, maxHeight: 300,
              display: "flex", flexDirection: "column",
              overflow: "hidden",
            }}>
              {/* Search row — flexShrink:0 keeps it fixed while list filters */}
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "9px 12px 8px",
                borderBottom: "1px solid #f1f5f9",
                flexShrink: 0,
              }}>
                <Search style={{ width: 13, height: 13, flexShrink: 0, color: "#94a3b8" }} />
                <input
                  ref={searchRef}
                  type="text"
                  inputMode="search"
                  autoComplete="off"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={ph}
                  data-testid={`${testId}-search`}
                  style={{
                    flex: 1, border: "none", outline: "none",
                    background: "transparent", fontSize: 13, color: "#0f172a",
                  }}
                />
                <button
                  type="button"
                  onMouseDown={e => { e.preventDefault(); closePicker(); }}
                  style={{
                    flexShrink: 0, background: "none",
                    border: "1px solid #e2e8f0", borderRadius: 6,
                    cursor: "pointer", color: "#64748b",
                    padding: "3px 10px", fontSize: 12, fontWeight: 600,
                  }}
                >
                  {tv.done ?? "Done"}
                </button>
              </div>
              {/* Scrollable list — minHeight:0 allows flex child to scroll */}
              <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
                {renderRows(false, 13)}
              </div>
            </div>
          );
        }

        // ── Dark + mobile: bottom sheet portal ───────────────────────────────
        if (isMobile) {
          return createPortal(
            <>
              <div
                style={{ position: "fixed", inset: 0, zIndex: 9990, background: "rgba(0,0,0,0.72)", cursor: "pointer" }}
                onMouseDown={() => closePicker()}
                onTouchEnd={e => { e.preventDefault(); closePicker(); }}
              />
              <div
                ref={dropRef}
                style={{
                  position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9991,
                  background: F.surface2,
                  borderTop: `2px solid ${F.accentBorder}`,
                  borderRadius: "18px 18px 0 0",
                  boxShadow: "0 -8px 40px rgba(0,0,0,0.72)",
                  minHeight: "44vh", maxHeight: "72vh",
                  display: "flex", flexDirection: "column",
                  overflow: "hidden",
                }}
              >
                {/* Search + Done — fixed at top */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "12px 14px 10px",
                  borderBottom: `1px solid ${F.borderStrong}`,
                  flexShrink: 0,
                }}>
                  <Search style={{ width: 14, height: 14, flexShrink: 0, color: F.textDim }} />
                  <input
                    ref={searchRef}
                    type="text"
                    inputMode="search"
                    autoComplete="off"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder={ph}
                    data-testid={`${testId}-search`}
                    style={{
                      flex: 1, border: "none", outline: "none",
                      background: "transparent",
                      fontSize: 15, fontFamily: FONT_COND, color: F.text,
                    }}
                  />
                  <button
                    type="button"
                    onMouseDown={e => { e.preventDefault(); closePicker(); }}
                    style={{
                      flexShrink: 0, background: "none",
                      border: `1px solid ${F.borderStrong}`,
                      borderRadius: 7, cursor: "pointer",
                      color: F.textMuted, padding: "5px 14px",
                      fontSize: 13, fontWeight: 700, fontFamily: FONT_COND,
                      letterSpacing: "0.04em",
                    }}
                  >
                    {tv.done ?? "Done"}
                  </button>
                </div>

                {/* Scrollable list — minHeight:0 allows flex child to scroll */}
                <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
                  {renderRows(true, 14)}
                </div>
              </div>
            </>,
            document.body
          );
        }

        // ── Dark + desktop: fixed portal dropdown ────────────────────────────
        return createPortal(
          <div
            ref={dropRef}
            style={{
              position: "fixed",
              top: dropPos.top, left: dropPos.left, width: dropPos.width,
              zIndex: 9999,
              background: F.surface2,
              border: `1px solid ${F.borderStrong}`,
              borderRadius: 10,
              boxShadow: "0 8px 28px rgba(0,0,0,0.55)",
              minHeight: 240, maxHeight: 300,
              display: "flex", flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Search + Done — fixed at top */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 12px 8px",
              borderBottom: `1px solid ${F.borderStrong}`,
              flexShrink: 0,
            }}>
              <Search style={{ width: 13, height: 13, flexShrink: 0, color: F.textDim }} />
              <input
                ref={searchRef}
                type="text"
                inputMode="search"
                autoComplete="off"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={ph}
                data-testid={`${testId}-search`}
                style={{
                  flex: 1, border: "none", outline: "none",
                  background: "transparent",
                  fontSize: 13, fontFamily: FONT_COND, color: F.text,
                }}
              />
              <button
                type="button"
                onMouseDown={e => { e.preventDefault(); closePicker(); }}
                style={{
                  flexShrink: 0, background: "none",
                  border: `1px solid ${F.borderStrong}`,
                  borderRadius: 6, cursor: "pointer",
                  color: F.textMuted, padding: "3px 10px",
                  fontSize: 12, fontWeight: 700, fontFamily: FONT_COND,
                  letterSpacing: "0.04em",
                }}
              >
                {tv.done ?? "Done"}
              </button>
            </div>

            {/* Scrollable list — minHeight:0 allows flex child to scroll */}
            <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
              {renderRows(true, 13)}
            </div>
          </div>,
          document.body
        );
      })()}
    </div>
  );
}
