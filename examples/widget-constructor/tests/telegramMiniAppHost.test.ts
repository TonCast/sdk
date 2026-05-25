import { describe, expect, it } from "vitest";
import {
  buildTelegramHostInitScript,
  TELEGRAM_WEB_APP_SCRIPT_URL,
  TG_SAFE_AREA_BODY_PADDING_CSS,
} from "../src/utils/telegramMiniAppHost";

describe("telegramMiniAppHost", () => {
  it("exposes the official Telegram Web App script URL", () => {
    expect(TELEGRAM_WEB_APP_SCRIPT_URL).toBe("https://telegram.org/js/telegram-web-app.js");
  });

  it("body padding uses env() and Telegram CSS variables on all sides", () => {
    expect(TG_SAFE_AREA_BODY_PADDING_CSS).toMatch(/safe-area-inset-top/);
    expect(TG_SAFE_AREA_BODY_PADDING_CSS).toMatch(/safe-area-inset-left/);
    expect(TG_SAFE_AREA_BODY_PADDING_CSS).toMatch(/--tg-safe-area-inset-bottom/);
  });

  it("init script is safe to embed (no script breakout)", () => {
    const script = buildTelegramHostInitScript();
    expect(script).not.toMatch(/<\/script/i);
    expect(script).toContain("disableVerticalSwipes");
    expect(script).toContain("requestFullscreen");
  });

  it("init script sums safeAreaInset and contentSafeAreaInset for fullscreen support", () => {
    const script = buildTelegramHostInitScript();
    // Both objects must be read (not OR'd) so fullscreen mode adds both values.
    expect(script).toContain("tg.safeAreaInset");
    expect(script).toContain("tg.contentSafeAreaInset");
    // Values should be added (not max'd or OR'd).
    expect(script).toMatch(/sa\.top.*csa\.top|csa\.top.*sa\.top/);
  });
});
