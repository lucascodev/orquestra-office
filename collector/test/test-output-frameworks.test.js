import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTestOutput } from "../src/work/domain/test-output.js";
import { readTestOutputFixture } from "./support/test-output-fixture.js";

const summary = (framework, passed, failed, skipped, failures = []) => ({ framework, passed, failed, skipped, failures });

const JEST_FAILURES = [
  { name: "applyDiscount › applies the discount from 100", location: "tests/discount.test.js:5", message: "expect(received).toBe(expected) // Object.is equality" },
  { name: "applyDiscount › rejects negative totals", location: "tests/discount.test.js:9", message: "expect(received).toThrow(expected)" },
];

const VITEST_FAILURES = [
  { name: "applyDiscount > applies the discount from 100", location: "tests/discount.test.js:6", message: "AssertionError: expected 100 to be 90 // Object.is equality" },
  { name: "applyDiscount > rejects negative totals", location: "tests/discount.test.js:10", message: "AssertionError: expected [Function] to throw an error" },
];

const pytestFailures = (didNotRaise) => [
  { name: "test_applies_the_discount_from_100", location: "tests\\test_discount.py:7", message: "assert 100 == 90" },
  { name: "test_rejects_negative_totals", location: "tests\\test_discount.py:11", message: `Failed: DID NOT RAISE ${didNotRaise}` },
  { name: "TestCoupon::test_rejects_an_expired_coupon", location: "tests\\test_discount.py:21", message: "KeyError: 'coupon EXPIRED10'" },
];

const NODE_SPEC_FAILURES = [
  { name: "applies the discount from 100", location: "test\\discount.test.js:5", message: "AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:" },
  { name: "rejects negative totals", location: "test\\discount.test.js:9", message: "AssertionError [ERR_ASSERTION]: Missing expected exception." },
];

const NODE_TAP_FAILURES = [
  { name: "applies the discount from 100", location: "C:\\work\\shop\\test\\discount.test.js:5", message: "Expected values to be strictly equal:" },
  { name: "rejects negative totals", location: "C:\\work\\shop\\test\\discount.test.js:9", message: "Missing expected exception." },
];

const GO_FAILURES = [
  { name: "TestApplyDiscount", location: "discount_test.go:12", message: "ApplyDiscount(100) = 100; want 90" },
  { name: "TestRejectsNegativeTotals", location: "discount_test.go:19", message: "expected an error for a negative total, got <nil>" },
  { name: "TestCoupon/expired", location: "coupon_test.go:15", message: "coupon EXPIRED10 was accepted" },
];

const CARGO_UNIT_FAILURE = { name: "tests::applies_the_discount_from_100", location: "src\\lib.rs:33", message: "assertion `left == right` failed" };
const CARGO_INTEGRATION_FAILURE = { name: "rejects_negative_totals", location: "tests\\checkout.rs:12", message: "negative total accepted: -1" };

const RSPEC_FAILURES = [
  { name: "Discount applies the discount from 100", location: "spec/discount_spec.rb:5", message: "expected: 90" },
  { name: "Discount coupon rejects an expired coupon", location: "spec/discount_spec.rb:14", message: "KeyError: coupon EXPIRED10" },
];

const CASES = [
  ["jest 30 with failures, a skipped test and a todo", "jest/jest30-failures.txt", summary("jest", 5, 2, 2, JEST_FAILURES)],
  ["jest 29 with failures, a skipped test and a todo", "jest/jest29-failures.txt", summary("jest", 5, 2, 2, JEST_FAILURES)],
  ["jest 30 with every test passing", "jest/jest30-passing.txt", summary("jest", 3, 0, 0)],
  ["jest 29 with every test passing", "jest/jest29-passing.txt", summary("jest", 3, 0, 0)],
  ["jest 30 with skipped tests", "jest/jest30-skipped.txt", summary("jest", 1, 0, 2)],
  ["jest 29 with skipped tests", "jest/jest29-skipped.txt", summary("jest", 1, 0, 2)],
  ["jest 30 with a suite that failed to run and an error thrown inside a dependency", "jest/jest30-suite-error.txt", summary("jest", 1, 1, 0, [
    { name: "rejects an expired coupon", location: "extra/coupon.test.js:4", message: "RangeError: coupon EXPIRED10 is past its date" },
    { name: "extra/checkout.test.js", location: "extra/checkout.test.js", message: "Cannot find module '../src/checkout' from 'extra/checkout.test.js'" },
  ])],
  ["jest that found no tests", "jest/jest30-no-tests.txt", null],

  ["vitest 3 with failures, a skipped test and a todo", "vitest/vitest3-failures.txt", summary("vitest", 5, 2, 2, VITEST_FAILURES)],
  ["vitest 2 with failures, a skipped test and a todo", "vitest/vitest2-failures.txt", summary("vitest", 5, 2, 2, VITEST_FAILURES)],
  ["vitest 3 with every test passing", "vitest/vitest3-passing.txt", summary("vitest", 3, 0, 0)],
  ["vitest 2 with every test passing", "vitest/vitest2-passing.txt", summary("vitest", 3, 0, 0)],
  ["vitest 3 with skipped tests", "vitest/vitest3-skipped.txt", summary("vitest", 1, 0, 2)],
  ["vitest 2 with skipped tests", "vitest/vitest2-skipped.txt", summary("vitest", 1, 0, 2)],
  ["vitest 3 with a file that failed to load, whose test count is unknown", "vitest/vitest3-load-error.txt", summary("vitest", null, null, null, [
    { name: "extra/checkout.test.js", location: "extra/checkout.test.js:2", message: "Error: Cannot find module '../src/checkout.js' imported from 'C:/work/shop/extra/checkout.test.js'" },
  ])],
  ["vitest that found no test files", "vitest/vitest3-no-tests.txt", null],

  ["pytest 8 with failures, a skip and an xfail", "pytest/pytest8-failures.txt", summary("pytest", 5, 3, 2, pytestFailures("<class 'ValueError'>"))],
  ["pytest 8 in quiet mode", "pytest/pytest8-quiet-failures.txt", summary("pytest", 5, 3, 2, pytestFailures("<class 'ValueError'>"))],
  ["pytest 9 with failures", "pytest/pytest9-failures.txt", summary("pytest", 5, 3, 2, pytestFailures("ValueError"))],
  ["pytest 8 with every test passing", "pytest/pytest8-passing.txt", summary("pytest", 3, 0, 0)],
  ["pytest 8 with a skip and an xfail", "pytest/pytest8-skipped.txt", summary("pytest", 1, 0, 2)],
  ["pytest 8 with a collection error", "pytest/pytest8-collection-error.txt", summary("pytest", 0, 1, 0, [
    { name: "tests/test_checkout.py", location: "tests\\test_checkout.py:1", message: "ModuleNotFoundError: No module named 'shop'" },
  ])],
  ["pytest 8 with an error in a fixture setup and an xpass counted as passed", "pytest/pytest8-setup-error.txt", summary("pytest", 2, 1, 0, [
    { name: "test_lists_orders", location: "tests\\test_orders.py:6", message: "ConnectionError: database is down" },
  ])],
  ["pytest 8 without the short summary, naming failures by their sections", "pytest/pytest8-no-short-summary.txt", summary("pytest", 5, 3, 2,
    pytestFailures("<class 'ValueError'>").map((failure) => ({ ...failure, name: failure.name.replace("::", ".") })))],
  ["pytest 8 that ran no tests", "pytest/pytest8-no-tests-ran.txt", null],
  ["pytest 8 that stopped on a usage error", "pytest/pytest8-usage-error.txt", null],

  ["node:test spec reporter with failures, a skip and a todo", "node-test/spec-failures.txt", summary("node-test", 5, 2, 2, NODE_SPEC_FAILURES)],
  ["node:test spec reporter with every test passing", "node-test/spec-passing.txt", summary("node-test", 3, 0, 0)],
  ["node:test spec reporter with a skip and a todo", "node-test/spec-skipped.txt", summary("node-test", 1, 0, 2)],
  ["node:test spec reporter with a failure inside nested suites", "node-test/spec-nested-failure.txt", summary("node-test", 1, 1, 0, [
    { name: "rejects an expired coupon", location: "nested\\coupon.test.js:6", message: "RangeError [Error]: coupon EXPIRED10 is past its date" },
  ])],
  ["node:test spec reporter counting cancelled tests as failed", "node-test/spec-cancelled.txt", summary("node-test", 0, 2, 0, [
    { name: "waits for the bank", location: "cancel\\slow.test.js:4", message: "'test did not finish before its parent and was cancelled'" },
    { name: "confirms the charge", location: "cancel\\slow.test.js:8", message: "'test did not finish before its parent and was cancelled'" },
    { name: "payment gateway", location: "cancel\\slow.test.js:3", message: "'test timed out after 50ms'" },
  ])],
  ["node:test that found no test file", "node-test/spec-no-tests.txt", null],

  ["node:test tap reporter with failures, a skip and a todo", "tap/node-tap-failures.txt", summary("tap", 5, 2, 2, NODE_TAP_FAILURES)],
  ["node:test tap reporter with every test passing", "tap/node-tap-passing.txt", summary("tap", 3, 0, 0)],
  ["node:test tap reporter with a skip and a todo", "tap/node-tap-skipped.txt", summary("tap", 1, 0, 2)],
  ["node:test tap reporter with a failure inside nested suites", "tap/node-tap-nested-failure.txt", summary("tap", 1, 1, 0, [
    { name: "rejects an expired coupon", location: "C:\\work\\shop\\nested\\coupon.test.js:6", message: "coupon EXPIRED10 is past its date" },
  ])],
  ["node:test tap reporter counting cancelled tests as failed", "tap/node-tap-cancelled.txt", summary("tap", 0, 2, 0, [
    { name: "waits for the bank", location: "C:\\work\\shop\\cancel\\slow.test.js:4", message: "test did not finish before its parent and was cancelled" },
    { name: "confirms the charge", location: "C:\\work\\shop\\cancel\\slow.test.js:8", message: "test did not finish before its parent and was cancelled" },
    { name: "payment gateway", location: "C:\\work\\shop\\cancel\\slow.test.js:3", message: "test timed out after 50ms" },
  ])],
  ["tape with a failure", "tap/tape-failures.txt", summary("tap", 2, 1, 0, [
    { name: "applies the discount from 100", location: "/work/shop/test/discount.js:6", message: null },
  ])],
  ["bats with a failure and a skip, without summary comments", "tap/bats-failures.txt", summary("tap", 2, 1, 1, [
    { name: "applies the discount from 100", location: "test/shop.bats:9", message: "`[ \"$result\" -eq 90 ]' failed" },
  ])],
  ["a tap stream cut before its plan", "tap/no-plan.txt", null],

  ["go test with every package passing", "go/passing.txt", summary("go", null, 0, null)],
  ["go test with failures, counting only the failing leaves", "go/failures.txt", summary("go", null, 3, null, GO_FAILURES)],
  ["go test -v with every test passing, counting subtests and not their parent", "go/verbose-passing.txt", summary("go", 4, 0, 0)],
  ["go test -v with a skip", "go/verbose-skipped.txt", summary("go", 1, 0, 1)],
  ["go test -v with failures, a skip and subtests", "go/verbose-failures.txt", summary("go", 2, 3, 1, GO_FAILURES)],
  ["go test -v with parallel tests, giving each log line to the test that resumed", "go/verbose-parallel.txt", summary("go", 1, 1, 0, [
    { name: "TestCheckout", location: "checkout_test.go:21", message: "Checkout() total = 100; want 90" },
  ])],
  ["go test that failed to build", "go/build-error.txt", null],
  ["go test without test files", "go/no-test-files.txt", null],

  ["cargo test stopping at the first failing target", "cargo/failures.txt", summary("cargo", 2, 1, 1, [CARGO_UNIT_FAILURE])],
  ["cargo test --no-fail-fast summing every target", "cargo/no-fail-fast.txt", summary("cargo", 4, 2, 1, [CARGO_UNIT_FAILURE, CARGO_INTEGRATION_FAILURE])],
  ["cargo test with every test passing", "cargo/passing.txt", summary("cargo", 2, 0, 0)],
  ["cargo test with an ignored test", "cargo/skipped.txt", summary("cargo", 4, 0, 1)],
  ["cargo test from Rust before 1.73, with the panic message inside quotes", "cargo/legacy-panic-format.txt", summary("cargo", 1, 2, 0, [
    { name: "tests::applies_the_discount_from_100", location: "src/lib.rs:33", message: "assertion failed: `(left == right)`" },
    { name: "rejects_negative_totals", location: "tests/checkout.rs:12", message: "negative total accepted: -1" },
  ])],
  ["cargo test that failed to compile", "cargo/compile-error.txt", null],

  ["dotnet test with failures and a skip", "dotnet/vstest-failures.txt", summary("dotnet", 5, 2, 1)],
  ["dotnet test in portuguese", "dotnet/vstest-failures-pt-br.txt", summary("dotnet", 5, 2, 1)],
  ["dotnet test with the terminal logger", "dotnet/terminal-logger-failures.txt", summary("dotnet", 5, 2, 1)],
  ["dotnet test on Microsoft.Testing.Platform", "dotnet/mtp-failures.txt", summary("dotnet", 5, 2, 1)],
  ["dotnet test with every test passing", "dotnet/vstest-passing.txt", summary("dotnet", 3, 0, 0)],
  ["dotnet test with a skip", "dotnet/vstest-skipped.txt", summary("dotnet", 1, 0, 1)],
  ["dotnet test that failed to build", "dotnet/build-error.txt", null],

  ["maven surefire with failures and a skip", "maven/failures.txt", summary("maven", 5, 2, 1)],
  ["maven surefire with every test passing", "maven/passing.txt", summary("maven", 3, 0, 0)],
  ["maven surefire summing the modules of a reactor", "maven/skipped-multi-module.txt", summary("maven", 5, 0, 1)],
  ["maven surefire counting errors as failures", "maven/errors.txt", summary("maven", 1, 1, 0)],
  ["maven that failed to compile the tests", "maven/compile-error.txt", null],

  ["gradle with failures and a skip", "gradle/failures.txt", summary("gradle", 5, 2, 1)],
  ["gradle with every test passing, which prints no count", "gradle/passing.txt", summary("gradle", null, 0, null)],
  ["gradle summing the test tasks of every module", "gradle/multi-module-skipped-failures.txt", summary("gradle", 5, 2, 2)],
  ["gradle that failed to compile the tests", "gradle/compile-error.txt", null],
  ["a successful gradle build that ran no test task", "gradle/build-without-tests.txt", null],

  ["mocha with failures and pending tests", "mocha/failures.txt", summary("mocha", 5, 2, 2)],
  ["mocha with every test passing", "mocha/passing.txt", summary("mocha", 3, 0, 0)],
  ["mocha with pending tests", "mocha/skipped.txt", summary("mocha", 1, 0, 2)],
  ["mocha that found no test files", "mocha/no-tests.txt", null],

  ["rspec with failures and a pending example", "rspec/failures.txt", summary("rspec", 4, 2, 1, RSPEC_FAILURES)],
  ["rspec with every example passing", "rspec/passing.txt", summary("rspec", 4, 0, 0)],
  ["rspec documentation format with a pending example", "rspec/skipped-documentation.txt", summary("rspec", 1, 0, 1)],
  ["rspec with an error outside of examples", "rspec/load-error.txt", summary("rspec", 0, 1, 0)],
  ["rspec that crashed before running", "rspec/crash.txt", null],

  ["phpunit 11 with errors, failures and a skip", "phpunit/phpunit11-failures.txt", summary("phpunit", 4, 3, 1)],
  ["phpunit 10 with every test passing", "phpunit/phpunit10-passing.txt", summary("phpunit", 5, 0, 0)],
  ["phpunit 11 with a skipped and an incomplete test", "phpunit/phpunit11-skipped.txt", summary("phpunit", 1, 0, 2)],
  ["phpunit that did not find the test file", "phpunit/no-tests.txt", null],

  ["mix test with doctests, failures and a skip", "mix/failures.txt", summary("mix", 5, 2, 1)],
  ["mix test with every test passing", "mix/passing.txt", summary("mix", 5, 0, 0)],
  ["mix test with excluded and skipped tests", "mix/skipped-excluded.txt", summary("mix", 2, 0, 1)],
  ["mix test that failed to compile", "mix/compile-error.txt", null],

  ["playwright with a failure and a skip", "playwright/failures.txt", summary("playwright", 3, 1, 1)],
  ["playwright with every test passing", "playwright/passing.txt", summary("playwright", 2, 0, 0)],
  ["playwright with only a skipped test", "playwright/skipped.txt", summary("playwright", 0, 0, 1)],
  ["playwright counting a flaky test as passed", "playwright/flaky.txt", summary("playwright", 3, 0, 0)],
  ["playwright stopped by --max-failures, counting what did not run as skipped", "playwright/max-failures.txt", summary("playwright", 2, 1, 2)],
  ["playwright that found no tests", "playwright/no-tests.txt", null],
];

for (const [behavior, fixture, expected] of CASES) {
  test(`reads ${behavior}`, () => {
    assert.deepEqual(parseTestOutput(readTestOutputFixture(fixture)), expected);
  });
}
