import { countOf, remainderOf, sumOf } from "../count.js";
import { TEST_FRAMEWORK } from "../test-framework.js";

const SUMMARY = /^(\d+) examples?, (\d+) failures?(?:, (\d+) pending)?(?:, (\d+) errors? occurred outside of examples)?$/;
const FAILED_EXAMPLE = /^rspec (\S+) # (.+)$/;
const ENTRY_HEADER = /^ {2}\d+\) (.+)$/;
const FAILURE_ERROR = "Failure/Error:";
const BACKTRACE_LINE = "#";
const CURRENT_DIR = "./";

function countsOf(lines) {
  const summaries = lines.map((line) => SUMMARY.exec(line)).filter(Boolean);
  if (summaries.length === 0) return null;
  const total = (group) => sumOf(summaries.map((summary) => countOf(summary[group] ?? "0")));
  const failed = sumOf([total(2), total(4)]);
  const skipped = total(3);
  return { passed: remainderOf(total(1), [total(2), skipped]), failed, skipped };
}

// After "Failure/Error:" comes the code that failed; the first line below it is the error. "KeyError:" puts its text on the next line.
function messageOf(entryLines) {
  const errorLine = entryLines.findIndex((line) => line.trim().startsWith(FAILURE_ERROR));
  const details = entryLines.slice(errorLine + 1).map((line) => line.trim()).filter((line) => line && !line.startsWith(BACKTRACE_LINE));
  const [first, second] = details;
  if (!first) return null;
  return first.endsWith(":") && second ? `${first} ${second}` : first;
}

function messagesByNameOf(lines) {
  const messages = new Map();
  let name = null;
  let entryLines = [];
  const flush = () => {
    if (name) messages.set(name, messageOf(entryLines));
  };
  for (const line of lines) {
    const header = ENTRY_HEADER.exec(line);
    if (!header) {
      entryLines.push(line);
      continue;
    }
    flush();
    name = header[1];
    entryLines = [];
  }
  flush();
  return messages;
}

const withoutCurrentDir = (path) => (path.startsWith(CURRENT_DIR) ? path.slice(CURRENT_DIR.length) : path);

function failuresOf(lines) {
  const messages = messagesByNameOf(lines);
  return lines
    .map((line) => FAILED_EXAMPLE.exec(line))
    .filter(Boolean)
    .map(([, location, name]) => ({ name, location: withoutCurrentDir(location), message: messages.get(name) ?? null }));
}

function parse(lines) {
  const counts = countsOf(lines);
  return counts && { ...counts, failures: failuresOf(lines) };
}

export const rspecParser = Object.freeze({ framework: TEST_FRAMEWORK.RSPEC, parse });
