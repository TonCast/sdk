import type { ReactNode } from "react";

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: string;
  icon?: ReactNode;
}

interface Props<T extends string | number> {
  value: T;
  onChange: (v: T) => void;
  options: ReadonlyArray<SegmentedOption<T>>;
  /** "lg" = py-2 rounded-lg font-semibold (color-scheme picker); "sm" = py-1.5 rounded font-medium. */
  size?: "sm" | "lg";
  /** Use monospace numerals for labels (border-radius picker). */
  mono?: boolean;
  /** Aria label format string. `{label}` is replaced with each option label. */
  itemAriaLabel?: (opt: SegmentedOption<T>) => string;
}

const ACTIVE = "bg-sky-500/20 text-sky-300 border-sky-500/50";
const INACTIVE = "bg-slate-800 text-slate-500 border-slate-700 hover:border-slate-500";

const SIZE = {
  sm: "py-1.5 text-xs rounded border font-medium",
  lg: "py-2 rounded-lg border text-xs font-semibold",
} as const;

const ROW = "flex gap-1.5";
const ROW_LG = "flex gap-2";

/** Pill-style mutually-exclusive choice picker. Single source of active/inactive styling. */
export function SegmentedButtonGroup<T extends string | number>({
  value,
  onChange,
  options,
  size = "sm",
  mono,
  itemAriaLabel,
}: Props<T>) {
  return (
    <div className={size === "lg" ? ROW_LG : ROW}>
      {options.map((opt) => {
        const isActive = opt.value === value;
        const cls = `flex-1 ${SIZE[size]} ${mono ? "font-mono" : ""} ${isActive ? ACTIVE : INACTIVE} transition-all`;
        const ariaLabel = itemAriaLabel ? itemAriaLabel(opt) : opt.label;
        return (
          <button
            key={String(opt.value)}
            type="button"
            aria-label={ariaLabel}
            aria-pressed={isActive}
            onClick={() => onChange(opt.value)}
            className={cls}
          >
            {opt.icon ? (
              <>
                <span aria-hidden="true">{opt.icon}</span> {opt.label}
              </>
            ) : (
              opt.label
            )}
          </button>
        );
      })}
    </div>
  );
}
