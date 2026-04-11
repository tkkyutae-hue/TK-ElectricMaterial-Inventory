/**
 * FieldCartReview.tsx
 *
 * Cart tab — shows items queued from fieldCart context.
 * "Submit Request" POSTs to /api/field/requests and clears the cart.
 * No inventory quantities change here.
 */
import { useState } from "react";
import { ShoppingCart, Trash2, Minus, Plus, Send, PackageOpen } from "lucide-react";
import { useFieldCart } from "@/lib/fieldCart";
import { useLanguage } from "@/hooks/use-language";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { F } from "@/lib/fieldTokens";
import { apiRequest } from "@/lib/queryClient";

// ── Inline style helpers ──────────────────────────────────────────────────────

const FONT_COND = "'Barlow Condensed', sans-serif";
const FONT_BEBAS = "'Bebas Neue', sans-serif";

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

// ── Main Component ────────────────────────────────────────────────────────────

export default function FieldCartReview() {
  const { cartItems, updateQty, removeFromCart, clearCart, totalItems } = useFieldCart();
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (cartItems.length === 0) return;
    setSubmitting(true);
    try {
      await apiRequest("POST", "/api/field/requests", {
        itemsJson: JSON.stringify(cartItems),
        notes: notes.trim() || null,
      });
      clearCart();
      setNotes("");
      queryClient.invalidateQueries({ queryKey: ["/api/field/requests"] });
      toast({ title: t.requestSubmitted, description: t.requestSubmittedHint });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
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
          {totalItems} ITEM{totalItems !== 1 ? "S" : ""} IN CART
        </span>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Clear all items from cart?")) clearCart();
          }}
          style={{
            fontSize: 10, fontWeight: 700, color: F.danger, fontFamily: FONT_COND,
            background: "transparent", border: "none", cursor: "pointer", letterSpacing: "0.05em",
            padding: "2px 6px",
          }}
          data-testid="btn-cart-clear-all"
        >
          CLEAR ALL
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
              padding: "12px 16px",
              borderBottom: `1px solid ${F.border}`,
              background: idx % 2 === 0 ? F.bg : F.surface2,
            }}
          >
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

      {/* ── Notes field ── */}
      <div style={{ padding: "12px 16px", borderTop: `1px solid ${F.borderStrong}` }}>
        <label style={{ fontSize: 10, fontWeight: 700, color: F.textMuted, fontFamily: FONT_COND, letterSpacing: "0.07em", display: "block", marginBottom: 6 }}>
          {t.noteOptionalLabel.toUpperCase()}
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Add a note for warehouse staff…"
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

      {/* ── Submit button ── */}
      <div style={{ padding: "12px 16px" }}>
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
      </div>
    </div>
  );
}
