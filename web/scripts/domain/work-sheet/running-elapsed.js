// How long a round that is still running has taken, never negative when the clocks of the collector and the page disagree.
export function runningElapsedMs(startedAt, now) {
  if (!Number.isFinite(startedAt)) return null;
  return Math.max(0, now - startedAt);
}
