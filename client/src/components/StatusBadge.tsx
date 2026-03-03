import { Badge } from "@/components/ui/badge";

export function ItemStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    in_stock: { label: "In Stock", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    low_stock: { label: "Low Stock", className: "bg-amber-100 text-amber-700 border-amber-200" },
    out_of_stock: { label: "Out of Stock", className: "bg-rose-100 text-rose-700 border-rose-200" },
    ordered: { label: "Ordered", className: "bg-blue-100 text-blue-700 border-blue-200" },
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
    receive: { label: "Received", className: "bg-emerald-50 text-emerald-700 border-emerald-100" },
    issue: { label: "Issued", className: "bg-blue-50 text-blue-700 border-blue-100" },
    return: { label: "Returned", className: "bg-indigo-50 text-indigo-700 border-indigo-100" },
    adjust: { label: "Adjusted", className: "bg-amber-50 text-amber-700 border-amber-100" },
    transfer: { label: "Transferred", className: "bg-slate-50 text-slate-700 border-slate-100" },
  };

  const { label, className } = config[type] || { label: type, className: "bg-slate-50 text-slate-700" };

  return (
    <Badge variant="outline" className={`${className} text-[10px] uppercase tracking-wider font-bold px-2 py-0 border`}>
      {label}
    </Badge>
  );
}
