import { useState } from "react";
import { format } from "date-fns";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { MovementTypeBadge } from "@/components/StatusBadge";

const TXN_PAGE_SIZE = 10;

export function OverviewTransactionsTable({ sortedMovements }: { sortedMovements: any[] }) {
  const [txnPage, setTxnPage] = useState(0);

  const totalTxnPages = Math.ceil(sortedMovements.length / TXN_PAGE_SIZE);
  const pageMovements = sortedMovements.slice(txnPage * TXN_PAGE_SIZE, (txnPage + 1) * TXN_PAGE_SIZE);

  return (
    <div className="premium-card bg-white overflow-hidden">
      {/* Table header */}
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1.5">
          <ArrowUpRight className="w-3.5 h-3.5 text-brand-500" />Recent Material Transactions
        </p>
        <span className="text-[10px] text-slate-400">
          {sortedMovements.length} total — newest first
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50/60">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-slate-500 w-[90px]">Date</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-500">Item</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-500 w-[80px]">Type</th>
              <th className="text-right px-4 py-2 font-semibold text-slate-500 w-[70px]">Qty</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-500 w-[50px]">Unit</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-500">By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {pageMovements.map((m: any) => {
              const dateStr = m.transactionDate ?? m.createdAt;
              return (
                <tr key={m.id} className="hover:bg-slate-50/40 transition-colors">
                  <td className="px-4 py-2 text-slate-500 whitespace-nowrap">
                    {dateStr ? format(new Date(dateStr), "MMM d, yy") : "—"}
                  </td>
                  <td className="px-4 py-2 text-slate-700 font-medium truncate max-w-[200px]">
                    {m.item?.name ?? m.itemName ?? `Item #${m.itemId}`}
                  </td>
                  <td className="px-4 py-2">
                    <MovementTypeBadge type={m.movementType} past={true} />
                  </td>
                  <td className="px-4 py-2 text-right font-mono font-semibold text-slate-700">
                    {Number(m.quantity ?? 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 font-mono text-slate-400">
                    {m.item?.unitOfMeasure ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-slate-400 truncate max-w-[120px]">
                    {m.createdBy ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination footer */}
      <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <span className="text-[11px] text-slate-400">
          {txnPage * TXN_PAGE_SIZE + 1}–{Math.min((txnPage + 1) * TXN_PAGE_SIZE, sortedMovements.length)} of {sortedMovements.length}
        </span>
        <div className="flex items-center gap-2">
          <button
            data-testid="btn-txn-prev"
            onClick={() => setTxnPage(p => Math.max(0, p - 1))}
            disabled={txnPage === 0}
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] text-slate-500 font-semibold tabular-nums">
            {txnPage + 1} / {Math.max(1, totalTxnPages)}
          </span>
          <button
            data-testid="btn-txn-next"
            onClick={() => setTxnPage(p => Math.min(totalTxnPages - 1, p + 1))}
            disabled={txnPage >= totalTxnPages - 1}
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
