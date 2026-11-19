import { projectPathOf } from "../../../shared/path/project-path.js";
import { cleanLineOf } from "../values/clean-text.js";
import { countOf } from "../values/count.js";
import { frameworkOf } from "../values/frameworks.js";

const FAILURE_LIMIT = 10;
const FAILURE_FIELD_LIMIT = 300;
const LOCATION_SCAN_LIMIT = 2 * FAILURE_FIELD_LIMIT;
const LINE_AND_COLUMN_PARTS = 2;

const isDigits = (text) => text.length > 0 && [...text].every((char) => char >= "0" && char <= "9");

// "path:12:20" keeps its line and column while the path becomes relative to the project.
function projectLocationOf(location, root) {
  if (typeof location !== "string") return "";
  const parts = location.slice(0, LOCATION_SCAN_LIMIT).split(":");
  let lineParts = 0;
  while (lineParts < LINE_AND_COLUMN_PARTS && parts.length - lineParts > 1 && isDigits(parts[parts.length - 1 - lineParts])) lineParts += 1;
  const path = parts.slice(0, parts.length - lineParts).join(":");
  return [projectPathOf(path, root), ...parts.slice(parts.length - lineParts)].join(":");
}

const fieldOf = (value) => cleanLineOf(value, FAILURE_FIELD_LIMIT) || null;

function failuresOf(failures, root) {
  if (!Array.isArray(failures)) return [];
  return failures
    .filter((failure) => failure !== null && typeof failure === "object")
    .slice(0, FAILURE_LIMIT)
    .map((failure) => ({ name: fieldOf(failure.name), location: fieldOf(projectLocationOf(failure.location, root)), message: fieldOf(failure.message) }));
}

/**
 * What a finished shell call says about the tests: null when it was not a test and its output had no summary. Counts
 * the summary does not give stay null; without a failed count, the call's own result decides.
 */
export function testResultOf({ test, script = null, summary, isCallOk, root }) {
  if (!test && !summary) return null;
  const failed = countOf(summary?.failed);
  return {
    command: test?.command ?? script ?? null,
    framework: frameworkOf(summary?.framework) ?? frameworkOf(test?.framework),
    isOk: failed === null ? Boolean(isCallOk) : failed === 0,
    passed: countOf(summary?.passed),
    failed,
    skipped: countOf(summary?.skipped),
    failures: failuresOf(summary?.failures, root),
  };
}
