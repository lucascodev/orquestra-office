import { sumOf } from "../count.js";
import { countOrZero, countWordsOf } from "../count-words.js";
import { locationOf } from "../failure-fields.js";
import { isSummaryCandidate } from "../summary-line.js";
import { TEST_FRAMEWORK } from "../test-framework.js";

const BANNER_CHARACTERS = "= ";
// A count names one or two words ("3 subtests passed" from pytest-subtests); the next count starts with a digit, so the
// optional word never competes with it and the match stays linear.
const SUMMARY = /^(?:\d+ [a-z]+(?: [a-z]+)?(?:,? \d+ [a-z]+(?: [a-z]+)?)*|no tests ran) in \d+(?:\.\d+)?s(?: \([0-9:]+\))?$/;
const SECTION_HEADER = /^_+ (.+) _+$/;
const SECTION_END = "=";
const ERROR_LINE = /^E\s+(.+)$/;
const SOURCE_LINE = /^(\S+\.py):(\d+): \S/;
const RESULT_LINE = /^(FAILED|ERROR) (.+)$/;
const MESSAGE_SEPARATOR = " - ";
const NODE_SEPARATOR = "::";
const ERROR_SECTION_PREFIXES = ["ERROR collecting ", "ERROR at setup of ", "ERROR at teardown of "];

function withoutBanner(line) {
  let start = 0;
  let end = line.length;
  while (start < end && BANNER_CHARACTERS.includes(line[start])) start += 1;
  while (end > start && BANNER_CHARACTERS.includes(line[end - 1])) end -= 1;
  return line.slice(start, end);
}

function countsOf(lines) {
  const summaries = lines.map(withoutBanner).filter((line) => isSummaryCandidate(line) && SUMMARY.test(line)).map(countWordsOf);
  if (summaries.length === 0) return null;
  const total = (...words) => sumOf(summaries.map((counts) => countOrZero(counts, ...words)));
  return {
    passed: total("passed", "xpassed"),
    failed: total("failed", "error", "errors"),
    skipped: total("skipped", "xfailed"),
  };
}

function sectionKeyOf(header) {
  const prefix = ERROR_SECTION_PREFIXES.find((start) => header.startsWith(start));
  return prefix ? header.slice(prefix.length) : header;
}

// The FAILURES and ERRORS sections hold the "E" line and the file:line where the test broke.
function sectionsOf(lines) {
  const sections = new Map();
  let current = null;
  for (const line of lines) {
    const header = SECTION_HEADER.exec(line);
    if (header) {
      current = { name: sectionKeyOf(header[1]), location: null, message: null };
      if (!sections.has(current.name)) sections.set(current.name, current);
      continue;
    }
    if (!current) continue;
    if (line.startsWith(SECTION_END)) {
      current = null;
      continue;
    }
    current.message ??= ERROR_LINE.exec(line)?.[1].trim() ?? null;
    const source = SOURCE_LINE.exec(line);
    if (source) current.location = locationOf(source[1], source[2]);
  }
  return sections;
}

function resultOf(line) {
  const result = RESULT_LINE.exec(line);
  if (!result) return null;
  const separator = result[2].indexOf(MESSAGE_SEPARATOR);
  const nodeId = separator < 0 ? result[2] : result[2].slice(0, separator);
  const shortMessage = separator < 0 ? null : result[2].slice(separator + MESSAGE_SEPARATOR.length);
  const nodeSeparator = nodeId.indexOf(NODE_SEPARATOR);
  if (nodeSeparator < 0) return { name: nodeId, file: nodeId, sectionKey: nodeId, shortMessage };
  const name = nodeId.slice(nodeSeparator + NODE_SEPARATOR.length);
  return { name, file: nodeId.slice(0, nodeSeparator), sectionKey: name.replaceAll(NODE_SEPARATOR, "."), shortMessage };
}

// The short summary names every failure with its file; the sections add the line and the error.
function failuresOf(lines) {
  const sections = sectionsOf(lines);
  const results = lines.map(resultOf).filter(Boolean);
  if (results.length === 0) return [...sections.values()];
  return results.map(({ name, file, sectionKey, shortMessage }) => {
    const section = sections.get(sectionKey);
    return { name, location: section?.location ?? file, message: section?.message ?? shortMessage };
  });
}

function parse(lines) {
  const counts = countsOf(lines);
  return counts && { ...counts, failures: failuresOf(lines) };
}

export const pytestParser = Object.freeze({ framework: TEST_FRAMEWORK.PYTEST, parse });
