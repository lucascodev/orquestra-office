import { test } from "node:test";
import assert from "node:assert/strict";
import { claudeHistoryEntry } from "../src/claude/claude-history-entry.js";
import { summarizeTool } from "../src/shared/claude/summarize-tool.js";
import { TOOL_SUMMARY } from "../src/shared/claude/tool-summary-ids.js";
import { ENTRY_TEXT } from "../src/shared/terminal/entry-text-ids.js";

const SUMMARY_LIMIT = 160;
const TOOL_NAME_LIMIT = 60;
const SESSION = { session_id: "s1", cwd: "/repo" };

const summaryOf = (toolName, toolInput) => {
  const { summaryId, subject } = summarizeTool(toolName, toolInput);
  return { summaryId, subject };
};

const summarized = [
  ["a command with a description", "Bash", { command: "npm test", description: "Rodar os testes" }, TOOL_SUMMARY.RUN_COMMAND, "Rodar os testes"],
  ["a command without a description", "PowerShell", { command: "ls" }, TOOL_SUMMARY.RUN_COMMAND, null],
  ["a written file", "Write", { file_path: "C:\\Users\\dev\\meu projeto\\main.ts", content: "x" }, TOOL_SUMMARY.WRITE_FILE, "C:\\Users\\dev\\meu projeto\\main.ts"],
  ["a written notebook", "NotebookEdit", { notebook_path: "/repo/a.ipynb", new_source: "x" }, TOOL_SUMMARY.WRITE_FILE, "/repo/a.ipynb"],
  ["a write with no path", "Write", { content: "x" }, TOOL_SUMMARY.WRITE_FILE, ""],
  ["an edited file", "Edit", { file_path: "/repo/a.js", old_string: "a", new_string: "b" }, TOOL_SUMMARY.EDIT_FILE, "/repo/a.js"],
  ["a multi-edit", "MultiEdit", { file_path: "/repo/b.js", edits: [] }, TOOL_SUMMARY.EDIT_FILE, "/repo/b.js"],
  ["a read file", "Read", { file_path: "/repo/README.md" }, TOOL_SUMMARY.READ_FILE, "/repo/README.md"],
  ["an opened page", "WebFetch", { url: "https://x" }, TOOL_SUMMARY.OPEN_PAGE, null],
  ["a web search", "WebSearch", { query: "q" }, TOOL_SUMMARY.SEARCH_WEB, null],
  ["a delegation", "Agent", { subagent_type: "code-reviewer", prompt: "p" }, TOOL_SUMMARY.DELEGATE, "code-reviewer"],
  ["a delegation to nobody named", "Task", { prompt: "p" }, TOOL_SUMMARY.DELEGATE, null],
  ["a tool with nothing to summarize", "Grep", { pattern: "x" }, null, null],
];

for (const [what, toolName, toolInput, summaryId, subject] of summarized) {
  test(`the summary of ${what} is ${summaryId ?? "none"}${subject ? ` about ${subject}` : ""}`, () => {
    assert.deepEqual(summaryOf(toolName, toolInput), { summaryId, subject });
  });
}

test("a long description or path is cut before it becomes the subject", () => {
  const long = "d".repeat(SUMMARY_LIMIT * 2);
  assert.equal(summarizeTool("Bash", { command: "x", description: long }).subject, `${long.slice(0, SUMMARY_LIMIT)}…`);
  assert.equal(summarizeTool("Write", { file_path: long }).subject, `${long.slice(0, SUMMARY_LIMIT)}…`);
});

const entryOf = (hook, extra = {}) => claudeHistoryEntry({ ...SESSION, hook_event_name: hook, ...extra }, 1)?.entry;

test("a tool in the history carries its name, summary and subject apart", () => {
  const entry = entryOf("PreToolUse", { tool_name: "Bash", tool_input: { command: "npm test", description: "Rodar os testes" } });
  assert.deepEqual(
    { kind: entry.kind, toolName: entry.toolName, summaryId: entry.summaryId, subject: entry.subject, detail: entry.detail },
    { kind: "tool", toolName: "Bash", summaryId: TOOL_SUMMARY.RUN_COMMAND, subject: "Rodar os testes", detail: "npm test" },
  );
});

test("a tool with nothing to summarize still carries its name", () => {
  const entry = entryOf("PreToolUse", { tool_name: "Grep", tool_input: { pattern: "x" } });
  assert.deepEqual([entry.toolName, entry.summaryId, entry.subject], ["Grep", null, null]);
});

test("a failed tool in the history names the failure and the tool", () => {
  const entry = entryOf("PostToolUseFailure", { tool_name: "Bash", error: "exit 1" });
  assert.deepEqual([entry.kind, entry.textId, entry.subject, entry.detail], ["error", ENTRY_TEXT.TOOL_FAILED, "Bash", "exit 1"]);
});

test("a failure of an unnamed tool names no tool, and a long name is cut", () => {
  assert.equal(entryOf("PostToolUseFailure", { error: "x" }).subject, null);
  const long = "T".repeat(TOOL_NAME_LIMIT * 2);
  assert.equal(entryOf("PostToolUseFailure", { tool_name: long }).subject, `${long.slice(0, TOOL_NAME_LIMIT)}…`);
});

test("an API error in the history is named as such", () => {
  const entry = entryOf("StopFailure", { error: "overloaded" });
  assert.deepEqual([entry.kind, entry.textId, entry.detail], ["error", ENTRY_TEXT.API_ERROR, "overloaded"]);
});

test("a finished background task in the history is named as such and keeps nothing of the notice", () => {
  const entry = entryOf("UserPromptSubmit", { prompt: "<task-notification>secret output</task-notification>" });
  assert.deepEqual([entry.kind, entry.textId], ["note", ENTRY_TEXT.BACKGROUND_TASK_FINISHED]);
  assert.ok(!JSON.stringify(entry).includes("secret output"));
});

test("what the user typed and what the agent replied stay as text, with no text id", () => {
  assert.equal(entryOf("UserPromptSubmit", { prompt: "fix it" }).textId, undefined);
  assert.equal(entryOf("Stop", { last_assistant_message: "done" }).textId, undefined);
});
