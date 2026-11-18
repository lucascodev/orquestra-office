// Queued messages are handed over by the Stop hook, which only a running Claude Code main session goes through.
export function canReceiveMessages(agent) {
  return agent.kind === "main" && agent.source === "claude" && !agent.endedAt;
}
