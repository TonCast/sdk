import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../src/types";
import { buildWidgetConfig } from "../src/utils/buildWidgetConfig";

describe("buildWidgetConfig", () => {
  it("always emits standalone tonconnect with the given domain", () => {
    const cfg = buildWidgetConfig(DEFAULT_CONFIG, { domain: "https://app.example" });
    expect(cfg.tonconnect).toEqual({
      type: "standalone",
      options: { domain: "https://app.example" },
    });
  });

  it("includes standalone client when apiBaseUrl is set", () => {
    const c = { ...DEFAULT_CONFIG, apiBaseUrl: "https://api.example.com/" };
    const cfg = buildWidgetConfig(c, { domain: "https://app.example" });
    expect(cfg.client).toEqual({ type: "standalone", baseUrl: "https://api.example.com" });
  });

  it("omits client when apiBaseUrl is empty", () => {
    const cfg = buildWidgetConfig(DEFAULT_CONFIG, { domain: "https://app.example" });
    expect(cfg.client).toBeUndefined();
  });

  it("widget always includes layout grid from constructor theme", () => {
    const cfg = buildWidgetConfig(DEFAULT_CONFIG, { domain: "https://x.test" });
    expect(cfg.widget?.layout?.grid).toEqual({ mobile: 1, tablet: 2, desktop: 3 });
  });
});
