import { THEMES, themeById } from "../data/themes.js";
import { renderPendingStrip } from "./control-view.js";
import { ago, esc, formatCost, formatTokens } from "./format.js";
import { ACTIVE_STATUSES, STATUS, statusOf } from "./status.js";

const AGENT_MARKS = { claude: ["C", "var(--a-claude)"], codex: ["Cx", "var(--a-codex)"] };
const UNKNOWN_MARK = ["?", "var(--a-shell)"];
const COST_NOTE = "Estimativa do próprio Claude Code, a preço de tabela.";

export const needsYou = (project) => Object.values(project.agents).filter((a) => a.status === "needs_you").length;

export function sortedProjects(projects) {
  return Object.values(projects).sort((a, b) => needsYou(b) - needsYou(a) || b.updatedAt - a.updatedAt);
}

export function agentMark(agent) {
  const [sign, color] = AGENT_MARKS[agent.source] ?? UNKNOWN_MARK;
  return `<span class="agent-mark" style="background:${color}" aria-hidden="true">${sign}</span>`;
}

export function statusBadge(agent) {
  const { label, glyph, color } = STATUS[statusOf(agent)];
  return `<span class="badge status" style="color:${color}"><span aria-hidden="true">${glyph}</span>${label}</span>`;
}

export const originOf = (agent) => (agent.kind === "subagent" ? "subagente" : agent.source === "codex" ? "Codex" : "Claude Code");

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

function agentRow(agent, request, queued) {
  const facts = [originOf(agent), ago(agent.updatedAt), queued ? `${queued} na fila` : ""].filter(Boolean).join(" · ");
  return `<li><button class="agent-row" data-agent="${esc(agent.key)}" data-status="${statusOf(agent)}">
    <span class="row-head">${agentMark(agent)}<strong>${esc(agent.name)}</strong><span class="row-title">${esc(agent.label)}</span>${statusBadge(agent)}</span>
    <span class="row-action">${agent.action ? esc(agent.action) : "Sem atividade ainda."}</span>
    <span class="row-meta">${esc(facts)}</span>
  </button>${request ? renderPendingStrip(request) : ""}</li>`;
}

export function renderTeam(project, { pendingByAgent, outbox }) {
  const agents = Object.values(project.agents).sort((a, b) => (b.status === "needs_you") - (a.status === "needs_you") || b.updatedAt - a.updatedAt);
  const rows = agents.map((agent) => agentRow(agent, pendingByAgent.get(agent.key), outbox[agent.key])).join("");
  return `<header class="panel-head"><h2 class="eyebrow">Quem está aqui</h2><span class="muted mono">${agents.length}</span></header>
    <ul class="team-list">${rows || `<li class="empty-note">Ninguém nesta sala agora.</li>`}</ul>`;
}

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
