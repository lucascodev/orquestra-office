import { publicFailureOf } from "./test-output/failure-fields.js";
import { MAX_FAILURES } from "./test-output/limits.js";
import { mergeSummaries } from "./test-output/merge-summaries.js";
import { readOutputLines } from "./test-output/output-lines.js";
import { TEST_OUTPUT_PARSERS } from "./test-output/parsers.js";

export { TEST_FRAMEWORK } from "./test-output/test-framework.js";

const hasNothingToReport = ({ passed, failed, skipped, failures }) =>
  passed === null && failed === null && skipped === null && failures.length === 0;

// A summary that says zero tests ran ("no tests ran", "0 passed; 0 failed") is not a run worth showing.
const ranNothing = ({ passed, failed, skipped, failures }) => passed === 0 && failed === 0 && skipped === 0 && failures.length === 0;

function publicFailuresOf(failures) {
  const kept = [];
  for (const failure of failures) {
    if (kept.length === MAX_FAILURES) break;
    const publicFailure = publicFailureOf(failure);
    if (publicFailure) kept.push(publicFailure);
  }
  return kept;
}

function summariesOf(lines, context) {
  return TEST_OUTPUT_PARSERS.flatMap((parser) => {
    const summary = parser.parse(lines, context);
    return summary && !hasNothingToReport(summary) ? [{ framework: parser.framework, summary }] : [];
  });
}

// A count the output does not show stays null, never 0, so the caller falls back to the exit code instead of an invented result.
export function parseTestOutput(output) {
  if (typeof output !== "string" || output.length === 0) return null;
  const { lines, isComplete } = readOutputLines(output);
  const merged = mergeSummaries(summariesOf(lines, { isComplete }));
  if (!merged || ranNothing(merged)) return null;
  return { ...merged, failures: publicFailuresOf(merged.failures) };
}
