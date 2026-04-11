/**
 * FieldRequestsList.tsx
 *
 * Requests tab — shows submitted material requests from /api/field/requests.
 * Managers/admins see all requests. Staff/viewers see their own.
 * Admins/managers can advance request status; completion creates a real transaction.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, ChevronDown, ChevronUp, CheckCircle2, Loader2 } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { F } from "@/lib/fieldTokens";
import type { MaterialRequest, Project } from "@shared/schema";
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
  const { t } = useLanguage();
  const cfg = STATUS_CONFIG[status as ReqStatus] ?? STATUS_CONFIG.requested;
  const key = `reqStatus_${status}` as keyof typeof t;
  const label = (t[key] as string | undefined) ?? status.replace(/_/g, " ");
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 9px", borderRadius: 20,
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      fontSize: 10, fontWeight: 800, color: cfg.color,
      fontFamily: FONT_COND, letterSpacing: "0.07em", whiteSpace: "nowrap",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />
      {label.toUpperCase()}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const { t } = useLanguage();
  const isTransfer = type === "transfer";
  const label = isTransfer ? t.reqType_transfer : t.reqType_issue;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "2px 7px", borderRadius: 5,
      background: isTransfer ? F.warningBg : "rgba(45,219,111,0.08)",
      border: `1px solid ${isTransfer ? F.warningBorder : F.accentBorder}`,
      fontSize: 9, fontWeight: 800, color: isTransfer ? F.warning : F.accent,
      fontFamily: FONT_COND, letterSpacing: "0.07em", whiteSpace: "nowrap",
    }}>
      {label.toUpperCase()}
    </span>
  );
}

// ── Status action buttons (admin/manager only) ────────────────────────────────

const STATUS_NEXT: Record<string, Array<{ status: string; label: (t: any) => string; accent?: boolean; danger?: boolean; completing?: boolean }>> = {
  requested: [
    { status: "preparing",  label: t => t.reqStatus_preparing, accent: false },
    { status: "cancelled",  label: t => t.reqStatus_cancelled,  danger: true  },
  ],
  preparing: [
    { status: "ready",      label: t => t.reqStatus_ready,     accent: true  },
    { status: "cancelled",  label: t => t.reqStatus_cancelled,  danger: true  },
  ],
  ready: [
    { status: "completed",  label: t => t.reqCompleting,       accent: true, completing: true },
    { status: "cancelled",  label: t => t.reqStatus_cancelled,  danger: true  },
  ],
};

function StatusActions({
  req,
  onStatusChanged,
}: {
  req: MaterialRequest;
  onStatusChanged: () => void;
}) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [changing, setChanging] = useState<string | null>(null);

  const actions = STATUS_NEXT[req.status] ?? [];
  if (!actions.length) return null;

  async function changeStatus(newStatus: string) {
    setChanging(newStatus);
    try {
      await apiRequest("PATCH", `/api/field/requests/${req.id}/status`, { status: newStatus });
      toast({ title: t.reqStatusUpdated });
      onStatusChanged();
    } catch (err: any) {
      toast({ title: t.errorTitle, description: err.message, variant: "destructive" });
    } finally {
      setChanging(null);
    }
  }

  return (
    <div>
      <p style={{ fontSize: 10, fontWeight: 700, color: F.textMuted, fontFamily: FONT_COND, letterSpacing: "0.07em", marginBottom: 8 }}>
        {t.reqChangeStatus.toUpperCase()}
      </p>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {actions.map(action => {
          const isChanging = changing === action.status;
          return (
            <button
              key={action.status}
              type="button"
              onClick={() => changeStatus(action.status)}
              disabled={!!changing}
              data-testid={`btn-status-${action.status}-${req.id}`}
              style={{
                padding: "7px 14px", borderRadius: 8,
                background: action.danger ? F.dangerBg : action.accent ? F.accent : F.surface,
                border: `1px solid ${action.danger ? F.dangerBorder : action.accent ? F.accent : F.borderStrong}`,
                color: action.danger ? F.danger : action.accent ? F.accentText : F.textMuted,
                fontSize: 11, fontWeight: 800, fontFamily: FONT_BEBAS, letterSpacing: "0.07em",
                cursor: changing ? "default" : "pointer",
                opacity: changing && !isChanging ? 0.5 : 1,
                display: "flex", alignItems: "center", gap: 5, transition: "all 0.15s",
              }}
            >
              {isChanging
                ? <Loader2 style={{ width: 11, height: 11, animation: "spin 1s linear infinite" }} />
                : null
              }
              {action.label(t)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Request card ──────────────────────────────────────────────────────────────

function RequestCard({
  req,
  projects,
  canManage,
  onStatusChanged,
}: {
  req: MaterialRequest;
  projects: Project[];
  canManage: boolean;
  onStatusChanged: () => void;
}) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);

  let items: CartItem[] = [];
  try { items = JSON.parse(req.itemsJson || "[]"); } catch { items = []; }

  const project = req.projectId ? projects.find(p => p.id === req.projectId) : null;
  const requesterDisplay = req.requesterName || req.submittedByName || null;

  // Unique source locations from items
  const sourceLocations = Array.from(
    new Set(items.map(i => i.locationName).filter(Boolean) as string[])
  );

  const submittedAt = req.submittedAt ? new Date(req.submittedAt) : null;
  const dateStr = submittedAt
    ? submittedAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : "—";
  const timeStr = submittedAt
    ? submittedAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : "";

  const isFinal = req.status === "completed" || req.status === "cancelled";

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
      {/* ── Card header (always visible) ── */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        data-testid={`btn-request-expand-${req.id}`}
        style={{
          width: "100%", padding: "11px 14px",
          background: "transparent", border: "none", cursor: "pointer",
          display: "flex", flexDirection: "column", gap: 6, textAlign: "left",
        }}
      >
        {/* Row 1: REQ# + badges + count + date */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{
            fontSize: 13, fontWeight: 800, color: F.accent,
            fontFamily: FONT_MONO, letterSpacing: "0.05em", flexShrink: 0,
          }}>
            {req.requestNumber}
          </span>

          <StatusBadge status={req.status} />
          <TypeBadge type={req.requestType ?? "issue"} />

          <div style={{ flex: 1, minWidth: 0 }} />

          <span style={{ fontSize: 10, color: F.textMuted, fontFamily: FONT_COND, flexShrink: 0 }}>
            {items.length} {t.reqItems}
          </span>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}>
            <span style={{ fontSize: 10, color: F.textMuted, fontFamily: FONT_COND }}>{dateStr}</span>
            <span style={{ fontSize: 9, color: F.textDim, fontFamily: FONT_COND }}>{timeStr}</span>
          </div>
          {expanded
            ? <ChevronUp  style={{ width: 14, height: 14, color: F.textDim, flexShrink: 0 }} />
            : <ChevronDown style={{ width: 14, height: 14, color: F.textDim, flexShrink: 0 }} />
          }
        </div>

        {/* Row 2: Requester + Project */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {requesterDisplay && (
            <span style={{ fontSize: 11, fontWeight: 700, color: F.text, fontFamily: FONT_COND }}>
              {requesterDisplay}
              {req.requesterRole && (
                <span style={{
                  marginLeft: 5, fontSize: 9, fontWeight: 800, color: F.textMuted,
                  fontFamily: FONT_COND, background: F.surface,
                  border: `1px solid ${F.borderStrong}`, borderRadius: 4, padding: "1px 5px",
                  letterSpacing: "0.04em",
                }}>
                  {req.requesterRole}
                </span>
              )}
            </span>
          )}
          {project && (
            <>
              {requesterDisplay && <span style={{ fontSize: 10, color: F.textDim, fontFamily: FONT_COND }}>·</span>}
              <span style={{ fontSize: 11, color: F.textMuted, fontFamily: FONT_COND }}>
                {project.name}
                {project.poNumber ? ` / ${project.poNumber}` : ""}
              </span>
            </>
          )}
          {!requesterDisplay && !project && (
            <span style={{ fontSize: 10, color: F.textDim, fontFamily: FONT_COND }}>—</span>
          )}
        </div>
      </button>

      {/* ── Expanded detail ── */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${F.border}` }}>

          {/* Source locations */}
          {sourceLocations.length > 0 && (
            <div style={{ padding: "8px 14px", borderBottom: `1px solid ${F.border}`, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10, color: F.textMuted, fontFamily: FONT_COND }}>{t.reqLocations}:</span>
              {sourceLocations.map(loc => (
                <span key={loc} style={{
                  fontSize: 10, color: F.textMuted, fontFamily: FONT_COND,
                  background: F.surface, border: `1px solid ${F.borderStrong}`,
                  borderRadius: 5, padding: "1px 7px",
                }}>
                  {loc}
                </span>
              ))}
            </div>
          )}

          {/* Submitted by (if different from requester) */}
          {req.submittedByName && req.requesterName && req.submittedByName !== req.requesterName && (
            <div style={{ padding: "6px 14px", borderBottom: `1px solid ${F.border}`, display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 10, color: F.textMuted, fontFamily: FONT_COND }}>{t.reqSubmittedByLabel}:</span>
              <span style={{ fontSize: 10, color: F.textMuted, fontFamily: FONT_COND }}>{req.submittedByName}</span>
            </div>
          )}

          {/* Notes */}
          {req.notes && (
            <div style={{ padding: "8px 14px", borderBottom: `1px solid ${F.border}` }}>
              <span style={{ fontSize: 10, color: F.textMuted, fontFamily: FONT_COND }}>{t.reqNoteLabel}: </span>
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
                    {(item.sizeLabel || item.sku || item.locationName) && (
                      <div style={{ display: "flex", gap: 5, marginTop: 1, flexWrap: "wrap" }}>
                        {item.sizeLabel && <span style={{ fontSize: 9, color: F.textMuted, fontFamily: FONT_COND }}>{item.sizeLabel}</span>}
                        <span style={{ fontSize: 9, color: F.textDim, fontFamily: FONT_COND }}>{item.sku}</span>
                        {item.locationName && <span style={{ fontSize: 9, color: F.textDim, fontFamily: FONT_COND }}>@ {item.locationName}</span>}
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
            <p style={{ padding: "12px 14px", fontSize: 11, color: F.textDim, fontFamily: FONT_COND }}>{t.noItemsRecorded}</p>
          )}

          {/* Fulfillment reference (completed only) */}
          {req.status === "completed" && req.fulfilledMovementId != null && (
            <div style={{
              padding: "10px 14px", borderTop: `1px solid ${F.border}`,
              display: "flex", alignItems: "center", gap: 8,
              background: "rgba(45,219,111,0.04)",
            }}>
              <CheckCircle2 style={{ width: 14, height: 14, color: F.accent, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: F.accent, fontFamily: FONT_COND, fontWeight: 700 }}>
                {t.reqFulfilled} #{req.fulfilledMovementId}
              </span>
            </div>
          )}

          {/* Status controls (admin/manager only, non-final states) */}
          {canManage && !isFinal && (
            <div style={{ padding: "12px 14px", borderTop: `1px solid ${F.border}`, background: F.surface }}>
              <StatusActions req={req} onStatusChanged={onStatusChanged} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function FieldRequestsList() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const canManage = user?.role === "admin" || user?.role === "manager";

  const { data: requests = [], isLoading: reqLoading } = useQuery<MaterialRequest[]>({
    queryKey: ["/api/field/requests"],
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  function handleStatusChanged() {
    queryClient.invalidateQueries({ queryKey: ["/api/field/requests"] });
  }

  if (reqLoading) {
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
        <RequestCard
          key={req.id}
          req={req}
          projects={projects}
          canManage={canManage}
          onStatusChanged={handleStatusChanged}
        />
      ))}
    </div>
  );
}
