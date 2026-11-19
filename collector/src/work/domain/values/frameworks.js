import { COMMAND_FRAMEWORK } from "../commands/command-framework.js";
import { TEST_FRAMEWORK } from "../test-output/test-framework.js";

// The names the output parser and the command reader may give, and nothing else: the page keeps a phrase for each one,
// and any other value reaches it as null.
export const FRAMEWORK_IDS = Object.freeze([...Object.values(TEST_FRAMEWORK), ...Object.values(COMMAND_FRAMEWORK)]);

const FRAMEWORKS = new Set(FRAMEWORK_IDS);

export function frameworkOf(value) {
  return FRAMEWORKS.has(value) ? value : null;
}
