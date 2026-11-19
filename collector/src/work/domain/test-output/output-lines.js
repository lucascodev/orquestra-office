import { LINE_LIMIT, OUTPUT_WINDOW_CHARS } from "./limits.js";

const ANSI_CSI = /\x1b\[[0-9;?]*[A-Za-z]/g;
// dotnet's terminal logger also writes OSC progress and hyperlink sequences, which the CSI pattern does not cover.
const ANSI_OSC = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;
const NEWLINE = "\n";
const CARRIAGE_RETURN = "\r";

function withoutPartialLastLine(text) {
  const end = text.lastIndexOf(NEWLINE);
  return end < 0 ? text : text.slice(0, end);
}

function withoutPartialFirstLine(text) {
  return text.slice(text.indexOf(NEWLINE) + 1);
}

function windowOf(output) {
  if (output.length <= OUTPUT_WINDOW_CHARS * 2) return { text: output, isComplete: true };
  const head = withoutPartialLastLine(output.slice(0, OUTPUT_WINDOW_CHARS));
  const tail = withoutPartialFirstLine(output.slice(-OUTPUT_WINDOW_CHARS));
  return { text: `${head}${NEWLINE}${tail}`, isComplete: false };
}

function withoutTrailingCarriageReturns(line) {
  let end = line.length;
  while (end > 0 && line[end - 1] === CARRIAGE_RETURN) end -= 1;
  return line.slice(0, end);
}

// A progress line redraws itself after each carriage return; only the last drawing is what the user saw.
function visibleTextOf(rawLine) {
  const line = withoutTrailingCarriageReturns(rawLine);
  return line.slice(line.lastIndexOf(CARRIAGE_RETURN) + 1);
}

const plainLineOf = (rawLine) => visibleTextOf(rawLine).slice(0, LINE_LIMIT).replace(ANSI_OSC, "").replace(ANSI_CSI, "");

export function readOutputLines(output) {
  const { text, isComplete } = windowOf(output);
  return { lines: text.split(NEWLINE).map(plainLineOf), isComplete };
}
