import assert from "node:assert/strict";
import { test } from "node:test";
import { settingsShapeProblem } from "../lib/claude-settings-shape.mjs";

test("accepts an object with hooks as an object of arrays, or no hooks at all", () => {
  assert.equal(settingsShapeProblem({}), null);
  assert.equal(settingsShapeProblem({ model: "opus", hooks: { Stop: [], PreToolUse: [{ hooks: [] }] } }), null);
});

test("refuses settings that are not a plain object", () => {
  for (const settings of [null, "abc", 42, true, [1, 2]]) assert.match(settingsShapeProblem(settings), /settings is not an object/);
});

test("refuses hooks that are not a plain object", () => {
  for (const hooks of [null, "x", [1]]) assert.match(settingsShapeProblem({ hooks }), /"hooks" is not an object/);
});

test("refuses an event whose value is not an array", () => {
  assert.match(settingsShapeProblem({ hooks: { Stop: [], PreToolUse: null } }), /"hooks\.PreToolUse" is not an array/);
});
