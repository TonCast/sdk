import type { ButtonHTMLAttributes, ReactNode } from "react";

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "size"> {
  active: boolean;
  /** "lg" = py-2 rounded-lg font-semibold, "sm" = py-1.5 rounded font-medium. */
  size?: "sm" | "lg";
  /** Use monospace numerals for the label (border-radius / referral % pickers). */
  mono?: boolean;
  /** Drop `flex-1` so the pill sizes to its content (language picker, "All" toggle). */
  compact?: boolean;
  children: ReactNode;
}

const ACTIVE = "bg-sky-500/20 text-sky-300 border-sky-500/50";
const INACTIVE =
  "bg-slate-800 text-slate-500 border-slate-700 hover:border-slate-500 hover:text-slate-200";

const SIZE = {
  sm: "py-1.5 px-2.5 text-xs rounded border font-medium",
  lg: "py-2 px-3 rounded-lg border text-xs font-semibold",
} as const;

/**
 * Single source of truth for the "pill" style — a 1px-bordered toggle button
 * with sky-blue active state, disabled state via `disabled:opacity-25`, and
 * an optional `compact` mode that drops `flex-1` for content-sized pills.
 */
export function PillButton({
  active,
  size = "sm",
  mono,
  compact,
  children,
  className,
  ...rest
}: Props) {
  const palette = active ? ACTIVE : INACTIVE;
  const layout = compact ? "" : "flex-1";
  const cls = [
    layout,
    SIZE[size],
    mono ? "font-mono" : "",
    palette,
    "transition-all",
    "disabled:opacity-25",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button type="button" aria-pressed={active} {...rest} className={cls}>
      {children}
    </button>
  );
}
