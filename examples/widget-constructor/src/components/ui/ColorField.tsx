interface Props {
  label: string;
  /** Current value. May be empty string when in "Clear" mode (no defaultValue). */
  value: string;
  /** When set → "Reset" mode (typed default shown as placeholder). When undefined → "Clear" mode. */
  defaultValue?: string;
  placeholderHint?: string;
  onChange: (next: string) => void;
}

const rowCls = "flex min-w-0 items-center gap-2";
const hexInputCls =
  "min-w-0 flex-1 h-8 px-2.5 rounded-md border border-slate-700 bg-slate-800 text-slate-200 text-xs font-mono focus:outline-none focus:border-sky-500/50";
const swatchCls =
  "w-8 h-8 rounded-md border border-slate-700 cursor-pointer bg-slate-800 p-0.5 shrink-0";
const actionCls =
  "inline-flex h-8 shrink-0 items-center text-[10px] text-slate-500 hover:text-slate-300 transition-colors";

/**
 * Hex color picker with a sibling text input and a contextual "Reset"/"Clear" action.
 * - When `defaultValue` is provided → action label = "Reset" (resets to defaultValue).
 * - When `defaultValue` is undefined → action label = "Clear" (sets value to "").
 */
export function ColorField({ label, value, defaultValue, placeholderHint, onChange }: Props) {
  const isReset = defaultValue !== undefined;
  const swatchValue = value || defaultValue || "#000000";
  const placeholder = defaultValue ?? placeholderHint ?? "";
  const showAction = isReset ? value !== defaultValue && value !== "" : value !== "";
  const actionLabel = isReset ? "Reset" : "Clear";
  const onAction = () => onChange(isReset ? (defaultValue as string) : "");
  const hint = value || (isReset ? defaultValue || "optional" : "optional");

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-slate-400">{label}</span>
        <span className="font-mono text-[10px] text-slate-500">{hint}</span>
      </div>
      <div className={rowCls}>
        <input
          type="color"
          value={swatchValue}
          onChange={(e) => onChange(e.target.value)}
          className={swatchCls}
          aria-label={`${label} color`}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={`${label} hex color`}
          className={hexInputCls}
        />
        {showAction && (
          <button type="button" onClick={onAction} className={actionCls}>
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
