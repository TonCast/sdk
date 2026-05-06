import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-tight transition-colors duration-200",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "glass-subtle text-foreground",
        destructive: "bg-destructive text-destructive-foreground",
        // Outline → glass-subtle border, picks up the aurora behind it.
        outline: "border border-border/60 text-foreground",
        success: "bg-success text-primary-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
