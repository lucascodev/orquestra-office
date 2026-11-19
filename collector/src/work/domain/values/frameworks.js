import { TEST_FRAMEWORK } from "../test-output/test-framework.js";

// The names the command reader and the output parser may give; anything else reaches the page as null.
const FRAMEWORKS = new Set([
  ...Object.values(TEST_FRAMEWORK),
  "jasmine", "karma", "ava", "bun", "deno", "cypress",
  "unittest",
  "surefire", "junit",
  "minitest",
  "pest",
  "exunit",
  "flutter", "dart",
  "swift", "xcodebuild",
]);

export function frameworkOf(value) {
  return FRAMEWORKS.has(value) ? value : null;
}
