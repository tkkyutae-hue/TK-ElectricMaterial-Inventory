import { type ReactNode } from "react";
import { ArrowDownToLine, ArrowUpFromLine, CornerDownLeft, Shuffle } from "lucide-react";

export const MOVE_PILL_CONFIG: Record<string, {
  icon: ReactNode;
  activeBg: string;
  activeText: string;
  activeBorder: string;
  restBg: string;
  restText: string;
  restBorder: string;
}> = {
  receive: {
    icon: <ArrowDownToLine style={{ width: 15, height: 15 }} />,
    activeBg: "#059669", activeText: "#fff", activeBorder: "#059669",
    restBg: "#f0fdf4",  restText: "#047857", restBorder: "#a7f3d0",
  },
  issue: {
    icon: <ArrowUpFromLine style={{ width: 15, height: 15 }} />,
    activeBg: "#7c3aed", activeText: "#fff", activeBorder: "#7c3aed",
    restBg: "#faf5ff",  restText: "#6d28d9", restBorder: "#ddd6fe",
  },
  return: {
    icon: <CornerDownLeft style={{ width: 15, height: 15 }} />,
    activeBg: "#0284c7", activeText: "#fff", activeBorder: "#0284c7",
    restBg: "#f0f9ff",  restText: "#0369a1", restBorder: "#bae6fd",
  },
  transfer: {
    icon: <Shuffle style={{ width: 15, height: 15 }} />,
    activeBg: "#475569", activeText: "#fff", activeBorder: "#475569",
    restBg: "#f8fafc",  restText: "#334155", restBorder: "#cbd5e1",
  },
};

export function MovementTypePillSelector({
  value,
  onChange,
  movementTypes,
}: {
  value: string;
  onChange: (v: string) => void;
  movementTypes: { value: string; label: string; desc: string }[];
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${movementTypes.length}, 1fr)`, gap: 8 }}>
      {movementTypes.map(mt => {
        const cfg = MOVE_PILL_CONFIG[mt.value] ?? {
          icon: null,
          activeBg: "#1e40af", activeText: "#fff", activeBorder: "#1e40af",
          restBg: "#eff6ff", restText: "#1e40af", restBorder: "#bfdbfe",
        };
        const isActive = value === mt.value;
        return (
          <button
            key={mt.value}
            type="button"
            onClick={() => onChange(mt.value)}
            data-testid={`pill-movement-type-${mt.value}`}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 3,
              borderRadius: 12,
              border: `2px solid ${isActive ? cfg.activeBorder : cfg.restBorder}`,
              background: isActive ? cfg.activeBg : cfg.restBg,
              color: isActive ? cfg.activeText : cfg.restText,
              padding: "10px 12px",
              cursor: "pointer",
              transition: "all 0.15s",
              textAlign: "left",
              outline: "none",
            }}
          >
            <span style={{ opacity: isActive ? 1 : 0.7 }}>{cfg.icon}</span>
            <span style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.2 }}>{mt.label}</span>
            <span style={{ fontSize: 10, opacity: isActive ? 0.85 : 0.55, lineHeight: 1.3 }}>{mt.desc}</span>
          </button>
        );
      })}
    </div>
  );
}
