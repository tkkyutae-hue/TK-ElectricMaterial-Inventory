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
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
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

      {/* Centered content */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-8 py-10">
        <div className="w-full max-w-3xl mx-auto">
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 text-center mb-10">
            Select Your Mode
          </h1>

          {/* Cards grid */}
          <div className={`grid gap-5 ${isAdminRole ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 max-w-[420px] mx-auto"}`}>

            {/* ── Field Mode ── */}
            <button
              onClick={() => navigate("/field")}
              data-testid="btn-field-mode"
              className="group bg-white rounded-3xl border-2 border-slate-200 hover:border-[#0A6B24] shadow-md hover:shadow-xl transition-all duration-200 flex flex-col items-center justify-center gap-6 cursor-pointer"
              style={{ minHeight: "280px", padding: "40px 32px" }}
            >
              <div
                className="rounded-2xl bg-[#0A6B24] flex items-center justify-center group-hover:scale-105 transition-transform duration-200 shadow-lg"
                style={{ width: "80px", height: "80px" }}
              >
                <HardHat style={{ width: "44px", height: "44px" }} className="text-white" strokeWidth={1.5} />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Field Mode</h2>
            </button>

            {/* ── Admin Mode ── */}
            {isAdminRole && (
              <button
                onClick={() => navigate("/")}
                data-testid="btn-admin-mode"
                className="group bg-white rounded-3xl border-2 border-slate-200 hover:border-amber-500 shadow-md hover:shadow-xl transition-all duration-200 flex flex-col items-center justify-center gap-6 cursor-pointer"
                style={{ minHeight: "280px", padding: "40px 32px" }}
              >
                <div
                  className="rounded-2xl bg-amber-500 flex items-center justify-center group-hover:scale-105 transition-transform duration-200 shadow-lg"
                  style={{ width: "80px", height: "80px" }}
                >
                  <LayoutDashboard style={{ width: "44px", height: "44px" }} className="text-white" strokeWidth={1.5} />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Admin Mode</h2>
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
