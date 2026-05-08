import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type FakeScript = {
  async?: boolean;
  attrs: Record<string, string>;
  crossOrigin?: string;
  getAttribute: (name: string) => string | null;
  hasAttribute: (name: string) => boolean;
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
        hasAttribute(name) {
          return this.attrs[name] !== undefined;
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
        hasAttribute(name) {
          return this.attrs[name] !== undefined;
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
    expect(scripts[0]?.getAttribute("data-tc-widget-loader-key")).toContain(
      "https://cdn.example/widget.js",
    );
  });

  it("allows retrying after a failed script load", async () => {
    const { scripts } = installFakeDocument();
    const loader = await importFreshLoader();

    const first = loader.load("https://cdn.example/widget.js");
    expect(scripts).toHaveLength(1);
    const failure = first.catch((err: unknown) => err);
    scripts[0]?.onerror?.();
    const err = await failure;
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain("Failed to load bundle");
    expect(scripts).toHaveLength(0);

    class Widget {}
    vi.stubGlobal("ToncastWidget", { ToncastWidget: Widget });
    const second = loader.load("https://cdn.example/widget.js");
    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.src).toBe("https://cdn.example/widget.js");
    scripts[0]?.onload?.();
    await expect(second).resolves.toBe(Widget);
  });

  it("caches constructors separately per cdnUrl", async () => {
    const { scripts } = installFakeDocument();
    class WidgetA {}
    class WidgetB {}
    vi.stubGlobal("ToncastWidget", { ToncastWidget: WidgetA });
    const loader = await importFreshLoader();

    const first = loader.load("https://cdn.example/a.js");
    expect(scripts).toHaveLength(1);
    scripts[0]?.onload?.();
    await expect(first).resolves.toBe(WidgetA);

    vi.stubGlobal("ToncastWidget", { ToncastWidget: WidgetB });
    const second = loader.load("https://cdn.example/b.js");
    expect(scripts).toHaveLength(2);
    scripts[1]?.onload?.();
    await expect(second).resolves.toBe(WidgetB);

    await expect(loader.load("https://cdn.example/a.js")).resolves.toBe(WidgetA);
    await expect(loader.load("https://cdn.example/b.js")).resolves.toBe(WidgetB);
    expect(scripts).toHaveLength(2);
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

  it("replaces the script tag when integrity changes for the same URL and keeps separate ctor caches", async () => {
    const { scripts } = installFakeDocument();
    const url = "https://cdn.example/widget.js";
    class WidgetPlain {}
    vi.stubGlobal("ToncastWidget", { ToncastWidget: WidgetPlain });
    const loader = await importFreshLoader();

    const plain = loader.load(url);
    expect(scripts).toHaveLength(1);
    scripts[0]?.onload?.();
    await expect(plain).resolves.toBe(WidgetPlain);

    class WidgetSri {}
    vi.stubGlobal("ToncastWidget", { ToncastWidget: WidgetSri });
    const sri = loader.load(url, { integrity: "sha384-abc" });
    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.integrity).toBe("sha384-abc");
    scripts[0]?.onload?.();
    await expect(sri).resolves.toBe(WidgetSri);

    await expect(loader.load(url)).resolves.toBe(WidgetPlain);
    await expect(loader.load(url, { integrity: "sha384-abc" })).resolves.toBe(WidgetSri);
  });
});
