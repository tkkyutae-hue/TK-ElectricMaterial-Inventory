import { useSearch } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { MovementForm } from "@/components/MovementForm";

const SCREEN_CONFIG: Record<string, { heading: string; emoji: string; allowedTypes: string[] }> = {
  receive: {
    heading: "Receive / Return",
    emoji: "📦",
    allowedTypes: ["receive", "return"],
  },
  issue: {
    heading: "Issue / Transfer",
    emoji: "📤",
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
    <div style={{ paddingTop: 28, paddingBottom: 48, paddingLeft: 0, paddingRight: 0 }}>

      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 24, fontWeight: 700,
          color: "#ffffff", margin: "0 0 5px",
          letterSpacing: 0.3,
        }}>
          {config.emoji} {config.heading}
        </h1>
        <p style={{
          fontSize: 11, color: "#2ddb6f", margin: 0,
          fontFamily: "'Barlow Condensed', sans-serif",
          letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600,
        }}>
          Log Movement
        </p>
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
