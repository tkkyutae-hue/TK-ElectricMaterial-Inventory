import { useLocation } from "wouter";
import { PackageCheck, PackageMinus, ScanSearch, ClipboardList, ChevronRight } from "lucide-react";

type Tile = {
  testId: string;
  label: string;
  subtitle: string;
  icon: React.ElementType;
  accent: string;
  accentLight: string;
  accentShadow: string;
  route: string;
};

const TILES: Tile[] = [
  {
    testId: "tile-receive",
    label: "Receive / Return",
    subtitle: "Log incoming stock",
    icon: PackageCheck,
    accent: "#0A6B24",
    accentLight: "linear-gradient(145deg, #0A6B24 0%, #0d8a30 100%)",
    accentShadow: "rgba(10,107,36,0.25)",
    route: "/field/movement?type=receive",
  },
  {
    testId: "tile-issue",
    label: "Issue / Transfer",
    subtitle: "Send material out",
    icon: PackageMinus,
    accent: "#b45309",
    accentLight: "linear-gradient(145deg, #c47a07 0%, #d97706 100%)",
    accentShadow: "rgba(217,119,6,0.25)",
    route: "/field/movement?type=issue",
  },
  {
    testId: "tile-inventory",
    label: "Inventory",
    subtitle: "Search stock",
    icon: ScanSearch,
    accent: "#0e7490",
    accentLight: "linear-gradient(145deg, #0e7490 0%, #0891b2 100%)",
    accentShadow: "rgba(14,116,144,0.25)",
    route: "/field/inventory",
  },
  {
    testId: "tile-transactions",
    label: "Transactions",
    subtitle: "View history",
    icon: ClipboardList,
    accent: "#334155",
    accentLight: "linear-gradient(145deg, #334155 0%, #475569 100%)",
    accentShadow: "rgba(51,65,85,0.20)",
    route: "/field/transactions",
  },
];

export default function FieldHome() {
  const [, navigate] = useLocation();

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-5 pt-4 pb-16">
      <div className="w-full max-w-2xl mx-auto">

        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900">Field Actions</h1>
          <p className="text-slate-500 text-sm mt-1.5">What do you need to do?</p>
        </div>

        {/* 2×2 action grid */}
        <div className="grid grid-cols-2 gap-4">
          {TILES.map(({ testId, label, subtitle, icon: Icon, accentLight, accentShadow, route }) => (
            <button
              key={testId}
              onClick={() => navigate(route)}
              data-testid={testId}
              className="group rounded-2xl overflow-hidden text-left cursor-pointer transition-all duration-200 flex flex-col bg-white"
              style={{
                boxShadow: `0 2px 12px ${accentShadow}`,
                border: "1.5px solid rgba(0,0,0,0.06)",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.transform = "translateY(-3px) scale(1.01)";
                (e.currentTarget as HTMLElement).style.boxShadow = `0 12px 32px ${accentShadow}`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.transform = "translateY(0) scale(1)";
                (e.currentTarget as HTMLElement).style.boxShadow = `0 2px 12px ${accentShadow}`;
              }}
            >
              {/* Colored top section with icon */}
              <div
                className="flex items-center justify-center relative overflow-hidden"
                style={{
                  background: accentLight,
                  minHeight: "110px",
                  padding: "24px 16px",
                }}
              >
                {/* Decorative circle */}
                <div
                  className="absolute pointer-events-none"
                  style={{
                    top: -30, right: -30, width: 120, height: 120,
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.10)",
                  }}
                />
                <Icon
                  style={{ width: 48, height: 48, color: "white", position: "relative", zIndex: 1 }}
                  strokeWidth={1.6}
                />
              </div>

              {/* White bottom section with label */}
              <div className="flex flex-col gap-1 px-4 py-3.5 flex-1">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">{label}</h2>
                <p className="text-xs text-slate-400 font-medium leading-tight">{subtitle}</p>
                <div className="flex items-center gap-0.5 mt-1 text-slate-300 group-hover:text-slate-500 transition-colors">
                  <span className="text-xs font-semibold">Tap</span>
                  <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
