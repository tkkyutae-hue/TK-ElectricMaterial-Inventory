import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/hooks/use-language";
import { useToast } from "@/hooks/use-toast";
import { FieldMovementBadge } from "@/components/StatusBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Clock, RotateCcw, Check, Trash2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

// ─── Animation ────────────────────────────────────────────────────────────────

const DRAFT_PULSE_CSS = `
@keyframes draft-pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
.draft-pulse-dot { animation: draft-pulse 2s ease-in-out infinite; }
`;

// ─── Draft Status Badge ────────────────────────────────────────────────────────

function DraftStatusBadge({ label }: { label: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: "rgba(245,166,35,0.10)", border: "1px solid rgba(245,166,35,0.25)",
      borderRadius: 5, fontSize: 9, fontWeight: 800, textTransform: "uppercase",
      letterSpacing: "0.06em", padding: "2px 7px", color: "#f5a623",
      fontFamily: "'Barlow Condensed', sans-serif",
    }}>
      <span
        className="draft-pulse-dot"
        style={{ width: 5, height: 5, borderRadius: "50%", background: "#f5a623", flexShrink: 0, display: "inline-block" }}
      />
      {label}
    </span>
  );
}

// ─── Item Pill ─────────────────────────────────────────────────────────────────

function ItemPill({ name, qty, unit }: { name: string; qty: number; unit?: string }) {
  return (
    <span style={{
      fontSize: 10, background: "#1c2b1f", border: "1px solid #2a4030",
      borderRadius: 5, padding: "3px 8px", color: "#c8deca",
      fontFamily: "'Barlow Condensed', sans-serif",
    }}>
      {name} ·{" "}
      <strong style={{ color: "#2ddb6f" }}>{qty}</strong>
      {unit ? ` ${unit}` : ""}
    </span>
  );
}

// ─── Field Button ──────────────────────────────────────────────────────────────

interface FieldBtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "green" | "red";
  icon?: React.ReactNode;
  label: string;
}

function FieldBtn({ variant = "default", icon, label, ...rest }: FieldBtnProps) {
  const styles: Record<string, React.CSSProperties> = {
    default: { background: "#1c2b1f", border: "1px solid #2a4030", color: "#7aab82" },
    green:   { background: "rgba(45,219,111,0.10)", border: "1px solid rgba(45,219,111,0.25)", color: "#2ddb6f" },
    red:     { background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.18)", color: "#ff5050" },
  };
  return (
    <button
      type="button"
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 600,
        cursor: "pointer", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.3,
        ...styles[variant],
      }}
      {...rest}
    >
      {icon}
      {label}
    </button>
  );
}

// ─── Draft Card ────────────────────────────────────────────────────────────────

interface DraftCardProps {
  draft: any;
  onResume: () => void;
  onConfirm: () => void;
  onDelete: () => void;
  t: any;
}

function DraftCard({ draft, onResume, onConfirm, onDelete, t }: DraftCardProps) {
  const draftItems: any[] = (() => {
    try { return JSON.parse(draft.itemsJson || "[]"); } catch { return []; }
  })();
  const previewItems = draftItems.slice(0, 2);
  const extraCount   = draftItems.length - 2;
  const fromName     = draft.sourceLocation?.name;
  const toName       = draft.destinationLocation?.name;
  const projectName  = draft.project?.name;

  return (
    <div
      data-testid={`draft-card-${draft.id}`}
      style={{ background: "#162019", border: "1px solid #2a4030", borderRadius: 12, overflow: "hidden" }}
    >
      <div style={{ height: 2, background: "linear-gradient(90deg, #f5a623, rgba(245,166,35,0.3))" }} />

      <div style={{ padding: "14px 16px" }}>
        {/* Row 1: type + DRAFT badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          <FieldMovementBadge type={draft.movementType} />
          <DraftStatusBadge label={t.txDraftsTab} />
          <span style={{ fontSize: 10, color: "#4a7052", marginLeft: "auto", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.3 }}>
            {t.inventoryNotAffected}
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
            <ItemPill key={idx} name={di.itemName || `Item #${di.itemId}`} qty={di.qty} unit={di.unit} />
          ))}
          {extraCount > 0 && (
            <span style={{ fontSize: 10, background: "#1c2b1f", border: "1px solid #2a4030", borderRadius: 5, padding: "3px 8px", color: "#7aab82", fontFamily: "'Barlow Condensed', sans-serif" }}>
              +{extraCount} more
            </span>
          )}
          {draftItems.length === 0 && (
            <span style={{ fontSize: 10, color: "#4a7052" }}>{t.noItems}</span>
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
          <FieldBtn
            variant="default"
            icon={<RotateCcw style={{ width: 12, height: 12 }} />}
            label={t.resume}
            data-testid={`button-resume-draft-${draft.id}`}
            onClick={onResume}
          />
          <FieldBtn
            variant="green"
            icon={<Check style={{ width: 12, height: 12 }} />}
            label={t.confirm}
            data-testid={`button-confirm-draft-${draft.id}`}
            onClick={onConfirm}
          />
          <FieldBtn
            variant="red"
            icon={<Trash2 style={{ width: 12, height: 12 }} />}
            label={t.delete}
            data-testid={`button-delete-draft-${draft.id}`}
            onClick={onDelete}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Confirm Draft Modal ───────────────────────────────────────────────────────

function ConfirmDraftModal({ draft, onClose, onConfirm, loading, t }: {
  draft: any;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  t: any;
}) {
  const draftItems: any[] = (() => {
    try { return JSON.parse(draft.itemsJson || "[]"); } catch { return []; }
  })();

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent style={{ background: "#0f1612", border: "1px solid #2a4030", borderRadius: 14, maxWidth: 480 }} className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle style={{ color: "#e2f0e5", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700 }}>
            {t.confirmDraftTitle}
          </DialogTitle>
        </DialogHeader>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 4 }}>
          <div style={{ background: "#162019", border: "1px solid #2a4030", borderRadius: 9, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <FieldMovementBadge type={draft.movementType} />
              <span style={{ fontSize: 12, color: "#7aab82" }}>
                {draft.sourceLocation?.name && draft.destinationLocation?.name
                  ? `${draft.sourceLocation.name} → ${draft.destinationLocation.name}`
                  : draft.sourceLocation?.name || draft.destinationLocation?.name || ""}
              </span>
            </div>
            {draft.project?.name && (
              <span style={{ fontSize: 11, color: "#5b9cf6" }}>Project: {draft.project.name}</span>
            )}
            {draft.note && (
              <span style={{ fontSize: 11, color: "#7aab82" }}>Note: {draft.note}</span>
            )}
          </div>

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

          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "rgba(255,80,80,0.07)", border: "1px solid rgba(255,80,80,0.18)", borderRadius: 8, padding: "10px 12px" }}>
            <AlertTriangle style={{ width: 14, height: 14, color: "#ff5050", flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 11, color: "#ff5050", lineHeight: 1.5 }}>{t.confirmDraftWarning}</p>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ background: "#1c2b1f", border: "1px solid #2a4030", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, color: "#7aab82", cursor: "pointer", fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              data-testid="button-execute-confirm-draft"
              style={{ background: "#2ddb6f", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 700, color: "#07090a", cursor: loading ? "not-allowed" : "pointer", fontFamily: "'Barlow Condensed', sans-serif", opacity: loading ? 0.7 : 1 }}
            >
              {loading ? t.applying : t.confirmDraftTitle}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete Draft Modal ───────────────────────────────────────────────────────

function DeleteDraftModal({ onClose, onDelete, loading, t }: {
  onClose: () => void;
  onDelete: () => void;
  loading: boolean;
  t: any;
}) {
  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent style={{ background: "#0f1612", border: "1px solid #2a4030", borderRadius: 14, maxWidth: 380 }} className="max-w-[380px]">
        <DialogHeader>
          <DialogTitle style={{ color: "#e2f0e5", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 17, fontWeight: 700, display: "flex", alignItems: "center", gap: 7 }}>
            <AlertTriangle style={{ width: 18, height: 18, color: "#ff5050" }} />
            {t.deleteDraftTitle}
          </DialogTitle>
        </DialogHeader>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 4 }}>
          <p style={{ fontSize: 13, color: "#7aab82", lineHeight: 1.5 }}>{t.deleteDraftWarning}</p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ background: "#1c2b1f", border: "1px solid #2a4030", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, color: "#7aab82", cursor: "pointer", fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={loading}
              data-testid="button-execute-delete-draft"
              style={{ background: "rgba(255,80,80,0.15)", border: "1px solid rgba(255,80,80,0.3)", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, color: "#ff5050", cursor: loading ? "not-allowed" : "pointer", fontFamily: "'Barlow Condensed', sans-serif", opacity: loading ? 0.7 : 1 }}
            >
              {loading ? t.deleting : t.deleteDraftTitle}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function DraftMovementsList() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();

  const [confirmingDraft, setConfirmingDraft] = useState<any | null>(null);
  const [confirmLoading, setConfirmLoading]   = useState(false);
  const [deletingId, setDeletingId]           = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading]     = useState(false);

  const { data: drafts = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/drafts"] });

  async function handleConfirm() {
    if (!confirmingDraft) return;
    setConfirmLoading(true);
    try {
      const res = await fetch(`/api/drafts/${confirmingDraft.id}/confirm`, { method: "POST", credentials: "include" });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Failed to confirm draft"); }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["/api/drafts"] }),
        qc.invalidateQueries({ queryKey: ["/api/movements"] }),
        qc.invalidateQueries({ queryKey: ["/api/items"] }),
      ]);
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
    return <div style={{ textAlign: "center", padding: "60px 0", fontSize: 13, color: "#7aab82" }}>{t.loadingDrafts}</div>;
  }

  if (drafts.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 0" }}>
        <FileText style={{ width: 36, height: 36, color: "#2a4030", margin: "0 auto 12px" }} />
        <p style={{ fontSize: 14, fontWeight: 600, color: "#4a7052" }}>{t.noDraftMovements}</p>
        <p style={{ fontSize: 12, color: "#2a4030", marginTop: 4 }}>{t.savedDraftsHere}</p>
      </div>
    );
  }

  return (
    <>
      <style>{DRAFT_PULSE_CSS}</style>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {drafts.map(draft => (
          <DraftCard
            key={draft.id}
            draft={draft}
            t={t}
            onResume={() => navigate(
              `/field/movement?type=${draft.movementType === "receive" || draft.movementType === "return" ? "receive" : "issue"}&draftId=${draft.id}`
            )}
            onConfirm={() => setConfirmingDraft(draft)}
            onDelete={() => setDeletingId(draft.id)}
          />
        ))}
      </div>

      {confirmingDraft && (
        <ConfirmDraftModal
          draft={confirmingDraft}
          onClose={() => setConfirmingDraft(null)}
          onConfirm={handleConfirm}
          loading={confirmLoading}
          t={t}
        />
      )}

      {deletingId !== null && (
        <DeleteDraftModal
          onClose={() => setDeletingId(null)}
          onDelete={() => handleDelete(deletingId)}
          loading={deleteLoading}
          t={t}
        />
      )}
    </>
  );
}
