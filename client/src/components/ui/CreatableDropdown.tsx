import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Check, Plus, X } from "lucide-react";

interface CreatableDropdownProps {
  options: string[];
  value: string;
  onChange: (val: string) => void;
  onOptionsChange: (opts: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "data-testid"?: string;
}

export function CreatableDropdown({
  options,
  value,
  onChange,
  onOptionsChange,
  placeholder = "Select…",
  disabled = false,
  className = "",
  "data-testid": testId,
}: CreatableDropdownProps) {
  const [open, setOpen] = useState(false);
  const [addText, setAddText] = useState("");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [panelStyle, setPanelStyle] = useState<{ top: number; left: number; width: number }>({
    top: 0, left: 0, width: 180,
  });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setPanelStyle({
      top: r.bottom + 4,
      left: r.left,
      width: Math.max(r.width, 180),
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    setTimeout(() => addInputRef.current?.focus(), 50);

    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        !document.getElementById("creatable-portal")?.contains(target)
      ) {
        setOpen(false);
      }
    }

    function handleScroll() { updatePosition(); }
    function handleResize() { updatePosition(); }

    document.addEventListener("mousedown", handleClick);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [open, updatePosition]);

  function handleAdd() {
    const trimmed = addText.trim();
    if (!trimmed) return;
    if (!options.includes(trimmed)) {
      const next = [...options, trimmed];
      onOptionsChange(next);
      onChange(trimmed);
    } else {
      onChange(trimmed);
    }
    setAddText("");
  }

  function handleDelete(opt: string, e: React.MouseEvent) {
    e.stopPropagation();
    const next = options.filter((o) => o !== opt);
    onOptionsChange(next);
    if (value === opt) onChange("");
  }

  function handleSelect(opt: string) {
    onChange(opt === value ? "" : opt);
    setOpen(false);
  }

  function handleAddKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); handleAdd(); }
    if (e.key === "Escape") { setOpen(false); }
  }

  const displayValue = value || placeholder;
  const hasValue = Boolean(value);

  const panel = open ? createPortal(
    <div
      id="creatable-portal"
      style={{
        position: "fixed",
        top: panelStyle.top,
        left: panelStyle.left,
        minWidth: panelStyle.width,
        width: "max-content",
        maxWidth: 260,
        zIndex: 9999,
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 9,
        boxShadow: "0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)",
        overflow: "hidden",
      }}
      role="listbox"
    >
      {/* Add row at top */}
      <div className="flex items-center gap-1.5 px-2 pt-2 pb-1.5 border-b border-slate-100">
        <input
          ref={addInputRef}
          type="text"
          value={addText}
          onChange={(e) => setAddText(e.target.value)}
          onKeyDown={handleAddKeyDown}
          placeholder="Type to add new…"
          className="flex-1 text-xs h-6 px-2 border border-slate-200 rounded outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 bg-slate-50"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!addText.trim()}
          title="Add option"
          style={{
            width: 24, height: 24, borderRadius: 5,
            background: addText.trim() ? "#1a472a" : "#e2e8f0",
            border: "none", cursor: addText.trim() ? "pointer" : "default",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 0.15s",
            flexShrink: 0,
          }}
        >
          <Plus style={{ width: 13, height: 13, color: addText.trim() ? "#fff" : "#94a3b8", strokeWidth: 2.5 }} />
        </button>
      </div>

      {/* Options list */}
      <div ref={listRef} style={{ maxHeight: 200, overflowY: "auto" }}>
        {options.length === 0 ? (
          <p className="px-3 py-3 text-xs text-slate-400 italic text-center">
            No options — type above to add
          </p>
        ) : (
          options.map((opt, idx) => {
            const selected = opt === value;
            const hovered = hoverIdx === idx;
            return (
              <div
                key={opt}
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setHoverIdx(idx)}
                onMouseLeave={() => setHoverIdx(null)}
                onClick={() => handleSelect(opt)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 10px",
                  cursor: "pointer",
                  background: selected ? "#f0fdf4" : hovered ? "#f8fafc" : "transparent",
                  userSelect: "none",
                }}
              >
                <span style={{ width: 14, flexShrink: 0, display: "flex", alignItems: "center" }}>
                  {selected && (
                    <Check style={{ width: 12, height: 12, color: "#16a34a", strokeWidth: 2.5 }} />
                  )}
                </span>
                <span
                  style={{
                    flex: 1,
                    fontSize: 12,
                    color: selected ? "#15803d" : "#374151",
                    fontWeight: selected ? 600 : 400,
                  }}
                >
                  {opt}
                </span>
                <button
                  type="button"
                  onClick={(e) => handleDelete(opt, e)}
                  title="Remove option"
                  style={{
                    width: 18, height: 18, borderRadius: 4,
                    background: hovered ? "#fee2e2" : "transparent",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: hovered ? 1 : 0,
                    transition: "opacity 0.1s, background 0.1s",
                    flexShrink: 0,
                  }}
                >
                  <X style={{ width: 10, height: 10, color: "#f87171", strokeWidth: 2.5 }} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div
      ref={containerRef}
      className={`relative inline-block ${className}`}
      data-testid={testId}
    >
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`
          flex items-center justify-between w-full h-7 px-2.5 text-xs rounded border
          transition-colors select-none
          ${disabled ? "opacity-50 cursor-not-allowed bg-slate-50 border-slate-200" : "bg-white border-slate-200 hover:border-slate-400 cursor-pointer"}
          ${open ? "border-blue-400 ring-1 ring-blue-200" : ""}
          ${!hasValue ? "text-slate-400" : "text-slate-800"}
        `}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="truncate">{displayValue}</span>
        <svg
          className={`w-3 h-3 ml-1.5 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {panel}
    </div>
  );
}
