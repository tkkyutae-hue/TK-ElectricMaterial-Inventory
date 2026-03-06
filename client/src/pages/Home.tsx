import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { HardHat, Shield, LogOut } from "lucide-react";
import tkLogo from "@assets/tk_logo_1772726610288.png";

export default function Home() {
  const [, navigate] = useLocation();
  const { user, logout, isAdminRole } = useAuth();

  const displayName = user?.name ?? user?.firstName ?? user?.email ?? "User";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
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

      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-xl">
          <div className="text-center mb-10">
            <h1 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 mb-2">
              Select Your Mode
            </h1>
            <p className="text-slate-500 text-sm sm:text-base">
              Choose the mode that matches your role for this session.
            </p>
          </div>

          <div className={`grid gap-5 ${isAdminRole ? "grid-cols-2" : "grid-cols-1 max-w-[220px] mx-auto"}`}>
            {/* ── Field Mode tile ── */}
            <button
              onClick={() => navigate("/field")}
              data-testid="btn-field-mode"
              className="group aspect-square bg-white rounded-2xl border-2 border-slate-200 hover:border-brand-500 shadow-sm hover:shadow-xl transition-all duration-200 flex flex-col items-center justify-center gap-4 p-6 cursor-pointer"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-brand-50 flex items-center justify-center group-hover:bg-brand-100 transition-colors">
                <HardHat className="w-8 h-8 sm:w-10 sm:h-10 text-brand-700" />
              </div>
              <div className="text-center">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">Field Mode</h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">Receive · Issue · Inventory</p>
              </div>
            </button>

            {/* ── Admin Mode tile — only for admin role ── */}
            {isAdminRole && (
              <button
                onClick={() => navigate("/")}
                data-testid="btn-admin-mode"
                className="group aspect-square bg-white rounded-2xl border-2 border-slate-200 hover:border-amber-400 shadow-sm hover:shadow-xl transition-all duration-200 flex flex-col items-center justify-center gap-4 p-6 cursor-pointer"
              >
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-amber-50 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                  <Shield className="w-8 h-8 sm:w-10 sm:h-10 text-amber-600" />
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
