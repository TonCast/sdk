import { parseHexColor, relativeLuminance } from "@toncast/widget/color-math";

export type ContrastLevel = "pass" | "warn" | "fail";

export interface AccentContrastCheck {
  ratio: number | null;
  level: ContrastLevel;
  /** Foreground used for the check (accent or derived readable on bg). */
  fgHex: string | null;
}

/** WCAG 2.1 contrast ratio (lighter / darker + 0.05). */
export function contrastRatio(fg: string, bg: string): number | null {
  const fgRgb = parseHexColor(fg);
  const bgRgb = parseHexColor(bg);
  if (!fgRgb || !bgRgb) return null;
  const l1 = relativeLuminance(fgRgb);
  const l2 = relativeLuminance(bgRgb);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function levelFromRatio(ratio: number): ContrastLevel {
  if (ratio >= 4.5) return "pass";
  if (ratio >= 3) return "warn";
  return "fail";
}

/**
 * Checks accent (or readable-on-bg fallback) against shell background for normal text (AA 4.5:1).
 */
export function checkAccentOnBg(accent: string, bg: string): AccentContrastCheck {
  const accentHex = accent.trim();
  const bgHex = bg.trim();
  if (!accentHex || !bgHex) {
    return { ratio: null, level: "pass", fgHex: null };
  }
  const ratio = contrastRatio(accentHex, bgHex);
  if (ratio === null) return { ratio: null, level: "pass", fgHex: accentHex };
  return { ratio, level: levelFromRatio(ratio), fgHex: accentHex };
}
