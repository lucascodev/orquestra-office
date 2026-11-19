import { OFFICE_URL_OPTION } from "./office-url.mjs";

export const CHAIN_SCRIPT_FILE = "office-codex-notify.mjs";
const NODE_PROGRAM = "node";
const OFFICE_URL_FLAG = `--${OFFICE_URL_OPTION}`;
const THEN_FLAG = "--then";
const CHAIN_SCRIPT_PATH = /(^|[\\/])office-codex-notify\.mjs$/;
const PREVIOUS_START = 5;

// Codex runs a single notify command, so when one is already there the office runs a script that reports the turn and then
// hands the same turn to that command. Codex appends the turn as the last argument, after the previous command's own.
export const chainedNotifyCommand = ({ officeUrl, chainScript }, previous) => [NODE_PROGRAM, chainScript, OFFICE_URL_FLAG, officeUrl, THEN_FLAG, ...previous];

export const isChainedNotifyCommand = (command) =>
  command.length > PREVIOUS_START &&
  command[0] === NODE_PROGRAM &&
  CHAIN_SCRIPT_PATH.test(String(command[1])) &&
  command[2] === OFFICE_URL_FLAG &&
  command[4] === THEN_FLAG;

export const previousNotifyOf = (command) => (isChainedNotifyCommand(command) ? command.slice(PREVIOUS_START) : []);

// What the script receives after its own path: the office options, then --then, the previous command and the turn.
export function chainedArgumentsOf(args) {
  const thenIndex = args.indexOf(THEN_FLAG);
  if (thenIndex === -1) return { officeArgs: args.slice(0, -1), previous: [], turn: args.at(-1) };
  return { officeArgs: args.slice(0, thenIndex), previous: args.slice(thenIndex + 1, -1), turn: args.at(-1) };
}
