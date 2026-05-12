# @toncast/widget-loader

Loads the hosted `@toncast/widget` IIFE bundle in the browser and returns the `ToncastWidget` constructor.

```ts
import ToncastWidgetLoader from "@toncast/widget-loader";

const Widget = await ToncastWidgetLoader.load();
const widget = new Widget({ /* ToncastWidgetConfig */ });
widget.mount(document.getElementById("root")!);
```

Default export shape: **`{ load, WIDGET_CDN_JS_URL }`**.

## CDN security

- Pass **`integrity`** (SRI hash) and set **`crossOrigin`** (typically `"anonymous"`) when you load the script from a CDN you do not fully control.
- Pin a **major-versioned** URL; bump the major path when you adopt breaking widget releases.
- If the CDN or hash is ever compromised, rotate the URL/version, publish new integrity values, and invalidate caches.

Types for `ToncastWidgetConfig` / events are **duplicated** in this package so the loader typechecks before the widget publishes `dist/*.d.ts` — when changing the widget’s public config, update `src/widgetTypes.ts` in the same release (see [`docs/PUBLIC_API.md`](../../docs/PUBLIC_API.md)).

**Status:** 0.0.1 (pre–1.0.0). Pin exact versions until `1.0.0`.
