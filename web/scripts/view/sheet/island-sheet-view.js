import { THEMES, themeById } from "../../data/themes.js";
import { queuedText } from "../../domain/office/queued-messages.js";
import { STATUS } from "../office/status-display.js";
import { esc } from "../shared/escape-html.js";
import { formatCost, formatTokens } from "../shared/format.js";
import { icon } from "../shared/icons.js";

const COST_NOTE = "Estimativa do próprio Claude Code, a preço de tabela.";
const CLOSE_NOTE = "Fechar tira a ilha do mapa. Ela volta sozinha quando uma sessão desta pasta trabalhar de novo.";
const NOBODY_HERE = "Ninguém trabalhando aqui agora. Abra o Claude Code ou o Codex nesta pasta e o time aparece.";
const SUBAGENT = "subagente";
const SPOKEN_SEPARATOR = ", ";

const swatchOf = (theme) => `<span class="hq-swatch" style="--swatch:${esc(theme.rug)};--swatch-edge:${esc(theme.divider)}" aria-hidden="true"></span>`;

function themeOption(theme) {
  return `<label class="hq-theme"><input type="radio" name="island-theme" value="${esc(theme.id)}">${swatchOf(theme)}${esc(theme.name)}</label>`;
}

// The island's sheet, in the same drawer as the agent's: who works there, the day's numbers, the theme and closing the room.
export function renderIslandShell() {
  return `<header class="panel-head sheet-head hq-drawer-head">
      <div class="sheet-identity" data-slot="identity"></div>
      <button type="button" class="icon-btn" data-close aria-label="Fechar a ficha" title="Fechar a ficha (Esc)">${icon("close")}</button>
    </header>
    <div class="sheet-body hq-drawer-body">
      <section class="hq-island-part" aria-labelledby="hq-island-team-title">
        <h3 class="hq-heading" id="hq-island-team-title">Quem está nesta ilha</h3>
        <ul class="hq-island-team" data-slot="team"></ul>
      </section>
      <section class="hq-island-part" aria-labelledby="hq-island-day-title">
        <h3 class="hq-heading" id="hq-island-day-title">Hoje nesta ilha</h3>
        <dl class="hq-island-day" data-slot="day"></dl>
      </section>
      <fieldset class="hq-island-part hq-theme-picker">
        <legend class="hq-heading">Tema da ilha</legend>
        <div class="hq-theme-grid">${THEMES.map(themeOption).join("")}</div>
      </fieldset>
      <div class="hq-drawer-actions">
        <button type="button" class="btn btn-sm btn-secondary" data-new-session-here hidden>Nova sessão nesta pasta</button>
        <button type="button" class="btn btn-sm btn-ghost" data-close-room>Fechar sala</button>
      </div>
      <p class="muted hq-drawer-note">${CLOSE_NOTE}</p>
    </div>`;
}

export function renderIslandIdentity({ name, key, themeId }) {
  const theme = themeById(themeId);
  return `${swatchOf(theme)}<div class="identity"><h2 class="panel-title" id="sheet-title">${esc(name)}</h2><p class="muted mono" title="${esc(key)}">${esc(key)} · ${esc(theme.name)}</p></div>`;
}

function dayCell([label, value, { note = "", isWarning = false } = {}]) {
  return `<div${note ? ` title="${esc(note)}"` : ""}><dt>${esc(label)}</dt><dd class="hq-figure${isWarning ? " is-warning" : ""}">${esc(value)}</dd></div>`;
}

export function renderIslandDay(day) {
  return [
    ["Sessões abertas", day.sessions],
    ["Precisam de você", day.needsYou, { isWarning: day.needsYou > 0 }],
    ["Pedidos", day.prompts],
    ["Ferramentas", day.tools],
    ["Turnos", day.turns],
    ["Tokens", formatTokens(day.tokens)],
    ["Custo", formatCost(day.costUsd), { note: COST_NOTE }],
  ].map(dayCell).join("");
}

function queueChip(queued) {
  const text = queuedText(queued);
  return text ? `\n      <span class="hq-member-queue">${esc(text)}</span>` : "";
}

// Seen as a mark and a number, heard as a sentence: the mark and the number alone would read as symbols.
function workChip(className, { kind = null, icon, text, spoken }) {
  const signal = kind ? ` data-signal="${esc(kind)}"` : "";
  const shown = [icon, text].filter(Boolean).map(esc).join(" ");
  const heard = spoken ? `<span class="sr-only">${SPOKEN_SEPARATOR}${esc(spoken)}</span>` : "";
  return `<span class="${className}"${signal}><span aria-hidden="true">${shown}</span>${heard}</span>`;
}

function memberItem(member) {
  const { glyph, color, sentence } = STATUS[member.status];
  const role = member.kind === "subagent" ? `${member.label} · ${SUBAGENT}` : member.label;
  return `<li><button type="button" class="hq-member" data-agent="${esc(member.key)}">
      <span class="hq-glyph" style="color:${esc(color)}" aria-hidden="true">${esc(glyph)}</span>
      <span class="hq-member-name"><b>${esc(member.name)}</b> <span class="muted">${esc(role)}</span></span>
      <span class="hq-member-status">${esc(sentence)}</span>${queueChip(member.queued)}
      ${workChip("hq-member-checklist", member.work.checklist)}${workChip("hq-member-tests", member.work.lastRun)}
    </button></li>`;
}

export function renderIslandTeam(team) {
  if (team.length === 0) return `<li class="hq-empty">${NOBODY_HERE}</li>`;
  return team.map(memberItem).join("");
}
