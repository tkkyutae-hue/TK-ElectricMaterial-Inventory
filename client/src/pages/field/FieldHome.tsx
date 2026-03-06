import { useLocation } from "wouter";
import { Package, PackageCheck, PackageMinus, ClipboardList } from "lucide-react";

const TILES = [
  {
    testId: "tile-inventory",
    label: "Inventory",
    icon: Package,
    iconBg: "#0A6B24",
    borderHover: "hover:border-[#0A6B24]",
    route: "/field/inventory",
  },
  {
    testId: "tile-receive",
    label: "Receive / Return",
    icon: PackageCheck,
    iconBg: "#166534",
    borderHover: "hover:border-[#0A6B24]",
    route: "/field/movement?type=receive",
  },
  {
    testId: "tile-issue",
    label: "Issue / Ship",
    icon: PackageMinus,
    iconBg: "#1d4ed8",
    borderHover: "hover:border-blue-500",
    route: "/field/movement?type=issue",
  },
  {
    testId: "tile-transactions",
    label: "Transactions",
    icon: ClipboardList,
    iconBg: "#475569",
    borderHover: "hover:border-slate-500",
    route: "/field/transactions",
  },
];

export default function FieldHome() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-[calc(100vh-56px)] flex flex-col items-center justify-center px-4 sm:px-8 py-8">
      <div className="w-full max-w-3xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 text-center mb-8">
          Field Actions
        </h1>

        {/* 2×2 grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {TILES.map(({ testId, label, icon: Icon, iconBg, borderHover, route }) => (
            <button
              key={testId}
              onClick={() => navigate(route)}
              data-testid={testId}
              className={`group bg-white rounded-2xl border-2 border-slate-200 ${borderHover} shadow-sm hover:shadow-lg transition-all duration-200 flex flex-col items-center justify-center gap-4 cursor-pointer`}
              style={{ minHeight: "190px", padding: "32px 24px" }}
            >
              <div
                className="rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform duration-200 shadow-md"
                style={{ width: "68px", height: "68px", backgroundColor: iconBg }}
              >
                <Icon style={{ width: "38px", height: "38px" }} className="text-white" strokeWidth={1.5} />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 text-center leading-tight">
                {label}
              </h2>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
