import { countOf, remainderOf, sumOf } from "../count.js";
import { TEST_FRAMEWORK } from "../test-framework.js";

const ALL_PASSED = /^OK \((\d+) tests?, \d+ assertions?\)$/;
const RESULT = /^Tests: \d+, Assertions: \d+[A-Za-z0-9:, ]*\.$/;
const RESULT_FIELD = /([A-Za-z]+): (\d+)/g;

function fieldsOf(line) {
  const fields = {};
  for (const [, key, value] of line.matchAll(RESULT_FIELD)) fields[key] = countOf(value);
  return fields;
}

function countsOfResult(line) {
  const fields = fieldsOf(line);
  const failed = sumOf([fields.Errors ?? 0, fields.Failures ?? 0]);
  const skipped = sumOf([fields.Skipped ?? 0, fields.Incomplete ?? 0]);
  return { passed: remainderOf(fields.Tests, [failed, skipped]), failed, skipped };
}

function countsOfLine(line) {
  const allPassed = ALL_PASSED.exec(line);
  if (allPassed) return { passed: countOf(allPassed[1]), failed: 0, skipped: 0 };
  return RESULT.test(line) ? countsOfResult(line) : null;
}

function parse(lines) {
  const counts = lines.map(countsOfLine).filter(Boolean);
  if (counts.length === 0) return null;
  const total = (field) => sumOf(counts.map((count) => count[field]));
  return { passed: total("passed"), failed: total("failed"), skipped: total("skipped"), failures: [] };
}

export const phpunitParser = Object.freeze({ framework: TEST_FRAMEWORK.PHPUNIT, parse });
