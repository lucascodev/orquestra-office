const ENTRY_LIMIT = 200;
const AGENT_LIMIT = 300;

// Kept in memory only: unlike the office state, these entries carry the text of prompts, commands and replies.
export function createSessionHistory() {
  const byAgent = new Map();

  function add(agentKey, entry) {
    const entries = byAgent.get(agentKey) ?? [];
    byAgent.delete(agentKey);
    byAgent.set(agentKey, [...entries, entry].slice(-ENTRY_LIMIT));
    if (byAgent.size > AGENT_LIMIT) byAgent.delete(byAgent.keys().next().value);
  }

  return {
    add,
    of: (agentKey) => byAgent.get(agentKey) ?? [],
  };
}
