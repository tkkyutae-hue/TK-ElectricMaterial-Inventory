import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage, LanguageSwitcher } from "@/hooks/use-language";
import { useState, useEffect } from "react";
import { HardHat, Package, ClipboardList, Settings, Shield } from "lucide-react";
import tkLogo from "@assets/tk_logo_1772726610288.png";

const CSS = `
@keyframes fl-pulse-dot {
  0%,100% { transform: scale(1);    opacity: 1; }
  50%      { transform: scale(1.4); opacity: 0.55; }
}
@keyframes fl-flicker {
  0%,95%,97%,100% { opacity: 1; }
  96%             { opacity: 0.5; }
  98%             { opacity: 0.75; }
}
.hub-pulse { animation: fl-pulse-dot 2.5s ease-in-out infinite; }
.hub-flicker { animation: fl-flicker 7s ease-in-out 3s infinite; }

.hub-card {
  background: #162019;
  border: 1px solid #2a4030;
  border-radius: 16px;
  padding: 28px 24px;
  cursor: pointer;
  transition: border-color 0.18s, box-shadow 0.18s, transform 0.12s;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  flex: 1;
  min-width: 0;
}
.hub-card:hover {
  border-color: rgba(45,219,111,0.45);
  box-shadow: 0 0 24px rgba(45,219,111,0.08);
  transform: translateY(-1px);
}
.hub-admin-btn {
  background: transparent;
  border: 1px solid rgba(245,166,35,0.3);
  border-radius: 10px;
  padding: 10px 20px;
  color: #f5a623;
  font-family: 'Barlow Condensed', sans-serif;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 1.2px;
  text-transform: uppercase;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 7px;
  transition: background 0.15s, border-color 0.15s;
}
.hub-admin-btn:hover {
  background: rgba(245,166,35,0.06);
  border-color: rgba(245,166,35,0.55);
}
`;

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  admin:   { label: "Admin",   color: "#f5a623", bg: "rgba(245,166,35,0.08)",  border: "rgba(245,166,35,0.25)" },
  manager: { label: "Manager", color: "#a78bfa", bg: "rgba(167,139,250,0.08)", border: "rgba(167,139,250,0.25)" },
  staff:   { label: "Staff",   color: "#60a5fa", bg: "rgba(96,165,250,0.08)",  border: "rgba(96,165,250,0.25)" },
  viewer:  { label: "Viewer",  color: "#7aab82", bg: "rgba(122,171,130,0.08)", border: "rgba(122,171,130,0.25)" },
};

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export default function Hub() {
  const [, navigate] = useLocation();
  const { user, logout, isLoggingOut, canAccessAdminMode } = useAuth();
  const { t } = useLanguage();
  const now = useClock();

  const role = user?.role ?? "viewer";
  const roleConf = ROLE_CONFIG[role] ?? ROLE_CONFIG.viewer;

  const displayName = user?.name ?? [user?.firstName, user?.lastName].filter(Boolean).join(" ") ?? user?.email ?? "User";
  const firstName = displayName.split(" ")[0];
  const initials = displayName.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();

  const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#0d1410", fontFamily: "'Barlow', sans-serif" }}>
      <style>{CSS}</style>

      {/* Grid texture */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: "linear-gradient(rgba(45,219,111,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(45,219,111,0.04) 1px, transparent 1px)",
        backgroundSize: "52px 52px",
      }} />

      {/* Radial glow */}
      <div style={{
        position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", height: "55vh", pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(45,219,111,0.09) 0%, transparent 65%)",
      }} />

      {/* ── Topbar ── */}
      <header style={{
        position: "relative", zIndex: 50, flexShrink: 0,
        height: 56,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px",
        background: "#0d1410",
        borderBottom: "1px solid #2a4030",
      }}>

        {/* Left: Logo | divider | Field Operations */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <img src={tkLogo} alt="TK Electric" style={{ height: 32, width: "auto", objectFit: "contain", imageRendering: "crisp-edges" }} />

          <div style={{ width: 1, height: 28, background: "#2a4030", flexShrink: 0 }} />

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div className="hub-pulse" style={{ width: 5, height: 5, borderRadius: "50%", background: "#2ddb6f", flexShrink: 0 }} />
            <HardHat style={{ width: 13, height: 13, color: "#2ddb6f", flexShrink: 0 }} />
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 12, fontWeight: 700, letterSpacing: 1.5,
              color: "#2ddb6f", textTransform: "uppercase",
            }}>
              Field Operations
            </span>
          </div>
        </div>

        {/* Right: role badge, language, settings, avatar */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

          {/* Role badge */}
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 10, fontWeight: 700, letterSpacing: 1.2,
            textTransform: "uppercase",
            color: roleConf.color,
            background: roleConf.bg,
            border: `1px solid ${roleConf.border}`,
            borderRadius: 20, padding: "3px 9px",
          }}>
            {roleConf.label}
          </span>

          {/* Language switcher */}
          <LanguageSwitcher theme="dark" />

          {/* Settings button */}
          <button
            data-testid="btn-hub-settings"
            style={{
              width: 30, height: 30, borderRadius: 8,
              background: "#162019", border: "1px solid #2a4030",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "#7aab82",
              transition: "border-color 0.15s, color 0.15s",
            }}
            onClick={() => logout()}
            title="Sign out"
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#e2f0e5"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(45,219,111,0.35)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#7aab82"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#2a4030"; }}
          >
            <Settings style={{ width: 13, height: 13 }} />
          </button>

          {/* Avatar */}
          <div
            data-testid="hub-avatar"
            style={{
              width: 30, height: 30, borderRadius: "50%",
              background: "rgba(45,219,111,0.08)",
              border: "1px solid #2a4030",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: "#2ddb6f", fontFamily: "'Barlow Condensed', sans-serif" }}>
              {initials}
            </span>
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <main style={{ position: "relative", zIndex: 10, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 24px 48px" }}>

        {/* Greeting */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <p style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 11, fontWeight: 700, letterSpacing: 2,
            color: "#4a7052", textTransform: "uppercase", marginBottom: 6,
          }}>
            {dateStr} · {timeStr}
          </p>
          <h1 style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 38, letterSpacing: 1.5,
            color: "#e2f0e5", margin: 0, lineHeight: 1,
          }}>
            {greeting},&nbsp;
            <span style={{ color: "#2ddb6f" }}>{firstName}</span>
          </h1>
          <p style={{
            fontFamily: "'Barlow', sans-serif",
            fontSize: 13, color: "#4a7052", marginTop: 6,
          }}>
            Select an area to get started
          </p>
        </div>

        {/* Two main cards */}
        <div style={{ display: "flex", gap: 14, width: "100%", maxWidth: 520 }}>

          {/* Inventory card */}
          <div
            className="hub-card"
            role="button"
            data-testid="btn-hub-inventory"
            onClick={() => navigate("/field/inventory")}
          >
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: "rgba(45,219,111,0.08)",
              border: "1px solid rgba(45,219,111,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Package style={{ width: 20, height: 20, color: "#2ddb6f" }} />
            </div>
            <div>
              <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 1, color: "#e2f0e5", margin: 0 }}>
                Inventory
              </p>
              <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 11, color: "#4a7052", margin: "3px 0 0" }}>
                Browse &amp; search materials
              </p>
            </div>
          </div>

          {/* Daily Report card */}
          <div
            className="hub-card"
            role="button"
            data-testid="btn-hub-daily-report"
            onClick={() => navigate("/field/transactions")}
          >
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: "rgba(245,166,35,0.07)",
              border: "1px solid rgba(245,166,35,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <ClipboardList style={{ width: 20, height: 20, color: "#f5a623" }} />
            </div>
            <div>
              <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 1, color: "#e2f0e5", margin: 0 }}>
                Daily Report
              </p>
              <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 11, color: "#4a7052", margin: "3px 0 0" }}>
                Movements &amp; transactions
              </p>
            </div>
          </div>
        </div>

        {/* Admin Mode button — admin and manager only */}
        {canAccessAdminMode && (
          <div style={{ marginTop: 24, textAlign: "center" }}>
            <button
              className="hub-admin-btn"
              data-testid="btn-hub-admin-mode"
              onClick={() => navigate("/")}
            >
              <Shield style={{ width: 13, height: 13 }} />
              Admin Mode
            </button>
          </div>
        )}

        {/* Sign out link */}
        <button
          onClick={() => logout()}
          disabled={isLoggingOut}
          data-testid="btn-hub-signout"
          style={{
            marginTop: 32,
            background: "none", border: "none",
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 11, fontWeight: 600, letterSpacing: 0.8,
            color: "#3a5c42", textTransform: "uppercase",
            cursor: "pointer",
            transition: "color 0.15s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#ff5050"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#3a5c42"; }}
        >
          Sign Out
        </button>
      </main>
    </div>
  );
}
