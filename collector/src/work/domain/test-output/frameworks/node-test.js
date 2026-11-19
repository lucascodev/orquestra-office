import { countOf, sumOf } from "../count.js";
import { locationOf } from "../failure-fields.js";
import { TEST_FRAMEWORK } from "../test-framework.js";

const COUNT_LINE = /^ℹ (pass|fail|cancelled|skipped|todo) (\d+)$/;
const FAILING_TESTS_HEADER = "✖ failing tests:";
const TEST_LOCATION = /^test at (.+):(\d+):\d+$/;
const FAILED_TEST_MARK = "✖ ";
const DURATION_START = " (";
const DURATION = /^\d+(?:\.\d+)?m?s\)$/;
// A second run in the same output (a monorepo) starts listing tests again after the first failing list.
const RUN_LISTING_STARTS = ["✔ ", "▶ ", "﹣ ", "ℹ "];

function countsOf(lines) {
  const counts = { pass: [], fail: [], cancelled: [], skipped: [], todo: [] };
  for (const line of lines) {
    const match = COUNT_LINE.exec(line);
    if (match) counts[match[1]].push(countOf(match[2]));
  }
  if (counts.pass.length === 0 || counts.fail.length === 0) return null;
  return {
    passed: sumOf(counts.pass),
    failed: sumOf([...counts.fail, ...counts.cancelled]),
    skipped: sumOf([...counts.skipped, ...counts.todo]),
  };
}

// "✖ name (1.2ms)"; a test cancelled before it started has no duration.
function failedTestNameOf(line) {
  if (!line.startsWith(FAILED_TEST_MARK)) return null;
  const title = line.slice(FAILED_TEST_MARK.length);
  const durationStart = title.lastIndexOf(DURATION_START);
  const hasDuration = durationStart > 0 && DURATION.test(title.slice(durationStart + DURATION_START.length));
  return hasDuration ? title.slice(0, durationStart) : title;
}

// Only the "failing tests" list at the end names the leaf tests that failed; the run above also marks their suites.
function failuresOf(lines) {
  const failures = [];
  let isInFailingList = false;
  let location = null;
  let current = null;
  for (const line of lines) {
    if (line === FAILING_TESTS_HEADER) {
      isInFailingList = true;
      continue;
    }
    if (RUN_LISTING_STARTS.some((start) => line.startsWith(start))) isInFailingList = false;
    if (!isInFailingList) continue;
    const testLocation = TEST_LOCATION.exec(line);
    const failedTestName = failedTestNameOf(line);
    if (testLocation) {
      location = locationOf(testLocation[1], testLocation[2]);
      current = null;
    } else if (failedTestName) {
      current = { name: failedTestName, location, message: null };
      failures.push(current);
      location = null;
    } else if (current && !current.message && line.trim()) {
      current.message = line.trim();
    }
  }
  return failures;
}

function parse(lines) {
  const counts = countsOf(lines);
  return counts && { ...counts, failures: failuresOf(lines) };
}

export const nodeTestParser = Object.freeze({ framework: TEST_FRAMEWORK.NODE_TEST, parse });
