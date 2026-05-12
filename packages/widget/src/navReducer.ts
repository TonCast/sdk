/**
 * Pure navigation state machine for NavProvider.
 *
 * Extracted as a standalone reducer so the dedup / clipping rules can be
 * unit-tested without React.
 */
export type WidgetView =
  | { name: "list" }
  | { name: "detail"; pariId: string; initialSide?: "yes" | "no" }
  | { name: "bets" };

export type NavAction = { type: "navigate"; view: WidgetView } | { type: "back" };

/** Maximum stack depth — prevents unbounded memory growth from runaway navigation. */
export const NAV_MAX_DEPTH = 20;

export const NAV_INITIAL_STATE: WidgetView[] = [{ name: "list" }];

function isSameView(a: WidgetView, b: WidgetView): boolean {
  if (a.name !== b.name) return false;
  if (a.name === "detail" && b.name === "detail") {
    return a.pariId === b.pariId && a.initialSide === b.initialSide;
  }
  return true; // 'list' / 'bets' have no params
}

export function navReducer(state: WidgetView[], action: NavAction): WidgetView[] {
  if (action.type === "back") {
    return state.length > 1 ? state.slice(0, -1) : state;
  }
  // navigate
  const current = state[state.length - 1];
  if (current && isSameView(current, action.view)) return state;
  return [...state, action.view].slice(-NAV_MAX_DEPTH);
}
