import { useSearch } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { MovementForm } from "@/components/MovementForm";
import { PackageOpen, Send } from "lucide-react";

// Screen configs: each preset type maps to its allowed movement types
const SCREEN_CONFIG: Record<string, { heading: string; allowedTypes: string[]; icon: React.ReactNode }> = {
  receive: {
    heading: "Receive / Return",
    allowedTypes: ["receive", "return"],
    icon: <PackageOpen className="w-6 h-6 sm:w-6 sm:h-6 text-brand-700 shrink-0" />,
  },
  issue: {
    heading: "Issue / Transfer",
    allowedTypes: ["issue", "transfer"],
    icon: <Send className="w-6 h-6 sm:w-6 sm:h-6 text-brand-700 shrink-0" />,
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
      <div>
        <div className="flex items-center gap-2">
          {config.icon}
          <h1 className="text-2xl font-display font-bold text-slate-900">{config.heading}</h1>
        </div>
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
