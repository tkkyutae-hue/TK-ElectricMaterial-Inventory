import { useRoute, useLocation } from "wouter";
import { useProject, useUpdateProject } from "@/hooks/use-reference-data";
import { TransactionTypeBadge } from "@/components/StatusBadge";
import { MovementForm } from "@/components/MovementForm";
import { ArrowLeft, MapPin, Calendar, Package, ArrowUpRight, ArrowDownRight, Edit, Users } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const statusConfig: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  completed: { label: "Completed", className: "bg-slate-100 text-slate-600 border-slate-200" },
  on_hold: { label: "On Hold", className: "bg-amber-100 text-amber-700 border-amber-200" },
  cancelled: { label: "Cancelled", className: "bg-rose-100 text-rose-700 border-rose-200" },
};

export default function ProjectDetail() {
  const [, params] = useRoute("/projects/:id");
  const id = Number(params?.id || "0");
  const { data: project, isLoading } = useProject(id);
  const [logOpen, setLogOpen] = useState(false);

  if (isLoading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-slate-200 w-64 rounded" />
      <div className="h-48 bg-slate-200 rounded-2xl" />
    </div>
  );
  if (!project) return <div className="p-8 text-center text-slate-500">Project not found.</div>;

  const statusCfg = statusConfig[project.status] || { label: project.status, className: "" };
  const issued = project.recentActivity?.filter((tx: any) => tx.movementType === 'issue') || [];
  const returned = project.recentActivity?.filter((tx: any) => tx.movementType === 'return') || [];

  // Summarize usage by item
  const usageMap: Record<number, { itemName: string; sku: string; unit: string; issued: number; returned: number }> = {};
  project.recentActivity?.forEach((tx: any) => {
    if (!tx.item) return;
    const key = tx.item.id;
    if (!usageMap[key]) {
      usageMap[key] = { itemName: tx.item.name, sku: tx.item.sku, unit: tx.item.unitOfMeasure, issued: 0, returned: 0 };
    }
    if (tx.movementType === 'issue') usageMap[key].issued += tx.quantity;
    if (tx.movementType === 'return') usageMap[key].returned += tx.quantity;
  });
  const usageSummary = Object.values(usageMap).sort((a, b) => b.issued - a.issued);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Link href="/projects" className="p-2 hover:bg-white rounded-full text-slate-500 transition-colors mt-1">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-sm text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded">{project.code}</span>
            <Badge variant="outline" className={`${statusCfg.className} text-xs font-semibold`}>{statusCfg.label}</Badge>
          </div>
          <h1 className="text-3xl font-display font-bold text-slate-900 mt-2">{project.name}</h1>
          {project.customerName && <p className="text-slate-500 mt-1">{project.customerName}</p>}
        </div>
        <Dialog open={logOpen} onOpenChange={setLogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
              <ArrowUpRight className="w-4 h-4 mr-2" />Log Material
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[550px]">
            <DialogHeader><DialogTitle>Log Material for {project.code}</DialogTitle></DialogHeader>
            <div className="pt-2">
              <MovementForm defaultType="issue" onSuccess={() => setLogOpen(false)} />
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Issued", value: project.totalIssued || 0, icon: ArrowUpRight, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Total Returned", value: project.totalReturned || 0, icon: ArrowDownRight, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Net Used", value: (project.totalIssued || 0) - (project.totalReturned || 0), icon: Package, color: "text-slate-600", bg: "bg-slate-50" },
          { label: "Transactions", value: project.recentActivity?.length || 0, icon: Users, color: "text-indigo-600", bg: "bg-indigo-50" },
        ].map((s, i) => (
          <div key={i} className="premium-card bg-white p-5 flex items-start gap-3">
            <div className={`p-2 rounded-xl ${s.bg}`}><s.icon className={`w-5 h-5 ${s.color}`} /></div>
            <div>
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className="text-2xl font-display font-bold text-slate-900">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Tabs defaultValue="activity">
            <TabsList className="bg-slate-100 p-1 rounded-xl mb-4">
              <TabsTrigger value="activity" className="rounded-lg">Transaction History</TabsTrigger>
              <TabsTrigger value="summary" className="rounded-lg">Usage Summary</TabsTrigger>
            </TabsList>

            <TabsContent value="activity">
              <div className="premium-card bg-white overflow-hidden">
                <div className="divide-y divide-slate-100">
                  {!project.recentActivity?.length ? (
                    <div className="p-8 text-center text-slate-500">No transactions for this project yet.</div>
                  ) : project.recentActivity.map((tx: any) => (
                    <div key={tx.id} className="px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${tx.movementType === 'issue' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                          {tx.movementType === 'issue' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 text-sm">{tx.item?.name}</p>
                          <p className="text-xs text-slate-400">{format(new Date(tx.createdAt), 'MMM d, yyyy • HH:mm')}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <TransactionTypeBadge type={tx.movementType} />
                        <p className="text-sm font-semibold text-slate-900 mt-1">
                          {tx.movementType === 'issue' ? '-' : '+'}{tx.quantity} {tx.item?.unitOfMeasure}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="summary">
              <div className="premium-card bg-white overflow-hidden">
                {usageSummary.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">No material usage recorded yet.</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50/80">
                      <tr>
                        <th className="text-left p-4 font-semibold text-slate-600">Item</th>
                        <th className="text-right p-4 font-semibold text-slate-600">Issued</th>
                        <th className="text-right p-4 font-semibold text-slate-600">Returned</th>
                        <th className="text-right p-4 font-semibold text-slate-600">Net Used</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {usageSummary.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="p-4">
                            <p className="font-medium text-slate-900">{row.itemName}</p>
                            <p className="text-xs font-mono text-slate-400">{row.sku}</p>
                          </td>
                          <td className="p-4 text-right text-blue-600 font-semibold">{row.issued} {row.unit}</td>
                          <td className="p-4 text-right text-emerald-600 font-semibold">{row.returned} {row.unit}</td>
                          <td className="p-4 text-right font-bold text-slate-900">{row.issued - row.returned} {row.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div>
          <Card className="premium-card border-none">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
              <CardTitle className="text-sm font-semibold text-slate-700">Project Details</CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4 text-sm">
              {project.addressLine1 && (
                <div className="flex gap-3">
                  <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-slate-900">{project.addressLine1}</p>
                    <p className="text-slate-500">{[project.city, project.state, project.zipCode].filter(Boolean).join(", ")}</p>
                  </div>
                </div>
              )}
              {project.startDate && (
                <div className="flex gap-3">
                  <Calendar className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-slate-500">Start: {format(new Date(project.startDate), 'MMM d, yyyy')}</p>
                    {project.endDate && <p className="text-slate-500">End: {format(new Date(project.endDate), 'MMM d, yyyy')}</p>}
                  </div>
                </div>
              )}
              {project.notes && (
                <div className="pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-400 mb-1">Notes</p>
                  <p className="text-slate-600">{project.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
