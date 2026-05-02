/**
 * StatusBadge.tsx
 * Centralised badge components for item status and movement types.
 * All badge style rules live here — import from here, not inline.
 */

import { Badge } from "@/components/ui/badge";
import { getMovementMeta } from "@/features/inventory/utils/movementDisplay";
import { useLanguage } from "@/hooks/use-language";

// ─── Item Status Badge ────────────────────────────────────────────────────────

export function ItemStatusBadge({ status }: { status: string }) {
  const { t } = useLanguage();
  const config: Record<string, { label: string; className: string }> = {
    in_stock:    { label: t.invStatusInStock,    className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    low_stock:   { label: t.invStatusLowStock,   className: "bg-amber-100 text-amber-700 border-amber-200" },
    out_of_stock:{ label: t.invStatusOutOfStock, className: "bg-rose-100 text-rose-700 border-rose-200" },
    ordered:     { label: t.invStatusOrdered,    className: "bg-sky-100 text-sky-700 border-sky-200" },
  };

  const { label, className } = config[status] || { label: status, className: "bg-slate-100 text-slate-700" };

  return (
    <Badge variant="outline" className={`${className} font-medium text-[11px] px-2 py-0 rounded-full border leading-5 whitespace-nowrap`}>
      {label}
    </Badge>
  );
}

// ─── Transaction Type Badge (Admin / light-mode) ──────────────────────────────
// Legacy name kept for backward compatibility — imported in Transactions.tsx.

export function TransactionTypeBadge({ type }: { type: string }) {
  const { t } = useLanguage();
  const config: Record<string, { label: string; className: string }> = {
    receive:  { label: t.txReceived,    className: "bg-emerald-50 text-emerald-700 border-emerald-100" },
    issue:    { label: t.txIssued,      className: "bg-violet-50 text-violet-700 border-violet-100" },
    return:   { label: t.txReturned,    className: "bg-sky-50 text-sky-700 border-sky-100" },
    adjust:   { label: t.txAdjusted,    className: "bg-amber-50 text-amber-700 border-amber-100" },
    transfer: { label: t.txTransferred, className: "bg-slate-50 text-slate-700 border-slate-100" },
  };

  const { label, className } = config[type] || { label: type, className: "bg-slate-50 text-slate-700" };

  return (
    <Badge variant="outline" className={`${className} text-[10px] uppercase tracking-wider font-bold px-2 py-0 border`}>
      {label}
    </Badge>
  );
}

// ─── Movement Type Badge (canonical, uses shared metadata) ────────────────────
// Use this for NEW code. Driven by movementDisplay.ts — single source of truth.

export function MovementTypeBadge({
  type,
  past = false,
}: {
  type: string;
  past?: boolean;
}) {
  const { t } = useLanguage();
  const meta = getMovementMeta(type);
  const presentLabel =
    type === "receive"  ? t.txReceive  :
    type === "issue"    ? t.txIssue    :
    type === "return"   ? t.txReturn   :
    type === "adjust"   ? t.txAdjust   :
    type === "transfer" ? t.txTransfer : t.txUnknown;
  const pastLabel =
    type === "receive"  ? t.txReceived    :
    type === "issue"    ? t.txIssued      :
    type === "return"   ? t.txReturned    :
    type === "adjust"   ? t.txAdjusted    :
    type === "transfer" ? t.txTransferred : t.txUnknown;
  const label = past ? pastLabel : presentLabel;

  return (
    <Badge
      variant="outline"
      className={`${meta.lightClass} text-[10px] uppercase tracking-wider font-bold px-2 py-0 border whitespace-nowrap`}
    >
      {label}
    </Badge>
  );
}

// ─── Field Movement Badge (dark-mode, field/inventory mode) ───────────────────
// Use this in dark-themed Field Mode screens.

export function FieldMovementBadge({
  type,
  past = false,
}: {
  type: string;
  past?: boolean;
}) {
  const meta = getMovementMeta(type);
  const label = past
    ? (type === "receive" ? "RECEIVED" : type === "issue" ? "ISSUED" : type === "return" ? "RETURNED" : type === "adjust" ? "ADJUSTED" : type === "transfer" ? "TRANSFER" : meta.label.toUpperCase())
    : meta.label.toUpperCase();

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        background: meta.dark.bg,
        color: meta.dark.color,
        border: meta.dark.border,
        borderRadius: 5,
        fontSize: 9,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        padding: "2px 7px",
        whiteSpace: "nowrap",
        fontFamily: "'Barlow Condensed', sans-serif",
      }}
    >
      {label}
    </span>
  );
}
