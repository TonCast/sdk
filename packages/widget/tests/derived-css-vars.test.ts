import { describe, expect, it } from "vitest";
import { buildCssVarStyle } from "../src/theme/cssVars";

describe("buildCssVarStyle", () => {
  it("derives semantic color variables from concise source colors", () => {
    const style = buildCssVarStyle(
      {
        accent: "#7c3aed",
        success: "#10b981",
        danger: "#ef4444",
        warn: "#f59e0b",
      },
      "light",
      undefined,
    ) as Record<string, string>;

    expect(style["--tc-accent"]).toBe("#7c3aed");
    expect(style["--tc-accent-bg"]).toContain("rgba(");
    expect(style["--tc-accent-hover"]).toBeTruthy();
    expect(style["--tc-accent-shadow"]).toContain("rgba(");
    expect(style["--tc-success"]).toBe("#10b981");
    expect(style["--tc-success-fg"]).toBeTruthy();
    expect(style["--tc-success-bg"]).toContain("rgba(");
    expect(style["--tc-success-border"]).toContain("rgba(");
    expect(style["--tc-success-fill-bg"]).toContain("rgba(");
    expect(style["--tc-danger"]).toBe("#ef4444");
    expect(style["--tc-danger-bg"]).toContain("rgba(");
    expect(style["--tc-danger-border"]).toContain("rgba(");
    expect(style["--tc-danger-fill-bg"]).toContain("rgba(");
    expect(style["--tc-warn"]).toBe("#f59e0b");
    expect(style["--tc-warn-bg"]).toContain("rgba(");
    expect(style["--tc-warn-border"]).toContain("rgba(");
  });

  it("does not override explicit derived color targets", () => {
    const style = buildCssVarStyle(
      {
        success: "#10b981",
        successBg: "rgba(16, 185, 129, 0.07)",
        successFillBg: "rgba(16, 185, 129, 0.42)",
        light: {
          success: "#059669",
          successFg: "#064e3b",
        },
      },
      "light",
      undefined,
    ) as Record<string, string>;

    expect(style["--tc-success"]).toBe("#059669");
    expect(style["--tc-success-bg"]).toBe("rgba(16, 185, 129, 0.07)");
    expect(style["--tc-success-fill-bg"]).toBe("rgba(16, 185, 129, 0.42)");
    expect(style["--tc-success-fg"]).toBe("#064e3b");
  });

  it("derives readable accent foreground and surface colors from bg", () => {
    const style = buildCssVarStyle(
      {
        accent: "#f8fafc",
        bg: "#0b1020",
      },
      "light",
      undefined,
    ) as Record<string, string>;

    expect(style["--tc-accent-fg"]).toBe("#0f172a");
    expect(style["--tc-bg"]).toBe("#0b1020");
    expect(style["--tc-fg"]).toBe("#ffffff");
    expect(style["--tc-fg-muted"]).toBeTruthy();
    expect(style["--tc-bg-card"]).toBeTruthy();
    expect(style["--tc-bg-muted"]).toBeTruthy();
    expect(style["--tc-bg-chrome"]).toBeTruthy();
    expect(style["--tc-bg-chrome"]).not.toBe("#0b1020");
    expect(style["--tc-border"]).toContain("rgba(");
    expect(style["--tc-bg-hover"]).toContain("rgba(");
  });

  it("keeps explicit text and surface variables when deriving from bg", () => {
    const style = buildCssVarStyle(
      {
        bg: "#0b1020",
        fg: "#f5f5dc",
        bgCard: "#111827",
        border: "#334155",
      },
      "light",
      undefined,
    ) as Record<string, string>;

    expect(style["--tc-fg"]).toBe("#f5f5dc");
    expect(style["--tc-bg-card"]).toBe("#111827");
    expect(style["--tc-border"]).toBe("#334155");
  });

  it("supports turning color derivation off while keeping direct variables", () => {
    const style = buildCssVarStyle(
      {
        success: "#10b981",
        danger: "#ef4444",
      },
      "light",
      { colors: false },
    ) as Record<string, string>;

    expect(style["--tc-success"]).toBe("#10b981");
    expect(style["--tc-danger"]).toBe("#ef4444");
    expect(style["--tc-success-bg"]).toBeUndefined();
    expect(style["--tc-danger-bg"]).toBeUndefined();
  });

  it("derives density variables from compact and respects explicit spacing", () => {
    const style = buildCssVarStyle(
      {
        density: "compact",
        contentPadding: "9px",
      },
      "light",
      undefined,
    ) as Record<string, string>;

    expect(style["--tc-content-padding"]).toBe("9px");
    expect(style["--tc-card-padding"]).toBe("10px");
    expect(style["--tc-card-gap"]).toBe("8px");
    expect(style["--tc-header-padding-y"]).toBe("6px");
    expect(style["--tc-nav-padding-y"]).toBe("7px");
  });

  it("re-derives semantic variables when light-mode colors override base sources", () => {
    const style = buildCssVarStyle(
      {
        success: "#10b981",
        light: { success: "#059669" },
      },
      "light",
      undefined,
    ) as Record<string, string>;

    expect(style["--tc-success"]).toBe("#059669");
    expect(style["--tc-success-bg"]).toMatch(/rgba\(5,\s*150,\s*105,/);
  });

  it("applies darker semantic alpha for success in dark effective theme", () => {
    const dark = buildCssVarStyle({ success: "#10b981" }, "dark", undefined) as Record<string, string>;
    const light = buildCssVarStyle({ success: "#10b981" }, "light", undefined) as Record<string, string>;

    expect(dark["--tc-success-bg"]).toMatch(/0\.16\)/);
    expect(light["--tc-success-bg"]).toMatch(/0\.1\)/);
  });

  it("does not set hex-derived accent tokens when accent is non-hex", () => {
    const style = buildCssVarStyle({ accent: "rgb(255, 0, 0)" }, "light", undefined) as Record<
      string,
      string
    >;

    expect(style["--tc-accent"]).toBe("rgb(255, 0, 0)");
    expect(style["--tc-accent-bg"]).toBeUndefined();
  });

  it("maps gridCols to --tc-grid-cols", () => {
    const style = buildCssVarStyle({ gridCols: "repeat(2, 1fr)" }, "light", undefined) as Record<
      string,
      string
    >;

    expect(style["--tc-grid-cols"]).toBe("repeat(2, 1fr)");
  });

  it("supports turning density derivation off", () => {
    const style = buildCssVarStyle(
      {
        density: "comfortable",
      },
      "light",
      { density: false },
    );

    expect(style).toBeUndefined();
  });
});
