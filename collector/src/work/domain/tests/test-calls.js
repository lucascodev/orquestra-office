const CALL_LIMIT = 64;
const AGENT_LIMIT = 500;

const freshCalls = () => ({ started: new Map(), lastRunCallId: null });

// Kept in memory only, like the tool order: the start of each shell call, so its end can tell how long the tests took.
export function createTestCalls() {
  const byAgent = new Map();

  function callsOf(agentKey) {
    if (!byAgent.has(agentKey)) {
      byAgent.set(agentKey, freshCalls());
      if (byAgent.size > AGENT_LIMIT) byAgent.delete(byAgent.keys().next().value);
    }
    return byAgent.get(agentKey);
  }

  function start(agentKey, toolUseId, call) {
    if (!toolUseId) return;
    const { started } = callsOf(agentKey);
    started.set(toolUseId, call);
    if (started.size > CALL_LIMIT) started.delete(started.keys().next().value);
  }

  function finish(agentKey, toolUseId) {
    const { started } = callsOf(agentKey);
    const call = started.get(toolUseId) ?? null;
    started.delete(toolUseId);
    return call;
  }

  function runningOf(agentKey) {
    const shown = [...callsOf(agentKey).started.values()].filter((call) => call.test && !call.isBackground);
    const latest = shown.reduce((last, call) => (!last || call.startedAt >= last.startedAt ? call : last), null);
    return latest ? { command: latest.test.command, framework: latest.test.framework, startedAt: latest.startedAt } : null;
  }

  return {
    start,
    finish,
    runningOf,
    endTurn: (agentKey) => callsOf(agentKey).started.clear(),
    markLastRun: (agentKey, toolUseId) => {
      callsOf(agentKey).lastRunCallId = toolUseId;
    },
    isLastRun: (agentKey, toolUseId) => Boolean(toolUseId) && byAgent.get(agentKey)?.lastRunCallId === toolUseId,
  };
}
