import { ownValueOf } from "../../domain/shared/own-value.js";
import { esc } from "../shared/escape-html.js";
import { resetTime } from "../shared/format.js";

const WINDOWS = {
  fiveHour: { short: "5 h", long: "janela de 5 horas" },
  sevenDay: { short: "semana", long: "janela da semana" },
};
const NO_READING = `<p class="hq-empty">Uso do plano: sem leitura ainda</p>`;

function meterOf(account, usage) {
  const names = ownValueOf(WINDOWS, usage.id);
  if (!names) return "";
  const reset = resetTime(usage.resetsAt);
  const valueText = `${usage.percent} por cento${reset ? `, renova ${reset}` : ""}`;
  return `<span role="meter" aria-label="${esc(account.label)}, ${esc(names.long)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${usage.percent}" aria-valuetext="${esc(valueText)}">${esc(names.short)} <b class="hq-figure${usage.isHigh ? " is-high" : ""}">${usage.percent}%</b></span>`;
}

function accountItem(account) {
  const ring = account.peak
    ? `<span class="hq-ring${account.peak.isHigh ? " is-high" : ""}" style="--used:${account.peak.percent}%" aria-hidden="true"><span>${esc(account.initial)}</span></span>`
    : `<span class="hq-ring" aria-hidden="true"><span>${esc(account.initial)}</span></span>`;
  const meters = account.windows.map((usage) => meterOf(account, usage)).filter(Boolean).join(`<span aria-hidden="true"> · </span>`);
  return `<li class="hq-account">${ring}<span class="hq-account-text"><b>${esc(account.label)}</b><span class="hq-meters">${meters || "sem leitura ainda"}</span></span></li>`;
}

export function renderAccounts(accounts) {
  if (accounts.length === 0) return NO_READING;
  return `<ul class="hq-account-list">${accounts.map(accountItem).join("")}</ul>`;
}
