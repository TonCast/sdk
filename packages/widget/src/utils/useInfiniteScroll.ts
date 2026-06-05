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
  // Read through a ref so the observer/listener can stay mounted across fetches
  // instead of being torn down and recreated (which would re-fire immediately
  // on the still-visible sentinel and cause the multi-page cascade).
  const isFetchingNextPageRef = useRef(isFetchingNextPage);
  isFetchingNextPageRef.current = isFetchingNextPage;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!enabled || !hasNextPage || !sentinel) return;

    const root = sentinel.closest(".tc-content");
    if (!(root instanceof HTMLElement)) return;

    const marginPx = Number.parseInt(rootMargin, 10) || 0;
    const inBottomZone = () => root.scrollHeight - root.scrollTop - root.clientHeight <= marginPx;

    // Edge-trigger: one load per entry into the bottom zone.
    let armed = true;
    const maybeLoadMore = () => {
      if (!inBottomZone()) {
        armed = true;
        return;
      }
      if (!armed || isFetchingNextPageRef.current) return;
      armed = false;
      void onLoadMoreRef.current();
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) maybeLoadMore();
        else armed = true;
      },
      { root, rootMargin, threshold: 0 },
    );
    observer.observe(sentinel);

    // Fallback for WebViews where IntersectionObserver with a containment root
    // doesn't fire (see doc comment). Harmless elsewhere — `maybeLoadMore` is
    // idempotent within a single bottom-zone entry thanks to `armed`.
    root.addEventListener("scroll", maybeLoadMore, { passive: true });

    return () => {
      observer.disconnect();
      root.removeEventListener("scroll", maybeLoadMore);
    };
  }, [enabled, hasNextPage, rootMargin]);

  return { sentinelRef };
}
