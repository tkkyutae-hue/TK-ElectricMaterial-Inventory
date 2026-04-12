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
  /** compact = reduce button height to match adjacent icon-button controls */
  compact?: boolean;
}

export function LanguageSwitcher({ theme = "dark", compact = false }: SwitcherProps) {
  const { lang, setLang } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = LANGUAGES.find(l => l.code === lang)!;
  const isDark = theme === "dark";

  // ── colour tokens ────────────────────────────────────────────────────────
  const triggerBg          = isDark ? "#162019"                    : "#f8fafc";
  const triggerBorder      = isDark ? "#2a4030"                    : "#e2e8f0";
  const triggerColor       = isDark ? "#7aab82"                    : "#64748b";
  const triggerActiveBg    = isDark ? "#1c2b1f"                    : "#f1f5f9";
  const triggerActiveBorder= isDark ? "rgba(45,219,111,0.45)"      : "#94a3b8";
  const triggerActiveColor = isDark ? "#2ddb6f"                    : "#334155";
  const dropdownBg         = isDark ? "#0f1612"                    : "#ffffff";
  const dropdownBorder     = isDark ? "#2a4030"                    : "#e2e8f0";
  const dropdownShadow     = isDark
    ? "0 16px 40px rgba(0,0,0,0.65)"
    : "0 8px 24px rgba(0,0,0,0.12)";
  const optBg              = "transparent";
  const optHoverBg         = isDark ? "#141e17"                    : "#f8fafc";
  const optCountryColor    = isDark ? "#4a7052"                    : "#94a3b8";
  const optLabelColor      = isDark ? "#c8deca"                    : "#475569";
  const optActiveCountry   = isDark ? "rgba(45,219,111,0.6)"       : "#5eead4";
  const optActiveLabel     = isDark ? "#2ddb6f"                    : "#0f766e";
  const optDivider         = isDark ? "rgba(42,64,48,0.55)"        : "#f1f5f9";

  // ── close on outside click ───────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    // capture phase: fires before any child synthetic events
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [open]);

  // ── trigger label: "US EN" / "KR KO" / "MX ES" ──────────────────────────
  const triggerLabel = `${current.country}\u00A0${current.code.toUpperCase()}`;

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0, display: "inline-flex" }}>

      {/* ── Trigger button ─────────────────────────────────────────────── */}
      <button
        type="button"
        data-testid="btn-language-switcher"
        onClick={() => setOpen(o => !o)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          ...(compact ? { padding: "5px 8px" } : { height: 30, padding: "0 10px" }),
          background: open ? triggerActiveBg : triggerBg,
          border: `1px solid ${open ? triggerActiveBorder : triggerBorder}`,
          borderRadius: 8,
          color: open ? triggerActiveColor : triggerColor,
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 700,
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
          cursor: "pointer",
          transition: "border-color 0.15s, color 0.15s, background 0.15s",
          lineHeight: 1,
        }}
        onMouseEnter={e => {
          if (!open) {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.background = triggerActiveBg;
            el.style.borderColor = triggerActiveBorder;
            el.style.color = triggerActiveColor;
          }
        }}
        onMouseLeave={e => {
          if (!open) {
            const el = e.currentTarget as HTMLButtonElement;
            el.style.background = triggerBg;
            el.style.borderColor = triggerBorder;
            el.style.color = triggerColor;
          }
        }}
      >
        {/* Mobile: flag emoji only; Desktop: "US EN" */}
        <span className="sm:hidden" style={{ fontSize: 15, lineHeight: 1 }}>{current.flag}</span>
        <span className="hidden sm:inline" style={{ lineHeight: 1 }}>{triggerLabel}</span>

        {/* Chevron — hidden on mobile to keep flag button minimal */}
        <svg
          width="8" height="5" viewBox="0 0 8 5" fill="none"
          className="hidden sm:block"
          style={{
            flexShrink: 0,
            opacity: 0.55,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.15s",
          }}
        >
          <path
            d="M1 1L4 4L7 1"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* ── Dropdown ───────────────────────────────────────────────────── */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 99999,
            background: dropdownBg,
            border: `1px solid ${dropdownBorder}`,
            borderRadius: 10,
            boxShadow: dropdownShadow,
            minWidth: 148,
            // no overflow:hidden — it clips click hit-boxes on rounded corners
          }}
        >
          {LANGUAGES.map((l, idx) => {
            const isActive = l.code === lang;
            const isFirst  = idx === 0;
            const isLast   = idx === LANGUAGES.length - 1;

            return (
              <button
                key={l.code}
                type="button"
                data-testid={`lang-option-${l.code}`}
                /*
                 * onMouseDown fires BEFORE the outside-click handler and before
                 * any focus-blur cycle, so the selection always registers even
                 * if the dropdown is about to close.
                 * e.preventDefault() stops the button from stealing focus,
                 * which would otherwise trigger outside-click prematurely.
                 */
                onMouseDown={e => {
                  e.preventDefault();
                  setLang(l.code);
                  setOpen(false);
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.background = optHoverBg;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    isActive ? optHoverBg : optBg;
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0,
                  width: "100%",
                  padding: "10px 14px",
                  background: isActive ? optHoverBg : optBg,
                  border: "none",
                  borderBottom: isLast ? "none" : `1px solid ${optDivider}`,
                  borderRadius: isFirst
                    ? "10px 10px 0 0"
                    : isLast
                    ? "0 0 10px 10px"
                    : "0",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                {/* Country code — fixed 28px width for column alignment */}
                <span style={{
                  width: 28,
                  flexShrink: 0,
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 700,
                  fontSize: 11,
                  letterSpacing: "0.09em",
                  textTransform: "uppercase",
                  color: isActive ? optActiveCountry : optCountryColor,
                  lineHeight: 1,
                }}>
                  {l.country}
                </span>

                {/* Language name */}
                <span style={{
                  flex: 1,
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: isActive ? 700 : 500,
                  fontSize: 13,
                  letterSpacing: "0.02em",
                  color: isActive ? optActiveLabel : optLabelColor,
                  lineHeight: 1,
                }}>
                  {l.label}
                </span>

                {/* Checkmark for active selection */}
                {isActive && (
                  <svg
                    width="11" height="8" viewBox="0 0 11 8" fill="none"
                    style={{ flexShrink: 0, marginLeft: 8, color: optActiveLabel }}
                  >
                    <path
                      d="M1 4L3.8 7L10 1"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
