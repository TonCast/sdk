import { RADIUS_DEFAULT, RADIUS_MAX } from "@toncast/widget/constants";
import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../src/types";
import {
  clampRadius,
  normalizeApiBaseUrl,
  normalizeApiWsUrl,
  normalizeConfig,
  normalizeDomain,
  normalizeReferralAddress,
} from "../src/utils/normalizeConfig";

describe("normalizeDomain", () => {
  it("returns trimmed http(s) URL without trailing slashes", () => {
    expect(normalizeDomain("  https://app.example/  ")).toBe("https://app.example");
  });
  it("rejects non-http schemes / non-string / empty", () => {
    expect(normalizeDomain("javascript:alert(1)")).toBe("");
    expect(normalizeDomain("")).toBe("");
    expect(normalizeDomain(null)).toBe("");
    expect(normalizeDomain(123)).toBe("");
  });
});

describe("normalizeApiBaseUrl", () => {
  it("strips trailing slashes", () => {
    expect(normalizeApiBaseUrl("https://api.example.com///")).toBe("https://api.example.com");
  });
  it("rejects bad input", () => {
    expect(normalizeApiBaseUrl("foo")).toBe("");
    expect(normalizeApiBaseUrl(undefined)).toBe("");
  });
});

describe("normalizeApiWsUrl", () => {
  it("accepts ws(s) origins and strips trailing slashes", () => {
    expect(normalizeApiWsUrl("wss://ws.example.com/")).toBe("wss://ws.example.com");
    expect(normalizeApiWsUrl("  ws://127.0.0.1:9000  ")).toBe("ws://127.0.0.1:9000");
  });
  it("rejects http(s) and garbage", () => {
    expect(normalizeApiWsUrl("https://x.test")).toBe("");
    expect(normalizeApiWsUrl("")).toBe("");
    expect(normalizeApiWsUrl(null)).toBe("");
  });
});

describe("clampRadius", () => {
  it("clamps finite numbers to [0, RADIUS_MAX]", () => {
    expect(clampRadius(10)).toBe(10);
    expect(clampRadius(200)).toBe(RADIUS_MAX);
    expect(clampRadius(-1)).toBe(0);
  });

  it("falls back for non-finite input", () => {
    expect(clampRadius(NaN)).toBe(RADIUS_DEFAULT);
    expect(clampRadius("abc")).toBe(RADIUS_DEFAULT);
  });

  it("accepts numeric strings", () => {
    expect(clampRadius("8")).toBe(8);
  });

  it("respects explicit fallback", () => {
    expect(clampRadius(NaN, 6)).toBe(6);
  });
});

describe("normalizeReferralAddress", () => {
  it("returns empty for non-string / blank / unparseable", () => {
    expect(normalizeReferralAddress(undefined)).toBe("");
    expect(normalizeReferralAddress("")).toBe("");
    expect(normalizeReferralAddress("   ")).toBe("");
    expect(normalizeReferralAddress("not an address")).toBe("");
  });
  it("normalises a valid bounceable EQ address to non-bounceable UQ form", () => {
    const raw = "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAd99";
    const out = normalizeReferralAddress(raw);
    expect(out).toBe("UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYK4");
  });
});

describe("normalizeConfig", () => {
  it("returns DEFAULT_CONFIG fields when given empty input", () => {
    const out = normalizeConfig({});
    expect(out.theme.density).toBe(DEFAULT_CONFIG.theme.density);
    expect(out.theme.colorScheme).toBe(DEFAULT_CONFIG.theme.colorScheme);
    expect(out.theme.radius).toBe(DEFAULT_CONFIG.theme.radius);
    expect(out.languages).toEqual(DEFAULT_CONFIG.languages);
    expect(out.apiWsUrl).toBe("");
  });

  it("normalizes apiWsUrl", () => {
    expect(normalizeConfig({ apiWsUrl: "wss://x.test/" }).apiWsUrl).toBe("wss://x.test");
    expect(normalizeConfig({ apiWsUrl: "https://bad" }).apiWsUrl).toBe("");
  });

  it("rejects invalid density / colorScheme", () => {
    const out = normalizeConfig({
      theme: {
        ...DEFAULT_CONFIG.theme,
        density: "bogus" as never,
        colorScheme: "fancy" as never,
      },
    });
    expect(out.theme.density).toBe(DEFAULT_CONFIG.theme.density);
    expect(out.theme.colorScheme).toBe(DEFAULT_CONFIG.theme.colorScheme);
  });

  it("clamps radius to [0, 32] and falls back when NaN", () => {
    expect(normalizeConfig({ theme: { ...DEFAULT_CONFIG.theme, radius: 999 } }).theme.radius).toBe(
     32,
    );
    expect(normalizeConfig({ theme: { ...DEFAULT_CONFIG.theme, radius: -5 } }).theme.radius).toBe(
      0,
    );
    expect(
      normalizeConfig({ theme: { ...DEFAULT_CONFIG.theme, radius: NaN as unknown as number } })
        .theme.radius,
    ).toBe(DEFAULT_CONFIG.theme.radius);
  });

  it("normalizes grid columns to device-specific allowed ranges and falls back when NaN", () => {
    const out = normalizeConfig({
      theme: {
        ...DEFAULT_CONFIG.theme,
        grid: { mobile: 6, tablet: 1, desktop: NaN as unknown as number },
      },
    });
    expect(out.theme.grid.mobile).toBe(3);
    expect(out.theme.grid.tablet).toBe(2);
    expect(out.theme.grid.desktop).toBe(DEFAULT_CONFIG.theme.grid.desktop);
  });

  it("falls back when languages is not an array (corrupt storage)", () => {
    const out = normalizeConfig({ languages: "not-an-array" as unknown as never });
    expect(out.languages).toEqual(DEFAULT_CONFIG.languages);
  });

  it("zeroes corrupt referralAddress, keeps valid one", () => {
    const out1 = normalizeConfig({ referralAddress: "garbage" });
    expect(out1.referralAddress).toBe("");
    const out2 = normalizeConfig({
      referralAddress: "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAd99",
    });
    expect(out2.referralAddress).toBe("UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYK4");
  });

  it("clamps referralPct into [0, 7]", () => {
    expect(normalizeConfig({ referralPct: -1 }).referralPct).toBe(0);
    expect(normalizeConfig({ referralPct: 99 }).referralPct).toBe(7);
    expect(normalizeConfig({ referralPct: NaN }).referralPct).toBe(DEFAULT_CONFIG.referralPct);
  });

  it("merges nested theme.light/dark with defaults (missing keys filled in)", () => {
    const out = normalizeConfig({
      theme: { ...DEFAULT_CONFIG.theme, light: { accent: "#ff0000" } as never },
    });
    expect(out.theme.light.accent).toBe("#ff0000");
    expect(out.theme.light.success).toBe(DEFAULT_CONFIG.theme.light.success);
  });
});
