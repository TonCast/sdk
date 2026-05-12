import { describe, expect, it } from "vitest";
import { toggleMultiValue } from "../src/utils/toggleMultiValue";

describe("toggleMultiValue", () => {
  it("adds a value when absent", () => {
    expect(toggleMultiValue(["a", "b"], "c")).toEqual(["a", "b", "c"]);
    expect(toggleMultiValue([], "x")).toEqual(["x"]);
  });

  it("removes a value when present", () => {
    expect(toggleMultiValue(["a", "b", "c"], "b")).toEqual(["a", "c"]);
    expect(toggleMultiValue(["x"], "x")).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const before = ["a", "b"];
    const out = toggleMultiValue(before, "c");
    expect(before).toEqual(["a", "b"]);
    expect(out).not.toBe(before);
  });
});
