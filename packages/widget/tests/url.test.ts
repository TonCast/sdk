import { describe, expect, it } from "vitest";
import { parseHttpUrl, stripTrailingSlashes } from "../src/utils/url";

describe("parseHttpUrl", () => {
  it("returns URL for absolute http(s) input", () => {
    expect(parseHttpUrl("https://app.example/")?.toString()).toBe("https://app.example/");
    expect(parseHttpUrl("http://localhost:5173/widget")?.toString()).toBe(
      "http://localhost:5173/widget",
    );
  });

  it("trims whitespace before parsing", () => {
    expect(parseHttpUrl("   https://app.example/  ")?.protocol).toBe("https:");
  });

  it("returns null for empty / whitespace-only input", () => {
    expect(parseHttpUrl("")).toBeNull();
    expect(parseHttpUrl("   ")).toBeNull();
  });

  it("returns null for non-http schemes", () => {
    expect(parseHttpUrl("javascript:alert(1)")).toBeNull();
    expect(parseHttpUrl("data:text/html,<h1>x</h1>")).toBeNull();
    expect(parseHttpUrl("ftp://example.com/")).toBeNull();
    expect(parseHttpUrl("file:///tmp/x")).toBeNull();
  });

  it("returns null for relative URLs", () => {
    expect(parseHttpUrl("example.com")).toBeNull();
    expect(parseHttpUrl("/path/only")).toBeNull();
  });

  it("returns null for non-string input", () => {
    expect(parseHttpUrl(undefined)).toBeNull();
    expect(parseHttpUrl(null)).toBeNull();
    expect(parseHttpUrl(123)).toBeNull();
    expect(parseHttpUrl({})).toBeNull();
  });

  it("preserves fragment and query in the parsed URL (no normalization)", () => {
    const u = parseHttpUrl("https://app.example/?q=1#frag");
    expect(u?.search).toBe("?q=1");
    expect(u?.hash).toBe("#frag");
  });

  it("handles trailing slash and pathnames", () => {
    expect(parseHttpUrl("https://app.example")?.pathname).toBe("/");
    expect(parseHttpUrl("https://app.example/widget/")?.pathname).toBe("/widget/");
  });
});

describe("stripTrailingSlashes", () => {
  it("removes one or more trailing slashes", () => {
    expect(stripTrailingSlashes("https://a.example/")).toBe("https://a.example");
    expect(stripTrailingSlashes("https://a.example///")).toBe("https://a.example");
    expect(stripTrailingSlashes("https://a.example/api/v1//")).toBe("https://a.example/api/v1");
  });

  it("leaves strings without trailing slashes unchanged", () => {
    expect(stripTrailingSlashes("https://a.example")).toBe("https://a.example");
    expect(stripTrailingSlashes("")).toBe("");
  });
});
