import { z } from "zod";
import { Endpoints } from "../http/endpoints";
import type { HttpClient } from "../http/HttpClient";
import type { SupportedLanguage } from "../i18n/languages";
import { type Category, type CategoryFilter, ServerCategorySchema } from "../types/category";

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
export const ALL_CATEGORY_FILTER: CategoryFilter = { name: "All", param: { feed: "active" } };

/**
 * Mode-flip entries appended after the localised category chips.
 * `param` is exactly what `paris.streamList()` expects.
 */
const FEED_ENTRIES: CategoryFilter[] = [
  { name: "Pending result", param: { feed: "pending" } },
  { name: "Finished", param: { feed: "finished" } },
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
   * Returns raw localised categories from the API.
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
        this.cache.set(lang, fresh);
        return fresh;
      })
      .finally(() => {
        this.inflight.delete(lang);
      });
    this.inflight.set(lang, promise);
    return promise;
  }

  /**
   * Returns UI-ready filter chips derived from raw categories.
   * This intentionally stays separate from `list()` so data consumers do not
   * receive view-model rows masquerading as API categories.
   */
  async listFilters(): Promise<CategoryFilter[]> {
    const categories = await this.list();
    return [
      ALL_CATEGORY_FILTER,
      ...categories.map((c) => ({
        name: c.title,
        param: { feed: "active" as const, categoryId: c.id },
      })),
      ...FEED_ENTRIES,
    ];
  }

  /** Drop all cached categories. */
  clearCache(): void {
    this.cache.clear();
  }
}
