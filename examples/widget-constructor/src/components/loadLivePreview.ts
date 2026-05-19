/** Code-split entry for live preview (shared by `React.lazy` and idle prefetch). */
export function loadLivePreview() {
  return import("./LivePreview");
}
