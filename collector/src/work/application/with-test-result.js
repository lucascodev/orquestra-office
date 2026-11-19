import { testResultOf } from "../domain/tests/test-result.js";
import { WORK_UPDATE } from "../domain/work-update.js";

/**
 * Turns the output a finished shell call carried into what it says about the tests, so the output itself goes no
 * further than the parser.
 */
export function withTestResult(event, parseTestOutput) {
  if (event?.work?.type !== WORK_UPDATE.SHELL_FINISHED) return event;
  const { output, ...call } = event.work;
  const summary = output ? parseTestOutput(output) : null;
  const result = testResultOf({ test: call.test, script: call.script, summary, isCallOk: call.isCallOk, root: event.projectRoot || event.cwd });
  return { ...event, work: { ...call, result } };
}
