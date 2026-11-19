import { AGENT_ACTION } from "../domain/agent-actions.js";

function outcomeOf(result) {
  return result.isOk
    ? { actionId: AGENT_ACTION.TESTS_PASSED, subject: result.passed }
    : { actionId: AGENT_ACTION.TESTS_FAILED, subject: result.failed };
}

// A call that ran tests names its result as the agent's action, in the office's own words.
export function withTestOutcome(event) {
  const result = event?.work?.result;
  return result ? { ...event, ...outcomeOf(result) } : event;
}
