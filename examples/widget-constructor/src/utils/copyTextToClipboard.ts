/**
 * Copies text to the system clipboard. Prefers `navigator.clipboard` and falls
 * back to `document.execCommand("copy")` for non-secure origins (no HTTPS).
 */
export async function copyTextToClipboard(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && typeof navigator.clipboard?.writeText === "function") {
    await navigator.clipboard.writeText(text);
    return;
  }
  if (typeof document === "undefined") {
    throw new Error("copyTextToClipboard requires a browser environment");
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  try {
    const ok = document.execCommand("copy");
    if (!ok) throw new Error("execCommand(copy) returned false");
  } finally {
    ta.remove();
  }
}
