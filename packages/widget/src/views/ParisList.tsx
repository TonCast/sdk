import { ALL_CATEGORY_FILTER, type CategoryFilter } from "@toncast/sdk";
import { useCategoryFilters, useStreamList } from "@toncast/sdk-react";
import { useEffect, useState } from "react";
import { PariCard } from "../components/PariCard";
import { Button } from "../components/ui/Button";
import { SkeletonList } from "../components/ui/SkeletonList";
import { useT } from "../i18n/useT";

export function ParisListView() {
  const t = useT();
  const categories = useCategoryFilters();
  const [active, setActive] = useState<CategoryFilter | null>(null);

  // If categories are refetched and the selected category no longer exists
  // (e.g. removed server-side), reset so the user isn't stuck on a ghost filter.
  useEffect(() => {
    if (!active || !categories.data) return;
    const activeKey = JSON.stringify(active.param);
    const stillExists = categories.data.some((c) => JSON.stringify(c.param) === activeKey);
    if (!stillExists) setActive(null);
  }, [categories.data, active]);

  const current = active ?? categories.data?.[0] ?? ALL_CATEGORY_FILTER;
  const { data, isLoading, isError, error } = useStreamList(current.param);

  return (
    <div className="tc-form-col">
      <h2 className="tc-page-title">{t("page.paris.title")}</h2>

      {/* Category filter */}
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
              key={c.name}
              variant={current.name === c.name ? "primary" : "secondary"}
              size="sm"
              className="tc-btn-rounded tc-category-chip"
              onClick={() => setActive(c)}
            >
              {c.name === ALL_CATEGORY_FILTER.name ? t("category.all") : c.name}
            </Button>
          ))
        )}
      </div>

      {isError ? (
        <div className="tc-error">
          {t("page.paris.loadFailed", {
            error: error instanceof Error ? error.message : String(error),
          })}
        </div>
      ) : isLoading || !data ? (
        <SkeletonList
          count={8}
          itemStyle={{ aspectRatio: "1 / 1.5" }}
          wrapperClassName="tc-pari-grid"
        />
      ) : data.length === 0 ? (
        <div className="tc-empty">{t("page.paris.empty")}</div>
      ) : (
        <div className="tc-pari-grid">
          {data.map((p) => (
            <PariCard key={p.id} pari={p} />
          ))}
        </div>
      )}
    </div>
  );
}
