import { z } from "zod";
import type { StreamListParams } from "../resources/paris-stream";

/** Internal schema used only to parse the server response. */
export const ServerCategorySchema = z.object({
  id: z.number().int(),
  title: z.string(),
});

/**
 * A filter entry returned by `client.categories.list()`.
 * Pass `category.param` directly to `paris.streamList()`.
 */
export interface Category {
  name: string;
  param: StreamListParams;
}
