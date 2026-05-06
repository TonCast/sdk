import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../utils/cn";

type Variant = "primary" | "secondary" | "ghost" | "yes" | "no";
type Size = "default" | "sm" | "lg" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  active?: boolean;
}

export function Button({
  variant = "secondary",
  size = "default",
  active,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "tc-btn",
        variant === "primary" && "tc-btn-primary",
        variant === "secondary" && "tc-btn-secondary",
        variant === "ghost" && "tc-btn-ghost",
        variant === "yes" && "tc-btn-yes",
        variant === "no" && "tc-btn-no",
        size === "sm" && "tc-btn-sm",
        size === "lg" && "tc-btn-lg",
        size === "icon" && "tc-btn-icon",
        active && "tc-active",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
