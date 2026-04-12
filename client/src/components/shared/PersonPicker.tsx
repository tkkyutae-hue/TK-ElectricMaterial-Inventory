/**
 * PersonPicker — shared manpower-based person selector
 *
 * Works in Field (dark) mode and Admin (light) mode.
 * On open: top suggestions (project-match → priority trade → alphabetical) shown
 *   first; full list scrollable below (no hard cap).
 * After selection: clicking anywhere on the field reopens the picker so the
 *   user can change their choice without having to clear first.
 * Supports typeahead search and an optional "Me" fallback for the current user.
 */

import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { User, X as XIcon, ChevronDown, Check } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";
import type { Worker } from "@shared/schema";
import { F } from "@/lib/fieldTokens";

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

// ── Constants ──────────────────────────────────────────────────────────────────

const FONT_COND = "'Barlow Condensed', sans-serif";

const PRIORITY_TRADES = [
  "foreman",
  "general foreman",
  "superintendent",
  "general superintendent",
  "project manager",
  "pm",
  "supervisor",
  "manager",
  "electrician foreman",
  "lead electrician",
];

function isPriorityTrade(trade?: string | null): boolean {
  if (!trade) return false;
  return PRIORITY_TRADES.includes(trade.toLowerCase().trim());
}

// ── Types ──────────────────────────────────────────────────────────────────────

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

// ── Component ──────────────────────────────────────────────────────────────────

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
  const isMobile = useIsMobileInline();

  const [inputVal, setInputVal]   = useState(value?.name ?? "");
  const [open, setOpen]           = useState(false);
  const [committed, setCommitted] = useState<PersonValue | null>(value);
  const [dropPos, setDropPos]     = useState({ top: 0, left: 0, width: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);
  const dropRef      = useRef<HTMLDivElement>(null);

  // Sync when parent clears / sets externally
  useEffect(() => {
    if (!value) {
      setInputVal("");
      setCommitted(null);
    } else if (value.name !== committed?.name) {
      setInputVal(value.name);
      setCommitted(value);
    }
  }, [value]);

  // Close on outside click — restores inputVal to committed name if applicable
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      const target = e.target as Node;
      const inContainer = containerRef.current?.contains(target);
      const inDrop = dropRef.current?.contains(target);
      if (!inContainer && !inDrop) {
        setOpen(false);
        if (committed) setInputVal(committed.name);
        else setInputVal("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, committed]);

  // Track dropdown position (for dark/field portal mode on desktop)
  useEffect(() => {
    if (!open || !dark || isMobile) return;
    function update() {
      if (!containerRef.current) return;
      const r = containerRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom + 4, left: r.left, width: r.width });
      if (dropRef.current) {
        dropRef.current.style.top = `${r.bottom + 4}px`;
        dropRef.current.style.left = `${r.left}px`;
        dropRef.current.style.width = `${r.width}px`;
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

  // ── Sorted suggestion list ────────────────────────────────────────────────────
  // Returns the FULL sorted list (no cap). The fixed max-height dropdown naturally
  // shows the top ≈5 rows first; the rest are reachable by scrolling.
  // Sorting: project-match → priority trade → alphabetical.
  // Typeahead filter applies only when the user is actively typing (no committed).
  const suggestions = useMemo<Worker[]>(() => {
    const active = workers.filter(w => w.isActive);
    const q = inputVal.trim().toLowerCase();

    // Filter when actively typing (committed is null in that state)
    let pool = active;
    if (q && !committed) {
      pool = active.filter(w => w.fullName.toLowerCase().includes(q));
    }

    return [...pool].sort((a, b) => {
      const aProject = !!(projectName && a.project?.toLowerCase() === projectName.toLowerCase());
      const bProject = !!(projectName && b.project?.toLowerCase() === projectName.toLowerCase());
      if (aProject && !bProject) return -1;
      if (!aProject && bProject) return 1;

      const aPri = isPriorityTrade(a.trade);
      const bPri = isPriorityTrade(b.trade);
      if (aPri && !bPri) return -1;
      if (!aPri && bPri) return 1;

      return a.fullName.localeCompare(b.fullName);
    });
  }, [workers, inputVal, committed, projectName]);

  function selectWorker(w: Worker) {
    const val: PersonValue = { name: w.fullName, role: w.trade ?? undefined };
    setCommitted(val);
    setInputVal(w.fullName);
    setOpen(false);
    onChange(val);
  }

  function clearSelection() {
    setCommitted(null);
    setInputVal("");
    onChange(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  // Open the picker — works whether or not a person is already selected
  function openPicker() {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  const isSelected  = !!committed;
  const isFiltering = !committed && inputVal.trim().length > 0;

  // Header label for the dropdown
  const headerLabel = isFiltering
    ? (tv.requesterSearchResults ?? "Search Results")
    : (tv.requesterSuggested ?? "Suggested");

  // ── Mode-aware styles ─────────────────────────────────────────────────────────

  const wrap: React.CSSProperties = dark
    ? {
        display: "flex", alignItems: "center",
        background: F.surface2,
        border: `1px solid ${open ? F.accentBorder : F.borderStrong}`,
        borderRadius: 8,
        boxShadow: open ? `0 0 0 3px ${F.accentBg}` : "none",
        transition: "border-color 0.12s, box-shadow 0.12s",
        overflow: "hidden",
        cursor: isSelected ? "pointer" : "default",
      }
    : {
        display: "flex", alignItems: "center",
        background: "#ffffff",
        border: `1px solid ${open ? "#6366f1" : "#e2e8f0"}`,
        borderRadius: 8,
        boxShadow: open ? "0 0 0 2px rgba(99,102,241,0.15)" : "none",
        transition: "border-color 0.12s, box-shadow 0.12s",
        overflow: "hidden",
        height: 40,
        cursor: isSelected ? "pointer" : "default",
      };

  // Light-mode dropdown stays absolute (admin panels have no overflow issues)
  const drop: React.CSSProperties = {
    position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 9,
    boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
    zIndex: 200,
    maxHeight: 224,
    overflowY: "auto",
  };

  const iconColor = dark
    ? (isSelected ? F.accent : F.textDim)
    : (isSelected ? "#6366f1" : "#94a3b8");

  const inputCss: React.CSSProperties = {
    flex: 1,
    background: "transparent",
    border: "none",
    outline: "none",
    color:      dark ? F.text    : "#0f172a",
    fontSize:   13,
    fontFamily: dark ? FONT_COND : undefined,
    fontWeight: isSelected ? 700 : 400,
    padding:    "9px 0",
    // Pointer cursor hints that clicking will open the picker when selected;
    // text cursor when the user is actively typing a search.
    cursor: isSelected ? "pointer" : "text",
  };

  const roleBadge: React.CSSProperties = {
    fontSize: 9, fontWeight: 800,
    color:       dark ? F.textMuted : "#64748b",
    fontFamily:  dark ? FONT_COND   : undefined,
    letterSpacing: "0.05em",
    background:  dark ? F.surface   : "#f1f5f9",
    border:      `1px solid ${dark ? F.borderStrong : "#e2e8f0"}`,
    borderRadius: 4, padding: "2px 6px",
    marginRight: 6, flexShrink: 0, whiteSpace: "nowrap",
  };

  const iconBtnCss: React.CSSProperties = {
    width: 28, height: 36, border: "none", background: "transparent",
    color:   dark ? F.textDim : "#94a3b8",
    cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  };

  const headerCss: React.CSSProperties = {
    padding: "6px 12px 4px",
    fontSize: 9, fontWeight: 800,
    color:      dark ? F.textDim : "#94a3b8",
    fontFamily: dark ? FONT_COND  : undefined,
    letterSpacing: "0.08em",
  };

  const emptyCss: React.CSSProperties = {
    padding: "14px", fontSize: 12, textAlign: "center",
    color:      dark ? F.textDim : "#94a3b8",
    fontFamily: dark ? FONT_COND  : undefined,
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }}>

      {/* ── Input row ── */}
      {/* Entire row is clickable to open/reopen the picker */}
      <div style={wrap} onClick={openPicker}>

        {/* Person icon */}
        <div style={{ padding: "0 8px", display: "flex", alignItems: "center", flexShrink: 0, pointerEvents: "none" }}>
          <User style={{ width: 13, height: 13, color: iconColor }} />
        </div>

        {/* Text input
            - When selected: pointer cursor, readOnly so accidental keystrokes don't wipe the name,
              but the wrapping div's onClick still opens the picker.
            - When typing: normal text input that filters the list. */}
        <input
          ref={inputRef}
          type="text"
          value={inputVal}
          placeholder={placeholder ?? tv.requesterSearchPlaceholder ?? "Search manpower…"}
          data-testid={testId}
          readOnly={isSelected}
          onClick={e => {
            // Prevent the div's onClick from double-firing focus issues;
            // the div handler already calls openPicker().
            e.stopPropagation();
            openPicker();
          }}
          onFocus={() => {
            if (!isSelected) setOpen(true);
          }}
          onChange={e => {
            // Typing clears the committed selection and enters search mode
            setInputVal(e.target.value);
            setCommitted(null);
            setOpen(true);
          }}
          style={inputCss}
        />

        {/* Role badge when a person is selected */}
        {isSelected && committed?.role && (
          <span style={roleBadge} onClick={e => { e.stopPropagation(); openPicker(); }}>
            {committed.role}
          </span>
        )}

        {/* Right-side controls */}
        {isSelected ? (
          <>
            {/* Clear selection */}
            <button
              type="button"
              onClick={e => { e.stopPropagation(); clearSelection(); }}
              data-testid={`${testId}-clear`}
              style={iconBtnCss}
            >
              <XIcon style={{ width: 12, height: 12 }} />
            </button>
            {/* Chevron — clicking opens the picker (div onClick handles it) */}
            <div style={{ ...iconBtnCss, pointerEvents: "none" }}>
              <ChevronDown style={{
                width: 13, height: 13,
                transform: open ? "rotate(180deg)" : "none",
                transition: "transform 0.15s",
              }} />
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setOpen(o => !o); inputRef.current?.focus(); }}
            style={iconBtnCss}
          >
            <ChevronDown style={{
              width: 13, height: 13,
              transform: open ? "rotate(180deg)" : "none",
              transition: "transform 0.15s",
            }} />
          </button>
        )}
      </div>

      {/* ── Dropdown ──
          Rendered whenever `open` is true, regardless of whether a person is
          already selected. The full sorted list is always shown; the fixed
          max-height lets the top ≈5 rows appear first and the rest scroll.
          Dark/Field mode: portal-based to escape overflow-hidden ancestors. */}
      {open && (() => {
        const listContent = (
          <>
            {suggestions.length === 0 ? (
              <div style={emptyCss}>
                {tv.requesterNoMatch ?? "No matching manpower found"}
              </div>
            ) : (
              <>
                <div style={headerCss}>{headerLabel.toUpperCase()}</div>
                {suggestions.map(w => {
                  const isCurrent = isSelected && committed?.name === w.fullName;
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={e => { e.stopPropagation(); selectWorker(w); }}
                      data-testid={`${testId}-option-${w.id}`}
                      style={{
                        width: "100%", padding: "9px 14px", textAlign: "left",
                        background: isCurrent
                          ? (dark ? F.accentBg : "rgba(99,102,241,0.06)")
                          : "transparent",
                        border: "none", cursor: "pointer",
                        display: "flex", alignItems: "center",
                        justifyContent: "space-between", gap: 8,
                        borderTop: `1px solid ${dark ? "rgba(42,64,48,0.4)" : "#f1f5f9"}`,
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={e => {
                        if (!isCurrent) e.currentTarget.style.background = dark ? F.surface : "#f8fafc";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = isCurrent
                          ? (dark ? F.accentBg : "rgba(99,102,241,0.06)")
                          : "transparent";
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{
                          fontSize: 13, fontWeight: 700, margin: 0,
                          color:      dark ? F.text : "#0f172a",
                          fontFamily: dark ? FONT_COND : undefined,
                          letterSpacing: dark ? "0.03em" : undefined,
                        }}>
                          {w.fullName}
                        </p>
                        {w.trade && (
                          <p style={{
                            fontSize: 10, margin: 0, marginTop: 1,
                            color: isPriorityTrade(w.trade)
                              ? (dark ? F.accent : "#6366f1")
                              : (dark ? F.textMuted : "#94a3b8"),
                            fontFamily: dark ? FONT_COND : undefined,
                          }}>
                            {w.trade}
                          </p>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                        {projectName && w.project?.toLowerCase() === projectName.toLowerCase() && (
                          <span style={{
                            fontSize: 9, fontWeight: 800,
                            color:       dark ? F.info : "#6366f1",
                            fontFamily:  dark ? FONT_COND : undefined,
                            background:  dark ? F.infoBg : "rgba(99,102,241,0.08)",
                            border:      `1px solid ${dark ? F.infoBorder : "rgba(99,102,241,0.25)"}`,
                            borderRadius: 4, padding: "2px 5px", letterSpacing: "0.05em",
                          }}>
                            {(tv.requesterThisProject ?? "THIS PROJECT").toUpperCase()}
                          </span>
                        )}
                        {isCurrent && (
                          <Check style={{ width: 13, height: 13, color: dark ? F.accent : "#6366f1", flexShrink: 0 }} />
                        )}
                      </div>
                    </button>
                  );
                })}
                {currentUserName
                  && !isSelected
                  && !isFiltering
                  && !suggestions.some(w => w.fullName.toLowerCase() === currentUserName.toLowerCase())
                  && (
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        const val: PersonValue = { name: currentUserName };
                        setCommitted(val);
                        setInputVal(currentUserName);
                        setOpen(false);
                        onChange(val);
                      }}
                      data-testid={`${testId}-option-self`}
                      style={{
                        width: "100%", padding: "9px 14px", textAlign: "left",
                        background: "transparent", border: "none", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 8,
                        borderTop: `1px solid ${dark ? "rgba(42,64,48,0.4)" : "#f1f5f9"}`,
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = dark ? F.surface : "#f8fafc")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <User style={{ width: 11, height: 11, color: dark ? F.textDim : "#94a3b8", flexShrink: 0 }} />
                      <p style={{
                        fontSize: 12, fontWeight: 600, margin: 0, fontStyle: "italic",
                        color:      dark ? F.textMuted : "#64748b",
                        fontFamily: dark ? FONT_COND : undefined,
                      }}>
                        {currentUserName} {tv.requesterMeSuffix ?? "(me)"}
                      </p>
                    </button>
                  )
                }
              </>
            )}
          </>
        );

        if (!dark) {
          // Light/admin mode: standard absolute dropdown, no portal needed
          return <div style={drop}>{listContent}</div>;
        }

        if (isMobile) {
          // Dark + mobile: bottom sheet portal
          return createPortal(
            <>
              <div
                style={{ position: "fixed", inset: 0, zIndex: 9990, background: "rgba(0,0,0,0.72)" }}
                onMouseDown={() => { setOpen(false); if (committed) setInputVal(committed.name); else setInputVal(""); }}
              />
              <div
                ref={dropRef}
                style={{
                  position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9991,
                  background: F.surface2,
                  borderTop: `2px solid ${F.accentBorder}`,
                  borderRadius: "18px 18px 0 0",
                  boxShadow: "0 -8px 40px rgba(0,0,0,0.72)",
                  maxHeight: "72vh",
                  overflowY: "auto",
                }}
              >
                <div style={{ padding: "10px 14px 6px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${F.borderStrong}`, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: F.textDim, fontFamily: FONT_COND, letterSpacing: "0.08em" }}>
                    {(tv.requesterSuggested ?? "MANPOWER").toUpperCase()}
                  </span>
                  <button
                    type="button"
                    onMouseDown={() => { setOpen(false); if (committed) setInputVal(committed.name); else setInputVal(""); }}
                    style={{ background: "none", border: `1px solid ${F.borderStrong}`, cursor: "pointer", color: F.textMuted, padding: "4px 10px", borderRadius: 7, fontSize: 13, fontWeight: 600, fontFamily: FONT_COND }}
                  >
                    Done
                  </button>
                </div>
                {listContent}
              </div>
            </>,
            document.body
          );
        }

        // Dark + desktop: fixed portal dropdown
        return createPortal(
          <div
            ref={dropRef}
            style={{
              position: "fixed",
              top: dropPos.top, left: dropPos.left, width: dropPos.width,
              zIndex: 9999,
              background: F.surface2,
              border: `1px solid ${F.borderStrong}`,
              borderRadius: 9,
              boxShadow: "0 8px 24px rgba(0,0,0,0.55)",
              maxHeight: 224,
              overflowY: "auto",
            }}
          >
            {listContent}
          </div>,
          document.body
        );
      })()}
    </div>
  );
}
