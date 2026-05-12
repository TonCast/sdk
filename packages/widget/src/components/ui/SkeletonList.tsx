import type { CSSProperties } from "react";
import { Skeleton } from "./Skeleton";

interface SkeletonListProps {
  count: number;
  /** Per-item style (height, aspect-ratio, …). */
  itemStyle?: CSSProperties;
  /** Per-item className (when style is not enough). */
  itemClassName?: string;
  /** Wrapper layout direction. Default `column`. Ignored when `wrapperClassName === null`. */
  direction?: "row" | "column";
  /** Gap between items in px. Default 8. Ignored when `wrapperClassName === null`. */
  gap?: number;
  /**
   * Wrapper className override. Pass `null` to skip the wrapper entirely
   * (renders as a Fragment — useful inside an existing flex/grid container).
   */
  wrapperClassName?: string | null;
}

/** Repeats `<Skeleton>` N times. Defaults to a flex wrapper; opt out via `wrapperClassName={null}`. */
export function SkeletonList({
  count,
  itemStyle,
  itemClassName,
  direction = "column",
  gap = 8,
  wrapperClassName,
}: SkeletonListProps) {
  const items = Array.from({ length: count }, (_, i) => (
    <Skeleton key={String(i)} className={itemClassName} style={itemStyle} />
  ));

  if (wrapperClassName === null) return <>{items}</>;

  const wrapperStyle: CSSProperties | undefined = wrapperClassName
    ? undefined
    : { display: "flex", flexDirection: direction, gap };

  return (
    <div className={wrapperClassName} style={wrapperStyle}>
      {items}
    </div>
  );
}
