import { type UseQueryOptions, type UseQueryResult, useQuery } from "@tanstack/react-query";
import { type AvailableCoin, type ListCoinsParams, parseTonAddress } from "@toncast/sdk";
import { useToncastClient } from "../client/useToncastClient";
import { toncastQueryKeys } from "../queryKeys";

/** TON + jetton balances. Requires `tonClient` on the underlying `ToncastClient`. */
export function useCoins(
  params: ListCoinsParams = {},
  options?: Omit<UseQueryOptions<AvailableCoin[]>, "queryKey" | "queryFn">,
): UseQueryResult<AvailableCoin[]> {
  const client = useToncastClient();
  const resolvedAddress =
    params.userAddress !== undefined
      ? parseTonAddress(params.userAddress, "userAddress")
      : (client.getUserAddress() ?? null);
  return useQuery<AvailableCoin[]>({
    ...options,
    queryKey: toncastQueryKeys.coins.list(resolvedAddress),
    queryFn: ({ signal }) => client.coins.list({ ...params, signal }),
  });
}
