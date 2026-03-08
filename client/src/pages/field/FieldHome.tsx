import { useState } from "react";
import { useLocation } from "wouter";
import { PackageCheck, PackageMinus, ScanSearch, ClipboardList, ArrowRight } from "lucide-react";

type Action = {
  testId: string;
  label: string;
  sub: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  accentBorder: string;
  accentShadow: string;
  route: string;
};

const ACTIONS: Action[] = [
  {
    testId: "tile-receive",
    label: "Receive / Return",
    sub: "Log incoming stock or return material",
    icon: PackageCheck,
    iconColor: "#0A6B24",
    iconBg: "#EBF7EF",
    accentBorder: "#0A6B24",
    accentShadow: "rgba(10,107,36,0.10)",
    route: "/field/movement?type=receive",
  },
  {
    testId: "tile-issue",
    label: "Issue / Transfer",
    sub: "Send material out to a jobsite",
    icon: PackageMinus,
    iconColor: "#B45309",
    iconBg: "#FEF3E2",
    accentBorder: "#B45309",
    accentShadow: "rgba(180,83,9,0.10)",
    route: "/field/movement?type=issue",
  },
  {
    testId: "tile-inventory",
    label: "Inventory",
    sub: "Browse and search current stock",
    icon: ScanSearch,
    iconColor: "#0369A1",
    iconBg: "#E0F2FE",
    accentBorder: "#0369A1",
    accentShadow: "rgba(3,105,161,0.10)",
    route: "/field/inventory",
  },
  {
    testId: "tile-transactions",
    label: "Transactions",
    sub: "View movement history",
    icon: ClipboardList,
    iconColor: "#334155",
    iconBg: "#F1F5F9",
    accentBorder: "#475569",
    accentShadow: "rgba(71,85,105,0.10)",
    route: "/field/transactions",
  },
];

interface ActionRowProps extends Action {
  index: number;
  onClick: () => void;
}

function ActionRow({ testId, label, sub, icon: Icon, iconColor, iconBg, accentBorder, accentShadow, onClick, index }: ActionRowProps) {
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
      className="w-full text-left flex items-center gap-4 bg-white rounded-lg transition-all"
      style={{
        padding: "18px 20px",
        border: `1.5px solid ${hovered ? accentBorder : "#E5E7EB"}`,
        boxShadow: hovered
          ? `0 4px 16px ${accentShadow}`
          : "0 1px 3px rgba(0,0,0,0.04)",
        transform: pressed ? "scale(0.985)" : "scale(1)",
        transition: "border-color 0.12s, box-shadow 0.15s, transform 0.08s",
      }}
    >
      {/* Number */}
      <span
        className="text-xs font-bold flex-shrink-0 w-5 text-right"
        style={{ color: hovered ? accentBorder : "#CBD5E1" }}
      >
        {String(index + 1).padStart(2, "0")}
      </span>

      {/* Icon */}
      <div
        className="flex items-center justify-center rounded-lg flex-shrink-0 transition-colors duration-150"
        style={{ width: 44, height: 44, background: hovered ? accentBorder : iconBg }}
      >
        <Icon
          style={{ width: 22, height: 22, color: hovered ? "white" : iconColor }}
          strokeWidth={2}
        />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-base font-bold text-slate-900 leading-tight">{label}</p>
        <p className="text-sm text-slate-400 mt-0.5 font-medium leading-snug">{sub}</p>
      </div>

      {/* Arrow */}
      <ArrowRight
        className="w-4 h-4 flex-shrink-0 transition-all duration-150"
        style={{
          color: hovered ? accentBorder : "#D1D5DB",
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
          <h1 className="font-display font-extrabold text-slate-900 leading-none tracking-tight"
            style={{ fontSize: "clamp(26px, 6vw, 34px)", letterSpacing: "-0.02em" }}
          >
            Field Actions
          </h1>
          <p className="text-slate-400 text-sm mt-2 font-medium">What do you need to do?</p>
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
