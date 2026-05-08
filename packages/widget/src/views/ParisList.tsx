import { ALL_CATEGORY_FILTER, type Category } from "@toncast/sdk";
import { useCategories, useStreamList } from "@toncast/sdk-react";
import { useEffect, useState } from "react";
import { PariCard } from "../components/PariCard";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { useT } from "../i18n/useT";

export function ParisListView() {
  const t = useT();
  const categories = useCategories();
  const [active, setActive] = useState<Category | null>(null);

  // If categories are refetched and the selected category no longer exists
  // (e.g. removed server-side), reset so the user isn't stuck on a ghost filter.
  useEffect(() => {
    if (!active || !categories.data) return;
    const stillExists = categories.data.some((c) => c.param === active.param);
    if (!stillExists) setActive(null);
  }, [categories.data, active]);

  const current = active ?? categories.data?.[0] ?? ALL_CATEGORY_FILTER;
  const { data, isLoading, isError, error } = useStreamList(current.param);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--tc-form-gap, 12px)",
      }}
    >
      <h2 className="tc-page-title">{t("page.paris.title")}</h2>

      {/* Category filter */}
      <div className="tc-category-bar">
        {categories.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton
              key={String(i)}
              style={{
                width: 56,
                height: 28,
                borderRadius: 999,
                flexShrink: 0,
              }}
            />
          ))
        ) : categories.isError ? (
          <span className="tc-text-sm tc-text-muted">
            {t("category.loadFailed")}
          </span>
        ) : (
          categories.data?.map((c) => (
            <Button
              key={c.name}
              variant={current.name === c.name ? "primary" : "secondary"}
              size="sm"
              className="tc-btn-rounded"
              onClick={() => setActive(c)}
              style={{ whiteSpace: "nowrap", flexShrink: 0 }}
            >
              {c.param === ALL_CATEGORY_FILTER.param
                ? t("category.all")
                : c.name}
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
        <div className="tc-pari-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={String(i)} style={{ aspectRatio: "1 / 1.5" }} />
          ))}
        </div>
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
