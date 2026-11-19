const STEPS = { ArrowDown: 1, ArrowUp: -1 };
const ENDS = { PageUp: "first", PageDown: "last" };

// Where the active option of a list goes for a key, wrapping at the ends; null for a key that does not move it.
export function movedCursor({ count, index, key }) {
  if (count === 0) return null;
  if (Object.hasOwn(ENDS, key)) return ENDS[key] === "first" ? 0 : count - 1;
  if (!Object.hasOwn(STEPS, key)) return null;
  if (index < 0) return STEPS[key] > 0 ? 0 : count - 1;
  return (index + STEPS[key] + count) % count;
}
