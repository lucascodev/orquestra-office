import { countOf, sumOf } from "../count.js";
import { TEST_FRAMEWORK } from "../test-framework.js";

const RUN_HEADER = /^Running \d+ tests? using \d+ workers?/;
const RESULT = /^ {2}(\d+) (passed|failed|flaky|skipped|interrupted|did not run)(?: \(.+\))?$/;
const PASSED = ["passed", "flaky"];
const FAILED = ["failed", "interrupted"];
const SKIPPED = ["skipped", "did not run"];

// Playwright prints only the outcomes that happened, so a missing one is zero.
function parse(lines) {
  if (!lines.some((line) => RUN_HEADER.test(line))) return null;
  const results = lines.map((line) => RESULT.exec(line)).filter(Boolean);
  if (results.length === 0) return null;
  const total = (outcomes) => sumOf(results.filter((result) => outcomes.includes(result[2])).map((result) => countOf(result[1])));
  return { passed: total(PASSED), failed: total(FAILED), skipped: total(SKIPPED), failures: [] };
}

export const playwrightParser = Object.freeze({ framework: TEST_FRAMEWORK.PLAYWRIGHT, parse });
