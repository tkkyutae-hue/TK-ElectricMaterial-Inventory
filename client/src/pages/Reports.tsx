import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { BarChart3, Package, AlertTriangle, MapPin, DollarSign, Briefcase, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ItemStatusBadge } from "@/components/StatusBadge";
import { Link } from "wouter";

async function fetchJson(url: string) {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

function formatCurrency(value: string | number) {
  return `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function Reports() {
  const { data: lowStock } = useQuery({ queryKey: [api.reports.lowStock.path], queryFn: () => fetchJson(api.reports.lowStock.path) });
  const { data: byLocation } = useQuery({ queryKey: [api.reports.byLocation.path], queryFn: () => fetchJson(api.reports.byLocation.path) });
  const { data: valuation } = useQuery({ queryKey: [api.reports.valuation.path], queryFn: () => fetchJson(api.reports.valuation.path) });
  const { data: usageByProject } = useQuery({ queryKey: [api.reports.usageByProject.path], queryFn: () => fetchJson(api.reports.usageByProject.path) });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-slate-900">Reports</h1>
        <p className="text-slate-500 mt-1">Inventory analytics and operational summaries.</p>
      </div>

      <Tabs defaultValue="valuation">
        <TabsList className="bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="valuation" className="rounded-lg gap-2"><DollarSign className="w-4 h-4" />Valuation</TabsTrigger>
          <TabsTrigger value="low-stock" className="rounded-lg gap-2"><AlertTriangle className="w-4 h-4" />Low Stock</TabsTrigger>
          <TabsTrigger value="by-location" className="rounded-lg gap-2"><MapPin className="w-4 h-4" />By Location</TabsTrigger>
          <TabsTrigger value="projects" className="rounded-lg gap-2"><Briefcase className="w-4 h-4" />Usage by Project</TabsTrigger>
        </TabsList>

        {/* ── Valuation ──────────────────────────────────────────────────────── */}
        <TabsContent value="valuation" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="premium-card bg-white p-6">
              <p className="text-sm text-slate-500 mb-1">Total Inventory Value</p>
              <p className="text-3xl font-display font-bold text-slate-900">{formatCurrency(valuation?.totalValue || 0)}</p>
            </div>
            <div className="premium-card bg-white p-6">
              <p className="text-sm text-slate-500 mb-1">Active SKUs</p>
              <p className="text-3xl font-display font-bold text-slate-900">{valuation?.items?.length || 0}</p>
            </div>
            <div className="premium-card bg-white p-6">
              <p className="text-sm text-slate-500 mb-1">Categories</p>
              <p className="text-3xl font-display font-bold text-slate-900">{valuation?.byCategory?.length || 0}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-2">
              <div className="premium-card bg-white overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="font-semibold text-slate-900">By Category</h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {valuation?.byCategory?.map((cat: any, i: number) => {
                    const pct = valuation.totalValue > 0 ? (cat.value / Number(valuation.totalValue) * 100) : 0;
                    return (
                      <div key={i} className="p-4">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-sm font-medium text-slate-700 truncate mr-2">{cat.name}</span>
                          <span className="text-sm font-semibold text-slate-900 flex-shrink-0">{formatCurrency(cat.value)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full">
                            <div className="h-1.5 bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-slate-400 w-9 text-right">{pct.toFixed(0)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="lg:col-span-3">
              <div className="premium-card bg-white overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="font-semibold text-slate-900">Top Items by Value</h3>
                </div>
                <Table>
                  <TableHeader className="bg-slate-50/80">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-semibold text-slate-600">Item</TableHead>
                      <TableHead className="font-semibold text-slate-600 text-right">Qty</TableHead>
                      <TableHead className="font-semibold text-slate-600 text-right">Unit Cost</TableHead>
                      <TableHead className="font-semibold text-slate-600 text-right">Total Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {valuation?.items?.slice(0, 15).map((item: any) => (
                      <TableRow key={item.id} className="hover:bg-slate-50/50">
                        <TableCell>
                          <Link href={`/inventory/${item.id}`} className="font-medium text-slate-900 hover:text-blue-600 text-sm">{item.name}</Link>
                          <p className="text-xs font-mono text-slate-400">{item.sku}</p>
                        </TableCell>
                        <TableCell className="text-right text-sm">{item.quantityOnHand} <span className="text-slate-400">{item.unitOfMeasure}</span></TableCell>
                        <TableCell className="text-right text-sm">{item.unitCost ? `$${parseFloat(item.unitCost).toFixed(2)}` : '—'}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(item.totalValue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── Low Stock ─────────────────────────────────────────────────────── */}
        <TabsContent value="low-stock" className="space-y-6 mt-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5">
              <p className="text-2xl font-display font-bold text-rose-900">{lowStock?.outOfStock?.length || 0}</p>
              <p className="text-rose-700 text-sm mt-1">Out of Stock</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
              <p className="text-2xl font-display font-bold text-amber-900">{lowStock?.lowStock?.length || 0}</p>
              <p className="text-amber-700 text-sm mt-1">Below Reorder Point</p>
            </div>
          </div>

          {lowStock?.outOfStock?.length > 0 && (
            <div className="premium-card bg-white overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-rose-50/50">
                <h3 className="font-semibold text-rose-900">Out of Stock</h3>
              </div>
              <StockTable items={lowStock.outOfStock} />
            </div>
          )}

          {lowStock?.lowStock?.length > 0 && (
            <div className="premium-card bg-white overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-amber-50/50">
                <h3 className="font-semibold text-amber-900">Below Reorder Point</h3>
              </div>
              <StockTable items={lowStock.lowStock} />
            </div>
          )}

          {!lowStock?.outOfStock?.length && !lowStock?.lowStock?.length && (
            <div className="premium-card bg-white p-16 text-center">
              <TrendingUp className="w-12 h-12 mx-auto text-emerald-400 mb-3" />
              <p className="font-semibold text-slate-900">All stock levels are healthy</p>
            </div>
          )}
        </TabsContent>

        {/* ── By Location ───────────────────────────────────────────────────── */}
        <TabsContent value="by-location" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {byLocation?.map((loc: any) => (
              <div key={loc.location.id} className="premium-card bg-white p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{loc.location.name}</p>
                    <p className="text-xs text-slate-400 capitalize">{loc.location.locationType}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">Active SKUs</p>
                    <p className="text-xl font-display font-bold text-slate-900">{loc.itemCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">Total Value</p>
                    <p className="text-lg font-display font-bold text-slate-900">{formatCurrency(loc.totalValue)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {byLocation?.map((loc: any) => loc.balances?.filter((b: any) => b.quantityOnHand > 0).length > 0 && (
            <div key={loc.location.id} className="premium-card bg-white overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <h3 className="font-semibold text-slate-900">{loc.location.name}</h3>
              </div>
              <Table>
                <TableHeader className="bg-slate-50/80">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-semibold text-slate-600">Item</TableHead>
                    <TableHead className="font-semibold text-slate-600 text-right">Quantity</TableHead>
                    <TableHead className="font-semibold text-slate-600 text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loc.balances?.filter((b: any) => b.quantityOnHand > 0).map((b: any) => (
                    <TableRow key={b.id} className="hover:bg-slate-50/50">
                      <TableCell>
                        <p className="font-medium text-slate-900 text-sm">{b.item?.name}</p>
                        <p className="text-xs font-mono text-slate-400">{b.item?.sku}</p>
                      </TableCell>
                      <TableCell className="text-right">{b.quantityOnHand} <span className="text-slate-400 text-xs">{b.item?.unitOfMeasure}</span></TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {b.item?.unitCost ? formatCurrency(Number(b.item.unitCost) * b.quantityOnHand) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
        </TabsContent>

        {/* ── Usage by Project ───────────────────────────────────────────────── */}
        <TabsContent value="projects" className="mt-6">
          <div className="premium-card bg-white overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-semibold text-slate-600">Project</TableHead>
                  <TableHead className="font-semibold text-slate-600">Customer</TableHead>
                  <TableHead className="font-semibold text-slate-600">Status</TableHead>
                  <TableHead className="font-semibold text-slate-600 text-right">Issued</TableHead>
                  <TableHead className="font-semibold text-slate-600 text-right">Returned</TableHead>
                  <TableHead className="font-semibold text-slate-600 text-right">Net Used</TableHead>
                  <TableHead className="font-semibold text-slate-600 text-right">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usageByProject?.filter((r: any) => r.project).map((row: any) => (
                  <TableRow key={row.project.id} className="hover:bg-slate-50/50">
                    <TableCell>
                      <Link href={`/projects/${row.project.id}`}>
                        <p className="font-semibold text-blue-700 hover:underline">{row.project.code}</p>
                        <p className="text-xs text-slate-500">{row.project.name}</p>
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">{row.project.customerName || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">{row.project.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium text-blue-700">{row.totalIssued}</TableCell>
                    <TableCell className="text-right font-medium text-emerald-700">{row.totalReturned}</TableCell>
                    <TableCell className="text-right font-bold text-slate-900">{row.netUsage}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(row.totalValue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StockTable({ items }: { items: any[] }) {
  return (
    <Table>
      <TableHeader className="bg-slate-50/80">
        <TableRow className="hover:bg-transparent">
          <TableHead className="font-semibold text-slate-600">Item</TableHead>
          <TableHead className="font-semibold text-slate-600">Category</TableHead>
          <TableHead className="font-semibold text-slate-600 text-right">On Hand</TableHead>
          <TableHead className="font-semibold text-slate-600 text-right">Reorder Pt</TableHead>
          <TableHead className="font-semibold text-slate-600">Supplier</TableHead>
          <TableHead className="font-semibold text-slate-600">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map(item => {
          const status = item.quantityOnHand === 0 ? 'out_of_stock' : 'low_stock';
          return (
            <TableRow key={item.id} className="hover:bg-slate-50/50">
              <TableCell>
                <Link href={`/inventory/${item.id}`}>
                  <p className="font-medium text-slate-900 hover:text-blue-600 text-sm">{item.name}</p>
                  <p className="text-xs font-mono text-slate-400">{item.sku}</p>
                </Link>
              </TableCell>
              <TableCell className="text-xs text-slate-500">{item.category?.name || '—'}</TableCell>
              <TableCell className="text-right font-semibold text-rose-600">{item.quantityOnHand} <span className="text-slate-400">{item.unitOfMeasure}</span></TableCell>
              <TableCell className="text-right text-slate-500">{item.reorderPoint}</TableCell>
              <TableCell className="text-xs text-slate-500">{item.supplier?.name || '—'}</TableCell>
              <TableCell><ItemStatusBadge status={status} /></TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
