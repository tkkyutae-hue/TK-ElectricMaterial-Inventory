import { MovementForm } from "@/components/MovementForm";
import { ArrowRightLeft } from "lucide-react";

export default function FieldMovement() {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <ArrowRightLeft className="w-5 h-5 text-brand-700" />
          <h1 className="text-2xl font-display font-bold text-slate-900">Log Movement</h1>
        </div>
        <p className="text-slate-500 text-sm">Record a Receive, Issue, or Return transaction.</p>
      </div>
      <MovementForm />
    </div>
  );
}
