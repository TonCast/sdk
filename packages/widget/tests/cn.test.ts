import { describe, expect, it } from "vitest";
import { cn } from "../src/utils/cn";

describe("cn", () => {
  it("joins truthy strings with single space", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });

  it("filters out falsy values (false, undefined, null, '')", () => {
    expect(cn("a", false, "b", null, "c", undefined, "")).toBe("a b c");
  });

  it("returns empty string for no/all-falsy input", () => {
    expect(cn()).toBe("");
    expect(cn(undefined, null, false)).toBe("");
  });

  it("preserves whitespace within individual class names", () => {
    expect(cn("a b", "c")).toBe("a b c");
  });
});
