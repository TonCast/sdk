import { describe, expect, it } from "vitest";
import { type ConstructorConfig, DEFAULT_CONFIG } from "../src/types";
import { buildIndexHtml, buildJsSnippet, buildReactSnippet } from "../src/utils/generateZip";

function config(overrides: Partial<ConstructorConfig>): ConstructorConfig {
  return {
    ...DEFAULT_CONFIG,
    ...overrides,
    theme: {
      ...DEFAULT_CONFIG.theme,
      ...overrides.theme,
    },
  };
}

describe("widget export snippets", () => {
  it("does not emit raw script-closing tags from config values", () => {
    const maliciousConfig = config({
      domain: "https://safe.example/'</script><script>alert(1)</script>",
      appName: "Bad </script><script>alert(2)</script>",
      language: "en</script><script>alert(3)</script>",
      languages: ["en</script><script>alert(4)</script>"],
      referralAddress: "UQ_FAKE</script><script>alert(5)</script>",
      referralPct: 3,
      theme: {
        accent: "#0098ea</style><script>alert(6)</script>",
        bg: "#fff</style><script>alert(7)</script>",
        colorScheme: "light",
        radius: 12,
      },
    });

    expect(buildIndexHtml(maliciousConfig)).not.toContain("</script><script>");
    expect(buildIndexHtml(maliciousConfig)).not.toContain("</style><script>");
    expect(buildJsSnippet(maliciousConfig)).not.toContain("</script><script>");
    expect(buildReactSnippet(maliciousConfig)).not.toContain("</script><script>");
  });
});
