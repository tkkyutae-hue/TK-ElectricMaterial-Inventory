import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Package, ShieldAlert } from "lucide-react";
import { Link } from "wouter";

type AuditRow = {
  id: number;
  name: string;
  sku: string;
  category: string;
  subcategory: string;
  unitOfMeasure: string;
  quantityOnHand: number;
  reelCount: number;
  reelEligible: boolean;
  reason: string;
};

type AuditResponse = {
  rows: AuditRow[];
  total: number;
};

const REASON_COLORS: Record<string, string> = {
  "EMT family":                 "bg-blue-100 text-blue-700",
  "Non-flex conduit (Rigid/RMC)":"bg-slate-100 text-slate-700",
  "Non-flex conduit (IMC)":     "bg-slate-100 text-slate-700",
  "PVC conduit":                "bg-purple-100 text-purple-700",
  "Cable Tray item":            "bg-orange-100 text-orange-700",
  "Wireway":                    "bg-orange-100 text-orange-700",
  "Strut / channel":            "bg-slate-100 text-slate-700",
};

function ReasonBadge({ reason }: { reason: string }) {
  const colorClass = REASON_COLORS[reason] ?? "bg-red-100 text-red-700";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${colorClass}`}>
      {reason}
    </span>
  );
}

export default function ReelAudit() {
  const { data, isLoading, error } = useQuery<AuditResponse>({
    queryKey: ["/api/admin/reel-audit"],
    queryFn: async () => {
      const res = await fetch("/api/admin/reel-audit", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load reel audit");
      return res.json();
    },
  });

  const rows = data?.rows ?? [];

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="w-5 h-5 text-amber-500" />
            <h1 className="text-2xl font-display font-bold text-slate-900">
              Reel Eligibility Audit
            </h1>
          </div>
          <p className="text-slate-500 text-sm">
            Read-only report — items with legacy reel records that no longer
            qualify under the current reel eligibility rule. No data is changed
            by viewing this report.
          </p>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
        <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
        <div>
          <span className="font-semibold">These items have historical reel records that predate the current classification rules.</span>
          {" "}Their reel data remains intact in the database and is not affected by this report.
          New reel operations on these items are now blocked at the server level.
        </div>
      </div>

      {/* Summary stats */}
      {!isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Flagged Items</p>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">{rows.length}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Legacy Reels</p>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">
              {rows.reduce((s, r) => s + r.reelCount, 0)}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">New Reel Ops Blocked</p>
            <p className="text-2xl font-bold text-emerald-700 tabular-nums">Yes</p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="py-16 flex flex-col items-center text-slate-400 gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-700" />
            <p className="text-sm">Loading audit data…</p>
          </div>
        ) : error ? (
          <div className="py-16 flex flex-col items-center text-red-500 gap-2">
            <ShieldAlert className="w-8 h-8" />
            <p className="text-sm font-medium">Failed to load audit data</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 flex flex-col items-center text-slate-400 gap-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            <p className="text-base font-semibold text-slate-800">All clear — no legacy conflicts found</p>
            <p className="text-sm">Every item with reel data passes the current eligibility rule.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm" style={{ minWidth: 900 }}>
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  {[
                    { label: "Item", align: "left" },
                    { label: "SKU", align: "left" },
                    { label: "Category", align: "left" },
                    { label: "Subcategory", align: "left" },
                    { label: "Reel Eligible", align: "center" },
                    { label: "Legacy Reels", align: "right" },
                    { label: "Qty on Hand", align: "right" },
                    { label: "Reason", align: "left" },
                  ].map(({ label, align }) => (
                    <th
                      key={label}
                      className={`px-3 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap ${
                        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
                      }`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr
                    key={row.id}
                    className={`border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors ${
                      idx % 2 === 0 ? "" : "bg-slate-50/30"
                    }`}
                    data-testid={`audit-row-${row.id}`}
                  >
                    <td className="px-3 py-2.5 align-middle">
                      <Link
                        href={`/inventory/${row.id}`}
                        className="font-semibold text-slate-900 hover:text-brand-600 hover:underline transition-colors"
                        data-testid={`audit-link-item-${row.id}`}
                      >
                        {row.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <span className="font-mono text-[11px] text-slate-500">{row.sku}</span>
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <span className="text-xs text-slate-600">{row.category}</span>
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <span className="text-xs text-slate-500">{row.subcategory}</span>
                    </td>
                    <td className="px-3 py-2.5 align-middle text-center">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600">
                        <Package className="w-3 h-3" />
                        No
                      </span>
                    </td>
                    <td className="px-3 py-2.5 align-middle text-right tabular-nums">
                      <span className="font-semibold text-slate-800">{row.reelCount}</span>
                    </td>
                    <td className="px-3 py-2.5 align-middle text-right tabular-nums">
                      <span className="text-slate-600">{row.quantityOnHand.toLocaleString()}</span>
                      <span className="ml-1 text-[10px] text-slate-400">{row.unitOfMeasure}</span>
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <ReasonBadge reason={row.reason} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-100 bg-slate-50/60">
                  <td colSpan={5} className="px-3 py-2 text-xs font-semibold text-slate-500">
                    {rows.length} item{rows.length !== 1 ? "s" : ""} flagged
                  </td>
                  <td className="px-3 py-2 text-right text-xs font-bold text-slate-700 tabular-nums">
                    {rows.reduce((s, r) => s + r.reelCount, 0)} total
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Read-only disclaimer */}
      <p className="text-xs text-slate-400 text-center">
        This is a read-only audit view. No data is modified, deleted, or migrated by this screen.
      </p>
    </div>
  );
}
