import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, HardHat, Home } from "lucide-react";
import { useLanguage, LanguageSwitcher } from "@/hooks/use-language";
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
  const { t, lang } = useLanguage();
  const { theme: fieldTheme, F } = useFieldTheme();
  const [location] = useLocation();
  const isFieldHome = location === "/field";
  const now = useClock();

  const locale = lang === "ko" ? "ko-KR" : lang === "es" ? "es-MX" : "en-US";
  const dateStr = now.toLocaleDateString(locale, {
    weekday: "short", year: "numeric", month: "long", day: "numeric",
  });
  const dateStrShort = now.toLocaleDateString(locale, { month: "short", day: "numeric" });
  const timeStr = now.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit", hour12: true });

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
          detail={
            <>
              <span
                className="tk-header-detail hidden sm:flex items-center gap-1.5 mt-1 whitespace-nowrap"
                style={{
                  color: F.accent,
                }}
              >
                <span className="fl-pulse-dot" style={{ width: 5, height: 5, borderRadius: "50%", background: F.accent }} />
                <HardHat style={{ width: 10, height: 10 }} />
                <span>{t.inventoryMode}</span>
                <span style={{ color: F.textDim, fontWeight: 400 }}>·</span>
                <span className="tk-header-detail-date" style={{ color: F.textDim }}>
                  {dateStr} · {timeStr}
                </span>
              </span>
              <span
                className="tk-header-detail flex sm:hidden items-center gap-1 mt-1 whitespace-nowrap"
                style={{
                  color: F.accent,
                }}
              >
                <HardHat style={{ width: 9, height: 9 }} />
                <span>{t.inventoryMode}</span>
                <span style={{ color: F.textDim, fontWeight: 400 }}>·</span>
                <span className="tk-header-detail-date" style={{ color: F.textDim }}>{dateStrShort}</span>
              </span>
            </>
          }
        />
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
                color: F.textMuted, fontSize: 12,
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 600, letterSpacing: 0.4,
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
              color: F.textMuted, fontSize: 12,
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 600, letterSpacing: 0.4,
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

      </div>
    </header>
  );
}
