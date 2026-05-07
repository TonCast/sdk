import { describe, expect, it } from "vitest";
import { toTonConnectManifestUrl } from "../src/tc-bridge/domain";

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
