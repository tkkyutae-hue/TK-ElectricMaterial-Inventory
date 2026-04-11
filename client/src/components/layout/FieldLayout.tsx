import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, HardHat } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage, LanguageSwitcher } from "@/hooks/use-language";
import { F } from "@/lib/fieldTokens";
import { FieldCartProvider } from "@/lib/fieldCart";

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
.fl-pulse-dot { animation: fl-pulse-dot 2.5s ease-in-out infinite; }
.fl-k         { animation: fl-flicker 7s ease-in-out 3s infinite; }
`;

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export function FieldLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [location] = useLocation();
  const isFieldHome = location === "/field";
  const now = useClock();

  useEffect(() => {
    document.body.dataset.fieldMode = "true";
    return () => { delete document.body.dataset.fieldMode; };
  }, []);

  const dateStr = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

  return (
    <FieldCartProvider>
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: F.bg, position: "relative", overflow: "hidden", fontFamily: "'Barlow', sans-serif" }}>
      <style>{CSS}</style>

      {/* Grid texture */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: `linear-gradient(rgba(45,219,111,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(45,219,111,0.05) 1px, transparent 1px)`,
        backgroundSize: "52px 52px",
      }} />

      {/* Radial glow */}
      <div style={{
        position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", height: "55vh", pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(45,219,111,0.10) 0%, transparent 65%)",
      }} />

      {/* ── Top header ── */}
      <header style={{
        position: "relative", zIndex: 50, flexShrink: 0,
        minHeight: 52,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        paddingTop: "env(safe-area-inset-top)",
        paddingLeft: 20,
        paddingRight: 20,
        paddingBottom: 0,
        background: F.bg,
        borderBottom: `1px solid ${F.borderStrong}`,
      }}>

        {/* Left: TK lettermark + Field Mode chip + date/time */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>

          {/* TK lettermark */}
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 36, lineHeight: 1, letterSpacing: 1, display: "flex", gap: 0 }}>
            <span style={{ color: "transparent", WebkitTextStroke: "1.4px rgba(255,255,255,0.85)" }}>T</span>
            <span className="fl-k" style={{ color: "transparent", WebkitTextStroke: `1.4px ${F.accent}`, filter: "drop-shadow(0 0 8px rgba(45,219,111,0.65)) drop-shadow(0 0 3px rgba(45,219,111,0.4))" }}>K</span>
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
            <div className="fl-pulse-dot" style={{ width: 5, height: 5, borderRadius: "50%", background: F.accent, flexShrink: 0 }} />
            <HardHat style={{ width: 11, height: 11, flexShrink: 0 }} />
            <span>{t.fieldModeChip}</span>
          </div>

          {/* Date & Time */}
          <div className="hidden-mobile" style={{
            fontSize: 11, color: F.textDim,
            fontFamily: "'Barlow Condensed', sans-serif",
            letterSpacing: 0.5,
            display: "flex", gap: 4, alignItems: "center",
          }}>
            <span>{dateStr}</span>
            <span style={{ opacity: 0.5 }}>·</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{timeStr}</span>
          </div>
        </div>

        {/* Right: Language switcher + Back + Mode Select + Avatar */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>

          <LanguageSwitcher theme="dark" />

          {/* Back button — only on sub-pages */}
          {!isFieldHome && (
            <Link href="/field">
              <button
                data-testid="btn-field-back"
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2ddb6f] focus-visible:ring-offset-1 focus-visible:ring-offset-[#0d1410]"
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  background: F.surface2, border: `1px solid ${F.borderStrong}`,
                  borderRadius: 8, padding: "5px 11px",
                  color: F.textMuted, fontSize: 11,
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 600, letterSpacing: 0.5,
                  cursor: "pointer", transition: "border-color 0.15s, color 0.15s",
                  textTransform: "uppercase",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = F.accent; (e.currentTarget as HTMLButtonElement).style.borderColor = F.accentBorder; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = F.textMuted; (e.currentTarget as HTMLButtonElement).style.borderColor = F.borderStrong; }}
              >
                <ArrowLeft style={{ width: 11, height: 11 }} />
                <span>{t.back}</span>
              </button>
            </Link>
          )}

          {/* Mode Select button */}
          <Link href="/home">
            <button
              data-testid="btn-field-home"
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2ddb6f] focus-visible:ring-offset-1 focus-visible:ring-offset-[#0d1410]"
              style={{
                display: "flex", alignItems: "center", gap: 5,
                background: F.surface2, border: `1px solid ${F.borderStrong}`,
                borderRadius: 8, padding: "5px 11px",
                color: F.textMuted, fontSize: 11,
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 600, letterSpacing: 0.5,
                cursor: "pointer", transition: "border-color 0.15s, color 0.15s",
                textTransform: "uppercase",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#c8deca"; (e.currentTarget as HTMLButtonElement).style.borderColor = F.accentBorder; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = F.textMuted; (e.currentTarget as HTMLButtonElement).style.borderColor = F.borderStrong; }}
            >
              <span>{t.modeSelect}</span>
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
            <span style={{ fontSize: 11, fontWeight: 700, color: F.accent, fontFamily: "'Barlow Condensed', sans-serif" }}>
              {(user?.firstName?.[0] ?? user?.email?.[0] ?? "?").toUpperCase()}
            </span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main
        className="relative"
        style={{ zIndex: 10, flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", background: F.bg }}
      >
        <div
          className="px-4 sm:px-6"
          style={{
            flex: 1, display: "flex", flexDirection: "column", width: "100%",
            paddingBottom: "env(safe-area-inset-bottom)",
          }}
        >
          {children}
        </div>
      </main>
    </div>
    </FieldCartProvider>
  );
}
