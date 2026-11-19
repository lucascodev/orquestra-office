import { countOf, remainderOf, sumOf, unknownCounts } from "../count.js";
import { TEST_FRAMEWORK } from "../test-framework.js";

// The per-class lines end with "Time elapsed", so only the "Results:" line of each module matches.
const MODULE_RESULT = /^(?:\[[A-Z]+\] )?Tests run: (\d+), Failures: (\d+), Errors: (\d+), Skipped: (\d+)$/;

function parse(lines, { isComplete }) {
  const results = lines.map((line) => MODULE_RESULT.exec(line)).filter(Boolean);
  if (results.length === 0) return null;
  if (!isComplete) return unknownCounts([]);
  const total = (group) => sumOf(results.map((result) => countOf(result[group])));
  const failed = sumOf([total(2), total(3)]);
  const skipped = total(4);
  return { passed: remainderOf(total(1), [failed, skipped]), failed, skipped, failures: [] };
}

export const mavenParser = Object.freeze({ framework: TEST_FRAMEWORK.MAVEN, parse });
