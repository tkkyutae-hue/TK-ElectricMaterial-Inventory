import { useState } from "react";
import { useLocation } from "wouter";
import { PackageCheck, PackageMinus, ScanSearch, ClipboardList, ArrowRight } from "lucide-react";

type Action = {
  testId: string;
  label: string;
  sub: string;
  icon: React.ElementType;
  iconColor: string;
  iconColorHover: string;
  iconBg: string;
  iconBgHover: string;
  accentColor: string;
  accentShadow: string;
  route: string;
};

const ACTIONS: Action[] = [
  {
    testId: "tile-receive",
    label: "Receive / Return",
    sub: "Log incoming stock or return material",
    icon: PackageCheck,
    iconColor: "#3DD68C",
    iconColorHover: "#3DD68C",
    iconBg: "rgba(10,107,36,0.25)",
    iconBgHover: "rgba(10,107,36,0.45)",
    accentColor: "#3DD68C",
    accentShadow: "rgba(61,214,140,0.15)",
    route: "/field/movement?type=receive",
  },
  {
    testId: "tile-issue",
    label: "Issue / Transfer",
    sub: "Send material out to a jobsite",
    icon: PackageMinus,
    iconColor: "#FBBF24",
    iconColorHover: "#FBBF24",
    iconBg: "rgba(180,83,9,0.22)",
    iconBgHover: "rgba(180,83,9,0.40)",
    accentColor: "#FBBF24",
    accentShadow: "rgba(251,191,36,0.15)",
    route: "/field/movement?type=issue",
  },
  {
    testId: "tile-inventory",
    label: "Inventory",
    sub: "Browse and search current stock",
    icon: ScanSearch,
    iconColor: "#60A5FA",
    iconColorHover: "#60A5FA",
    iconBg: "rgba(3,105,161,0.22)",
    iconBgHover: "rgba(3,105,161,0.40)",
    accentColor: "#60A5FA",
    accentShadow: "rgba(96,165,250,0.15)",
    route: "/field/inventory",
  },
  {
    testId: "tile-transactions",
    label: "Transactions",
    sub: "View movement history",
    icon: ClipboardList,
    iconColor: "#94A3B8",
    iconColorHover: "#CBD5E1",
    iconBg: "rgba(255,255,255,0.07)",
    iconBgHover: "rgba(255,255,255,0.14)",
    accentColor: "#94A3B8",
    accentShadow: "rgba(148,163,184,0.12)",
    route: "/field/transactions",
  },
];

interface ActionRowProps extends Action {
  index: number;
  onClick: () => void;
}

function ActionRow({
  testId, label, sub, icon: Icon,
  iconColor, iconBg, iconBgHover,
  accentColor, accentShadow,
  onClick, index,
}: ActionRowProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <button
      data-testid={testId}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      className="w-full text-left flex items-center gap-4 rounded-xl transition-all"
      style={{
        padding: "20px 22px",
        background: hovered ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.04)",
        border: `1.5px solid ${hovered ? accentColor : "rgba(255,255,255,0.09)"}`,
        boxShadow: hovered ? `0 6px 24px ${accentShadow}` : "none",
        transform: pressed ? "scale(0.985)" : "scale(1)",
        transition: "background 0.15s, border-color 0.15s, box-shadow 0.15s, transform 0.08s",
      }}
    >
      {/* Number */}
      <span
        className="text-xs font-bold flex-shrink-0 w-5 text-right tabular-nums"
        style={{ color: hovered ? accentColor : "rgba(255,255,255,0.18)" }}
      >
        {String(index + 1).padStart(2, "0")}
      </span>

      {/* Icon */}
      <div
        className="flex items-center justify-center rounded-xl flex-shrink-0 transition-colors duration-150"
        style={{ width: 52, height: 52, background: hovered ? iconBgHover : iconBg }}
      >
        <Icon style={{ width: 26, height: 26, color: iconColor }} strokeWidth={1.8} />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-base font-bold leading-tight" style={{ color: "#F1F5F9" }}>{label}</p>
        <p className="text-sm mt-0.5 font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>{sub}</p>
      </div>

      {/* Arrow */}
      <ArrowRight
        className="w-4 h-4 flex-shrink-0 transition-all duration-150"
        style={{
          color: hovered ? accentColor : "rgba(255,255,255,0.18)",
          transform: hovered ? "translateX(3px)" : "translateX(0)",
        }}
      />
    </button>
  );
}

export default function FieldHome() {
  const [, navigate] = useLocation();

  return (
    <div className="flex-1 flex flex-col px-5 pt-8 pb-16">
      <div className="w-full max-w-lg mx-auto">

        <div className="mb-7">
          <h1
            className="font-display font-extrabold leading-none tracking-tight"
            style={{
              fontSize: "clamp(26px, 6vw, 34px)",
              letterSpacing: "-0.02em",
              color: "#F1F5F9",
            }}
          >
            Field Actions
          </h1>
          <p className="text-sm mt-2 font-medium" style={{ color: "rgba(255,255,255,0.30)" }}>
            What do you need to do?
          </p>
        </div>

        <div className="space-y-2.5">
          {ACTIONS.map((action, i) => (
            <ActionRow
              key={action.testId}
              {...action}
              index={i}
              onClick={() => navigate(action.route)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
