import type { SelectHTMLAttributes } from "react";

interface NativeSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  placeholder?: string;
}

/** Lightweight native <select> — works inside CDN bundles without portals. */
export function NativeSelect({ options, placeholder, className, ...props }: NativeSelectProps) {
  return (
    <div className="tc-select-wrapper">
      <select className={`tc-select${className ? ` ${className}` : ""}`} {...props}>
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
      <svg
        className="tc-select-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  );
}
