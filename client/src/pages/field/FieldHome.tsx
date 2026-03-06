import { useLocation } from "wouter";
import { PackageCheck, PackageMinus, ScanSearch, ClipboardList } from "lucide-react";

type Tile = {
  testId: string;
  label: string;
  subtitle: string;
  icon: React.ElementType;
  iconColor: string;
  cardGradient: string;
  cardBorder: string;
  hoverBorder: string;
  route: string;
};

const TILES: Tile[] = [
  {
    testId: "tile-receive",
    label: "Receive / Return",
    subtitle: "Log incoming stock",
    icon: PackageCheck,
    iconColor: "#0A6B24",
    cardGradient: "linear-gradient(145deg, #e8f5ee 0%, #ffffff 65%)",
    cardBorder: "#d1eadb",
    hoverBorder: "#86efac",
    route: "/field/movement?type=receive",
  },
  {
    testId: "tile-issue",
    label: "Issue / Transfer",
    subtitle: "Send material out",
    icon: PackageMinus,
    iconColor: "#d97706",
    cardGradient: "linear-gradient(145deg, #fef3dc 0%, #ffffff 65%)",
    cardBorder: "#fde8a0",
    hoverBorder: "#fbbf24",
    route: "/field/movement?type=issue",
  },
  {
    testId: "tile-inventory",
    label: "Inventory",
    subtitle: "Search stock",
    icon: ScanSearch,
    iconColor: "#0e7490",
    cardGradient: "linear-gradient(145deg, #e0f7fa 0%, #ffffff 65%)",
    cardBorder: "#b2ebf2",
    hoverBorder: "#67e8f9",
    route: "/field/inventory",
  },
  {
    testId: "tile-transactions",
    label: "Transactions",
    subtitle: "View history",
    icon: ClipboardList,
    iconColor: "#475569",
    cardGradient: "linear-gradient(145deg, #f1f5f9 0%, #ffffff 65%)",
    cardBorder: "#e2e8f0",
    hoverBorder: "#94a3b8",
    route: "/field/transactions",
  },
];

export default function FieldHome() {
  const [, navigate] = useLocation();

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 pt-6 pb-16">
      <div className="w-full max-w-2xl mx-auto">

        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900">Field Actions</h1>
          <p className="text-slate-500 text-sm mt-1">Select an action to get started.</p>
        </div>

        {/* 2×2 grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {TILES.map(({ testId, label, subtitle, icon: Icon, iconColor, cardGradient, cardBorder, hoverBorder, route }) => (
            <button
              key={testId}
              onClick={() => navigate(route)}
              data-testid={testId}
              className="group rounded-2xl transition-all duration-200 flex flex-col items-center justify-center gap-4 cursor-pointer text-center w-full"
              style={{
                background: cardGradient,
                border: `1.5px solid ${cardBorder}`,
                minHeight: "190px",
                padding: "32px 24px",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = hoverBorder; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 24px rgba(0,0,0,0.10)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = cardBorder; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
            >
              <div
                className="rounded-2xl bg-white flex items-center justify-center shadow-md group-hover:shadow-lg group-hover:scale-105 transition-all duration-200"
                style={{ width: "68px", height: "68px", flexShrink: 0 }}
              >
                <Icon style={{ width: "38px", height: "38px", color: iconColor }} strokeWidth={1.8} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 leading-tight">{label}</h2>
                <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
