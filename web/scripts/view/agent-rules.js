// Messages travel through the Stop hook, which only exists for Claude Code sessions tracked on this machine.
export function canReceiveMessages(agent) {
  return agent.kind === "main" && agent.source === "claude" && !agent.endedAt;
}
