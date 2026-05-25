import { Address } from "@ton/core";
import { describe, expect, it, vi } from "vitest";
import { BetsResource } from "../src/resources/bets";

const UQ_USER = "UQABAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAZAm";
const EQ_USER = Address.parse(UQ_USER).toString();

describe("BetsResource address normalization", () => {
  it("normalises explicit userAddress in REST paths", async () => {
    const request = vi.fn().mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
    const bets = new BetsResource({
      http: { request } as never,
      getUserAddress: () => undefined,
    });

    await bets.listForUser({ userAddress: UQ_USER });

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ path: `/v1/bets/user/${EQ_USER}` }),
    );
  });
});
