import { test } from "node:test";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
import { TOOL_SUMMARY } from "../../collector/src/shared/claude/tool-summary-ids.js";
import { ENTRY_TEXT } from "../../collector/src/shared/terminal/entry-text-ids.js";
import { changesOf } from "../src/claude/stream-changes.js";
import { SESSION_ENTRY } from "../src/sessions/session-entry-ids.js";
import { createSession } from "../src/sessions/session.js";
import { fakeClaudeLauncher } from "./support/fake-claude-process.js";

const NOW = Date.parse("2026-11-18T12:00:00Z");

const entriesOf = (event) => changesOf(event).filter((change) => change.type === "entry").map((change) => change.entry);

function endedSession(outcome) {
  const claude = fakeClaudeLauncher();
  const session = createSession({ cwd: tmpdir(), startProcess: claude.startProcess, now: () => NOW });
  claude.processes[0].exit(outcome);
  return session.transcript().entries.at(-1);
}

test("a tool in the terminal carries its name, summary and subject apart", () => {
  const [entry] = entriesOf({ type: "assistant", message: { content: [{ type: "tool_use", name: "Write", input: { file_path: "/repo/a.ts", content: "x" } }] } });
  assert.deepEqual([entry.kind, entry.toolName, entry.summaryId, entry.subject, entry.detail], ["tool", "Write", TOOL_SUMMARY.WRITE_FILE, "/repo/a.ts", "x"]);
});

test("a tool with nothing to summarize still carries its name", () => {
  const [entry] = entriesOf({ type: "assistant", message: { content: [{ type: "tool_use", name: "Grep", input: { pattern: "x" } }] } });
  assert.deepEqual([entry.toolName, entry.summaryId, entry.subject], ["Grep", null, null]);
});

test("an interrupted turn is named as such", () => {
  const [entry] = entriesOf({ type: "result", is_error: true, terminal_reason: "aborted_streaming" });
  assert.deepEqual([entry.kind, entry.textId], ["note", ENTRY_TEXT.TURN_INTERRUPTED]);
});

test("a turn that ends with an error is named as such and keeps the error", () => {
  const [entry] = entriesOf({ type: "result", is_error: true, subtype: "error_max_turns", result: "too many turns" });
  assert.deepEqual([entry.kind, entry.textId, entry.detail], ["error", ENTRY_TEXT.TURN_FAILED, "too many turns"]);
});

test("a session that crashes is named as such and keeps the error", () => {
  const entry = endedSession({ code: null, error: "spawn claude ENOENT" });
  assert.deepEqual([entry.kind, entry.textId, entry.detail], ["error", SESSION_ENTRY.SESSION_CRASHED, "spawn claude ENOENT"]);
});

test("a session that ends cleanly is named with no exit code", () => {
  const entry = endedSession({ code: 0, error: "" });
  assert.deepEqual([entry.kind, entry.textId, entry.subject], ["note", SESSION_ENTRY.SESSION_ENDED, null]);
});

test("a session that ends with another code carries the code as the subject", () => {
  assert.equal(endedSession({ code: 3, error: "" }).subject, "3");
  assert.equal(endedSession({ code: null, error: "" }).subject, "null");
});

test("what the user typed and what Claude replied stay as text, with no text id", () => {
  const [reply] = entriesOf({ type: "assistant", message: { content: [{ type: "text", text: "done" }] } });
  assert.deepEqual([reply.kind, reply.text, reply.textId], ["reply", "done", undefined]);
});

test("no entry the runner makes for a tool, a turn or the end of the session carries a ready-made phrase", () => {
  const made = [
    ...entriesOf({ type: "assistant", message: { content: [{ type: "tool_use", name: "Bash", input: { command: "ls" } }] } }),
    ...entriesOf({ type: "result", is_error: true, terminal_reason: "aborted_streaming" }),
    ...entriesOf({ type: "result", is_error: true, subtype: "error_max_turns" }),
    endedSession({ code: null, error: "boom" }),
    endedSession({ code: 0, error: "" }),
  ];
  assert.deepEqual(made.map((entry) => entry.text), [undefined, undefined, undefined, undefined, undefined]);
});
