import { z } from "zod";
import type { StreamListParams } from "../resources/paris-stream";

export const ServerCategorySchema = z.object({
  id: z.number().int(),
  title: z.string(),
});

/** Localised category returned by the Toncast API. */
export type Category = z.infer<typeof ServerCategorySchema>;

/**
 * A UI-ready filter entry returned by `client.categories.listFilters()`.
 * Pass `category.param` directly to `paris.streamList()`.
 */
export interface CategoryFilter {
  name: string;
  param: StreamListParams;
}
