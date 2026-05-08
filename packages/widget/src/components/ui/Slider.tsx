import * as SliderPrimitive from "@radix-ui/react-slider";
import type { ComponentPropsWithoutRef, ElementRef } from "react";
import { forwardRef } from "react";

interface SliderProps extends ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  hideRange?: boolean;
}

export const Slider = forwardRef<ElementRef<typeof SliderPrimitive.Root>, SliderProps>(
  ({ hideRange, style, ...props }, ref) => {
    const value = props.value ?? props.defaultValue ?? [0];
    const min = props.min ?? 0;
    const max = props.max ?? 100;
    const pct = ((value[0] ?? 0) - min) / (max - min || 1);

    return (
      <SliderPrimitive.Root ref={ref} className="tc-slider-root" style={style} {...props}>
        <SliderPrimitive.Track className="tc-slider-track">
          {!hideRange && (
            <SliderPrimitive.Range className="tc-slider-range" style={{ width: `${pct * 100}%` }} />
          )}
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="tc-slider-thumb" />
      </SliderPrimitive.Root>
    );
  },
);
Slider.displayName = "Slider";
