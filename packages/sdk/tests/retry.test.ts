import { afterEach, describe, expect, it, vi } from "vitest";
import { ToncastApiError, ToncastValidationError } from "../src/errors";
import { withRetry } from "../src/utils/retry";

describe("withRetry", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("does not retry 400-class API errors", async () => {
    const op = vi.fn(async () => {
      throw new ToncastApiError("bad request", 400, "/x");
    });

    await expect(withRetry(op, { maxAttempts: 3, delayMs: 1 })).rejects.toMatchObject({
      status: 400,
    });
    expect(op).toHaveBeenCalledTimes(1);
  });

  it("does not retry response validation errors", async () => {
    const op = vi.fn(async () => {
      throw new ToncastValidationError("invalid", new Error("zod"));
    });

    await expect(withRetry(op, { maxAttempts: 3, delayMs: 1 })).rejects.toBeInstanceOf(
      ToncastValidationError,
    );
    expect(op).toHaveBeenCalledTimes(1);
  });

  it("retries 429 and then succeeds", async () => {
    vi.useFakeTimers();
    const op = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new ToncastApiError("rate limit", 429, "/x"))
      .mockResolvedValueOnce("ok");

    const promise = withRetry(op, { maxAttempts: 2, delayMs: 10, rateLimitBackoffMultiplier: 1 });
    await vi.advanceTimersByTimeAsync(10);

    await expect(promise).resolves.toBe("ok");
    expect(op).toHaveBeenCalledTimes(2);
  });
});
