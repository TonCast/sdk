import type { WidgetThemeChoice } from "../ToncastBettingWidget";

const OPTIONS: Array<{ value: WidgetThemeChoice; label: string }> = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

type HostThemeSegmentProps = {
  value: WidgetThemeChoice;
  onChange: (theme: WidgetThemeChoice) => void;
};

/**
 * Segmented control for widget light/dark/system — native radios for a11y, styled labels.
 */
export function HostThemeSegment({ value, onChange }: HostThemeSegmentProps) {
  return (
    <div className="host-theme-segment" role="radiogroup" aria-label="Widget theme">
      {OPTIONS.map(({ value: v, label }) => (
        <label
          key={v}
          className={`host-theme-segment__option${value === v ? " host-theme-segment__option--active" : ""}`}
        >
          <input
            type="radio"
            name="host-widget-theme"
            value={v}
            checked={value === v}
            onChange={() => {
              onChange(v);
            }}
            className="host-theme-segment__input"
          />
          <span className="host-theme-segment__label">{label}</span>
        </label>
      ))}
    </div>
  );
}
