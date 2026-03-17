import { HardHat } from "lucide-react";

export default function Manpower() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-slate-900">Manpower</h1>
        <p className="text-slate-500 mt-1">
          Track crew assignments, labor hours, and workforce allocation by project.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-100">
          <HardHat className="w-8 h-8 text-slate-400" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-slate-600">Manpower Management</p>
          <p className="text-xs text-slate-400 mt-0.5">This feature is coming soon.</p>
        </div>
      </div>
    </div>
  );
}
