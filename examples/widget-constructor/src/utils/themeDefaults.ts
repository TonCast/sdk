/** Canonical widget shell `--tc-bg` (`_tokens.css`). */
export const WIDGET_SHELL_BG = {
  light: "#ffffff",
  dark: "#0f172a",
} as const;

/** Host page mat behind the widget when shell `bg` is not customized. */
export const HOST_PAGE_BACKDROP = {
  light: "#f8fafc",
  dark: "#0f172a",
} as const;

/** Advanced fg / muted / border when shell bg uses stylesheet defaults (no derivation). */
export const WIDGET_ADVANCED_DEFAULTS = {
  light: { fg: "#1e293b", fgMuted: "#64748b", border: "#e2e8f0" },
  dark: { fg: "#e2e8f0", fgMuted: "#94a3b8", border: "#2d3f55" },
} as const;
