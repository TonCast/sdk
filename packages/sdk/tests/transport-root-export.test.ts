import { describe, expect, it, vi } from "vitest";
import type { HttpTransport, HttpTransportRequest, HttpTransportResponse } from "../src";

/** Ensures transport types are importable from the package root (not only deep paths). */
describe("HTTP transport types (root export)", () => {
  it("allows a custom HttpTransport implementation typed from @toncast/sdk", async () => {
    const transport: HttpTransport = {
      request: vi.fn(
        async (_req: HttpTransportRequest): Promise<HttpTransportResponse> => ({
          status: 200,
          headers: {},
          body: [],
        }),
      ),
    };

    expect(typeof transport.request).toBe("function");
  });
});
