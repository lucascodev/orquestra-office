// Frameworks only the command can name: the output parser has no reader for them, so their counts come from the exit code.
export const COMMAND_FRAMEWORK = Object.freeze({
  AVA: "ava",
  BUN: "bun",
  DENO: "deno",
  CYPRESS: "cypress",
  UNITTEST: "unittest",
  MINITEST: "minitest",
  PEST: "pest",
  FLUTTER: "flutter",
  DART: "dart",
  SWIFT: "swift",
  XCODEBUILD: "xcodebuild",
});
