import { describe, expect, it } from "vitest";
import { toncastQueryKeys } from "../src/queryKeys";

/**
 * Smoke: `useBet` composes summary + quote + confirm; confirm has no query key.
 * Child hooks must stay under predictable `toncast` namespaces for invalidation.
 */
describe("useBet stack query key roots", () => {
  it("betting.summary and betting.quote share betting namespace", () => {
    const summary = toncastQueryKeys.betting.summary("pari1", {});
    const quote = toncastQueryKeys.betting.quote({ mode: "market", pariId: "pari1" } as const);
    expect(summary[0]).toBe("toncast");
    expect(summary[1]).toBe("betting");
    expect(quote[0]).toBe("toncast");
    expect(quote[1]).toBe("betting");
    expect(summary[2]).toBe("summary");
    expect(quote[2]).toBe("quote");
  });
});
