/** Official Telegram Web App bridge (required before `Telegram.WebApp` calls). */
export const TELEGRAM_WEB_APP_SCRIPT_URL = "https://telegram.org/js/telegram-web-app.js";

/**
 * Body padding for Mini App shells: top / right / left only.
 * Bottom is intentionally omitted — it is handled directly by .tc-nav inside
 * the widget CSS (native-app pattern: TabBar owns the home-indicator inset).
 * This prevents double-counting when the widget fills the whole viewport.
 */
export const TG_SAFE_AREA_BODY_PADDING_CSS = `padding:
        max(env(safe-area-inset-top, 0px), var(--tg-safe-area-inset-top, 0px))
        max(env(safe-area-inset-right, 0px), var(--tg-safe-area-inset-right, 0px))
        0
        max(env(safe-area-inset-left, 0px), var(--tg-safe-area-inset-left, 0px));`;

/** Inline script: expand + fullscreen + no vertical swipe-to-dismiss; sync safe-area CSS vars. */
export function buildTelegramHostInitScript(): string {
  return `(function initToncastTelegramHost() {
        var tg = window.Telegram && window.Telegram.WebApp;
        if (!tg) return;
        function applySafeAreaInsets() {
          // In fullscreen mode both objects are non-zero: safeAreaInset covers the
          // device notch/home-bar, contentSafeAreaInset covers TG UI overlays
          // (header, swipe handle, etc.). Sum them so content clears both layers.
          var sa  = tg.safeAreaInset        || {};
          var csa = tg.contentSafeAreaInset || {};
          var root = document.documentElement;
          root.style.setProperty("--tg-safe-area-inset-top",    ((sa.top    || 0) + (csa.top    || 0)) + "px");
          root.style.setProperty("--tg-safe-area-inset-right",  ((sa.right  || 0) + (csa.right  || 0)) + "px");
          root.style.setProperty("--tg-safe-area-inset-bottom", ((sa.bottom || 0) + (csa.bottom || 0)) + "px");
          root.style.setProperty("--tg-safe-area-inset-left",   ((sa.left   || 0) + (csa.left   || 0)) + "px");
        }
        // isVersionAtLeast() is available from Bot API 6.0 and is the only
        // reliable way to gate version-specific APIs. typeof-checks are NOT
        // enough — stub functions exist on all versions but throw or warn when
        // called on unsupported clients (e.g. "not supported in version 6.0").
        var v = typeof tg.isVersionAtLeast === "function"
          ? function(ver) { return tg.isVersionAtLeast(ver); }
          : function() { return false; };
        tg.ready();
        tg.expand();
        if (v("7.7") && typeof tg.disableVerticalSwipes === "function") {
          tg.disableVerticalSwipes();
        }
        if (v("7.7") && typeof tg.requestFullscreen === "function") {
          try { tg.requestFullscreen(); } catch (e) { /* unsupported in this host */ }
        }
        applySafeAreaInsets();
        if (typeof tg.onEvent === "function") {
          tg.onEvent("safeAreaChanged", applySafeAreaInsets);
          tg.onEvent("contentSafeAreaChanged", applySafeAreaInsets);
          tg.onEvent("fullscreenChanged", applySafeAreaInsets);
          // Re-apply on collapse/expand: viewportChanged fires when the Mini App
          // is minimised or restored, at which point safe-area values can shift.
          tg.onEvent("viewportChanged", applySafeAreaInsets);
        }
      })();`;
}
