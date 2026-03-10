import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { HardHat, Settings, LogOut } from "lucide-react";
import tkLogo from "@assets/tk_logo_1772726610288.png";

function getTimeLabel() {
  const h = new Date().getHours();
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  return "Evening";
}

const BG_STYLE: React.CSSProperties = {
  minHeight: "100vh",
  background: "#07090a",
  display: "flex",
  flexDirection: "column",
  position: "relative",
  overflow: "hidden",
  fontFamily: "'Barlow', sans-serif",
};

const GLOW_STYLE: React.CSSProperties = {
  position: "absolute",
  top: 0, left: "50%",
  transform: "translateX(-50%)",
  width: "100%", height: "65vh",
  background: "radial-gradient(ellipse 80% 65% at 50% 0%, rgba(45,219,111,0.06) 0%, transparent 65%)",
  pointerEvents: "none",
  zIndex: 0,
};

const GRID_STYLE: React.CSSProperties = {
  position: "absolute", inset: 0, pointerEvents: "none",
  backgroundImage: `
    linear-gradient(rgba(45,219,111,0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(45,219,111,0.03) 1px, transparent 1px)
  `,
  backgroundSize: "52px 52px",
  zIndex: 0,
};

interface ModeCardProps {
  testId: string;
  onClick: () => void;
  accentColor: string;
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  tags: string[];
  tagStyle: React.CSSProperties;
}

function ModeCard({ testId, onClick, accentColor, icon, iconBg, title, tags, tagStyle }: ModeCardProps) {
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
      style={{
        width: "100%",
        textAlign: "left",
        background: "#0f1612",
        border: `1px solid ${hovered ? accentColor : "#203023"}`,
        borderRadius: 14,
        padding: 0,
        cursor: "pointer",
        transform: hovered && !pressed ? "translateY(-2px)" : pressed ? "translateY(0px) scale(0.99)" : "translateY(0)",
        boxShadow: hovered ? `0 8px 28px rgba(0,0,0,0.45)` : "none",
        transition: "transform 0.15s, border-color 0.15s, box-shadow 0.15s",
        overflow: "hidden",
      }}
    >
      {/* Top color accent line */}
      <div style={{ height: 2, background: accentColor, width: "100%" }} />

      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "20px 22px" }}>
        {/* Icon box */}
        <div style={{
          width: 50, height: 50, borderRadius: 12, flexShrink: 0,
          background: iconBg,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {icon}
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 19, fontWeight: 700,
            color: "#ffffff", margin: "0 0 8px",
            letterSpacing: 0.3,
          }}>{title}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {tags.map(tag => (
              <span key={tag} style={{
                fontSize: 9, textTransform: "uppercase", letterSpacing: 1.2,
                padding: "2px 7px", borderRadius: 4,
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 600,
                ...tagStyle,
              }}>{tag}</span>
            ))}
          </div>
        </div>

        {/* Arrow */}
        <span style={{
          fontSize: 20, flexShrink: 0,
          color: hovered ? accentColor : "#2b3f2e",
          transition: "color 0.15s, transform 0.15s",
          transform: hovered ? "translateX(3px)" : "translateX(0)",
          display: "inline-block",
          lineHeight: 1,
        }}>→</span>
      </div>
    </button>
  );
}

export default function Home() {
  const [, navigate] = useLocation();
  const { user, logout, isAdminRole } = useAuth();

  const displayName = user?.name ?? (user as any)?.firstName ?? user?.email ?? "User";
  const firstName = displayName.split(" ")[0];

  return (
    <div style={BG_STYLE}>
      {/* Background layers */}
      <div style={GLOW_STYLE} />
      <div style={GRID_STYLE} />

      {/* Header — no border, just logo + logout */}
      <header style={{
        position: "relative", zIndex: 10,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "18px 24px",
      }}>
        <img
          src={tkLogo}
          alt="TK Electric"
          style={{ height: 36, width: "auto", objectFit: "contain", filter: "brightness(0) invert(1)", opacity: 0.85 }}
          data-testid="img-tk-logo"
        />
        <button
          onClick={() => logout()}
          data-testid="btn-home-logout"
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "none", border: "none", cursor: "pointer",
            color: "#2b3f2e", fontSize: 13, fontFamily: "'Barlow', sans-serif",
            transition: "color 0.15s",
            padding: "6px 10px", borderRadius: 8,
          }}
          onMouseEnter={e => (e.currentTarget.style.color = "#527856")}
          onMouseLeave={e => (e.currentTarget.style.color = "#2b3f2e")}
        >
          <LogOut style={{ width: 14, height: 14 }} />
          <span>Logout</span>
        </button>
      </header>

      {/* Main content */}
      <div style={{
        position: "relative", zIndex: 10,
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px 24px 48px",
      }}>
        <div style={{ width: "100%", maxWidth: 520 }}>

          {/* Greeting */}
          <div style={{ marginBottom: 32 }}>
            <p style={{
              fontSize: 11, textTransform: "uppercase", letterSpacing: 2,
              color: "#2ddb6f", fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 600, margin: "0 0 8px",
            }}>
              {getTimeLabel()}
            </p>
            <h1 style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 58, lineHeight: 1, margin: "0 0 10px",
              color: "#ffffff",
              letterSpacing: 1,
            }}>
              Hello,{" "}
              <span style={{ color: "#2ddb6f" }}>{firstName}</span>
            </h1>
            <p style={{ fontSize: 13, color: "#2b3f2e", margin: 0, fontFamily: "'Barlow', sans-serif" }}>
              Select a mode to continue
            </p>
          </div>

          {/* Mode cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Field Mode */}
            <ModeCard
              testId="btn-field-mode"
              onClick={() => navigate("/field")}
              accentColor="#2ddb6f"
              icon={<HardHat style={{ width: 26, height: 26, color: "#2ddb6f" }} strokeWidth={1.6} />}
              iconBg="rgba(45,219,111,0.08)"
              title="Field Mode"
              tags={["Receive", "Issue", "Inventory", "Transfers"]}
              tagStyle={{
                background: "rgba(45,219,111,0.08)",
                border: "1px solid rgba(45,219,111,0.15)",
                color: "#2ddb6f",
              }}
            />

            {/* Admin Mode — admin only */}
            {isAdminRole && (
              <ModeCard
                testId="btn-admin-mode"
                onClick={() => navigate("/")}
                accentColor="#f5a623"
                icon={<Settings style={{ width: 24, height: 24, color: "#f5a623" }} strokeWidth={1.6} />}
                iconBg="rgba(245,166,35,0.08)"
                title="Admin Mode"
                tags={["Dashboard", "Reports", "Suppliers", "Users"]}
                tagStyle={{
                  background: "rgba(245,166,35,0.08)",
                  border: "1px solid rgba(245,166,35,0.15)",
                  color: "#f5a623",
                }}
              />
            )}
          </div>

          {/* Role notice for non-admins */}
          {!isAdminRole && (
            <p style={{ fontSize: 11, color: "#2b3f2e", marginTop: 20, fontFamily: "'Barlow', sans-serif" }}>
              Role:{" "}
              <strong style={{ color: "#527856" }}>{user?.role ?? "viewer"}</strong>
              {" "}— Contact an admin for elevated access.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
