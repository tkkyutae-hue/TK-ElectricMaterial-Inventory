import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { HardHat, Settings, LogOut, ChevronRight } from "lucide-react";
import tkLogo from "@assets/tk_logo_1772726610288.png";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function Home() {
  const [, navigate] = useLocation();
  const { user, logout, isAdminRole } = useAuth();

  const displayName = user?.name ?? user?.firstName ?? user?.email ?? "User";
  const firstName = displayName.split(" ")[0];

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "linear-gradient(160deg, #f4fbf6 0%, #eaf7ee 40%, #f8faf9 100%)" }}
    >
      {/* Header */}
      <header className="bg-white/70 backdrop-blur-sm border-b border-[#D9E7DD] px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <img src={tkLogo} alt="TK Electric" className="h-9 w-auto object-contain" data-testid="img-tk-logo" />
          <div>
            <span className="font-display font-bold text-lg text-slate-900 leading-none block">TK Electric</span>
            <span className="text-[11px] text-[#0A6B24] font-semibold leading-none tracking-wide">VoltStock</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-sm text-slate-500 font-medium">{displayName}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => logout()}
            className="text-slate-400 hover:text-red-500 hover:bg-red-50 gap-1.5 rounded-lg"
            data-testid="btn-home-logout"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline text-sm">Sign Out</span>
          </Button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl mx-auto">

          {/* Greeting */}
          <div className="text-center mb-10">
            <p className="text-sm font-bold tracking-widest text-[#0A6B24] uppercase mb-3">VoltStock</p>
            <h1 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 mb-2">
              {getGreeting()}, {firstName} 👋
            </h1>
            <p className="text-slate-500 text-base">What's on the agenda today?</p>
          </div>

          {/* Mode cards */}
          <div className={`grid gap-5 ${isAdminRole ? "grid-cols-1 sm:grid-cols-2" : "max-w-sm mx-auto"}`}>

            {/* Field Mode */}
            <button
              onClick={() => navigate("/field")}
              data-testid="btn-field-mode"
              className="group relative rounded-2xl overflow-hidden text-left w-full cursor-pointer transition-all duration-200"
              style={{
                background: "linear-gradient(145deg, #0A6B24 0%, #0d8a30 100%)",
                minHeight: "220px",
                boxShadow: "0 4px 24px rgba(10,107,36,0.20)",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)";
                (e.currentTarget as HTMLElement).style.boxShadow = "0 12px 40px rgba(10,107,36,0.30)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 24px rgba(10,107,36,0.20)";
              }}
            >
              {/* Background decoration */}
              <div
                className="absolute pointer-events-none"
                style={{
                  top: -40, right: -40, width: 200, height: 200,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.06)",
                }}
              />
              <div
                className="absolute pointer-events-none"
                style={{
                  bottom: -20, left: -20, width: 120, height: 120,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.05)",
                }}
              />

              <div className="relative z-10 flex flex-col gap-5 p-8 h-full">
                <div
                  className="flex items-center justify-center rounded-2xl"
                  style={{ width: 72, height: 72, background: "rgba(255,255,255,0.15)", backdropFilter: "blur(4px)" }}
                >
                  <HardHat style={{ width: 40, height: 40, color: "white" }} strokeWidth={1.8} />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-display font-bold text-white mb-1">Field Mode</h2>
                  <p className="text-green-200 text-sm font-medium">Receive · Issue · Inventory</p>
                </div>
                <div className="flex items-center gap-1.5 text-white/80 text-sm font-semibold">
                  <span>Go to Field</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </button>

            {/* Admin Mode */}
            {isAdminRole && (
              <button
                onClick={() => navigate("/")}
                data-testid="btn-admin-mode"
                className="group relative rounded-2xl overflow-hidden text-left w-full cursor-pointer transition-all duration-200"
                style={{
                  background: "linear-gradient(145deg, #c47a07 0%, #d97706 100%)",
                  minHeight: "220px",
                  boxShadow: "0 4px 24px rgba(217,119,6,0.20)",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 12px 40px rgba(217,119,6,0.30)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 24px rgba(217,119,6,0.20)";
                }}
              >
                <div
                  className="absolute pointer-events-none"
                  style={{
                    top: -40, right: -40, width: 200, height: 200,
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.06)",
                  }}
                />
                <div
                  className="absolute pointer-events-none"
                  style={{
                    bottom: -20, left: -20, width: 120, height: 120,
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.05)",
                  }}
                />

                <div className="relative z-10 flex flex-col gap-5 p-8 h-full">
                  <div
                    className="flex items-center justify-center rounded-2xl"
                    style={{ width: 72, height: 72, background: "rgba(255,255,255,0.15)", backdropFilter: "blur(4px)" }}
                  >
                    <Settings style={{ width: 40, height: 40, color: "white" }} strokeWidth={1.8} />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-2xl font-display font-bold text-white mb-1">Admin Mode</h2>
                    <p className="text-amber-100 text-sm font-medium">Dashboard · Reports · Users</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-white/80 text-sm font-semibold">
                    <span>Go to Admin</span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </button>
            )}
          </div>

          {!isAdminRole && (
            <p className="text-center text-xs text-slate-400 mt-8">
              Role: <strong className="text-slate-500">{user?.role ?? "viewer"}</strong> — Contact an admin to request elevated access.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
