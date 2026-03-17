import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { LogOut } from "lucide-react";
import { useLanguage, LanguageSwitcher } from "@/hooks/use-language";

function getTimeKey(): "morning" | "afternoon" | "evening" {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

const EMOJI_MAP = { morning: "☀️", afternoon: "🌤️", evening: "🌙" };

const BG_STYLE: React.CSSProperties = {
  minHeight: "100vh",
  background: "#0d1410",
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
  background: "radial-gradient(ellipse 80% 65% at 50% 0%, rgba(45,219,111,0.10) 0%, transparent 65%)",
  pointerEvents: "none",
  zIndex: 0,
};

const GRID_STYLE: React.CSSProperties = {
  position: "absolute", inset: 0, pointerEvents: "none",
  backgroundImage: `
    linear-gradient(rgba(45,219,111,0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(45,219,111,0.05) 1px, transparent 1px)
  `,
  backgroundSize: "52px 52px",
  zIndex: 0,
};

interface SquareCardProps {
  testId: string;
  onClick: () => void;
  accentColor: string;
  emoji: string;
  emojiBg: string;
  title: string;
  tags: string[];
  tagStyle: React.CSSProperties;
  tagGap?: number;
}

function SquareCard({ testId, onClick, accentColor, emoji, emojiBg, title, tags, tagStyle, tagGap = 4 }: SquareCardProps) {
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
        flex: 1,
        minHeight: 220,
        textAlign: "center",
        background: "#162019",
        border: `1px solid ${hovered ? accentColor : "#2a4030"}`,
        borderRadius: 14,
        padding: 0,
        cursor: "pointer",
        transform: hovered && !pressed ? "translateY(-2px)" : pressed ? "translateY(0px) scale(0.99)" : "translateY(0)",
        boxShadow: hovered ? `0 8px 28px rgba(0,0,0,0.45)` : "none",
        transition: "transform 0.15s, border-color 0.15s, box-shadow 0.15s",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
      }}
    >
      <div style={{ height: 2, background: accentColor, width: "100%" }} />

      <div style={{
        flex: 1,
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "28px 16px 36px",
        gap: 8,
      }}>
        <div style={{
          width: 66, height: 66, borderRadius: 16, flexShrink: 0,
          background: emojiBg,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 32,
        }}>
          {emoji}
        </div>

        <p style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 17, fontWeight: 700,
          color: "#e2f0e5", margin: 0,
          letterSpacing: 0.3,
          lineHeight: 1.2,
        }}>{title}</p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: tagGap, justifyContent: "center" }}>
          {tags.map(tag => (
            <span key={tag} style={{
              fontSize: 8, textTransform: "uppercase", letterSpacing: 1.2,
              padding: "2px 6px", borderRadius: 4,
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 600,
              ...tagStyle,
            }}>{tag}</span>
          ))}
        </div>

        <span style={{
          position: "absolute",
          bottom: 14,
          right: 16,
          fontSize: 14,
          color: hovered ? accentColor : "#4a7052",
          transition: "color 0.15s, transform 0.15s",
          transform: hovered ? "translateX(3px)" : "translateX(0)",
          display: "inline-block",
          lineHeight: 1,
        }}>→</span>
      </div>
    </button>
  );
}

interface WideCardProps {
  testId: string;
  onClick: () => void;
  accentColor: string;
  emoji: string;
  emojiBg: string;
  title: string;
  tags: string[];
  tagStyle: React.CSSProperties;
}

function WideCard({ testId, onClick, accentColor, emoji, emojiBg, title, tags, tagStyle }: WideCardProps) {
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
        background: "#162019",
        border: `1px solid ${hovered ? accentColor : "#2a4030"}`,
        borderRadius: 14,
        padding: 0,
        cursor: "pointer",
        transform: hovered && !pressed ? "translateY(-2px)" : pressed ? "translateY(0px) scale(0.99)" : "translateY(0)",
        boxShadow: hovered ? `0 8px 28px rgba(0,0,0,0.45)` : "none",
        transition: "transform 0.15s, border-color 0.15s, box-shadow 0.15s",
        overflow: "hidden",
      }}
    >
      <div style={{ height: 2, background: accentColor, width: "100%" }} />

      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "20px 22px" }}>
        <div style={{
          width: 58, height: 58, borderRadius: 12, flexShrink: 0,
          background: emojiBg,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 28,
        }}>
          {emoji}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 19, fontWeight: 700,
            color: "#e2f0e5", margin: "0 0 8px",
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

        <span style={{
          fontSize: 20, flexShrink: 0,
          color: hovered ? accentColor : "#4a7052",
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
  const { user, logout, isAdminRole, canAccessAdminMode } = useAuth();
  const { t } = useLanguage();

  const displayName = user?.name ?? (user as any)?.firstName ?? user?.email ?? "User";
  const firstName = displayName.split(" ")[0].toUpperCase();
  const timeKey = getTimeKey();
  const emoji = EMOJI_MAP[timeKey];
  const label = t[timeKey];
  const greeting = (
    timeKey === "morning" ? t.goodMorning
    : timeKey === "afternoon" ? t.goodAfternoon
    : t.goodEvening
  );

  return (
    <div style={BG_STYLE}>
      <div style={GLOW_STYLE} />
      <div style={GRID_STYLE} />

      {/* Header */}
      <header style={{
        position: "relative", zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "flex-end",
        padding: "14px 20px",
        gap: 10,
        background: "#0d1410",
        borderBottom: "1px solid #2a4030",
      }}>
        <LanguageSwitcher theme="dark" />

        <button
          onClick={() => logout()}
          data-testid="btn-home-logout"
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "none", border: "none", cursor: "pointer",
            color: "#4a7052", fontSize: 13, fontFamily: "'Barlow', sans-serif",
            transition: "color 0.15s",
            padding: "6px 10px", borderRadius: 8,
          }}
          onMouseEnter={e => (e.currentTarget.style.color = "#7aab82")}
          onMouseLeave={e => (e.currentTarget.style.color = "#4a7052")}
        >
          <LogOut style={{ width: 14, height: 14 }} />
          <span>{t.logout}</span>
        </button>
      </header>

      {/* Main content */}
      <div style={{
        position: "relative", zIndex: 10,
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px 24px 48px",
      }}>
        <div style={{ width: "100%", maxWidth: 580 }}>

          {/* Greeting */}
          <div style={{ marginBottom: 32 }}>
            <p style={{
              fontSize: 11, textTransform: "uppercase", letterSpacing: 2,
              color: "#7aab82", fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 600, margin: "0 0 8px",
              display: "flex", alignItems: "center", gap: 5,
            }}>
              <span>{emoji}</span> {label}
            </p>
            <h1 style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 58, lineHeight: 1.02, margin: "0 0 10px",
              color: "#e2f0e5",
              letterSpacing: 1,
            }}>
              {greeting.toUpperCase()}<br />
              <span style={{ color: "#2ddb6f" }}>{firstName}.</span>
            </h1>
            <p style={{ fontSize: 13, color: "#4a7052", margin: 0, fontFamily: "'Barlow', sans-serif" }}>
              {t.selectMode}
            </p>
          </div>

          {/* Mode cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Top row: 2 equal square cards */}
            <div style={{ display: "flex", gap: 12 }}>
              <SquareCard
                testId="btn-inventory-mode"
                onClick={() => navigate("/field")}
                accentColor="#2ddb6f"
                emoji="🪖"
                emojiBg="rgba(45,219,111,0.08)"
                title={t.inventoryMode}
                tags={[t.tagReceive, t.tagIssue, t.tagInventory, t.tagTransfer]}
                tagStyle={{
                  background: "rgba(45,219,111,0.08)",
                  border: "1px solid rgba(45,219,111,0.15)",
                  color: "#2ddb6f",
                }}
              />

              <SquareCard
                testId="btn-daily-report-mode"
                onClick={() => navigate("/daily-report")}
                accentColor="#60a5fa"
                emoji="📋"
                emojiBg="rgba(96,165,250,0.08)"
                title={t.dailyReportMode}
                tags={[t.tagProjects, t.tagReports, t.tagManpower, t.tagProgress]}
                tagGap={6}
                tagStyle={{
                  background: "rgba(96,165,250,0.08)",
                  border: "1px solid rgba(96,165,250,0.15)",
                  color: "#60a5fa",
                }}
              />
            </div>

            {/* Bottom row: full-width Admin Mode card */}
            {canAccessAdminMode && (
              <WideCard
                testId="btn-admin-mode"
                onClick={() => navigate("/")}
                accentColor="#f5a623"
                emoji="⚙️"
                emojiBg="rgba(245,166,35,0.08)"
                title={t.adminMode}
                tags={[t.tagDashboard, t.tagReports, t.tagSuppliers, t.tagUsers]}
                tagStyle={{
                  background: "rgba(245,166,35,0.08)",
                  border: "1px solid rgba(245,166,35,0.15)",
                  color: "#f5a623",
                }}
              />
            )}
          </div>

          {!canAccessAdminMode && (
            <p style={{ fontSize: 11, color: "#4a7052", marginTop: 20, fontFamily: "'Barlow', sans-serif" }}>
              {t.role}:{" "}
              <strong style={{ color: "#7aab82" }}>{user?.role ?? "viewer"}</strong>
              {" "}{t.roleNote}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
