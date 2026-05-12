import { Card } from "@/components/ui/card";

/** Glass dialog body — no outer Card (used inside `BetDialog`). */
export function BareWrapper({ children }: { children: React.ReactNode }) {
  return <div className="min-w-0 space-y-4 overflow-hidden p-4">{children}</div>;
}

/** Default padded card shell for the bet panel. */
export function CardWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Card className="min-w-0 overflow-hidden">
      <div className="min-w-0 space-y-5 p-4 sm:p-6">{children}</div>
    </Card>
  );
}

/** YES / NO toggle styled as pills. */
export function SidePill({
  active,
  kind,
  label,
  onClick,
}: {
  active: boolean;
  kind: "yes" | "no";
  label: string;
  onClick: () => void;
}) {
  const cls =
    kind === "yes"
      ? active
        ? "bg-success/25 text-success ring-1 ring-success/45 shadow-[0_4px_16px_-6px_color-mix(in_oklch,var(--color-success)_45%,transparent)]"
        : "bg-success/10 text-success hover:bg-success/20"
      : active
        ? "bg-destructive/25 text-destructive ring-1 ring-destructive/45 shadow-[0_4px_16px_-6px_color-mix(in_oklch,var(--color-destructive)_45%,transparent)]"
        : "bg-destructive/10 text-destructive hover:bg-destructive/20";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 shrink-0 rounded-full px-4 text-sm font-semibold tracking-tight transition-all duration-200 ease-out active:scale-[0.97] ${cls}`}
    >
      {label}
    </button>
  );
}
