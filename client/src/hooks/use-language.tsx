import { createContext, useContext, useState } from "react";
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
  /** compact = reduce button height to match adjacent icon-button controls */
  compact?: boolean;
}

export function LanguageSwitcher({ theme = "dark", compact = false }: SwitcherProps) {
  const { lang, setLang } = useLanguage();
  const isDark = theme === "dark";

  const trackBg     = isDark ? "#162019" : "#f1f5f9";
  const trackBorder = isDark ? "#2a4030" : "#e2e8f0";

  const activeBg     = isDark ? "rgba(45,219,111,0.15)" : "#ffffff";
  const activeBorder = isDark ? "rgba(45,219,111,0.40)" : "#cbd5e1";
  const activeColor  = isDark ? "#2ddb6f"               : "#0f766e";

  const inactiveColor    = isDark ? "#4a7052" : "#94a3b8";
  const inactiveHoverColor = isDark ? "#7aab82" : "#64748b";

  const pad = compact ? "3px 9px" : "4px 10px";

  return (
    <div
      data-testid="btn-language-switcher"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        background: trackBg,
        border: `1px solid ${trackBorder}`,
        borderRadius: 8,
        padding: 2,
        flexShrink: 0,
      }}
    >
      {LANGUAGES.map(l => {
        const isActive = l.code === lang;
        return (
          <button
            key={l.code}
            type="button"
            data-testid={`lang-option-${l.code}`}
            onClick={() => setLang(l.code)}
            style={{
              padding: pad,
              borderRadius: 6,
              border: isActive ? `1px solid ${activeBorder}` : "1px solid transparent",
              cursor: "pointer",
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: isActive ? 700 : 500,
              fontSize: 11,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              background: isActive ? activeBg : "transparent",
              color: isActive ? activeColor : inactiveColor,
              transition: "background 0.15s, color 0.15s, border-color 0.15s",
              lineHeight: 1,
              whiteSpace: "nowrap",
            }}
            onMouseEnter={e => {
              if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = inactiveHoverColor;
            }}
            onMouseLeave={e => {
              if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = inactiveColor;
            }}
          >
            <span className="sm:hidden">{l.country}</span>
            <span className="hidden sm:inline">{l.code.toUpperCase()}</span>
          </button>
        );
      })}
    </div>
  );
}
