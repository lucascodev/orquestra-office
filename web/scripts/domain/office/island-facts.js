import { statusOf } from "./agent-status.js";
import { STATUS_PRIORITY, statusGroupOf } from "./area-census.js";
import { needsYou } from "./project-order.js";
import { queuedCountOf } from "./queued-messages.js";

const NO_STATS = {};

const priorityOf = (status) => STATUS_PRIORITY.indexOf(statusGroupOf(status));
const isOpenSession = (agent) => agent.kind !== "subagent" && !agent.endedAt;
const mostUrgentFirst = (a, b) => priorityOf(a.status) - priorityOf(b.status) || a.name.localeCompare(b.name, "pt-BR");

function dayOf(project, agents) {
  const stats = project.stats ?? NO_STATS;
  return {
    sessions: agents.filter(isOpenSession).length,
    prompts: stats.prompts ?? 0,
    tools: stats.tools ?? 0,
    turns: stats.turns ?? 0,
    tokens: stats.tokens ?? 0,
    costUsd: stats.costUsd ?? 0,
    needsYou: needsYou(project),
  };
}

const memberOf = (agent, outbox) => ({
  key: agent.key, name: agent.name, label: agent.label, status: statusOf(agent), kind: agent.kind ?? "main", queued: queuedCountOf(outbox, agent.key),
});

// What the island's sheet tells about one project: its numbers of the day and who works on it, the most urgent first.
export function islandFacts(project, outbox) {
  const agents = Object.values(project.agents);
  return {
    key: project.key,
    name: project.name,
    themeId: project.template,
    day: dayOf(project, agents),
    team: agents.map((agent) => memberOf(agent, outbox)).sort(mostUrgentFirst),
  };
}
