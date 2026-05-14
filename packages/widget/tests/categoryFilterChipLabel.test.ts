import { ALL_CATEGORY_FILTER, type CategoryFilter } from "@toncast/sdk";
import { describe, expect, it } from "vitest";
import { categoryFilterChipKey, categoryFilterChipLabel } from "../src/utils/categoryFilterChipLabel";
import type { TranslationKey } from "../src/i18n/translations";

const t = (key: TranslationKey) => key;

describe("categoryFilterChipLabel", () => {
  it("maps All, pending, finished to translation keys and passes through API titles", () => {
    expect(categoryFilterChipLabel(ALL_CATEGORY_FILTER, t)).toBe("category.all");
    expect(categoryFilterChipLabel({ name: "Pending result", param: { feed: "pending" } }, t)).toBe(
      "category.feed.pending",
    );
    expect(categoryFilterChipLabel({ name: "Finished", param: { feed: "finished" } }, t)).toBe(
      "category.feed.finished",
    );
    expect(
      categoryFilterChipLabel({ name: "Sports", param: { feed: "active", categoryId: 3 } }, t),
    ).toBe("Sports");
  });
});

describe("categoryFilterChipKey", () => {
  it("is stable and locale-agnostic", () => {
    const a: CategoryFilter = { name: "Finished", param: { feed: "finished" } };
    const b: CategoryFilter = { name: "Terminés", param: { feed: "finished" } };
    expect(categoryFilterChipKey(a)).toBe(categoryFilterChipKey(b));
    expect(categoryFilterChipKey(a)).toBe('{"feed":"finished"}');
  });
});
