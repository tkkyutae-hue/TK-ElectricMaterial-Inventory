/**
 * StatCard
 * A compact metric / KPI card for dashboard and summary areas.
 */

import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
  variant?: "default" | "green" | "red" | "amber" | "blue";
  className?: string;
}

const VARIANT_CLASSES: Record<string, string> = {
  default: "bg-white border-slate-200 text-slate-900",
  green:   "bg-emerald-50 border-emerald-200 text-emerald-800",
  red:     "bg-rose-50 border-rose-200 text-rose-800",
  amber:   "bg-amber-50 border-amber-200 text-amber-800",
  blue:    "bg-sky-50 border-sky-200 text-sky-800",
};

const ICON_CLASSES: Record<string, string> = {
  default: "text-slate-400",
  green:   "text-emerald-500",
  red:     "text-rose-500",
  amber:   "text-amber-500",
  blue:    "text-sky-500",
};

export function StatCard({ label, value, sub, icon, variant = "default", className }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border px-5 py-4 shadow-sm flex items-center gap-4",
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      {icon && (
        <div className={cn("shrink-0", ICON_CLASSES[variant])}>
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-60 truncate">{label}</p>
        <p className="text-2xl font-bold leading-none mt-1">{value}</p>
        {sub && <p className="text-xs opacity-60 mt-1 truncate">{sub}</p>}
      </div>
    </div>
  );
}
