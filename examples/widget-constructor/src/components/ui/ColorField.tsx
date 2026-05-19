import { safeHexColor } from "@toncast/widget/color-math";
import { useId } from "react";

interface Props {
  label: string;
  /** Current value. May be empty string when in "Clear" mode (no defaultValue). */
  value: string;
  /** When set → "Reset" mode (typed default shown as placeholder). When undefined → "Clear" mode. */
  defaultValue?: string;
  /** Shown in swatch/placeholder when `value` is empty (e.g. derived theme). Does not enable Reset. */
  previewColor?: string;
  placeholderHint?: string;
  onChange: (next: string) => void;
}

const PICKER_FALLBACK_HEX = "#64748b";

const rowCls = "flex min-w-0 items-center gap-2";
const hexInputCls =
  "min-w-0 flex-1 h-8 px-2.5 rounded-md border border-slate-700 bg-slate-800 text-slate-200 text-xs font-mono focus:outline-none focus:border-sky-500/50";
const swatchCls =
  "w-8 h-8 rounded-md border border-slate-700 cursor-pointer bg-slate-800 p-0.5 shrink-0";
const actionCls =
  "inline-flex h-8 shrink-0 items-center text-[10px] text-slate-500 hover:text-slate-300 transition-colors";

/** Hex for `<input type="color">` — native picker only accepts #rrggbb. */
function pickerHex(
  value: string,
  previewColor: string | undefined,
  defaultValue: string | undefined,
): string {
  return (
    safeHexColor(value) ??
    safeHexColor(previewColor ?? "") ??
    safeHexColor(defaultValue ?? "") ??
    PICKER_FALLBACK_HEX
  );
}

/** Hex color picker with text input and Reset/Clear action. */
export function ColorField({
  label,
  value,
  defaultValue,
  previewColor,
  placeholderHint,
  onChange,
}: Props) {
  const inputId = useId();
  const isReset = defaultValue !== undefined;
  const colorPickerValue = pickerHex(value, previewColor, defaultValue);
  const placeholder = value ? "" : (previewColor ?? defaultValue ?? placeholderHint ?? "");
  const showAction = isReset ? value !== defaultValue && value !== "" : value !== "";
  const actionLabel = isReset ? "Reset" : "Clear";
  const onAction = () => onChange(isReset ? (defaultValue as string) : "");
  const hint =
    value || previewColor || (isReset ? defaultValue || "optional" : placeholderHint || "optional");

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label htmlFor={inputId} className="text-xs text-slate-400">
          {label}
        </label>
        <span className="font-mono text-[10px] text-slate-500 truncate max-w-[55%] text-right">
          {hint}
        </span>
      </div>
      <div className={rowCls}>
        <input
          type="color"
          value={colorPickerValue}
          onChange={(e) => onChange(e.target.value)}
          className={swatchCls}
          aria-label={`${label} color picker`}
          tabIndex={-1}
        />
        <input
          id={inputId}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
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
