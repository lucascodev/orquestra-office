import { test } from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { parseTestOutput } from "../src/work/domain/test-output.js";
import { readOutputLines } from "../src/work/domain/test-output/output-lines.js";
import { TEST_OUTPUT_PARSERS } from "../src/work/domain/test-output/parsers.js";

const ONE_MB = 1024 * 1024;
const BUDGET_MS = 50;
// The best of a few runs measures the parser, not a garbage collection or another test process taking the CPU.
const ATTEMPTS = 5;

const fill = (unit) => unit.repeat(Math.ceil(ONE_MB / unit.length)).slice(0, ONE_MB);

// Each input targets a pattern a parser looks for, so a regex that backtracks on it would blow the budget.
const ADVERSARIAL_INPUTS = {
  "spaces followed by x": `${" ".repeat(ONE_MB - 1)}x`,
  "a= repeated": fill("a="),
  "one long line of words": fill("word "),
  "one long line of equals signs": fill("="),
  "underscores and spaces": fill("_ "),
  "colons and digits": fill(":1"),
  "an almost jest summary": `Tests: ${fill("1 passed, ")}`,
  "an almost vitest summary": `      Tests  ${fill("1 passed | ")}`,
  "an almost pytest summary": `= ${fill("1 passed, ")} in 0.1s x`,
  "an almost cargo panic": `thread 'x' panicked at ${fill("src/lib.rs:1:")}x`,
  "an almost stack frame": `    at ${fill("x (a:1:")}`,
  "an almost go result": `--- FAIL: ${fill("a ")}`,
  "unterminated ANSI sequences": fill("\x1b["),
  "unterminated OSC sequences": fill("\x1b]8;;"),
  "carriage returns": fill("\r"),
  "many jest failure headers": fill("  ● x\n"),
  "many tap failures without yaml end": fill("not ok 1 - x\n  ---\n"),
  "many cargo failure headers": fill("---- x stdout ----\n"),
  "many pytest sections": fill("____ test_x ____\n"),
  "many go runs": fill("=== RUN   TestX/y\n    x_test.go:1: m\n"),
  "lines of a count and a long word": fill(`1 ${"a".repeat(2_040)}\n`),
  "almost jest summaries with a long number": fill(`Tests: 1${"1".repeat(2_000)}, 1 total\n`),
  "almost vitest summaries with a long number": fill(`      Tests  1${"1".repeat(2_000)} (1)\n`),
  "almost pytest summaries with a long number": fill(`1 a${"1".repeat(2_000)}, in 1s\n`),
  "almost mix summaries with a long number": fill(`1 tests, ${"1".repeat(2_000)},\n`),
  "phpunit results with a long word": fill(`Tests: 1, Assertions: 1, ${"A".repeat(2_000)}.\n`),
};

function bestTimeMs(run) {
  let best = Infinity;
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    const start = performance.now();
    run();
    best = Math.min(best, performance.now() - start);
  }
  return best;
}

for (const [shape, input] of Object.entries(ADVERSARIAL_INPUTS)) {
  test(`every parser reads 1 MB of ${shape} in under ${BUDGET_MS} ms, even without the line cut`, () => {
    const rawLines = input.split("\n");
    const slow = TEST_OUTPUT_PARSERS
      .map((parser) => ({ framework: parser.framework, ms: bestTimeMs(() => parser.parse(rawLines, { isComplete: true })) }))
      .filter(({ ms }) => ms >= BUDGET_MS);
    assert.deepEqual(slow, []);
  });

  test(`parseTestOutput reads 1 MB of ${shape} in under ${BUDGET_MS} ms`, () => {
    const ms = bestTimeMs(() => parseTestOutput(input));
    assert.ok(ms < BUDGET_MS, `${ms.toFixed(1)} ms`);
  });
}

test("the reader keeps at most the first and the last 64 KB, cut into lines of up to 2 KB", () => {
  const { lines, isComplete } = readOutputLines(fill("x"));
  assert.equal(isComplete, false);
  assert.ok(lines.every((line) => line.length <= 2048));
  assert.ok(lines.join("").length <= 2 * 64 * 1024);
});
