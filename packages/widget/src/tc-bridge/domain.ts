/** Absolute http(s) manifest URL, or `null` if `domain` is not usable for TonConnect standalone. */
export function tryTonConnectManifestUrl(domain: string): string | null {
  let url: URL;
  try {
    url = new URL(domain);
  } catch {
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return null;
  }

  url.hash = "";
  url.search = "";
  url.pathname = `${url.pathname.replace(/\/$/, "")}/tonconnect-manifest.json`;
  return url.toString();
}

export function toTonConnectManifestUrl(domain: string): string {
  const manifest = tryTonConnectManifestUrl(domain);
  if (!manifest) {
    throw new Error("[ToncastWidget] tonconnect standalone domain must be an absolute http(s) URL");
  }
  return manifest;
}
