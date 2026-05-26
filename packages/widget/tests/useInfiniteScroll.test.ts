import { describe, expect, it } from "vitest";

describe("useInfiniteScroll", () => {
  it("exports useInfiniteScroll", async () => {
    const mod = await import("../src/utils/useInfiniteScroll");
    expect(typeof mod.useInfiniteScroll).toBe("function");
  });
});
