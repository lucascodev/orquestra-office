import assert from "node:assert/strict";
import { test } from "node:test";
import { envValue } from "../lib/env-value.mjs";

test("returns the variable when it has content", () => {
  assert.equal(envValue({ CODEX_HOME: "/tmp/codex" }, "CODEX_HOME"), "/tmp/codex");
});

test("an unset, empty or blank variable counts as absent", () => {
  assert.equal(envValue({}, "CODEX_HOME"), undefined);
  assert.equal(envValue({ CODEX_HOME: "" }, "CODEX_HOME"), undefined);
  assert.equal(envValue({ CODEX_HOME: " \t" }, "CODEX_HOME"), undefined);
});
