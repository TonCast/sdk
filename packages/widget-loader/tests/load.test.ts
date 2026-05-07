import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type FakeScript = {
  async?: boolean;
  attrs: Record<string, string>;
  crossOrigin?: string;
  getAttribute: (name: string) => string | null;
  integrity?: string;
  nonce?: string;
  onerror?: () => void;
  onload?: () => void;
  remove: () => void;
  src?: string;
  setAttribute: (name: string, value: string) => void;
};

function installFakeDocument() {
  const scripts: FakeScript[] = [];
  const document = {
    createElement(tag: string) {
      if (tag !== "script") throw new Error(`unexpected tag: ${tag}`);
      const script: FakeScript = {
        attrs: {},
        remove() {
          const index = scripts.indexOf(this);
          if (index !== -1) scripts.splice(index, 1);
        },
        getAttribute(name) {
          return this.attrs[name] ?? null;
        },
        setAttribute(name, value) {
          this.attrs[name] = value;
        },
      };
      return script;
    },
    head: {
      appendChild(script: FakeScript) {
        scripts.push(script);
      },
    },
    get scripts() {
      return scripts;
    },
    querySelector(selector: string) {
      const match = selector.match(/^script\[data-tc-widget-loader="(.+)"\]$/);
      if (!match) return null;
      return scripts.find((script) => script.attrs["data-tc-widget-loader"] === match[1]) ?? null;
    },
  };
  vi.stubGlobal("document", document);
  return { scripts };
}

function installSelectorThrowingDocument() {
  const scripts: FakeScript[] = [];
  const document = {
    createElement(tag: string) {
      if (tag !== "script") throw new Error(`unexpected tag: ${tag}`);
      const script: FakeScript = {
        attrs: {},
        remove() {
          const index = scripts.indexOf(this);
          if (index !== -1) scripts.splice(index, 1);
        },
        getAttribute(name) {
          return this.attrs[name] ?? null;
        },
        setAttribute(name, value) {
          this.attrs[name] = value;
        },
      };
      return script;
    },
    head: {
      appendChild(script: FakeScript) {
        scripts.push(script);
      },
    },
    get scripts() {
      return scripts;
    },
    querySelector() {
      throw new DOMException("Invalid selector", "SyntaxError");
    },
  };
  vi.stubGlobal("document", document);
  return { scripts };
}

async function importFreshLoader() {
  vi.resetModules();
  return (await import("../src/index")).default;
}

describe("ToncastWidgetLoader.load", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("caches the loaded constructor after a successful script load", async () => {
    const { scripts } = installFakeDocument();
    class Widget {}
    vi.stubGlobal("ToncastWidget", { ToncastWidget: Widget });
    const loader = await importFreshLoader();

    const first = loader.load("https://cdn.example/widget.js");
    expect(scripts).toHaveLength(1);
    scripts[0]?.onload?.();

    await expect(first).resolves.toBe(Widget);
    await expect(loader.load("https://cdn.example/widget.js")).resolves.toBe(Widget);
    expect(scripts).toHaveLength(1);
  });

  it("allows retrying after a failed script load", async () => {
    const { scripts } = installFakeDocument();
    const loader = await importFreshLoader();

    const first = loader.load("https://cdn.example/widget.js");
    const firstFailure = expect(first).rejects.toThrow("Failed to load bundle");
    expect(scripts).toHaveLength(1);
    scripts[0]?.onerror?.();
    await firstFailure;
    expect(scripts).toHaveLength(0);

    class Widget {}
    vi.stubGlobal("ToncastWidget", { ToncastWidget: Widget });
    const second = loader.load("https://cdn.example/widget.js");
    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.src).toBe("https://cdn.example/widget.js");
    scripts[0]?.onload?.();
    await expect(second).resolves.toBe(Widget);
  });

  it("loads custom URLs that are unsafe inside CSS selectors", async () => {
    const { scripts } = installSelectorThrowingDocument();
    class Widget {}
    vi.stubGlobal("ToncastWidget", { ToncastWidget: Widget });
    const loader = await importFreshLoader();

    const src = 'https://cdn.example/widget.js?x="]';
    const loaded = loader.load(src);
    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.src).toBe(src);

    scripts[0]?.onload?.();
    await expect(loaded).resolves.toBe(Widget);
  });

  it("applies script security attributes when provided", async () => {
    const { scripts } = installFakeDocument();
    class Widget {}
    vi.stubGlobal("ToncastWidget", { ToncastWidget: Widget });
    const loader = await importFreshLoader();

    const loaded = loader.load("https://cdn.example/widget.js", {
      crossOrigin: "use-credentials",
      integrity: "sha384-test",
      nonce: "nonce-test",
    });

    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.crossOrigin).toBe("use-credentials");
    expect(scripts[0]?.integrity).toBe("sha384-test");
    expect(scripts[0]?.nonce).toBe("nonce-test");

    scripts[0]?.onload?.();
    await expect(loaded).resolves.toBe(Widget);
  });
});
