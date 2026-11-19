import { test } from "node:test";
import assert from "node:assert/strict";
import { isTestFile } from "../src/work/domain/tests/test-file.js";
import { projectPathOf } from "../src/shared/path/project-path.js";

const testFiles = [
  "src/calc.test.ts",
  "src/calc.spec.js",
  "src/__tests__/calc.js",
  "cypress/e2e/login.cy.ts",
  "tests/test_calc.py",
  "app/calc_test.py",
  "test_calc.py",
  "tests/fixtures/data.json",
  "collector/test/support/hook-client.js",
  "spec/models/user.rb",
  "pkg/calc/calc_test.go",
  "src/test/java/com/acme/CalculatorTest.java",
  "src/test/java/com/acme/CalculatorTests.java",
  "app/src/CalculatorTest.kt",
  "Acme.Tests/CalculatorTests.cs",
  "Acme/CalculatorTest.cs",
  "lib/calc_spec.rb",
  "src/CalculatorTest.php",
  "lib/calc_test.exs",
  "lib/calc_test.dart",
  "Sources/CalculatorTests.swift",
  "features/login.feature",
  "C:\\repo\\web\\Tests\\calc.js",
];

for (const path of testFiles) {
  test(`${path} is a test file`, () => {
    assert.equal(isTestFile(path), true);
  });
}

const sourceFiles = [
  "src/calc.ts",
  "src/latest.js",
  "src/Latest.java",
  "src/contest.py",
  "src/testing.go",
  "src/test-utils.js",
  "README.md",
  "tests",
  "",
  undefined,
];

for (const path of sourceFiles) {
  test(`${path} is not a test file`, () => {
    assert.equal(isTestFile(path), false);
  });
}

const projectPaths = [
  ["a path inside the project root", "/home/dev/app/src/calc.test.ts", "/home/dev/app", "src/calc.test.ts"],
  ["a Windows path with another case and slashes", "C:\\Projetos\\App\\web\\calc.test.js", "c:/projetos/app", "web/calc.test.js"],
  ["a root with a trailing slash", "/home/dev/app/a.js", "/home/dev/app/", "a.js"],
  ["a relative path", "./src/a.js", "/home/dev/app", "src/a.js"],
  ["a path outside the root, which keeps only its name", "/home/dev/other/secret/a.js", "/home/dev/app", "a.js"],
  ["a sibling folder that starts like the root", "/home/dev/app-old/a.js", "/home/dev/app", "a.js"],
  ["a path with no root known", "/home/dev/app/a.js", "", "a.js"],
  ["no path", undefined, "/home/dev/app", ""],
];

for (const [what, path, root, expected] of projectPaths) {
  test(`the project path of ${what} is ${expected || "empty"}`, () => {
    assert.equal(projectPathOf(path, root), expected);
  });
}
