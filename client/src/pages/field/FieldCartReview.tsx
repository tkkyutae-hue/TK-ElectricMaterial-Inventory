/**
 * FieldCartReview.tsx
 *
 * Cart tab — shows items queued from fieldCart context.
 * "Submit Request" POSTs to /api/field/requests and clears the cart.
 * No inventory quantities change here.
 */
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  ShoppingCart, Trash2, Minus, Plus, Send,
  ChevronDown, Check, ImageOff, Undo2, ClipboardList,
} from "lucide-react";
import { PersonPicker } from "@/components/shared/PersonPicker";
import { useFieldCart } from "@/lib/fieldCart";
import type { CartItem } from "@/lib/fieldCart";
import { useLanguage } from "@/hooks/use-language";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { F } from "@/lib/fieldTokens";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import type { Worker } from "@shared/schema";
import type { Project } from "@shared/schema";

// ── CartPhoto — compact 36×36 thumbnail with ImageOff fallback ───────────────

export function CartPhoto({ imageUrl, name }: { imageUrl?: string | null; name: string }) {
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

// ── QtyInput — editable quantity field with +/- integration ──────────────────

function QtyInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [raw, setRaw] = useState(String(value));

  useEffect(() => {
    setRaw(String(value));
  }, [value]);

  const commit = useCallback((str: string) => {
    const n = parseInt(str, 10);
    const safe = isNaN(n) || n < 1 ? 1 : n;
    onChange(safe);
    setRaw(String(safe));
  }, [onChange]);

  return (
    <input
      type="text"
      inputMode="numeric"
      value={raw}
      onChange={e => setRaw(e.target.value.replace(/[^0-9]/g, ""))}
      onBlur={e => commit(e.target.value)}
      onKeyDown={e => { if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur(); }}
      onFocus={e => e.currentTarget.select()}
      data-testid="qty-input-cart"
      style={{
        width: 44, height: 28, textAlign: "center",
        fontSize: 14, fontWeight: 700, color: F.accent,
        fontFamily: "monospace",
        background: F.surface,
        border: `1px solid ${F.borderStrong}`,
        borderRadius: 6, outline: "none",
        padding: 0,
        WebkitAppearance: "none",
        MozAppearance: "textfield",
      } as React.CSSProperties}
    />
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function FieldCartReview({ onClose }: { onClose?: () => void } = {}) {
  const {
    cartItems, updateQty, removeFromCart, clearCart, restoreCart, totalItems,
    editingRequestId, editingRequestNumber, editingMeta, clearEditingRequest, setEditingRequest,
  } = useFieldCart();
  const { t }          = useLanguage();
  const { toast }      = useToast();
  const queryClient    = useQueryClient();
  const { user }       = useAuth();
  const [, navigate]   = useLocation();

  const [notes,       setNotes]       = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const [undoing,     setUndoing]     = useState(false);
  const [projectId,   setProjectId]   = useState<number | null>(null);
  const [requester,   setRequester]   = useState<{ name: string; role?: string } | null>(null);
  const [requestType, setRequestType] = useState<"issue" | "transfer">("issue");

  // ── Pre-populate form from editingMeta when entering edit-request mode ────
  const populatedRef = useRef<number | null>(null);
  useEffect(() => {
    if (editingRequestId !== null && editingMeta && populatedRef.current !== editingRequestId) {
      populatedRef.current = editingRequestId;
      setRequestType(editingMeta.requestType);
      setProjectId(editingMeta.projectId);
      setNotes(editingMeta.notes);
      setRequester(
        editingMeta.requesterName
          ? { name: editingMeta.requesterName, role: editingMeta.requesterRole || undefined }
          : null
      );
    }
    if (editingRequestId === null) {
      populatedRef.current = null;
    }
  }, [editingRequestId, editingMeta]);

  // ── Data fetches ──
  const { data: workers = [] } = useQuery<Worker[]>({ queryKey: ["/api/workers"] });
  const { data: projects = [] } = useQuery<Project[]>({ queryKey: ["/api/projects"] });

  const activeWorkers = useMemo(() => workers.filter(w => w.isActive), [workers]);
  const selectedProject = useMemo(() => projects.find(p => p.id === projectId) ?? null, [projects, projectId]);

  // Derive current user display name for fallback
  const currentUserName = (user as any)?.name || (user as any)?.username || null;

  // ── Derived edit-mode flag ─────────────────────────────────────────────────
  const isEditMode = editingRequestId !== null;

  async function handleSubmit() {
    if (cartItems.length === 0) return;

    // Snapshot form state before clearing (for Undo restoration)
    const cartSnapshot: CartItem[] = cartItems.map(i => ({ ...i }));
    const notesSnapshot       = notes;
    const projectIdSnapshot   = projectId;
    const requesterSnapshot   = requester;
    const requestTypeSnapshot = requestType;
    const editingIdSnapshot   = editingRequestId;
    const editingNumSnapshot  = editingRequestNumber;

    setSubmitting(true);
    try {
      let submittedId: number | null = null;

      if (isEditMode && editingIdSnapshot !== null) {
        // ── PATCH existing request ────────────────────────────────────────────
        const res = await apiRequest("PATCH", `/api/field/requests/${editingIdSnapshot}`, {
          itemsJson:     JSON.stringify(cartItems),
          notes:         notes.trim() || null,
          projectId:     projectId ?? null,
          requesterName: requester?.name ?? null,
          requesterRole: requester?.role ?? null,
          requestType,
        });
        const updated: any = await res.json().catch(() => null);
        submittedId = updated?.id ?? editingIdSnapshot;
      } else {
        // ── POST new request ──────────────────────────────────────────────────
        const res = await apiRequest("POST", "/api/field/requests", {
          itemsJson:     JSON.stringify(cartItems),
          notes:         notes.trim() || null,
          projectId:     projectId ?? undefined,
          requesterName: requester?.name ?? null,
          requesterRole: requester?.role ?? null,
          requestType,
        });
        const submitted: any = await res.json().catch(() => null);
        submittedId = submitted?.id ?? null;
      }

      // Clear cart, edit session, and form state
      clearCart();
      clearEditingRequest();
      setNotes("");
      setProjectId(null);
      setRequester(null);
      setRequestType("issue");
      queryClient.invalidateQueries({ queryKey: ["/api/field/requests"] });

      // ── Undo handler ─────────────────────────────────────────────────────────
      async function performUndo(dismissToast: () => void) {
        if (!submittedId) return;
        setUndoing(true);
        dismissToast();
        try {
          if (isEditMode && editingIdSnapshot !== null) {
            // Restore original items by re-patching with snapshot
            await apiRequest("PATCH", `/api/field/requests/${editingIdSnapshot}`, {
              itemsJson:     JSON.stringify(cartSnapshot),
              notes:         notesSnapshot.trim() || null,
              projectId:     projectIdSnapshot ?? null,
              requesterName: requesterSnapshot?.name ?? null,
              requesterRole: requesterSnapshot?.role ?? null,
              requestType:   requestTypeSnapshot,
            });
            // Re-enter edit mode so the user can keep editing
            restoreCart(cartSnapshot);
            setNotes(notesSnapshot);
            setProjectId(projectIdSnapshot);
            setRequester(requesterSnapshot);
            setRequestType(requestTypeSnapshot);
            if (editingNumSnapshot) {
              // Re-activate edit session context so banner + PATCH path stay active
              setEditingRequest(editingIdSnapshot, editingNumSnapshot, {
                requestType:   requestTypeSnapshot,
                projectId:     projectIdSnapshot,
                notes:         notesSnapshot,
                requesterName: requesterSnapshot?.name ?? "",
                requesterRole: requesterSnapshot?.role ?? "",
              });
            }
          } else {
            await apiRequest("PATCH", `/api/field/requests/${submittedId}/status`, { status: "cancelled" });
            // Restore full form state
            restoreCart(cartSnapshot);
            setNotes(notesSnapshot);
            setProjectId(projectIdSnapshot);
            setRequester(requesterSnapshot);
            setRequestType(requestTypeSnapshot);
          }
          queryClient.invalidateQueries({ queryKey: ["/api/field/requests"] });
          toast({ title: t.undoDone });
        } catch (err: any) {
          toast({ title: t.undoFailed, description: err.message, variant: "destructive" });
        } finally {
          setUndoing(false);
        }
      }

      // ── "Go to Requests" handler ──────────────────────────────────────────────
      function goToRequests(dismissToast: () => void) {
        dismissToast();
        onClose?.();
        navigate("/field/transactions?tab=requests");
      }

      // ── Rich toast with inline actions ───────────────────────────────────────
      const btnBase: React.CSSProperties = {
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "5px 10px", borderRadius: 6, cursor: "pointer",
        fontSize: 11, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif",
        letterSpacing: "0.05em", border: "none", transition: "opacity 0.15s",
      };

      const toastTitle = isEditMode ? (t as any).requestUpdated : t.requestSubmitted;

      const { dismiss } = toast({
        title: toastTitle,
        description: (
          <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
            <button
              type="button"
              data-testid="toast-goto-requests"
              onClick={() => goToRequests(dismiss)}
              style={{
                ...btnBase,
                background: F.accentBg,
                border: `1px solid ${F.accent}`,
                color: F.accent,
              }}
            >
              <ClipboardList style={{ width: 11, height: 11, flexShrink: 0 }} />
              {t.goToRequests}
            </button>
            {submittedId && (
              <button
                type="button"
                data-testid="toast-undo-request"
                onClick={() => performUndo(dismiss)}
                style={{
                  ...btnBase,
                  background: "transparent",
                  border: "1px solid transparent",
                  color: F.textMuted,
                }}
              >
                <Undo2 style={{ width: 11, height: 11, flexShrink: 0 }} />
                {t.undoRequest}
              </button>
            )}
          </div>
        ),
      });
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

      {/* ── Edit-request mode banner ── */}
      {isEditMode && editingRequestNumber && (
        <div
          data-testid="edit-mode-banner"
          style={{
            padding: "7px 16px",
            background: `${F.accentBg}`,
            borderBottom: `1px solid ${F.accent}`,
            display: "flex", alignItems: "center", gap: 8,
          }}
        >
          <Check style={{ width: 12, height: 12, color: F.accent, flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: F.accent, fontFamily: FONT_COND, letterSpacing: "0.06em" }}>
            {(t as any).editingRequestLabel?.toUpperCase() ?? "EDITING"} · {editingRequestNumber}
          </span>
        </div>
      )}

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
              <QtyInput
                value={item.requestedQty}
                onChange={q => updateQty(item.itemId, q)}
              />
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

        {/* Request Type toggle */}
        <div>
          <label style={{ fontSize: 10, fontWeight: 700, color: F.textMuted, fontFamily: FONT_COND, letterSpacing: "0.07em", display: "block", marginBottom: 6 }}>
            {t.reqType.toUpperCase()}
          </label>
          <div style={{ display: "flex", gap: 6 }}>
            {(["issue", "transfer"] as const).map(rt => (
              <button
                key={rt}
                type="button"
                onClick={() => setRequestType(rt)}
                data-testid={`btn-reqtype-${rt}`}
                style={{
                  flex: 1, padding: "8px 10px", borderRadius: 8,
                  background: requestType === rt ? F.accent : F.surface2,
                  border: `1px solid ${requestType === rt ? F.accent : F.borderStrong}`,
                  color: requestType === rt ? F.accentText : F.textMuted,
                  fontSize: 12, fontWeight: 800, fontFamily: FONT_BEBAS, letterSpacing: "0.08em",
                  cursor: "pointer", transition: "all 0.15s",
                }}
              >
                {rt === "issue" ? t.reqType_issue : t.reqType_transfer}
              </button>
            ))}
          </div>
        </div>

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
          <PersonPicker
            value={requester}
            onChange={setRequester}
            workers={activeWorkers}
            projectName={selectedProject?.name ?? null}
            currentUserName={currentUserName}
            dark={true}
            testId="input-requester"
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
          disabled={submitting || undoing || totalItems === 0}
          data-testid="btn-submit-request"
          style={{
            width: "100%", padding: "13px 20px",
            background: (submitting || undoing) ? F.surface2 : F.accent,
            border: `1px solid ${submitting ? F.borderStrong : F.accent}`,
            borderRadius: 10, cursor: submitting ? "default" : "pointer",
            color: submitting ? F.textDim : F.accentText,
            fontSize: 14, fontWeight: 800, fontFamily: FONT_BEBAS, letterSpacing: "0.08em",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            transition: "all 0.15s",
          }}
        >
          <Send style={{ width: 15, height: 15 }} />
          {submitting
            ? (isEditMode ? (t as any).updating ?? t.submitting : t.submitting)
            : (isEditMode ? (t as any).updateRequest ?? t.submitRequest : t.submitRequest)
          }
        </button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            disabled={submitting || undoing}
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
