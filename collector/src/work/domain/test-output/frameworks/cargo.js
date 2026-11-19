import { countOf, sumOf, unknownCounts } from "../count.js";
import { locationOf } from "../failure-fields.js";
import { TEST_FRAMEWORK } from "../test-framework.js";

const RESULT_LINE = /^test result: (?:ok|FAILED)\. (\d+) passed; (\d+) failed; (\d+) ignored; \d+ measured; \d+ filtered out/;
const FAILURE_HEADER = /^---- (.+) stdout ----$/;
const PANIC_MARKER = " panicked at ";
const FILE_LINE_COLUMN = /^(.+):(\d+):\d+$/;
const LEGACY_MESSAGE_QUOTE = "'";
const LEGACY_PANIC_SEPARATOR = "', ";
const LEGACY_MESSAGE_MAX_LINES = 20;

function placeOf(text) {
  const place = FILE_LINE_COLUMN.exec(text);
  return place ? locationOf(place[1], place[2]) : null;
}

// Rust 1.73+ writes "panicked at file:line:col:" with the message on the next line.
function currentPanicOf(rest, lines, index) {
  return { location: placeOf(rest.slice(0, -1)), message: lines[index + 1]?.trim() || null };
}

// Older Rust writes "panicked at 'message', file:line:col", and a multi-line message closes on a later line.
function legacyPanicOf(rest, lines, index) {
  const lastLine = Math.min(lines.length, index + LEGACY_MESSAGE_MAX_LINES);
  for (let closing = index; closing < lastLine; closing += 1) {
    const text = closing === index ? rest : lines[closing];
    const separator = text.lastIndexOf(LEGACY_PANIC_SEPARATOR);
    if (separator < 0) continue;
    const firstMessageLine = closing === index ? rest.slice(1, separator) : rest.slice(1);
    return { location: placeOf(text.slice(separator + LEGACY_PANIC_SEPARATOR.length)), message: firstMessageLine };
  }
  return { location: null, message: rest.slice(1) };
}

function panicOf(lines, index) {
  const line = lines[index];
  const marker = line.indexOf(PANIC_MARKER);
  if (marker < 0) return null;
  const rest = line.slice(marker + PANIC_MARKER.length);
  if (rest.endsWith(":")) return currentPanicOf(rest, lines, index);
  return rest.startsWith(LEGACY_MESSAGE_QUOTE) ? legacyPanicOf(rest, lines, index) : null;
}

function failuresOf(lines) {
  const failures = [];
  let current = null;
  lines.forEach((line, index) => {
    const header = FAILURE_HEADER.exec(line);
    if (header) {
      current = { name: header[1], location: null, message: null };
      failures.push(current);
      return;
    }
    if (!current || current.location || current.message) return;
    const panic = panicOf(lines, index);
    if (panic) Object.assign(current, panic);
  });
  return failures;
}

function parse(lines, { isComplete }) {
  const results = lines.map((line) => RESULT_LINE.exec(line)).filter(Boolean);
  if (results.length === 0) return null;
  const failures = failuresOf(lines);
  if (!isComplete) return unknownCounts(failures);
  const total = (group) => sumOf(results.map((result) => countOf(result[group])));
  return { passed: total(1), failed: total(2), skipped: total(3), failures };
}

export const cargoParser = Object.freeze({ framework: TEST_FRAMEWORK.CARGO, parse });
