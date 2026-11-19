const SECOND_MS = 1_000;
const SECONDS_IN_MINUTE = 60;

// Time gone by as m:ss, counting whole seconds, so the clock of a running test reads 0:00, 0:01 and so on; minutes keep
// counting past the hour.
export function clockText(elapsedMs) {
  const seconds = Number.isFinite(elapsedMs) ? Math.floor(Math.max(0, elapsedMs) / SECOND_MS) : 0;
  return `${Math.floor(seconds / SECONDS_IN_MINUTE)}:${String(seconds % SECONDS_IN_MINUTE).padStart(2, "0")}`;
}
