import { describe, expect, it } from "vitest";
import type { PariCreatedPayload } from "../src/ws/pari-list-protocol";
import { localisePariCreated, PariListIncomingSchema } from "../src/ws/pari-list-protocol";

// `localisePariCreated` accepts the parsed-schema shape (isVisible: boolean), but
// also coerces defensively if a raw broadcast (isVisible: 0|1) is passed. Test both.
const FULL_PAYLOAD = {
  id: "EQABC",
  endTime: 1777039200,
  image: "img",
  yesVolume: 21.148,
  noVolume: 13.884,
  status: "active",
  result: "pending",
  createdAt: 1776761130,
  isVisible: 1, // backend sometimes ships number, sometimes bool
  availableBets: '{"56":"EQXyz"}',
  categoryId: 3,
  name_en: "Will RCB beat GT?",
  name_ru: "Победят ли RCB?",
  description_en: "EN description",
  description_ru: "RU описание",
};

describe("PariListIncomingSchema", () => {
  it("parses pari_created with envelope", () => {
    const parsed = PariListIncomingSchema.parse({
      type: "pari_created",
      sequenceId: 42,
      timestamp: 1700000000,
      data: FULL_PAYLOAD,
    });
    expect(parsed.type).toBe("pari_created");
    expect("sequenceId" in parsed && parsed.sequenceId).toBe(42);
  });

  it("parses syncStatus without envelope (backend reality)", () => {
    const parsed = PariListIncomingSchema.parse({
      type: "syncStatus",
      isLatest: false,
      currentSequence: 168,
    });
    expect(parsed.type).toBe("syncStatus");
    if (parsed.type === "syncStatus") {
      expect(parsed.isLatest).toBe(false);
      expect(parsed.currentSequence).toBe(168);
    }
  });

  it("parses pong", () => {
    const parsed = PariListIncomingSchema.parse({ type: "pong" });
    expect(parsed.type).toBe("pong");
  });

  it("parses coefficient_update", () => {
    const parsed = PariListIncomingSchema.parse({
      type: "coefficient_update",
      sequenceId: 1,
      timestamp: 1,
      data: { pariAddress: "EQ", bestYesOdds: 60, timestamp: 1 },
    });
    expect(parsed.type).toBe("coefficient_update");
  });

  it("parses volume_update", () => {
    const parsed = PariListIncomingSchema.parse({
      type: "volume_update",
      sequenceId: 1,
      timestamp: 1,
      data: { pariAddress: "EQ", deltaYesVolume: 0.5, deltaNoVolume: -0.1, timestamp: 1 },
    });
    expect(parsed.type).toBe("volume_update");
  });

  it("rejects unknown type", () => {
    const result = PariListIncomingSchema.safeParse({ type: "bogus" });
    expect(result.success).toBe(false);
  });
});

describe("localisePariCreated", () => {
  const cast = (p: typeof FULL_PAYLOAD) => p as unknown as PariCreatedPayload;

  it("picks the requested language", () => {
    const ru = localisePariCreated(cast(FULL_PAYLOAD), "ru");
    expect(ru.name).toBe("Победят ли RCB?");
    expect(ru.description).toBe("RU описание");
  });

  it("falls back to en when the requested language is missing", () => {
    const fr = localisePariCreated(cast(FULL_PAYLOAD), "fr");
    expect(fr.name).toBe("Will RCB beat GT?");
    expect(fr.description).toBe("EN description");
  });

  it("normalises isVisible 0/1 to boolean", () => {
    const out = localisePariCreated(FULL_PAYLOAD as unknown as PariCreatedPayload, "en");
    expect(out.isVisible).toBe(true);
  });

  it("parses availableBets JSON string into a Record<number, string>", () => {
    const out = localisePariCreated(cast(FULL_PAYLOAD), "en");
    expect(out.availableBets).toEqual({ 56: "EQXyz" });
  });

  it("returns null availableBets if it's null/empty/garbage", () => {
    const garbage = { ...FULL_PAYLOAD, availableBets: "not json" };
    expect(localisePariCreated(cast(garbage), "en").availableBets).toBeNull();

    const empty = { ...FULL_PAYLOAD, availableBets: null };
    expect(
      localisePariCreated(cast(empty as unknown as typeof FULL_PAYLOAD), "en").availableBets,
    ).toBeNull();
  });

  it("nulls bestYesOdds / bestNoOdds / version (legacy fields)", () => {
    const out = localisePariCreated(cast(FULL_PAYLOAD), "en");
    expect(out.bestYesOdds).toBeNull();
    expect(out.bestNoOdds).toBeNull();
    expect(out.version).toBeNull();
  });
});
