import { statusOf } from "../../domain/office/agent-status.js";
import { renderPendingStrip } from "../sheet/pending-request-view.js";
import { esc } from "../shared/escape-html.js";
import { ago } from "../shared/format.js";
import { agentMark, originOf, statusBadge } from "./agent-badges.js";

function agentRow(agent, request, queued) {
  const facts = [originOf(agent), ago(agent.updatedAt), queued ? `${queued} na fila` : ""].filter(Boolean).join(" · ");
  return `<li><button class="agent-row" data-agent="${esc(agent.key)}" data-status="${statusOf(agent)}">
    <span class="row-head">${agentMark(agent)}<strong>${esc(agent.name)}</strong><span class="row-title">${esc(agent.label)}</span>${statusBadge(agent)}</span>
    <span class="row-action">${agent.action ? esc(agent.action) : "Sem atividade ainda."}</span>
    <span class="row-meta">${esc(facts)}</span>
  </button>${request ? renderPendingStrip(request) : ""}</li>`;
}

export function renderTeam(project, { pendingByAgent, outbox }) {
  const agents = Object.values(project.agents).sort((first, second) => (second.status === "needs_you") - (first.status === "needs_you") || second.updatedAt - first.updatedAt);
  const rows = agents.map((agent) => agentRow(agent, pendingByAgent.get(agent.key), outbox[agent.key])).join("");
  return `<header class="panel-head"><h2 class="eyebrow">Quem está aqui</h2><span class="muted mono">${agents.length}</span></header>
    <ul class="team-list">${rows || `<li class="empty-note">Ninguém nesta sala agora.</li>`}</ul>`;
}
