import { useQuery } from "@tanstack/react-query";
import { useDashboardStats } from "@/hooks/use-dashboard";
import {
  PackageSearch, AlertTriangle, AlertCircle, DollarSign,
  ArrowUpRight, ArrowDownRight, ShoppingCart, TrendingDown,
  ChevronRight, XCircle, CheckCircle2, Activity, TrendingUp
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Area, AreaChart
} from "recharts";
import { ItemStatusBadge, TransactionTypeBadge } from "@/components/StatusBadge";
import { format } from "date-fns";
import { Link } from "wouter";

type CategorySummary = {
  id: number;
  name: string;
  code?: string | null;
  imageUrl?: string | null;
  skuCount: number;
  totalQuantity: number;
  lowStockCount: number;
  outOfStockCount: number;
};

type LowStockReport = {
  outOfStock: any[];
  lowStock: any[];
};

const CATEGORY_GRADIENTS: Record<string, string> = {
  "CT": "from-sky-700 to-sky-900",
  "CF": "from-slate-600 to-slate-800",
  "CS": "from-zinc-600 to-zinc-800",
  "CW": "from-orange-600 to-orange-900",
  "DV": "from-violet-600 to-violet-900",
  "FH": "from-stone-600 to-stone-800",
  "BC": "from-blue-600 to-blue-900",
  "DP": "from-indigo-700 to-indigo-900",
  "GT": "from-teal-600 to-teal-900",
};

function MonthlyTrendChart() {
  const { data: trend, isLoading } = useQuery<Array<{ label: string; value: number }>>({
    queryKey: ["/api/dashboard/monthly-trend"],
  });

  const formatDollar = (v: number) => `$${(v / 1000).toFixed(0)}k`;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-lg text-sm">
        <p className="font-semibold text-slate-500 mb-0.5">{label}</p>
        <p className="font-bold text-blue-600 text-base">
          ${payload[0].value.toLocaleString()}
        </p>
      </div>
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden" data-testid="chart-monthly-trend">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-600" />
          <h2 className="text-base font-semibold text-slate-900">Inventory Value — Last 12 Months</h2>
        </div>
        {trend && trend.length > 0 && (
          <div className="text-xs text-slate-400">
            {trend[0]?.label} → {trend[trend.length - 1]?.label}
          </div>
        )}
      </div>
      <div className="p-5">
        {isLoading ? (
          <div className="h-48 flex items-center justify-center">
            <div className="w-full h-32 bg-slate-100 rounded-lg animate-pulse" />
          </div>
        ) : !trend?.length ? (
          <div className="h-32 flex items-center justify-center text-sm text-slate-400">
            No historical data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={trend} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563EB" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                dy={6}
              />
              <YAxis
                tickFormatter={formatDollar}
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                width={45}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#2563EB"
                strokeWidth={2.5}
                fill="url(#blueGradient)"
                dot={false}
                activeDot={{ r: 4, fill: "#2563EB", strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function KpiCard({ title, value, icon: Icon, colorClass, bgClass, subtext, href }: {
  title: string; value: string | number; icon: any;
  colorClass: string; bgClass: string; subtext?: string; href?: string;
}) {
  const inner = (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow" data-testid={`kpi-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-lg ${bgClass}`}>
          <Icon className={`w-5 h-5 ${colorClass}`} />
        </div>
        {href && <ChevronRight className="w-4 h-4 text-slate-300 mt-1" />}
      </div>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{title}</p>
      <p className="text-2xl font-display font-bold text-slate-900">{value}</p>
      {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
    </div>
  );
  if (href) return <Link href={href}><div className="cursor-pointer">{inner}</div></Link>;
  return inner;
}

export default function Dashboard() {
  const { data: stats, isLoading } = useDashboardStats();

  const { data: categories } = useQuery<CategorySummary[]>({
    queryKey: ["/api/inventory/categories/summary"],
  });

  const { data: lowStockReport } = useQuery<LowStockReport>({
    queryKey: ["/api/reports/low-stock"],
  });

  const totalValue = stats ? parseFloat(stats.totalValue || "0").toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }) : "$0";

  return (
    <div className="space-y-6 pb-12">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">Inventory health and operational status.</p>
        </div>
        <div className="text-xs text-slate-400 font-medium">
          {format(new Date(), "EEEE, MMMM d, yyyy")}
        </div>
      </div>

      {/* KPI cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[1,2,3,4,5].map(i => <div key={i} className="h-28 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <KpiCard
            title="Inventory Value"
            value={totalValue}
            icon={DollarSign}
            colorClass="text-blue-600"
            bgClass="bg-blue-50"
            subtext={`${stats?.totalSkus || 0} active SKUs`}
          />
          <KpiCard
            title="Active SKUs"
            value={stats?.totalSkus || 0}
            icon={PackageSearch}
            colorClass="text-indigo-600"
            bgClass="bg-indigo-50"
            subtext="Items tracked"
            href="/inventory"
          />
          <KpiCard
            title="Low Stock"
            value={stats?.lowStockCount || 0}
            icon={AlertTriangle}
            colorClass="text-amber-500"
            bgClass="bg-amber-50"
            subtext="Below reorder point"
            href="/reorder"
          />
          <KpiCard
            title="Out of Stock"
            value={stats?.outOfStockCount || 0}
            icon={AlertCircle}
            colorClass="text-red-500"
            bgClass="bg-red-50"
            subtext="Immediate action needed"
            href="/reorder"
          />
          <KpiCard
            title="Pending Reorders"
            value={stats?.pendingReorderCount || 0}
            icon={ShoppingCart}
            colorClass="text-violet-600"
            bgClass="bg-violet-50"
            subtext="Awaiting order"
            href="/reorder"
          />
        </div>
      )}

      {/* Monthly inventory value chart */}
      <MonthlyTrendChart />

      {/* Categories quicklinks */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-600" />
            Category Status
          </h2>
          <Link href="/inventory" className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">
            Full Inventory →
          </Link>
        </div>

        {!categories ? (
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
            {[1,2,3,4,5,6,7,8,9].map(i => <div key={i} className="h-24 bg-slate-100 rounded-lg animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
            {categories.map(cat => {
              const gradient = CATEGORY_GRADIENTS[cat.code || ""] || "from-slate-600 to-slate-800";
              const hasIssue = cat.outOfStockCount > 0 || cat.lowStockCount > 0;
              return (
                <Link href={`/inventory/category/${cat.id}`} key={cat.id}>
                  <div className="relative rounded-lg overflow-hidden cursor-pointer group border border-slate-200 hover:border-blue-300 transition-all hover:shadow-md" data-testid={`card-category-dash-${cat.id}`}>
                    <div className="relative h-20">
                      {cat.imageUrl ? (
                        <img src={cat.imageUrl} alt={cat.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          onError={(e) => {
                            const t = e.currentTarget;
                            t.style.display = "none";
                            t.nextElementSibling?.classList.remove("hidden");
                          }}
                        />
                      ) : null}
                      <div className={`${cat.imageUrl ? "hidden" : ""} absolute inset-0 bg-gradient-to-br ${gradient}`} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      {hasIssue && (
                        <div className="absolute top-1 right-1">
                          {cat.outOfStockCount > 0
                            ? <span className="w-4 h-4 bg-red-500 rounded-full block border border-white" />
                            : <span className="w-4 h-4 bg-amber-400 rounded-full block border border-white" />}
                        </div>
                      )}
                    </div>
                    <div className="p-1.5 bg-white">
                      <p className="text-[10px] font-semibold text-slate-700 truncate leading-tight">{cat.name}</p>
                      <p className="text-[10px] text-slate-400">{cat.skuCount} SKUs</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Recent Transactions — 2 cols */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h3 className="text-base font-semibold text-slate-900">Recent Transactions</h3>
            <Link href="/transactions" className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors">View All →</Link>
          </div>
          <div className="divide-y divide-slate-50">
            {isLoading ? (
              [1,2,3,4,5].map(i => (
                <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 animate-pulse flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 bg-slate-100 rounded w-48 animate-pulse" />
                    <div className="h-3 bg-slate-100 rounded w-32 animate-pulse" />
                  </div>
                  <div className="h-3.5 w-20 bg-slate-100 rounded animate-pulse" />
                </div>
              ))
            ) : stats?.recentActivity?.length === 0 ? (
              <div className="text-center py-10 text-slate-500">
                <p className="text-sm">No transactions recorded yet.</p>
              </div>
            ) : (
              stats?.recentActivity?.slice(0, 6).map((tx: any) => {
                const isIn = tx.movementType === 'receive' || tx.movementType === 'return';
                return (
                  <div key={tx.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/60 transition-colors" data-testid={`row-tx-${tx.id}`}>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg flex-shrink-0 ${isIn ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                        {isIn ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 leading-tight">{tx.item?.name || 'Unknown'}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{format(new Date(tx.createdAt), 'MMM d, h:mm a')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <TransactionTypeBadge type={tx.movementType} />
                      <span className={`text-sm font-bold tabular-nums ${isIn ? 'text-emerald-600' : 'text-blue-600'}`}>
                        {isIn ? '+' : '-'}{tx.quantity}
                        <span className="text-xs font-normal text-slate-400 ml-1">{tx.item?.unitOfMeasure}</span>
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Action Required — 1 col */}
        <div className="space-y-4">
          {/* Out of stock alert */}
          {(stats?.outOfStockCount > 0 || stats?.lowStockCount > 0) ? (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-semibold text-slate-900">Action Required</h3>
                <Link href="/reorder" className="ml-auto text-xs font-medium text-blue-600 hover:text-blue-700">Reorder →</Link>
              </div>
              <div className="p-4 space-y-2.5">
                {lowStockReport?.outOfStock?.slice(0, 3).map((item: any) => (
                  <Link href={`/inventory/${item.id}`} key={item.id}>
                    <div className="flex items-start justify-between p-3 bg-red-50 border border-red-100 rounded-lg hover:border-red-200 transition-colors cursor-pointer" data-testid={`alert-out-${item.id}`}>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-mono text-red-400">{item.sku}</p>
                        <p className="text-sm font-semibold text-red-900 truncate">{item.name}</p>
                        <p className="text-xs text-red-600 mt-0.5">Out of Stock</p>
                      </div>
                      <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5 ml-2" />
                    </div>
                  </Link>
                ))}
                {lowStockReport?.lowStock?.slice(0, 4).map((item: any) => (
                  <Link href={`/inventory/${item.id}`} key={item.id}>
                    <div className="flex items-start justify-between p-3 bg-amber-50 border border-amber-100 rounded-lg hover:border-amber-200 transition-colors cursor-pointer" data-testid={`alert-low-${item.id}`}>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-mono text-amber-500">{item.sku}</p>
                        <p className="text-sm font-semibold text-amber-900 truncate">{item.name}</p>
                        <p className="text-xs text-amber-700 mt-0.5">{item.quantityOnHand} {item.unitOfMeasure} left · Reorder at {item.reorderPoint}</p>
                      </div>
                      <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5 ml-2" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <h3 className="text-sm font-semibold text-slate-900">Stock Health</h3>
              </div>
              <p className="text-sm text-slate-500">All items are within normal stock levels. No immediate action required.</p>
            </div>
          )}

          {/* Low Stock table */}
          {lowStockReport && (lowStockReport.outOfStock.length + lowStockReport.lowStock.length) > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-900">Stock Summary</h3>
              </div>
              <div className="p-4 space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">Out of stock</span>
                  <span className="font-bold text-red-600">{lowStockReport.outOfStock.length}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">Low stock</span>
                  <span className="font-bold text-amber-600">{lowStockReport.lowStock.length}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">Healthy</span>
                  <span className="font-bold text-emerald-600">{(stats?.totalSkus || 0) - lowStockReport.outOfStock.length - lowStockReport.lowStock.length}</span>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <div className="flex gap-1 h-2 rounded-full overflow-hidden">
                    <div className="bg-red-400 rounded-l-full" style={{ width: `${(lowStockReport.outOfStock.length / (stats?.totalSkus || 1)) * 100}%` }} />
                    <div className="bg-amber-400" style={{ width: `${(lowStockReport.lowStock.length / (stats?.totalSkus || 1)) * 100}%` }} />
                    <div className="bg-emerald-400 flex-1 rounded-r-full" />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                    <span>Out of Stock</span>
                    <span>Low</span>
                    <span>Healthy</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
