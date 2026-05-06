import { type UseQueryOptions, type UseQueryResult, useQuery } from "@tanstack/react-query";
import type { AvailableCoin, ListCoinsParams } from "@toncast/sdk";
import { useToncastClient } from "../client/useToncastClient";

/** TON + jetton balances. Requires `tonClient` on the underlying `ToncastClient`. */
export function useCoins(
  params: ListCoinsParams = {},
  options?: Omit<UseQueryOptions<AvailableCoin[]>, "queryKey" | "queryFn">,
): UseQueryResult<AvailableCoin[]> {
  const client = useToncastClient();
  return useQuery<AvailableCoin[]>({
    ...options,
    queryKey: ["toncast", "coins", "list", params.userAddress ?? client.getUserAddress() ?? null],
    queryFn: ({ signal }) => client.coins.list({ ...params, signal }),
  });
}
