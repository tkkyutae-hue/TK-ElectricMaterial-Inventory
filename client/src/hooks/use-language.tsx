import { createContext, useContext, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Lang, LANGUAGES, TRANSLATIONS, Translations } from "@/lib/i18n";
import { F_DARK, F_LIGHT } from "@/lib/fieldTokens";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  /** compact = reduce trigger height to match adjacent icon-button controls */
  compact?: boolean;
}

export function LanguageSwitcher({ theme = "dark", compact = false }: SwitcherProps) {
  const { lang, setLang } = useLanguage();
  const isDark = theme === "dark";

  const current = LANGUAGES.find(l => l.code === lang) ?? LANGUAGES[0];

  // compact = field mode (Login, Home, Signup, FieldHeader) → use F tokens
  // non-compact = admin mode → keep slate/admin palette
  const FT = isDark ? F_DARK : F_LIGHT;

  const triggerBg          = compact ? FT.surface2          : (isDark ? "#162019" : "#f1f5f9");
  const triggerBorder      = compact ? FT.borderStrong      : (isDark ? "#2a4030" : "#e2e8f0");
  const triggerColor       = compact ? FT.textMuted         : (isDark ? "#c8deca" : "#0f172a");
  const triggerHoverBorder = compact ? FT.accentBorder      : (isDark ? "rgba(45,219,111,0.40)" : "#cbd5e1");
  const chevronColor       = compact ? FT.textDim           : (isDark ? "#4a7052" : "#94a3b8");

  const itemActiveBg    = compact ? FT.accentBg   : (isDark ? "rgba(45,219,111,0.12)" : "#f0fdf4");
  const itemActiveColor = compact ? FT.accent      : (isDark ? "#2ddb6f"              : "#0f766e");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-testid="btn-language-switcher"
          aria-label={`Language: ${current.label}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: compact ? 5 : 6,
            height: compact ? 32 : undefined,
            background: triggerBg,
            border: `1px solid ${triggerBorder}`,
            borderRadius: 8,
            padding: compact ? "0 8px 0 9px" : "5px 9px 5px 10px",
            color: triggerColor,
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 600,
            fontSize: 11,
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            cursor: "pointer",
            transition: "border-color 0.15s, background 0.15s",
            lineHeight: 1,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = triggerHoverBorder;
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = triggerBorder;
          }}
        >
          <span>{current.label}</span>
          <ChevronDown
            style={{ width: 11, height: 11, color: chevronColor, flexShrink: 0 }}
            aria-hidden="true"
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="min-w-[160px] p-1"
        style={
          isDark
            ? {
                background: "#0f1812",
                border: "1px solid #2a4030",
                color: "#c8deca",
              }
            : undefined
        }
      >
        {LANGUAGES.map(l => {
          const isActive = l.code === lang;
          return (
            <DropdownMenuItem
              key={l.code}
              data-testid={`lang-option-${l.code}`}
              onSelect={() => setLang(l.code)}
              className="flex items-center gap-2 cursor-pointer"
              style={{
                background: isActive ? itemActiveBg : undefined,
                color: isActive ? itemActiveColor : (isDark ? "#c8deca" : undefined),
                fontWeight: isActive ? 600 : 500,
              }}
            >
              <span
                style={{
                  flex: 1,
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 12,
                  letterSpacing: "0.04em",
                }}
              >
                {l.label}
              </span>
              {isActive && (
                <Check style={{ width: 14, height: 14, color: itemActiveColor }} />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
