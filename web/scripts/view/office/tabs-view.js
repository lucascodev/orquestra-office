import { ACTIVE_STATUSES } from "../../domain/office/agent-status.js";
import { needsYou, sortedProjects } from "../../domain/office/project-order.js";
import { esc } from "../shared/escape-html.js";

export function renderTabs(projects, selectedKey) {
  return sortedProjects(projects).map((p) => {
    const needs = needsYou(p);
    const active = Object.values(p.agents).filter((a) => ACTIVE_STATUSES.has(a.status)).length;
    const selected = p.key === selectedKey;
    const counter = needs
      ? `<span class="tab-count needs" title="${needs} precisa(m) de você">${needs}</span>`
      : active ? `<span class="tab-count" title="${active} em atividade">${active}</span>` : "";
    return `<button class="tab" role="tab" aria-selected="${selected}" data-project="${esc(p.key)}">${esc(p.name)}${counter}</button>`;
  }).join("");
}
