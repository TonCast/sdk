/**
 * Toggle membership of `value` in `selected` (immutable copy).
 * Used by multi-select segmented controls in the constructor.
 */
export function toggleMultiValue<T>(selected: readonly T[], value: T): T[] {
  return selected.includes(value) ? selected.filter((x) => x !== value) : [...selected, value];
}
