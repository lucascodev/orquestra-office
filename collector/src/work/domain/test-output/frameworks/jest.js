import { sumOf } from "../count.js";
import { countOrZero, countWordsOf } from "../count-words.js";
import { stackFrameLocationOf } from "../stack-frame.js";
import { isSummaryCandidate } from "../summary-line.js";
import { TEST_FRAMEWORK } from "../test-framework.js";

const SUMMARY = /^Tests:\s+\d[a-z0-9, ]* total$/;
const FAILED_FILE = /^FAIL (\S+)/;
const FAILURE_HEADER = "  ● ";
const SUITE_FAILED = "Test suite failed to run";
const IGNORED_HEADERS = new Set(["Console"]);
const BLOCK_ENDS = ["PASS ", "FAIL ", "Test Suites:"];

function countsOf(lines) {
  const summaries = lines.filter((line) => isSummaryCandidate(line) && SUMMARY.test(line)).map(countWordsOf);
  if (summaries.length === 0) return null;
  const total = (...words) => sumOf(summaries.map((counts) => countOrZero(counts, ...words)));
  return { passed: total("passed"), failed: total("failed"), skipped: total("skipped", "todo") };
}

function startFailure(title, file, failures) {
  if (IGNORED_HEADERS.has(title)) return null;
  const isSuiteFailure = title === SUITE_FAILED;
  const name = isSuiteFailure ? file : title;
  if (!name) return null;
  const failure = { name, location: isSuiteFailure ? file : null, message: null };
  failures.set(name, failure);
  return failure;
}

function addDetail(failure, line) {
  const text = line.trim();
  if (!text) return;
  if (!failure.message) failure.message = text;
  else failure.location ??= stackFrameLocationOf(line);
}

// Jest repeats every failure in its "Summary of all failing tests", so failures are keyed by name.
function failuresOf(lines) {
  const failures = new Map();
  let file = null;
  let current = null;
  for (const line of lines) {
    const failedFile = FAILED_FILE.exec(line);
    if (failedFile) file = failedFile[1];
    if (line.startsWith(FAILURE_HEADER)) current = startFailure(line.slice(FAILURE_HEADER.length), file, failures);
    else if (BLOCK_ENDS.some((start) => line.startsWith(start))) current = null;
    else if (current) addDetail(current, line);
  }
  return [...failures.values()];
}

function parse(lines) {
  const counts = countsOf(lines);
  return counts && { ...counts, failures: failuresOf(lines) };
}

export const jestParser = Object.freeze({ framework: TEST_FRAMEWORK.JEST, parse });
