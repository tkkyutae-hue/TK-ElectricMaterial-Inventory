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

const CSS = `
.ls-trigger { cursor: pointer; transition: border-color 0.15s, color 0.15s, background 0.15s; }
.ls-trigger:hover { outline: none; }
.ls-opt { cursor: pointer; transition: background 0.1s; }
.ls-opt:focus { outline: none; }
`;

export function LanguageSwitcher({ theme = "dark" }: SwitcherProps) {
  const { lang, setLang } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = LANGUAGES.find(l => l.code === lang)!;
  const isDark = theme === "dark";

  // ── colour tokens ────────────────────────────────────────────────────────
  const triggerBg           = isDark ? "#162019"                    : "#f8fafc";
  const triggerBorder       = isDark ? "#2a4030"                    : "#e2e8f0";
  const triggerColor        = isDark ? "#7aab82"                    : "#64748b";
  const triggerHoverBg      = isDark ? "#1c2b1f"                    : "#f1f5f9";
  const triggerHoverBorder  = isDark ? "rgba(45,219,111,0.45)"      : "#94a3b8";
  const triggerHoverColor   = isDark ? "#2ddb6f"                    : "#334155";
  const dropdownBg          = isDark ? "#0f1612"                    : "#ffffff";
  const dropdownBorder      = isDark ? "#2a4030"                    : "#e2e8f0";
  const dropdownShadow      = isDark ? "0 16px 40px rgba(0,0,0,0.65)" : "0 8px 24px rgba(0,0,0,0.12)";
  const optBg               = isDark ? "transparent"                : "transparent";
  const optHoverBg          = isDark ? "#141e17"                    : "#f8fafc";
  const optColor            = isDark ? "#c8deca"                    : "#475569";
  const optMutedColor       = isDark ? "#4a7052"                    : "#94a3b8";
  const optActiveColor      = isDark ? "#2ddb6f"                    : "#0f766e";
  const optDivider          = isDark ? "rgba(42,64,48,0.55)"        : "#f1f5f9";

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    // Use capture phase so this fires before React synthetic events
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [open]);

  return (
    <>
      <style>{CSS}</style>
      <div
        ref={ref}
        style={{ position: "relative", flexShrink: 0, display: "inline-flex" }}
      >
        {/* ── Trigger button ─────────────────────────────────────────── */}
        <button
          type="button"
          className="ls-trigger"
          data-testid="btn-language-switcher"
          onClick={() => setOpen(o => !o)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 5,
            background: open ? triggerHoverBg : triggerBg,
            border: `1px solid ${open ? triggerHoverBorder : triggerBorder}`,
            borderRadius: 8,
            padding: "0 9px",
            height: 30,
            color: open ? triggerHoverColor : triggerColor,
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 700,
            fontSize: 11,
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            lineHeight: 1,
            whiteSpace: "nowrap",
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLButtonElement;
            if (!open) {
              el.style.background = triggerHoverBg;
              el.style.borderColor = triggerHoverBorder;
              el.style.color = triggerHoverColor;
            }
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLButtonElement;
            if (!open) {
              el.style.background = triggerBg;
              el.style.borderColor = triggerBorder;
              el.style.color = triggerColor;
            }
          }}
        >
          {/* Flag */}
          <span style={{ fontSize: 13, lineHeight: 1, display: "flex", alignItems: "center" }}>
            {current.flag}
          </span>
          {/* Country · Lang code */}
          <span style={{ lineHeight: 1 }}>{current.country}</span>
          <span style={{
            opacity: 0.55,
            fontWeight: 500,
            lineHeight: 1,
            fontSize: 10,
            letterSpacing: "0.05em",
          }}>
            {current.code.toUpperCase()}
          </span>
          {/* Chevron */}
          <svg
            width="8" height="5" viewBox="0 0 8 5" fill="none"
            style={{
              opacity: 0.5,
              flexShrink: 0,
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.15s",
              display: "block",
            }}
          >
            <path
              d="M1 1L4 4L7 1"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* ── Dropdown ───────────────────────────────────────────────── */}
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
              minWidth: 152,
              // NO overflow:hidden — it clips click hit-boxes
            }}
          >
            {LANGUAGES.map((l, idx) => {
              const isActive = l.code === lang;
              const isFirst = idx === 0;
              const isLast = idx === LANGUAGES.length - 1;
              return (
                <button
                  key={l.code}
                  type="button"
                  className="ls-opt"
                  data-testid={`lang-option-${l.code}`}
                  // onMouseDown fires before the outside-click handler,
                  // ensuring the selection registers even if focus moves away
                  onMouseDown={(e) => {
                    e.preventDefault(); // prevent focus loss triggering outside-click
                    setLang(l.code);
                    setOpen(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    padding: "10px 13px",
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
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = optHoverBg;
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = isActive
                      ? optHoverBg
                      : optBg;
                  }}
                >
                  {/* Flag */}
                  <span style={{ fontSize: 15, lineHeight: 1, flexShrink: 0 }}>{l.flag}</span>

                  {/* Country code */}
                  <span style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontWeight: 700,
                    fontSize: 11,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: isActive ? optActiveColor : optMutedColor,
                    flexShrink: 0,
                    lineHeight: 1,
                  }}>
                    {l.country}
                  </span>

                  {/* Language name */}
                  <span style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontWeight: isActive ? 700 : 500,
                    fontSize: 13,
                    color: isActive ? optActiveColor : optColor,
                    letterSpacing: "0.02em",
                    lineHeight: 1,
                    flex: 1,
                    minWidth: 0,
                  }}>
                    {l.label}
                  </span>

                  {/* Active checkmark */}
                  {isActive && (
                    <svg
                      width="12" height="9" viewBox="0 0 12 9" fill="none"
                      style={{ flexShrink: 0, color: optActiveColor }}
                    >
                      <path
                        d="M1 4L4.5 7.5L11 1"
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
    </>
  );
}
