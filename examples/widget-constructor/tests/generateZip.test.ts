import { describe, expect, it } from "vitest";
import { type ConstructorConfig, DEFAULT_CONFIG } from "../src/types";
import {
  buildIndexHtml,
  buildJsSnippet,
  buildReactSnippet,
  buildStyleCss,
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

  it("exports fixed grid columns as responsive max-columns", () => {
    const gridConfig = config({
      theme: {
        ...DEFAULT_CONFIG.theme,
        columns: 3,
      },
    });

    const snippet = buildJsSnippet(gridConfig);

    expect(snippet).toContain("repeat(auto-fit");
    expect(snippet).toContain("minmax(max(180px, calc((100% - 20px) / 3)), 1fr)");
    expect(snippet).not.toContain("repeat(3, 1fr)");
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
});
