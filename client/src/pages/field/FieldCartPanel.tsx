import { createPortal } from "react-dom";
import { ShoppingCart, X } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";
import { useFieldTheme } from "@/hooks/use-field-theme";
import { useIsMobile } from "@/hooks/use-mobile";
import FieldCartReview from "./FieldCartReview";

/** Shared by Inventory and isolated UI tests; closing never discards the draft. */
export default function FieldCartPanel({ onClose }: { onClose: () => void }) {
  const { F } = useFieldTheme();
  const { t } = useLanguage();
  const isMobile = useIsMobile();

  return createPortal(
    <>
      <div
        onClick={onClose}
        data-testid="cart-panel-backdrop"
        style={{
          position: "fixed", inset: 0, zIndex: 8800,
          background: "rgba(0,0,0,0.65)", backdropFilter: "blur(3px)",
        }}
      />
      <div
        data-testid="cart-panel"
        style={{
          position: "fixed", zIndex: 8900, background: F.bg,
          display: "flex", flexDirection: "column", overflow: "hidden",
          ...(isMobile ? {
            bottom: 0, left: 0, right: 0, maxHeight: "92vh",
            borderRadius: "16px 16px 0 0",
            borderTop: `1px solid ${F.borderStrong}`,
            boxShadow: "0 -8px 40px rgba(0,0,0,0.7)",
          } : {
            top: 0, right: 0, bottom: 0, width: 440,
            borderLeft: `1px solid ${F.borderStrong}`,
            boxShadow: "-8px 0 40px rgba(0,0,0,0.7)",
          }),
        }}
      >
        <div style={{
          padding: "12px 16px", borderBottom: `1px solid ${F.borderStrong}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: F.surface2, flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ShoppingCart style={{ width: 15, height: 15, color: F.accent }} />
            <span style={{
              fontSize: 16, fontWeight: 700, color: F.text,
              fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.06em",
            }}>{t.reviewCart}</span>
          </div>
          <button
            onClick={onClose}
            data-testid="btn-close-cart-panel"
            style={{
              background: "transparent", border: "none", cursor: "pointer",
              padding: 4, borderRadius: 6, color: F.textMuted,
              display: "flex", alignItems: "center",
            }}
          >
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          <FieldCartReview onClose={onClose} />
        </div>
      </div>
    </>,
    document.body,
  );
}
