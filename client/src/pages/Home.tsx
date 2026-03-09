import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { HardHat, Settings, LogOut, ArrowRight } from "lucide-react";
import tkLogo from "@assets/tk_logo_1772726610288.png";

function getTimeLabel() {
  const h = new Date().getHours();
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  return "Evening";
}

interface ModeRowProps {
  testId: string;
  onClick: () => void;
  icon: React.ReactNode;
  iconBg: string;
  iconBgHover: string;
  label: string;
  sub: string;
  accentColor: string;
  accentShadow: string;
}

function ModeRow({ testId, onClick, icon, iconBg, iconBgHover, label, sub, accentColor, accentShadow }: ModeRowProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <button
      data-testid={testId}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      className="w-full text-left flex items-center gap-5 rounded-xl transition-all"
      style={{
        padding: "28px 26px",
        background: hovered ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.04)",
        border: `1.5px solid ${hovered ? accentColor : "rgba(255,255,255,0.09)"}`,
        boxShadow: hovered ? `0 6px 24px ${accentShadow}` : "none",
        transform: pressed ? "scale(0.985)" : "scale(1)",
        transition: "background 0.15s, border-color 0.15s, box-shadow 0.15s, transform 0.08s",
      }}
    >
      {/* Icon badge */}
      <div
        className="flex items-center justify-center rounded-xl flex-shrink-0 transition-colors duration-150"
        style={{
          width: 100,
          height: 100,
          background: hovered ? iconBgHover : iconBg,
        }}
      >
        {icon}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-base font-bold leading-tight" style={{ color: "#F1F5F9" }}>{label}</p>
        <p className="text-sm mt-0.5 font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>{sub}</p>
      </div>

      {/* Arrow */}
      <ArrowRight
        className="w-5 h-5 flex-shrink-0 transition-all duration-150"
        style={{
          color: hovered ? accentColor : "rgba(255,255,255,0.2)",
          transform: hovered ? "translateX(4px)" : "translateX(0)",
        }}
      />
    </button>
  );
}

export default function Home() {
  const [, navigate] = useLocation();
  const { user, logout, isAdminRole } = useAuth();

  const displayName = user?.name ?? user?.firstName ?? user?.email ?? "User";
  const firstName = displayName.split(" ")[0];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0E1512" }}>

      {/* Subtle radial glow — same as login */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(10,107,36,0.18) 0%, transparent 70%)",
          zIndex: 0,
        }}
      />

      {/* Header */}
      <header
        className="relative z-10 flex items-center justify-between px-6 py-4 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <img
          src={tkLogo}
          alt="TK Electric"
          className="h-12 w-auto object-contain"
          style={{ filter: "brightness(0) invert(1)" }}
          data-testid="img-tk-logo"
        />
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-sm font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>
            {displayName}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => logout()}
            className="gap-1.5 rounded-lg text-sm font-medium"
            style={{ color: "rgba(255,255,255,0.35)" }}
            data-testid="btn-home-logout"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </Button>
        </div>
      </header>

      {/* Main */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md mx-auto">

          {/* Greeting */}
          <div className="mb-10">
            <p className="text-sm font-semibold mb-1.5 tracking-wide" style={{ color: "#3D9E5E" }}>
              {getTimeLabel()}
            </p>
            <h1
              className="font-display font-extrabold leading-none tracking-tight"
              style={{
                fontSize: "clamp(32px, 8vw, 46px)",
                letterSpacing: "-0.02em",
                color: "#F1F5F9",
              }}
            >
              {firstName}.
            </h1>
            <p className="text-base mt-2 font-medium" style={{ color: "rgba(255,255,255,0.30)" }}>
              Select a mode to get started.
            </p>
          </div>

          {/* Divider */}
          <div className="mb-5" style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />

          {/* Mode rows */}
          <div className="space-y-3">
            <ModeRow
              testId="btn-field-mode"
              onClick={() => navigate("/field")}
              icon={<HardHat className="w-14 h-14" style={{ color: "#3DD68C" }} strokeWidth={1.6} />}
              iconBg="rgba(10,107,36,0.25)"
              iconBgHover="rgba(10,107,36,0.40)"
              label="Field Mode"
              sub="Receive · Issue · Inventory"
              accentColor="#3DD68C"
              accentShadow="rgba(61,214,140,0.15)"
            />

            {isAdminRole && (
              <ModeRow
                testId="btn-admin-mode"
                onClick={() => navigate("/")}
                icon={<Settings className="w-14 h-14" style={{ color: "#FBBF24" }} strokeWidth={1.6} />}
                iconBg="rgba(180,83,9,0.20)"
                iconBgHover="rgba(180,83,9,0.35)"
                label="Admin Mode"
                sub="Dashboard · Reports · Users"
                accentColor="#FBBF24"
                accentShadow="rgba(251,191,36,0.15)"
              />
            )}
          </div>

          {!isAdminRole && (
            <p className="text-xs mt-6" style={{ color: "rgba(255,255,255,0.20)" }}>
              Role: <strong style={{ color: "rgba(255,255,255,0.35)" }}>{user?.role ?? "viewer"}</strong> — Contact an admin for elevated access.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
