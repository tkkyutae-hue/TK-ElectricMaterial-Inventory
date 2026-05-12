import { useEffect } from "react";
import { useFieldTheme } from "@/hooks/use-field-theme";
import { FieldCartProvider } from "@/lib/fieldCart";
import { FieldHeader } from "./FieldHeader";

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
.fl-outer     { height: 100vh; }
@supports (height: 100dvh) { .fl-outer { height: 100dvh; } }
@media (max-width: 767px) {
  /* Icon-only header buttons: tighter horizontal padding */
  .fl-hdr-btn { padding: 5px 7px !important; }
  /* Chip text hidden on mobile — reinforces hidden-mobile from index.css */
  .hidden-mobile { display: none !important; }
  /* Main scroll area: hide scrollbar on mobile; touch handles scrolling natively */
  .fl-outer > main { -ms-overflow-style: none; scrollbar-width: none; }
  .fl-outer > main::-webkit-scrollbar { display: none; }
}
`;

function FieldLayoutInner({ children }: { children: React.ReactNode }) {
  const { theme, F } = useFieldTheme();

  useEffect(() => {
    document.body.dataset.fieldMode = "true";
    return () => {
      delete document.body.dataset.fieldMode;
    };
  }, []);

  const isDark = theme === "dark";

  const gridColor = isDark
    ? "rgba(45,219,111,0.05)"
    : "rgba(28,168,78,0.06)";

  const glowColor = isDark
    ? "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(45,219,111,0.10) 0%, transparent 65%)"
    : "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(28,168,78,0.06) 0%, transparent 65%)";

  return (
    <div
      className="fl-outer"
      style={{
        display: "flex", flexDirection: "column",
        background: F.bg,
        position: "relative", overflow: "hidden",
        fontFamily: "'Barlow', sans-serif",
        transition: "background 0.2s",
      }}
    >
      <style>{CSS}</style>

      {/* Grid texture */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: `linear-gradient(${gridColor} 1px, transparent 1px), linear-gradient(90deg, ${gridColor} 1px, transparent 1px)`,
        backgroundSize: "52px 52px",
      }} />

      {/* Radial glow */}
      <div style={{
        position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", height: "55vh", pointerEvents: "none", zIndex: 0,
        background: glowColor,
      }} />

      {/* ── Top header ── */}
      <FieldHeader />

      {/* Main content */}
      <main
        className="relative"
        style={{
          zIndex: 10, flex: 1, minHeight: 0,
          overflowY: "auto", overflowX: "hidden",
          display: "flex", flexDirection: "column",
          background: F.bg,
          transition: "background 0.2s",
        }}
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
  );
}

export function FieldLayout({ children }: { children: React.ReactNode }) {
  return (
    <FieldCartProvider>
      <FieldLayoutInner>{children}</FieldLayoutInner>
    </FieldCartProvider>
  );
}
