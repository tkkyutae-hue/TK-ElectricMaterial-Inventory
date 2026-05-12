import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { LogOut, Lock } from "lucide-react";
import { useLanguage, LanguageSwitcher } from "@/hooks/use-language";
import { useFieldTheme, FieldThemeSwitcher } from "@/hooks/use-field-theme";
import type { FieldToken } from "@/lib/fieldTokens";

function getTimeKey(): "morning" | "afternoon" | "evening" {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

const EMOJI_MAP = { morning: "☀️", afternoon: "🌤️", evening: "🌙" };

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
  locked?: boolean;
  lockedLabel?: string;
  F: FieldToken;
  hoverShadow: string;
  restShadow: string;
}

function SquareCard({ testId, onClick, accentColor, emoji, emojiBg, title, tags, tagStyle, tagGap = 4, locked = false, lockedLabel = "Manager+ only", F, hoverShadow, restShadow }: SquareCardProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <button
      data-testid={testId}
      onClick={locked ? undefined : onClick}
      onMouseEnter={() => { if (!locked) setHovered(true); }}
      onMouseLeave={() => { if (!locked) { setHovered(false); setPressed(false); } }}
      onMouseDown={() => { if (!locked) setPressed(true); }}
      onMouseUp={() => { if (!locked) setPressed(false); }}
      style={{
        flex: 1,
        minHeight: 220,
        textAlign: "center",
        background: locked ? F.surface : F.surface2,
        border: `1px solid ${locked ? F.border : hovered ? accentColor : F.borderStrong}`,
        borderRadius: 14,
        padding: 0,
        cursor: locked ? "not-allowed" : "pointer",
        transform: !locked && hovered && !pressed ? "translateY(-2px)" : !locked && pressed ? "translateY(0px) scale(0.99)" : "translateY(0)",
        boxShadow: !locked && hovered ? hoverShadow : restShadow,
        transition: "transform 0.15s, border-color 0.15s, box-shadow 0.15s, background 0.2s",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        opacity: locked ? 0.6 : 1,
        position: "relative",
      }}
    >
      <div style={{ height: 2, background: locked ? F.border : accentColor, width: "100%" }} />

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
          color: locked ? F.textDim : F.text, margin: 0,
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

        {locked ? (
          <div style={{
            position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)",
            display: "flex", alignItems: "center", gap: 4,
            background: F.surface, borderRadius: 6, padding: "3px 8px",
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 10, fontWeight: 600, letterSpacing: 0.5,
            color: F.textDim, whiteSpace: "nowrap",
          }}>
            <Lock style={{ width: 9, height: 9, flexShrink: 0 }} />
            {lockedLabel}
          </div>
        ) : (
          <span style={{
            position: "absolute",
            bottom: 14,
            right: 16,
            fontSize: 14,
            color: hovered ? accentColor : F.textDim,
            transition: "color 0.15s, transform 0.15s",
            transform: hovered ? "translateX(3px)" : "translateX(0)",
            display: "inline-block",
            lineHeight: 1,
          }}>→</span>
        )}
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
  locked?: boolean;
  lockedLabel?: string;
  F: FieldToken;
  hoverShadow: string;
  restShadow: string;
}

function WideCard({ testId, onClick, accentColor, emoji, emojiBg, title, tags, tagStyle, locked = false, lockedLabel = "Manager+ only", F, hoverShadow, restShadow }: WideCardProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <button
      data-testid={testId}
      onClick={locked ? undefined : onClick}
      onMouseEnter={() => { if (!locked) setHovered(true); }}
      onMouseLeave={() => { if (!locked) { setHovered(false); setPressed(false); } }}
      onMouseDown={() => { if (!locked) setPressed(true); }}
      onMouseUp={() => { if (!locked) setPressed(false); }}
      style={{
        width: "100%",
        textAlign: "left",
        background: locked ? F.surface : F.surface2,
        border: `1px solid ${locked ? F.border : hovered ? accentColor : F.borderStrong}`,
        borderRadius: 14,
        padding: 0,
        cursor: locked ? "not-allowed" : "pointer",
        transform: !locked && hovered && !pressed ? "translateY(-2px)" : !locked && pressed ? "translateY(0px) scale(0.99)" : "translateY(0)",
        boxShadow: !locked && hovered ? hoverShadow : restShadow,
        transition: "transform 0.15s, border-color 0.15s, box-shadow 0.15s, background 0.2s",
        overflow: "hidden",
        opacity: locked ? 0.6 : 1,
      }}
    >
      <div style={{ height: 2, background: locked ? F.border : accentColor, width: "100%" }} />

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
            color: locked ? F.textDim : F.text, margin: "0 0 8px",
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

        {locked ? (
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            flexShrink: 0,
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 11, fontWeight: 600, letterSpacing: 0.5,
            color: F.textDim,
          }}>
            <Lock style={{ width: 12, height: 12, flexShrink: 0 }} />
            <span>{lockedLabel}</span>
          </div>
        ) : (
          <span style={{
            fontSize: 20, flexShrink: 0,
            color: hovered ? accentColor : F.textDim,
            transition: "color 0.15s, transform 0.15s",
            transform: hovered ? "translateX(3px)" : "translateX(0)",
            display: "inline-block",
            lineHeight: 1,
          }}>→</span>
        )}
      </div>
    </button>
  );
}

export default function Home() {
  const [, navigate] = useLocation();
  const { user, logout, isAdminRole, canAccessAdminMode } = useAuth();
  const { t } = useLanguage();
  const { F, theme: fieldTheme } = useFieldTheme();

  const gridLineColor = fieldTheme === "light" ? "rgba(22,163,74,0.022)" : F.accentBg;
  const hoverShadow   = fieldTheme === "light" ? "0 8px 28px rgba(15,23,42,0.10)" : "0 8px 28px rgba(0,0,0,0.45)";
  const restShadow    = fieldTheme === "light" ? "0 2px 12px rgba(15,23,42,0.07)" : "none";

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

  const bgStyle: React.CSSProperties = {
    minHeight: "100vh",
    background: F.bg,
    display: "flex",
    flexDirection: "column",
    position: "relative",
    overflow: "hidden",
    fontFamily: "'Barlow', sans-serif",
    transition: "background 0.2s",
  };

  const glowStyle: React.CSSProperties = {
    position: "absolute",
    top: 0, left: "50%",
    transform: "translateX(-50%)",
    width: "100%", height: "65vh",
    background: fieldTheme === "light"
      ? `radial-gradient(ellipse 80% 65% at 50% 0%, rgba(22,163,74,0.05) 0%, transparent 65%)`
      : `radial-gradient(ellipse 80% 65% at 50% 0%, ${F.accentBg} 0%, transparent 65%)`,
    pointerEvents: "none",
    zIndex: 0,
  };

  const gridStyle: React.CSSProperties = {
    position: "absolute", inset: 0, pointerEvents: "none",
    backgroundImage: `
      linear-gradient(${gridLineColor} 1px, transparent 1px),
      linear-gradient(90deg, ${gridLineColor} 1px, transparent 1px)
    `,
    backgroundSize: "52px 52px",
    zIndex: 0,
  };

  return (
    <div style={bgStyle}>
      <div style={glowStyle} />
      <div style={gridStyle} />

      {/* Header */}
      <header style={{
        position: "relative", zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "flex-end",
        padding: "14px 20px",
        gap: 10,
        background: F.bg,
        borderBottom: `1px solid ${F.borderStrong}`,
        transition: "background 0.2s, border-color 0.2s",
      }}>
        <FieldThemeSwitcher compact={true} />
        <LanguageSwitcher theme={fieldTheme === "light" ? "light" : "dark"} compact={true} />

        <button
          onClick={() => logout()}
          data-testid="btn-home-logout"
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "none", border: "none", cursor: "pointer",
            color: F.textDim, fontSize: 13, fontFamily: "'Barlow', sans-serif",
            transition: "color 0.15s",
            padding: "6px 10px", borderRadius: 8,
          }}
          onMouseEnter={e => (e.currentTarget.style.color = F.textMuted)}
          onMouseLeave={e => (e.currentTarget.style.color = F.textDim)}
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
              color: F.textMuted, fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 600, margin: "0 0 8px",
              display: "flex", alignItems: "center", gap: 5,
            }}>
              <span>{emoji}</span> {label}
            </p>
            <h1 style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: "clamp(36px, 8vw, 58px)",
              lineHeight: 1.05, margin: "0 0 10px",
              color: F.text,
              letterSpacing: 1,
            }}>
              <span style={{
                display: "block",
                wordBreak: "keep-all",
                overflowWrap: "normal",
                lineBreak: "strict",
              }}>
                {greeting.toUpperCase()}
              </span>
              <span style={{ color: F.accent, display: "block" }}>
                {firstName}.
              </span>
            </h1>
            <p style={{ fontSize: 13, color: F.textDim, margin: 0, fontFamily: "'Barlow', sans-serif" }}>
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
                accentColor={F.accent}
                emoji="🪖"
                emojiBg={F.accentBg}
                title={t.inventoryMode}
                tags={[t.tagReceive, t.tagIssue, t.tagInventory, t.tagTransfer]}
                tagStyle={{
                  background: F.accentBg,
                  border: `1px solid ${F.accentBorder}`,
                  color: F.accent,
                }}
                F={F}
                hoverShadow={hoverShadow}
                restShadow={restShadow}
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
                locked={!canAccessAdminMode}
                F={F}
                hoverShadow={hoverShadow}
                restShadow={restShadow}
              />
            </div>

            {/* Bottom row: full-width Admin Mode card — always visible, locked for staff/viewer */}
            <WideCard
              testId="btn-admin-mode"
              onClick={() => navigate("/")}
              accentColor={F.warning}
              emoji="⚙️"
              emojiBg={F.warningBg}
              title={t.adminMode}
              tags={[t.tagDashboard, t.tagReports, t.tagSuppliers, t.tagUsers]}
              tagStyle={{
                background: F.warningBg,
                border: `1px solid ${F.warningBorder}`,
                color: F.warning,
              }}
              locked={!canAccessAdminMode}
              F={F}
              hoverShadow={hoverShadow}
              restShadow={restShadow}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
