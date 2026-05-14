import { ALL_CATEGORY_FILTER, type CategoryFilter } from "@toncast/sdk";
import type { TranslationKey } from "../i18n/translations";

type Translate = (key: TranslationKey) => string;

/** Chip label for a Paris list category (localised All / feed modes; API title otherwise). */
export function categoryFilterChipLabel(c: CategoryFilter, t: Translate): string {
  if (c.name === ALL_CATEGORY_FILTER.name) return t("category.all");
  if (c.param.feed === "pending") return t("category.feed.pending");
  if (c.param.feed === "finished") return t("category.feed.finished");
  return c.name;
}

/** Stable React key for category chips (locale-agnostic). */
export function categoryFilterChipKey(c: CategoryFilter): string {
  return JSON.stringify(c.param);
}
