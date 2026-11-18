export function mainAgentKey(source, sessionId) {
  return `${source}:${sessionId}`;
}

export function agentKeyOf({ source, sessionId, agentId }) {
  const mainKey = mainAgentKey(source, sessionId);
  return agentId ? `${mainKey}:${agentId}` : mainKey;
}
