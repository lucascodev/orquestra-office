const FINISHED_LIMIT = 256;
const AGENT_LIMIT = 500;

export const TOOL_PHASE = Object.freeze({ BEFORE: "before", AFTER: "after" });

function freshCalls() {
  return { started: new Set(), finished: new Set(), closedByTurnEnd: new Set() };
}

function rememberFinished(calls, toolUseId) {
  calls.finished.add(toolUseId);
  if (calls.finished.size > FINISHED_LIMIT) calls.finished.delete(calls.finished.values().next().value);
}

// Activity hooks run in the background, one process each, so the events of a call can arrive out of order.
// A late event still goes to the history; it just must not move the agent back to what it was doing before.
export function createToolOrder() {
  const callsByAgent = new Map();

  function callsOf(agentKey) {
    if (!callsByAgent.has(agentKey)) {
      callsByAgent.set(agentKey, freshCalls());
      if (callsByAgent.size > AGENT_LIMIT) callsByAgent.delete(callsByAgent.keys().next().value);
    }
    return callsByAgent.get(agentKey);
  }

  function isLate(agentKey, event) {
    if (!event.toolUseId) return false;
    const calls = callsOf(agentKey);
    if (calls.closedByTurnEnd.has(event.toolUseId)) return true;
    return event.toolPhase === TOOL_PHASE.BEFORE && calls.finished.has(event.toolUseId);
  }

  function note(agentKey, event) {
    const calls = callsOf(agentKey);
    if (event.toolPhase === TOOL_PHASE.BEFORE && !calls.finished.has(event.toolUseId)) calls.started.add(event.toolUseId);
    if (event.toolPhase === TOOL_PHASE.AFTER) {
      calls.started.delete(event.toolUseId);
      rememberFinished(calls, event.toolUseId);
    }
    if (event.endsTurn) {
      calls.closedByTurnEnd = new Set(calls.started);
      calls.started.clear();
    }
  }

  return { isLate, note };
}
