import * as SliderPrimitive from "@radix-ui/react-slider";
import type { ComponentPropsWithoutRef, ComponentRef } from "react";
import { forwardRef } from "react";

interface SliderProps extends ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  hideRange?: boolean;
}

export const Slider = forwardRef<ComponentRef<typeof SliderPrimitive.Root>, SliderProps>(
  ({ hideRange, style, ...props }, ref) => {
    return (
      <SliderPrimitive.Root ref={ref} className="tc-slider-root" style={style} {...props}>
        <SliderPrimitive.Track className="tc-slider-track">
          {/* Let Radix position the range via its default transform — manual width
              can fight Radix's own geometry and produce misaligned fill vs thumb. */}
          {!hideRange && <SliderPrimitive.Range className="tc-slider-range" />}
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="tc-slider-thumb" />
      </SliderPrimitive.Root>
    );
  },
);
Slider.displayName = "Slider";
