import { useState, useMemo } from "react";
import { useSearch, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMovements, useBulkDeleteMovements, useBulkRestoreMovements } from "@/hooks/use-transactions";
import { useAuth } from "@/hooks/use-auth";
import { Search, ClipboardList, ImageOff, CalendarDays, Trash2, X, AlertTriangle, FileText, RotateCcw, Check, Clock, Edit2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format, startOfDay, endOfDay, formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { EditTransactionDrawer, EditSuccessToast } from "@/components/EditTransactionDrawer";

// ─── Field Type Badge ─────────────────────────────────────────────────────────

function FieldTypeBadge({ type }: { type: string }) {
  const config: Record<string, { label: string; bg: string; color: string; border: string }> = {
    issue:    { label: "ISSUED",    bg: "rgba(255,80,80,0.10)",   color: "#ff5050", border: "1px solid rgba(255,80,80,0.22)" },
    receive:  { label: "RECEIVED",  bg: "rgba(45,219,111,0.10)",  color: "#2ddb6f", border: "1px solid rgba(45,219,111,0.22)" },
    return:   { label: "RETURNED",  bg: "rgba(45,219,111,0.10)",  color: "#2ddb6f", border: "1px solid rgba(45,219,111,0.22)" },
    transfer: { label: "TRANSFER",  bg: "rgba(91,156,246,0.12)",  color: "#5b9cf6", border: "1px solid rgba(91,156,246,0.22)" },
    adjust:   { label: "ADJUSTED",  bg: "rgba(245,166,35,0.10)",  color: "#f5a623", border: "1px solid rgba(245,166,35,0.22)" },
  };
  const { label, bg, color, border } = config[type] || { label: type.toUpperCase(), bg: "rgba(100,116,139,0.10)", color: "#7aab82", border: "1px solid rgba(100,116,139,0.25)" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      background: bg, color, border, borderRadius: 5,
      fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em",
      padding: "2px 7px", whiteSpace: "nowrap",
      fontFamily: "'Barlow Condensed', sans-serif",
    }}>
      {label}
    </span>
  );
}

// ─── Photo Cell ───────────────────────────────────────────────────────────────

function PhotoCell({ imageUrl, name }: { imageUrl?: string | null; name: string }) {
  if (!imageUrl) {
    return (
      <div style={{ width: 32, height: 32, borderRadius: 6, background: "#162019", border: "1px solid #2a4030", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <ImageOff style={{ width: 13, height: 13, color: "#4a7052" }} />
      </div>
    );
  }
  return (
    <img
      src={imageUrl}
      alt={name}
      style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover", flexShrink: 0, border: "1px solid #2a4030" }}
      onError={e => {
        const p = e.currentTarget.parentElement;
        if (p) p.innerHTML = '<div style="width:32px;height:32px;border-radius:6px;background:#162019;border:1px solid #2a4030;display:flex;align-items:center;justify-content:center"><svg style="width:13px;height:13px;color:#4a7052" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg></div>';
      }}
    />
  );
}

// ─── Qty color ────────────────────────────────────────────────────────────────

function qtyColor(type: string): string {
  if (type === "issue") return "#ff5050";
  if (type === "transfer") return "#5b9cf6";
  return "#2ddb6f"; // receive, return, adjust
}

// ─── Shared input style ───────────────────────────────────────────────────────

const INPUT_STYLE: React.CSSProperties = {
  background: "#1c2b1f",
  border: "1px solid #2a4030",
  borderRadius: 7,
  padding: "8px 10px",
  color: "#e2f0e5",
  fontSize: 12,
  width: "100%",
  outline: "none",
};

const LABEL_STYLE: React.CSSProperties = {
  display: "block",
  fontSize: 9,
  fontWeight: 700,
  color: "#4a7052",
  textTransform: "uppercase",
  letterSpacing: "1.2px",
  marginBottom: 5,
};

// ─── Draft Type Badge ─────────────────────────────────────────────────────────

const DRAFT_PULSE_CSS = `
@keyframes draft-pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
.draft-pulse-dot { animation: draft-pulse 2s ease-in-out infinite; }
`;

function DraftTypeBadge({ type }: { type: string }) {
  const config: Record<string, { label: string; bg: string; color: string; border: string }> = {
    issue:    { label: "ISSUE",    bg: "rgba(255,80,80,0.10)",   color: "#ff5050", border: "1px solid rgba(255,80,80,0.22)" },
    receive:  { label: "RECEIVE",  bg: "rgba(45,219,111,0.10)",  color: "#2ddb6f", border: "1px solid rgba(45,219,111,0.22)" },
    return:   { label: "RETURN",   bg: "rgba(45,219,111,0.10)",  color: "#2ddb6f", border: "1px solid rgba(45,219,111,0.22)" },
    transfer: { label: "TRANSFER", bg: "rgba(91,156,246,0.12)",  color: "#5b9cf6", border: "1px solid rgba(91,156,246,0.22)" },
  };
  const { label, bg, color, border } = config[type] || { label: type.toUpperCase(), bg: "rgba(100,116,139,0.10)", color: "#7aab82", border: "1px solid rgba(100,116,139,0.25)" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", background: bg, color, border, borderRadius: 5, fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", padding: "2px 7px", whiteSpace: "nowrap", fontFamily: "'Barlow Condensed', sans-serif" }}>
      {label}
    </span>
  );
}

// ─── Draft Movements List ─────────────────────────────────────────────────────

function DraftMovementsList() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [confirmingDraft, setConfirmingDraft] = useState<any | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const { data: drafts = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/drafts"],
  });

  const MOVTYPE_LABEL: Record<string, string> = { issue: "Issue", receive: "Receive", return: "Return", transfer: "Transfer" };

  async function handleConfirm() {
    if (!confirmingDraft) return;
    setConfirmLoading(true);
    try {
      const res = await fetch(`/api/drafts/${confirmingDraft.id}/confirm`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.message || "Failed to confirm draft");
      }
      await qc.invalidateQueries({ queryKey: ["/api/drafts"] });
      await qc.invalidateQueries({ queryKey: ["/api/movements"] });
      await qc.invalidateQueries({ queryKey: ["/api/items"] });
      setConfirmingDraft(null);
      toast({ title: "Draft confirmed", description: "Inventory has been updated." });
      navigate("/field/transactions");
    } catch (err: any) {
      toast({ title: "Confirm failed", description: err.message, variant: "destructive" });
    } finally {
      setConfirmLoading(false);
    }
  }

  async function handleDelete(id: number) {
    setDeleteLoading(true);
    try {
      await fetch(`/api/drafts/${id}`, { method: "DELETE", credentials: "include" });
      await qc.invalidateQueries({ queryKey: ["/api/drafts"] });
      setDeletingId(null);
      toast({ title: "Draft deleted" });
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    } finally {
      setDeleteLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: "60px 0", fontSize: 13, color: "#7aab82" }}>Loading drafts…</div>
    );
  }

  if (drafts.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 0" }}>
        <FileText style={{ width: 36, height: 36, color: "#2a4030", margin: "0 auto 12px" }} />
        <p style={{ fontSize: 14, fontWeight: 600, color: "#4a7052" }}>No draft movements</p>
        <p style={{ fontSize: 12, color: "#2a4030", marginTop: 4 }}>Saved drafts will appear here.</p>
      </div>
    );
  }

  return (
    <>
      <style>{DRAFT_PULSE_CSS}</style>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {drafts.map(draft => {
          const draftItems: any[] = (() => { try { return JSON.parse(draft.itemsJson || "[]"); } catch { return []; } })();
          const previewItems = draftItems.slice(0, 2);
          const extraCount = draftItems.length - 2;
          const fromName = draft.sourceLocation?.name;
          const toName = draft.destinationLocation?.name;
          const projectName = draft.project?.name;

          return (
            <div
              key={draft.id}
              data-testid={`draft-card-${draft.id}`}
              style={{ background: "#162019", border: "1px solid #2a4030", borderRadius: 12, overflow: "hidden" }}
            >
              {/* Top accent */}
              <div style={{ height: 2, background: "linear-gradient(90deg, #f5a623, rgba(245,166,35,0.3))" }} />

              <div style={{ padding: "14px 16px" }}>
                {/* Row 1: type + status badge */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                  <DraftTypeBadge type={draft.movementType} />
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(245,166,35,0.10)", border: "1px solid rgba(245,166,35,0.25)", borderRadius: 5, fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", padding: "2px 7px", color: "#f5a623", fontFamily: "'Barlow Condensed', sans-serif" }}>
                    <span className="draft-pulse-dot" style={{ width: 5, height: 5, borderRadius: "50%", background: "#f5a623", flexShrink: 0, display: "inline-block" }} />
                    Draft
                  </span>
                  <span style={{ fontSize: 10, color: "#4a7052", marginLeft: "auto", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.3 }}>
                    Inventory not affected
                  </span>
                </div>

                {/* Row 2: Route */}
                {(fromName || toName) && (
                  <div style={{ fontSize: 12, color: "#e2f0e5", marginBottom: 8, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ color: "#7aab82" }}>{fromName || "—"}</span>
                    <span style={{ color: "#4a7052" }}>→</span>
                    <span style={{ color: "#e2f0e5" }}>{toName || "—"}</span>
                    {projectName && (
                      <span style={{ marginLeft: 4, fontSize: 10, color: "#5b9cf6", background: "rgba(91,156,246,0.08)", border: "1px solid rgba(91,156,246,0.18)", borderRadius: 4, padding: "1px 6px" }}>
                        {projectName}
                      </span>
                    )}
                  </div>
                )}

                {/* Row 3: Item pills */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
                  {previewItems.map((di: any, idx: number) => (
                    <span key={idx} style={{ fontSize: 10, background: "#1c2b1f", border: "1px solid #2a4030", borderRadius: 5, padding: "3px 8px", color: "#c8deca", fontFamily: "'Barlow Condensed', sans-serif" }}>
                      {di.itemName || `Item #${di.itemId}`} · <strong style={{ color: "#2ddb6f" }}>{di.qty}</strong>{di.unit ? ` ${di.unit}` : ""}
                    </span>
                  ))}
                  {extraCount > 0 && (
                    <span style={{ fontSize: 10, background: "#1c2b1f", border: "1px solid #2a4030", borderRadius: 5, padding: "3px 8px", color: "#7aab82", fontFamily: "'Barlow Condensed', sans-serif" }}>
                      +{extraCount} more
                    </span>
                  )}
                  {draftItems.length === 0 && (
                    <span style={{ fontSize: 10, color: "#4a7052" }}>No items</span>
                  )}
                </div>

                {/* Row 4: Saved by + time */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
                  <Clock style={{ width: 11, height: 11, color: "#4a7052" }} />
                  <span style={{ fontSize: 10, color: "#4a7052" }}>
                    {draft.savedByName ? `${draft.savedByName} · ` : ""}
                    {draft.savedAt ? format(new Date(draft.savedAt), "MMM d, yyyy HH:mm") : "—"}
                  </span>
                </div>

                {/* Row 5: Action buttons */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    data-testid={`button-resume-draft-${draft.id}`}
                    onClick={() => navigate(`/field/movement?type=${draft.movementType === "receive" || draft.movementType === "return" ? "receive" : "issue"}&draftId=${draft.id}`)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#1c2b1f", border: "1px solid #2a4030", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 600, color: "#7aab82", cursor: "pointer", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.3 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#7aab82"; (e.currentTarget as HTMLElement).style.color = "#e2f0e5"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#2a4030"; (e.currentTarget as HTMLElement).style.color = "#7aab82"; }}
                  >
                    <RotateCcw style={{ width: 12, height: 12 }} />
                    Resume
                  </button>
                  <button
                    type="button"
                    data-testid={`button-confirm-draft-${draft.id}`}
                    onClick={() => setConfirmingDraft(draft)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(45,219,111,0.10)", border: "1px solid rgba(45,219,111,0.25)", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 600, color: "#2ddb6f", cursor: "pointer", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.3 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(45,219,111,0.18)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(45,219,111,0.10)"; }}
                  >
                    <Check style={{ width: 12, height: 12 }} />
                    Confirm
                  </button>
                  <button
                    type="button"
                    data-testid={`button-delete-draft-${draft.id}`}
                    onClick={() => setDeletingId(draft.id)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.18)", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 600, color: "#ff5050", cursor: "pointer", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.3 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,80,80,0.15)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,80,80,0.08)"; }}
                  >
                    <Trash2 style={{ width: 12, height: 12 }} />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirm Draft Modal */}
      <Dialog open={!!confirmingDraft} onOpenChange={open => { if (!open) setConfirmingDraft(null); }}>
        <DialogContent style={{ background: "#0f1612", border: "1px solid #2a4030", borderRadius: 14, maxWidth: 480 }} className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle style={{ color: "#e2f0e5", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700 }}>
              Confirm & Apply to Inventory
            </DialogTitle>
          </DialogHeader>
          {confirmingDraft && (() => {
            const draftItems: any[] = (() => { try { return JSON.parse(confirmingDraft.itemsJson || "[]"); } catch { return []; } })();
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 4 }}>
                {/* Summary */}
                <div style={{ background: "#162019", border: "1px solid #2a4030", borderRadius: 9, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <DraftTypeBadge type={confirmingDraft.movementType} />
                    <span style={{ fontSize: 12, color: "#7aab82" }}>
                      {confirmingDraft.sourceLocation?.name && confirmingDraft.destinationLocation?.name
                        ? `${confirmingDraft.sourceLocation.name} → ${confirmingDraft.destinationLocation.name}`
                        : confirmingDraft.sourceLocation?.name || confirmingDraft.destinationLocation?.name || ""}
                    </span>
                  </div>
                  {confirmingDraft.project?.name && (
                    <span style={{ fontSize: 11, color: "#5b9cf6" }}>Project: {confirmingDraft.project.name}</span>
                  )}
                  {confirmingDraft.note && (
                    <span style={{ fontSize: 11, color: "#7aab82" }}>Note: {confirmingDraft.note}</span>
                  )}
                </div>

                {/* Items list */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 200, overflowY: "auto" }}>
                  {draftItems.map((di: any, idx: number) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1c2b1f", border: "1px solid #2a4030", borderRadius: 7, padding: "8px 12px" }}>
                      <div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#e2f0e5" }}>{di.itemName || `Item #${di.itemId}`}</span>
                        {di.sku && <span style={{ fontSize: 10, color: "#4a7052", marginLeft: 6 }}>{di.sku}</span>}
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#2ddb6f", fontFamily: "'Barlow Condensed', sans-serif" }}>
                        {di.qty} <span style={{ fontSize: 10, color: "#7aab82" }}>{di.unit}</span>
                      </span>
                    </div>
                  ))}
                </div>

                {/* Warning */}
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "rgba(255,80,80,0.07)", border: "1px solid rgba(255,80,80,0.18)", borderRadius: 8, padding: "10px 12px" }}>
                  <AlertTriangle style={{ width: 14, height: 14, color: "#ff5050", flexShrink: 0, marginTop: 1 }} />
                  <p style={{ fontSize: 11, color: "#ff5050", lineHeight: 1.5 }}>
                    This will update inventory immediately and cannot be undone.
                  </p>
                </div>

                {/* Buttons */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setConfirmingDraft(null)}
                    style={{ background: "#1c2b1f", border: "1px solid #2a4030", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, color: "#7aab82", cursor: "pointer", fontFamily: "'Barlow Condensed', sans-serif" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={confirmLoading}
                    data-testid="button-execute-confirm-draft"
                    style={{ background: "#2ddb6f", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 700, color: "#07090a", cursor: confirmLoading ? "not-allowed" : "pointer", fontFamily: "'Barlow Condensed', sans-serif", opacity: confirmLoading ? 0.7 : 1 }}
                  >
                    {confirmLoading ? "Applying…" : "Confirm & Apply to Inventory"}
                  </button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Delete Draft Confirm */}
      <Dialog open={!!deletingId} onOpenChange={open => { if (!open) setDeletingId(null); }}>
        <DialogContent style={{ background: "#0f1612", border: "1px solid #2a4030", borderRadius: 14, maxWidth: 380 }} className="max-w-[380px]">
          <DialogHeader>
            <DialogTitle style={{ color: "#e2f0e5", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, fontWeight: 700, display: "flex", alignItems: "center", gap: 7 }}>
              <AlertTriangle style={{ width: 18, height: 18, color: "#ff5050" }} />
              Delete Draft?
            </DialogTitle>
          </DialogHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 4 }}>
            <p style={{ fontSize: 13, color: "#7aab82", lineHeight: 1.5 }}>
              This draft will be permanently deleted. No inventory changes will be made.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                style={{ background: "#1c2b1f", border: "1px solid #2a4030", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, color: "#7aab82", cursor: "pointer", fontFamily: "'Barlow Condensed', sans-serif" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deletingId && handleDelete(deletingId)}
                disabled={deleteLoading}
                data-testid="button-execute-delete-draft"
                style={{ background: "rgba(255,80,80,0.15)", border: "1px solid rgba(255,80,80,0.3)", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, color: "#ff5050", cursor: deleteLoading ? "not-allowed" : "pointer", fontFamily: "'Barlow Condensed', sans-serif", opacity: deleteLoading ? 0.7 : 1 }}
              >
                {deleteLoading ? "Deleting…" : "Delete Draft"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FieldTransactions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const hasDeletePerm = user?.role === "staff" || user?.role === "admin";
  const urlSearch = useSearch();
  const urlSearchParams = new URLSearchParams(urlSearch);
  const [activeTab, setActiveTab] = useState<"history" | "drafts">(
    urlSearchParams.get("tab") === "drafts" ? "drafts" : "history"
  );

  const [search, setSearch]       = useState("");
  const [fromFilter, setFrom]     = useState("all");
  const [toFilter, setTo]         = useState("all");
  const [projectFilter, setProj]  = useState("all");
  const [dateFrom, setDateFrom]   = useState("");
  const [dateTo, setDateTo]       = useState("");

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editTx, setEditTx]           = useState<any | null>(null);
  const [successToast, setSuccessToast] = useState<{ txId: number } | null>(null);

  // Pagination
  const [pageSize, setPageSize]     = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  const { data: movements, isLoading } = useMovements();
  const bulkDelete  = useBulkDeleteMovements();
  const bulkRestore = useBulkRestoreMovements();

  const { fromOptions, toOptions, projectOptions } = useMemo(() => {
    const froms = new Map<string, string>();
    const tos   = new Map<string, string>();
    const projs = new Map<string, string>();
    (movements ?? []).forEach(m => {
      const mx = m as any;
      if (mx.sourceLocation) froms.set(String(mx.sourceLocation.id), mx.sourceLocation.name);
      if (mx.destinationLocation) tos.set(String(mx.destinationLocation.id), mx.destinationLocation.name);
      if (mx.project) projs.set(String(mx.project.id), mx.project.poNumber
        ? `${mx.project.name} / ${mx.project.poNumber}`
        : mx.project.name);
    });
    return {
      fromOptions:    Array.from(froms.entries()),
      toOptions:      Array.from(tos.entries()),
      projectOptions: Array.from(projs.entries()),
    };
  }, [movements]);

  const filtered = (movements ?? []).filter(m => {
    const mx      = m as any;
    const item    = mx.item;
    const itemName = item?.name?.toLowerCase() ?? "";
    const sku      = item?.sku?.toLowerCase() ?? "";
    const q        = search.toLowerCase();
    if (q && !itemName.includes(q) && !sku.includes(q) && !String(m.id).includes(q)) return false;
    if (fromFilter !== "all" && String(mx.sourceLocation?.id) !== fromFilter) return false;
    if (toFilter   !== "all" && String(mx.destinationLocation?.id) !== toFilter) return false;
    if (projectFilter !== "all" && String(mx.project?.id) !== projectFilter) return false;
    const moved = new Date(m.createdAt ?? "");
    if (dateFrom) {
      const from = startOfDay(new Date(dateFrom + "T00:00:00"));
      if (moved < from) return false;
    }
    if (dateTo) {
      const to = endOfDay(new Date(dateTo + "T00:00:00"));
      if (moved > to) return false;
    }
    return true;
  });

  const totalPages    = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage      = Math.min(currentPage, totalPages);
  const paginated     = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const paginatedIds  = paginated.map(m => m.id);
  const allSelected   = paginatedIds.length > 0 && paginatedIds.every(id => selectedIds.has(id));

  function toggleRow(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        paginatedIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        paginatedIds.forEach(id => next.add(id));
        return next;
      });
    }
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function handleDelete() {
    const ids = Array.from(selectedIds);
    const count = ids.length;

    const snapshots = (movements ?? [])
      .filter(m => selectedIds.has(m.id))
      .map(m => {
        const raw = m as any;
        return {
          itemId: raw.itemId,
          movementType: raw.movementType,
          quantity: raw.quantity,
          previousQuantity: raw.previousQuantity,
          newQuantity: raw.newQuantity,
          sourceLocationId: raw.sourceLocationId ?? null,
          destinationLocationId: raw.destinationLocationId ?? null,
          projectId: raw.projectId ?? null,
          unitCostSnapshot: raw.unitCostSnapshot ?? null,
          referenceType: raw.referenceType ?? null,
          referenceId: raw.referenceId ?? null,
          note: raw.note ?? null,
          reason: raw.reason ?? null,
          createdBy: raw.createdBy ?? null,
          createdAt: raw.createdAt ?? null,
        };
      });

    try {
      await bulkDelete.mutateAsync(ids);
      clearSelection();
      setConfirmOpen(false);
      toast({
        title: `${count} transaction${count !== 1 ? "s" : ""} deleted`,
        duration: 8000,
        action: (
          <button
            className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
            onClick={async () => {
              try {
                await bulkRestore.mutateAsync(snapshots);
                toast({ title: `${count} transaction${count !== 1 ? "s" : ""} restored` });
              } catch (err: any) {
                toast({ title: "Restore failed", description: err.message, variant: "destructive" });
              }
            }}
          >
            Undo
          </button>
        ) as any,
      });
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
  }

  function exportCsv() {
    const rows = [
      ["#", "Type", "SKU", "Item", "Size", "Qty", "Unit", "From", "To", "Project", "PO", "Note", "Date"],
      ...filtered.map((m, idx) => {
        const mx = m as any;
        const item = mx.item;
        return [
          idx + 1,
          m.movementType,
          item?.sku ?? "",
          item?.name ?? m.itemId,
          item?.sizeLabel ?? "",
          m.quantity,
          item?.unitOfMeasure ?? "",
          mx.sourceLocation?.name ?? "",
          mx.destinationLocation?.name ?? "",
          mx.project?.name ?? "",
          mx.project?.poNumber ?? "",
          m.note ?? "",
          m.createdAt ? format(new Date(m.createdAt), "yyyy-MM-dd HH:mm") : "",
        ];
      }),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const selCount = selectedIds.size;
  const canEdit = selCount === 1;
  const canDelete = selCount >= 1;
  const selectedTx = selCount === 1
    ? (filtered ?? []).find((m) => selectedIds.has(m.id)) ?? null
    : null;

  const COLS_COUNT = 11;

  // ── TH style ──
  const TH: React.CSSProperties = {
    fontSize: 9,
    fontWeight: 700,
    color: "#7aab82",
    textTransform: "uppercase",
    letterSpacing: "1px",
    padding: "10px 8px",
    whiteSpace: "nowrap",
    background: "#162019",
  };

  return (
    <div className="space-y-4 pt-5 pb-8">

      {/* ── Header ── */}
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <ClipboardList style={{ width: 20, height: 20, color: "#2ddb6f" }} />
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#e2f0e5", fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.04em" }}>
            Transactions
          </h1>
        </div>
        <p style={{ fontSize: 13, color: "#7aab82" }}>
          {selCount > 0 ? `${selCount} selected` : "View transaction history."}
        </p>
      </div>

      {/* ── Tab Switcher + Export CSV ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 2, background: "#0d1410", border: "1px solid #2a4030", borderRadius: 10, padding: 3, width: "fit-content" }}>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            data-testid="tab-history"
            style={{ background: activeTab === "history" ? "#1c2b1f" : "transparent", border: activeTab === "history" ? "1px solid #2a4030" : "1px solid transparent", borderRadius: 8, padding: "6px 16px", fontSize: 12, fontWeight: 700, color: activeTab === "history" ? "#e2f0e5" : "#4a7052", cursor: "pointer", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5, transition: "all 0.15s" }}
          >
            Transaction History
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("drafts")}
            data-testid="tab-drafts"
            style={{ background: activeTab === "drafts" ? "#1c2b1f" : "transparent", border: activeTab === "drafts" ? "1px solid #2a4030" : "1px solid transparent", borderRadius: 8, padding: "6px 16px", fontSize: 12, fontWeight: 700, color: activeTab === "drafts" ? "#f5a623" : "#4a7052", cursor: "pointer", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5, transition: "all 0.15s", display: "flex", alignItems: "center", gap: 5 }}
          >
            <FileText style={{ width: 12, height: 12 }} />
            Draft Movements
          </button>
        </div>

        {/* Export CSV — upper-right, only in history tab */}
        {activeTab === "history" && filtered.length > 0 && (
          <button
            onClick={exportCsv}
            data-testid="btn-export-csv"
            style={{ fontSize: 11, color: "#7aab82", background: "#1c2b1f", border: "1px solid #2a4030", borderRadius: 7, padding: "5px 13px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600 }}
          >
            Export CSV ↓
          </button>
        )}
      </div>

      {/* ── Drafts Tab Content ── */}
      {activeTab === "drafts" && <DraftMovementsList />}

      {/* ── History Tab Content ── */}
      {activeTab === "history" && <>

      {/* ── Filter Bar ── */}
      <div style={{ background: "#162019", border: "1px solid #2a4030", borderRadius: 12, padding: "14px 16px" }}>
        <div className="grid gap-3" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr" }}>

          {/* Search */}
          <div>
            <label style={LABEL_STYLE}>Search</label>
            <div style={{ position: "relative" }}>
              <Search style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", width: 13, height: 13, color: "#4a7052", pointerEvents: "none" }} />
              <input
                type="text"
                placeholder="Item / SKU / ID…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                data-testid="field-tx-search"
                style={{ ...INPUT_STYLE, paddingLeft: 28, fontFamily: "'Barlow', sans-serif" }}
                onFocus={e => { e.currentTarget.style.borderColor = "#2ddb6f"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(45,219,111,0.12)"; }}
                onBlur={e => { e.currentTarget.style.borderColor = "#2a4030"; e.currentTarget.style.boxShadow = "none"; }}
              />
            </div>
          </div>

          {/* From */}
          <div>
            <label style={LABEL_STYLE}>From</label>
            <Select value={fromFilter} onValueChange={setFrom}>
              <SelectTrigger
                className="w-full h-[37px] text-xs"
                style={{ background: "#1c2b1f", border: "1px solid #2a4030", color: "#e2f0e5", borderRadius: 7 }}
                data-testid="field-tx-from-filter"
              >
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {fromOptions.map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* To */}
          <div>
            <label style={LABEL_STYLE}>To</label>
            <Select value={toFilter} onValueChange={setTo}>
              <SelectTrigger
                className="w-full h-[37px] text-xs"
                style={{ background: "#1c2b1f", border: "1px solid #2a4030", color: "#e2f0e5", borderRadius: 7 }}
                data-testid="field-tx-to-filter"
              >
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {toOptions.map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Project */}
          <div>
            <label style={LABEL_STYLE}>Project</label>
            <Select value={projectFilter} onValueChange={setProj}>
              <SelectTrigger
                className="w-full h-[37px] text-xs"
                style={{ background: "#1c2b1f", border: "1px solid #2a4030", color: "#e2f0e5", borderRadius: 7 }}
                data-testid="field-tx-project-filter"
              >
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {projectOptions.map(([id, label]) => (
                  <SelectItem key={id} value={id}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date From */}
          <div>
            <label style={LABEL_STYLE}>Date From</label>
            <div style={{ position: "relative" }}>
              <CalendarDays style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", width: 12, height: 12, color: "#4a7052", pointerEvents: "none" }} />
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                data-testid="field-tx-date-from"
                style={{ ...INPUT_STYLE, paddingLeft: 26, colorScheme: "dark" }}
                onFocus={e => { e.currentTarget.style.borderColor = "#2ddb6f"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(45,219,111,0.12)"; }}
                onBlur={e => { e.currentTarget.style.borderColor = "#2a4030"; e.currentTarget.style.boxShadow = "none"; }}
              />
            </div>
          </div>

          {/* Date To */}
          <div>
            <label style={LABEL_STYLE}>Date To</label>
            <div style={{ position: "relative" }}>
              <CalendarDays style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", width: 12, height: 12, color: "#4a7052", pointerEvents: "none" }} />
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                data-testid="field-tx-date-to"
                style={{ ...INPUT_STYLE, paddingLeft: 26, colorScheme: "dark" }}
                onFocus={e => { e.currentTarget.style.borderColor = "#2ddb6f"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(45,219,111,0.12)"; }}
                onBlur={e => { e.currentTarget.style.borderColor = "#2a4030"; e.currentTarget.style.boxShadow = "none"; }}
              />
            </div>
          </div>

        </div>

        {/* Clear dates row */}
        {(dateFrom || dateTo) && (
          <div className="flex justify-end mt-2">
            <button
              onClick={() => { setDateFrom(""); setDateTo(""); }}
              data-testid="field-tx-date-clear"
              style={{ fontSize: 11, color: "#7aab82", background: "none", border: "1px solid #2a4030", borderRadius: 6, padding: "3px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
            >
              <X style={{ width: 11, height: 11 }} /> Clear dates
            </button>
          </div>
        )}
      </div>

      {/* ── Table + Selection Action Panel ── */}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
      {/* Main table */}
      <div style={{ flex: 1, border: "1px solid #2a4030", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ minWidth: 860, width: "100%", tableLayout: "fixed", borderCollapse: "collapse" }}>
            <colgroup>
              <col style={{ width: 46 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 42 }} />
              <col style={{ width: 60 }} />
              <col />
              <col style={{ width: 76 }} />
              <col style={{ width: "13%" }} />
              <col style={{ width: "13%" }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 58 }} />
            </colgroup>
            <thead>
              <tr style={{ borderBottom: "1px solid #2a4030" }}>
                <th style={{ ...TH, textAlign: "center" }}>#</th>
                <th style={{ ...TH, textAlign: "center", paddingRight: 12 }}>Date</th>
                <th style={{ ...TH, textAlign: "center" }}>Type</th>
                <th style={TH}>Photo</th>
                <th style={{ ...TH, textAlign: "center" }}>Size</th>
                <th style={TH}>Item</th>
                <th style={{ ...TH, textAlign: "center" }}>Qty / Unit</th>
                <th style={{ ...TH, textAlign: "center" }}>From → To</th>
                <th style={{ ...TH, textAlign: "center" }}>Project / PO</th>
                <th style={{ ...TH, textAlign: "center" }}>Note</th>
                {/* Select col */}
                <th style={{ ...TH, textAlign: "center", borderLeft: "1px solid #2a4030", background: selectionMode ? "#1a2e1e" : "#162019" }}>
                  {selectionMode ? (
                    <div
                      role="checkbox"
                      aria-checked={allSelected}
                      onClick={toggleAll}
                      data-testid="field-checkbox-select-all-right"
                      title="Select all"
                      style={{ width: 15, height: 15, borderRadius: 4, border: `1.5px solid ${allSelected ? "#2ddb6f" : "#4a7052"}`, background: allSelected ? "#2ddb6f" : "transparent", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}
                    >
                      {allSelected && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="#0d1410" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setSelectionMode(true); setSelectedIds(new Set()); }}
                      data-testid="btn-selection-mode-toggle"
                      style={{
                        background: "none", border: "none", padding: 0,
                        color: "#7aab82", fontSize: 9, fontWeight: 700,
                        fontFamily: "'Barlow Condensed', sans-serif",
                        letterSpacing: "0.06em", textTransform: "uppercase",
                        cursor: "pointer", lineHeight: 1,
                      }}
                    >
                      Select
                    </button>
                  )}
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={COLS_COUNT} style={{ textAlign: "center", padding: "48px 0", fontSize: 13, color: "#7aab82" }}>Loading…</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={COLS_COUNT} style={{ textAlign: "center", padding: "48px 0", fontSize: 13, color: "#7aab82" }}>No transactions found.</td>
                </tr>
              ) : paginated.map((m, idx) => {
                const mx      = m as any;
                const item    = mx.item;
                const fromLoc = mx.sourceLocation;
                const toLoc   = mx.destinationLocation;
                const project = mx.project;
                const isSelected = selectedIds.has(m.id);
                const isEdited = !!(mx.editedAt);
                const projectName = project?.name ?? null;
                const projectPo   = project?.poNumber ?? null;
                const editHistory: any[] = Array.isArray(mx.editHistory) ? mx.editHistory : [];
                const lastEdit = editHistory.length > 0 ? editHistory[editHistory.length - 1] : null;
                const editLabel = lastEdit
                  ? `edited by ${(lastEdit.editedBy ?? "").replace("@tkelectricllc.us","").split("_").map((p: string) => p[0]?.toUpperCase() + p.slice(1)).join(" ")} · ${formatDistanceToNow(new Date(lastEdit.editedAt), { addSuffix: true })}`
                  : "edited";

                return (
                  <tr
                    key={m.id}
                    style={{
                      background: isSelected ? "rgba(45,219,111,0.07)" : "#162019",
                      borderBottom: "1px solid #1e2e21",
                      borderLeft: isSelected ? "3px solid #2ddb6f" : "3px solid transparent",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "#1c2b1f"; }}
                    onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "#162019"; }}
                    data-testid={`field-tx-row-${m.id}`}
                  >
                    {/* No. */}
                    <td style={{ padding: "12px 8px", fontFamily: "monospace", fontSize: 11, color: "#7aab82", textAlign: "center" }}>
                      {(safePage - 1) * pageSize + idx + 1}
                    </td>

                    {/* Date (moved to second column) */}
                    <td style={{ padding: "12px 8px 12px 8px", paddingRight: 12, textAlign: "center" }}>
                      {m.createdAt ? (
                        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.5, alignItems: "center", justifyContent: "center" }}>
                          <span style={{ fontSize: 11, fontWeight: 500, color: "#e2f0e5" }}>
                            {format(new Date(m.createdAt), "MMM d, yyyy")}
                          </span>
                          <span style={{ fontSize: 10, color: "#7aab82" }}>
                            {format(new Date(m.createdAt), "HH:mm")}
                          </span>
                          {isEdited && (
                            <span
                              title={editLabel}
                              data-testid={`field-edited-tag-${m.id}`}
                              style={{
                                marginTop: 3, display: "inline-flex", alignItems: "center", gap: 2,
                                background: "rgba(167,139,250,0.10)", border: "1px solid rgba(167,139,250,0.28)",
                                color: "#a78bfa", padding: "1px 5px", borderRadius: 3,
                                fontSize: 7, fontWeight: 700, letterSpacing: "0.06em",
                                textTransform: "uppercase", whiteSpace: "nowrap", cursor: "default",
                              }}
                            >
                              ✎ EDITED
                            </span>
                          )}
                        </div>
                      ) : <span style={{ color: "#2a4030" }}>—</span>}
                    </td>

                    {/* Type */}
                    <td style={{ padding: "12px 8px", textAlign: "center" }}>
                      <FieldTypeBadge type={m.movementType} />
                    </td>

                    {/* Photo */}
                    <td style={{ padding: "10px 8px" }}>
                      <PhotoCell imageUrl={item?.imageUrl} name={item?.name ?? ""} />
                    </td>

                    {/* Size */}
                    <td style={{ padding: "12px 8px", fontSize: 11, color: "#7aab82", whiteSpace: "nowrap", textAlign: "center" }}>
                      {item?.sizeLabel || <span style={{ color: "#2a4030" }}>—</span>}
                    </td>

                    {/* Item */}
                    <td style={{ padding: "12px 8px" }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "#e2f0e5", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item?.name ?? `#${m.itemId}`}
                      </p>
                      {item?.extractedSubcategory && (
                        <p style={{ fontSize: 10, color: "#7aab82", lineHeight: 1.3, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.extractedSubcategory}
                        </p>
                      )}
                    </td>

                    {/* Qty + Unit */}
                    <td style={{ padding: "12px 8px", whiteSpace: "nowrap", textAlign: "center" }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, color: qtyColor(m.movementType) }}>
                        {m.quantity}
                      </span>
                      {item?.unitOfMeasure && (
                        <span style={{ marginLeft: 4, fontSize: 9, color: "#7aab82", textTransform: "uppercase" }}>
                          {item.unitOfMeasure}
                        </span>
                      )}
                    </td>

                    {/* From → To */}
                    <td style={{ padding: "12px 8px", textAlign: "center" }}>
                      <div style={{ fontSize: 11, lineHeight: 1.5, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ color: "#e2f0e5", fontWeight: 500, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
                          {fromLoc?.name ?? <span style={{ color: "#2a4030" }}>—</span>}
                        </span>
                        <span style={{ color: "#4a7052", fontSize: 9, display: "block" }}>↓</span>
                        <span style={{ color: "#ffffff", fontWeight: 700, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
                          {toLoc?.name ?? "—"}
                        </span>
                      </div>
                    </td>

                    {/* Project / PO */}
                    <td style={{ padding: "12px 8px", textAlign: "center" }}>
                      {projectName || projectPo ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 2, alignItems: "center", justifyContent: "center" }}>
                          {projectName && (
                            <span style={{ fontSize: 11, fontWeight: 600, color: "#e2f0e5", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block", maxWidth: "100%" }}>
                              {projectName}
                            </span>
                          )}
                          {projectPo && (
                            <span style={{ fontSize: 9, color: "#7aab82", lineHeight: 1.3 }}>{projectPo}</span>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: "#2a4030", fontSize: 12 }}>—</span>
                      )}
                    </td>

                    {/* Note */}
                    <td style={{ padding: "12px 8px", fontSize: 11, color: "#7aab82", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {m.note || <span style={{ color: "#2a4030" }}>—</span>}
                    </td>

                    {/* Select */}
                    <td
                      style={{ padding: "12px 6px", textAlign: "center", borderLeft: "1px solid #2a4030", background: isSelected ? "rgba(45,219,111,0.07)" : selectionMode ? "#1a2e1e" : "#162019" }}
                      onClick={e => { if (selectionMode) { e.stopPropagation(); toggleRow(m.id); } }}
                    >
                      {selectionMode ? (
                        <div
                          role="checkbox"
                          aria-checked={isSelected}
                          data-testid={`field-checkbox-sel-${m.id}`}
                          style={{ width: 15, height: 15, borderRadius: 4, border: `1.5px solid ${isSelected ? "#2ddb6f" : "#4a7052"}`, background: isSelected ? "#2ddb6f" : "transparent", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}
                        >
                          {isSelected && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="#0d1410" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </div>
                      ) : (
                        <span style={{ color: "#2a4030", fontSize: 10 }}>·</span>
                      )}
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Persistent action bar (bottom of table) ── */}
        <div style={{
          borderTop: "1px solid #2a4030",
          background: "#0f1a11",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontFamily: "'Barlow Condensed', sans-serif",
        }}>
          {/* Page size button group */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {[10, 15, 25, 35, 45].map(n => {
              const active = pageSize === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => { if (!active) { setPageSize(n); setCurrentPage(1); } }}
                  style={{
                    padding: "7px 13px", borderRadius: 8,
                    background: active ? "rgba(45,219,111,0.09)" : "#162019",
                    border: `1px solid ${active ? "rgba(45,219,111,0.28)" : "#2a4030"}`,
                    color: active ? "#2ddb6f" : "#7aab82",
                    fontFamily: "'JetBrains Mono', 'Fira Mono', monospace",
                    fontSize: 12, fontWeight: 600,
                    cursor: active ? "default" : "pointer",
                    transition: "all 0.12s",
                  }}
                  onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.borderColor = "#3d5e47"; (e.currentTarget as HTMLElement).style.color = "#e2f0e5"; } }}
                  onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.borderColor = "#2a4030"; (e.currentTarget as HTMLElement).style.color = "#7aab82"; } }}
                  data-testid={`btn-page-size-${n}`}
                >
                  {n}
                </button>
              );
            })}
          </div>

          {/* Page indicator + nav */}
          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                data-testid="btn-page-prev"
                style={{ padding: "7px 12px", borderRadius: 8, background: "#162019", border: "1px solid #2a4030", color: safePage <= 1 ? "#2a4030" : "#7aab82", fontSize: 12, fontWeight: 700, cursor: safePage <= 1 ? "default" : "pointer", fontFamily: "monospace" }}
              >‹</button>
              <span style={{ fontSize: 11, color: "#7aab82", fontFamily: "monospace", minWidth: 60, textAlign: "center" }}>
                {safePage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                data-testid="btn-page-next"
                style={{ padding: "7px 12px", borderRadius: 8, background: "#162019", border: "1px solid #2a4030", color: safePage >= totalPages ? "#2a4030" : "#7aab82", fontSize: 12, fontWeight: 700, cursor: safePage >= totalPages ? "default" : "pointer", fontFamily: "monospace" }}
              >›</button>
            </div>
          )}

          <span style={{ fontSize: 11, color: "#7aab82", flex: 1, textAlign: "right" }}>
            Showing <strong style={{ color: "#e2f0e5" }}>{filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)}</strong> of <strong style={{ color: "#e2f0e5" }}>{filtered.length}</strong>
          </span>
        </div>
      </div>

      {/* ── Selection Action Panel (far right, only in selection mode) ── */}
      {selectionMode && (
        <div style={{
          width: 152,
          flexShrink: 0,
          background: "#162019",
          border: "1px solid #2a4030",
          borderRadius: 12,
          padding: "14px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          fontFamily: "'Barlow Condensed', sans-serif",
          alignSelf: "flex-start",
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#4a7052", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {selCount > 0 ? `${selCount} Selected` : "No selection"}
          </span>

          {selCount === 0 && (
            <p style={{ fontSize: 11, color: "#4a7052", lineHeight: 1.4, margin: 0 }}>
              Use checkboxes to select rows.
            </p>
          )}

          {selCount > 0 && (
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              data-testid="button-field-cancel-select"
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, borderRadius: 7, background: "#1c2b1f", border: "1px solid #2a4030", padding: "7px 10px", fontSize: 12, fontWeight: 700, color: "#7aab82", cursor: "pointer", width: "100%" }}
            >
              <X style={{ width: 11, height: 11 }} /> Clear
            </button>
          )}

          {canEdit && hasDeletePerm && (
            <button
              type="button"
              onClick={() => selectedTx && setEditTx(selectedTx)}
              data-testid="button-field-edit-selected"
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, borderRadius: 7, background: "rgba(91,156,246,0.12)", border: "1px solid rgba(91,156,246,0.35)", padding: "7px 10px", fontSize: 12, fontWeight: 700, color: "#5b9cf6", cursor: "pointer", width: "100%" }}
            >
              <Pencil style={{ width: 11, height: 11 }} /> Edit
            </button>
          )}

          {canDelete && hasDeletePerm && (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              data-testid="button-field-delete-selected"
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, borderRadius: 7, background: "rgba(255,80,80,0.14)", border: "1px solid rgba(255,80,80,0.35)", padding: "7px 10px", fontSize: 12, fontWeight: 700, color: "#ff5050", cursor: "pointer", width: "100%" }}
            >
              <Trash2 style={{ width: 11, height: 11 }} /> Delete ({selCount})
            </button>
          )}
        </div>
      )}
      </div>{/* end flex row */}

      </>}

      {/* ── Edit Drawer (dark) ── */}
      {editTx && (
        <EditTransactionDrawer
          tx={editTx}
          open={!!editTx}
          onClose={() => setEditTx(null)}
          dark={true}
          onSaved={(updated) => {
            setEditTx(null);
            setSelectedIds(new Set());
            setSuccessToast({ txId: updated.id ?? editTx.id });
          }}
        />
      )}

      {/* ── Edit success toast (dark) ── */}
      {successToast && (
        <EditSuccessToast
          txId={successToast.txId}
          dark={true}
          onDismiss={() => setSuccessToast(null)}
        />
      )}

      {/* ── Confirm delete dialog (dark-themed) ── */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent style={{ background: "#0d1410", border: "1px solid #2a4030", borderRadius: 14, maxWidth: 400 }} className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle style={{ color: "#e2f0e5", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
              <AlertTriangle style={{ width: 18, height: 18, color: "#ff5050" }} />
              Delete {selectedIds.size} Transaction{selectedIds.size !== 1 ? "s" : ""}?
            </DialogTitle>
          </DialogHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 4 }}>
            <p style={{ fontSize: 13, color: "#7aab82", lineHeight: 1.55 }}>
              Inventory counts will be reversed for all selected transactions. You can undo this within 8 seconds after deletion.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                style={{ background: "#1c2b1f", border: "1px solid #2a4030", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, color: "#7aab82", cursor: "pointer", fontFamily: "'Barlow Condensed', sans-serif" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={bulkDelete.isPending}
                data-testid="button-confirm-delete"
                style={{ background: "rgba(255,80,80,0.15)", border: "1px solid rgba(255,80,80,0.35)", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 700, color: "#ff5050", cursor: bulkDelete.isPending ? "not-allowed" : "pointer", fontFamily: "'Barlow Condensed', sans-serif", opacity: bulkDelete.isPending ? 0.7 : 1, display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Trash2 style={{ width: 13, height: 13 }} />
                {bulkDelete.isPending ? "Deleting…" : `Delete ${selectedIds.size}`}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
