import { textBlockOf } from "../values/safe-text.js";

const SCAN_LIMIT = 4 * 1024;
const VALUE_FLAGS = new Set(["--prefix", "-w", "--workspace", "-C", "--dir", "--cwd", "--filter", "-F"]);
const SEGMENT_BREAKS = new Set([";", "|", "\n", "\r"]);
const SPACES = new Set([" ", "\t"]);
const QUOTES = new Set(["'", "\""]);
const DIRECTORY_CHANGES = new Set(["cd", "pushd", "popd", "chdir", "set-location", "sl", "export"]);
const POWERSHELL_VARIABLE = "$env:";
const SINGLE_WRAPPERS = new Set(["npx", "bunx", "pnpx", "cross-env", "env", "time", "nohup", "sudo", "command"]);
const PAIR_WRAPPERS = new Set([
  "pnpm exec", "pnpm dlx", "yarn dlx", "yarn exec", "npm exec",
  "uv run", "poetry run", "pipenv run", "pdm run", "hatch run", "rye run", "bundle exec",
]);
const EXECUTABLE_EXTENSIONS = new Set(["exe", "cmd", "bat", "ps1", "sh"]);

// Split by hand, one pass over at most 4 KB, so no pattern can backtrack over a huge command.
function wordGroupsOf(command) {
  const text = textBlockOf(command, SCAN_LIMIT);
  const groups = [];
  let words = [];
  let word = "";
  let quote = null;
  const endWord = () => {
    if (word) words.push(word);
    word = "";
  };
  const endGroup = () => {
    endWord();
    if (words.length) groups.push(words);
    words = [];
  };
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (char === quote) quote = null;
      else word += char;
    } else if (QUOTES.has(char)) quote = char;
    else if (SEGMENT_BREAKS.has(char)) endGroup();
    else if (char === "&" && text[index + 1] === "&") {
      endGroup();
      index += 1;
    } else if (SPACES.has(char)) endWord();
    else if (char !== "(" && char !== ")") word += char;
  }
  endGroup();
  return groups;
}

function isIdentifierChar(char, isFirst) {
  const isLetter = (char >= "a" && char <= "z") || (char >= "A" && char <= "Z") || char === "_";
  return isLetter || (!isFirst && char >= "0" && char <= "9");
}

export function isEnvAssignment(word) {
  const equals = word.indexOf("=");
  if (equals <= 0) return false;
  for (let index = 0; index < equals; index += 1) {
    if (!isIdentifierChar(word[index], index === 0)) return false;
  }
  return true;
}

export function programOf(word) {
  const name = String(word ?? "").split(/[\\/]/).at(-1).toLowerCase();
  const dot = name.lastIndexOf(".");
  return dot > 0 && EXECUTABLE_EXTENSIONS.has(name.slice(dot + 1)) ? name.slice(0, dot) : name;
}

const isFlag = (word) => word.startsWith("-");

export function positionalWordsOf(args) {
  const positional = [];
  for (let index = 0; index < args.length; index += 1) {
    const word = args[index];
    if (!isFlag(word)) positional.push(word);
    else if (VALUE_FLAGS.has(word)) index += 1;
  }
  return positional;
}

// How many leading words are wrappers or variables before the program that does the work.
function prefixLengthOf(words) {
  let index = 0;
  for (;;) {
    while (index < words.length && isEnvAssignment(words[index])) index += 1;
    const first = programOf(words[index]);
    const pair = `${first} ${programOf(words[index + 1])}`;
    let skipped = 0;
    if (PAIR_WRAPPERS.has(pair)) skipped = 2;
    else if (SINGLE_WRAPPERS.has(first)) skipped = 1;
    if (skipped === 0) return index;
    index += skipped;
    while (index < words.length && (isFlag(words[index]) || isEnvAssignment(words[index]))) index += 1;
  }
}

const isNotCommand = (words) => DIRECTORY_CHANGES.has(programOf(words[0])) || words[0].toLowerCase().startsWith(POWERSHELL_VARIABLE);

/**
 * Each command in a chain, as `words` (from the program that does the work on) and `shown` (what the agent typed,
 * without the variables set before the program, which may hold credentials).
 */
export function commandSegmentsOf(command) {
  return wordGroupsOf(command)
    .filter((words) => !isNotCommand(words))
    .map((words) => {
      const prefixLength = prefixLengthOf(words);
      const prefix = words.slice(0, prefixLength).filter((word) => !isEnvAssignment(word));
      return { words: words.slice(prefixLength), shown: [...prefix, ...words.slice(prefixLength)].join(" ") };
    })
    .filter((segment) => segment.words.length > 0);
}
