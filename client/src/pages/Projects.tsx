import { useProjects } from "@/hooks/use-reference-data";
import { Briefcase, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Projects() {
  const { data: projects, isLoading } = useProjects();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-slate-900">Projects</h1>
        <p className="text-slate-500 mt-1">Active job sites and cost centers.</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1,2].map(i => <div key={i} className="h-32 bg-slate-100 rounded-xl animate-pulse"></div>)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects?.map(project => (
            <Card key={project.id} className="premium-card border-none border-l-4 border-l-blue-600">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-display font-bold text-lg text-slate-900">{project.name}</h3>
                  {project.active ? (
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200" variant="outline">Active</Badge>
                  ) : (
                    <Badge variant="secondary">Closed</Badge>
                  )}
                </div>
                <p className="font-mono text-xs text-blue-600 font-semibold mb-4 bg-blue-50 inline-block px-2 py-1 rounded">Code: {project.code}</p>
                
                <div className="flex items-start gap-2 text-sm text-slate-600">
                  <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  <span>{project.location || 'No location set'}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
