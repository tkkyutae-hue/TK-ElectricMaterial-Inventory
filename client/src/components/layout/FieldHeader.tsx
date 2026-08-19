import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, HardHat, Home } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage, LanguageSwitcher } from "@/hooks/use-language";
import { useIsMobile } from "@/hooks/use-mobile";
import { useFieldTheme, FieldThemeSwitcher } from "@/hooks/use-field-theme";
import { TkElectricBrand } from "@/components/layout/TkElectricBrand";

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export function FieldHeader() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { theme: fieldTheme, F } = useFieldTheme();
  const [location] = useLocation();
  const isFieldHome = location === "/field";
  const now = useClock();
  const isMobile = useIsMobile();

  const dateStr      = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const dateStrShort = now.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

  return (
    <header
      className="px-3 sm:px-5"
      style={{
        position: "relative", zIndex: 50, flexShrink: 0,
         minHeight: 68,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: 0,
         background: `linear-gradient(90deg, ${F.bg} 0%, ${F.surface2} 50%, ${F.bg} 100%)`,
        borderBottom: `1px solid ${F.borderStrong}`,
         borderTop: `3px solid ${F.accent}`,
        transition: "background 0.2s, border-color 0.2s",
      }}
    >
      {/* Left side */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>

        <TkElectricBrand
          compact
          textColor={F.text}
          className="field-header-brand"
          textClassName="hidden sm:block"
        />

        {/* Field Mode chip */}
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          background: F.accentBg,
          border: `1px solid ${F.accentBorder}`,
          borderRadius: 20, padding: "3px 10px",
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 11, fontWeight: 700, letterSpacing: 1,
          color: F.accent, textTransform: "uppercase",
        }}>
          <div className="fl-pulse-dot" style={{ width: 5, height: 5,
            borderRadius: "50%", background: F.accent, flexShrink: 0 }} />
          <HardHat style={{ width: 11, height: 11, flexShrink: 0 }} />
          <span className="hidden-mobile">{t.fieldModeChip}</span>
        </div>

        {/* Date & Time — compact on mobile, full on desktop */}
        <div style={{
          fontSize: 11, color: F.textDim,
          fontFamily: "'Barlow Condensed', sans-serif",
          letterSpacing: 0.5,
          display: "flex", gap: 4, alignItems: "center",
        }}>
          <span>{isMobile ? dateStrShort : dateStr}</span>
          <span style={{ opacity: 0.5 }}>·</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{timeStr}</span>
        </div>
      </div>

      {/* Right side */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: 4,
        background: F.surface,
        border: `1px solid ${F.borderStrong}`,
        borderRadius: 14,
        boxShadow: fieldTheme === "light" ? "0 4px 14px rgba(15,31,23,0.06)" : "0 8px 18px rgba(0,0,0,0.18)",
      }}>

        {/* Dark/Light theme toggle — left of language switcher */}
        <FieldThemeSwitcher compact={true} />

        <LanguageSwitcher theme={fieldTheme} compact={true} />

        {/* Back button — sub-pages only */}
        {!isFieldHome && (
          <Link href="/field">
            <button
              data-testid="btn-field-back"
              className="fl-hdr-btn focus-visible:outline-none focus-visible:ring-2
                focus-visible:ring-[#2ddb6f] focus-visible:ring-offset-1
                focus-visible:ring-offset-[#0d1410]"
              style={{
                display: "flex", alignItems: "center", gap: 5,
                height: 32,
                background: F.surface2, border: `1px solid ${F.borderStrong}`,
                borderRadius: 8, padding: "0 10px",
                color: F.textMuted, fontSize: 11,
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 600, letterSpacing: 0.5,
                cursor: "pointer", transition: "border-color 0.15s, color 0.15s",
                textTransform: "uppercase",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.color = F.accent;
                (e.currentTarget as HTMLButtonElement).style.borderColor = F.accentBorder;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.color = F.textMuted;
                (e.currentTarget as HTMLButtonElement).style.borderColor = F.borderStrong;
              }}
            >
              <ArrowLeft style={{ width: 11, height: 11 }} />
              <span className="hidden-mobile">{t.back}</span>
            </button>
          </Link>
        )}

        {/* Mode Select button */}
        <Link href="/home">
          <button
            data-testid="btn-field-home"
            className="fl-hdr-btn focus-visible:outline-none focus-visible:ring-2
              focus-visible:ring-[#2ddb6f] focus-visible:ring-offset-1
              focus-visible:ring-offset-[#0d1410]"
            style={{
              display: "flex", alignItems: "center", gap: 5,
              height: 32,
              background: F.surface2, border: `1px solid ${F.borderStrong}`,
              borderRadius: 8, padding: "0 10px",
              color: F.textMuted, fontSize: 11,
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 600, letterSpacing: 0.5,
              cursor: "pointer", transition: "border-color 0.15s, color 0.15s",
              textTransform: "uppercase",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.color = F.text;
              (e.currentTarget as HTMLButtonElement).style.borderColor = F.accentBorder;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.color = F.textMuted;
              (e.currentTarget as HTMLButtonElement).style.borderColor = F.borderStrong;
            }}
          >
            <Home style={{ width: 11, height: 11, flexShrink: 0 }} />
            <span className="hidden-mobile">{t.modeSelect}</span>
          </button>
        </Link>

        {/* User avatar */}
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: F.accentBg,
          border: `1px solid ${F.borderStrong}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: F.accent,
            fontFamily: "'Barlow Condensed', sans-serif" }}>
            {(user?.firstName?.[0] ?? user?.email?.[0] ?? "?").toUpperCase()}
          </span>
        </div>
      </div>
    </header>
  );
}
