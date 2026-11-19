// The names the command reader and the output parser may give; anything else reaches the page as null.
const FRAMEWORKS = new Set([
  "jest", "vitest", "mocha", "jasmine", "karma", "ava", "tap", "node:test", "bun", "deno", "playwright", "cypress",
  "pytest", "unittest",
  "go",
  "cargo",
  "dotnet",
  "maven", "surefire", "gradle", "junit",
  "rspec", "minitest",
  "phpunit", "pest",
  "mix", "exunit",
  "flutter", "dart",
  "swift", "xcodebuild",
]);

export function frameworkOf(value) {
  return FRAMEWORKS.has(value) ? value : null;
}
