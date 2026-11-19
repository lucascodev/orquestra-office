import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { parseTestOutput, TEST_FRAMEWORK } from "../src/work/domain/test-output.js";
import { readTestOutputFixture } from "./support/test-output-fixture.js";

const HUGE_FILLER_LINES = 150_000;
const FIELD_LIMIT = 300;
const MAX_FAILURES = 10;

const fillerOf = (line) => `${line}\n`.repeat(HUGE_FILLER_LINES);
const goFailure = (name, message = "boom") => `--- FAIL: ${name} (0.00s)\n    shop_test.go:7: ${message}\n`;
const codePointsOf = (text) => Array.from(text).length;

// Built from code points so the source never carries invisible characters itself.
const RIGHT_TO_LEFT_OVERRIDE = String.fromCodePoint(0x202e);
const LEFT_TO_RIGHT_ISOLATE = String.fromCodePoint(0x2066);
const POP_DIRECTIONAL_ISOLATE = String.fromCodePoint(0x2069);
const NEXT_LINE = String.fromCodePoint(0x85);
const CONTROL_SEQUENCE_INTRODUCER = String.fromCodePoint(0x9b);
const BELL = String.fromCodePoint(0x07);
const NULL = String.fromCodePoint(0x00);

test("ignores what is not text, or is empty", () => {
  for (const output of [undefined, null, 42, {}, ["Tests: 1 passed, 1 total"], ""]) {
    assert.equal(parseTestOutput(output), null);
  }
});

test("returns null for output without any known summary", () => {
  assert.equal(parseTestOutput("Compiling shop v0.1.0\nFinished release profile in 2.1s\nDone.\n"), null);
});

test("reads a summary painted with ANSI colors", () => {
  const output = "\x1b[1mTests:\x1b[22m       \x1b[1m\x1b[32m3 passed\x1b[39m\x1b[22m, 3 total\n";
  assert.deepEqual(parseTestOutput(output), { framework: "jest", passed: 3, failed: 0, skipped: 0, failures: [] });
});

test("reads a summary wrapped in a terminal hyperlink", () => {
  const output = "\x1b]8;;file:///C:/work/shop/report.html\x1b\\Tests:       3 passed, 3 total\x1b]8;;\x07\n";
  assert.deepEqual(parseTestOutput(output), { framework: "jest", passed: 3, failed: 0, skipped: 0, failures: [] });
});

test("lists a jest failure once even when the summary of all failing tests repeats it", () => {
  const block = "FAIL tests/discount.test.js\n  ● applyDiscount › applies the discount from 100\n\n    expect(received).toBe(expected)\n\n      at Object.toBe (tests/discount.test.js:5:32)\n";
  const output = `${block}\nSummary of all failing tests\n${block}\nTests:       1 failed, 1 total\n`;
  assert.equal(parseTestOutput(output).failures.length, 1);
});

test("does not take indented counts from another tool for playwright without its run header", () => {
  assert.equal(parseTestOutput("  1 failed\n  3 passed (878ms)\n"), null);
});

test("does not take the run listing of a second node:test run for failures of the first", () => {
  const first = readTestOutputFixture("node-test/spec-failures.txt");
  const second = readTestOutputFixture("node-test/spec-nested-failure.txt");
  const expected = [...parseTestOutput(first).failures, ...parseTestOutput(second).failures];
  assert.deepEqual(parseTestOutput(`${first}\n${second}`).failures, expected);
});

test("counts only the top-level tests of a tap stream that has no summary comments", () => {
  const withoutSummary = readTestOutputFixture("tap/node-tap-nested-failure.txt")
    .split("\n")
    .filter((line) => !line.startsWith("# "))
    .join("\n");
  const { passed, failed, skipped } = parseTestOutput(withoutSummary);
  assert.deepEqual({ passed, failed, skipped }, { passed: 0, failed: 1, skipped: 0 });
});

test("reads Windows line endings the same way as Unix ones", () => {
  const unix = readTestOutputFixture("jest/jest30-failures.txt").replaceAll("\r\n", "\n");
  assert.deepEqual(parseTestOutput(unix.replaceAll("\n", "\r\n")), parseTestOutput(unix));
});

test("reads only what a carriage return left visible on a progress line", () => {
  const output = "Tests:       9 passed, 9 total\rTests:       3 passed, 3 total\n";
  assert.deepEqual(parseTestOutput(output), { framework: "jest", passed: 3, failed: 0, skipped: 0, failures: [] });
});

test("reads the failures at the head and the summary at the tail of an output of several MB", () => {
  const output = [
    "FAIL tests/discount.test.js",
    "  ● applyDiscount › applies the discount from 100",
    "",
    "    expect(received).toBe(expected) // Object.is equality",
    "",
    "      at Object.toBe (tests/discount.test.js:5:32)",
    "",
    fillerOf("PASS tests/generated.test.js"),
    "Tests:       1 failed, 150000 passed, 150001 total",
  ].join("\n");

  assert.deepEqual(parseTestOutput(output), {
    framework: "jest",
    passed: 150_000,
    failed: 1,
    skipped: 0,
    failures: [{ name: "applyDiscount › applies the discount from 100", location: "tests/discount.test.js:5", message: "expect(received).toBe(expected) // Object.is equality" }],
  });
});

test("ignores a summary that sits only in the middle of an output of several MB", () => {
  const output = `${fillerOf("noise")}Tests:       3 passed, 3 total\n${fillerOf("noise")}`;
  assert.equal(parseTestOutput(output), null);
});

const SUMMED_BLOCK_FORMATS = [
  ["cargo", "test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s"],
  ["go", "=== RUN   TestSum\n--- PASS: TestSum (0.00s)\nPASS\nok  \texample.com/shop\t0.215s"],
  ["dotnet", "Passed!  - Failed:     0, Passed:     3, Skipped:     0, Total:     3, Duration: 19 ms - Shop.Tests.dll (net10.0)"],
  ["maven", "[INFO] Tests run: 3, Failures: 0, Errors: 0, Skipped: 0"],
  ["gradle", "> Task :test FAILED\n\n3 tests completed, 1 failed\n\nBUILD FAILED in 4s"],
];

for (const [framework, tail] of SUMMED_BLOCK_FORMATS) {
  test(`does not report ${framework} counts summed per block when the middle of the output was cut`, () => {
    const output = `${fillerOf("noise")}${tail}\n`;
    assert.deepEqual(parseTestOutput(output), null);
  });
}

test("keeps the failures it saw when the counts of a cut output are unknown", () => {
  const output = `${goFailure("TestApplyDiscount")}${fillerOf("noise")}FAIL\texample.com/shop\t0.312s\n`;
  assert.deepEqual(parseTestOutput(output), {
    framework: "go",
    passed: null,
    failed: null,
    skipped: null,
    failures: [{ name: "TestApplyDiscount", location: "shop_test.go:7", message: "boom" }],
  });
});

test("reads the pytest summary of a run with subtests, whose counts name two words", () => {
  const output = [
    "============================= test session starts =============================",
    "collected 1 item",
    "",
    "test_x.py .                                                              [100%]",
    "",
    "===================== 1 passed, 3 subtests passed in 0.02s =====================",
  ].join("\n");
  assert.deepEqual(parseTestOutput(output), { framework: "pytest", passed: 1, failed: 0, skipped: 0, failures: [] });
});

test("sums the summaries of different frameworks and calls the run mixed", () => {
  const jest = parseTestOutput(readTestOutputFixture("jest/jest30-failures.txt"));
  const pytest = parseTestOutput(readTestOutputFixture("pytest/pytest8-failures.txt"));
  const output = `${readTestOutputFixture("jest/jest30-failures.txt")}\n${readTestOutputFixture("pytest/pytest8-failures.txt")}`;

  assert.deepEqual(parseTestOutput(output), {
    framework: "mixed",
    passed: 10,
    failed: 5,
    skipped: 4,
    failures: [...jest.failures, ...pytest.failures],
  });
});

test("keeps the framework when one framework prints several summaries, as in a monorepo", () => {
  const output = `${readTestOutputFixture("vitest/vitest3-failures.txt")}\n${readTestOutputFixture("vitest/vitest2-passing.txt")}`;
  const { framework, passed, failed, skipped } = parseTestOutput(output);
  assert.deepEqual({ framework, passed, failed, skipped }, { framework: "vitest", passed: 8, failed: 2, skipped: 2 });
});

test("a count one framework does not print makes the merged count unknown instead of zero", () => {
  const output = `${readTestOutputFixture("go/passing.txt")}\n${readTestOutputFixture("jest/jest30-passing.txt")}`;
  assert.deepEqual(parseTestOutput(output), { framework: "mixed", passed: null, failed: 0, skipped: null, failures: [] });
});

test("keeps at most ten failures but counts all of them", () => {
  const output = `${Array.from({ length: 15 }, (_, index) => goFailure(`TestCase${index + 1}`)).join("")}FAIL\texample.com/shop\t0.1s\n`;
  const result = parseTestOutput(output);
  assert.equal(result.failed, 15);
  assert.deepEqual(result.failures.map(({ name }) => name), Array.from({ length: MAX_FAILURES }, (_, index) => `TestCase${index + 1}`));
});

test("cuts each failure field at 300 code points without splitting an emoji", () => {
  const longName = `Test${"😀".repeat(400)}`;
  const result = parseTestOutput(`${goFailure(longName, "é".repeat(500))}FAIL\texample.com/shop\t0.1s\n`);
  const [{ name, message }] = result.failures;
  assert.equal(codePointsOf(name), FIELD_LIMIT);
  assert.equal(codePointsOf(message), FIELD_LIMIT);
  assert.ok(name.startsWith(`Test${"😀".repeat(295)}`));
  assert.ok(name.isWellFormed());
});

test("removes control and bidi characters from the failure fields before cutting them", () => {
  const output = `--- FAIL: Test${RIGHT_TO_LEFT_OVERRIDE}Discount${LEFT_TO_RIGHT_ISOLATE} (0.00s)\n`
    + `    shop${NEXT_LINE}_test.go:7: evil${RIGHT_TO_LEFT_OVERRIDE}txt.exe${BELL}${CONTROL_SEQUENCE_INTRODUCER}${POP_DIRECTIONAL_ISOLATE}done${NULL}\n`
    + "FAIL\texample.com/shop\t0.1s\n";
  assert.deepEqual(parseTestOutput(output).failures, [{ name: "TestDiscount", location: "shop_test.go:7", message: "eviltxt.exedone" }]);
});

test("keeps only counts that are safe integers up to ten million", () => {
  const countsOf = (output) => {
    const { passed, failed, skipped } = parseTestOutput(output);
    return { passed, failed, skipped };
  };
  assert.deepEqual(countsOf("Tests:       10000000 passed, 10000000 total\n"), { passed: 10_000_000, failed: 0, skipped: 0 });
  assert.deepEqual(countsOf("Tests:       1 failed, 10000001 passed, 10000002 total\n"), { passed: null, failed: 1, skipped: 0 });
  assert.deepEqual(countsOf("Tests:       1 failed, 9007199254740993 passed, 9007199254740994 total\n"), { passed: null, failed: 1, skipped: 0 });
  assert.deepEqual(countsOf("Tests:       6000000 passed, 6000000 total\nTests:       6000000 passed, 6000000 total\n"), { passed: null, failed: 0, skipped: 0 });
});

test("cuts every line at 2 KB before reading it", () => {
  assert.equal(parseTestOutput(`Tests:${" ".repeat(3000)}3 passed, 3 total\n`), null);
});

test("the framework of every fixture comes from the fixed list", () => {
  const known = new Set(Object.values(TEST_FRAMEWORK));
  const fixturesDir = new URL("./fixtures/test-output/", import.meta.url);
  const frameworks = readdirSync(fixturesDir).flatMap((dir) =>
    readdirSync(new URL(`${dir}/`, fixturesDir)).map((file) => parseTestOutput(readTestOutputFixture(`${dir}/${file}`))?.framework ?? null));
  assert.ok(frameworks.some(Boolean));
  assert.deepEqual(frameworks.filter((framework) => framework !== null && !known.has(framework)), []);
  assert.ok(Object.isFrozen(TEST_FRAMEWORK));
});
