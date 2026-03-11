import { createContext, useContext, useState, useEffect, useRef } from "react";
import { Lang, LANGUAGES, TRANSLATIONS, Translations } from "@/lib/i18n";

const LS_KEY = "voltstock_lang";

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Translations;
}

const LanguageContext = createContext<LangCtx>({
  lang: "en",
  setLang: () => {},
  t: TRANSLATIONS.en,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const stored = localStorage.getItem(LS_KEY);
    return (stored === "en" || stored === "ko" || stored === "es") ? stored : "en";
  });

  function setLang(l: Lang) {
    setLangState(l);
    localStorage.setItem(LS_KEY, l);
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: TRANSLATIONS[lang] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

// ── Shared Language Switcher ─────────────────────────────────────────────────

interface SwitcherProps {
  /** "dark" = field/login/home dark bg | "light" = admin white bg */
  theme?: "dark" | "light";
}

export function LanguageSwitcher({ theme = "dark" }: SwitcherProps) {
  const { lang, setLang } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = LANGUAGES.find(l => l.code === lang)!;

  const isDark = theme === "dark";

  // colours
  const triggerBg    = isDark ? "#162019"                    : "transparent";
  const triggerBorder= isDark ? "#2a4030"                    : "#e2e8f0";
  const triggerColor = isDark ? "#7aab82"                    : "#64748b";
  const triggerHoverBorder = isDark ? "rgba(45,219,111,0.40)" : "#94a3b8";
  const triggerHoverColor  = isDark ? "#2ddb6f"               : "#334155";
  const dropdownBg   = isDark ? "#0f1612"                    : "#ffffff";
  const dropdownBorder = isDark ? "#2a4030"                  : "#e2e8f0";
  const optBg        = isDark ? "transparent"                : "transparent";
  const optHoverBg   = isDark ? "#141e17"                    : "#f8fafc";
  const optColor     = isDark ? "#c8deca"                    : "#334155";
  const optActiveColor = isDark ? "#2ddb6f"                  : "#0f766e";

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        data-testid="btn-language-switcher"
        onClick={() => setOpen(o => !o)}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = triggerHoverBorder;
          (e.currentTarget as HTMLButtonElement).style.color = triggerHoverColor;
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = triggerBorder;
          (e.currentTarget as HTMLButtonElement).style.color = triggerColor;
        }}
        style={{
          display: "flex", alignItems: "center", gap: 5,
          background: triggerBg,
          border: `1px solid ${open ? triggerHoverBorder : triggerBorder}`,
          borderRadius: 8,
          padding: "4px 9px",
          color: open ? triggerHoverColor : triggerColor,
          fontSize: 11,
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          cursor: "pointer",
          transition: "border-color 0.15s, color 0.15s",
          lineHeight: 1,
        }}
      >
        <span style={{ fontSize: 14, lineHeight: 1 }}>{current.flag}</span>
        <span>{current.code.toUpperCase()}</span>
        <svg
          width="8" height="5" viewBox="0 0 8 5" fill="none"
          style={{ opacity: 0.6, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}
        >
          <path d="M1 1L4 4L7 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0,
          background: dropdownBg,
          border: `1px solid ${dropdownBorder}`,
          borderRadius: 10,
          boxShadow: isDark ? "0 12px 32px rgba(0,0,0,0.55)" : "0 8px 24px rgba(0,0,0,0.10)",
          overflow: "hidden",
          zIndex: 9999,
          minWidth: 132,
        }}>
          {LANGUAGES.map((l, idx) => {
            const isActive = l.code === lang;
            const isLast = idx === LANGUAGES.length - 1;
            return (
              <button
                key={l.code}
                type="button"
                data-testid={`lang-option-${l.code}`}
                onClick={() => { setLang(l.code); setOpen(false); }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = optHoverBg; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = isActive ? optHoverBg : optBg; }}
                style={{
                  display: "flex", alignItems: "center", gap: 9,
                  width: "100%",
                  padding: "9px 12px",
                  background: isActive ? optHoverBg : optBg,
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  borderBottom: isLast ? "none" : (isDark ? "1px solid rgba(42,64,48,0.5)" : "1px solid #f1f5f9"),
                }}
              >
                <span style={{ fontSize: 15, lineHeight: 1 }}>{l.flag}</span>
                <span style={{
                  fontSize: 12,
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? optActiveColor : optColor,
                  letterSpacing: "0.02em",
                }}>{l.label}</span>
                {isActive && (
                  <span style={{ marginLeft: "auto", color: optActiveColor, fontSize: 12, lineHeight: 1 }}>✓</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
