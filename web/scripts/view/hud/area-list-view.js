import { themeById } from "../../data/themes.js";
import { esc } from "../shared/escape-html.js";
import { STATUS } from "../office/status-display.js";

const COUNTED = {
  needs_you: ["precisa de você", "precisam de você"],
  blocked: ["parou com um erro", "pararam com um erro"],
  working: ["trabalhando", "trabalhando"],
  waiting: ["espera sua resposta", "esperam sua resposta"],
  break: ["em pausa", "em pausa"],
  idle: ["livre", "livres"],
};

const NOBODY = "ninguém";
const WHOLE = { kind: "whole" };
const people = (count) => (count === 0 ? NOBODY : count === 1 ? "1 pessoa" : `${count} pessoas`);
const counted = ({ status, count }) => `${count} ${COUNTED[status][count === 1 ? 0 : 1]}`;
const currentMark = (current, kind, id) => (current?.kind === kind && (kind === "whole" || current.id === id) ? ' aria-current="true"' : "");

function chipOf(project) {
  const [headline] = project.byStatus;
  if (!headline) return `<span class="hq-chip is-empty" aria-hidden="true">vazia</span>`;
  const { glyph, color } = STATUS[headline.status];
  return `<span class="hq-chip" style="color:${esc(color)}" aria-hidden="true">${esc(glyph)} ${headline.count}</span>`;
}

function projectItem(project, current) {
  const theme = themeById(project.themeId);
  const isUrgent = project.byStatus[0]?.status === "needs_you";
  const description = project.byStatus.length > 0 ? project.byStatus.map(counted).join(", ") : `${NOBODY} agora`;
  return `<li><button type="button" class="hq-room${isUrgent ? " is-urgent" : ""}" data-project="${esc(project.key)}"${currentMark(current, "project", project.key)}>
      <span class="hq-swatch" style="--swatch:${esc(theme.rug)};--swatch-edge:${esc(theme.divider)}" aria-hidden="true"></span>
      <span class="hq-room-name">${esc(project.name)}</span>${chipOf(project)}<span class="sr-only">: ${esc(description)}</span>
    </button></li>`;
}

const areaItem = (area, current) => `<li><button type="button" class="hq-room" data-area="${esc(area.id)}"${currentMark(current, "area", area.id)}>
      <span class="hq-room-name">${esc(area.name)}</span><span class="hq-count" aria-hidden="true">${area.count}</span><span class="sr-only">: ${people(area.count)}</span>
    </button></li>`;

// The room the camera last went to is marked current; once the person moves the camera by hand, none is.
export function renderAreaList(census, current = WHOLE) {
  const projects = census.projects.length > 0
    ? `<ul class="hq-room-list">${census.projects.map((project) => projectItem(project, current)).join("")}</ul>`
    : `<p class="hq-empty">Nenhum projeto aberto ainda.</p>`;
  return `<button type="button" class="hq-room is-whole" data-frame="whole"${currentMark(current, "whole")}>
      <span class="hq-swatch is-whole" aria-hidden="true"></span><span class="hq-room-name">Sede inteira</span><span class="hq-count" aria-hidden="true">${census.total}</span><span class="sr-only">: ${people(census.total)}</span>
    </button>
    <h2 class="hq-heading">Área de trabalho · ilhas</h2>
    ${projects}
    <h2 class="hq-heading">Áreas comuns</h2>
    <ul class="hq-room-list">${census.areas.map((area) => areaItem(area, current)).join("")}</ul>
    <p class="hq-hint">Clique numa sala para a câmera ir até ela. Numa ilha, a ficha dela abre junto.</p>`;
}
