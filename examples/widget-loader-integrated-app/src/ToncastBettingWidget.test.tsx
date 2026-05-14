import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { TonConnectUIProvider } from "@tonconnect/ui-react";
import { createRef, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToncastBettingWidget, type ToncastBettingWidgetHandle } from "./ToncastBettingWidget";
import { readToncastWidgetCssVarsFromDocument } from "./widgetEmbedChrome";

const loaderMocks = vi.hoisted(() => {
  const mount = vi.fn();
  const unmount = vi.fn();
  const disposeSpy = vi.fn();
  const ctorSpy = vi.fn();
  const updateSpy = vi.fn();
  const instances: Array<{
    simulateBet: (p: unknown) => void;
    simulateError: (p: unknown) => void;
  }> = [];

  class MockWidget {
    private betHandlers: Array<(p: unknown) => void> = [];
    private errorHandlers: Array<(p: unknown) => void> = [];

    constructor(config: unknown) {
      ctorSpy(config);
      instances.push(this);
    }

    mount = mount;
    unmount = unmount;
    dispose = disposeSpy;
    update = updateSpy;

    on(event: string, fn: (p: unknown) => void) {
      if (event === "bet") this.betHandlers.push(fn);
      if (event === "error") this.errorHandlers.push(fn);
      return this;
    }

    off(event: string, fn: (p: unknown) => void) {
      if (event === "bet") {
        this.betHandlers = this.betHandlers.filter((h) => h !== fn);
      }
      if (event === "error") {
        this.errorHandlers = this.errorHandlers.filter((h) => h !== fn);
      }
      return this;
    }

    simulateBet(payload: unknown) {
      for (const h of this.betHandlers) {
        h(payload);
      }
    }

    simulateError(payload: unknown) {
      for (const h of this.errorHandlers) {
        h(payload);
      }
    }
  }

  return {
    mount,
    unmount,
    dispose: disposeSpy,
    ctorSpy,
    updateSpy,
    MockWidget,
    load: vi.fn().mockResolvedValue(MockWidget),
    instances,
    clearInstances() {
      instances.length = 0;
    },
    getLastInstance() {
      return instances[instances.length - 1];
    },
  };
});

vi.mock("@toncast/widget-loader", () => ({
  default: {
    load: loaderMocks.load,
    WIDGET_CDN_JS_URL: "https://widget.toncast.app/v0/index.iife.js",
  },
}));

function wrapTonConnect(ui: ReactElement) {
  return (
    <TonConnectUIProvider
      manifestUrl="https://test.local/tonconnect-manifest.json"
      analytics={{ mode: "off" }}
    >
      {ui}
    </TonConnectUIProvider>
  );
}

function renderWithTonConnect(ui: ReactElement) {
  return render(wrapTonConnect(ui), { reactStrictMode: false });
}

describe("ToncastBettingWidget", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url =
          typeof input === "string" ? input : input instanceof Request ? input.url : input.href;
        if (url.includes("tonconnect-manifest")) {
          return Response.json({
            url: "https://test.local",
            name: "Test",
            iconUrl: "https://test.local/icon.png",
          });
        }
        return Response.json([]);
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    loaderMocks.clearInstances();
  });

  it("calls ToncastWidgetLoader.load and mounts the widget with integrated TonConnect", async () => {
    renderWithTonConnect(<ToncastBettingWidget />);

    await waitFor(() => {
      expect(loaderMocks.load).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(loaderMocks.ctorSpy).toHaveBeenCalled();
    });

    const call = loaderMocks.ctorSpy.mock.calls[0]?.[0] as {
      tonconnect: { type: string; instance: unknown };
    };
    expect(call?.tonconnect?.type).toBe("integrated");
    expect(call?.tonconnect?.instance).toBeDefined();

    await waitFor(() => {
      expect(loaderMocks.mount).toHaveBeenCalled();
    });
    const mountArg = loaderMocks.mount.mock.calls[0]?.[0] as HTMLElement;
    expect(mountArg).toBeInstanceOf(HTMLDivElement);
    expect(mountArg?.dataset.testid).toBe("toncast-widget-root");
  });

  it("passes widget.theme in the Toncast config", async () => {
    renderWithTonConnect(<ToncastBettingWidget widgetTheme="dark" />);

    await waitFor(() => {
      expect(loaderMocks.ctorSpy).toHaveBeenCalled();
    });

    expect(loaderMocks.ctorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        widget: expect.objectContaining({
          theme: "dark",
          layout: expect.any(Object),
          cssVars: expect.any(Object),
          deriveCssVars: { colors: true, density: true },
          languages: expect.any(Array),
          language: "en",
        }),
      }),
    );
  });

  it("calls update when widgetTheme changes after mount", async () => {
    const view = renderWithTonConnect(<ToncastBettingWidget widgetTheme="light" />);

    await waitFor(() => {
      expect(loaderMocks.mount).toHaveBeenCalled();
    });

    view.rerender(wrapTonConnect(<ToncastBettingWidget widgetTheme="dark" />));

    await waitFor(() => {
      expect(loaderMocks.updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          widget: expect.objectContaining({ theme: "dark" }),
        }),
      );
    });
  });

  it("passes cdnUrl through to ToncastWidgetLoader.load", async () => {
    renderWithTonConnect(<ToncastBettingWidget cdnUrl="https://cdn.example/widget.iife.js" />);

    await waitFor(() => {
      expect(loaderMocks.load).toHaveBeenCalledWith("https://cdn.example/widget.iife.js");
    });
  });

  it("forwards widget bet events to onBet", async () => {
    const onBet = vi.fn();
    renderWithTonConnect(<ToncastBettingWidget onBet={onBet} />);

    await waitFor(() => {
      expect(loaderMocks.mount).toHaveBeenCalled();
    });

    const payload = { pariId: "p1", amount: 42n, side: "yes" as const };
    loaderMocks.getLastInstance()?.simulateBet(payload);

    await waitFor(() => {
      expect(onBet).toHaveBeenCalledWith(payload);
    });
  });

  it("forwards widget error events to onWidgetError", async () => {
    const onWidgetError = vi.fn();
    renderWithTonConnect(<ToncastBettingWidget onWidgetError={onWidgetError} />);

    await waitFor(() => {
      expect(loaderMocks.mount).toHaveBeenCalled();
    });

    const err = new Error("listener boom");
    loaderMocks.getLastInstance()?.simulateError(err);

    await waitFor(() => {
      expect(onWidgetError).toHaveBeenCalledWith(err);
    });
  });

  it("ref exposes unmount() and dispose() on the live instance", async () => {
    const r = createRef<ToncastBettingWidgetHandle>();
    renderWithTonConnect(<ToncastBettingWidget ref={r} />);

    await waitFor(() => {
      expect(loaderMocks.mount).toHaveBeenCalled();
    });

    expect(r.current).toBeTruthy();
    r.current?.unmount();
    expect(loaderMocks.unmount).toHaveBeenCalled();
    r.current?.dispose();
    expect(loaderMocks.dispose).toHaveBeenCalled();
  });

  it("disposes the widget instance when the host tree is removed", async () => {
    const { unmount } = renderWithTonConnect(<ToncastBettingWidget />);

    await waitFor(() => {
      expect(loaderMocks.mount).toHaveBeenCalled();
    });

    unmount();

    await waitFor(() => {
      expect(loaderMocks.dispose).toHaveBeenCalled();
    });
  });

  it("surfaces load failures in the UI and logs to console", async () => {
    const err = new Error("CDN down");
    loaderMocks.load.mockRejectedValueOnce(err);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    renderWithTonConnect(<ToncastBettingWidget />);

    expect(await screen.findByRole("alert")).toHaveTextContent("CDN down");
    expect(consoleSpy).toHaveBeenCalledWith("[ToncastBettingWidget] load failed:", err);

    consoleSpy.mockRestore();
    loaderMocks.load.mockResolvedValue(loaderMocks.MockWidget);
  });
});

describe("readToncastWidgetCssVarsFromDocument", () => {
  it("returns hex accents when host styles are loaded (setupTests imports host.css)", () => {
    const css = readToncastWidgetCssVarsFromDocument();
    expect(css.dark?.accent).toMatch(/^#/);
    expect(css.light?.accent).toMatch(/^#/);
    expect(css.radius).toBeTruthy();
  });
});
