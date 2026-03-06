import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { PackageCheck, PackageMinus, Search, ClipboardList } from "lucide-react";

export default function FieldHome() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const isViewer = user?.role === "viewer";

  const tiles = [
    {
      icon: PackageCheck,
      label: "Receive",
      desc: "Log incoming stock from supplier",
      iconBg: "bg-green-50 group-hover:bg-green-100",
      iconColor: "text-green-600",
      borderHover: "hover:border-green-400",
      onClick: () => navigate("/field/movement?type=receive"),
      testId: "tile-receive",
    },
    {
      icon: PackageMinus,
      label: "Issue / Ship",
      desc: "Send material out to a jobsite",
      iconBg: "bg-violet-50 group-hover:bg-violet-100",
      iconColor: "text-violet-600",
      borderHover: "hover:border-violet-400",
      onClick: () => navigate("/field/movement?type=issue"),
      testId: "tile-issue",
    },
    {
      icon: Search,
      label: "Inventory",
      desc: "Search and view stock",
      iconBg: "bg-sky-50 group-hover:bg-sky-100",
      iconColor: "text-sky-600",
      borderHover: "hover:border-sky-400",
      onClick: () => navigate("/field/inventory"),
      testId: "tile-inventory",
    },
    {
      icon: ClipboardList,
      label: "Transactions",
      desc: "View movement history",
      iconBg: "bg-slate-100 group-hover:bg-slate-200",
      iconColor: "text-slate-600",
      borderHover: "hover:border-slate-400",
      onClick: () => navigate("/field/transactions"),
      testId: "tile-transactions",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-slate-900">Field Home</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          {isViewer ? "Viewer access — inventory search & transactions only." : "Select an action to get started."}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {tiles.map(({ icon: Icon, label, desc, iconBg, iconColor, borderHover, onClick, testId }) => {
          const viewerBlocked = isViewer && (testId === "tile-receive" || testId === "tile-issue");
          return (
            <button
              key={testId}
              onClick={viewerBlocked ? undefined : onClick}
              disabled={viewerBlocked}
              data-testid={testId}
              className={`group relative bg-white rounded-2xl border-2 transition-all duration-200 shadow-sm flex flex-col items-center justify-center gap-3 p-4 sm:p-6
                ${viewerBlocked
                  ? "border-slate-100 opacity-40 cursor-not-allowed"
                  : `border-slate-200 ${borderHover} hover:shadow-lg cursor-pointer`
                }`}
              style={{ aspectRatio: "1 / 1" }}
            >
              <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center transition-colors ${iconBg}`}>
                <Icon className={`w-7 h-7 sm:w-8 sm:h-8 ${iconColor}`} />
              </div>
              <div className="text-center">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">{label}</h2>
                <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 leading-tight">{desc}</p>
              </div>
              {viewerBlocked && (
                <span className="absolute bottom-2 text-[10px] text-amber-500 font-medium">Read-only</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
