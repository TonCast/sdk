import { afterEach, describe, expect, it, vi } from "vitest";
import { type HttpTransport, ToncastClient } from "../src";

describe("custom HTTP transport", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses injected transport instead of global fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const transport: HttpTransport = {
      request: vi.fn(async () => ({
        status: 200,
        headers: {},
        body: [{ id: 1, title: "Sports" }],
      })),
    };

    const client = new ToncastClient({ transport, prefetch: false });
    await client.categories.list();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(transport.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        url: "https://toncast.me/api/v1/categories",
        headers: expect.objectContaining({ accept: "application/json" }),
      }),
    );
  });
});
