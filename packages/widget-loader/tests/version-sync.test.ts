import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The CDN bundle this loader downloads is published as `@toncast/widget`. The
 * loader and the widget MUST share a major version (and, while we are still
 * <1.0, a minor version too — `0.x` treats minor as the breaking-change axis).
 *
 * Bumping `widget` without bumping `widget-loader` (or vice versa) silently
 * mismatches `window.ToncastWidget` API expectations at runtime; this test
 * fails the release pipeline before that ships.
 */

const here = dirname(fileURLToPath(import.meta.url));

interface Pkg {
  version: string;
}

function readVersion(relPath: string): string {
  const pkg = JSON.parse(readFileSync(resolve(here, relPath), "utf8")) as Pkg;
  return pkg.version;
}

function parseSemver(v: string): { major: number; minor: number; patch: number } {
  const core = v.trim().replace(/[-+].*$/, "");
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(core);
  if (!m) throw new Error(`Unparseable version: ${v}`);
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

describe("widget-loader / widget version sync", () => {
  const loader = parseSemver(readVersion("../package.json"));
  const widget = parseSemver(readVersion("../../widget/package.json"));

  it("major versions match", () => {
    expect(loader.major).toBe(widget.major);
  });

  it("for 0.x, minor versions also match (minor is the breaking-change axis)", () => {
    if (loader.major === 0 && widget.major === 0) {
      expect(loader.minor).toBe(widget.minor);
    }
  });

  it("parses semver prerelease / build metadata using the numeric core only", () => {
    expect(parseSemver("0.1.0-rc.1")).toEqual({ major: 0, minor: 1, patch: 0 });
    expect(parseSemver("0.2.3+build.4")).toEqual({ major: 0, minor: 2, patch: 3 });
  });
});
