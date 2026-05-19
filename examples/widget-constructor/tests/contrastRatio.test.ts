import { describe, expect, it } from "vitest";
import { checkAccentOnBg, contrastRatio } from "../src/utils/contrastRatio";

describe("contrastRatio", () => {
  it("returns 21 for white on black", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 0);
  });

  it("returns null for invalid hex", () => {
    expect(contrastRatio("not-a-color", "#000000")).toBeNull();
  });
});

describe("checkAccentOnBg", () => {
  it("computes ratio for default accent on white shell", () => {
    const r = checkAccentOnBg("#0098ea", "#ffffff");
    expect(r.ratio).not.toBeNull();
    if (r.ratio == null) throw new Error("expected ratio");
    expect(r.ratio).toBeGreaterThan(1);
  });

  it("warns or fails for low-contrast accent on dark bg", () => {
    const r = checkAccentOnBg("#333333", "#0f172a");
    expect(["warn", "fail"]).toContain(r.level);
  });
});
