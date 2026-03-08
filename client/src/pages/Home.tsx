import { useState } from "react";
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

interface ModeCardProps {
  testId: string;
  onClick: () => void;
  bg: string;
  shadow: string;
  hoverShadow: string;
  iconBg: string;
  icon: React.ReactNode;
  label: string;
  sub: string;
  ctaLabel: string;
  ctaPillBg: string;
}

function ModeCard({ testId, onClick, bg, shadow, hoverShadow, iconBg, icon, label, sub, ctaLabel, ctaPillBg }: ModeCardProps) {
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className="group relative rounded-3xl overflow-hidden text-left w-full cursor-pointer flex flex-col"
      style={{
        background: bg,
        minHeight: "230px",
        boxShadow: hovered ? hoverShadow : shadow,
        transform: pressed ? "scale(0.97)" : hovered ? "translateY(-4px)" : "translateY(0)",
        transition: pressed ? "transform 0.08s ease" : "transform 0.22s ease, box-shadow 0.22s ease",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
    >
      {/* Top inner highlight */}
      <div
        className="absolute top-0 left-0 right-0 pointer-events-none"
        style={{
          height: "60px",
          background: "linear-gradient(to bottom, rgba(255,255,255,0.14) 0%, transparent 100%)",
        }}
      />
      {/* Bottom inner shadow */}
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{
          height: "40px",
          background: "linear-gradient(to top, rgba(0,0,0,0.10) 0%, transparent 100%)",
        }}
      />

      <div className="relative z-10 flex flex-col gap-5 p-7 h-full">
        {/* App icon badge */}
        <div
          className="flex items-center justify-center rounded-2xl"
          style={{
            width: 68,
            height: 68,
            background: iconBg,
            boxShadow: "0 4px 16px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.20)",
          }}
        >
          {icon}
        </div>

        {/* Text */}
        <div className="flex-1">
          <h2 className="text-2xl font-display font-bold text-white leading-tight mb-1">{label}</h2>
          <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.65)" }}>{sub}</p>
        </div>

        {/* CTA pill */}
        <div
          className="inline-flex items-center gap-1.5 self-start rounded-full px-4 py-2"
          style={{ background: ctaPillBg }}
        >
          <span className="text-sm font-bold text-white">{ctaLabel}</span>
          <ChevronRight
            className="w-4 h-4 text-white transition-transform duration-200"
            style={{ transform: hovered ? "translateX(3px)" : "translateX(0)" }}
          />
        </div>
      </div>
    </button>
  );
}

export default function Home() {
  const [, navigate] = useLocation();
  const { user, logout, isAdminRole } = useAuth();

  const displayName = user?.name ?? user?.firstName ?? user?.email ?? "User";
  const firstName = displayName.split(" ")[0];

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "linear-gradient(160deg, #EAF7EE 0%, #F7FBF8 50%, #FFFFFF 100%)" }}
    >
      {/* Header */}
      <header
        className="px-6 py-3 flex items-center justify-between flex-shrink-0"
        style={{ background: "rgba(255,255,255,0.75)", backdropFilter: "blur(12px)", borderBottom: "1px solid #D9E7DD" }}
      >
        <div className="flex items-center gap-3">
          <img src={tkLogo} alt="TK Electric" className="h-9 w-auto object-contain" data-testid="img-tk-logo" />
          <div>
            <span className="font-display font-bold text-lg text-slate-900 leading-none block">TK Electric</span>
            <span className="text-[11px] font-bold text-[#0A6B24] leading-none tracking-wide uppercase">VoltStock</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-sm text-slate-500 font-medium">{displayName}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => logout()}
            className="text-slate-400 hover:text-red-500 hover:bg-red-50 gap-1.5 rounded-xl"
            data-testid="btn-home-logout"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline text-sm">Sign Out</span>
          </Button>
        </div>
      </header>

      {/* Main */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl mx-auto">

          {/* Greeting */}
          <div className="text-center mb-10">
            <div
              className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-4"
              style={{ background: "#EAF7EE", border: "1px solid #D9E7DD" }}
            >
              <div className="w-2 h-2 rounded-full bg-[#0A6B24]" style={{ boxShadow: "0 0 6px rgba(10,107,36,0.5)" }} />
              <span className="text-xs font-bold text-[#0A6B24] tracking-wide uppercase">VoltStock</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-display font-bold text-slate-900 mb-2">
              {getGreeting()}, {firstName} 👋
            </h1>
            <p className="text-slate-400 text-base">What's on the agenda today?</p>
          </div>

          {/* Mode cards */}
          <div className={`grid gap-5 ${isAdminRole ? "grid-cols-1 sm:grid-cols-2" : "max-w-sm mx-auto"}`}>
            <ModeCard
              testId="btn-field-mode"
              onClick={() => navigate("/field")}
              bg="linear-gradient(145deg, #0A6B24 0%, #0e8f2e 60%, #11a035 100%)"
              shadow="0 6px 24px rgba(10,107,36,0.25)"
              hoverShadow="0 16px 48px rgba(10,107,36,0.35)"
              iconBg="rgba(255,255,255,0.18)"
              icon={<HardHat style={{ width: 38, height: 38, color: "white" }} strokeWidth={1.7} />}
              label="Field Mode"
              sub="Receive · Issue · Inventory"
              ctaLabel="Start Field"
              ctaPillBg="rgba(255,255,255,0.18)"
            />

            {isAdminRole && (
              <ModeCard
                testId="btn-admin-mode"
                onClick={() => navigate("/")}
                bg="linear-gradient(145deg, #b45309 0%, #d97706 60%, #f59e0b 100%)"
                shadow="0 6px 24px rgba(180,83,9,0.25)"
                hoverShadow="0 16px 48px rgba(180,83,9,0.35)"
                iconBg="rgba(255,255,255,0.18)"
                icon={<Settings style={{ width: 38, height: 38, color: "white" }} strokeWidth={1.7} />}
                label="Admin Mode"
                sub="Dashboard · Reports · Users"
                ctaLabel="Open Admin"
                ctaPillBg="rgba(255,255,255,0.18)"
              />
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
