import { AGENT_ACTION } from "../../office/domain/agent-actions.js";
import { testResultOf } from "../domain/tests/test-result.js";
import { WORK_UPDATE } from "../domain/work-update.js";

function outcomeOf(result) {
  return result.isOk
    ? { actionId: AGENT_ACTION.TESTS_PASSED, subject: result.passed }
    : { actionId: AGENT_ACTION.TESTS_FAILED, subject: result.failed };
}

/**
 * Turns the output a finished shell call carried into what it says about the tests, so the output itself goes no
 * further than the parser. A call that ran tests names its result as the agent's action.
 */
export function withTestResult(event, parseTestOutput) {
  if (event?.work?.type !== WORK_UPDATE.SHELL_FINISHED) return event;
  const { output, ...call } = event.work;
  const summary = output ? parseTestOutput(output) : null;
  const result = testResultOf({ test: call.test, script: call.script, summary, isCallOk: call.isCallOk, root: event.projectRoot || event.cwd });
  const work = { ...call, result };
  return result ? { ...event, work, ...outcomeOf(result) } : { ...event, work };
}
