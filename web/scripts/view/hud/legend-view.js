import { WORK_MARKS } from "../../data/work-marks.js";
import { WORK_SIGNALS } from "../../data/text/pt-br/work-signals.js";
import { esc } from "../shared/escape-html.js";
import { STATUS } from "../office/status-display.js";

const WORK_TEXT = WORK_SIGNALS.legend;
const MARK_SEPARATOR = " · ";
const RESULT_SEPARATOR = " / ";

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

const workMark = (kind, text = WORK_MARKS[kind]) => `<span class="work-mark" data-signal="${esc(kind)}" aria-hidden="true">${esc(text)}</span>`;

const WORK_ITEMS = [
  `<li class="hq-legend-work">${workMark("checklist", `${WORK_MARKS.checklist} ${WORK_TEXT.checklistSample}`)} ${esc(WORK_TEXT.checklist)}</li>`,
  `<li>${workMark("testing")} ${esc(WORK_TEXT.testing)}${MARK_SEPARATOR}${workMark("writing-tests")} ${esc(WORK_TEXT.writing)}</li>`,
  `<li>${workMark("tests-passed")}${RESULT_SEPARATOR}${workMark("tests-failed")} ${esc(WORK_TEXT.results)}</li>`,
];

export function renderLegend() {
  return `<h2 class="hq-heading" id="hq-legend-title">O que cada cor quer dizer</h2>
    <ul class="hq-legend-list">${MEANINGS.map(meaningItem).join("")}${WORK_ITEMS.join("")}</ul>`;
}
