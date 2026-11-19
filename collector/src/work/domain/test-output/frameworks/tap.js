import { countOf, sumOf } from "../count.js";
import { locationOf } from "../failure-fields.js";
import { stackFrameLocationOf } from "../stack-frame.js";
import { TEST_FRAMEWORK } from "../test-framework.js";

const PLAN = /^\d+\.\.\d+/;
const TEST_LINE = /^(\s*)(not ok|ok) \d+(?: -)?(?: (.*))?$/;
const DIRECTIVE = / # (skip|todo)\b/i;
const TODO = "todo";
const SUMMARY_COMMENT = /^# (pass|fail|cancelled|skipped|skip|todo) +(\d+)$/;
const YAML_END = "...";
const YAML_FIELD = /^\s+(location|at|error|failureType): ?(.*)$/;
const SUITE_FAILURE = "'subtestsFailed'";
const BLOCK_SCALARS = new Set(["|", "|-", ">", ">-"]);
const FILE_LINE_COLUMN = /^(.+):(\d+):\d+$/;
const BATS_LOCATION = /^# \(in test file (.+), line (\d+)\)$/;
const BATS_DETAIL = /^#\s+(.+)$/;

function testLineOf(line) {
  const match = TEST_LINE.exec(line);
  if (!match) return null;
  const description = match[3] ?? "";
  const directive = DIRECTIVE.exec(description);
  return {
    isTopLevel: match[1] === "",
    isOk: match[2] === "ok",
    name: (directive ? description.slice(0, directive.index) : description).trim(),
    directive: directive?.[1].toLowerCase() ?? null,
  };
}

function summaryCommentsOf(lines) {
  const comments = {};
  for (const line of lines) {
    const match = SUMMARY_COMMENT.exec(line);
    if (match) (comments[match[1]] ??= []).push(countOf(match[2]));
  }
  return comments;
}

function countsOf(tests, comments) {
  const topLevel = tests.filter(({ isTopLevel }) => isTopLevel);
  const countedSkips = topLevel.filter(({ directive }) => directive).length;
  const hasSkipComments = ["skipped", "skip", "todo"].some((key) => key in comments);
  const skipped = hasSkipComments ? sumOf([...(comments.skipped ?? []), ...(comments.skip ?? []), ...(comments.todo ?? [])]) : countedSkips;
  if (comments.pass && comments.fail) {
    return { passed: sumOf(comments.pass), failed: sumOf([...comments.fail, ...(comments.cancelled ?? [])]), skipped };
  }
  return {
    passed: topLevel.filter(({ isOk, directive }) => isOk && !directive).length,
    failed: topLevel.filter(({ isOk, directive }) => !isOk && directive !== TODO).length,
    skipped: countedSkips,
  };
}

function unquoted(value) {
  const isQuoted = value.length > 1 && (value[0] === "'" || value[0] === '"') && value.at(-1) === value[0];
  return isQuoted ? value.slice(1, -1).replaceAll("''", "'") : value;
}

function yamlLocationOf(value) {
  const match = FILE_LINE_COLUMN.exec(unquoted(value).replaceAll("\\\\", "\\"));
  return match ? locationOf(match[1], match[2]) : null;
}

const blockScalarTextOf = (lines, index) => lines[index + 1]?.trim() || null;

function readBatsComment(failure, line) {
  const batsLocation = BATS_LOCATION.exec(line);
  if (batsLocation) {
    failure.location ??= locationOf(batsLocation[1], batsLocation[2]);
    return;
  }
  const detail = failure.location && !failure.message ? BATS_DETAIL.exec(line) : null;
  if (detail) failure.message = detail[1].trim();
}

function readYamlField(failure, lines, index) {
  const field = YAML_FIELD.exec(lines[index]);
  if (!field) return;
  const [, key, value] = field;
  if (key === "failureType") failure.isSuite = value === SUITE_FAILURE;
  if (key === "location") failure.location ??= yamlLocationOf(value);
  if (key === "at") failure.location ??= stackFrameLocationOf(`at ${value}`);
  if (key === "error") failure.message ??= BLOCK_SCALARS.has(value) ? blockScalarTextOf(lines, index) : unquoted(value);
}

const endsDetails = (line) => TEST_LINE.test(line) || line.trim() === YAML_END;

// The details of a failure sit in the YAML block (node:test, tape) or in comments (bats) below its line.
function detailsOf(lines, start) {
  const failure = { location: null, message: null, isSuite: false };
  for (let index = start; index < lines.length && !endsDetails(lines[index]); index += 1) {
    readBatsComment(failure, lines[index]);
    readYamlField(failure, lines, index);
  }
  return failure;
}

function failuresOf(lines) {
  return lines.flatMap((line, index) => {
    const test = testLineOf(line);
    if (!test || test.isOk || test.directive === TODO) return [];
    const { location, message, isSuite } = detailsOf(lines, index + 1);
    return isSuite ? [] : [{ name: test.name, location, message }];
  });
}

function parse(lines) {
  if (!lines.some((line) => PLAN.test(line))) return null;
  const tests = lines.map(testLineOf).filter(Boolean);
  if (tests.length === 0) return null;
  return { ...countsOf(tests, summaryCommentsOf(lines)), failures: failuresOf(lines) };
}

export const tapParser = Object.freeze({ framework: TEST_FRAMEWORK.TAP, parse });
