import { TEST_FRAMEWORK } from "../test-output/test-framework.js";
import { cleanLineOf } from "../values/clean-text.js";
import { COMMAND_FRAMEWORK } from "./command-framework.js";
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
const isMavenTestGoal = (word) => MAVEN_TEST_GOALS.has(word);

function rakeTest(args) {
  if (args.some(isRakeTest)) return ranAs(COMMAND_FRAMEWORK.MINITEST);
  return args.includes("spec") ? ranAs(TEST_FRAMEWORK.RSPEC) : null;
}

const PYTHON_TEST_MODULES = { pytest: TEST_FRAMEWORK.PYTEST, unittest: COMMAND_FRAMEWORK.UNITTEST };
const PHP_TEST_SCRIPTS = { phpunit: TEST_FRAMEWORK.PHPUNIT, pest: COMMAND_FRAMEWORK.PEST };

function pythonModuleTest(args) {
  const moduleFlag = args.indexOf("-m");
  const module = moduleFlag >= 0 ? args[moduleFlag + 1] : null;
  return Object.hasOwn(PYTHON_TEST_MODULES, module) ? ranAs(PYTHON_TEST_MODULES[module]) : null;
}

function phpTest(args) {
  const script = programOf(args[0]);
  if (Object.hasOwn(PHP_TEST_SCRIPTS, script)) return ranAs(PHP_TEST_SCRIPTS[script]);
  return script === "artisan" && args[1] === "test" ? ranAs(UNKNOWN_FRAMEWORK) : null;
}

function bunTest(args) {
  return positionalWordsOf(args)[0] === "test" ? ranAs(COMMAND_FRAMEWORK.BUN) : packageScriptTest(args);
}

const FRAMEWORK_PROGRAMS = {
  jest: always(TEST_FRAMEWORK.JEST),
  vitest: always(TEST_FRAMEWORK.VITEST),
  mocha: always(TEST_FRAMEWORK.MOCHA),
  ava: always(COMMAND_FRAMEWORK.AVA),
  pytest: always(TEST_FRAMEWORK.PYTEST),
  "py.test": always(TEST_FRAMEWORK.PYTEST),
  rspec: always(TEST_FRAMEWORK.RSPEC),
  phpunit: always(TEST_FRAMEWORK.PHPUNIT),
  pest: always(COMMAND_FRAMEWORK.PEST),
  playwright: whenFirst(TEST_FRAMEWORK.PLAYWRIGHT, ["test"]),
  cypress: whenFirst(COMMAND_FRAMEWORK.CYPRESS, ["run"]),
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
  node: (args) => (args.includes("--test") ? ranAs(TEST_FRAMEWORK.NODE_TEST) : null),
  bun: bunTest,
  deno: whenFirst(COMMAND_FRAMEWORK.DENO, ["test"]),
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
  go: whenFirst(TEST_FRAMEWORK.GO, ["test"]),
  cargo: whenFirst(TEST_FRAMEWORK.CARGO, ["test", "nextest"]),
  dotnet: whenFirst(TEST_FRAMEWORK.DOTNET, ["test"]),
  mvn: whenAny(TEST_FRAMEWORK.MAVEN, isMavenTestGoal),
  mvnw: whenAny(TEST_FRAMEWORK.MAVEN, isMavenTestGoal),
  gradle: whenAny(TEST_FRAMEWORK.GRADLE, isGradleTestTask),
  gradlew: whenAny(TEST_FRAMEWORK.GRADLE, isGradleTestTask),
  rails: whenFirst(COMMAND_FRAMEWORK.MINITEST, ["test"]),
  rake: rakeTest,
  php: phpTest,
  mix: whenFirst(TEST_FRAMEWORK.MIX, ["test"]),
  flutter: whenFirst(COMMAND_FRAMEWORK.FLUTTER, ["test"]),
  dart: whenFirst(COMMAND_FRAMEWORK.DART, ["test"]),
  swift: whenFirst(COMMAND_FRAMEWORK.SWIFT, ["test"]),
  xcodebuild: whenAny(COMMAND_FRAMEWORK.XCODEBUILD, (word) => word === "test"),
};

export const shownCommandOf = (segment) => cleanLineOf(segment.shown, COMMAND_LIMIT);

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
