import { describe, expect, it } from "vitest";
import { DEFAULT_PARI_COVER_VARIANT, pariCoverUrl } from "../src/utils/pari-image";

describe("pariCoverUrl", () => {
  it("returns null for empty / whitespace-only", () => {
    expect(pariCoverUrl(null)).toBeNull();
    expect(pariCoverUrl(undefined)).toBeNull();
    expect(pariCoverUrl("")).toBeNull();
    expect(pariCoverUrl("   ")).toBeNull();
  });

  it("passes through absolute http(s) URLs", () => {
    expect(pariCoverUrl("https://example.com/x.png")).toBe("https://example.com/x.png");
    expect(pariCoverUrl("http://example.com/x.png")).toBe("http://example.com/x.png");
  });

  it("builds Cloudflare URL for UUID image ids", () => {
    const id = "c856dc88-351e-4b4a-52a5-8c9ef4d23e00";
    expect(pariCoverUrl(id)).toBe(
      `https://toncast.me/cdn-cgi/imagedelivery/OQe1vxXdz8f9uuGC1-2leA/${id}/${DEFAULT_PARI_COVER_VARIANT}`,
    );
  });

  it("builds the same Cloudflare path for legacy numeric image ids (finished paris)", () => {
    const id = "17766949918579467";
    expect(pariCoverUrl(id)).toBe(
      `https://toncast.me/cdn-cgi/imagedelivery/OQe1vxXdz8f9uuGC1-2leA/${id}/${DEFAULT_PARI_COVER_VARIANT}`,
    );
  });

  it("returns null for too-short digit strings and unknown tokens", () => {
    expect(pariCoverUrl("1234567")).toBeNull();
    expect(pariCoverUrl("i")).toBeNull();
    expect(pariCoverUrl("not-a-uuid")).toBeNull();
  });
});
