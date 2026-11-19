import { countOf, sumOf } from "../count.js";
import { TEST_FRAMEWORK } from "../test-framework.js";

const PASSING = /^\s+(\d+) passing \(\d+[a-z]*\)$/;
const PENDING = /^\s+(\d+) pending$/;
const FAILING = /^\s+(\d+) failing$/;

// Mocha leaves out the pending and failing lines when they are zero.
const totalOf = (lines, pattern) => sumOf(lines.map((line) => pattern.exec(line)).filter(Boolean).map((match) => countOf(match[1])));

function parse(lines) {
  if (!lines.some((line) => PASSING.test(line))) return null;
  return { passed: totalOf(lines, PASSING), failed: totalOf(lines, FAILING), skipped: totalOf(lines, PENDING), failures: [] };
}

export const mochaParser = Object.freeze({ framework: TEST_FRAMEWORK.MOCHA, parse });
