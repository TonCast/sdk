/**
 * Copies text to the system clipboard.
 * Prefers the modern `navigator.clipboard` API and falls back to
 * `document.execCommand("copy")` for non-secure origins.
 *
 * @param text - Text to copy. Empty string is valid and copies nothing visible.
 * @param onError - Optional callback invoked with the caught error (e.g. for logging).
 * @returns `true` on success, `false` on failure (never throws).
 */
export async function copyToClipboard(
  text: string,
  onError?: (err: unknown) => void,
): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    if (typeof document === "undefined" || !document.body) return false;

    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", ""); // prevents virtual keyboard on mobile
    Object.assign(ta.style, {
      position: "fixed",
      left: "-9999px",
      top: "-9999px",
    });

    document.body.appendChild(ta);
    try {
      ta.select();
      ta.setSelectionRange(0, text.length); // iOS Safari fix
      return document.execCommand("copy");
    } finally {
      ta.remove();
    }
  } catch (err) {
    onError?.(err);
    return false;
  }
}