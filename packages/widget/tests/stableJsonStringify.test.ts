import { describe, expect, it } from "vitest";
import { stableJsonStringify } from "../src/utils/stableJsonStringify";

describe("stableJsonStringify", () => {
  it("produces same string regardless of key order", () => {
    const a = stableJsonStringify({ z: 1, a: 2, m: 3 });
    const b = stableJsonStringify({ a: 2, m: 3, z: 1 });
    expect(a).toBe(b);
  });

  it("recursively sorts nested object keys", () => {
    const a = stableJsonStringify({ outer: { z: 1, a: 2 } });
    const b = stableJsonStringify({ outer: { a: 2, z: 1 } });
    expect(a).toBe(b);
    expect(a).toBe('{"outer":{"a":2,"z":1}}');
  });

  it("preserves array order (does NOT sort arrays)", () => {
    expect(stableJsonStringify([3, 1, 2])).toBe("[3,1,2]");
  });

  it("converts BigInt to string (without throwing)", () => {
    expect(stableJsonStringify(123n)).toBe('"123"');
    expect(stableJsonStringify({ amount: 1_000_000_000n })).toBe('{"amount":"1000000000"}');
  });

  it("handles BigInt nested in arrays / objects", () => {
    expect(stableJsonStringify([{ a: 1n }, { b: 2n }])).toBe('[{"a":"1"},{"b":"2"}]');
  });

  it("handles primitives and null", () => {
    expect(stableJsonStringify(null)).toBe("null");
    expect(stableJsonStringify(42)).toBe("42");
    expect(stableJsonStringify("x")).toBe('"x"');
    expect(stableJsonStringify(true)).toBe("true");
  });
});
