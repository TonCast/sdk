import type { ReactNode } from "react";
import { cn } from "../utils/cn";

interface Props {
  text: string;
  /** Connect-action element (e.g. `<ConnectButton/>` or a styled button). */
  action: ReactNode;
  /** "page" = full empty state (32px padding); "card" = inside an existing card (12px). Default "page". */
  variant?: "page" | "card";
}

/** Empty state shown to users who must connect a wallet to proceed. */
export function ConnectPromptCard({ text, action, variant = "page" }: Props) {
  return (
    <div className={cn("tc-empty-state", variant === "card" && "tc-empty-state-card")}>
      <p className="tc-text-sm tc-text-muted">{text}</p>
      {action}
    </div>
  );
}
