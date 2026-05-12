import { describe, expect, it } from "vitest";
import { type ConstructorConfig, DEFAULT_CONFIG } from "../src/types";
import {
  buildCssVarsConfig,
  buildIndexHtml,
  buildJsSnippet,
  buildReactSnippet,
  buildStyleCss,
  previewBackdropFromConfig,
} from "../src/utils/generateZip";

function config(overrides: Partial<ConstructorConfig>): ConstructorConfig {
  return {
    ...DEFAULT_CONFIG,
    ...overrides,
    theme: {
      ...DEFAULT_CONFIG.theme,
      ...overrides.theme,
    },
  };
}

describe("widget export snippets", () => {
  it("keeps CDN JS-only and uses ZIP-local IIFE CSS in generated html", () => {
    const c = config({});
    const html = buildIndexHtml(c);
    expect(html).toContain('href="index.iife.css"');
    expect(html).toContain("data-toncast-widget-css");
    expect(html).not.toContain("https://widget.toncast.app/v0/index.iife.css");
    expect(html.indexOf("index.iife.css")).toBeLessThan(html.indexOf("index.iife.js"));

    const snippet = buildJsSnippet(c);
    expect(snippet).toContain("https://widget.toncast.app/v0/index.iife.js");
    expect(snippet).not.toContain("index.iife.css");
    expect(snippet).not.toContain("data-toncast-widget-css");
  });

  it("emits standalone Toncast API baseUrl when configured", () => {
    const c = config({ apiBaseUrl: "https://api.staging.toncast.test" });

    expect(buildIndexHtml(c)).toContain('"baseUrl": "https://api.staging.toncast.test"');
    expect(buildJsSnippet(c)).toContain('"baseUrl": "https://api.staging.toncast.test"');
  });

  it("does not emit raw script-closing tags from config values", () => {
    const maliciousConfig = config({
      domain: "https://safe.example/'</script><script>alert(1)</script>",
      appName: "Bad </script><script>alert(2)</script>",
      language: "en</script><script>alert(3)</script>",
      languages: ["en</script><script>alert(4)</script>"],
      referralAddress: "UQ_FAKE</script><script>alert(5)</script>",
      referralPct: 3,
      theme: {
        ...DEFAULT_CONFIG.theme,
        colorScheme: "light",
        radius: 12,
        light: {
          ...DEFAULT_CONFIG.theme.light,
          accent: "#0098ea</style><script>alert(6)</script>",
          bg: "#fff</style><script>alert(7)</script>",
        },
      },
    });

    expect(buildIndexHtml(maliciousConfig)).not.toContain("</script><script>");
    expect(buildIndexHtml(maliciousConfig)).not.toContain("</style><script>");
    expect(buildJsSnippet(maliciousConfig)).not.toContain("</script><script>");
    expect(buildReactSnippet(maliciousConfig)).not.toContain("</script><script>");
  });

  it("emits semantic source colors and density in widget cssVars", () => {
    const derivedConfig = config({
      theme: {
        ...DEFAULT_CONFIG.theme,
        density: "compact",
        light: {
          ...DEFAULT_CONFIG.theme.light,
          success: "#10b981",
          danger: "#ef4444",
          warn: "#f59e0b",
        },
      },
    });

    const snippet = buildJsSnippet(derivedConfig);

    expect(snippet).toContain('"density": "compact"');
    expect(snippet).toContain('"success": "#10b981"');
    expect(snippet).toContain('"danger": "#ef4444"');
    expect(snippet).toContain('"warn": "#f59e0b"');
    expect(snippet).not.toContain("successBg");
  });

  it("exports responsive grid columns through widget layout config", () => {
    const gridConfig = config({
      theme: {
        ...DEFAULT_CONFIG.theme,
        grid: {
          mobile: 1,
          tablet: 2,
          desktop: 4,
        },
      },
    });

    const snippet = buildJsSnippet(gridConfig);

    expect(snippet).toContain('"layout": {');
    expect(snippet).toContain('"grid": {');
    expect(snippet).toContain('"mobile": 1');
    expect(snippet).toContain('"tablet": 2');
    expect(snippet).toContain('"desktop": 4');
    expect(snippet).not.toContain("--tc-grid-cols");
    expect(snippet).not.toContain("gridCols");
  });

  it("does not emit removed grid CSS variables in style.css", () => {
    const gridConfig = config({
      theme: {
        ...DEFAULT_CONFIG.theme,
        grid: {
          mobile: 1,
          tablet: 2,
          desktop: 3,
        },
      },
    });

    const css = buildStyleCss(gridConfig);

    expect(css ?? "").not.toContain("--tc-grid-cols");
  });

  it("emits derived CSS-only variables for themed fills and chrome", () => {
    const themedConfig = config({
      theme: {
        ...DEFAULT_CONFIG.theme,
        colorScheme: "light",
        light: {
          ...DEFAULT_CONFIG.theme.light,
          accent: "#7c3aed",
          bg: "#f8fafc",
          success: "#10b981",
          danger: "#ef4444",
        },
      },
    });

    const css = buildStyleCss(themedConfig);

    expect(css).toContain("--tc-accent-bg");
    expect(css).toContain("--tc-accent-shadow");
    expect(css).toContain("--tc-bg-chrome");
    expect(css).toContain("--tc-success-fill-bg");
    expect(css).toContain("--tc-danger-fill-bg");
  });

  it("includes shell background in widget cssVars when set (dark mode)", () => {
    const c = config({
      theme: {
        ...DEFAULT_CONFIG.theme,
        colorScheme: "dark",
        dark: {
          ...DEFAULT_CONFIG.theme.dark,
          bg: "#1a1a2e",
        },
      },
    });
    expect(buildCssVarsConfig(c)).toMatchObject({ bg: "#1a1a2e" });
  });

  it("previewBackdropFromConfig follows optional shell colors", () => {
    const withDarkBg = config({
      theme: {
        ...DEFAULT_CONFIG.theme,
        colorScheme: "dark",
        dark: { ...DEFAULT_CONFIG.theme.dark, bg: "#2b1050" },
      },
    });
    expect(previewBackdropFromConfig(withDarkBg, false)).toBe("#2b1050");

    const system = config({
      theme: { ...DEFAULT_CONFIG.theme, colorScheme: "system" },
    });
    expect(previewBackdropFromConfig(system, false)).toBe("#f8fafc");
    expect(previewBackdropFromConfig(system, true)).toBe("#0f172a");
  });

  it("buildIndexHtml body background uses configured shell bg in dark mode", () => {
    const c = config({
      theme: {
        ...DEFAULT_CONFIG.theme,
        colorScheme: "dark",
        dark: { ...DEFAULT_CONFIG.theme.dark, bg: "#111827" },
      },
    });
    const html = buildIndexHtml(c);
    expect(html).toContain("background: #111827");
  });
});
