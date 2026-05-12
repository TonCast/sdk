import { describe, expect, it } from "vitest";
import { DEFAULT_WS_URL, resolveWsUrlFromApiBaseUrl } from "../src/client/config";

describe("resolveWsUrlFromApiBaseUrl", () => {
  it("maps https REST host to wss origin (path ignored)", () => {
    expect(resolveWsUrlFromApiBaseUrl("https://toncast.me/api")).toBe("wss://toncast.me");
    expect(resolveWsUrlFromApiBaseUrl("https://api.staging.example/v1/")).toBe(
      "wss://api.staging.example",
    );
  });

  it("maps http to ws for local dev", () => {
    expect(resolveWsUrlFromApiBaseUrl("http://127.0.0.1:8080/api")).toBe("ws://127.0.0.1:8080");
  });

  it("preserves non-default ports", () => {
    expect(resolveWsUrlFromApiBaseUrl("https://example.com:8443/x")).toBe("wss://example.com:8443");
  });

  it("falls back for invalid input", () => {
    expect(resolveWsUrlFromApiBaseUrl("not-a-url")).toBe(DEFAULT_WS_URL);
  });
});
