import { describe, expect, it } from "vitest";
import { formatTimeLeft, shortAddr } from "../src/lib/format";

describe("shortAddr", () => {
  it("returns full string when short enough", () => {
    expect(shortAddr("EQ1234", 6, 4)).toBe("EQ1234");
  });

  it("truncates long addresses with ellipsis", () => {
    const long = "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c";
    expect(shortAddr(long, 4, 4)).toBe("EQAA…AM9c");
  });
});

describe("formatTimeLeft", () => {
  it('returns "ended" when end is in the past', () => {
    const past = Math.floor(Date.now() / 1000) - 60;
    expect(formatTimeLeft(past)).toBe("ended");
  });

  it("shows days and hours when more than a day remains", () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const end = nowSec + 2 * 86_400 + 3 * 3600;
    expect(formatTimeLeft(end, Date.now())).toBe("2d 3h");
  });

  it("shows hours and minutes when under a day", () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const end = nowSec + 5 * 3600 + 12 * 60;
    expect(formatTimeLeft(end, Date.now())).toBe("5h 12m");
  });

  it("shows minutes only when under an hour", () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const end = nowSec + 45 * 60;
    expect(formatTimeLeft(end, Date.now())).toBe("45m");
  });
});
