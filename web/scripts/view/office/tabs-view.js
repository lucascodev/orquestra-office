import { ACTIVE_STATUSES } from "../../domain/office/agent-status.js";
import { needsYou, sortedProjects } from "../../domain/office/project-order.js";
import { esc } from "../shared/escape-html.js";

export function renderTabs(projects, selectedKey) {
  return sortedProjects(projects).map((project) => {
    const needs = needsYou(project);
    const active = Object.values(project.agents).filter((agent) => ACTIVE_STATUSES.has(agent.status)).length;
    const selected = project.key === selectedKey;
    const counter = needs
      ? `<span class="tab-count needs" title="${needs} precisa(m) de você">${needs}</span>`
      : active ? `<span class="tab-count" title="${active} em atividade">${active}</span>` : "";
    return `<button class="tab" role="tab" aria-selected="${selected}" data-project="${esc(project.key)}">${esc(project.name)}${counter}</button>`;
  }).join("");
}
