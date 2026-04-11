import { FileText } from "lucide-react";

interface ReportsSummaryCardProps {
  totalReports: number;
  submittedCount: number;
  draftCount: number;
}

export function ReportsSummaryCard({ totalReports, submittedCount, draftCount }: ReportsSummaryCardProps) {
  return (
    <div className="premium-card bg-white p-5">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
        <FileText className="w-3.5 h-3.5" />Daily Reports
      </p>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Total Reports</span>
          <span className="text-lg font-display font-bold text-slate-900">{totalReports}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full"
              style={{ width: totalReports ? `${(submittedCount / totalReports) * 100}%` : "0%" }}
            />
          </div>
        </div>
        <div className="flex gap-3">
          <div className="flex-1 text-center px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-100">
            <p className="text-[10px] text-emerald-600 uppercase tracking-wide">Submitted</p>
            <p className="text-xl font-bold text-emerald-700">{submittedCount}</p>
          </div>
          <div className="flex-1 text-center px-3 py-2 rounded-xl bg-amber-50 border border-amber-100">
            <p className="text-[10px] text-amber-600 uppercase tracking-wide">Draft</p>
            <p className="text-xl font-bold text-amber-700">{draftCount}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
