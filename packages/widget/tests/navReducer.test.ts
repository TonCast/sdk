import { describe, expect, it } from "vitest";
import { NAV_INITIAL_STATE, NAV_MAX_DEPTH, navReducer, type WidgetView } from "../src/navReducer";

describe("navReducer", () => {
  it("starts at the list view by default", () => {
    expect(NAV_INITIAL_STATE).toEqual([{ name: "list" }]);
  });

  it("navigate pushes a new view", () => {
    const out = navReducer(NAV_INITIAL_STATE, { type: "navigate", view: { name: "bets" } });
    expect(out).toEqual([{ name: "list" }, { name: "bets" }]);
  });

  it("navigate to same tab-level view dedups (list→list, bets→bets)", () => {
    const out = navReducer(NAV_INITIAL_STATE, { type: "navigate", view: { name: "list" } });
    expect(out).toBe(NAV_INITIAL_STATE);
    const out2 = navReducer([{ name: "bets" }], { type: "navigate", view: { name: "bets" } });
    expect(out2).toEqual([{ name: "bets" }]);
  });

  it("dedups detail with same pariId + same initialSide", () => {
    const detail: WidgetView = { name: "detail", pariId: "P1", initialSide: "yes" };
    const start: WidgetView[] = [{ name: "list" }, detail];
    const out = navReducer(start, { type: "navigate", view: { ...detail } });
    expect(out).toBe(start);
  });

  it("pushes detail with same pariId but different initialSide", () => {
    const detail: WidgetView = { name: "detail", pariId: "P1", initialSide: "yes" };
    const start: WidgetView[] = [{ name: "list" }, detail];
    const out = navReducer(start, {
      type: "navigate",
      view: { name: "detail", pariId: "P1", initialSide: "no" },
    });
    expect(out).toHaveLength(3);
    expect((out[2] as { initialSide?: string }).initialSide).toBe("no");
  });

  it("back pops one view", () => {
    const stack: WidgetView[] = [{ name: "list" }, { name: "bets" }];
    expect(navReducer(stack, { type: "back" })).toEqual([{ name: "list" }]);
  });

  it("back at root is a no-op (returns same reference)", () => {
    const out = navReducer(NAV_INITIAL_STATE, { type: "back" });
    expect(out).toBe(NAV_INITIAL_STATE);
  });

  it("clips stack to NAV_MAX_DEPTH on excessive push", () => {
    let s: WidgetView[] = NAV_INITIAL_STATE;
    for (let i = 0; i < NAV_MAX_DEPTH * 2; i++) {
      s = navReducer(s, {
        type: "navigate",
        view: { name: "detail", pariId: `P${i}` },
      });
    }
    expect(s).toHaveLength(NAV_MAX_DEPTH);
    // Last view is the latest pushed
    expect((s[s.length - 1] as { pariId: string }).pariId).toBe(`P${NAV_MAX_DEPTH * 2 - 1}`);
  });
});
