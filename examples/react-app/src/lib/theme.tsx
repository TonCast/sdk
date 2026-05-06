// Light/dark theme orchestration. Initial value reads OS preference
// (then localStorage for explicit user choice), and we mutate
// `documentElement.className` directly so Tailwind's `dark:` variants
// and our `:root` / `.dark` CSS-var blocks toggle in lockstep.
//
// The provider is intentionally no-op-rendering — it doesn't wrap
// children in any extra DOM. UI sugar (toggle button) lives in
// `ThemeToggle`.

import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";

export type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "toncast-demo-theme";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  // `color-scheme` lets the browser pick native form-control colors
  // (scrollbars, autofill, default `<input>` styling) that match the
  // theme — small detail, big polish.
  root.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const t = getInitialTheme();
    if (typeof document !== "undefined") applyTheme(t);
    return t;
  });

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    applyTheme(t);
    try {
      window.localStorage.setItem(STORAGE_KEY, t);
    } catch {
      // Silently swallow `QuotaExceededError` / private-mode rejections —
      // theme just won't persist across reloads in those edge cases.
    }
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  // Re-apply on mount in case of hydration mismatch (SSR fallback even
  // though this app is SPA — defensive hardening).
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
  return ctx;
}
