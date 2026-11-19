const SECOND_MS = 1_000;
const MINUTE_SECONDS = 60;

// "4,1 s" for a short round and "2 min 05 s" for a long one.
export function formatTestDuration(ms) {
  if (!Number.isFinite(ms)) return "";
  const seconds = ms / SECOND_MS;
  if (seconds < MINUTE_SECONDS) return `${seconds.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s`;
  const whole = Math.round(seconds);
  return `${Math.floor(whole / MINUTE_SECONDS)} min ${String(whole % MINUTE_SECONDS).padStart(2, "0")} s`;
}
