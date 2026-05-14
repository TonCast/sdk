import type { ReactNode } from "react";

type HostPanelProps = {
  /** Visible panel title (high-contrast token). */
  title: string;
  /** Stable id for `aria-labelledby`. */
  titleId: string;
  /** Right side of the header row (e.g. status pill). */
  headerExtra?: ReactNode;
  /** Optional footer strip (meta, hints). */
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
};

/**
 * Shared card chrome: titled header row + body + optional footer.
 */
export function HostPanel({
  title,
  titleId,
  headerExtra,
  footer,
  className,
  children,
}: HostPanelProps) {
  return (
    <section className={`host-panel${className ? ` ${className}` : ""}`} aria-labelledby={titleId}>
      <div className="host-panel-head">
        <span id={titleId} className="host-panel-title">
          {title}
        </span>
        {headerExtra ?? null}
      </div>
      {children}
      {footer ?? null}
    </section>
  );
}
