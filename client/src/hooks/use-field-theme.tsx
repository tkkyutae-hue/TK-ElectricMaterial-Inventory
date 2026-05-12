/**
 * useFieldTheme — Field Mode dark / light theme context
 *
 * Provides:
 *   - FieldThemeProvider  — wrap FieldLayout with this
 *   - useFieldTheme()     — returns { theme, setTheme, F } (F is the live token set)
 *   - FieldThemeSwitcher  — sun/moon toggle button for the Field header
 *
 * localStorage key: voltstock_field_theme
 * Default: "dark"
 */

import { createContext, useContext, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { F as FDark, FL as FLight, FieldToken, FieldTheme } from "@/lib/fieldTokens";

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
  /** compact = tighter padding to match adjacent header buttons */
  compact?: boolean;
}

export function FieldThemeSwitcher({ compact = false }: SwitcherProps) {
  const { theme, setTheme, F } = useFieldTheme();
  const isDark = theme === "dark";

  const pad = compact ? "5px 7px" : "5px 10px";

  return (
    <button
      type="button"
      data-testid="btn-field-theme-switcher"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
        background: F.surface2,
        border: `1px solid ${F.borderStrong}`,
        borderRadius: 8,
        padding: pad,
        color: F.textMuted,
        cursor: "pointer",
        transition: "border-color 0.15s, color 0.15s, background 0.15s",
        lineHeight: 1,
        flexShrink: 0,
      }}
      onMouseEnter={e => {
        const btn = e.currentTarget as HTMLButtonElement;
        btn.style.color = F.accent;
        btn.style.borderColor = F.accentBorder;
      }}
      onMouseLeave={e => {
        const btn = e.currentTarget as HTMLButtonElement;
        btn.style.color = F.textMuted;
        btn.style.borderColor = F.borderStrong;
      }}
    >
      {isDark
        ? <Sun  style={{ width: 13, height: 13 }} aria-hidden="true" />
        : <Moon style={{ width: 13, height: 13 }} aria-hidden="true" />
      }
    </button>
  );
}
