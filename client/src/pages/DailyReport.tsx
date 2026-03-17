import { ClipboardList, Briefcase, Construction } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DailyReport() {
  return (
    <div className="space-y-6">

      {/* Page header */}
      <div>
        <h1 className="text-3xl font-display font-bold text-slate-900">
          Daily Report Mode
        </h1>
        <p className="text-slate-500 mt-1">
          Log project-based daily field reports, track manpower, and record progress by jobsite.
        </p>
      </div>

      {/* Project List card */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-3 pb-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-50">
            <Briefcase className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold text-slate-800">
              Project List
            </CardTitle>
            <p className="text-xs text-slate-400 mt-0.5">
              Select a project to file or view a daily report
            </p>
          </div>
        </CardHeader>

        <CardContent>
          <div
            className="flex flex-col items-center justify-center py-16 gap-4"
            data-testid="daily-report-placeholder"
          >
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-100">
              <Construction className="w-8 h-8 text-slate-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-slate-600">
                Daily Report workflow coming soon
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Projects and report forms will appear here
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary cards row — placeholder */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: ClipboardList, label: "Reports Filed", value: "—", color: "text-blue-600", bg: "bg-blue-50" },
          { icon: Briefcase,     label: "Active Projects", value: "—", color: "text-indigo-600", bg: "bg-indigo-50" },
          { icon: Construction,  label: "Manpower Logged", value: "—", color: "text-slate-600", bg: "bg-slate-100" },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 pt-5 pb-5">
              <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${bg}`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">
                  {label}
                </p>
                <p className="text-2xl font-bold text-slate-700 leading-tight">
                  {value}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

    </div>
  );
}
