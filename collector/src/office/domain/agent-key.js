const KEY_SEPARATOR = ":";

export function mainAgentKey(source, sessionId) {
  return `${source}${KEY_SEPARATOR}${sessionId}`;
}

export function agentKeyOf({ source, sessionId, agentId }) {
  const mainKey = mainAgentKey(source, sessionId);
  return agentId ? `${mainKey}${KEY_SEPARATOR}${agentId}` : mainKey;
}

export function sessionIdOfKey(agentKey) {
  return agentKey.split(KEY_SEPARATOR)[1];
}
