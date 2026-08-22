import { useState } from "react";
import { useLocation } from "wouter";
import { ClipboardList, HardHat, type LucideIcon } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/hooks/use-auth";
import { useFieldTheme } from "@/hooks/use-field-theme";
import type { FieldToken } from "@/lib/fieldTokens";

interface TileProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  accentColor: string;
  onClick: () => void;
  F: FieldToken;
  isDark: boolean;
}

function Tile({ icon: Icon, title, subtitle, accentColor, onClick, F, isDark }: TileProps) {
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
        background: hovered ? F.surface : F.surface2,
        borderRight: `1px solid ${hovered ? accentColor : F.borderStrong}`,
        borderBottom: `1px solid ${hovered ? accentColor : F.borderStrong}`,
        borderLeft: `1px solid ${hovered ? accentColor : F.borderStrong}`,
        borderTop: `3px solid ${accentColor}`,
        borderRadius: 14,
        padding: "32px 24px 28px",
        cursor: "pointer",
        transform: hovered && !pressed ? "translateY(-3px)" : pressed ? "scale(0.99)" : "none",
        boxShadow: hovered
          ? (isDark ? "0 12px 30px rgba(0,0,0,0.4)" : "0 8px 28px rgba(0,0,0,0.09)")
          : (isDark ? "0 2px 10px rgba(0,0,0,0.2)" : "0 2px 8px rgba(0,0,0,0.05)"),
        transition: "transform 0.15s, border-color 0.15s, box-shadow 0.15s, background 0.2s",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        textAlign: "center",
      }}
    >
      <div style={{
        width: 84, height: 84, borderRadius: 24,
        background: `linear-gradient(145deg, ${accentColor}2b, ${accentColor}0d)`,
        border: `1px solid ${accentColor}55`,
        boxShadow: `0 0 0 6px ${accentColor}0d, 0 10px 24px ${accentColor}18`,
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative",
        transition: "transform 0.15s, box-shadow 0.15s",
        transform: hovered ? "translateY(-2px) scale(1.03)" : "none",
      }}>
        <span style={{
          width: 58, height: 58, borderRadius: 18,
          background: isDark ? `${F.surface}e8` : `${F.surface}f2`,
          border: `1px solid ${accentColor}35`,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12), 0 4px 10px rgba(0,0,0,0.14)",
        }}>
          <Icon size={35} strokeWidth={1.8} color={accentColor} />
        </span>
      </div>
      <div>
        <p style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 21, fontWeight: 700,
          color: F.text, margin: "0 0 4px",
          letterSpacing: 0.3,
        }}>{title}</p>
        <p style={{
          fontSize: 12, color: F.textMuted, margin: 0,
          fontFamily: "'Barlow', sans-serif",
          lineHeight: 1.4,
          whiteSpace: "pre-line",
        }}>{subtitle}</p>
      </div>
      <span style={{
        fontSize: 20, color: hovered ? accentColor : F.textDim,
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
  const { F, theme } = useFieldTheme();

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <p style={{
          fontSize: 11, textTransform: "uppercase", letterSpacing: 2,
          color: F.textMuted, fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 600, margin: "0 0 8px",
        }}>{t.projectOpsMode}</p>
        <h1 style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 40, lineHeight: 1.05, margin: "0 0 6px",
          color: F.text, letterSpacing: 1,
        }}>{t.projectOpsMode}</h1>
        <p style={{ fontSize: 13, color: F.textMuted, margin: 0, fontFamily: "'Barlow', sans-serif" }}>
          {t.crewDispatchPageSubtitle}
        </p>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {isManagerOrAbove && (
          <Tile
            icon={HardHat}
            title={t.crewDispatchWorkerTitle}
            subtitle={t.crewDispatchWorkerSubtitle}
            accentColor="#f59e0b"
            onClick={() => navigate("/crew-dispatch/assignment")}
            F={F}
            isDark={theme === "dark"}
          />
        )}
        <Tile
          icon={ClipboardList}
          title={t.crewDispatchDailyTitle}
          subtitle={t.crewDispatchDailySubtitle}
          accentColor="#60a5fa"
          onClick={() => navigate("/daily-report")}
          F={F}
          isDark={theme === "dark"}
        />
      </div>
    </div>
  );
}
