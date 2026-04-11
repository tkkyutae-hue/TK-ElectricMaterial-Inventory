/**
 * FieldCartReview.tsx
 *
 * Cart tab — shows items queued from fieldCart context.
 * "Submit Request" POSTs to /api/field/requests and clears the cart.
 * No inventory quantities change here.
 */
import { useState, useRef, useEffect, useMemo } from "react";
import {
  ShoppingCart, Trash2, Minus, Plus, Send,
  User, ChevronDown, X as XIcon, Check, ImageOff,
} from "lucide-react";
import { useFieldCart } from "@/lib/fieldCart";
import { useLanguage } from "@/hooks/use-language";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { F } from "@/lib/fieldTokens";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import type { Worker } from "@shared/schema";
import type { Project } from "@shared/schema";

// ── CartPhoto — compact 36×36 thumbnail with ImageOff fallback ───────────────

function CartPhoto({ imageUrl, name }: { imageUrl?: string | null; name: string }) {
  const base: React.CSSProperties = {
    width: 36, height: 36, borderRadius: 8, flexShrink: 0,
    background: F.surface2, display: "flex", alignItems: "center", justifyContent: "center",
  };
  if (!imageUrl) {
    return (
      <div style={base}>
        <ImageOff style={{ width: 15, height: 15, color: F.textDim }} />
      </div>
    );
  }
  return (
    <div style={{ ...base, overflow: "hidden", border: `1px solid ${F.borderStrong}` }}>
      <img
        src={imageUrl}
        alt={name}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
        onError={e => {
          e.currentTarget.style.display = "none";
          (e.currentTarget.parentElement as HTMLElement).innerHTML =
            `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${F.textDim}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="2" x2="22" y2="22"/><path d="M10.41 10.41a2 2 0 1 0 3.18 3.18"/><path d="M21 15V6a2 2 0 0 0-2-2H9"/><path d="M3 3H2a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h17"/></svg>`;
        }}
      />
    </div>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FONT_COND  = "'Barlow Condensed', sans-serif";
const FONT_BEBAS = "'Bebas Neue', sans-serif";

// Trades most likely to submit material requests — shown first in suggestions
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

// ── QtyButton helper ──────────────────────────────────────────────────────────

function QtyButton({
  onClick, children, disabled,
}: { onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 28, height: 28, borderRadius: 6,
        background: disabled ? F.surface2 : F.surface,
        border: `1px solid ${F.borderStrong}`,
        color: disabled ? F.textDim : F.text,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: disabled ? "default" : "pointer",
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

// ── RequesterPicker ───────────────────────────────────────────────────────────
// Typeahead search over active workers. Shows ~5 prioritised suggestions on open.

interface RequesterValue {
  name: string;
  role?: string;
}

interface RequesterPickerProps {
  value: RequesterValue | null;
  onChange: (v: RequesterValue | null) => void;
  workers: Worker[];
  projectName?: string | null;
  currentUserName?: string | null;
}

function RequesterPicker({
  value, onChange, workers, projectName, currentUserName,
}: RequesterPickerProps) {
  const { t }                     = useLanguage();
  const [inputVal, setInputVal]   = useState(value?.name ?? "");
  const [open, setOpen]           = useState(false);
  const [committed, setCommitted] = useState<RequesterValue | null>(value);
  const containerRef              = useRef<HTMLDivElement>(null);
  const inputRef                  = useRef<HTMLInputElement>(null);

  // Sync if parent resets
  useEffect(() => {
    if (!value) {
      setInputVal("");
      setCommitted(null);
    }
  }, [value]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        // If nothing committed, revert input
        if (!committed) setInputVal("");
        else setInputVal(committed.name);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, committed]);

  // Build top-5 priority list (active workers only)
  const suggestions = useMemo<Worker[]>(() => {
    const active = workers.filter(w => w.isActive);
    const q = inputVal.trim().toLowerCase();

    // Apply typeahead filter if user has typed something (and NOT yet committed)
    let pool = active;
    if (q && !committed) {
      pool = active.filter(w => w.fullName.toLowerCase().includes(q));
    }

    // Sort: project-match first, then priority trade, then alphabetical
    pool.sort((a, b) => {
      const aProject = projectName && a.project?.toLowerCase() === projectName.toLowerCase();
      const bProject = projectName && b.project?.toLowerCase() === projectName.toLowerCase();
      if (aProject && !bProject) return -1;
      if (!aProject && bProject) return 1;

      const aPriority = isPriorityTrade(a.trade);
      const bPriority = isPriorityTrade(b.trade);
      if (aPriority && !bPriority) return -1;
      if (!aPriority && bPriority) return 1;

      return a.fullName.localeCompare(b.fullName);
    });

    return pool.slice(0, 5);
  }, [workers, inputVal, committed, projectName]);

  function selectWorker(w: Worker) {
    const val: RequesterValue = { name: w.fullName, role: w.trade ?? undefined };
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

  const isSelected = !!committed;

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {/* Input row */}
      <div style={{
        display: "flex", alignItems: "center", gap: 0,
        background: F.surface2,
        border: `1px solid ${open ? F.accentBorder : F.borderStrong}`,
        borderRadius: 8,
        boxShadow: open ? `0 0 0 3px ${F.accentBg}` : "none",
        transition: "border-color 0.12s, box-shadow 0.12s",
        overflow: "hidden",
      }}>
        {/* Person icon */}
        <div style={{ padding: "0 8px", display: "flex", alignItems: "center", flexShrink: 0 }}>
          <User style={{ width: 13, height: 13, color: isSelected ? F.accent : F.textDim }} />
        </div>

        {/* Text input */}
        <input
          ref={inputRef}
          type="text"
          value={inputVal}
          placeholder={t.requesterSearchPlaceholder}
          data-testid="input-requester"
          readOnly={isSelected}
          onClick={() => {
            if (isSelected) return;
            setOpen(true);
          }}
          onFocus={() => {
            if (!isSelected) setOpen(true);
          }}
          onChange={e => {
            setInputVal(e.target.value);
            setCommitted(null);
            setOpen(true);
          }}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: isSelected ? F.text : F.text,
            fontSize: 13,
            fontFamily: FONT_COND,
            fontWeight: isSelected ? 700 : 400,
            padding: "9px 0",
            cursor: isSelected ? "default" : "text",
          }}
        />

        {/* Selected role badge */}
        {isSelected && committed?.role && (
          <span style={{
            fontSize: 9, fontWeight: 800, color: F.textMuted,
            fontFamily: FONT_COND, letterSpacing: "0.05em",
            background: F.surface, border: `1px solid ${F.borderStrong}`,
            borderRadius: 4, padding: "2px 6px", marginRight: 6, flexShrink: 0,
            whiteSpace: "nowrap",
          }}>
            {committed.role}
          </span>
        )}

        {/* Clear / chevron */}
        {isSelected ? (
          <button
            type="button"
            onClick={clearSelection}
            data-testid="btn-requester-clear"
            style={{
              width: 28, height: 36, border: "none", background: "transparent",
              color: F.textDim, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <XIcon style={{ width: 12, height: 12 }} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => { setOpen(o => !o); inputRef.current?.focus(); }}
            style={{
              width: 28, height: 36, border: "none", background: "transparent",
              color: F.textDim, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <ChevronDown style={{ width: 13, height: 13, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && !isSelected && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
          background: F.surface2,
          border: `1px solid ${F.borderStrong}`,
          borderRadius: 9,
          boxShadow: "0 8px 24px rgba(0,0,0,0.55)",
          zIndex: 200,
          overflow: "hidden",
        }}>
          {suggestions.length === 0 ? (
            <div style={{ padding: "14px 14px", fontSize: 12, color: F.textDim, fontFamily: FONT_COND, textAlign: "center" }}>
              {t.requesterNoMatch}
            </div>
          ) : (
            <>
              <div style={{ padding: "6px 12px 4px", fontSize: 9, fontWeight: 800, color: F.textDim, fontFamily: FONT_COND, letterSpacing: "0.08em" }}>
                {(inputVal.trim() ? t.requesterSearchResults : t.requesterSuggested).toUpperCase()}
              </div>
              {suggestions.map(w => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => selectWorker(w)}
                  data-testid={`requester-option-${w.id}`}
                  style={{
                    width: "100%", padding: "9px 14px", textAlign: "left",
                    background: "transparent", border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                    borderTop: "1px solid rgba(42,64,48,0.4)",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = F.surface)}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: F.text, fontFamily: FONT_COND, margin: 0, letterSpacing: "0.03em" }}>
                      {w.fullName}
                    </p>
                    {w.trade && (
                      <p style={{ fontSize: 10, color: isPriorityTrade(w.trade) ? F.accent : F.textMuted, fontFamily: FONT_COND, margin: 0, marginTop: 1 }}>
                        {w.trade}
                      </p>
                    )}
                  </div>
                  {/* Project tag if matching */}
                  {projectName && w.project?.toLowerCase() === projectName.toLowerCase() && (
                    <span style={{
                      fontSize: 9, fontWeight: 800, color: F.info, fontFamily: FONT_COND,
                      background: F.infoBg, border: `1px solid ${F.infoBorder}`,
                      borderRadius: 4, padding: "2px 5px", flexShrink: 0, letterSpacing: "0.05em",
                    }}>
                      {t.requesterThisProject.toUpperCase()}
                    </span>
                  )}
                </button>
              ))}

              {/* Current user fallback */}
              {currentUserName && !suggestions.some(w => w.fullName.toLowerCase() === currentUserName.toLowerCase()) && !inputVal.trim() && (
                <button
                  type="button"
                  onClick={() => { onChange({ name: currentUserName }); setInputVal(currentUserName); setCommitted({ name: currentUserName }); setOpen(false); }}
                  data-testid="requester-option-self"
                  style={{
                    width: "100%", padding: "9px 14px", textAlign: "left",
                    background: "transparent", border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 8,
                    borderTop: "1px solid rgba(42,64,48,0.4)",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = F.surface)}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <User style={{ width: 11, height: 11, color: F.textDim, flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: F.textMuted, fontFamily: FONT_COND, margin: 0, fontStyle: "italic" }}>
                      {currentUserName} {t.requesterMeSuffix}
                    </p>
                  </div>
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function FieldCartReview({ onClose }: { onClose?: () => void } = {}) {
  const { cartItems, updateQty, removeFromCart, clearCart, totalItems } = useFieldCart();
  const { t }          = useLanguage();
  const { toast }      = useToast();
  const queryClient    = useQueryClient();
  const { user }       = useAuth();

  const [notes,      setNotes]      = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [projectId,  setProjectId]  = useState<number | null>(null);
  const [requester,  setRequester]  = useState<{ name: string; role?: string } | null>(null);

  // ── Data fetches ──
  const { data: workers = [] } = useQuery<Worker[]>({ queryKey: ["/api/workers"] });
  const { data: projects = [] } = useQuery<Project[]>({ queryKey: ["/api/projects"] });

  const activeWorkers = useMemo(() => workers.filter(w => w.isActive), [workers]);
  const selectedProject = useMemo(() => projects.find(p => p.id === projectId) ?? null, [projects, projectId]);

  // Derive current user display name for fallback
  const currentUserName = (user as any)?.name || (user as any)?.username || null;

  async function handleSubmit() {
    if (cartItems.length === 0) return;
    setSubmitting(true);
    try {
      await apiRequest("POST", "/api/field/requests", {
        itemsJson: JSON.stringify(cartItems),
        notes: notes.trim() || null,
        projectId: projectId ?? undefined,
        requesterName: requester?.name ?? null,
        requesterRole: requester?.role ?? null,
      });
      clearCart();
      setNotes("");
      setProjectId(null);
      setRequester(null);
      queryClient.invalidateQueries({ queryKey: ["/api/field/requests"] });
      toast({ title: t.requestSubmitted, description: t.requestSubmittedHint });
      setTimeout(() => onClose?.(), 400);
    } catch (err: any) {
      toast({ title: t.errorTitle, description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  if (totalItems === 0) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        minHeight: 260, gap: 12, padding: "32px 16px",
      }}>
        <ShoppingCart style={{ width: 40, height: 40, color: F.textDim, opacity: 0.5 }} />
        <p style={{ fontSize: 15, fontWeight: 700, color: F.textMuted, fontFamily: FONT_BEBAS, letterSpacing: "0.06em" }}>
          {t.noCartItems}
        </p>
        <p style={{ fontSize: 12, color: F.textDim, textAlign: "center", maxWidth: 260, fontFamily: FONT_COND }}>
          {t.noCartItemsHint}
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

      {/* ── Cart header info ── */}
      <div style={{
        padding: "10px 16px",
        background: F.surface2,
        borderBottom: `1px solid ${F.borderStrong}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ fontSize: 11, color: F.textMuted, fontFamily: FONT_COND, fontWeight: 700, letterSpacing: "0.06em" }}>
          {totalItems} {(totalItems !== 1 ? t.cartItemsLabel : t.cartItemLabel).toUpperCase()}
        </span>
        <button
          type="button"
          onClick={() => { if (window.confirm(t.cartClearConfirm)) clearCart(); }}
          style={{
            fontSize: 10, fontWeight: 700, color: F.danger, fontFamily: FONT_COND,
            background: "transparent", border: "none", cursor: "pointer", letterSpacing: "0.05em",
            padding: "2px 6px",
          }}
          data-testid="btn-cart-clear-all"
        >
          {t.cartClearAll.toUpperCase()}
        </button>
      </div>

      {/* ── Cart items list ── */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {cartItems.map((item, idx) => (
          <div
            key={item.itemId}
            data-testid={`cart-item-row-${item.itemId}`}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px",
              borderBottom: `1px solid ${F.border}`,
              background: idx % 2 === 0 ? F.bg : F.surface2,
            }}
          >
            {/* Thumbnail */}
            <CartPhoto imageUrl={item.imageUrl} name={item.itemName} />

            {/* Item info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: 13, fontWeight: 700, color: F.text,
                fontFamily: FONT_COND, letterSpacing: "0.03em",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {item.itemName}
              </p>
              <div style={{ display: "flex", gap: 6, marginTop: 2, flexWrap: "wrap" }}>
                {item.sizeLabel && (
                  <span style={{ fontSize: 10, color: F.textMuted, fontFamily: FONT_COND }}>{item.sizeLabel}</span>
                )}
                <span style={{ fontSize: 10, color: F.textDim, fontFamily: FONT_COND }}>{item.sku}</span>
                {item.locationName && (
                  <span style={{ fontSize: 10, color: F.textDim, fontFamily: FONT_COND }}>@ {item.locationName}</span>
                )}
              </div>
            </div>

            {/* Qty stepper */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <QtyButton
                onClick={() => updateQty(item.itemId, Math.max(1, item.requestedQty - 1))}
                disabled={item.requestedQty <= 1}
              >
                <Minus style={{ width: 11, height: 11 }} />
              </QtyButton>
              <span style={{
                width: 32, textAlign: "center",
                fontSize: 14, fontWeight: 700, color: F.accent,
                fontFamily: "monospace",
              }}>
                {item.requestedQty}
              </span>
              <QtyButton onClick={() => updateQty(item.itemId, item.requestedQty + 1)}>
                <Plus style={{ width: 11, height: 11 }} />
              </QtyButton>
              <span style={{ fontSize: 10, color: F.textMuted, fontFamily: FONT_COND, minWidth: 24 }}>
                {item.unit}
              </span>
            </div>

            {/* Remove button */}
            <button
              type="button"
              onClick={() => removeFromCart(item.itemId)}
              data-testid={`btn-cart-remove-${item.itemId}`}
              style={{
                width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                background: F.dangerBg, border: `1px solid ${F.dangerBorder}`,
                color: F.danger, display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <Trash2 style={{ width: 12, height: 12 }} />
            </button>
          </div>
        ))}
      </div>

      {/* ── Request details form ── */}
      <div style={{ padding: "14px 16px", borderTop: `1px solid ${F.borderStrong}`, display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Project (optional) */}
        <div>
          <label style={{ fontSize: 10, fontWeight: 700, color: F.textMuted, fontFamily: FONT_COND, letterSpacing: "0.07em", display: "block", marginBottom: 6 }}>
            {t.projectOptional.toUpperCase()}
          </label>
          <div style={{ position: "relative" }}>
            <select
              value={projectId ?? ""}
              onChange={e => {
                const val = e.target.value;
                setProjectId(val ? Number(val) : null);
                setRequester(null);
              }}
              data-testid="select-project"
              style={{
                width: "100%", background: F.surface2, border: `1px solid ${F.borderStrong}`,
                borderRadius: 8, color: projectId ? F.text : F.textDim, fontSize: 13,
                fontFamily: FONT_COND, padding: "9px 32px 9px 10px",
                appearance: "none", outline: "none", cursor: "pointer",
              }}
            >
              <option value="">— {t.noProjectOption} —</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <ChevronDown style={{
              width: 13, height: 13, color: F.textDim,
              position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)",
              pointerEvents: "none",
            }} />
          </div>
        </div>

        {/* Requester */}
        <div>
          <label style={{ fontSize: 10, fontWeight: 700, color: F.textMuted, fontFamily: FONT_COND, letterSpacing: "0.07em", display: "block", marginBottom: 6 }}>
            {t.requestedBy.toUpperCase()}
          </label>
          <RequesterPicker
            value={requester}
            onChange={setRequester}
            workers={activeWorkers}
            projectName={selectedProject?.name ?? null}
            currentUserName={currentUserName}
          />
        </div>

        {/* Notes */}
        <div>
          <label style={{ fontSize: 10, fontWeight: 700, color: F.textMuted, fontFamily: FONT_COND, letterSpacing: "0.07em", display: "block", marginBottom: 6 }}>
            {t.noteOptionalLabel.toUpperCase()}
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder={t.addNoteWarehousePlaceholder}
            data-testid="cart-notes-input"
            rows={2}
            style={{
              width: "100%", background: F.surface2, border: `1px solid ${F.borderStrong}`,
              borderRadius: 8, color: F.text, fontSize: 13, fontFamily: FONT_COND,
              padding: "8px 10px", resize: "vertical", outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
      </div>

      {/* ── Submit / Cancel buttons ── */}
      <div style={{ padding: "4px 16px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || totalItems === 0}
          data-testid="btn-submit-request"
          style={{
            width: "100%", padding: "13px 20px",
            background: submitting ? F.surface2 : F.accent,
            border: `1px solid ${submitting ? F.borderStrong : F.accent}`,
            borderRadius: 10, cursor: submitting ? "default" : "pointer",
            color: submitting ? F.textDim : F.accentText,
            fontSize: 14, fontWeight: 800, fontFamily: FONT_BEBAS, letterSpacing: "0.08em",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            transition: "all 0.15s",
          }}
        >
          <Send style={{ width: 15, height: 15 }} />
          {submitting ? t.submitting : t.submitRequest}
        </button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            data-testid="btn-cart-cancel"
            style={{
              width: "100%", padding: "11px 20px",
              background: "transparent",
              border: `1px solid ${F.borderStrong}`,
              borderRadius: 10, cursor: submitting ? "default" : "pointer",
              color: F.textMuted,
              fontSize: 13, fontWeight: 700, fontFamily: FONT_BEBAS, letterSpacing: "0.08em",
              transition: "all 0.15s",
            }}
          >
            {t.cancel}
          </button>
        )}
      </div>
    </div>
  );
}
