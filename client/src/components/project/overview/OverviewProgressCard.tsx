import { TrendingUp } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";

interface ProgressData {
  summary: {
    overallPct: number;
    estTotal: number;
    installed: number;
    remaining: number;
    todayAdded: number;
  };
}

export function OverviewProgressCard({ progressData }: { progressData?: ProgressData }) {
  const { t } = useLanguage();
  const overallPct  = progressData?.summary?.overallPct  ?? 0;
  const todayAdded  = progressData?.summary?.todayAdded  ?? 0;
  const installed   = progressData?.summary?.installed   ?? 0;
  const remaining   = progressData?.summary?.remaining   ?? 0;
  const estTotal    = progressData?.summary?.estTotal    ?? 0;

  const pctColor = overallPct >= 100 ? "bg-emerald-500"
    : overallPct >= 70 ? "bg-brand-500"
    : overallPct >= 40 ? "bg-blue-400"
    : "bg-slate-300";

  const pctText = overallPct >= 100 ? "text-emerald-600"
    : overallPct >= 70 ? "text-brand-600"
    : overallPct >= 40 ? "text-blue-600"
    : "text-slate-400";

  const prevInstalled = Math.max(0, installed - todayAdded);
  const prevPct  = estTotal > 0 ? Math.min(100, (prevInstalled / estTotal) * 100) : 0;
  const todayPct = estTotal > 0 ? Math.min(100 - prevPct, (todayAdded / estTotal) * 100) : 0;

  return (
    <div className="premium-card bg-white p-5">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
        <TrendingUp className="w-3.5 h-3.5" />{t.projOverviewOverallProgress}
      </p>

      <div className="flex items-end gap-2 mb-2">
        <span className={`text-4xl font-display font-bold ${pctText}`}>{overallPct.toFixed(1)}%</span>
        <span className="text-xs text-slate-400 mb-1">{t.projOverviewComplete}</span>
      </div>

      {/* Dual-segment progress bar */}
      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden relative">
        <div className={`absolute left-0 top-0 h-full ${pctColor} transition-all`} style={{ width: `${prevPct}%` }} />
        <div className="absolute top-0 h-full bg-brand-400 transition-all" style={{ left: `${prevPct}%`, width: `${todayPct}%` }} />
      </div>

      {todayAdded > 0 && (
        <div className="flex items-center gap-3 mt-2">
          <span className="flex items-center gap-1 text-[10px] text-emerald-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />{t.projOverviewPrevious}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-brand-600">
            <span className="w-2 h-2 rounded-full bg-brand-400 inline-block" />{t.projOverviewTodayLabel} +{todayAdded.toLocaleString()}
          </span>
        </div>
      )}

      {progressData && (
        <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100">
          <div>
            <p className="text-[10px] text-slate-400">{t.projOverviewInstalled}</p>
            <p className="text-sm font-bold text-emerald-700">{installed.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400">{t.projOverviewRemaining}</p>
            <p className="text-sm font-bold text-amber-700">{remaining.toLocaleString()}</p>
          </div>
          {todayAdded > 0 && (
            <div>
              <p className="text-[10px] text-brand-500">{t.projOverviewTodayAdded}</p>
              <p className="text-sm font-bold text-brand-600">+{todayAdded.toLocaleString()}</p>
            </div>
          )}
          <div>
            <p className="text-[10px] text-slate-400">{t.projOverviewEstTotal}</p>
            <p className="text-sm font-bold text-slate-700">{estTotal.toLocaleString()}</p>
          </div>
        </div>
      )}
    </div>
  );
}
