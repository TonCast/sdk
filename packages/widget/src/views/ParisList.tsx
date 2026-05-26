import { ALL_CATEGORY_FILTER, type CategoryFilter, isBenignFetchError } from "@toncast/sdk";
import { useCategoryFilters, useStreamList } from "@toncast/sdk-react";
import { useCallback, useEffect, useState } from "react";
import { PariCard } from "../components/PariCard";
import { PariCardSkeleton } from "../components/PariCardSkeleton";
import { Button } from "../components/ui/Button";
import { SkeletonList } from "../components/ui/SkeletonList";
import { useT } from "../i18n/useT";
import { categoryFilterChipKey, categoryFilterChipLabel } from "../utils/categoryFilterChipLabel";
import { useInfiniteScroll } from "../utils/useInfiniteScroll";

export function ParisListView() {
  const t = useT();
  const categories = useCategoryFilters();
  const [active, setActive] = useState<CategoryFilter | null>(null);

  useEffect(() => {
    if (!active || !categories.data) return;
    const activeKey = JSON.stringify(active.param);
    const stillExists = categories.data.some((c) => JSON.stringify(c.param) === activeKey);
    if (!stillExists) setActive(null);
  }, [categories.data, active]);

  const current = active ?? categories.data?.[0] ?? ALL_CATEGORY_FILTER;
  const {
    data,
    isLoading,
    isError,
    error,
    isFetching,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPageError,
    fetchNextPage,
  } = useStreamList(current.param, { keepPreviousData: false });

  const handleLoadMore = useCallback(() => fetchNextPage(), [fetchNextPage]);
  const { sentinelRef } = useInfiniteScroll({
    enabled: true,
    hasNextPage,
    isFetchingNextPage,
    onLoadMore: handleLoadMore,
  });

  const items = data ?? [];
  const hasItems = items.length > 0;
  const showBlockingError =
    isError && !isBenignFetchError(error) && !hasItems && !(isLoading || isFetching);
  const showInlineError = isError && !isBenignFetchError(error) && hasItems;
  const showInitialSkeleton = (isLoading || isFetching) && !hasItems && !showBlockingError;
  const showPaginationError =
    fetchNextPageError !== undefined && !isBenignFetchError(fetchNextPageError);

  return (
    <div className="tc-form-col">
      <h2 className="tc-page-title">{t("page.paris.title")}</h2>

      <div className="tc-category-bar">
        {categories.isLoading ? (
          <SkeletonList
            count={4}
            wrapperClassName={null}
            itemStyle={{ width: 56, height: 28, borderRadius: 999, flexShrink: 0 }}
          />
        ) : categories.isError ? (
          <span className="tc-text-sm tc-text-muted">{t("category.loadFailed")}</span>
        ) : (
          categories.data?.map((c) => (
            <Button
              key={categoryFilterChipKey(c)}
              variant={current.name === c.name ? "primary" : "secondary"}
              size="sm"
              className="tc-btn-rounded tc-category-chip"
              onClick={() => setActive(c)}
            >
              {categoryFilterChipLabel(c, t)}
            </Button>
          ))
        )}
      </div>

      {showBlockingError ? (
        <div className="tc-error">
          {t("page.paris.loadFailed", {
            error: error instanceof Error ? error.message : String(error),
          })}
        </div>
      ) : showInitialSkeleton ? (
        <div className="tc-pari-grid">
          {Array.from({ length: 8 }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list, order never changes
            <PariCardSkeleton key={`pari-skel-${i}`} />
          ))}
        </div>
      ) : !hasItems ? (
        <div className="tc-empty">{t("page.paris.empty")}</div>
      ) : (
        <>
          {showInlineError && (
            <div className="tc-error-sm">
              {t("page.paris.loadFailedInline", {
                error: error instanceof Error ? error.message : String(error),
              })}
            </div>
          )}
          <div className="tc-pari-grid">
            {items.map((p) => (
              <PariCard key={p.id} pari={p} />
            ))}
          </div>
          {isFetchingNextPage ? (
            <div className="tc-pari-grid tc-pari-grid-more">
              {Array.from({ length: 4 }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list, order never changes
                <PariCardSkeleton key={`pari-more-skel-${i}`} />
              ))}
            </div>
          ) : null}
          {showPaginationError ? (
            <div className="tc-error-sm">
              {t("pagination.loadMoreFailed", {
                error:
                  fetchNextPageError instanceof Error
                    ? fetchNextPageError.message
                    : String(fetchNextPageError),
              })}
            </div>
          ) : null}
          <div ref={sentinelRef} className="tc-infinite-scroll-sentinel" aria-hidden="true" />
        </>
      )}
    </div>
  );
}
