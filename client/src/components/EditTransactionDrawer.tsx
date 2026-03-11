import { useState, useEffect, useMemo, useRef } from "react";
import { useUpdateMovement, useUndoMovement } from "@/hooks/use-transactions";
import { useLocations, useProjects } from "@/hooks/use-reference-data";
import { useAuth } from "@/hooks/use-auth";
import { format, formatDistanceToNow, differenceInHours } from "date-fns";
import { X, Lock } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EditDrawerProps {
  tx: any;
  open: boolean;
  onClose: () => void;
  dark?: boolean;
  onSaved?: (updatedTx: any, undoFn: () => void) => void;
}

// ─── Color tokens ─────────────────────────────────────────────────────────────

function tok(dark: boolean) {
  return dark ? {
    bg:       "#0d1410",
    bg2:      "#1c2b1f",
    bg3:      "#162019",
    border:   "#2a4030",
    border2:  "#2a4030",
    text:     "#e2f0e5",
    text2:    "#7aab82",
    text3:    "#4a7052",
    green:    "#2ddb6f",
    greenDim: "rgba(45,219,111,0.10)",
    greenBd:  "rgba(45,219,111,0.25)",
    red:      "#ff5050",
    redDim:   "rgba(255,80,80,0.10)",
    redBd:    "rgba(255,80,80,0.25)",
    purple:   "#a78bfa",
    purpleDim:"rgba(167,139,250,0.08)",
    purpleBd: "rgba(167,139,250,0.30)",
    inputBg:  "#162019",
    overlay:  "rgba(4,8,5,0.65)",
    font:     "'Barlow', sans-serif",
    fontCond: "'Barlow Condensed', sans-serif",
  } : {
    bg:       "#ffffff",
    bg2:      "#f8fafc",
    bg3:      "#f1f5f9",
    border:   "#e2e8f0",
    border2:  "#cbd5e1",
    text:     "#0f172a",
    text2:    "#475569",
    text3:    "#94a3b8",
    green:    "#16a34a",
    greenDim: "rgba(22,163,74,0.08)",
    greenBd:  "rgba(22,163,74,0.25)",
    red:      "#dc2626",
    redDim:   "rgba(220,38,38,0.07)",
    redBd:    "rgba(220,38,38,0.20)",
    purple:   "#7c3aed",
    purpleDim:"rgba(124,58,237,0.06)",
    purpleBd: "rgba(124,58,237,0.25)",
    inputBg:  "#ffffff",
    overlay:  "rgba(15,23,42,0.45)",
    font:     "inherit",
    fontCond: "inherit",
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MOVEMENT_TYPES = [
  { value: "issue",    label: "Issue" },
  { value: "receive",  label: "Receive" },
  { value: "return",   label: "Return" },
  { value: "transfer", label: "Transfer" },
];

const UNITS = ["EA", "FT", "LB", "BOX", "SET", "SPOOL", "COIL", "PKG"];

function toLocalDatetimeStr(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtTs(ts: string | Date | null | undefined): string {
  if (!ts) return "—";
  try { return format(new Date(ts as string), "MMM d, yyyy HH:mm"); } catch { return "—"; }
}

function relativeTime(ts: string | Date | null | undefined): string {
  if (!ts) return "";
  try { return formatDistanceToNow(new Date(ts as string), { addSuffix: true }); } catch { return ""; }
}

function usernameDisplay(userId: string | null | undefined): string {
  if (!userId) return "Unknown";
  const parts = userId.replace("@tkelectricllc.us", "").split("_");
  return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}

// ─── Single field label with purple change indicator ─────────────────────────

function FieldLabel({ label, changed, c }: { label: string; changed: boolean; c: ReturnType<typeof tok> }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
      <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: c.text3, fontFamily: c.fontCond }}>
        {label}
      </span>
      {changed && (
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.purple, flexShrink: 0, display: "inline-block" }} />
      )}
    </div>
  );
}

// ─── Styled input/select ──────────────────────────────────────────────────────

function getInputStyle(changed: boolean, c: ReturnType<typeof tok>, extra?: React.CSSProperties): React.CSSProperties {
  return {
    background: changed ? c.purpleDim : c.inputBg,
    border: `1px solid ${changed ? c.purpleBd : c.border}`,
    borderRadius: 7,
    padding: "8px 10px",
    color: c.text,
    fontSize: 13,
    width: "100%",
    outline: "none",
    fontFamily: c.font,
    boxSizing: "border-box",
    ...extra,
  };
}

function getReadOnlyStyle(c: ReturnType<typeof tok>): React.CSSProperties {
  return {
    background: c.bg3,
    border: `1px dashed ${c.border2}`,
    borderRadius: 7,
    padding: "8px 10px",
    color: c.text3,
    fontSize: 13,
    width: "100%",
    fontFamily: c.font,
    cursor: "not-allowed",
    boxSizing: "border-box",
  };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function EditTransactionDrawer({ tx, open, onClose, dark = false, onSaved }: EditDrawerProps) {
  const c = useMemo(() => tok(dark), [dark]);
  const { user } = useAuth();
  const { data: locations } = useLocations();
  const { data: projects } = useProjects();
  const updateMutation = useUpdateMovement();

  // Form state
  const [movementType, setMovementType]   = useState(tx.movementType ?? "receive");
  const [quantity, setQuantity]           = useState(String(tx.quantity ?? ""));
  const [sourceLocId, setSourceLocId]     = useState(String(tx.sourceLocationId ?? ""));
  const [destLocId, setDestLocId]         = useState(String(tx.destinationLocationId ?? ""));
  const [projectId, setProjectId]         = useState(String(tx.projectId ?? ""));
  const [note, setNote]                   = useState(tx.note ?? "");
  const [txDate, setTxDate]               = useState(
    toLocalDatetimeStr(tx.transactionDate || tx.createdAt)
  );

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Original values for change tracking
  const orig = useMemo(() => ({
    movementType: tx.movementType ?? "receive",
    quantity:     String(tx.quantity ?? ""),
    sourceLocId:  String(tx.sourceLocationId ?? ""),
    destLocId:    String(tx.destinationLocationId ?? ""),
    projectId:    String(tx.projectId ?? ""),
    note:         tx.note ?? "",
    txDate:       toLocalDatetimeStr(tx.transactionDate || tx.createdAt),
  }), [tx]);

  // Reset when tx changes
  useEffect(() => {
    setMovementType(orig.movementType);
    setQuantity(orig.quantity);
    setSourceLocId(orig.sourceLocId);
    setDestLocId(orig.destLocId);
    setProjectId(orig.projectId);
    setNote(orig.note);
    setTxDate(orig.txDate);
    setError(null);
  }, [tx.id, orig]);

  // Changed fields tracking
  const changed = {
    movementType: movementType !== orig.movementType,
    quantity:     quantity !== orig.quantity,
    sourceLocId:  sourceLocId !== orig.sourceLocId,
    destLocId:    destLocId !== orig.destLocId,
    projectId:    projectId !== orig.projectId,
    note:         note !== orig.note,
    txDate:       txDate !== orig.txDate,
  };
  const anyChanged = Object.values(changed).some(Boolean);

  const changedSummary = useMemo(() => {
    const entries: { field: string; old: string; new: string }[] = [];
    const locName = (id: string) => locations?.find((l: any) => String(l.id) === id)?.name ?? (id || "None");
    const projName = (id: string) => {
      const p = projects?.find((p: any) => String(p.id) === id);
      return p ? (p.poNumber ? `${p.name} / ${p.poNumber}` : p.name) : (id || "None");
    };
    if (changed.movementType) entries.push({ field: "Type", old: orig.movementType, new: movementType });
    if (changed.quantity) entries.push({ field: "Quantity", old: orig.quantity, new: quantity });
    if (changed.sourceLocId) entries.push({ field: "From", old: locName(orig.sourceLocId), new: locName(sourceLocId) });
    if (changed.destLocId) entries.push({ field: "To", old: locName(orig.destLocId), new: locName(destLocId) });
    if (changed.projectId) entries.push({ field: "Project", old: projName(orig.projectId), new: projName(projectId) });
    if (changed.note) entries.push({ field: "Note", old: orig.note || "(empty)", new: note || "(empty)" });
    if (changed.txDate) entries.push({ field: "Date", old: orig.txDate, new: txDate });
    return entries;
  }, [changed, orig, movementType, quantity, sourceLocId, destLocId, projectId, note, txDate, locations, projects]);

  // Audit info
  const editHistory: any[] = Array.isArray(tx.editHistory) ? tx.editHistory : [];
  const lastEdit = editHistory.length > 0 ? editHistory[editHistory.length - 1] : null;
  const isBackdated = txDate && tx.createdAt && Math.abs(differenceInHours(new Date(txDate), new Date(tx.createdAt))) > 6;

  async function handleSave() {
    setError(null);
    const qty = Number(quantity);
    if (!qty || qty < 1) { setError("Quantity must be at least 1."); return; }
    try {
      const payload: any = {
        id: tx.id,
        movementType,
        quantity: qty,
        sourceLocationId: sourceLocId ? Number(sourceLocId) : null,
        destinationLocationId: destLocId ? Number(destLocId) : null,
        projectId: projectId ? Number(projectId) : null,
        note: note || null,
        transactionDate: txDate ? new Date(txDate).toISOString() : null,
      };
      const result = await updateMutation.mutateAsync(payload);
      onSaved?.(result, () => {});
      onClose();
    } catch (err: any) {
      setError(err.message || "Save failed.");
    }
  }

  const selectStyle: React.CSSProperties = {
    ...getInputStyle(false, c),
    appearance: "none",
    WebkitAppearance: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23${dark ? "7aab82" : "94a3b8"}' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 10px center",
    paddingRight: 28,
    cursor: "pointer",
  };

  const item = tx.item;

  if (!open) return null;

  return (
    <>
      <style>{`
        @keyframes drawer-slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .edit-drawer-panel { animation: drawer-slide-in 280ms cubic-bezier(.4,0,.2,1) forwards; }
        .edit-drawer-input:focus { outline: none; border-color: ${c.green} !important; box-shadow: 0 0 0 3px ${dark ? "rgba(45,219,111,0.12)" : "rgba(22,163,74,0.10)"} !important; }
        .edit-drawer-select:focus { outline: none; border-color: ${c.green} !important; box-shadow: 0 0 0 3px ${dark ? "rgba(45,219,111,0.12)" : "rgba(22,163,74,0.10)"} !important; }
        .edit-drawer-close-btn:hover { background: ${c.redDim} !important; color: ${c.red} !important; }
      `}</style>

      {/* Overlay */}
      <div
        style={{ position: "absolute", inset: 0, background: c.overlay, backdropFilter: "blur(4px)", zIndex: 50 }}
        onClick={onClose}
        data-testid="edit-drawer-overlay"
      />

      {/* Drawer Panel */}
      <div
        className="edit-drawer-panel"
        data-testid="edit-transaction-drawer"
        style={{
          position: "absolute", right: 0, top: 0, bottom: 0,
          width: 420, background: c.bg2, borderLeft: `1px solid ${c.border2}`,
          zIndex: 51, display: "flex", flexDirection: "column", overflowY: "hidden",
        }}
      >
        {/* ── Header ── */}
        <div style={{ padding: "18px 20px 14px", borderBottom: `1px solid ${c.border}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 800, color: c.text, fontFamily: c.fontCond, letterSpacing: 0.3 }}>Edit Transaction</p>
              <p style={{ fontSize: 11, color: c.text2, marginTop: 2 }}>
                {item?.name ?? `Item #${tx.itemId}`}
                {item?.sku ? <span style={{ color: c.text3 }}> · {item.sku}</span> : null}
              </p>
            </div>
            <button
              className="edit-drawer-close-btn"
              onClick={onClose}
              data-testid="edit-drawer-close"
              style={{ background: "transparent", border: `1px solid ${c.border}`, borderRadius: 6, padding: "4px 7px", cursor: "pointer", color: c.text2, display: "flex", alignItems: "center", transition: "all 0.15s", flexShrink: 0 }}
            >
              <X style={{ width: 14, height: 14 }} />
            </button>
          </div>

          {/* Audit info pill */}
          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0, background: c.bg3, border: `1px solid ${c.border}`, borderRadius: 8, overflow: "hidden", fontSize: 10 }}>
            {[
              { label: "Created At", value: fmtTs(tx.createdAt) },
              { label: "Created By", value: usernameDisplay(tx.createdBy) },
              {
                label: "Last Edited",
                value: lastEdit
                  ? `${fmtTs(lastEdit.editedAt)} · ${usernameDisplay(lastEdit.editedBy)}`
                  : "Never",
              },
            ].map((info, i) => (
              <div
                key={i}
                style={{
                  padding: "7px 10px",
                  borderRight: i < 2 ? `1px solid ${c.border}` : "none",
                }}
              >
                <p style={{ fontSize: 9, fontWeight: 700, color: c.text3, textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: c.fontCond, marginBottom: 2 }}>{info.label}</p>
                <p style={{ fontSize: 10, color: c.text2, lineHeight: 1.3 }}>{info.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Scrollable Body ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* 1. Movement Type */}
          <div>
            <FieldLabel label="Movement Type" changed={changed.movementType} c={c} />
            <select
              className="edit-drawer-select"
              value={movementType}
              onChange={e => setMovementType(e.target.value)}
              data-testid="edit-drawer-type"
              style={{ ...selectStyle, ...(changed.movementType ? { background: c.purpleDim, borderColor: c.purpleBd } : {}) }}
            >
              {MOVEMENT_TYPES.map(t => (
                <option key={t.value} value={t.value} style={{ background: c.bg2, color: c.text }}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* 2. Item (read-only) */}
          <div>
            <FieldLabel label="Item" changed={false} c={c} />
            <div style={getReadOnlyStyle(c)}>
              {item?.name ?? `Item #${tx.itemId}`}
            </div>
            <p style={{ fontSize: 9, color: c.text3, marginTop: 4, fontStyle: "italic" }}>
              Read-only — delete and re-log to change item
            </p>
          </div>

          {/* 3. Quantity + Unit */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <FieldLabel label="Quantity" changed={changed.quantity} c={c} />
              <input
                type="number"
                className="edit-drawer-input"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                min={1}
                data-testid="edit-drawer-quantity"
                style={{ ...getInputStyle(changed.quantity, c), fontFamily: "monospace", fontWeight: 700 }}
              />
            </div>
            <div>
              <FieldLabel label="Unit" changed={false} c={c} />
              <div style={getReadOnlyStyle(c)}>
                {item?.unitOfMeasure ?? "EA"}
              </div>
            </div>
          </div>

          {/* 4. From */}
          <div>
            <FieldLabel label="From" changed={changed.sourceLocId} c={c} />
            <select
              className="edit-drawer-select"
              value={sourceLocId}
              onChange={e => setSourceLocId(e.target.value)}
              data-testid="edit-drawer-from"
              style={{ ...selectStyle, ...(changed.sourceLocId ? { background: c.purpleDim, borderColor: c.purpleBd } : {}) }}
            >
              <option value="" style={{ background: c.bg2, color: c.text }}>— None —</option>
              {locations?.map((l: any) => (
                <option key={l.id} value={String(l.id)} style={{ background: c.bg2, color: c.text }}>{l.name}</option>
              ))}
            </select>
          </div>

          {/* 5. To */}
          <div>
            <FieldLabel label="To" changed={changed.destLocId} c={c} />
            <select
              className="edit-drawer-select"
              value={destLocId}
              onChange={e => setDestLocId(e.target.value)}
              data-testid="edit-drawer-to"
              style={{ ...selectStyle, ...(changed.destLocId ? { background: c.purpleDim, borderColor: c.purpleBd } : {}) }}
            >
              <option value="" style={{ background: c.bg2, color: c.text }}>— None —</option>
              {locations?.map((l: any) => (
                <option key={l.id} value={String(l.id)} style={{ background: c.bg2, color: c.text }}>{l.name}</option>
              ))}
            </select>
          </div>

          {/* 6. Project / PO */}
          <div>
            <FieldLabel label="Project / PO" changed={changed.projectId} c={c} />
            <select
              className="edit-drawer-select"
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              data-testid="edit-drawer-project"
              style={{ ...selectStyle, ...(changed.projectId ? { background: c.purpleDim, borderColor: c.purpleBd } : {}) }}
            >
              <option value="" style={{ background: c.bg2, color: c.text }}>— None —</option>
              {projects?.map((p: any) => (
                <option key={p.id} value={String(p.id)} style={{ background: c.bg2, color: c.text }}>
                  {p.name}{p.poNumber ? ` / ${p.poNumber}` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* 7. Note */}
          <div>
            <FieldLabel label="Note" changed={changed.note} c={c} />
            <textarea
              className="edit-drawer-input"
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              data-testid="edit-drawer-note"
              style={{ ...getInputStyle(changed.note, c), resize: "none", lineHeight: 1.5 }}
            />
          </div>

          {/* 8. Date & Time */}
          <div style={{ background: c.bg3, border: `1px solid ${c.border}`, borderRadius: 9, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: c.text3, fontFamily: c.fontCond }}>Date & Time</p>

            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <FieldLabel label="Transaction Date / Time" changed={changed.txDate} c={c} />
                <button
                  type="button"
                  onClick={() => setTxDate(toLocalDatetimeStr(new Date()))}
                  style={{ fontSize: 9, fontWeight: 700, color: c.green, background: c.greenDim, border: `1px solid ${c.greenBd}`, borderRadius: 5, padding: "2px 8px", cursor: "pointer", fontFamily: c.fontCond }}
                >
                  Now
                </button>
              </div>
              <input
                type="datetime-local"
                className="edit-drawer-input"
                value={txDate}
                onChange={e => setTxDate(e.target.value)}
                data-testid="edit-drawer-tx-date"
                style={{ ...getInputStyle(changed.txDate, c), colorScheme: dark ? "dark" : "light" }}
              />
              {isBackdated && (
                <p style={{ fontSize: 10, color: "#f5a623", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                  ⚠ Backdated — transaction date differs from log time by more than 6 hours
                </p>
              )}
            </div>

            <div>
              <FieldLabel label="Created At (locked)" changed={false} c={c} />
              <div style={{ position: "relative" }}>
                <Lock style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", width: 11, height: 11, color: c.text3, pointerEvents: "none" }} />
                <div style={{ ...getReadOnlyStyle(c), paddingLeft: 24, display: "flex", alignItems: "center" }}>
                  {fmtTs(tx.createdAt)}
                </div>
              </div>
            </div>
          </div>

          {/* Changed Fields Summary */}
          {anyChanged && changedSummary.length > 0 && (
            <div style={{ background: c.purpleDim, border: `1px solid ${c.purpleBd}`, borderRadius: 9, padding: "12px 14px" }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: c.purple, fontFamily: c.fontCond, marginBottom: 8 }}>
                Changed Fields
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {changedSummary.map((entry, i) => (
                  <div key={i} style={{ fontSize: 11, color: c.text2, display: "flex", gap: 6, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, color: c.purple, minWidth: 60 }}>{entry.field}:</span>
                    <span style={{ color: c.text3, textDecoration: "line-through", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.old}</span>
                    <span style={{ color: c.text3 }}>→</span>
                    <span style={{ color: c.text, fontWeight: 600, maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.new}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ background: c.redDim, border: `1px solid ${c.redBd}`, borderRadius: 8, padding: "10px 12px", fontSize: 12, color: c.red }}>
              {error}
            </div>
          )}

          {/* Spacer */}
          <div style={{ height: 8 }} />
        </div>

        {/* ── Footer ── */}
        <div style={{ padding: "14px 20px", borderTop: `1px solid ${c.border}`, flexShrink: 0 }}>
          <p style={{ fontSize: 9, color: c.text3, marginBottom: 10, fontStyle: "italic" }}>
            Saving will record: edited_by · edited_at · field changes
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={onClose}
              data-testid="edit-drawer-cancel"
              style={{ padding: "7px 14px", borderRadius: 8, background: "transparent", border: `1px solid ${c.border2}`, color: c.text2, fontSize: 10.5, fontWeight: 700, cursor: "pointer", fontFamily: c.fontCond, letterSpacing: 0.3 }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={updateMutation.isPending || !anyChanged}
              data-testid="edit-drawer-save"
              style={{
                padding: "7px 16px", borderRadius: 8,
                background: updateMutation.isPending || !anyChanged ? c.border : c.green,
                border: "none",
                color: updateMutation.isPending || !anyChanged ? c.text3 : (dark ? "#0d1410" : "#ffffff"),
                fontSize: 10.5, fontWeight: 800, cursor: updateMutation.isPending || !anyChanged ? "not-allowed" : "pointer",
                fontFamily: c.fontCond, letterSpacing: 0.3, transition: "all 0.15s",
              }}
            >
              {updateMutation.isPending ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Custom success toast with Undo ──────────────────────────────────────────

interface UndoToastProps {
  txId: number;
  dark?: boolean;
  onDismiss: () => void;
  onUndone?: () => void;
}

export function EditSuccessToast({ txId, dark = false, onDismiss, onUndone }: UndoToastProps) {
  const c = useMemo(() => tok(dark), [dark]);
  const undoMutation = useUndoMovement();
  const [secondsLeft, setSecondsLeft] = useState(10);
  const [undone, setUndone] = useState(false);
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          clearInterval(timerRef.current!);
          setTimeout(() => { setVisible(false); onDismiss(); }, 300);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  async function handleUndo() {
    if (secondsLeft <= 0 || undone) return;
    clearInterval(timerRef.current!);
    try {
      await undoMutation.mutateAsync(txId);
      setUndone(true);
      onUndone?.();
      setTimeout(() => { setVisible(false); onDismiss(); }, 2000);
    } catch {
      setTimeout(() => { setVisible(false); onDismiss(); }, 300);
    }
  }

  if (!visible) return null;

  return (
    <div
      data-testid="edit-success-toast"
      style={{
        position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
        zIndex: 9999, display: "flex", alignItems: "center", gap: 10,
        background: dark ? "#1c2b1f" : "#ffffff",
        border: `1px solid ${c.border2}`,
        borderRadius: 10, padding: "10px 16px",
        boxShadow: dark ? "0 8px 32px rgba(0,0,0,0.6)" : "0 8px 32px rgba(0,0,0,0.12)",
        fontFamily: c.fontCond, fontSize: 12, color: c.text,
        animation: "toast-slide-up 200ms ease forwards",
      }}
    >
      <style>{`@keyframes toast-slide-up { from { opacity: 0; transform: translateX(-50%) translateY(20px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }`}</style>
      <span style={{ fontSize: 14 }}>✅</span>
      <span style={{ fontWeight: 600 }}>
        {undone ? "Changes reverted" : "Transaction updated"}
      </span>
      {!undone && (
        <button
          type="button"
          onClick={handleUndo}
          disabled={secondsLeft <= 0 || undoMutation.isPending}
          data-testid="edit-toast-undo"
          style={{
            background: secondsLeft > 0 ? c.greenDim : "transparent",
            border: `1px solid ${secondsLeft > 0 ? c.greenBd : c.border}`,
            borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700,
            color: secondsLeft > 0 ? c.green : c.text3,
            cursor: secondsLeft > 0 ? "pointer" : "not-allowed",
            opacity: secondsLeft > 0 ? 1 : 0.45, transition: "all 0.3s",
          }}
        >
          {undoMutation.isPending ? "…" : `Undo (${secondsLeft}s)`}
        </button>
      )}
      <button
        type="button"
        onClick={() => { setVisible(false); onDismiss(); }}
        data-testid="edit-toast-close"
        style={{ background: "transparent", border: "none", cursor: "pointer", color: c.text3, padding: 2, display: "flex", alignItems: "center" }}
      >
        <X style={{ width: 13, height: 13 }} />
      </button>
    </div>
  );
}
