import { countOf, unknownCounts } from "../count.js";
import { locationOf } from "../failure-fields.js";
import { TEST_FRAMEWORK } from "../test-framework.js";

const RUN_LINE = /^=== (?:RUN|CONT|PAUSE|NAME) +(\S+)$/;
const RESULT_LINE = /^\s*--- (PASS|FAIL|SKIP): (\S+) \(\d+(?:\.\d+)?s\)$/;
const LOG_LINE = /^\s+(\S+\.go):(\d+): (.*)$/;
const PACKAGE_OK = /^ok\s+\S+\s+(?:\d+(?:\.\d+)?s|\(cached\))/;
const PACKAGE_FAIL = /^FAIL\s+\S+\s+(?:\d+(?:\.\d+)?s|\[)/;
const SUBTEST_SEPARATOR = "/";

function parentOf(name) {
  const separator = name.lastIndexOf(SUBTEST_SEPARATOR);
  return separator > 0 ? name.slice(0, separator) : null;
}

// A parent test fails or passes with its subtests, so only the leaves are counted, as gotestsum does.
function leavesOf(results) {
  const parents = new Set([...results.keys()].map(parentOf));
  return [...results].filter(([name]) => !parents.has(name));
}

function readRun(lines) {
  const results = new Map();
  const details = new Map();
  let current = null;
  let isVerbose = false;
  for (const line of lines) {
    const run = RUN_LINE.exec(line);
    const result = RESULT_LINE.exec(line);
    const log = LOG_LINE.exec(line);
    if (run) {
      isVerbose = true;
      current = run[1];
    } else if (result) {
      results.set(result[2], result[1]);
      current = result[2];
    } else if (log && current && !details.has(current)) {
      details.set(current, { location: locationOf(log[1], log[2]), message: log[3] });
    }
  }
  return { results, details, isVerbose };
}

function countsOf(leaves, isVerbose, lines) {
  const countOfStatus = (status) => (isVerbose ? countOf(leaves.filter(([, leafStatus]) => leafStatus === status).length) : null);
  const failedLeaves = leaves.filter(([, status]) => status === "FAIL").length;
  const hasFailedPackage = lines.some((line) => PACKAGE_FAIL.test(line));
  const failed = failedLeaves > 0 || !hasFailedPackage ? countOf(failedLeaves) : null;
  return { passed: countOfStatus("PASS"), failed, skipped: countOfStatus("SKIP") };
}

function parse(lines, { isComplete }) {
  const hasPackageResult = lines.some((line) => PACKAGE_OK.test(line) || PACKAGE_FAIL.test(line));
  const { results, details, isVerbose } = readRun(lines);
  if (!hasPackageResult && results.size === 0) return null;
  const leaves = leavesOf(results);
  const failures = leaves
    .filter(([, status]) => status === "FAIL")
    .map(([name]) => ({ name, location: details.get(name)?.location ?? null, message: details.get(name)?.message ?? null }));
  return isComplete ? { ...countsOf(leaves, isVerbose, lines), failures } : unknownCounts(failures);
}

export const goParser = Object.freeze({ framework: TEST_FRAMEWORK.GO, parse });
