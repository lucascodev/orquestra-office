const usedPercent = (window) => (Number.isFinite(window?.used_percentage) ? `${Math.round(window.used_percentage)}%` : null);

export function statusLineText(status) {
  const fiveHour = usedPercent(status.rate_limits?.five_hour);
  const week = usedPercent(status.rate_limits?.seven_day);
  const cost = status.cost?.total_cost_usd;
  return [
    status.model?.display_name,
    fiveHour && `5 h ${fiveHour}`,
    week && `semana ${week}`,
    Number.isFinite(cost) && `US$ ${cost.toFixed(2)}`,
  ].filter(Boolean).join(" · ");
}
