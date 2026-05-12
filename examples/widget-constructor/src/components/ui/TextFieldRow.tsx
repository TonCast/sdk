import type { InputHTMLAttributes, ReactNode } from "react";

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "value" | "onChange"> {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  /** Optional asterisk after the label for required fields. */
  required?: boolean;
  /** Optional helper text shown below the input. */
  hint?: ReactNode;
  /** Use monospace font on the input (for hex addresses, etc.). */
  mono?: boolean;
}

const labelCls = "block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide";
const inputCls =
  "w-full h-9 px-3 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 text-xs focus:outline-none focus:border-sky-500/50 placeholder:text-slate-600";

/** Standard labelled text input row used across the constructor's Config tab. */
export function TextFieldRow({ id, label, value, onChange, required, hint, mono, ...rest }: Props) {
  return (
    <div>
      <label htmlFor={id} className={labelCls}>
        {label}
        {required && <span className="ml-1 text-red-400 normal-case font-normal">*</span>}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={mono ? `${inputCls} font-mono` : inputCls}
        {...rest}
      />
      {hint && <div className="mt-1 text-[10px] text-slate-600">{hint}</div>}
    </div>
  );
}
