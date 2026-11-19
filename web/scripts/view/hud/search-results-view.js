import { STATUS } from "../office/status-display.js";
import { esc } from "../shared/escape-html.js";

const OPTION_PREFIX = "hq-search-option-";
const GROUP_PREFIX = "hq-search-group-";
const ROOM_KINDS = { project: "ilha", area: "área comum" };
const ROOMS_TITLE = "Salas";
const ACTIONS_TITLE = "Ações";

export const optionIdAt = (index) => `${OPTION_PREFIX}${index}`;

function agentOption(agent, index) {
  const { glyph, color, sentence } = STATUS[agent.status];
  const doing = agent.doing ? ` · ${agent.doing}` : "";
  return `<div class="hq-search-option" role="option" id="${optionIdAt(index)}" aria-selected="false" data-kind="agent" data-id="${esc(agent.key)}">
      <span class="hq-glyph" style="color:${esc(color)}" aria-hidden="true">${esc(glyph)}</span>
      <span class="hq-search-main"><b>${esc(agent.name)}</b> <span class="muted">${esc(agent.label)}</span></span>
      <span class="hq-search-detail">${esc(sentence)}${esc(doing)}</span>
    </div>`;
}

const roomOption = (room, index) => `<div class="hq-search-option" role="option" id="${optionIdAt(index)}" aria-selected="false" data-kind="room" data-room="${esc(room.kind)}" data-id="${esc(room.id)}">
      <span class="hq-search-main"><b>${esc(room.name)}</b></span>
      <span class="hq-search-detail">${esc(ROOM_KINDS[room.kind] ?? "")}</span>
    </div>`;

const actionOption = (action, index) => `<div class="hq-search-option" role="option" id="${optionIdAt(index)}" aria-selected="false" data-kind="action" data-id="${esc(action.id)}">
      <span class="hq-search-main"><b>${esc(action.label)}</b></span>
    </div>`;

function group(title, groupIndex, options) {
  const id = `${GROUP_PREFIX}${groupIndex}`;
  return `<div class="hq-search-section" role="group" aria-labelledby="${id}"><div class="hq-search-group" role="presentation" id="${id}">${esc(title)}</div>${options}</div>`;
}

// Agents by room with whoever needs you first, then the rooms, then the actions, numbered in the order the arrows go through them.
export function renderSearchResults({ agentGroups, rooms, actions }) {
  let index = 0;
  const numbered = (items, render) => items.map((item) => render(item, index++)).join("");
  const sections = [
    ...agentGroups.map(({ room, agents }) => [room, numbered(agents, agentOption)]),
    ...(rooms.length > 0 ? [[ROOMS_TITLE, numbered(rooms, roomOption)]] : []),
    ...(actions.length > 0 ? [[ACTIONS_TITLE, numbered(actions, actionOption)]] : []),
  ];
  if (sections.length === 0) return `<div class="hq-empty hq-search-empty" role="presentation">Nada encontrado. Tente o nome de um agente, de uma sala ou de uma ação.</div>`;
  return sections.map(([title, options], groupIndex) => group(title, groupIndex, options)).join("");
}

export function resultCountText(count) {
  if (count === 0) return "Nenhum resultado";
  return count === 1 ? "1 resultado" : `${count} resultados`;
}
