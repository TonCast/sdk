import { describe, expect, it } from "vitest";
import { toTonConnectManifestUrl, tryTonConnectManifestUrl } from "../src/tc-bridge/domain";

describe("tryTonConnectManifestUrl", () => {
  it("returns the same URL as toTonConnectManifestUrl for valid domains", () => {
    expect(tryTonConnectManifestUrl("https://app.example/")).toBe(
      "https://app.example/tonconnect-manifest.json",
    );
  });

  it("returns null for invalid or non-http(s) input", () => {
    expect(tryTonConnectManifestUrl("")).toBeNull();
    expect(tryTonConnectManifestUrl("   ")).toBeNull();
    expect(tryTonConnectManifestUrl("example.com")).toBeNull();
    expect(tryTonConnectManifestUrl("javascript:alert(1)")).toBeNull();
    expect(tryTonConnectManifestUrl("data:text/html,<h1>x</h1>")).toBeNull();
  });
});

describe("toTonConnectManifestUrl", () => {
  it("builds manifest URLs from absolute http and https domains", () => {
    expect(toTonConnectManifestUrl("https://app.example/")).toBe(
      "https://app.example/tonconnect-manifest.json",
    );
    expect(toTonConnectManifestUrl("http://localhost:5173/widget")).toBe(
      "http://localhost:5173/widget/tonconnect-manifest.json",
    );
  });

  it("rejects non-http schemes and relative domains", () => {
    expect(() => toTonConnectManifestUrl("javascript:alert(1)")).toThrow("http(s)");
    expect(() => toTonConnectManifestUrl("data:text/html,<h1>x</h1>")).toThrow("http(s)");
    expect(() => toTonConnectManifestUrl("example.com")).toThrow("absolute");
  });
});
