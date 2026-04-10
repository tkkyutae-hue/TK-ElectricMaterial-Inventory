import { useState } from "react";
import { useRoute } from "wouter";
import { Link } from "wouter";
import { ArrowLeft, ArrowUpRight, Edit, FileBarChart, LayoutList, Package, FileText, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MovementForm } from "@/components/MovementForm";
import { useProjects, useProject } from "@/hooks/use-reference-data";

import { statusConfig } from "@/components/project/types";
import { EditProjectDialog } from "@/components/project/EditProjectDialog";
import { ScopeItemsTab } from "@/components/project/ScopeItemsTab";
import { ProgressTab } from "@/components/project/ProgressTab";
import { OverviewTab, MaterialUsageTab, DailyReportsTab } from "@/components/project/OverviewTab";

export default function ProjectDetail() {
  const [, params] = useRoute("/projects/:id");
  const id = Number(params?.id || "0");
  const { data: project, isLoading } = useProject(id);
  const { data: allProjects = [] } = useProjects();
  const [logOpen, setLogOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  if (isLoading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-slate-200 w-64 rounded" />
      <div className="h-48 bg-slate-200 rounded-2xl" />
    </div>
  );
  if (!project) return <div className="p-8 text-center text-slate-500">Project not found.</div>;

  const statusCfg = statusConfig[project.status] || { label: project.status, className: "" };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/projects" className="p-2 hover:bg-white rounded-full text-slate-500 transition-colors mt-1">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="outline" className={`${statusCfg.className} text-xs font-semibold`}>{statusCfg.label}</Badge>
            {project.poNumber && (
              <span className="text-sm font-mono font-bold text-brand-700 bg-brand-50 border border-brand-100 px-2.5 py-1 rounded-lg">
                PO: {project.poNumber}
              </span>
            )}
          </div>
          <h1 className="text-3xl font-display font-bold text-slate-900 mt-2">{project.name}</h1>
          {project.customerName && <p className="text-slate-500 mt-1">{project.customerName}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="bg-white" onClick={() => setEditOpen(true)} data-testid="button-edit-project">
            <Edit className="w-4 h-4 mr-2" /> Edit
          </Button>
          <Dialog open={logOpen} onOpenChange={setLogOpen}>
            <Button className="bg-brand-700 hover:bg-brand-800 text-white shadow-sm" onClick={() => setLogOpen(true)}>
              <ArrowUpRight className="w-4 h-4 mr-2" />Log Material
            </Button>
            <DialogContent className="sm:max-w-[760px] flex flex-col max-h-[90vh] gap-0 p-0">
              <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 shrink-0">
                <DialogTitle>Log Material for {project.code}</DialogTitle>
              </DialogHeader>
              <div className="flex-1 flex flex-col min-h-0 px-6 pt-4 pb-6 overflow-hidden">
                <MovementForm defaultType="issue" onSuccess={() => setLogOpen(false)} onCancel={() => setLogOpen(false)} />
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <EditProjectDialog project={project} open={editOpen} onClose={() => setEditOpen(false)} allProjects={allProjects} />

      {/* Main tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="bg-slate-100 p-1 rounded-xl mb-4">
          <TabsTrigger value="overview" className="rounded-lg" data-testid="tab-overview">
            <FileBarChart className="w-3.5 h-3.5 mr-1.5" />Overview
          </TabsTrigger>
          <TabsTrigger value="scope" className="rounded-lg" data-testid="tab-scope-items">
            <LayoutList className="w-3.5 h-3.5 mr-1.5" />Scope Items
          </TabsTrigger>
          <TabsTrigger value="material-usage" className="rounded-lg" data-testid="tab-material-usage">
            <Package className="w-3.5 h-3.5 mr-1.5" />Material Usage
          </TabsTrigger>
          <TabsTrigger value="reports" className="rounded-lg" data-testid="tab-reports">
            <FileText className="w-3.5 h-3.5 mr-1.5" />Daily Reports
          </TabsTrigger>
          <TabsTrigger value="progress" className="rounded-lg" data-testid="tab-progress">
            <TrendingUp className="w-3.5 h-3.5 mr-1.5" />Progress
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab project={project} projectId={id} />
        </TabsContent>

        <TabsContent value="scope">
          <ScopeItemsTab projectId={id} />
        </TabsContent>

        <TabsContent value="material-usage">
          <MaterialUsageTab projectId={id} />
        </TabsContent>

        <TabsContent value="reports">
          <DailyReportsTab projectId={id} project={project} />
        </TabsContent>

        <TabsContent value="progress">
          <ProgressTab projectId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
