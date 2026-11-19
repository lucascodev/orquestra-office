export const HIGH_USAGE_PERCENT = 80;
export const USAGE_WINDOWS = ["fiveHour", "sevenDay"];
const DEFAULT_ACCOUNT = { id: "default", label: "Claude" };

function windowsOf(rateLimits) {
  return USAGE_WINDOWS.filter((id) => rateLimits?.[id]).map((id) => {
    const percent = Math.round(rateLimits[id].usedPercentage);
    return { id, percent, resetsAt: rateLimits[id].resetsAt ?? null, isHigh: percent >= HIGH_USAGE_PERCENT };
  });
}

// The ring shows the window closest to its limit, the one that will stop the agents first.
function peakOf(windows) {
  if (windows.length === 0) return null;
  const { id, percent, isHigh } = windows.reduce((peak, candidate) => (candidate.percent > peak.percent ? candidate : peak));
  return { id, percent, isHigh };
}

function usageOf({ id, label }, rateLimits) {
  const windows = windowsOf(rateLimits);
  return { id, label, initial: label.charAt(0).toLocaleUpperCase("pt-BR"), windows, peak: peakOf(windows) };
}

// Until the collector reads accounts, its single plan reading is the default account it will later file it under.
export function accountUsage({ accounts = null, usage = null }) {
  const listed = Object.values(accounts ?? {});
  if (listed.length > 0) {
    return listed.map((account) => usageOf(account, account.rateLimits)).sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }
  const fallback = usageOf(DEFAULT_ACCOUNT, usage?.rateLimits);
  return fallback.windows.length > 0 ? [fallback] : [];
}
