import { redactSecrets } from "../values/redact-secrets.js";
import { lineOf } from "../values/safe-text.js";
import { commandSegmentsOf, positionalWordsOf, programOf } from "./command-segments.js";

const COMMAND_LIMIT = 200;
const PACKAGE_TEST_WORDS = new Set(["test", "t", "tst"]);
const PACKAGE_RUN_WORDS = new Set(["run", "run-script"]);
const MAVEN_TEST_GOALS = new Set(["test", "verify"]);
const UNKNOWN_FRAMEWORK = null;

const ranAs = (framework) => ({ framework });

const isTestScript = (name) => name === "test" || name.startsWith("test:") || name.startsWith("test-") || name.startsWith("test.");

function packageScriptTest(args) {
  const [first, second, third] = positionalWordsOf(args);
  if (PACKAGE_TEST_WORDS.has(first)) return ranAs(UNKNOWN_FRAMEWORK);
  if (PACKAGE_RUN_WORDS.has(first) && isTestScript(second ?? "")) return ranAs(UNKNOWN_FRAMEWORK);
  if (first === "workspace" && PACKAGE_TEST_WORDS.has(third)) return ranAs(UNKNOWN_FRAMEWORK);
  return null;
}

const always = (framework) => () => ranAs(framework);
const whenFirst = (framework, subcommands) => (args) => (subcommands.includes(positionalWordsOf(args)[0]) ? ranAs(framework) : null);
const whenAny = (framework, isTarget) => (args) => (args.some(isTarget) ? ranAs(framework) : null);

const isGradleTestTask = (word) => {
  const task = word.split(":").at(-1);
  return task === "test" || /^test[A-Z]\w*$/.test(task);
};
const isNxTestTarget = (word) => word === "test" || word.endsWith(":test");
const isRakeTest = (word) => word === "test" || word.startsWith("test:");

function pythonModuleTest(args) {
  const moduleFlag = args.indexOf("-m");
  const module = moduleFlag >= 0 ? args[moduleFlag + 1] : null;
  if (module === "pytest") return ranAs("pytest");
  if (module === "unittest") return ranAs("unittest");
  return null;
}

function phpTest(args) {
  const script = programOf(args[0]);
  if (script === "phpunit" || script === "pest") return ranAs(script);
  return script === "artisan" && args[1] === "test" ? ranAs(UNKNOWN_FRAMEWORK) : null;
}

function bunTest(args) {
  return positionalWordsOf(args)[0] === "test" ? ranAs("bun") : packageScriptTest(args);
}

const FRAMEWORK_PROGRAMS = {
  jest: always("jest"),
  vitest: always("vitest"),
  mocha: always("mocha"),
  ava: always("ava"),
  pytest: always("pytest"),
  "py.test": always("pytest"),
  rspec: always("rspec"),
  phpunit: always("phpunit"),
  pest: always("pest"),
  playwright: whenFirst("playwright", ["test"]),
  cypress: whenFirst("cypress", ["run"]),
};

// A package manager also runs a binary by name, as in "pnpm vitest" or "yarn jest".
function packageManagerTest(args) {
  const byScript = packageScriptTest(args);
  if (byScript) return byScript;
  const [binary] = positionalWordsOf(args);
  const runner = FRAMEWORK_PROGRAMS[programOf(binary)];
  return runner ? runner(args.slice(args.indexOf(binary) + 1)) : null;
}

const TEST_RUNNERS = {
  ...FRAMEWORK_PROGRAMS,
  node: (args) => (args.includes("--test") ? ranAs("node:test") : null),
  bun: bunTest,
  deno: whenFirst("deno", ["test"]),
  npm: packageScriptTest,
  pnpm: packageManagerTest,
  yarn: packageManagerTest,
  nx: whenAny(UNKNOWN_FRAMEWORK, isNxTestTarget),
  turbo: whenAny(UNKNOWN_FRAMEWORK, (word) => word === "test"),
  python: pythonModuleTest,
  python3: pythonModuleTest,
  py: pythonModuleTest,
  tox: always(UNKNOWN_FRAMEWORK),
  nox: always(UNKNOWN_FRAMEWORK),
  go: whenFirst("go", ["test"]),
  cargo: whenFirst("cargo", ["test", "nextest"]),
  dotnet: whenFirst("dotnet", ["test"]),
  mvn: whenAny("maven", (word) => MAVEN_TEST_GOALS.has(word)),
  mvnw: whenAny("maven", (word) => MAVEN_TEST_GOALS.has(word)),
  gradle: whenAny("gradle", isGradleTestTask),
  gradlew: whenAny("gradle", isGradleTestTask),
  rails: whenFirst("minitest", ["test"]),
  rake: (args) => (args.some(isRakeTest) ? ranAs("minitest") : args.includes("spec") ? ranAs("rspec") : null),
  php: phpTest,
  mix: whenFirst("mix", ["test"]),
  flutter: whenFirst("flutter", ["test"]),
  dart: whenFirst("dart", ["test"]),
  swift: whenFirst("swift", ["test"]),
  xcodebuild: whenAny("xcodebuild", (word) => word === "test"),
};

export const shownCommandOf = (segment) => lineOf(redactSecrets(segment.shown), COMMAND_LIMIT);

// The first command of the chain that runs tests: { framework, command } or null. The framework is null when only the
// output can tell it, as with "npm test".
export function testCommandOf(command) {
  for (const segment of commandSegmentsOf(command)) {
    const [program, ...args] = segment.words;
    const runner = Object.hasOwn(TEST_RUNNERS, programOf(program)) ? TEST_RUNNERS[programOf(program)] : null;
    const recognized = runner?.(args);
    if (recognized) return { framework: recognized.framework, command: shownCommandOf(segment) };
  }
  return null;
}
