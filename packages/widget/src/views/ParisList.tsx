import { ALL_CATEGORY_FILTER, type Category } from "@toncast/sdk";
import { useCategories, useStreamList } from "@toncast/sdk-react";
import { useState } from "react";
import { PariCard } from "../components/PariCard";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { useT } from "../i18n/useT";

export function ParisListView() {
  const t = useT();
  const categories = useCategories();
  const [active, setActive] = useState<Category | null>(null);
  const current = active ?? categories.data?.[0] ?? ALL_CATEGORY_FILTER;
  const { data, isLoading, isError, error } = useStreamList(current.param);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 className="tc-page-title">{t("page.paris.title")}</h2>

      {/* Category filter */}
      <div className="tc-category-bar">
        {categories.data?.map((c) => (
          <Button
            key={c.name}
            variant={current.name === c.name ? "primary" : "secondary"}
            size="sm"
            className="tc-btn-rounded"
            onClick={() => setActive(c)}
            style={{ whiteSpace: "nowrap", flexShrink: 0 }}
          >
            {c.name === "All" ? t("category.all") : c.name}
          </Button>
        ))}
      </div>

      {isError ? (
        <div className="tc-error">
          {t("page.paris.loadFailed", { error: (error as Error).message })}
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
