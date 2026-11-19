import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { claudeHistoryEntry } from "../../collector/src/claude/claude-history-entry.js";
import { describeActivity } from "../../collector/src/claude/describe-activity.js";
import { decisionAnswerOf, INVALID_ANSWER } from "../../collector/src/control/domain/decision-answer.js";
import { normalizeClaudeEvent } from "../../collector/src/claude/claude-event.js";
import { createPublicOfficeView } from "../../collector/src/office/application/public-office-view.js";
import { canReceiveMessages as collectorCanReceiveMessages } from "../../collector/src/office/domain/can-receive-messages.js";
import { createOfficeStore } from "../../collector/src/office/domain/office-store.js";
import { TEMPLATE_IDS } from "../../collector/src/office/domain/templates.js";
import { THEMES } from "../scripts/data/themes.js";
import { busyReactionOf } from "../scripts/domain/behavior/agent-reactions.js";
import { thoughtAt, thoughtSubjectOf } from "../scripts/domain/behavior/agent-thoughts.js";
import { KNOWN_STATUSES } from "../scripts/domain/office/agent-status.js";
import { canReceiveMessages as webCanReceiveMessages } from "../scripts/domain/office/can-receive-messages.js";
import { dayTimeline } from "../scripts/domain/office/day-timeline.js";
import { buildDecision } from "../scripts/domain/office/decision-body.js";
import { demoDay } from "../scripts/infra/demo/demo-day.js";
import { describeToolEntry, diffLines } from "../scripts/domain/terminal/terminal-format.js";
import { STATUS } from "../scripts/view/office/status-display.js";

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
  const subject = thoughtSubjectOf({ actionId: activity.actionId, subject: activity.subject });
  const texts = samples.map((nowSeconds) => thoughtAt({ agentKey: AGENT_KEY, reactionId, subject, sinceSeconds: 0, nowSeconds, gapSeconds: THOUGHT_GAP_SECONDS })?.text);
  return [...new Set(texts.filter(Boolean))];
}

describe("activity reported by the collector", () => {
  const cases = [
    { tool: "Edit", input: { file_path: "C:\\repo\\src\\a.js" }, shown: "editando a.js", subject: "a.js" },
    { tool: "Read", input: { file_path: "/repo/README.md" }, shown: "lendo README.md", subject: "README.md" },
    { tool: "Bash", input: { command: "npm install --save-dev vitest" }, shown: "rodando npm", subject: "npm" },
    { tool: "Agent", input: { subagent_type: "code-reviewer" }, shown: "delegou para code-reviewer", subject: "code-reviewer" },
    { tool: "mcp__notion__search", input: {}, shown: "usando notion", subject: "notion" },
  ];

  for (const { tool, input, shown, subject } of cases) {
    it(`turns "${shown}" into a thought that names ${subject}`, () => {
      const activity = describeActivity(tool, input);
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

describe("decisions sent from the office", () => {
  const permission = { kind: "permission", toolName: "Bash" };
  const question = { kind: "question", questions: [{ question: "Qual motor?" }, { question: "Qual cena?" }] };
  const bothAnswered = [
    { question: "Qual motor?", picked: ["Rapier"], other: "" },
    { question: "Qual cena?", picked: [], other: "  a do porto " },
  ];

  const accepted = [
    ["allowing a permission", permission, "allow", {}, { behavior: "allow" }],
    ["denying a permission with a reason", permission, "deny", { reason: "  agora não " }, { behavior: "deny", message: "agora não" }],
    ["denying a permission without a reason", permission, "deny", {}, { behavior: "deny", message: "" }],
    ["answering every question", question, "answer", { questions: bothAnswered }, { answers: { "Qual motor?": "Rapier", "Qual cena?": "a do porto" } }],
  ];

  // The collector's answer only leaves it as JSON, and its answers object has no prototype, so a question named __proto__ keeps its answer.
  const asSentToTheHook = (answer) => JSON.parse(JSON.stringify(answer));

  for (const [what, request, action, fields, expected] of accepted) {
    it(`are accepted by the collector when ${what}`, () => {
      assert.deepEqual(asSentToTheHook(decisionAnswerOf(request, buildDecision(action, fields))), expected);
    });
  }

  it("send a request back to the terminal the way the collector expects, for permissions and questions", () => {
    assert.equal(decisionAnswerOf(permission, buildDecision("terminal")), null);
    assert.equal(decisionAnswerOf(question, buildDecision("terminal", { questions: bothAnswered })), null);
  });

  it("are not sent with an unanswered question, which the collector would refuse", () => {
    const halfAnswered = [bothAnswered[0], { question: "Qual cena?", picked: [], other: "   " }];
    assert.equal(buildDecision("answer", { questions: halfAnswered }), null);
    assert.equal(decisionAnswerOf(question, { answers: { "Qual motor?": "Rapier", "Qual cena?": "" } }), INVALID_ANSWER);
  });
});

describe("agent statuses", () => {
  it("are shown with a label, a glyph and a color for exactly the statuses the domain knows", () => {
    assert.deepEqual(Object.keys(STATUS).sort(), [...KNOWN_STATUSES].sort());
    for (const display of Object.values(STATUS)) assert.ok(display.label && display.glyph && display.color);
  });
});

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
// Whole UTC hours line up with the viewer's hours, so a UTC midnight stands in for the local one and the test runs in any zone.
const DAY_START = Date.UTC(2026, 10, 19);
const COST_TOLERANCE = 1e-9;
// The demo fills the hours from eight in the morning, local time, up to now.
const DEMO_LOCAL_HOUR = 18;
const at = (hour, minute = 0) => DAY_START + hour * HOUR_MS + minute * MINUTE_MS;

function publishedDay() {
  const store = createOfficeStore();
  const claude = (event, time, extra = {}) =>
    store.apply(normalizeClaudeEvent({ session_id: SESSION_ID, cwd: "/home/dev/orquestra", hook_event_name: event, ...extra }, time));
  const spent = (costUsd, time) => store.recordUsage({ sessionId: SESSION_ID, at: time, tokens: 0, costUsd, rateLimits: null });
  claude("UserPromptSubmit", at(9, 45), { prompt: "go" });
  spent(1, at(10));
  claude("PermissionRequest", at(10, 5), { tool_name: "Bash" });
  claude("PostToolUse", at(10, 10), { tool_name: "Bash" });
  claude("Stop", at(10, 15));
  spent(1.6, at(10, 20));
  claude("UserPromptSubmit", at(10, 40), { prompt: "again" });
  const view = createPublicOfficeView({ store, decisions: { list: () => [] }, outbox: { counts: () => ({}) }, now: () => at(10, 50) });
  return view();
}

describe("the day's timeline published by the collector", () => {
  const office = publishedDay();
  const day = dayTimeline(office.timeline, { now: office.generatedAt, dayStart: DAY_START });
  const hourAt = (hour) => day.hours.find((shown) => shown.hour === hour);

  it("has the shape of the demo day the page is drawn with", () => {
    const demo = demoDay(new Date(2026, 10, 19, DEMO_LOCAL_HOUR).getTime()).timeline;
    assert.equal(office.timeline.slotMs, demo.slotMs);
    assert.deepEqual(Object.keys(office.timeline.open).sort(), Object.keys(demo.open).sort());
    for (const slot of office.timeline.slots) assert.deepEqual(Object.keys(slot).sort(), Object.keys(demo.slots[0]).sort());
  });

  it("gives the page the hours worked, waited and marked, with the stretch still open closed by the collector's clock", () => {
    assert.equal(hourAt(9).averageWorking, 15 / 60);
    assert.equal(hourAt(10).averageWorking, 20 / 60);
    assert.deepEqual([hourAt(9).isMarked, hourAt(10).isMarked, hourAt(10).needsYouCount], [false, true, 1]);
    assert.deepEqual([day.nowAt.hour, day.nowAt.minute, hourAt(10).isNow], [10, 50, true]);
  });

  it("adds up today's totals of time and spend", () => {
    assert.equal(day.totals.workingMs, 35 * MINUTE_MS);
    assert.equal(day.totals.needsYouMs, 5 * MINUTE_MS);
    assert.ok(Math.abs(day.totals.costUsd - 0.6) < COST_TOLERANCE, `cost was ${day.totals.costUsd}`);
  });
});
