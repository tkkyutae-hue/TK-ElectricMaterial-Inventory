/**
 * useFieldTheme — Field Mode dark / light theme context
 *
 * Provides:
 *   - FieldThemeProvider  — wrap FieldLayout with this
 *   - useFieldTheme()     — returns { theme, setTheme, F } (F is the live token set)
 *   - FieldThemeSwitcher  — dropdown (Sun/Moon + chevron) matching LanguageSwitcher style
 *
 * localStorage key: voltstock_field_theme
 * Default: "dark"
 */

import { createContext, useContext, useState, useEffect } from "react";
import { Sun, Moon, Check, ChevronDown } from "lucide-react";
import { F as FDark, FL as FLight, FieldToken, FieldTheme } from "@/lib/fieldTokens";
import { useLanguage } from "@/hooks/use-language";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const LS_KEY = "voltstock_field_theme";

interface FieldThemeCtx {
  theme: FieldTheme;
  setTheme: (t: FieldTheme) => void;
  F: FieldToken;
}

const FieldThemeContext = createContext<FieldThemeCtx>({
  theme: "dark",
  setTheme: () => {},
  F: FDark,
});

export function FieldThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<FieldTheme>(() => {
    const stored = localStorage.getItem(LS_KEY);
    return stored === "light" ? "light" : "dark";
  });

  useEffect(() => {
    document.body.dataset.fieldTheme = theme;
    return () => {
      delete document.body.dataset.fieldTheme;
    };
  }, [theme]);

  function setTheme(t: FieldTheme) {
    setThemeState(t);
    localStorage.setItem(LS_KEY, t);
  }

  const tokens: FieldToken = theme === "light" ? FLight : FDark;

  return (
    <FieldThemeContext.Provider value={{ theme, setTheme, F: tokens }}>
      {children}
    </FieldThemeContext.Provider>
  );
}

export function useFieldTheme(): FieldThemeCtx {
  return useContext(FieldThemeContext);
}

// ── FieldThemeSwitcher ────────────────────────────────────────────────────────

interface SwitcherProps {
  compact?: boolean;
}

const THEME_OPTIONS: { value: FieldTheme; icon: typeof Sun }[] = [
  { value: "dark",  icon: Moon },
  { value: "light", icon: Sun  },
];

export function FieldThemeSwitcher({ compact = false }: SwitcherProps) {
  const { theme, setTheme, F } = useFieldTheme();
  const { t } = useLanguage();

  const isDark = theme === "dark";

  const triggerBg     = F.surface2;
  const triggerBorder = F.borderStrong;
  const triggerColor  = F.textMuted;
  const triggerHoverBorder = F.accentBorder;
  const chevronColor  = F.textDim;

  const pad = compact ? "4px 8px 4px 9px" : "5px 9px 5px 10px";

  const itemActiveBg    = F.accentBg;
  const itemActiveColor = F.accent;

  const CurrentIcon = isDark ? Moon : Sun;

  const labels: Record<FieldTheme, string> = {
    dark:  t.fieldThemeDark  ?? "Dark",
    light: t.fieldThemeLight ?? "Light",
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-testid="btn-field-theme-switcher"
          aria-label={`Theme: ${labels[theme]}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            background: triggerBg,
            border: `1px solid ${triggerBorder}`,
            borderRadius: 8,
            padding: pad,
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
          <CurrentIcon style={{ width: 13, height: 13, flexShrink: 0 }} aria-hidden="true" />
          <ChevronDown style={{ width: 11, height: 11, color: chevronColor, flexShrink: 0 }} aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="min-w-[120px] p-1"
        style={{
          background: isDark ? "#0f1812" : undefined,
          border: isDark ? "1px solid #2a4030" : undefined,
          color: isDark ? "#c8deca" : undefined,
        }}
      >
        {THEME_OPTIONS.map(opt => {
          const isActive = opt.value === theme;
          const Icon = opt.icon;
          return (
            <DropdownMenuItem
              key={opt.value}
              data-testid={`theme-option-${opt.value}`}
              onSelect={() => setTheme(opt.value)}
              className="flex items-center gap-2 cursor-pointer"
              style={{
                background: isActive ? itemActiveBg : undefined,
                color: isActive ? itemActiveColor : (isDark ? "#c8deca" : undefined),
                fontWeight: isActive ? 600 : 500,
              }}
            >
              <Icon style={{ width: 13, height: 13, flexShrink: 0 }} aria-hidden="true" />
              <span style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, letterSpacing: "0.05em" }}>
                {labels[opt.value]}
              </span>
              {isActive && (
                <Check style={{ width: 13, height: 13, color: itemActiveColor }} />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
