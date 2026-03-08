import { useState } from "react";
import { useLocation } from "wouter";
import { PackageCheck, PackageMinus, ScanSearch, ClipboardList, ArrowRight } from "lucide-react";

type Tile = {
  testId: string;
  label: string;
  subtitle: string;
  icon: React.ElementType;
  accentBg: string;
  accentColor: string;
  accentShadow: string;
  iconColor: string;
  route: string;
};

const TILES: Tile[] = [
  {
    testId: "tile-receive",
    label: "Receive / Return",
    subtitle: "Log incoming stock",
    icon: PackageCheck,
    accentBg: "linear-gradient(145deg, #0A6B24 0%, #0f8c30 100%)",
    accentColor: "#0A6B24",
    accentShadow: "rgba(10,107,36,0.22)",
    iconColor: "#0A6B24",
    route: "/field/movement?type=receive",
  },
  {
    testId: "tile-issue",
    label: "Issue / Transfer",
    subtitle: "Send material out",
    icon: PackageMinus,
    accentBg: "linear-gradient(145deg, #c47a07 0%, #d97706 100%)",
    accentColor: "#c47a07",
    accentShadow: "rgba(196,122,7,0.22)",
    iconColor: "#c47a07",
    route: "/field/movement?type=issue",
  },
  {
    testId: "tile-inventory",
    label: "Inventory",
    subtitle: "Search stock",
    icon: ScanSearch,
    accentBg: "linear-gradient(145deg, #0e7490 0%, #0891b2 100%)",
    accentColor: "#0e7490",
    accentShadow: "rgba(14,116,144,0.22)",
    iconColor: "#0e7490",
    route: "/field/inventory",
  },
  {
    testId: "tile-transactions",
    label: "Transactions",
    subtitle: "View history",
    icon: ClipboardList,
    accentBg: "linear-gradient(145deg, #334155 0%, #475569 100%)",
    accentColor: "#334155",
    accentShadow: "rgba(51,65,85,0.18)",
    iconColor: "#334155",
    route: "/field/transactions",
  },
];

interface TileCardProps extends Tile {
  onClick: () => void;
}

function TileCard({ testId, label, subtitle, icon: Icon, accentBg, accentColor, accentShadow, iconColor, onClick }: TileCardProps) {
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <button
      data-testid={testId}
      onClick={onClick}
      className="rounded-2xl overflow-hidden text-left cursor-pointer flex flex-col bg-white"
      style={{
        border: `1.5px solid ${hovered ? accentColor + "55" : "rgba(0,0,0,0.07)"}`,
        boxShadow: pressed
          ? `0 1px 4px ${accentShadow}`
          : hovered
          ? `0 10px 28px ${accentShadow}, 0 2px 8px ${accentShadow}`
          : `0 2px 10px ${accentShadow}`,
        transform: pressed ? "scale(0.96)" : hovered ? "translateY(-3px)" : "translateY(0)",
        transition: pressed ? "transform 0.08s ease, box-shadow 0.08s ease" : "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
    >
      {/* Colored header with app-icon badge */}
      <div
        className="flex items-center justify-center relative overflow-hidden"
        style={{ background: accentBg, minHeight: "120px", padding: "24px 16px" }}
      >
        {/* Decorative orb top-right */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: -24, right: -24, width: 100, height: 100,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.12)",
          }}
        />
        {/* Bottom subtle shadow */}
        <div
          className="absolute bottom-0 left-0 right-0 pointer-events-none"
          style={{ height: "28px", background: "linear-gradient(to top, rgba(0,0,0,0.12) 0%, transparent 100%)" }}
        />
        {/* White app-icon badge */}
        <div
          className="relative z-10 flex items-center justify-center rounded-[18px] bg-white"
          style={{
            width: 62,
            height: 62,
            boxShadow: "0 4px 16px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.8)",
          }}
        >
          <Icon style={{ width: 32, height: 32, color: iconColor }} strokeWidth={1.9} />
        </div>
      </div>

      {/* White info section */}
      <div className="flex items-center justify-between px-4 py-4 flex-1">
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-slate-900 leading-snug">{label}</h2>
          <p className="text-xs text-slate-400 mt-0.5 font-medium">{subtitle}</p>
        </div>
        <div
          className="flex items-center justify-center rounded-full ml-3 flex-shrink-0 transition-all duration-200"
          style={{
            width: 30,
            height: 30,
            background: hovered ? accentColor : "#F1F5F4",
          }}
        >
          <ArrowRight
            className="w-3.5 h-3.5 transition-all duration-200"
            style={{
              color: hovered ? "white" : "#94a3b8",
              transform: hovered ? "translateX(1px)" : "translateX(0)",
            }}
          />
        </div>
      </div>
    </button>
  );
}

export default function FieldHome() {
  const [, navigate] = useLocation();

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-5 pt-4 pb-16">
      <div className="w-full max-w-2xl mx-auto">

        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900">Field Actions</h1>
          <p className="text-slate-400 text-sm mt-1.5">What do you need to do?</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {TILES.map(tile => (
            <TileCard
              key={tile.testId}
              {...tile}
              onClick={() => navigate(tile.route)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
