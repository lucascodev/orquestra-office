const THOUSAND = 1_000;
const MILLION = 1_000_000;
const DAY_MS = 86_400_000;

export function ago(ms) {
  if (!ms) return "";
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 45) return "agora";
  if (s < 3600) return `há ${Math.max(1, Math.round(s / 60))} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  return new Date(ms).toLocaleDateString("pt-BR");
}

export const clockTime = (ms) => new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export function resetTime(ms) {
  if (!ms) return "";
  const isWithinADay = ms - Date.now() < DAY_MS;
  return isWithinADay ? clockTime(ms) : new Date(ms).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
}

const decimal = (value) => value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

export function formatTokens(count = 0) {
  if (count >= MILLION) return `${decimal(count / MILLION)} mi`;
  if (count >= THOUSAND) return `${decimal(count / THOUSAND)} mil`;
  return String(Math.round(count));
}

export const formatCost = (usd = 0) => `US$ ${usd.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const MINUTE_MS = 60_000;
const MINUTES_IN_HOUR = 60;
const SECONDS_IN_MINUTE = 60;

export function formatDuration(ms = 0) {
  const minutes = Math.floor(ms / MINUTE_MS);
  if (minutes < MINUTES_IN_HOUR) return `${minutes} min`;
  return `${Math.floor(minutes / MINUTES_IN_HOUR)} h ${String(minutes % MINUTES_IN_HOUR).padStart(2, "0")}`;
}

export function formatCountdown(ms) {
  const seconds = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(seconds / SECONDS_IN_MINUTE)}:${String(seconds % SECONDS_IN_MINUTE).padStart(2, "0")}`;
}

export const hourLabel = (hour) => `${String(hour).padStart(2, "0")}h`;
