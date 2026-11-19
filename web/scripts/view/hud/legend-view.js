import { esc } from "../shared/escape-html.js";
import { STATUS } from "../office/status-display.js";

const MEANINGS = [
  ["working", "trabalhando, fica na mesa"],
  ["reviewing", "lendo ou pesquisando, fica na mesa"],
  ["needs_you", "precisa de você agora"],
  ["waiting", "terminou e espera sua resposta"],
  ["blocked", "parou com um erro"],
  ["break", "em pausa, pela Sede"],
  ["idle", "livre"],
];

const meaningItem = ([status, text]) => `<li><span class="hq-glyph" style="color:${esc(STATUS[status].color)}" aria-hidden="true">${esc(STATUS[status].glyph)}</span>${esc(text)}</li>`;

export function renderLegend() {
  return `<h2 class="hq-heading" id="hq-legend-title">O que cada cor quer dizer</h2>
    <ul class="hq-legend-list">${MEANINGS.map(meaningItem).join("")}</ul>`;
}
