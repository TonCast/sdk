import { ALL_CATEGORY_FILTER, type CategoryFilter, type Pari } from "@toncast/sdk";
import { useCategoryFilters, useStreamList } from "@toncast/sdk-react";
import { useState } from "react";
import { BetDialog } from "@/components/BetDialog";
import { PariCard } from "@/components/PariCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/lib/i18n/useT";
import { cn } from "@/lib/utils";

interface PickedSide {
  pari: Pari;
  side: "yes" | "no";
}

export function ParisListPage() {
  const t = useT();
  const categories = useCategoryFilters();
  const [active, setActive] = useState<CategoryFilter | null>(null);
  const current = active ?? categories.data?.[0] ?? ALL_CATEGORY_FILTER;
  const { data, isLoading, isError, error } = useStreamList(current.param);
  const [picked, setPicked] = useState<PickedSide | null>(null);

  if (isError) {
    return (
      <Card>
        <CardContent className="pt-6 text-destructive">
          {t("page.paris.loadFailed", { error: (error as Error).message })}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t("page.paris.title")}</h1>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {categories.data?.map((c) => (
          <CategoryChip
            key={c.name}
            active={current.name === c.name}
            onClick={() => setActive(c)}
            label={c.name === "All" ? t("category.all") : c.name}
          />
        ))}
      </div>

      {isLoading || !data ? (
        <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(190px,1fr))]">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={String(i)} className="h-72" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-muted-foreground text-sm">
            {t("page.paris.empty")}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(190px,1fr))]">
          {data.map((p) => (
            <PariCard key={p.id} pari={p} onPickSide={(pari, side) => setPicked({ pari, side })} />
          ))}
        </div>
      )}

      <BetDialog
        pari={picked?.pari ?? null}
        side={picked?.side}
        open={picked !== null}
        onOpenChange={(open) => {
          if (!open) setPicked(null);
        }}
      />
    </div>
  );
}

function CategoryChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <Button
      variant={active ? "default" : "outline"}
      size="sm"
      onClick={onClick}
      className={cn("rounded-full whitespace-nowrap shrink-0", !active && "border-border")}
    >
      {label}
    </Button>
  );
}
