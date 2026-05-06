import { z } from "zod";
import { Endpoints } from "../http/endpoints";
import type { HttpClient } from "../http/HttpClient";
import type { SupportedLanguage } from "../i18n/languages";
import { type Category, ServerCategorySchema } from "../types/category";

const ServerCategoriesSchema = z.array(ServerCategorySchema);

export interface CategoriesResourceDeps {
  http: HttpClient;
  getLanguage: () => SupportedLanguage;
}

/**
 * Default "show everything" filter — empty `param` means the SDK applies no
 * server-side filter and returns the full feed. Exported so apps can use it
 * as a stable initial state (e.g. before `useCategories` resolves) without
 * hardcoding the literal.
 */
export const ALL_CATEGORY_FILTER: Category = { name: "All", param: {} };

/**
 * Mode-flip entries appended after the localised category chips.
 * `param` is exactly what `paris.streamList()` expects.
 */
const FEED_ENTRIES: Category[] = [
  { name: "Pending result", param: { showPendingResults: true } },
  { name: "Finished", param: { includeInactive: true } },
];

/**
 * Read-only categories resource.
 *
 * Categories rarely change, so responses are cached **forever per language**.
 * Switching language via `client.setLanguage(...)` simply causes the next
 * `list()` call to fetch and cache the new language separately — both stay warm.
 * Use `clearCache()` to drop entries manually.
 */
export class CategoriesResource {
  private readonly cache = new Map<SupportedLanguage, Category[]>();
  private readonly inflight = new Map<SupportedLanguage, Promise<Category[]>>();

  constructor(private readonly deps: CategoriesResourceDeps) {}

  /**
   * Returns the localised category list with feed entries appended at the end.
   * Each entry has `name` and `param` — pass `param` directly to
   * `paris.streamList()`.
   *
   * Note: the underlying HTTP request is **not** abort-able. Categories are a
   * global singleton — wiring an external `AbortSignal` into the shared fetch
   * would let the first caller's unmount/HMR/refetch cancel the request for
   * everyone else and force a re-fetch on the next call. The payload is tiny
   * (~1 KB) and runs at most once per language per process.
   */
  async list(): Promise<Category[]> {
    const lang = this.deps.getLanguage();
    const cached = this.cache.get(lang);
    if (cached) return cached;

    const pending = this.inflight.get(lang);
    if (pending) return pending;

    const promise = this.deps.http
      .request({
        path: Endpoints.categories.list,
        schema: ServerCategoriesSchema,
      })
      .then((fresh) => {
        const categories: Category[] = fresh.map((c) => ({
          name: c.title,
          param: { categoryId: c.id },
        }));
        const result = [ALL_CATEGORY_FILTER, ...categories, ...FEED_ENTRIES];
        this.cache.set(lang, result);
        return result;
      })
      .finally(() => {
        this.inflight.delete(lang);
      });
    this.inflight.set(lang, promise);
    return promise;
  }

  /** Drop all cached categories. */
  clearCache(): void {
    this.cache.clear();
  }
}
