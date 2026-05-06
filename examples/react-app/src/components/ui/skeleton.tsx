import type * as React from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  // Glass-tinted shimmer that blends with `glass` cards.
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl bg-[rgb(var(--glass-bg)/calc(var(--glass-bg-alpha)*0.7))]",
        className,
      )}
      {...props}
    />
  );
}
