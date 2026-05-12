import { type UseQueryOptions, type UseQueryResult, useQuery } from "@tanstack/react-query";
import type { Category, CategoryFilter } from "@toncast/sdk";
import { useToncastClient } from "../client/useToncastClient";

/** Localised category list. The SDK already caches forever per language —
 * TanStack Query simply mirrors that cache to React. */
export function useCategories(
  options?: Omit<UseQueryOptions<Category[]>, "queryKey" | "queryFn">,
): UseQueryResult<Category[]> {
  const client = useToncastClient();
  return useQuery<Category[]>({
    ...options,
    queryKey: ["toncast", "categories", client.getLanguage()],
    queryFn: () => client.categories.list(),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

/** UI-ready category/feed filters. Use this for chips that pass `param`
 * directly into `useStreamList` / `client.paris.streamList`. */
export function useCategoryFilters(
  options?: Omit<UseQueryOptions<CategoryFilter[]>, "queryKey" | "queryFn">,
): UseQueryResult<CategoryFilter[]> {
  const client = useToncastClient();
  return useQuery<CategoryFilter[]>({
    ...options,
    queryKey: ["toncast", "category-filters", client.getLanguage()],
    queryFn: () => client.categories.listFilters(),
    staleTime: Number.POSITIVE_INFINITY,
  });
}
