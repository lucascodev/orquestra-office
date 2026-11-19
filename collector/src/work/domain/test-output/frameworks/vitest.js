import { sumOf, unknownCounts } from "../count.js";
import { countOrZero, countWordsOf } from "../count-words.js";
import { locationOf } from "../failure-fields.js";
import { TEST_FRAMEWORK } from "../test-framework.js";

const SUMMARY = /^ *Tests {2}\d[a-z0-9 |]*\(\d+\)$/;
// When a test file fails to load, vitest cannot count its tests: the run failed, but how many tests did is unknown.
const NO_TESTS_SUMMARY = /^ *Tests {2}no tests$/;
const FAILURE_HEADER = " FAIL  ";
const NAME_SEPARATOR = " > ";
const LOAD_ERROR_SUFFIX_START = " [ ";
const LOAD_ERROR_SUFFIX_END = " ]";
// Frames inside functions read "❯ fn file:line:col"; only the bare "❯ file:line:col" points at the test source.
const SOURCE_LOCATION = /^ +❯ (\S+):(\d+):\d+$/;
const BLOCK_END = "⎯";

function countsOf(lines) {
  const summaries = lines.filter((line) => SUMMARY.test(line)).map(countWordsOf);
  if (summaries.length === 0) return lines.some((line) => NO_TESTS_SUMMARY.test(line)) ? unknownCounts([]) : null;
  const total = (...words) => sumOf(summaries.map((counts) => countOrZero(counts, ...words)));
  return { passed: total("passed"), failed: total("failed"), skipped: total("skipped", "todo") };
}

// A file that failed to load is reported as "file [ file ]", with no test name.
function loadErrorFileOf(title) {
  const suffix = title.indexOf(LOAD_ERROR_SUFFIX_START);
  return suffix > 0 && title.endsWith(LOAD_ERROR_SUFFIX_END) ? title.slice(0, suffix) : title;
}

function nameOf(title) {
  const separator = title.indexOf(NAME_SEPARATOR);
  return separator < 0 ? loadErrorFileOf(title) : title.slice(separator + NAME_SEPARATOR.length);
}

function addDetail(failure, line) {
  const text = line.trim();
  if (!text) return;
  if (!failure.message) {
    failure.message = text;
    return;
  }
  const source = SOURCE_LOCATION.exec(line);
  if (source) failure.location ??= locationOf(source[1], source[2]);
}

function failuresOf(lines) {
  const failures = [];
  let current = null;
  for (const line of lines) {
    if (line.startsWith(FAILURE_HEADER)) {
      current = { name: nameOf(line.slice(FAILURE_HEADER.length).trim()), location: null, message: null };
      failures.push(current);
    } else if (line.trim().startsWith(BLOCK_END)) {
      current = null;
    } else if (current) {
      addDetail(current, line);
    }
  }
  return failures;
}

function parse(lines) {
  const counts = countsOf(lines);
  return counts && { ...counts, failures: failuresOf(lines) };
}

export const vitestParser = Object.freeze({ framework: TEST_FRAMEWORK.VITEST, parse });
