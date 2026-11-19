import { commandSegmentsOf, positionalWordsOf, programOf } from "./command-segments.js";
import { shownCommandOf } from "./test-command.js";

const SCRIPT_RUNNERS = new Set(["npm", "pnpm", "yarn", "bun"]);
const RUN_WORDS = new Set(["run", "run-script"]);
const MAKE_PROGRAMS = new Set(["make", "gmake"]);

function isScriptRun([program, ...args]) {
  const name = programOf(program);
  if (MAKE_PROGRAMS.has(name)) return true;
  if (!SCRIPT_RUNNERS.has(name)) return false;
  const [first, script] = positionalWordsOf(args);
  return RUN_WORDS.has(first) && Boolean(script);
}

// A script such as "npm run check" may run the tests among other things; only these and the test commands have their
// output read, so the output of an arbitrary program never reaches the parser.
export function scriptCommandOf(command) {
  const segment = commandSegmentsOf(command).find((candidate) => isScriptRun(candidate.words));
  return segment ? shownCommandOf(segment) : null;
}
