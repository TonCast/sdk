import type { CSSProperties } from "react";
import type {
  ToncastWidgetConfig,
  ToncastWidgetCssVars,
  ToncastWidgetCssVarsBase,
  ToncastWidgetDensity,
  ToncastWidgetDerivedCssVarsOptions,
} from "../types";

type StyleVars = Record<string, string>;
type DeriveOptions = NonNullable<ToncastWidgetConfig["widget"]>["deriveCssVars"];

const DENSITY_PRESETS: Record<
  ToncastWidgetDensity,
  Pick<
    ToncastWidgetCssVarsBase,
    | "contentPadding"
    | "cardPadding"
    | "cardGap"
    | "formGap"
    | "headerPaddingY"
    | "headerPaddingX"
    | "navPaddingY"
  >
> = {
  compact: {
    contentPadding: "10px",
    cardPadding: "10px",
    cardGap: "8px",
    formGap: "10px",
    headerPaddingY: "6px",
    headerPaddingX: "10px",
    navPaddingY: "7px",
  },
  default: {
    contentPadding: "12px",
    cardPadding: "14px",
    cardGap: "10px",
    formGap: "12px",
    headerPaddingY: "8px",
    headerPaddingX: "12px",
    navPaddingY: "10px",
  },
  comfortable: {
    contentPadding: "16px",
    cardPadding: "18px",
    cardGap: "14px",
    formGap: "16px",
    headerPaddingY: "10px",
    headerPaddingX: "16px",
    navPaddingY: "12px",
  },
};

function deriveEnabled(options: DeriveOptions, key: keyof ToncastWidgetDerivedCssVarsOptions) {
  if (options === false) return false;
  if (options === true || options === undefined) return true;
  return options[key] !== false;
}

function parseHexColor(value: string): [number, number, number] | null {
  const hex = value.trim();
  const short = /^#([\da-fA-F])([\da-fA-F])([\da-fA-F])$/.exec(hex);
  if (short) {
    return [
      Number.parseInt(`${short[1]}${short[1]}`, 16),
      Number.parseInt(`${short[2]}${short[2]}`, 16),
      Number.parseInt(`${short[3]}${short[3]}`, 16),
    ];
  }

  const full = /^#([\da-fA-F]{2})([\da-fA-F]{2})([\da-fA-F]{2})$/.exec(hex);
  if (!full) return null;
  return [
    Number.parseInt(full[1] ?? "0", 16),
    Number.parseInt(full[2] ?? "0", 16),
    Number.parseInt(full[3] ?? "0", 16),
  ];
}

function rgba(value: string, alpha: number): string | null {
  const rgb = parseHexColor(value);
  if (!rgb) return null;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const [rs, gs, bs] = [r, g, b].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function isLightColor(value: string): boolean {
  const rgb = parseHexColor(value);
  if (!rgb) return false;
  return relativeLuminance(rgb) > 0.55;
}

function readableFg(value: string, lightFg = "#0f172a", darkFg = "#ffffff"): string | null {
  const rgb = parseHexColor(value);
  if (!rgb) return null;
  return relativeLuminance(rgb) > 0.55 ? lightFg : darkFg;
}

function mix(value: string, target: [number, number, number], weight: number): string | null {
  const rgb = parseHexColor(value);
  if (!rgb) return null;
  const mixed = rgb.map((channel, i) => {
    const targetChannel = target[i] ?? 0;
    return Math.round(channel * (1 - weight) + targetChannel * weight);
  });
  return `#${mixed.map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

function put(style: StyleVars, name: string, value: string | undefined): void {
  if (value !== undefined && value !== "") style[name] = value;
}

function putIfMissing(style: StyleVars, name: string, value: string | null | undefined): void {
  if (style[name] === undefined && value !== undefined && value !== null && value !== "") {
    style[name] = value;
  }
}

function deriveColorFamily(
  style: StyleVars,
  source: string | undefined,
  vars: {
    fg: string;
    bg: string;
    border?: string;
    hoverBg?: string;
    activeBg?: string;
    activeBorder?: string;
    activeShadow?: string;
    fillBg?: string;
  },
  theme: "light" | "dark",
): void {
  if (!source) return;

  const textMixTarget: [number, number, number] = theme === "dark" ? [255, 255, 255] : [0, 0, 0];
  const textWeight = theme === "dark" ? 0.18 : 0.2;
  const shadowColor = rgba(source, 0.35);

  putIfMissing(style, vars.fg, mix(source, textMixTarget, textWeight));
  putIfMissing(style, vars.bg, rgba(source, theme === "dark" ? 0.16 : 0.1));
  if (vars.border) putIfMissing(style, vars.border, rgba(source, theme === "dark" ? 0.34 : 0.25));
  if (vars.hoverBg) {
    putIfMissing(style, vars.hoverBg, rgba(source, theme === "dark" ? 0.24 : 0.18));
  }
  if (vars.activeBg) {
    putIfMissing(style, vars.activeBg, rgba(source, theme === "dark" ? 0.3 : 0.22));
  }
  if (vars.activeBorder) putIfMissing(style, vars.activeBorder, rgba(source, 0.4));
  if (vars.activeShadow && shadowColor) {
    putIfMissing(style, vars.activeShadow, `0 4px 12px -4px ${shadowColor}`);
  }
  if (vars.fillBg) {
    putIfMissing(style, vars.fillBg, rgba(source, theme === "dark" ? 0.44 : 0.35));
  }
}

function applyDirectVars(vars: ToncastWidgetCssVarsBase, style: StyleVars): void {
  put(style, "--tc-accent", vars.accent);
  put(style, "--tc-accent-fg", vars.accentFg);
  put(style, "--tc-accent-bg", vars.accentBg);
  put(style, "--tc-accent-hover", vars.accentHover);
  put(style, "--tc-accent-shadow", vars.accentShadow);
  put(style, "--tc-bg", vars.bg);
  put(style, "--tc-bg-chrome", vars.bgChrome);
  put(style, "--tc-bg-card", vars.bgCard);
  put(style, "--tc-bg-muted", vars.bgMuted);
  put(style, "--tc-bg-hover", vars.bgHover);
  put(style, "--tc-fg", vars.fg);
  put(style, "--tc-fg-muted", vars.fgMuted);
  put(style, "--tc-border", vars.border);
  put(style, "--tc-radius", vars.radius);
  put(style, "--tc-grid-cols", vars.gridCols);

  put(style, "--tc-success", vars.success);
  put(style, "--tc-success-fg", vars.successFg);
  put(style, "--tc-success-bg", vars.successBg);
  put(style, "--tc-success-border", vars.successBorder);
  put(style, "--tc-success-hover-bg", vars.successHoverBg);
  put(style, "--tc-success-active-bg", vars.successActiveBg);
  put(style, "--tc-success-active-border", vars.successActiveBorder);
  put(style, "--tc-success-active-shadow", vars.successActiveShadow);
  put(style, "--tc-success-fill-bg", vars.successFillBg);

  put(style, "--tc-danger", vars.danger);
  put(style, "--tc-danger-fg", vars.dangerFg);
  put(style, "--tc-danger-bg", vars.dangerBg);
  put(style, "--tc-danger-border", vars.dangerBorder);
  put(style, "--tc-danger-hover-bg", vars.dangerHoverBg);
  put(style, "--tc-danger-active-bg", vars.dangerActiveBg);
  put(style, "--tc-danger-active-border", vars.dangerActiveBorder);
  put(style, "--tc-danger-active-shadow", vars.dangerActiveShadow);
  put(style, "--tc-danger-fill-bg", vars.dangerFillBg);

  put(style, "--tc-warn", vars.warn);
  put(style, "--tc-warn-fg", vars.warnFg);
  put(style, "--tc-warn-bg", vars.warnBg);
  put(style, "--tc-warn-border", vars.warnBorder);

  put(style, "--tc-content-padding", vars.contentPadding);
  put(style, "--tc-card-padding", vars.cardPadding);
  put(style, "--tc-card-gap", vars.cardGap);
  put(style, "--tc-form-gap", vars.formGap);
  put(style, "--tc-header-padding-y", vars.headerPaddingY);
  put(style, "--tc-header-padding-x", vars.headerPaddingX);
  put(style, "--tc-nav-padding-y", vars.navPaddingY);
}

function applyDerivedVars(
  vars: ToncastWidgetCssVarsBase,
  style: StyleVars,
  effectiveTheme: "light" | "dark",
  deriveCssVars: DeriveOptions,
): void {
  if (deriveEnabled(deriveCssVars, "colors")) {
    if (vars.accent) {
      putIfMissing(style, "--tc-accent-fg", readableFg(vars.accent));
      putIfMissing(
        style,
        "--tc-accent-bg",
        rgba(vars.accent, effectiveTheme === "dark" ? 0.18 : 0.1),
      );
      putIfMissing(style, "--tc-accent-hover", mix(vars.accent, [0, 0, 0], 0.1));
      const accentShadow = rgba(vars.accent, 0.55);
      if (accentShadow)
        putIfMissing(style, "--tc-accent-shadow", `0 8px 24px -8px ${accentShadow}`);
    }
    if (vars.bg) {
      const fg = readableFg(vars.bg);
      if (fg) {
        const darkBg = !isLightColor(vars.bg);
        const surfaceTarget: [number, number, number] = darkBg ? [255, 255, 255] : [15, 23, 42];
        putIfMissing(style, "--tc-fg", fg);
        putIfMissing(style, "--tc-fg-muted", mix(fg, parseHexColor(vars.bg) ?? [0, 0, 0], 0.38));
        putIfMissing(style, "--tc-bg-chrome", mix(vars.bg, surfaceTarget, darkBg ? 0.1 : 0.04));
        putIfMissing(style, "--tc-bg-card", mix(vars.bg, surfaceTarget, darkBg ? 0.08 : 0.025));
        putIfMissing(style, "--tc-bg-muted", mix(vars.bg, surfaceTarget, darkBg ? 0.12 : 0.06));
        putIfMissing(style, "--tc-border", rgba(fg, darkBg ? 0.16 : 0.12));
        putIfMissing(style, "--tc-bg-hover", rgba(fg, darkBg ? 0.08 : 0.04));
      }
    }
    deriveColorFamily(
      style,
      vars.success,
      {
        fg: "--tc-success-fg",
        bg: "--tc-success-bg",
        border: "--tc-success-border",
        hoverBg: "--tc-success-hover-bg",
        activeBg: "--tc-success-active-bg",
        activeBorder: "--tc-success-active-border",
        activeShadow: "--tc-success-active-shadow",
        fillBg: "--tc-success-fill-bg",
      },
      effectiveTheme,
    );
    deriveColorFamily(
      style,
      vars.danger,
      {
        fg: "--tc-danger-fg",
        bg: "--tc-danger-bg",
        border: "--tc-danger-border",
        hoverBg: "--tc-danger-hover-bg",
        activeBg: "--tc-danger-active-bg",
        activeBorder: "--tc-danger-active-border",
        activeShadow: "--tc-danger-active-shadow",
        fillBg: "--tc-danger-fill-bg",
      },
      effectiveTheme,
    );
    deriveColorFamily(
      style,
      vars.warn,
      {
        fg: "--tc-warn-fg",
        bg: "--tc-warn-bg",
        border: "--tc-warn-border",
      },
      effectiveTheme,
    );
  }

  if (deriveEnabled(deriveCssVars, "density") && vars.density) {
    applyDirectVars(DENSITY_PRESETS[vars.density], style);
  }
}

function applyVarsBase(
  vars: ToncastWidgetCssVarsBase,
  style: StyleVars,
  effectiveTheme: "light" | "dark",
  deriveCssVars: DeriveOptions,
): void {
  applyDerivedVars(vars, style, effectiveTheme, deriveCssVars);
  applyDirectVars(vars, style);
}

export function buildCssVarStyle(
  vars: ToncastWidgetCssVars | undefined,
  effectiveTheme: "light" | "dark",
  deriveCssVars: DeriveOptions,
): CSSProperties | undefined {
  if (!vars) return undefined;

  const style: StyleVars = {};
  applyVarsBase(vars, style, effectiveTheme, deriveCssVars);

  const themeOverrides = effectiveTheme === "dark" ? vars.dark : vars.light;
  if (themeOverrides) applyVarsBase(themeOverrides, style, effectiveTheme, deriveCssVars);

  return Object.keys(style).length ? (style as CSSProperties) : undefined;
}
