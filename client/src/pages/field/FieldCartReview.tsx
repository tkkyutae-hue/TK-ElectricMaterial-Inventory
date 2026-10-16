/**
 * FieldCartReview.tsx
 *
 * Cart tab — shows items queued from fieldCart context.
 * "Submit Request" POSTs to /api/field/requests and clears the cart.
 * No inventory quantities change here.
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  ShoppingCart, Trash2, Minus, Plus, Send,
  ChevronDown, Check, ImageOff, Undo2, ClipboardList,
} from "lucide-react";
import { PersonPicker } from "@/components/shared/PersonPicker";
import { useFieldCart } from "@/lib/fieldCart";
import type { CartItem } from "@/lib/fieldCart";
import { needsDraftReplacementConfirmation } from "@/lib/fieldCartDraft";
import { useLanguage } from "@/hooks/use-language";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useFieldTheme } from "@/hooks/use-field-theme";
import { requestCommand, requestCommandMessage } from "@/lib/requestCommands";
import { useAuth } from "@/hooks/use-auth";
import type { Worker } from "@shared/schema";
import type { Project } from "@shared/schema";

// ── CartPhoto — compact 36×36 thumbnail with ImageOff fallback ───────────────

export function CartPhoto({ imageUrl, name }: { imageUrl?: string | null; name: string }) {
  const [imgError, setImgError] = useState(false);
  const { F } = useFieldTheme();
  const base: React.CSSProperties = {
    width: 36, height: 36, borderRadius: 8, flexShrink: 0,
    background: F.surface2, display: "flex", alignItems: "center", justifyContent: "center",
  };
  if (!imageUrl || imgError) {
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
        onError={() => setImgError(true)}
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
  const { F } = useFieldTheme();
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
  const { F } = useFieldTheme();

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
  const { F } = useFieldTheme();
  const {
    cartItems, updateQty, removeFromCart, clearCart, totalItems,
    editingRequestId, editingRequestNumber, draft, updateMeta,
    getDraft, replaceDraft, resetDraft, clearSubmittedDraft,
  } = useFieldCart();
  const { t }          = useLanguage();
  const { toast }      = useToast();
  const queryClient    = useQueryClient();
  const { user }       = useAuth();
  const [, navigate]   = useLocation();

  const [submitting,  setSubmitting]  = useState(false);
  const [undoing,     setUndoing]     = useState(false);
  // All form fields live with the items, not in this disposable panel.
  const { notes, projectId, requestType, requesterName, requesterRole } = draft.meta;
  const requester = requesterName ? { name: requesterName, role: requesterRole || undefined } : null;
  const setNotes = (value: string) => updateMeta({ notes: value });
  const setProjectId = (value: number | null) => updateMeta({ projectId: value });
  const setRequestType = (value: "issue" | "transfer") => updateMeta({ requestType: value });
  const setRequester = (value: { name: string; role?: string } | null) =>
    updateMeta({ requesterName: value?.name ?? "", requesterRole: value?.role ?? "" });

  // ── Data fetches ──
  const { data: workers = [] } = useQuery<Worker[]>({ queryKey: ["/api/workers"] });
  const { data: projects = [] } = useQuery<Project[]>({ queryKey: ["/api/projects"] });

  const selectedProject = useMemo(() => projects.find(p => p.id === projectId) ?? null, [projects, projectId]);

  // Derive current user display name for fallback
  const currentUserName = (user as any)?.name || (user as any)?.username || null;

  // ── Derived edit-mode flag ─────────────────────────────────────────────────
  const isEditMode = editingRequestId !== null;

  async function handleSubmit() {
    if (cartItems.length === 0) return;

    // Snapshot form state before clearing (for Undo restoration)
    const draftSnapshot = getDraft();
    const editingIdSnapshot   = editingRequestId;

    setSubmitting(true);
    try {
      let submittedId: number | null = null;
      let savedRevision: number | undefined;
      let savedOperationId: string | undefined;

      if (isEditMode && editingIdSnapshot !== null) {
        // ── PATCH existing request ────────────────────────────────────────────
        const saved = await requestCommand("PATCH", `/api/field/requests/${editingIdSnapshot}`, {
          itemsJson:     JSON.stringify(cartItems),
          notes:         notes.trim() || null,
          projectId:     projectId ?? null,
          requesterName: requester?.name ?? null,
          requesterRole: requester?.role ?? null,
          requestType,
        }, draftSnapshot.editingRevision);
        submittedId = saved.request.id;
        savedRevision = saved.request.revision;
        savedOperationId = saved.operationId;
      } else {
        // ── POST new request ──────────────────────────────────────────────────
        const saved = await requestCommand("POST", "/api/field/requests", {
          itemsJson:     JSON.stringify(cartItems),
          notes:         notes.trim() || null,
          projectId:     projectId ?? undefined,
          requesterName: requester?.name ?? null,
          requesterRole: requester?.role ?? null,
          requestType,
        });
        submittedId = saved.request.id;
        savedRevision = saved.request.revision;
        savedOperationId = saved.operationId;
      }

      // Do not clear newer work entered while the request was in flight.
      clearSubmittedDraft(draftSnapshot);
      queryClient.invalidateQueries({ queryKey: ["/api/field/requests"] });

      // ── Undo handler ─────────────────────────────────────────────────────────
      async function performUndo(dismissToast: () => void) {
        if (!submittedId) return;
        const approvedDraft = getDraft();
        const localRestoration = isEditMode && draftSnapshot.editingOriginal
          ? {
            ...draftSnapshot,
            items: JSON.parse(String(draftSnapshot.editingOriginal.itemsJson)),
            meta: {
              requestType: draftSnapshot.editingOriginal.requestType as "issue" | "transfer",
              projectId: (draftSnapshot.editingOriginal.projectId as number | null) ?? null,
              requesterName: String(draftSnapshot.editingOriginal.requesterName ?? ""),
              requesterRole: String(draftSnapshot.editingOriginal.requesterRole ?? ""),
              notes: String(draftSnapshot.editingOriginal.notes ?? ""),
            },
          } : draftSnapshot;
        if (needsDraftReplacementConfirmation(approvedDraft, localRestoration) &&
            !window.confirm(t.cartReplaceDraftConfirm)) return;
        setUndoing(true);
        dismissToast();
        try {
          if (isEditMode && editingIdSnapshot !== null) {
            const undone = await requestCommand("POST", `/api/field/requests/${editingIdSnapshot}/undo-edit`, {},
              savedRevision, savedOperationId);
            localRestoration.editingRevision = undone.request.revision;
            localRestoration.editingOriginal = undone.request;
          } else {
            await requestCommand("PATCH", `/api/field/requests/${submittedId}/status`, { status: "cancelled" },
              savedRevision, savedOperationId);
          }
          // Use the current provider state, even if this toast outlives the panel.
          // Ask again only if another draft changed during the async operation.
          const restored = replaceDraft(localRestoration, () =>
            getDraft() === approvedDraft || window.confirm(t.cartReplaceDraftConfirm));
          queryClient.invalidateQueries({ queryKey: ["/api/field/requests"] });
          toast(restored
            ? { title: isEditMode ? t.reqEditUndone : t.undoDone }
            : { title: t.cartUndoServerDoneDraftKept, description: t.cartUndoDraftKeptHint });
        } catch (err: any) {
          toast({ title: t.undoFailed, description: requestCommandMessage(err, t), variant: "destructive" });
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

      // Explicitly separate toasts for new-request vs edit-request so
      // neither path can accidentally regress the other.
      if (isEditMode) {
        // ── EDIT request updated — Go to Requests + Undo (re-patches snapshot)
        const { dismiss } = toast({
          title: (t as any).requestUpdated ?? t.requestSubmitted,
          description: (
            <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
              <button type="button" data-testid="toast-goto-requests"
                onClick={() => goToRequests(dismiss)}
                style={{ ...btnBase, background: F.accentBg, border: `1px solid ${F.accent}`, color: F.accent }}
              >
                <ClipboardList style={{ width: 11, height: 11, flexShrink: 0 }} />
                {t.goToRequests}
              </button>
              {submittedId && (
                <button type="button" data-testid="toast-undo-request"
                  onClick={() => performUndo(dismiss)}
                  style={{ ...btnBase, background: "transparent", border: "1px solid transparent", color: F.textMuted }}
                >
                  <Undo2 style={{ width: 11, height: 11, flexShrink: 0 }} />
                  {t.undoRequest}
                </button>
              )}
            </div>
          ),
        });
      } else {
        // ── NEW request submitted — Go to Requests + Undo (cancels the request)
        const { dismiss } = toast({
          title: t.requestSubmitted,
          description: (
            <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
              <button type="button" data-testid="toast-goto-requests"
                onClick={() => goToRequests(dismiss)}
                style={{ ...btnBase, background: F.accentBg, border: `1px solid ${F.accent}`, color: F.accent }}
              >
                <ClipboardList style={{ width: 11, height: 11, flexShrink: 0 }} />
                {t.goToRequests}
              </button>
              {submittedId && (
                <button type="button" data-testid="toast-undo-request"
                  onClick={() => performUndo(dismiss)}
                  style={{ ...btnBase, background: "transparent", border: "1px solid transparent", color: F.textMuted }}
                >
                  <Undo2 style={{ width: 11, height: 11, flexShrink: 0 }} />
                  {t.undoNewRequestCancel}
                </button>
              )}
            </div>
          ),
        });
      }
    } catch (err: any) {
      toast({ title: t.errorTitle, description: requestCommandMessage(err, t), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }


  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

      {/* Mode and local-only edit exit stay visible even with no items. */}
        <div
          data-testid={isEditMode ? "edit-mode-banner" : "new-request-banner"}
          style={{
            padding: "7px 16px",
            background: `${F.accentBg}`,
            borderBottom: `1px solid ${F.accent}`,
            display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
          }}
        >
          <Check style={{ width: 12, height: 12, color: F.accent, flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: F.accent, fontFamily: FONT_COND, letterSpacing: "0.06em" }}>
            {isEditMode
              ? `${t.editingRequestLabel} · ${editingRequestNumber ?? `#${editingRequestId}`}`
              : t.cartNewRequest}
          </span>
          {isEditMode && (
            <button type="button" data-testid="btn-end-request-edit"
              disabled={submitting || undoing}
              onClick={() => { if (window.confirm(t.cartEndEditingConfirm)) resetDraft(); }}
              style={{
                marginLeft: "auto", padding: "5px 8px", borderRadius: 6,
                background: F.surface, border: `1px solid ${F.borderStrong}`, color: F.text,
                fontSize: 11, fontFamily: FONT_COND, cursor: "pointer",
              }}>
              {t.cartEndEditing}
            </button>
          )}
        </div>
      {totalItems === 0 && (
        <div style={{ padding: "24px 16px", textAlign: "center", color: F.textMuted }}>
          <ShoppingCart style={{ width: 32, height: 32, margin: "0 auto 8px", color: F.textDim }} />
          <p>{t.noCartItems}</p>
          <p style={{ fontSize: 12, color: F.textDim }}>{t.noCartItemsHint}</p>
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
            workers={workers}
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
            {t.cartCloseKeepDraft}
          </button>
        )}
      </div>
    </div>
  );
}
