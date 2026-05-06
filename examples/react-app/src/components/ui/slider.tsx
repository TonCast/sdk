import * as SliderPrimitive from "@radix-ui/react-slider";
import * as React from "react";
import { cn } from "@/lib/utils";

interface SliderProps extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  /** Hide the colored "progress" range — the value isn't a magnitude. */
  hideRange?: boolean;
}

export const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, hideRange, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn("relative flex w-full touch-none select-none items-center", className)}
    {...props}
  >
    {/* Thicker track (h-2.5) reads better on touch + matches the glass
        aesthetic. Range gradient hints "active" without being noisy. */}
    <SliderPrimitive.Track className="relative h-2.5 w-full grow overflow-hidden rounded-full bg-[rgb(var(--glass-bg)/calc(var(--glass-bg-alpha)*0.6))] border border-border/40">
      {hideRange ? null : (
        <SliderPrimitive.Range className="absolute h-full bg-gradient-to-r from-primary/80 to-primary" />
      )}
    </SliderPrimitive.Track>
    {/* Thumb: solid disk with primary ring + soft drop shadow. Active
        state gives a tiny scale-up so the thumb feels alive while
        dragging. */}
    <SliderPrimitive.Thumb className="block size-5 rounded-full border-2 border-primary bg-card shadow-[0_2px_8px_-2px_oklch(0_0_0/0.3)] transition-transform duration-150 hover:scale-110 active:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50" />
  </SliderPrimitive.Root>
));
Slider.displayName = SliderPrimitive.Root.displayName;
