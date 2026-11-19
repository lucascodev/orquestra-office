import { WORK_SIGNALS } from "../../data/text/pt-br/work-signals.js";
import { fillPhrase } from "../../domain/text/fill-phrase.js";
import { esc } from "../shared/escape-html.js";
import { clockTime, formatCost, formatDuration, hourLabel } from "../shared/format.js";

const TICK_EVERY_HOURS = 4;
const TICK_CLEARANCE = 0.12;
const PERCENT = 100;
const NO_DATA = `<h2 class="hq-day-title">Hoje</h2><p class="hq-empty">Sem dados ainda: o coletor ainda não manda o resumo do dia.</p>`;

const percentOf = (share) => `${(share * PERCENT).toFixed(2)}%`;
const twoDigits = (value) => String(value).padStart(2, "0");

function barOf(hour) {
  const classes = ["hq-bar", hour.isMarked ? "is-marked" : "", hour.isNow ? "is-now" : "", !hour.isPast && !hour.isNow ? "is-ahead" : ""].filter(Boolean).join(" ");
  return `<span class="${classes}" style="--level:${hour.level.toFixed(3)}"></span>`;
}

function ticksOf(day) {
  const span = day.until + 1 - day.from;
  const hours = [day.from, ...day.hours.map(({ hour }) => hour).filter((hour) => hour % TICK_EVERY_HOURS === 0 && hour !== day.from), day.until];
  return [...new Set(hours)]
    .map((hour) => ({ hour, at: (hour - day.from) / span }))
    .filter(({ at }) => Math.abs(at - day.nowAt.position) > TICK_CLEARANCE);
}

function hourRow(hour) {
  const requests = hour.needsYouCount === 1 ? "1 pedido" : `${hour.needsYouCount} pedidos`;
  return `<tr><th scope="row">${hourLabel(hour.hour)}</th><td>${hour.averageWorking.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</td><td>${requests}</td></tr>`;
}

const EVENT_TEXT = WORK_SIGNALS.event;

// The newest test result or approved plan of the day, with a way to the agent's sheet; every field from the agent goes in escaped.
function eventRow(event) {
  if (!event) return "";
  return `
    <div class="hq-day-event">
      <time class="hq-day-event-time">${esc(clockTime(event.at))}</time>
      <p class="hq-day-event-text"><span class="work-mark" data-signal="${esc(event.kind)}" aria-hidden="true">${esc(event.icon)}</span> <b>${esc(event.agentName)}</b> ${esc(event.text)} <span class="muted">${esc(fillPhrase(EVENT_TEXT.where, { project: event.projectName }))}</span></p>
      <button type="button" class="btn btn-sm btn-secondary" data-agent="${esc(event.agentKey)}" aria-label="${esc(fillPhrase(EVENT_TEXT.openSpoken, { name: event.agentName }))}">${esc(EVENT_TEXT.open)}</button>
    </div>`;
}

export function renderDayTimeline(day, latestEvent = null) {
  if (!day) return `${NO_DATA}${eventRow(latestEvent)}`;
  const now = `${twoDigits(day.nowAt.hour)}:${twoDigits(day.nowAt.minute)}`;
  const ticks = ticksOf(day).map(({ hour, at }) => `<span style="--at:${percentOf(at)}">${hourLabel(hour)}</span>`).join("");
  return `<div class="hq-day-head">
      <h2 class="hq-day-title">Hoje</h2>
      <span>trabalhando <b class="hq-figure">${esc(formatDuration(day.totals.workingMs))}</b></span>
      <span>esperando você <b class="hq-figure is-warning">${esc(formatDuration(day.totals.needsYouMs))}</b></span>
      <span>custo <b class="hq-figure">${esc(formatCost(day.totals.costUsd))}</b></span>
    </div>
    <div class="hq-bars" style="--hours:${day.hours.length}" aria-hidden="true">${day.hours.map(barOf).join("")}<span class="hq-now" style="--at:${percentOf(day.nowAt.position)}"></span></div>
    <div class="hq-axis" aria-hidden="true">${ticks}<span class="is-now" style="--at:${percentOf(day.nowAt.position)}">agora ${now}</span></div>
    <table class="sr-only"><caption>Agentes trabalhando em média e pedidos que esperaram você, por hora</caption>
      <thead><tr><th scope="col">Hora</th><th scope="col">Agentes trabalhando</th><th scope="col">Pedidos</th></tr></thead>
      <tbody>${day.hours.filter((hour) => hour.isPast || hour.isNow).map(hourRow).join("")}</tbody></table>${eventRow(latestEvent)}`;
}
