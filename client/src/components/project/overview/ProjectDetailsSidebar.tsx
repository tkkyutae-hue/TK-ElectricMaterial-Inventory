import { format } from "date-fns";
import { MapPin, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ProjectDetailsSidebar({ project }: { project: any }) {
  return (
    <Card className="premium-card border-none">
      <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
        <CardTitle className="text-sm font-semibold text-slate-700">Project Details</CardTitle>
      </CardHeader>
      <CardContent className="p-5 space-y-4 text-sm">
        {project.poNumber && (
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">PO Number</p>
            <p className="font-semibold text-brand-700">{project.poNumber}</p>
          </div>
        )}
        {project.ownerName && (
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-0.5">Project Owner</p>
            <p className="font-semibold text-slate-900">{project.ownerName}</p>
          </div>
        )}
        {project.jobLocation && (
          <div className="flex gap-3">
            <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <p className="text-slate-600">{project.jobLocation}</p>
          </div>
        )}
        {(project.startDate || project.endDate) && (
          <div className="flex gap-3">
            <Calendar className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-0.5">
              {project.startDate && (
                <p className="text-slate-600">
                  <span className="text-slate-400">Start: </span>
                  {format(new Date(project.startDate + "T00:00:00"), "MMM d, yyyy")}
                </p>
              )}
              {project.endDate && (
                <p className="text-slate-600">
                  <span className="text-slate-400">End: </span>
                  {format(new Date(project.endDate + "T00:00:00"), "MMM d, yyyy")}
                </p>
              )}
            </div>
          </div>
        )}
        {project.notes && (
          <div className="pt-3 border-t border-slate-100">
            <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Notes</p>
            <p className="text-slate-600 leading-relaxed">{project.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
