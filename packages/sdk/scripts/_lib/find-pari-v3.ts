import type { ToncastClient } from "../../src";

/**
 * Returns the first active pari with `version === 'v3'` from the live feed.
 * Used by the betting smoke scripts so they always target a v3 contract
 * (legacy v1/v2 paris use a different settlement flow).
 */
export async function findActivePariV3(client: ToncastClient) {
  const page = await client.paris.list({ feed: "active", limit: 50 });
  const v3 = page.items.find((p) => p.version === "v3" && p.status === "active");
  if (!v3) throw new Error("No active v3 pari found in the active feed (try later)");
  return v3;
}
