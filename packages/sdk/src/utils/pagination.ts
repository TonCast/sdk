import { z } from "zod";

/**
 * Opaque cursor — the API returns either a string or a structured object
 * (e.g. `{ sortValue, address }` for /v1/paris). Treat as opaque on the
 * caller side and pass it back unchanged.
 */
export type Cursor = string | object;

export interface Page<T, TCursor extends Cursor = Cursor> {
  items: T[];
  nextCursor: TCursor | null;
  hasMore: boolean;
}

const CursorSchema: z.ZodType<Cursor | null> = z
  .union([z.string(), z.record(z.string(), z.unknown())])
  .nullable();

/**
 * Builds a zod schema matching Toncast's standard envelope:
 *   { data: T[], pagination: { hasMore: boolean, nextCursor: Cursor | null } }
 * and normalises it to `Page<T>`.
 */
export function envelopeSchema<T extends z.ZodTypeAny>(item: T) {
  return z
    .object({
      data: z.array(item),
      pagination: z.object({
        hasMore: z.boolean(),
        nextCursor: CursorSchema,
      }),
    })
    .transform((raw) => ({
      items: raw.data,
      nextCursor: raw.pagination.nextCursor,
      hasMore: raw.pagination.hasMore,
    }));
}

/** Lazily iterates a cursor-paginated endpoint. Consumer controls termination. */
export async function* iteratePages<T>(
  fetchPage: (cursor: Cursor | null) => Promise<Page<T>>,
  signal?: AbortSignal,
): AsyncGenerator<T> {
  let cursor: Cursor | null = null;
  while (true) {
    if (signal?.aborted) return;
    const page: Page<T> = await fetchPage(cursor);
    for (const item of page.items) {
      if (signal?.aborted) return;
      yield item;
    }
    if (!page.hasMore || page.nextCursor === null) return;
    cursor = page.nextCursor;
  }
}
