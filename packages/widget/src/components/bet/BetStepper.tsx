import type { ReactNode } from "react";
import { Button } from "../ui/Button";

interface BetStepperProps {
  /** Disable label/wrapper when stepper sits inside an existing labeled block. */
  label?: string;
  canDecrement: boolean;
  canIncrement: boolean;
  onDecrement: () => void;
  onIncrement: () => void;
  /** The central readout / input element. */
  children: ReactNode;
}

/**
 * Generic ± stepper row reused by coefficient / tickets / amount inputs in BetCard.
 * Caller supplies the central element via `children` (read-only div, text input, ...).
 */
export function BetStepper({
  label,
  canDecrement,
  canIncrement,
  onDecrement,
  onIncrement,
  children,
}: BetStepperProps) {
  const row = (
    <div className="tc-stepper-row">
      <Button variant="secondary" size="icon" disabled={!canDecrement} onClick={onDecrement}>
        −
      </Button>
      {children}
      <Button variant="secondary" size="icon" disabled={!canIncrement} onClick={onIncrement}>
        +
      </Button>
    </div>
  );

  if (!label) return row;
  return (
    <div className="tc-form-col-sm">
      <div className="tc-label">{label}</div>
      {row}
    </div>
  );
}

/**
 * Read-only central readout for a stepper (used by the Coefficient stepper).
 * `pointerEvents: none` keeps clicks falling through to surrounding controls.
 */
export function StepperReadout({ children }: { children: ReactNode }) {
  return <div className="tc-input tc-stepper-readout">{children}</div>;
}
