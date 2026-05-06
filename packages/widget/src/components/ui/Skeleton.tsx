import type { CSSProperties } from "react";
import { cn } from "../../utils/cn";

export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div className={cn("tc-skeleton", className)} style={style} />;
}
