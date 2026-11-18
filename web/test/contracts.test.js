import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { claudeHistoryEntry } from "../../collector/src/claude/claude-history-entry.js";
import { describeActivity } from "../../collector/src/claude/describe-activity.js";
import { canReceiveMessages as collectorCanReceiveMessages } from "../../collector/src/office/domain/can-receive-messages.js";
import { TEMPLATE_IDS } from "../../collector/src/office/domain/templates.js";
import { THEMES } from "../scripts/art/themes.js";
import { busyReactionOf } from "../scripts/view/agent-reactions.js";
import { canReceiveMessages as webCanReceiveMessages } from "../scripts/view/agent-rules.js";
import { thoughtAt } from "../scripts/view/agent-thoughts.js";
import { describeToolEntry, diffLines } from "../scripts/view/terminal-format.js";

const THEME_COUNT = 7;
const AGENT_KEY = "claude:s1";
const SESSION_ID = "s1";
const THOUGHT_GAP_SECONDS = 10;
const WATCH_SECONDS = 600;
const SAMPLE_STEP_SECONDS = 0.5;

describe("office themes", () => {
  it("offers in the web exactly the seven templates the collector hands out, in the same order", () => {
    assert.deepEqual(THEMES.map((theme) => theme.id), TEMPLATE_IDS);
    assert.equal(TEMPLATE_IDS.length, THEME_COUNT);
  });
});

function thoughtsAbout(activity) {
  const agent = { key: AGENT_KEY, kind: "main", endedAt: null, status: activity.status, activity: activity.activity };
  const reactionId = busyReactionOf(agent);
  const samples = Array.from({ length: WATCH_SECONDS / SAMPLE_STEP_SECONDS }, (_, i) => i * SAMPLE_STEP_SECONDS);
  const texts = samples.map((nowSeconds) => thoughtAt({ agentKey: AGENT_KEY, reactionId, action: activity.action, sinceSeconds: 0, nowSeconds, gapSeconds: THOUGHT_GAP_SECONDS })?.text);
  return [...new Set(texts.filter(Boolean))];
}

describe("activity reported by the collector", () => {
  const cases = [
    { tool: "Edit", input: { file_path: "C:\\repo\\src\\a.js" }, action: "editando a.js", subject: "a.js" },
    { tool: "Read", input: { file_path: "/repo/README.md" }, action: "lendo README.md", subject: "README.md" },
    { tool: "Bash", input: { command: "npm test -- --watch" }, action: "rodando npm", subject: "npm" },
    { tool: "Agent", input: { subagent_type: "code-reviewer" }, action: "delegou para code-reviewer", subject: "code-reviewer" },
    { tool: "mcp__notion__search", input: {}, action: "usando notion", subject: "notion" },
  ];

  for (const { tool, input, action, subject } of cases) {
    it(`turns "${action}" into a thought that names ${subject}`, () => {
      const activity = describeActivity(tool, input);
      assert.equal(activity.action, action);
      const thoughts = thoughtsAbout(activity);
      assert.ok(thoughts.some((text) => text.includes(subject)), `no thought names ${subject}: ${thoughts.join(" | ")}`);
      assert.ok(thoughts.every((text) => !text.includes("{alvo}")));
    });
  }
});

function terminalToolFor(toolName, toolInput) {
  const { entry } = claudeHistoryEntry({ hook_event_name: "PreToolUse", session_id: SESSION_ID, tool_name: toolName, tool_input: toolInput });
  return { entry, tool: describeToolEntry(entry) };
}

describe("tool entries recorded by the collector", () => {
  it("shows a written file as code in the language of its extension, even with spaces in the path", () => {
    const { tool } = terminalToolFor("Write", { file_path: "C:\\Users\\dev\\meu projeto\\src\\main.ts", content: "const a = 1;" });
    assert.deepEqual(
      [tool.toolName, tool.summary, tool.kind, tool.format, tool.language],
      ["Write", "Escrever C:\\Users\\dev\\meu projeto\\src\\main.ts", "write", "code", "typescript"],
    );
  });

  it("shows an edit as a diff whose lines keep what was removed and what was added", () => {
    const { entry, tool } = terminalToolFor("Edit", { file_path: "a.js", old_string: "const a = 1;\nlet b;", new_string: "const a = 2;" });
    assert.deepEqual([tool.toolName, tool.summary, tool.format], ["Edit", "Editar a.js", "diff"]);
    assert.deepEqual(diffLines(entry.detail), [
      { kind: "del", text: "const a = 1;" }, { kind: "del", text: "let b;" }, { kind: "add", text: "const a = 2;" },
    ]);
  });

  it("shows every change of a multi-edit in one diff", () => {
    const edits = [{ old_string: "a", new_string: "b" }, { old_string: "c", new_string: "d" }];
    const { entry, tool } = terminalToolFor("MultiEdit", { file_path: "a.js", edits });
    assert.equal(tool.format, "diff");
    assert.deepEqual(diffLines(entry.detail).map((line) => line.kind), ["del", "add", "del", "add"]);
  });

  it("shows a shell command as a bash command under the description the agent gave", () => {
    const { entry, tool } = terminalToolFor("Bash", { command: "npm test", description: "Rodar os testes" });
    assert.deepEqual([tool.toolName, tool.summary, tool.kind, tool.format, tool.language], ["Bash", "Rodar os testes", "shell", "command", "bash"]);
    assert.equal(entry.detail, "npm test");
  });

  it("still shows a shell command as a command when the agent gave no description", () => {
    const { tool } = terminalToolFor("Bash", { command: "ls" });
    assert.deepEqual([tool.summary, tool.format], ["Rodar um comando", "command"]);
  });
});

describe("who can receive messages", () => {
  const cases = [
    ["a running Claude Code session", { kind: "main", source: "claude", endedAt: null }, true],
    ["a Claude Code session without an end time", { kind: "main", source: "claude" }, true],
    ["a Claude Code session that ended", { kind: "main", source: "claude", endedAt: 1_800_000_000_000 }, false],
    ["a Claude Code subagent", { kind: "subagent", source: "claude", endedAt: null }, false],
    ["a Codex session", { kind: "main", source: "codex", endedAt: null }, false],
    ["an agent of unknown origin", { kind: "main", endedAt: null }, false],
  ];

  for (const [who, agent, expected] of cases) {
    it(`gives the same answer in the web and in the collector for ${who}`, () => {
      assert.equal(webCanReceiveMessages(agent), expected);
      assert.equal(collectorCanReceiveMessages(agent), expected);
    });
  }
});
