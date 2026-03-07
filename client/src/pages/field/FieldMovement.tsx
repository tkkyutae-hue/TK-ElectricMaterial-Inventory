import { useSearch } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { MovementForm } from "@/components/MovementForm";

// Screen configs: each preset type maps to its allowed movement types
const SCREEN_CONFIG: Record<string, { heading: string; allowedTypes: string[] }> = {
  receive: {
    heading: "Receive / Return",
    allowedTypes: ["receive", "return"],
  },
  issue: {
    heading: "Issue / Transfer",
    allowedTypes: ["issue", "transfer"],
  },
};

export default function FieldMovement() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const presetType = params.get("type") ?? "receive";
  const { user } = useAuth();
  const isViewer = user?.role === "viewer";

  const config = SCREEN_CONFIG[presetType] ?? SCREEN_CONFIG.receive;

  return (
    <div className="space-y-5 pb-6">
      {/* F: Emphasise action, not "Log Movement" */}
      <div>
        <h1 className="text-2xl font-display font-bold text-slate-900">{config.heading}</h1>
        <p className="text-sm text-slate-400 mt-0.5">Log Movement</p>
      </div>
      <MovementForm
        key={presetType}
        defaultType={presetType}
        allowedTypes={config.allowedTypes}
        fieldMode
        readOnly={isViewer}
      />
    </div>
  );
}
