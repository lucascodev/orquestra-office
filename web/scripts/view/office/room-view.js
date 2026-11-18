import { THEMES, themeById } from "../../data/themes.js";
import { needsYou } from "../../domain/office/project-order.js";
import { esc } from "../shared/escape-html.js";
import { formatCost, formatTokens } from "../shared/format.js";

const COST_NOTE = "Estimativa do próprio Claude Code, a preço de tabela.";

function dayStats(project) {
  const agents = Object.values(project.agents);
  const sessions = agents.filter((a) => a.kind !== "subagent" && !a.endedAt).length;
  const stats = project.stats ?? {};
  return [
    [sessions, "Sessões abertas"], [stats.prompts ?? 0, "Pedidos hoje"],
    [stats.tools ?? 0, "Ferramentas hoje"], [stats.turns ?? 0, "Turnos hoje"],
    [formatTokens(stats.tokens), "Tokens hoje"], [formatCost(stats.costUsd), "Custo hoje", COST_NOTE],
  ];
}

function statCell([value, label, note = ""], isAlert = false) {
  return `<div class="stat${isAlert ? " alert" : ""}"${note ? ` title="${esc(note)}"` : ""}><span class="eyebrow">${esc(label)}</span><b class="mono">${esc(value)}</b></div>`;
}

export function renderOffice(project) {
  const theme = themeById(project.template);
  const needs = needsYou(project);
  const options = THEMES.map((t) => `<option value="${t.id}"${t.id === theme.id ? " selected" : ""}>${esc(t.name)}</option>`).join("");
  const isEmpty = Object.keys(project.agents).length === 0;
  return `<header class="page-head">
      <div class="page-id">
        <p class="eyebrow">Sala</p>
        <h2 class="page-title">${esc(project.name)}</h2>
        <p class="page-path mono">${esc(project.key)}</p>
      </div>
      <div class="page-tools">
        <label class="field inline">Escritório <select class="input" id="template-select">${options}</select></label>
        <button class="btn btn-ghost" data-close-room title="Tira esta sala da lista. Ela volta sozinha se uma sessão desta pasta trabalhar de novo.">Fechar sala</button>
      </div>
    </header>
    <div class="card stats">${dayStats(project).map((cell) => statCell(cell)).join("")}${statCell([needs, "Precisam de você"], needs > 0)}</div>
    <div class="card room-frame">
      <div id="room-host" class="room-host"></div>
      ${isEmpty ? `<p class="room-empty">Ninguém trabalhando aqui agora. Abra o Claude Code ou o Codex nesta pasta e o time aparece.</p>` : ""}
    </div>`;
}

export function renderNoProjects() {
  return `<div class="empty-state">
    <h2>Nenhuma sala ainda</h2>
    <p>Abra o Claude Code ou o Codex em qualquer pasta, com os hooks instalados, e o escritório dela aparece aqui.</p>
  </div>`;
}
