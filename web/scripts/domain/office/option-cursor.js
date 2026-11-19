export const LIST_KEYS = { steps: { ArrowDown: 1, ArrowUp: -1 }, ends: { PageUp: "first", PageDown: "last" } };
export const TAB_KEYS = { steps: { ArrowRight: 1, ArrowLeft: -1 }, ends: { Home: "first", End: "last" } };

// Where the active item of a list or a row of tabs goes for a key, wrapping at the ends; null for a key that does not move it.
export function movedCursor({ count, index, key, keys = LIST_KEYS }) {
  if (count === 0) return null;
  if (Object.hasOwn(keys.ends, key)) return keys.ends[key] === "first" ? 0 : count - 1;
  if (!Object.hasOwn(keys.steps, key)) return null;
  const step = keys.steps[key];
  if (index < 0) return step > 0 ? 0 : count - 1;
  return (index + step + count) % count;
}
