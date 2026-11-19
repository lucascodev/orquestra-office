import { countOf, textOf } from "../shared/field-values.js";

const FILE_ACTIONS = new Set(["read", "created", "edited"]);

// A test file the agent touched, with how it did in the last round: failing with its count, passing, or unknown when the
// round named no file or never ran.
export function testFileState(file) {
  const failed = countOf(file?.failed);
  const result = failed === null ? "unknown" : failed > 0 ? "failing" : "passing";
  return {
    path: textOf(file?.path) ?? "",
    action: FILE_ACTIONS.has(file?.action) ? file.action : null,
    result,
    failed: result === "failing" ? failed : null,
  };
}
