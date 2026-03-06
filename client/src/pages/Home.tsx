import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { HardHat, LayoutDashboard, LogOut } from "lucide-react";
import tkLogo from "@assets/tk_logo_1772726610288.png";

export default function Home() {
  const [, navigate] = useLocation();
  const { user, logout, isAdminRole } = useAuth();

  const displayName = user?.name ?? user?.firstName ?? user?.email ?? "User";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={tkLogo} alt="TK Electric" className="h-9 w-auto object-contain" data-testid="img-tk-logo" />
          <div>
            <span className="font-display font-bold text-lg text-slate-900 leading-none block">TK Electric</span>
            <span className="text-[11px] text-slate-400 leading-none">VoltStock</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-sm text-slate-500">{displayName}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => logout()}
            className="text-slate-500 hover:text-red-600 gap-1.5"
            data-testid="btn-home-logout"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-xl">
          <div className="text-center mb-10">
            <h1 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 mb-2">
              Select Your Mode
            </h1>
            <p className="text-slate-500 text-sm sm:text-base">
              Choose the mode that matches your role.
            </p>
          </div>

          {/* Square cards — always 2 col for admin, 1 col centered for non-admin */}
          <div className={`grid gap-5 ${isAdminRole ? "grid-cols-2" : "grid-cols-1 max-w-[280px] mx-auto"}`}>

            {/* ── Field Mode card ── */}
            <button
              onClick={() => navigate("/field")}
              data-testid="btn-field-mode"
              className="group aspect-square bg-white rounded-3xl border-2 border-slate-200 hover:border-[#0A6B24] shadow-md hover:shadow-xl transition-all duration-200 flex flex-col items-center justify-center gap-5 p-6 cursor-pointer"
            >
              {/* Icon circle — green */}
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-[#0A6B24] flex items-center justify-center group-hover:scale-105 transition-transform duration-200 shadow-lg shadow-green-900/20">
                <HardHat className="w-10 h-10 sm:w-12 sm:h-12 text-white" strokeWidth={1.5} />
              </div>
              <div className="text-center">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">Field Mode</h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">Receive · Issue · Inventory</p>
              </div>
            </button>

            {/* ── Admin Mode card ── */}
            {isAdminRole && (
              <button
                onClick={() => navigate("/")}
                data-testid="btn-admin-mode"
                className="group aspect-square bg-white rounded-3xl border-2 border-slate-200 hover:border-amber-500 shadow-md hover:shadow-xl transition-all duration-200 flex flex-col items-center justify-center gap-5 p-6 cursor-pointer"
              >
                {/* Icon circle — amber */}
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-amber-500 flex items-center justify-center group-hover:scale-105 transition-transform duration-200 shadow-lg shadow-amber-900/20">
                  <LayoutDashboard className="w-10 h-10 sm:w-12 sm:h-12 text-white" strokeWidth={1.5} />
                </div>
                <div className="text-center">
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900">Admin Mode</h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">Dashboard · Reports · Users</p>
                </div>
              </button>
            )}
          </div>

          {!isAdminRole && (
            <p className="text-center text-xs text-slate-400 mt-8">
              Role: <strong>{user?.role ?? "viewer"}</strong> — Contact an admin to request elevated access.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
