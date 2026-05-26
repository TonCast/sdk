import { useEffect, useRef } from "react";

const DEFAULT_ROOT_MARGIN = "240px";

export interface UseInfiniteScrollOptions {
  enabled: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void | Promise<void>;
  /** Passed to `IntersectionObserver` (e.g. `"240px"`). */
  rootMargin?: string;
}

/**
 * Observes a sentinel node and calls `onLoadMore` when it enters the widget
 * scroll container (`.tc-content`).
 */
export function useInfiniteScroll({
  enabled,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  rootMargin = DEFAULT_ROOT_MARGIN,
}: UseInfiniteScrollOptions) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!enabled || !hasNextPage || !sentinel) return;

    const root = sentinel.closest(".tc-content");
    if (!(root instanceof Element)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || isFetchingNextPage) return;
        void onLoadMoreRef.current();
      },
      { root, rootMargin, threshold: 0 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [enabled, hasNextPage, isFetchingNextPage, rootMargin]);

  return { sentinelRef };
}
