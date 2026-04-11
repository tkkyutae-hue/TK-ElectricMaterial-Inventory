import { format } from "date-fns";
import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ProjectSummaryCardProps {
  project: any;
  statusCfg: { label: string; className: string };
}

export function ProjectSummaryCard({ project, statusCfg }: ProjectSummaryCardProps) {
  return (
    <div className="premium-card bg-white p-6 space-y-5 h-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Project</p>
          <h2 className="text-2xl font-display font-bold text-slate-900">{project.name}</h2>
          {project.customerName && (
            <p className="text-sm text-slate-500 mt-0.5">{project.customerName}</p>
          )}
        </div>
        <Badge variant="outline" className={`${statusCfg.className} text-xs font-semibold shrink-0`}>
          {statusCfg.label}
        </Badge>
      </div>

      {/* Metadata grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
        {project.poNumber && (
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">PO Number</p>
            <p className="text-sm font-mono font-bold text-brand-700">{project.poNumber}</p>
          </div>
        )}
        {project.ownerName && (
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Owner / Manager</p>
            <p className="text-sm font-semibold text-slate-800">{project.ownerName}</p>
          </div>
        )}
        {project.jobLocation && (
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Location</p>
            <p className="text-sm text-slate-700 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />{project.jobLocation}
            </p>
          </div>
        )}
        {project.startDate && (
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Start Date</p>
            <p className="text-sm text-slate-700">
              {format(new Date(project.startDate + "T00:00:00"), "MMM d, yyyy")}
            </p>
          </div>
        )}
        {project.endDate && (
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">End Date</p>
            <p className="text-sm text-slate-700">
              {format(new Date(project.endDate + "T00:00:00"), "MMM d, yyyy")}
            </p>
          </div>
        )}
      </div>

      {/* Notes */}
      {project.notes && (
        <div className="pt-3 border-t border-slate-100">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Notes</p>
          <p className="text-sm text-slate-600 leading-relaxed">{project.notes}</p>
        </div>
      )}
    </div>
  );
}
