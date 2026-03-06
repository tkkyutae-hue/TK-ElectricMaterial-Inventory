import { useSearch } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { MovementForm } from "@/components/MovementForm";
import { ArrowRightLeft } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  receive: "Receive",
  issue: "Issue / Ship",
  return: "Return",
};

export default function FieldMovement() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const presetType = params.get("type") ?? "receive";
  const { user } = useAuth();
  const isViewer = user?.role === "viewer";

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <ArrowRightLeft className="w-5 h-5 text-brand-700" />
          <h1 className="text-2xl font-display font-bold text-slate-900">
            Log Movement
            {presetType in TYPE_LABELS && (
              <span className="ml-2 text-base font-medium text-slate-400">— {TYPE_LABELS[presetType]}</span>
            )}
          </h1>
        </div>
        <p className="text-slate-500 text-sm">Record a Receive, Issue, or Return transaction.</p>
      </div>
      <MovementForm key={presetType} defaultType={presetType} readOnly={isViewer} />
    </div>
  );
}
