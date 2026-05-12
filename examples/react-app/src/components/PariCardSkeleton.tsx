import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder tile matching `PariCard` layout so the feed grid stays aligned while loading. */
export function PariCardSkeleton() {
  return (
    <Card className="flex h-full min-h-0 min-w-0 w-full max-w-full flex-col overflow-hidden">
      <div className="flex min-h-0 w-full flex-1 flex-col">
        <Skeleton className="aspect-square w-full shrink-0" />
        <div className="flex flex-1 flex-col gap-2 p-3">
          <Skeleton className="min-h-15 w-full" />
          <div className="mt-auto flex items-center justify-between gap-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-14" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 p-3 pt-0">
        <Skeleton className="h-8 w-full rounded-md" />
        <Skeleton className="h-8 w-full rounded-md" />
      </div>
    </Card>
  );
}
