export function toTonConnectManifestUrl(domain: string): string {
  let url: URL;
  try {
    url = new URL(domain);
  } catch {
    throw new Error("[ToncastWidget] tonconnect standalone domain must be an absolute http(s) URL");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("[ToncastWidget] tonconnect standalone domain must be an absolute http(s) URL");
  }

  url.hash = "";
  url.search = "";
  url.pathname = `${url.pathname.replace(/\/$/, "")}/tonconnect-manifest.json`;
  return url.toString();
}
