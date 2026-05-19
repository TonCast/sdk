import type { Device } from "../types";

/** Fixed preview height (px) per device mode — shared by LivePreview and LivePreviewPlaceholder. */
export const HEIGHT_BY_DEVICE: Record<Device, number> = {
  mobile: 680,
  tablet: 720,
  desktop: 760,
};
