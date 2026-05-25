import { Skeleton } from "./ui/Skeleton";

/** Placeholder tile matching {@link PariCard} layout to reduce CLS while loading. */
export function PariCardSkeleton() {
  return (
    <div className="tc-pari-card" aria-hidden="true">
      <div className="tc-pari-cover-link">
        <Skeleton className="tc-pari-cover" />
        <div className="tc-pari-body">
          <Skeleton style={{ width: "100%", minHeight: "calc(3 * 1.35em)" }} />
          <div className="tc-pari-meta">
            <Skeleton style={{ width: 72, height: 20, borderRadius: 999 }} />
            <Skeleton style={{ width: 56, height: 20, borderRadius: 999 }} />
          </div>
        </div>
      </div>
      <div className="tc-pari-btns">
        <Skeleton style={{ height: 32, borderRadius: "var(--tc-radius-sm)" }} />
        <Skeleton style={{ height: 32, borderRadius: "var(--tc-radius-sm)" }} />
      </div>
    </div>
  );
}
