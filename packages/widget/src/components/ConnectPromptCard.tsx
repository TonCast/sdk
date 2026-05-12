import type { ReactNode } from "react";

interface Props {
  text: string;
  /** Connect-action element (e.g. `<ConnectButton/>` or a styled button). */
  action: ReactNode;
  /** "page" = full empty state (32px), "card" = inside an existing card (12px). Default "page". */
  variant?: "page" | "card";
}

const PADDINGS = { page: "32px 0", card: "12px 0" } as const;

/** Empty state shown to users who must connect a wallet to proceed. */
export function ConnectPromptCard({ text, action, variant = "page" }: Props) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        padding: PADDINGS[variant],
      }}
    >
      <p className="tc-text-sm tc-text-muted" style={{ textAlign: "center" }}>
        {text}
      </p>
      {action}
    </div>
  );
}
