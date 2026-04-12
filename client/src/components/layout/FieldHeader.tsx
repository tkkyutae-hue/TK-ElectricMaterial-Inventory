import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, HardHat, Home } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage, LanguageSwitcher } from "@/hooks/use-language";
import { F } from "@/lib/fieldTokens";

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
  const [location] = useLocation();
  const isFieldHome = location === "/field";
  const now = useClock();

  const dateStr      = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const dateStrShort = now.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

  return (
    <header
      className="px-3 sm:px-5"
      style={{
        position: "relative", zIndex: 50, flexShrink: 0,
        minHeight: 52,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: 0,
        background: F.bg,
        borderBottom: `1px solid ${F.borderStrong}`,
      }}
    >
      {/* Left side */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>

        {/* TK lettermark */}
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 36,
          lineHeight: 1, letterSpacing: 1, display: "flex", gap: 0 }}>
          <span style={{ color: "transparent",
            WebkitTextStroke: "1.4px rgba(255,255,255,0.85)" }}>T</span>
          <span className="fl-k" style={{ color: "transparent",
            WebkitTextStroke: `1.4px ${F.accent}`,
            filter: "drop-shadow(0 0 8px rgba(45,219,111,0.65)) drop-shadow(0 0 3px rgba(45,219,111,0.4))" }}>K</span>
        </div>

        {/* Field Mode chip */}
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "rgba(45,219,111,0.08)",
          border: "1px solid rgba(45,219,111,0.22)",
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
          <span className="sm:hidden">{dateStrShort}</span>
          <span className="hidden sm:inline">{dateStr}</span>
          <span style={{ opacity: 0.5 }}>·</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{timeStr}</span>
        </div>
      </div>

      {/* Right side */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>

        <LanguageSwitcher theme="dark" compact={true} />

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
                background: F.surface2, border: `1px solid ${F.borderStrong}`,
                borderRadius: 8, padding: "5px 10px",
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
              background: F.surface2, border: `1px solid ${F.borderStrong}`,
              borderRadius: 8, padding: "5px 10px",
              color: F.textMuted, fontSize: 11,
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 600, letterSpacing: 0.5,
              cursor: "pointer", transition: "border-color 0.15s, color 0.15s",
              textTransform: "uppercase",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.color = "#c8deca";
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
          width: 28, height: 28, borderRadius: "50%",
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
