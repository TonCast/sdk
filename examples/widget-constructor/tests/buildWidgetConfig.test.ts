import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, resetConfigTabToDefaults } from "../src/types";
import { buildWidgetConfig } from "../src/utils/buildWidgetConfig";

describe("resetConfigTabToDefaults", () => {
  it("clears config fields but keeps theme", () => {
    const c: typeof DEFAULT_CONFIG = {
      ...DEFAULT_CONFIG,
      apiBaseUrl: "https://custom.api/",
      apiWsUrl: "wss://custom.ws",
      domain: "https://app.example",
      theme: { ...DEFAULT_CONFIG.theme, colorScheme: "dark", radius: 20 },
    };
    const out = resetConfigTabToDefaults(c);
    expect(out.apiBaseUrl).toBe("");
    expect(out.apiWsUrl).toBe("");
    expect(out.domain).toBe("");
    expect(out.theme.colorScheme).toBe("dark");
    expect(out.theme.radius).toBe(20);
  });
});

describe("buildWidgetConfig", () => {
  it("always emits standalone tonconnect with the given domain", () => {
    const cfg = buildWidgetConfig(DEFAULT_CONFIG, { domain: "https://app.example" });
    expect(cfg.tonconnect).toEqual({
      type: "standalone",
      options: { domain: "https://app.example" },
    });
  });

  it("integratedMode leaves tonconnect domain empty for React snippet callers", () => {
    const cfg = buildWidgetConfig(DEFAULT_CONFIG, { integratedMode: true });
    expect(cfg.tonconnect).toEqual({
      type: "standalone",
      options: { domain: "" },
    });
  });

  it("includes standalone client when apiBaseUrl is set", () => {
    const c = { ...DEFAULT_CONFIG, apiBaseUrl: "https://api.example.com/" };
    const cfg = buildWidgetConfig(c, { domain: "https://app.example" });
    expect(cfg.client).toEqual({ type: "standalone", baseUrl: "https://api.example.com" });
  });

  it("includes wsUrl in client when apiWsUrl is set", () => {
    const c = {
      ...DEFAULT_CONFIG,
      apiBaseUrl: "https://api.example.com/",
      apiWsUrl: "wss://ws.example.com",
    };
    const cfg = buildWidgetConfig(c, { domain: "https://app.example" });
    expect(cfg.client).toEqual({
      type: "standalone",
      baseUrl: "https://api.example.com",
      wsUrl: "wss://ws.example.com",
    });
  });

  it("omits client when apiBaseUrl is empty", () => {
    const cfg = buildWidgetConfig(DEFAULT_CONFIG, { domain: "https://app.example" });
    expect(cfg.client).toBeUndefined();
  });

  it("widget always includes layout grid from constructor theme", () => {
    const cfg = buildWidgetConfig(DEFAULT_CONFIG, { domain: "https://x.test" });
    expect(cfg.widget?.layout?.grid).toEqual({ mobile: 1, tablet: 2, desktop: 3 });
  });

  it("normalizes direct grid config before export", () => {
    const cfg = buildWidgetConfig(
      {
        ...DEFAULT_CONFIG,
        theme: {
          ...DEFAULT_CONFIG.theme,
          grid: { mobile: 5, tablet: 6, desktop: 2 },
        },
      },
      { domain: "https://x.test" },
    );

    expect(cfg.widget?.layout?.grid).toEqual({ mobile: 3, tablet: 5, desktop: 3 });
  });
});
