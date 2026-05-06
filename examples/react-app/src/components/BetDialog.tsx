import type { Pari } from "@toncast/sdk";
import { BetCard } from "./BetCard";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";

export interface BetDialogProps {
  pari: Pari | null;
  /** Side preselected by the trigger (YES/NO buttons on the tile). */
  side?: "yes" | "no";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Modal wrapper around `BetCard` — opens when the integrator picks YES/NO
 * directly from a pari tile, without navigating away from the feed.
 *
 * Uses `BetCard` in `bare` mode so we don't stack a glass card inside
 * the glass dialog (the previous "two layers of blur" muddiness).
 */
export function BetDialog({ pari, side, open, onOpenChange }: BetDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 sm:max-w-md max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {pari ? (
          <div className="min-w-0 overflow-hidden">
            <div className="px-5 pb-2 pt-5 sm:px-6 sm:pt-6">
              <DialogTitle className="text-base leading-snug line-clamp-3 pr-8">
                {pari.name}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Choose a coin and budget to place a bet on this pari.
              </DialogDescription>
            </div>
            <BetCard pariId={pari.id} initialSide={side} bare />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
