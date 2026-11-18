const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const BREAK_TO_IDLE_MS = 10 * MINUTE_MS;
const ENDED_SUBAGENT_TTL_MS = 15 * MINUTE_MS;
const ENDED_SESSION_TTL_MS = 30 * MINUTE_MS;
const SILENT_SESSION_TTL_MS = 6 * HOUR_MS;
const QUIET_PROJECT_TTL_MS = 30 * DAY_MS;

export function hasAgentExpired(agent, now) {
  const quietMs = now - agent.updatedAt;
  const endedMs = agent.endedAt ? now - agent.endedAt : null;
  return (
    (agent.kind === "subagent" && endedMs !== null && endedMs > ENDED_SUBAGENT_TTL_MS) ||
    (agent.kind === "main" && endedMs !== null && endedMs > ENDED_SESSION_TTL_MS) ||
    quietMs > SILENT_SESSION_TTL_MS
  );
}

export function isBreakOver(agent, now) {
  return agent.status === "break" && now - agent.updatedAt > BREAK_TO_IDLE_MS;
}

export function isRoomAbandoned(project, now) {
  return Object.keys(project.agents).length === 0 && now - project.updatedAt > QUIET_PROJECT_TTL_MS;
}
