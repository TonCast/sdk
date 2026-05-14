import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type FakeHeadChild = {
  tagName: string;
  async?: boolean;
  attrs: Record<string, string>;
  crossOrigin?: string;
  getAttribute: (name: string) => string | null;
  hasAttribute: (name: string) => boolean;
  href?: string;
  integrity?: string;
  nonce?: string;
  onerror?: () => void;
  onload?: () => void;
  remove: () => void;
  src?: string;
  rel?: string;
  setAttribute: (name: string, value: string) => void;
  removeAttribute: (name: string) => void;
};

function installFakeDocument(options?: { querySelectorThrows: boolean }) {
  const headChildren: FakeHeadChild[] = [];
  const document = {
    createElement(tag: string) {
      const tagName = tag.toUpperCase();
      const el: FakeHeadChild = {
        tagName,
        attrs: {},
        remove() {
          const index = headChildren.indexOf(this);
          if (index !== -1) headChildren.splice(index, 1);
        },
        getAttribute(name) {
          return this.attrs[name] ?? null;
        },
        hasAttribute(name) {
          return this.attrs[name] !== undefined;
        },
        setAttribute(name, value) {
          this.attrs[name] = value;
          if (name === "src") this.src = value;
          if (name === "href") this.href = value;
          if (name === "rel") this.rel = value;
        },
        removeAttribute(name) {
          delete this.attrs[name];
          if (name === "src") this.src = undefined;
          if (name === "href") this.href = undefined;
          if (name === "rel") this.rel = undefined;
        },
      };
      return el;
    },
    head: {
      appendChild(child: FakeHeadChild) {
        headChildren.push(child);
      },
    },
    get scripts() {
      return headChildren.filter((e) => e.tagName === "SCRIPT");
    },
    get links() {
      return headChildren.filter((e) => e.tagName === "LINK");
    },
    querySelector(selector: string) {
      if (options?.querySelectorThrows) {
        throw new DOMException("Invalid selector", "SyntaxError");
      }
      const match = selector.match(/^script\[data-tc-widget-loader="(.+)"\]$/);
      if (!match) return null;
      return (
        headChildren.find(
          (e) =>
            e.tagName === "SCRIPT" &&
            e.attrs["data-tc-widget-loader"] === match[1],
        ) ?? null
      );
    },
    querySelectorAll(selector: string): FakeHeadChild[] {
      if (!selector.includes("data-toncast-widget-css")) return [];
      return headChildren.filter(
        (e) =>
          e.tagName === "LINK" &&
          e.attrs["data-toncast-widget-css"] !== undefined,
      );
    },
  };
  vi.stubGlobal("document", document);
  return {
    get scripts() {
      return headChildren.filter((e) => e.tagName === "SCRIPT");
    },
    get links() {
      return headChildren.filter((e) => e.tagName === "LINK");
    },
  };
}

function installSelectorThrowingDocument() {
  return installFakeDocument({ querySelectorThrows: true });
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
    const doc = installFakeDocument();
    class Widget {}
    vi.stubGlobal("ToncastWidget", { ToncastWidget: Widget });
    const loader = await importFreshLoader();

    const first = loader.load("https://cdn.example/widget.js");
    expect(doc.links).toHaveLength(0);
    expect(doc.scripts).toHaveLength(1);
    doc.scripts[0]?.onload?.();

    await expect(first).resolves.toBe(Widget);
    await expect(loader.load("https://cdn.example/widget.js")).resolves.toBe(
      Widget,
    );
    expect(doc.scripts).toHaveLength(1);
    expect(doc.scripts[0]?.getAttribute("data-tc-widget-loader-key")).toContain(
      "https://cdn.example/widget.js",
    );
  });

  it("re-stamps script tags missing data-tc-widget-loader-key on a subsequent default load()", async () => {
    const doc = installFakeDocument();
    class Widget {}
    vi.stubGlobal("ToncastWidget", { ToncastWidget: Widget });
    const loader = await importFreshLoader();
    const src = "https://cdn.example/widget.js";

    const first = loader.load(src);
    doc.scripts[0]?.onload?.();
    await first;

    doc.scripts[0]?.removeAttribute("data-tc-widget-loader-key");
    expect(doc.scripts[0]?.hasAttribute("data-tc-widget-loader-key")).toBe(
      false,
    );

    await expect(loader.load(src)).resolves.toBe(Widget);
    expect(doc.scripts).toHaveLength(1);
    expect(doc.scripts[0]?.getAttribute("data-tc-widget-loader-key")).toContain(
      src,
    );
  });

  it("allows retrying after a failed script load", async () => {
    const doc = installFakeDocument();
    const loader = await importFreshLoader();

    const first = loader.load("https://cdn.example/widget.js");
    expect(doc.scripts).toHaveLength(1);
    const failure = first.catch((err: unknown) => err);
    doc.scripts[0]?.onerror?.();
    const err = await failure;
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain("Failed to load bundle");
    expect(doc.scripts).toHaveLength(0);

    class Widget {}
    vi.stubGlobal("ToncastWidget", { ToncastWidget: Widget });
    const second = loader.load("https://cdn.example/widget.js");
    expect(doc.scripts).toHaveLength(1);
    expect(doc.scripts[0]?.src).toBe("https://cdn.example/widget.js");
    doc.scripts[0]?.onload?.();
    await expect(second).resolves.toBe(Widget);
  });

  it("caches constructors separately per cdnUrl", async () => {
    const doc = installFakeDocument();
    class WidgetA {}
    class WidgetB {}
    vi.stubGlobal("ToncastWidget", { ToncastWidget: WidgetA });
    const loader = await importFreshLoader();

    const first = loader.load("https://cdn.example/a.js");
    expect(doc.scripts).toHaveLength(1);
    doc.scripts[0]?.onload?.();
    await expect(first).resolves.toBe(WidgetA);

    vi.stubGlobal("ToncastWidget", { ToncastWidget: WidgetB });
    const second = loader.load("https://cdn.example/b.js");
    expect(doc.scripts).toHaveLength(2);
    doc.scripts[1]?.onload?.();
    await expect(second).resolves.toBe(WidgetB);

    await expect(loader.load("https://cdn.example/a.js")).resolves.toBe(
      WidgetA,
    );
    await expect(loader.load("https://cdn.example/b.js")).resolves.toBe(
      WidgetB,
    );
    expect(doc.scripts).toHaveLength(2);
    expect(doc.links).toHaveLength(0);
  });

  it("loads custom URLs that are unsafe inside CSS selectors", async () => {
    const doc = installSelectorThrowingDocument();
    class Widget {}
    vi.stubGlobal("ToncastWidget", { ToncastWidget: Widget });
    const loader = await importFreshLoader();

    const src = 'https://cdn.example/widget.js?x="]';
    const loaded = loader.load(src);
    expect(doc.links).toHaveLength(0);
    expect(doc.scripts).toHaveLength(1);
    expect(doc.scripts[0]?.src).toBe(src);

    doc.scripts[0]?.onload?.();
    await expect(loaded).resolves.toBe(Widget);
  });

  it("applies script security attributes when provided", async () => {
    const doc = installFakeDocument();
    class Widget {}
    vi.stubGlobal("ToncastWidget", { ToncastWidget: Widget });
    const loader = await importFreshLoader();

    const loaded = loader.load("https://cdn.example/widget.js", {
      crossOrigin: "use-credentials",
      integrity: "sha384-test",
      nonce: "nonce-test",
    });

    expect(doc.scripts).toHaveLength(1);
    expect(doc.scripts[0]?.crossOrigin).toBe("use-credentials");
    expect(doc.scripts[0]?.integrity).toBe("sha384-test");
    expect(doc.scripts[0]?.nonce).toBe("nonce-test");

    doc.scripts[0]?.onload?.();
    await expect(loaded).resolves.toBe(Widget);
  });

  it("rejects synchronously with a clear message when document is undefined (SSR)", async () => {
    vi.unstubAllGlobals();
    vi.stubGlobal("document", undefined);
    const loader = await importFreshLoader();
    await expect(
      loader.load("https://cdn.example/widget.js"),
    ).rejects.toThrowError(/requires a browser environment/);
  });

  it("defaults crossOrigin to 'anonymous' when integrity is set without explicit crossOrigin", async () => {
    const doc = installFakeDocument();
    class Widget {}
    vi.stubGlobal("ToncastWidget", { ToncastWidget: Widget });
    const loader = await importFreshLoader();

    const loaded = loader.load("https://cdn.example/widget.js", {
      integrity: "sha384-abc",
    });
    expect(doc.scripts).toHaveLength(1);
    expect(doc.scripts[0]?.integrity).toBe("sha384-abc");
    expect(doc.scripts[0]?.crossOrigin).toBe("anonymous");
    doc.scripts[0]?.onload?.();
    await expect(loaded).resolves.toBe(Widget);
  });

  it("accepts a CDN bundle that exposes window.ToncastWidget directly as the constructor", async () => {
    const doc = installFakeDocument();
    class Widget {}
    vi.stubGlobal("ToncastWidget", Widget);
    const loader = await importFreshLoader();

    const loaded = loader.load("https://cdn.example/widget.js");
    doc.scripts[0]?.onload?.();
    await expect(loaded).resolves.toBe(Widget);
  });

  it("rejects when window.ToncastWidget is set but is not a constructor", async () => {
    const doc = installFakeDocument();
    vi.stubGlobal("ToncastWidget", { ToncastWidget: 42 });
    const loader = await importFreshLoader();

    const loaded = loader.load("https://cdn.example/widget.js");
    doc.scripts[0]?.onload?.();
    await expect(loaded).rejects.toThrowError(/is not a constructor/);
    expect(doc.scripts).toHaveLength(0);
  });

  it("after invalid ctor the script is gone so a retry injects a fresh tag", async () => {
    const doc = installFakeDocument();
    vi.stubGlobal("ToncastWidget", { ToncastWidget: 42 });
    const loader = await importFreshLoader();

    const first = loader.load("https://cdn.example/widget.js");
    expect(doc.scripts).toHaveLength(1);
    doc.scripts[0]?.onload?.();
    await expect(first).rejects.toThrowError(/is not a constructor/);
    expect(doc.scripts).toHaveLength(0);

    class Widget {}
    vi.stubGlobal("ToncastWidget", { ToncastWidget: Widget });
    const second = loader.load("https://cdn.example/widget.js");
    expect(doc.scripts).toHaveLength(1);
    doc.scripts[0]?.onload?.();
    await expect(second).resolves.toBe(Widget);
  });

  it("rejects with a timeout error and removes the script tag when timeoutMs elapses", async () => {
    vi.useFakeTimers();
    try {
      const doc = installFakeDocument();
      const loader = await importFreshLoader();

      const loaded = loader.load("https://cdn.example/widget.js", {
        timeoutMs: 250,
      });
      expect(doc.scripts).toHaveLength(1);
      const failure = loaded.catch((err: unknown) => err);
      vi.advanceTimersByTime(250);
      const err = await failure;
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/Timed out after 250ms/);
      expect(doc.scripts).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("clears the timeout timer when the script loads before the deadline", async () => {
    vi.useFakeTimers();
    try {
      const doc = installFakeDocument();
      class Widget {}
      vi.stubGlobal("ToncastWidget", { ToncastWidget: Widget });
      const loader = await importFreshLoader();

      const loaded = loader.load("https://cdn.example/widget.js", {
        timeoutMs: 1_000,
      });
      doc.scripts[0]?.onload?.();
      await expect(loaded).resolves.toBe(Widget);
      vi.advanceTimersByTime(5_000);
      expect(doc.scripts).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("replaces the script tag when integrity changes for the same URL and keeps separate ctor caches", async () => {
    const doc = installFakeDocument();
    const url = "https://cdn.example/widget.js";
    class WidgetPlain {}
    vi.stubGlobal("ToncastWidget", { ToncastWidget: WidgetPlain });
    const loader = await importFreshLoader();

    const plain = loader.load(url);
    expect(doc.scripts).toHaveLength(1);
    doc.scripts[0]?.onload?.();
    await expect(plain).resolves.toBe(WidgetPlain);

    class WidgetSri {}
    vi.stubGlobal("ToncastWidget", { ToncastWidget: WidgetSri });
    const sri = loader.load(url, { integrity: "sha384-abc" });
    expect(doc.scripts).toHaveLength(1);
    expect(doc.scripts[0]?.integrity).toBe("sha384-abc");
    doc.scripts[0]?.onload?.();
    await expect(sri).resolves.toBe(WidgetSri);

    await expect(loader.load(url)).resolves.toBe(WidgetPlain);
    await expect(loader.load(url, { integrity: "sha384-abc" })).resolves.toBe(
      WidgetSri,
    );
  });
});
