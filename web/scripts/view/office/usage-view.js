import { HIGH_USAGE_PERCENT } from "../../domain/office/account-usage.js";
import { esc } from "../shared/escape-html.js";
import { resetTime } from "../shared/format.js";

const USAGE_WINDOWS = [["fiveHour", "5 h"], ["sevenDay", "Semana"]];

function usageMeter(label, usageWindow) {
  const used = Math.round(usageWindow.usedPercentage);
  const reset = resetTime(usageWindow.resetsAt);
  return `<div class="usage-meter${used >= HIGH_USAGE_PERCENT ? " high" : ""}" title="Uso do plano na janela de ${esc(label)}${reset ? `, renova ${esc(reset)}` : ""}">
    <span class="label">${esc(label)}</span>
    <span class="bar" role="meter" aria-label="Uso ${esc(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${used}"><span style="width:${used}%"></span></span>
    <span class="mono">${used}%</span>
    ${reset ? `<span class="muted">renova ${esc(reset)}</span>` : ""}
  </div>`;
}

export function renderUsage(usage) {
  const windows = USAGE_WINDOWS.filter(([key]) => usage?.rateLimits?.[key]);
  return windows.map(([key, label]) => usageMeter(label, usage.rateLimits[key])).join("");
}
