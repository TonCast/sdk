import type { ReactNode } from "react";
import { toggleMultiValue } from "../../utils/toggleMultiValue";
import { PillButton } from "./PillButton";

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: string;
  icon?: ReactNode;
}

interface CommonProps<T extends string | number> {
  options: ReadonlyArray<SegmentedOption<T>>;
  /** "lg" = larger color-scheme picker; "sm" = compact pill row. */
  size?: "sm" | "lg";
  /** Monospace label digits (radius / referral pct pickers). */
  mono?: boolean;
  /** Drop `flex-1` so pills size to their content (language list with many items). */
  compact?: boolean;
  /** Switch to flex-wrap so a long row reflows on narrow widths. */
  wrap?: boolean;
  /** Per-option disabled (e.g. referral pct ≥1% disabled without referral address). */
  isDisabled?: (opt: SegmentedOption<T>) => boolean;
  /** Aria label override per option. */
  itemAriaLabel?: (opt: SegmentedOption<T>) => string;
}

interface SingleProps<T extends string | number> extends CommonProps<T> {
  multi?: false;
  value: T;
  onChange: (v: T) => void;
}

interface MultiProps<T extends string | number> extends CommonProps<T> {
  multi: true;
  value: readonly T[];
  onChange: (v: T[]) => void;
}

type Props<T extends string | number> = SingleProps<T> | MultiProps<T>;

const ROW = "flex gap-1.5";
const ROW_LG = "flex gap-2";
const WRAP = "flex flex-wrap gap-1.5";

/**
 * Pill-style choice picker with single (`multi=false`) or multi-select (`multi=true`)
 * modes. Active/inactive/disabled styling is delegated to {@link PillButton}, so all
 * call-sites in the constructor share one visual language.
 */
export function SegmentedButtonGroup<T extends string | number>(props: Props<T>) {
  const { options, size = "sm", mono, compact, wrap, isDisabled, itemAriaLabel } = props;
  const isActive = (v: T) => (props.multi ? props.value.includes(v) : props.value === v);
  const handle = (v: T) => {
    if (props.multi) {
      props.onChange(toggleMultiValue(props.value, v));
    } else {
      props.onChange(v);
    }
  };

  const rowCls = wrap ? WRAP : size === "lg" ? ROW_LG : ROW;
  return (
    <div className={rowCls}>
      {options.map((opt) => {
        const active = isActive(opt.value);
        const disabled = isDisabled ? isDisabled(opt) : false;
        return (
          <PillButton
            key={String(opt.value)}
            active={active}
            disabled={disabled}
            size={size}
            mono={mono}
            compact={compact}
            aria-label={itemAriaLabel ? itemAriaLabel(opt) : opt.label}
            onClick={() => handle(opt.value)}
          >
            {opt.icon ? (
              <>
                <span aria-hidden="true">{opt.icon}</span> {opt.label}
              </>
            ) : (
              opt.label
            )}
          </PillButton>
        );
      })}
    </div>
  );
}
