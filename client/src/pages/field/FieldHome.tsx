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
  iconBgHover: string;
  accentColor: string;
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
    iconBg: "#E8F5EE",
    iconBgHover: "#D1ECDB",
    accentColor: "#0A6B24",
    accentBorder: "#0A6B24",
    accentShadow: "rgba(10,107,36,0.12)",
    route: "/field/movement?type=receive",
  },
  {
    testId: "tile-issue",
    label: "Issue / Transfer",
    sub: "Send material out to a jobsite",
    icon: PackageMinus,
    iconColor: "#B45309",
    iconBg: "#FEF3E2",
    iconBgHover: "#FDE8C4",
    accentColor: "#B45309",
    accentBorder: "#B45309",
    accentShadow: "rgba(180,83,9,0.12)",
    route: "/field/movement?type=issue",
  },
  {
    testId: "tile-inventory",
    label: "Inventory",
    sub: "Browse and search current stock",
    icon: ScanSearch,
    iconColor: "#0369A1",
    iconBg: "#E0F2FE",
    iconBgHover: "#BAE6FD",
    accentColor: "#0369A1",
    accentBorder: "#0369A1",
    accentShadow: "rgba(3,105,161,0.12)",
    route: "/field/inventory",
  },
  {
    testId: "tile-transactions",
    label: "Transactions",
    sub: "View movement history",
    icon: ClipboardList,
    iconColor: "#475569",
    iconBg: "#F1F5F9",
    iconBgHover: "#E2E8F0",
    accentColor: "#475569",
    accentBorder: "#475569",
    accentShadow: "rgba(71,85,105,0.10)",
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
  accentColor, accentBorder, accentShadow,
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
      className="w-full text-left flex items-center gap-4 rounded-xl bg-white transition-all"
      style={{
        padding: "20px 22px",
        border: `1.5px solid ${hovered ? accentBorder : "#E5E7EB"}`,
        boxShadow: hovered
          ? `0 6px 20px ${accentShadow}`
          : "0 1px 3px rgba(0,0,0,0.05)",
        transform: pressed ? "scale(0.985)" : "scale(1)",
        transition: "border-color 0.12s, box-shadow 0.15s, transform 0.08s",
      }}
    >
      {/* Number */}
      <span
        className="text-xs font-bold flex-shrink-0 w-5 text-right tabular-nums"
        style={{ color: hovered ? accentColor : "#CBD5E1" }}
      >
        {String(index + 1).padStart(2, "0")}
      </span>

      {/* Icon */}
      <div
        className="flex items-center justify-center rounded-xl flex-shrink-0 transition-colors duration-150"
        style={{ width: 100, height: 100, background: hovered ? iconBgHover : iconBg }}
      >
        <Icon style={{ width: 50, height: 50, color: iconColor }} strokeWidth={1.6} />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-base font-bold text-slate-900 leading-tight">{label}</p>
        <p className="text-sm text-slate-400 mt-0.5 font-medium leading-snug">{sub}</p>
      </div>

      {/* Arrow */}
      <ArrowRight
        className="w-5 h-5 flex-shrink-0 transition-all duration-150"
        style={{
          color: hovered ? accentColor : "#D1D5DB",
          transform: hovered ? "translateX(3px)" : "translateX(0)",
        }}
      />
    </button>
  );
}

export default function FieldHome() {
  const [, navigate] = useLocation();

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-lg">

        <div className="mb-7">
          <h1
            className="font-display font-extrabold text-slate-900 leading-none tracking-tight"
            style={{ fontSize: "clamp(26px, 6vw, 34px)", letterSpacing: "-0.02em" }}
          >
            Field Actions
          </h1>
          <p className="text-sm text-slate-400 mt-2 font-medium">
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
