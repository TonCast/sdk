import type {
  SupportedLanguage,
  ToncastWidgetConfig,
  ToncastWidgetCssVars,
  ToncastWidgetLayout,
} from "@toncast/widget-loader";
import { viteEnvTrimmed } from "./viteEnv";

type WidgetThemeArg = NonNullable<NonNullable<ToncastWidgetConfig["widget"]>["theme"]>;

/** Responsive grid for pari cards — tuned for the host main column. */
export const WIDGET_LAYOUT: ToncastWidgetLayout = {
  grid: { mobile: 1, tablet: 2, desktop: 3 },
};

/**
 * CSS custom properties on `:root` — canonical dual palette (see `host-tokens.css`).
 * This is the single source of truth for variable names; no fallback values live here.
 */
const PALETTE = {
  radius: "--tc-widget-palette-radius",
  dark: {
    accent: "--tc-widget-palette-dark-accent",
    bg: "--tc-widget-palette-dark-bg",
    success: "--tc-widget-palette-dark-success",
    danger: "--tc-widget-palette-dark-danger",
    warn: "--tc-widget-palette-dark-warn",
  },
  light: {
    accent: "--tc-widget-palette-light-accent",
    bg: "--tc-widget-palette-light-bg",
    success: "--tc-widget-palette-light-success",
    danger: "--tc-widget-palette-light-danger",
    warn: "--tc-widget-palette-light-warn",
  },
} as const;

function readCssVar(root: Element, name: string): string {
  return getComputedStyle(root).getPropertyValue(name).trim();
}

/**
 * Reads Toncast `widget.cssVars` directly from `:root` palette variables.
 * CSS is the single source of truth — no hardcoded fallback colours.
 * In DEV, warns once if any variable resolves to an empty string so that
 * misconfigured hosts are caught early.
 *
 * Result is cached at module level: `:root` palette vars are set by the host
 * stylesheet and never change at runtime, so repeated DOM reads are wasteful.
 */
let cssVarsCache: ToncastWidgetCssVars | null = null;

export function readToncastWidgetCssVarsFromDocument(
  root: Element = document.documentElement,
): ToncastWidgetCssVars {
  if (cssVarsCache) return cssVarsCache;

  const r = (name: string) => readCssVar(root, name);

  const vars: ToncastWidgetCssVars = {
    radius: r(PALETTE.radius),
    dark: {
      accent:  r(PALETTE.dark.accent),
      bg:      r(PALETTE.dark.bg),
      success: r(PALETTE.dark.success),
      danger:  r(PALETTE.dark.danger),
      warn:    r(PALETTE.dark.warn),
      density: "default",
    },
    light: {
      accent:  r(PALETTE.light.accent),
      bg:      r(PALETTE.light.bg),
      success: r(PALETTE.light.success),
      danger:  r(PALETTE.light.danger),
      warn:    r(PALETTE.light.warn),
      density: "default",
    },
  };

  if (import.meta.env.DEV) {
    const flat = [
      vars.radius,
      ...Object.values(vars.dark ?? {}),
      ...Object.values(vars.light ?? {}),
    ];
    if (flat.some((v) => v === "" || v === "default")) {
      console.warn(
        "[widgetEmbedChrome] Some --tc-widget-palette-* variables resolved to empty strings. " +
          "Ensure `src/styles/host.css` is loaded on the host root.",
      );
    }
  }

  cssVarsCache = vars;
  return vars;
}

/** Clears the CSS-vars cache — useful in tests or after dynamic stylesheet injection. */
export function resetCssVarsCache(): void {
  cssVarsCache = null;
}

const ALL_LANGUAGES = [
  "en",
  "ru",
  "hi",
  "es",
  "zh",
  "fr",
  "de",
  "pt",
  "fa",
  "ar",
] as const satisfies readonly SupportedLanguage[];

function parseWidgetLanguage(): SupportedLanguage {
  const raw = viteEnvTrimmed("VITE_WIDGET_LANGUAGE");
  if (!raw) return "en";
  const lower = raw.toLowerCase();
  return (ALL_LANGUAGES as readonly string[]).includes(lower)
    ? (lower as SupportedLanguage)
    : "en";
}

/**
 * Full host-controlled `widget` slice: theme, SSR snapshot, cssVars (from CSS palette),
 * layout, deriveCssVars, language(s), and render-error logging.
 */
export function buildHostWidgetOptions(
  theme: WidgetThemeArg,
  systemColorScheme: "light" | "dark",
): NonNullable<ToncastWidgetConfig["widget"]> {
  const ssrColorScheme =
    theme === "system" ? systemColorScheme : theme === "dark" ? "dark" : "light";

  return {
    theme,
    ssrColorScheme,
    cssVars: readToncastWidgetCssVarsFromDocument(),
    layout: WIDGET_LAYOUT,
    deriveCssVars: { colors: true, density: true },
    languages: [...ALL_LANGUAGES],
    language: parseWidgetLanguage(),
    onRenderError: (error, info) => {
      if (import.meta.env.DEV) {
        console.error("[ToncastBettingWidget] widget onRenderError:", error, info.componentStack);
      } else {
        // TODO: wire up your error tracker here, e.g.:
        // errorTracker?.captureException(error, { extra: { componentStack: info.componentStack } });
      }
    },
  };
}