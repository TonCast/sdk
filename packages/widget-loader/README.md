# @toncast/widget-loader

Loads the hosted `@toncast/widget` IIFE bundle in the browser and returns the `ToncastWidget` constructor.

```ts
import ToncastWidgetLoader from "@toncast/widget-loader";

const Widget = await ToncastWidgetLoader.load();
const widget = new Widget({ /* ToncastWidgetConfig */ });
widget.mount(document.getElementById("toncast-widget")!);
```

Default export shape: **`{ load, WIDGET_CDN_JS_URL }`**.

## Container element

`mount(container)` accepts **any `Element`** — the loader and widget impose no
ID requirement. The `#toncast-widget` id used by the CDN snippet, this README,
and the constructor’s exported HTML/JS snippets is a **convention only**:
exported `style.css` from the widget-constructor scopes overrides under
`#toncast-widget { … }`, so keeping that id (or rewriting the CSS scope) is
necessary if you reuse the exported stylesheet verbatim. Pick any id you like
otherwise.

## CDN security

- Pass **`integrity`** (SRI hash) and set **`crossOrigin`** (typically `"anonymous"`) when you load the script from a CDN you do not fully control.
- Pin a **major-versioned** URL; bump the major path when you adopt breaking widget releases.
- If the CDN or hash is ever compromised, rotate the URL/version, publish new integrity values, and invalidate caches.

## Cache invalidation

The loader keeps an **in-memory** constructor cache keyed by
`(cdnUrl, integrity, crossOrigin, nonce)`. Same key → same constructor returned
synchronously without a re-fetch. The cache lives **for the JS realm** (page
lifetime); a full reload clears it.

What invalidates the cache:

- **Different `cdnUrl`** (e.g. switching from `/v0/` to `/v1/`) — fetched anew, gets its own constructor.
- **Different `integrity`/`crossOrigin`/`nonce`** for the same URL — old `<script>` tag is removed and the bundle is re-fetched (so a rotated SRI hash takes effect on the next `load()` call).
- **Invalid global** — if the script downloads but `window.ToncastWidget` is
  not a function (corrupted bundle, hijacked global), the loader removes its
  `<script>` tag and rejects; the next `load()` fetches a fresh copy.
- **Legacy tags** — `<script>` nodes with `data-tc-widget-loader` but no
  `data-tc-widget-loader-key` are treated as the default-empty-options key.
  Every `load()` that uses that default key **re-stamps** them with an explicit
  key so a later load with SRI/nonce can remove them deterministically (even
  when the constructor is already cached and no new `<script>` is injected).

What does **not** invalidate the cache:

- `timeoutMs` — controls a single attempt, not constructor identity.
- HTTP-level CDN cache headers — those govern the browser/CDN cache, not this in-memory map.

To force a fresh download in a long-lived SPA (e.g. after deploying a hotfix
behind the same `/v0/` URL), use a hard reload (`location.reload()`) — there is
no public API to evict a single key.

## DOM markers & timeout behaviour

The loader stamps every injected `<script>` with two attributes so external
tooling and concurrent `load()` calls can find or replace the right tag:

| Attribute                   | Value                                           | Purpose                                              |
| --------------------------- | ----------------------------------------------- | ---------------------------------------------------- |
| `data-tc-widget-loader`     | the resolved CDN URL                            | Identifies the script as belonging to this loader.   |
| `data-tc-widget-loader-key` | `${cdnUrl}\n${integrity}\n${crossOrigin}\n${nonce}` | Cache key. Different keys for the same URL replace.  |

Concurrent `load()` calls for **different URLs** are **serialized** so the
post-load read of `window.ToncastWidget` always corresponds to the script that
just resolved. Calls for the same URL are **deduped** via a single in-flight
promise.

`timeoutMs` (option) bounds a single load attempt:

- Omitted or `≤ 0` → wait indefinitely (browser default).
- `> 0` → reject after the deadline; the injected `<script>` is removed so a
  retry attempts a fresh fetch instead of short-circuiting.

`onerror` from the network removes the tag and rejects with
`Failed to load bundle from <url>`. Both timeout and network errors leave the
constructor cache untouched.

## SSR

`load()` throws if invoked without a `document` (Node, edge runtimes). Gate
behind `useEffect` / a `typeof window !== "undefined"` check in SSR
frameworks.

## Type duplication note

Types for `ToncastWidgetConfig` / events are **duplicated** in this package so the loader typechecks before the widget publishes `dist/*.d.ts` — when changing the widget’s public config, update `src/widgetTypes.ts` in the same release and keep `tests/types-contract.test.ts` green.

**Status:** 0.0.1 (pre–1.0.0). Pin exact versions until `1.0.0`.
