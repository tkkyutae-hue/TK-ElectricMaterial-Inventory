import { Badge } from "@/components/ui/badge";

export function ItemStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'in_stock':
      return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-none">In Stock</Badge>;
    case 'low_stock':
      return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-none">Low Stock</Badge>;
    case 'out_of_stock':
      return <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 border-none">Out of Stock</Badge>;
    case 'on_order':
      return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-none">On Order</Badge>;
    default:
      return <Badge variant="secondary" className="border-none">{status}</Badge>;
  }
}

export function TransactionTypeBadge({ type }: { type: string }) {
  switch (type) {
    case 'receive':
      return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200" variant="outline">Receive</Badge>;
    case 'issue':
      return <Badge className="bg-blue-50 text-blue-700 border-blue-200" variant="outline">Issue</Badge>;
    case 'return':
      return <Badge className="bg-purple-50 text-purple-700 border-purple-200" variant="outline">Return</Badge>;
    case 'adjust':
      return <Badge className="bg-slate-100 text-slate-700 border-slate-200" variant="outline">Adjust</Badge>;
    case 'transfer':
      return <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200" variant="outline">Transfer</Badge>;
    default:
      return <Badge variant="outline">{type}</Badge>;
  }
}
