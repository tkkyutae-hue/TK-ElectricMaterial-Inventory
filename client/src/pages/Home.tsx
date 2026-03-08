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
  label: string;
  sub: string;
  accentBorder: string;
  accentShadow: string;
}

function ModeRow({ testId, onClick, icon, iconBg, label, sub, accentBorder, accentShadow }: ModeRowProps) {
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
      className="w-full text-left flex items-center gap-5 rounded-lg bg-white transition-all"
      style={{
        padding: "20px 22px",
        border: `1.5px solid ${hovered ? accentBorder : "#E5E7EB"}`,
        boxShadow: hovered
          ? `0 4px 20px ${accentShadow}, 0 0 0 1px ${accentBorder}20`
          : "0 1px 4px rgba(0,0,0,0.05)",
        transform: pressed ? "scale(0.985)" : "scale(1)",
        transition: "border-color 0.15s, box-shadow 0.15s, transform 0.1s",
      }}
    >
      {/* Icon badge */}
      <div
        className="flex items-center justify-center rounded-lg flex-shrink-0"
        style={{ width: 48, height: 48, background: iconBg }}
      >
        {icon}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-base font-bold text-slate-900 leading-tight">{label}</p>
        <p className="text-sm text-slate-400 mt-0.5 font-medium">{sub}</p>
      </div>

      {/* Arrow */}
      <ArrowRight
        className="w-5 h-5 flex-shrink-0 transition-all duration-150"
        style={{
          color: hovered ? accentBorder : "#D1D5DB",
          transform: hovered ? "translateX(3px)" : "translateX(0)",
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
    <div className="min-h-screen flex flex-col bg-[#F8FAFA]">

      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <img src={tkLogo} alt="TK Electric" className="h-8 w-auto object-contain" data-testid="img-tk-logo" />
          <div className="h-4 w-px bg-gray-200" />
          <span className="text-sm font-bold text-slate-500 tracking-wide">VoltStock</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-sm text-slate-400 font-medium">{displayName}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => logout()}
            className="text-slate-400 hover:text-red-500 hover:bg-red-50 gap-1.5 rounded-lg"
            data-testid="btn-home-logout"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline text-sm font-medium">Sign Out</span>
          </Button>
        </div>
      </header>

      {/* Main */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md mx-auto">

          {/* Greeting — editorial style */}
          <div className="mb-10">
            <p className="text-sm font-semibold text-[#0A6B24] mb-1 tracking-wide">
              {getTimeLabel()}
            </p>
            <h1
              className="font-display font-extrabold text-slate-900 leading-none tracking-tight"
              style={{ fontSize: "clamp(32px, 8vw, 44px)", letterSpacing: "-0.02em" }}
            >
              {firstName}.
            </h1>
            <p className="text-slate-400 text-base mt-2 font-medium">
              Select a mode to get started.
            </p>
          </div>

          {/* Divider */}
          <div className="h-px bg-gray-150 mb-6" style={{ background: "#EAECEE" }} />

          {/* Mode rows */}
          <div className="space-y-3">
            <ModeRow
              testId="btn-field-mode"
              onClick={() => navigate("/field")}
              icon={<HardHat className="w-5 h-5" style={{ color: "#0A6B24" }} strokeWidth={2} />}
              iconBg="#EBF7EF"
              label="Field Mode"
              sub="Receive · Issue · Inventory"
              accentBorder="#0A6B24"
              accentShadow="rgba(10,107,36,0.12)"
            />

            {isAdminRole && (
              <ModeRow
                testId="btn-admin-mode"
                onClick={() => navigate("/")}
                icon={<Settings className="w-5 h-5" style={{ color: "#B45309" }} strokeWidth={2} />}
                iconBg="#FEF3E2"
                label="Admin Mode"
                sub="Dashboard · Reports · Users"
                accentBorder="#B45309"
                accentShadow="rgba(180,83,9,0.12)"
              />
            )}
          </div>

          {!isAdminRole && (
            <p className="text-xs text-slate-400 mt-6">
              Role: <strong className="text-slate-500">{user?.role ?? "viewer"}</strong> — Contact an admin for elevated access.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
