import { remainderOf, sumOf } from "../count.js";
import { countOrZero, countWordsOf } from "../count-words.js";
import { TEST_FRAMEWORK } from "../test-framework.js";

const SUMMARY = /^\d+ (?:doctests?|tests?|properties|property|features?),[a-z0-9, ]*$/;
const FAILURE_WORDS = ["failure", "failures"];

// "1 doctest, 7 tests, 2 failures, 2 excluded, 1 skipped": every kind of test adds to the total, and the excluded ones did not run.
function countsOf(counts) {
  const total = countOrZero(counts, "doctest", "doctests", "test", "tests", "property", "properties", "feature", "features");
  const failed = countOrZero(counts, "failure", "failures", "invalid");
  const skipped = countOrZero(counts, "skipped");
  return { passed: remainderOf(total, [failed, skipped, countOrZero(counts, "excluded")]), failed, skipped };
}

function parse(lines) {
  const summaries = lines
    .filter((line) => SUMMARY.test(line))
    .map(countWordsOf)
    .filter((counts) => FAILURE_WORDS.some((word) => word in counts))
    .map(countsOf);
  if (summaries.length === 0) return null;
  const total = (field) => sumOf(summaries.map((summary) => summary[field]));
  return { passed: total("passed"), failed: total("failed"), skipped: total("skipped"), failures: [] };
}

export const mixParser = Object.freeze({ framework: TEST_FRAMEWORK.MIX, parse });
