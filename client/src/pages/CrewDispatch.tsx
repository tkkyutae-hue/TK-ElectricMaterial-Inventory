import { useState } from "react";
import { useLocation } from "wouter";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/hooks/use-auth";

interface TileProps {
  emoji: string;
  title: string;
  subtitle: string;
  accentColor: string;
  onClick: () => void;
}

function Tile({ emoji, title, subtitle, accentColor, onClick }: TileProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed,  setPressed]  = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        flex: 1,
        minHeight: 200,
        background: hovered ? "#ffffff" : "#f8fafc",
        borderRight: `1px solid ${hovered ? accentColor : "#e2e8f0"}`,
        borderBottom: `1px solid ${hovered ? accentColor : "#e2e8f0"}`,
        borderLeft: `1px solid ${hovered ? accentColor : "#e2e8f0"}`,
        borderTop: `3px solid ${accentColor}`,
        borderRadius: 14,
        padding: "32px 24px 28px",
        cursor: "pointer",
        transform: hovered && !pressed ? "translateY(-3px)" : pressed ? "scale(0.99)" : "none",
        boxShadow: hovered ? `0 8px 28px rgba(0,0,0,0.09)` : "0 2px 8px rgba(0,0,0,0.05)",
        transition: "transform 0.15s, border-color 0.15s, box-shadow 0.15s, background 0.15s",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        textAlign: "center",
      }}
    >
      <div style={{
        width: 64, height: 64, borderRadius: 16,
        background: `${accentColor}15`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 30,
      }}>
        {emoji}
      </div>
      <div>
        <p style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 20, fontWeight: 700,
          color: "#1e293b", margin: "0 0 4px",
          letterSpacing: 0.3,
        }}>{title}</p>
        <p style={{
          fontSize: 12, color: "#94a3b8", margin: 0,
          fontFamily: "'Barlow', sans-serif",
          lineHeight: 1.4,
          whiteSpace: "pre-line",
        }}>{subtitle}</p>
      </div>
      <span style={{
        fontSize: 20, color: hovered ? accentColor : "#cbd5e1",
        transition: "color 0.15s, transform 0.15s",
        transform: hovered ? "translateX(4px)" : "none",
        display: "inline-block",
        lineHeight: 1,
        marginTop: 4,
      }}>→</span>
    </button>
  );
}

export default function CrewDispatch() {
  const [, navigate] = useLocation();
  const { t } = useLanguage();
  const { isManagerOrAbove } = useAuth();

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <p style={{
          fontSize: 11, textTransform: "uppercase", letterSpacing: 2,
          color: "#94a3b8", fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 600, margin: "0 0 8px",
        }}>{t.projectOpsMode}</p>
        <h1 style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 40, lineHeight: 1.05, margin: "0 0 6px",
          color: "#1e293b", letterSpacing: 1,
        }}>{t.projectOpsMode}</h1>
        <p style={{ fontSize: 13, color: "#64748b", margin: 0, fontFamily: "'Barlow', sans-serif" }}>
          {t.crewDispatchPageSubtitle}
        </p>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {isManagerOrAbove && (
          <Tile
            emoji="👷"
            title={t.crewDispatchWorkerTitle}
            subtitle={t.crewDispatchWorkerSubtitle}
            accentColor="#f59e0b"
            onClick={() => navigate("/crew-dispatch/assignment")}
          />
        )}
        <Tile
          emoji="📋"
          title={t.crewDispatchDailyTitle}
          subtitle={t.crewDispatchDailySubtitle}
          accentColor="#60a5fa"
          onClick={() => navigate("/daily-report")}
        />
      </div>
    </div>
  );
}
