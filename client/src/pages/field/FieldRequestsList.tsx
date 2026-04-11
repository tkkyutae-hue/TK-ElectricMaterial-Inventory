/**
 * FieldRequestsList.tsx
 *
 * Requests tab — shows submitted material requests from /api/field/requests.
 * Managers/admins see all requests. Staff/viewers see their own.
 * No create/edit actions here — requests originate from the Cart tab.
 */
import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck, ChevronDown, ChevronUp, PackageOpen } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "@/hooks/use-language";
import { F } from "@/lib/fieldTokens";
import type { MaterialRequest } from "@shared/schema";
import type { CartItem } from "@/lib/fieldCart";

const FONT_COND  = "'Barlow Condensed', sans-serif";
const FONT_BEBAS = "'Bebas Neue', sans-serif";
const FONT_MONO  = "monospace";

// ── Status badge config ───────────────────────────────────────────────────────

type ReqStatus = "requested" | "preparing" | "ready" | "completed" | "cancelled";

const STATUS_CONFIG: Record<ReqStatus, { color: string; bg: string; border: string; dot: string }> = {
  requested:  { color: F.info,    bg: F.infoBg,    border: F.infoBorder,    dot: F.info    },
  preparing:  { color: F.warning, bg: F.warningBg, border: F.warningBorder, dot: F.warning },
  ready:      { color: F.accent,  bg: F.accentBg,  border: F.accentBorder,  dot: F.accent  },
  completed:  { color: F.textMuted, bg: "rgba(122,171,130,0.08)", border: "rgba(122,171,130,0.25)", dot: F.textMuted },
  cancelled:  { color: F.danger,  bg: F.dangerBg,  border: F.dangerBorder,  dot: F.danger  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as ReqStatus] ?? STATUS_CONFIG.requested;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 9px", borderRadius: 20,
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      fontSize: 10, fontWeight: 800, color: cfg.color,
      fontFamily: FONT_COND, letterSpacing: "0.07em", whiteSpace: "nowrap",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />
      {status.replace(/_/g, " ").toUpperCase()}
    </span>
  );
}

// ── Request card ──────────────────────────────────────────────────────────────

function RequestCard({ req }: { req: MaterialRequest }) {
  const [expanded, setExpanded] = useState(false);
  let items: CartItem[] = [];
  try { items = JSON.parse(req.itemsJson || "[]"); } catch { items = []; }

  const submittedAt = req.submittedAt ? new Date(req.submittedAt) : null;
  const dateStr = submittedAt
    ? submittedAt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : "—";
  const timeStr = submittedAt
    ? submittedAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <div
      data-testid={`request-card-${req.id}`}
      style={{
        background: F.surface2,
        border: `1px solid ${F.borderStrong}`,
        borderRadius: 10,
        overflow: "hidden",
        marginBottom: 10,
      }}
    >
      {/* Card header */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        data-testid={`btn-request-expand-${req.id}`}
        style={{
          width: "100%", padding: "12px 14px",
          background: "transparent", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 10, textAlign: "left",
        }}
      >
        {/* Request number */}
        <span style={{
          fontSize: 13, fontWeight: 800, color: F.accent,
          fontFamily: FONT_MONO, letterSpacing: "0.05em", flexShrink: 0,
        }}>
          {req.requestNumber}
        </span>

        {/* Status */}
        <StatusBadge status={req.status} />

        <div style={{ flex: 1, minWidth: 0 }} />

        {/* Item count + date */}
        <span style={{ fontSize: 10, color: F.textDim, fontFamily: FONT_COND, flexShrink: 0 }}>
          {items.length} item{items.length !== 1 ? "s" : ""}
        </span>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: F.textMuted, fontFamily: FONT_COND }}>{dateStr}</span>
          <span style={{ fontSize: 9, color: F.textDim, fontFamily: FONT_COND }}>{timeStr}</span>
        </div>
        {expanded
          ? <ChevronUp  style={{ width: 14, height: 14, color: F.textDim, flexShrink: 0 }} />
          : <ChevronDown style={{ width: 14, height: 14, color: F.textDim, flexShrink: 0 }} />
        }
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${F.border}` }}>

          {/* Submitter row */}
          {req.submittedByName && (
            <div style={{ padding: "8px 14px", borderBottom: `1px solid ${F.border}` }}>
              <span style={{ fontSize: 10, color: F.textDim, fontFamily: FONT_COND }}>Submitted by </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: F.textMuted, fontFamily: FONT_COND }}>{req.submittedByName}</span>
            </div>
          )}

          {/* Notes */}
          {req.notes && (
            <div style={{ padding: "8px 14px", borderBottom: `1px solid ${F.border}` }}>
              <span style={{ fontSize: 10, color: F.textDim, fontFamily: FONT_COND }}>Note: </span>
              <span style={{ fontSize: 12, color: F.text, fontFamily: FONT_COND, fontStyle: "italic" }}>{req.notes}</span>
            </div>
          )}

          {/* Items list */}
          {items.length > 0 ? (
            <div>
              {items.map((item, i) => (
                <div
                  key={item.itemId}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "9px 14px",
                    borderBottom: i < items.length - 1 ? `1px solid ${F.border}` : undefined,
                    background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 12, fontWeight: 700, color: F.text,
                      fontFamily: FONT_COND, letterSpacing: "0.03em",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {item.itemName}
                    </p>
                    {(item.sizeLabel || item.sku) && (
                      <div style={{ display: "flex", gap: 5, marginTop: 1 }}>
                        {item.sizeLabel && <span style={{ fontSize: 9, color: F.textMuted, fontFamily: FONT_COND }}>{item.sizeLabel}</span>}
                        <span style={{ fontSize: 9, color: F.textDim, fontFamily: FONT_COND }}>{item.sku}</span>
                      </div>
                    )}
                  </div>
                  <span style={{
                    fontSize: 13, fontWeight: 800, color: F.accent,
                    fontFamily: FONT_MONO, flexShrink: 0,
                  }}>
                    {item.requestedQty}
                  </span>
                  <span style={{ fontSize: 10, color: F.textMuted, fontFamily: FONT_COND, flexShrink: 0, minWidth: 24 }}>
                    {item.unit}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ padding: "12px 14px", fontSize: 11, color: F.textDim, fontFamily: FONT_COND }}>No items recorded.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function FieldRequestsList() {
  const { t } = useLanguage();

  const { data: requests = [], isLoading } = useQuery<MaterialRequest[]>({
    queryKey: ["/api/field/requests"],
  });

  if (isLoading) {
    return (
      <div style={{ padding: "32px 16px", textAlign: "center" }}>
        <p style={{ fontSize: 12, color: F.textDim, fontFamily: FONT_COND }}>{t.loading}</p>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        minHeight: 260, gap: 12, padding: "32px 16px",
      }}>
        <ClipboardCheck style={{ width: 40, height: 40, color: F.textDim, opacity: 0.45 }} />
        <p style={{ fontSize: 15, fontWeight: 700, color: F.textMuted, fontFamily: FONT_BEBAS, letterSpacing: "0.06em" }}>
          {t.noRequests}
        </p>
        <p style={{ fontSize: 12, color: F.textDim, textAlign: "center", maxWidth: 260, fontFamily: FONT_COND }}>
          {t.noRequestsHint}
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: "14px 16px" }}>
      {requests.map(req => (
        <RequestCard key={req.id} req={req} />
      ))}
    </div>
  );
}
