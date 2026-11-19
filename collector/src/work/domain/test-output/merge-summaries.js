import { sumOf } from "./count.js";
import { TEST_FRAMEWORK } from "./test-framework.js";

function frameworkOf(found) {
  const frameworks = new Set(found.map(({ framework }) => framework));
  return frameworks.size === 1 ? found[0].framework : TEST_FRAMEWORK.MIXED;
}

export function mergeSummaries(found) {
  if (found.length === 0) return null;
  const countsOf = (field) => sumOf(found.map(({ summary }) => summary[field]));
  return {
    framework: frameworkOf(found),
    passed: countsOf("passed"),
    failed: countsOf("failed"),
    skipped: countsOf("skipped"),
    failures: found.flatMap(({ summary }) => summary.failures),
  };
}
