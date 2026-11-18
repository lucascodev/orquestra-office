import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { summarizeTool } from "../src/shared/claude/summarize-tool.js";

describe("edit diffs", () => {
  it("marks every removed and added line, not only the first one", () => {
    const { detail } = summarizeTool("Edit", { file_path: "a.js", old_string: "one\ntwo", new_string: "uno\ndos\ntres" });
    assert.equal(detail, "- one\n- two\n+ uno\n+ dos\n+ tres");
  });

  it("shows each change of a MultiEdit", () => {
    const edits = [{ old_string: "a", new_string: "b" }, { old_string: "c", new_string: "d" }];
    const { detail } = summarizeTool("MultiEdit", { file_path: "a.js", edits });
    assert.equal(detail, "- a\n+ b\n- c\n+ d");
  });
});
