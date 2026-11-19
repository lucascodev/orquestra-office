import { countOf, remainderOf, sumOf, unknownCounts } from "../count.js";
import { TEST_FRAMEWORK } from "../test-framework.js";

const TASK_LINE = /^> Task (\S+)/;
const TEST_TASK_SUFFIX = ":test";
const TASK_RESULT = /^(\d+) tests? completed(?:, (\d+) failed)?(?:, (\d+) skipped)?$/;
const BUILD_SUCCESSFUL = "BUILD SUCCESSFUL";

const isTestTask = (line) => TASK_LINE.exec(line)?.[1].endsWith(TEST_TASK_SUFFIX) ?? false;

// Gradle prints the count line only when a test task fails; a successful build with a test task means no test failed.
function parse(lines, { isComplete }) {
  const results = lines.map((line) => TASK_RESULT.exec(line)).filter(Boolean);
  const hasTestTask = lines.some(isTestTask);
  if (results.length === 0 && !hasTestTask) return null;
  if (!isComplete) return unknownCounts([]);
  if (results.length === 0) {
    const isSuccessful = lines.some((line) => line.startsWith(BUILD_SUCCESSFUL));
    return { passed: null, failed: isSuccessful ? 0 : null, skipped: null, failures: [] };
  }
  const total = (group) => sumOf(results.map((result) => countOf(result[group] ?? "0")));
  const failed = total(2);
  const skipped = total(3);
  return { passed: remainderOf(total(1), [failed, skipped]), failed, skipped, failures: [] };
}

export const gradleParser = Object.freeze({ framework: TEST_FRAMEWORK.GRADLE, parse });
