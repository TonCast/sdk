import { describe, expect, it } from "vitest";
import { EN_CATALOG, type TranslationKey } from "../src/i18n/translations";
import { applyTranslation, pickTranslation } from "../src/i18n/useT";

describe("applyTranslation", () => {
  it("returns template unchanged when params absent", () => {
    expect(applyTranslation("Hello world")).toBe("Hello world");
  });

  it("substitutes single placeholder", () => {
    expect(applyTranslation("Hello {name}", { name: "Anna" })).toBe("Hello Anna");
  });

  it("substitutes multiple placeholders", () => {
    expect(applyTranslation("{a} + {b} = {c}", { a: 1, b: 2, c: 3 })).toBe("1 + 2 = 3");
  });

  it("keeps `{name}` literal when param missing", () => {
    expect(applyTranslation("Hello {name}", {})).toBe("Hello {name}");
  });

  it("converts numbers to string", () => {
    expect(applyTranslation("count: {n}", { n: 42 })).toBe("count: 42");
  });
});

describe("pickTranslation", () => {
  it("falls back to English catalogue when language has no entry", () => {
    const enValue = EN_CATALOG["bet.title"];
    expect(pickTranslation("xx" as never, "bet.title")).toBe(enValue);
  });

  it("falls back to raw key when neither lang nor English has it", () => {
    expect(pickTranslation("en", "future.key.not.in.catalogue" as TranslationKey)).toBe(
      "future.key.not.in.catalogue",
    );
  });

  it("returns localised value when present", () => {
    // 'en' must always have it
    const v = pickTranslation("en", "bet.title");
    expect(typeof v).toBe("string");
    expect(v.length).toBeGreaterThan(0);
  });
});
