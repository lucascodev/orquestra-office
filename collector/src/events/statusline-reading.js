const MS_PER_SECOND = 1_000;

const numberOr = (value, fallback) => (Number.isFinite(value) ? value : fallback);

function windowOf(limit) {
  if (!limit || !Number.isFinite(limit.used_percentage)) return null;
  return { usedPercentage: Math.max(0, Math.min(100, limit.used_percentage)), resetsAt: numberOr(limit.resets_at, 0) * MS_PER_SECOND };
}

export function normalizeStatusline(payload, now = Date.now()) {
  if (!payload || typeof payload !== "object" || !payload.session_id) return null;
  const limits = payload.rate_limits;
  return {
    sessionId: String(payload.session_id),
    at: now,
    costUsd: numberOr(payload.cost?.total_cost_usd, 0),
    tokens: numberOr(payload.context_window?.total_input_tokens, 0) + numberOr(payload.context_window?.total_output_tokens, 0),
    rateLimits: limits ? { fiveHour: windowOf(limits.five_hour), sevenDay: windowOf(limits.seven_day) } : null,
  };
}
