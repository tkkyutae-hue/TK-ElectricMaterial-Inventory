import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { HardHat, Settings, LogOut } from "lucide-react";
import tkLogo from "@assets/tk_logo_1772726610288.png";

export default function Home() {
  const [, navigate] = useLocation();
  const { user, logout, isAdminRole } = useAuth();

  const displayName = user?.name ?? user?.firstName ?? user?.email ?? "User";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F0F2F5" }}>
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
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>
      </header>

      {/* Centered content */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl mx-auto">

          <div className="text-center mb-10">
            <h1 className="text-3xl font-display font-bold text-slate-900 mb-2">Select Your Mode</h1>
            <p className="text-slate-500 text-sm">Choose the mode that matches your role for this session.</p>
          </div>

          <div className={`grid gap-5 ${isAdminRole ? "grid-cols-1 sm:grid-cols-2" : "max-w-sm mx-auto"}`}>

            {/* ── Field Mode ── */}
            <button
              onClick={() => navigate("/field")}
              data-testid="btn-field-mode"
              className="group rounded-2xl border border-green-100 hover:border-green-300 hover:shadow-lg transition-all duration-200 flex flex-col items-center justify-center gap-5 cursor-pointer text-left w-full"
              style={{
                background: "linear-gradient(145deg, #e8f5ee 0%, #ffffff 60%)",
                minHeight: "240px",
                padding: "40px 32px",
              }}
            >
              {/* iOS-style icon badge */}
              <div
                className="rounded-2xl bg-white flex items-center justify-center shadow-md group-hover:shadow-lg group-hover:scale-105 transition-all duration-200"
                style={{ width: "72px", height: "72px" }}
              >
                <HardHat style={{ width: "40px", height: "40px", color: "#0A6B24" }} strokeWidth={1.8} />
              </div>
              <div className="text-center">
                <h2 className="text-xl font-bold" style={{ color: "#0A6B24" }}>Field Mode</h2>
                <p className="text-sm text-slate-500 mt-1">Receive · Issue · Inventory</p>
              </div>
            </button>

            {/* ── Admin Mode ── */}
            {isAdminRole && (
              <button
                onClick={() => navigate("/")}
                data-testid="btn-admin-mode"
                className="group rounded-2xl border border-amber-100 hover:border-amber-300 hover:shadow-lg transition-all duration-200 flex flex-col items-center justify-center gap-5 cursor-pointer text-left w-full"
                style={{
                  background: "linear-gradient(145deg, #fef3dc 0%, #ffffff 60%)",
                  minHeight: "240px",
                  padding: "40px 32px",
                }}
              >
                <div
                  className="rounded-2xl bg-white flex items-center justify-center shadow-md group-hover:shadow-lg group-hover:scale-105 transition-all duration-200"
                  style={{ width: "72px", height: "72px" }}
                >
                  <Settings style={{ width: "40px", height: "40px", color: "#d97706" }} strokeWidth={1.8} />
                </div>
                <div className="text-center">
                  <h2 className="text-xl font-bold" style={{ color: "#d97706" }}>Admin Mode</h2>
                  <p className="text-sm text-slate-500 mt-1">Dashboard · Reports · Users</p>
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
