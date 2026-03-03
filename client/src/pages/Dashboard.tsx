import { useDashboardStats } from "@/hooks/use-dashboard";
import { PackageSearch, AlertTriangle, AlertCircle, DollarSign, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ItemStatusBadge, TransactionTypeBadge } from "@/components/StatusBadge";
import { format } from "date-fns";
import { Link } from "wouter";

export default function Dashboard() {
  const { data: stats, isLoading } = useDashboardStats();

  if (isLoading) {
    return <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-slate-200 w-48 rounded"></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1,2,3,4].map(i => <div key={i} className="h-32 bg-slate-200 rounded-2xl"></div>)}
      </div>
      <div className="h-96 bg-slate-200 rounded-2xl"></div>
    </div>;
  }

  const statCards = [
    { title: "Total Inventory Value", value: `$${stats?.totalValue || '0.00'}`, icon: DollarSign, color: "text-blue-600", bg: "bg-blue-50" },
    { title: "Active SKUs", value: stats?.totalSkus || 0, icon: PackageSearch, color: "text-indigo-600", bg: "bg-indigo-50" },
    { title: "Low Stock Items", value: stats?.lowStockCount || 0, icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50" },
    { title: "Out of Stock", value: stats?.outOfStockCount || 0, icon: AlertCircle, color: "text-rose-600", bg: "bg-rose-50" },
  ];

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-display font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-1">Overview of your inventory health and recent activity.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, i) => (
          <Card key={i} className="premium-card border-none shadow-sm">
            <CardContent className="p-6 flex items-start gap-4">
              <div className={`p-3 rounded-xl ${stat.bg}`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">{stat.title}</p>
                <h3 className="text-2xl font-display font-bold text-slate-900">{stat.value}</h3>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="premium-card bg-white p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-display font-bold text-slate-900">Recent Transactions</h3>
              <Link href="/transactions" className="text-sm font-medium text-blue-600 hover:text-blue-700">View All →</Link>
            </div>
            
            <div className="space-y-4">
              {stats?.recentTransactions?.length === 0 ? (
                <div className="text-center py-8 text-slate-500">No recent transactions.</div>
              ) : (
                stats?.recentTransactions?.slice(0, 5).map((tx: any) => (
                  <div key={tx.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${tx.actionType === 'receive' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                        {tx.actionType === 'receive' ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{tx.item?.name || 'Unknown Item'}</p>
                        <p className="text-sm text-slate-500">{format(new Date(tx.createdAt), 'MMM d, yyyy h:mm a')}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <TransactionTypeBadge type={tx.actionType} />
                      <p className="text-sm font-semibold mt-1">
                        {tx.actionType === 'issue' ? '-' : '+'}{tx.quantity} {tx.item?.unit}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="premium-card bg-white p-6">
            <h3 className="text-lg font-display font-bold text-slate-900 mb-6 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Action Required
            </h3>
            
            <div className="space-y-4">
              {/* This would ideally map over a real low stock array from stats */}
              <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                <p className="font-semibold text-amber-900 mb-1">Copper Wire 12 AWG</p>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-amber-700">Only 50 ft left</span>
                  <Link href="/inventory" className="font-medium text-amber-700 hover:text-amber-900 underline">Order Now</Link>
                </div>
              </div>
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl">
                <p className="font-semibold text-rose-900 mb-1">Junction Box 4x4</p>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-rose-700">Out of stock!</span>
                  <Link href="/inventory" className="font-medium text-rose-700 hover:text-rose-900 underline">Order Now</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
