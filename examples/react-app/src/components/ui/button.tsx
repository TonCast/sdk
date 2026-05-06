// Unified Button: rounded-xl corners, primary uses a subtle vertical
// gradient + warm shadow (the "lit from underneath" feel), secondary
// is glass, all variants share a tactile `active:scale` animation.

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // shared: rounded corners, font, focus ring, hover/active feedback
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium tracking-tight transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        // Primary — soft vertical gradient + glow shadow tinted with
        // the brand primary so it reads as "lit from inside" on glass
        // backgrounds.
        default:
          "bg-gradient-to-b from-primary to-primary/85 text-primary-foreground shadow-[0_8px_24px_-8px_color-mix(in_oklch,var(--color-primary)_55%,transparent)] hover:brightness-110",
        destructive:
          "bg-gradient-to-b from-destructive to-destructive/85 text-destructive-foreground shadow-[0_8px_24px_-8px_color-mix(in_oklch,var(--color-destructive)_55%,transparent)] hover:brightness-110",
        // Secondary — glass surface that picks up the aurora behind it.
        secondary:
          "glass-subtle text-foreground hover:bg-[rgb(var(--glass-bg)/calc(var(--glass-bg-alpha)*0.85))]",
        // Outline — bordered ghost; hover materialises a subtle glass tint.
        outline:
          "border border-border bg-transparent text-foreground hover:bg-[rgb(var(--glass-bg)/calc(var(--glass-bg-alpha)*0.5))] hover:border-border",
        ghost:
          "bg-transparent text-foreground hover:bg-[rgb(var(--glass-bg)/calc(var(--glass-bg-alpha)*0.4))]",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        default: "h-10 px-5 text-sm",
        lg: "h-12 px-7 text-base",
        icon: "size-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";
