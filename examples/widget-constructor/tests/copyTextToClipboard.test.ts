// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { copyTextToClipboard } from "../src/utils/copyTextToClipboard";

describe("copyTextToClipboard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses navigator.clipboard when available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    await copyTextToClipboard("hello");
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("falls back to execCommand when clipboard API is missing", async () => {
    vi.stubGlobal("navigator", { clipboard: undefined });
    const execCommand = vi.fn(() => true);
    Object.defineProperty(document, "execCommand", {
      value: execCommand,
      configurable: true,
      writable: true,
    });
    try {
      await copyTextToClipboard("fallback");
      expect(execCommand).toHaveBeenCalledWith("copy");
    } finally {
      Reflect.deleteProperty(document, "execCommand");
    }
  });
});
