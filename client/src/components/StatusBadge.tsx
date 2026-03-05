import { Badge } from "@/components/ui/badge";

export function ItemStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    in_stock:    { label: "In Stock",     className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    low_stock:   { label: "Low Stock",    className: "bg-amber-100 text-amber-700 border-amber-200" },
    out_of_stock:{ label: "Out of Stock", className: "bg-rose-100 text-rose-700 border-rose-200" },
    ordered:     { label: "Ordered",      className: "bg-sky-100 text-sky-700 border-sky-200" },
  };

  const { label, className } = config[status] || { label: status, className: "bg-slate-100 text-slate-700" };

  return (
    <Badge variant="outline" className={`${className} font-semibold px-2.5 py-0.5 rounded-full border`}>
      {label}
    </Badge>
  );
}

export function TransactionTypeBadge({ type }: { type: string }) {
  const config: Record<string, { label: string; className: string }> = {
    receive:  { label: "Received",    className: "bg-emerald-50 text-emerald-700 border-emerald-100" },
    issue:    { label: "Issued",      className: "bg-violet-50 text-violet-700 border-violet-100" },
    return:   { label: "Returned",    className: "bg-sky-50 text-sky-700 border-sky-100" },
    adjust:   { label: "Adjusted",    className: "bg-amber-50 text-amber-700 border-amber-100" },
    transfer: { label: "Transferred", className: "bg-slate-50 text-slate-700 border-slate-100" },
  };

  const { label, className } = config[type] || { label: type, className: "bg-slate-50 text-slate-700" };

  return (
    <Badge variant="outline" className={`${className} text-[10px] uppercase tracking-wider font-bold px-2 py-0 border`}>
      {label}
    </Badge>
  );
}
