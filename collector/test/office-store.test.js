import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeClaudeEvent } from "../src/claude/claude-event.js";
import { normalizeCodexEvent } from "../src/codex/codex-event.js";
import { createOfficeStore } from "../src/office/domain/office-store.js";

const claude = (event, extra = {}, at = 1000) =>
  normalizeClaudeEvent({ session_id: "s1", cwd: "C:\\projetos\\orquestra", hook_event_name: event, ...extra }, at);

test("each project gets its own office with a different template", () => {
  const store = createOfficeStore();
  store.apply(claude("SessionStart"));
  store.apply(normalizeClaudeEvent({ session_id: "s2", cwd: "/home/dev/loja-online", hook_event_name: "SessionStart" }, 1000));
  const projects = Object.values(store.snapshot().projects);
  assert.equal(projects.length, 2);
  assert.notEqual(projects[0].template, projects[1].template);
  assert.deepEqual(projects.map((p) => p.name).sort(), ["loja-online", "orquestra"]);
});

test("same folder with different case on Windows is one project", () => {
  const store = createOfficeStore();
  store.apply(claude("SessionStart"));
  store.apply(normalizeClaudeEvent({ session_id: "s2", cwd: "c:/Projetos/Orquestra/", hook_event_name: "SessionStart" }, 1000));
  assert.equal(Object.keys(store.snapshot().projects).length, 1);
});

test("a session stays in its first project even after cd", () => {
  const store = createOfficeStore();
  store.apply(claude("SessionStart"));
  store.apply(normalizeClaudeEvent({ session_id: "s1", cwd: "C:\\projetos\\orquestra\\crates", hook_event_name: "Stop" }, 2000));
  assert.equal(Object.keys(store.snapshot().projects).length, 1);
});

test("subagents sit next to their parent session", () => {
  const store = createOfficeStore();
  store.apply(claude("SessionStart"));
  store.apply(claude("SubagentStart", { agent_id: "a1", agent_type: "code-reviewer" }));
  const agents = Object.values(Object.values(store.snapshot().projects)[0].agents);
  const sub = agents.find((a) => a.kind === "subagent");
  assert.equal(sub.label, "code-reviewer");
  assert.equal(sub.parentKey, "claude:s1");
});

test("answering a permission returns to working; plain progress keeps the reading pose", () => {
  const store = createOfficeStore();
  store.apply(claude("PermissionRequest", { tool_name: "Bash" }));
  store.apply(claude("PostToolUse", { tool_name: "Bash" }));
  let agent = Object.values(Object.values(store.snapshot().projects)[0].agents)[0];
  assert.equal(agent.status, "working");
  store.apply(claude("PreToolUse", { tool_name: "Read", tool_input: { file_path: "a.md" } }));
  store.apply(claude("PostToolUse", { tool_name: "Read" }));
  agent = Object.values(Object.values(store.snapshot().projects)[0].agents)[0];
  assert.equal(agent.status, "reviewing");
});

test("codex turns appear in the folder's office", () => {
  const store = createOfficeStore();
  store.apply(normalizeCodexEvent({ type: "agent-turn-complete", "thread-id": "t1", cwd: "/home/dev/loja-online", "input-messages": ["secret plan"] }, 1000));
  const project = Object.values(store.snapshot().projects)[0];
  assert.equal(project.name, "loja-online");
  assert.equal(Object.values(project.agents)[0].status, "waiting");
  assert.ok(!JSON.stringify(project).includes("secret plan"));
});

test("sweep moves long breaks to idle and removes closed sessions", () => {
  const store = createOfficeStore();
  store.apply(claude("Stop", {}, 0));
  store.sweep(11 * 60_000);
  let agent = Object.values(Object.values(store.snapshot().projects)[0].agents)[0];
  assert.equal(agent.status, "idle");
  store.apply(claude("SessionEnd", { reason: "other" }, 12 * 60_000));
  store.sweep(12 * 60_000 + 31 * 60_000);
  assert.equal(Object.keys(Object.values(store.snapshot().projects)[0].agents).length, 0);
});

test("template can be changed only to a known one", () => {
  const store = createOfficeStore();
  store.apply(claude("SessionStart"));
  const key = Object.keys(store.snapshot().projects)[0];
  assert.equal(store.setTemplate(key, "garagem"), true);
  assert.equal(store.setTemplate(key, "<script>"), false);
  assert.equal(store.snapshot().projects[key].template, "garagem");
});

test("a session in a worktree joins the office of its repository", () => {
  const store = createOfficeStore();
  store.apply(claude("SessionStart"));
  store.apply(normalizeClaudeEvent({
    session_id: "s2", cwd: "C:\\projetos\\orquestra-wt\\feature-x", hook_event_name: "SessionStart",
    office: { repoRoot: "C:/projetos/orquestra", team: ["code-reviewer", "board-keeper", "../etc/passwd", 7] },
  }, 1000));
  const projects = Object.values(store.snapshot().projects);
  assert.equal(projects.length, 1);
  assert.equal(Object.keys(projects[0].agents).length, 2);
  assert.deepEqual(projects[0].team, ["code-reviewer", "board-keeper"]);
});

test("what the agent is doing follows the tool it uses", () => {
  const store = createOfficeStore();
  const doing = () => Object.values(Object.values(store.snapshot().projects)[0].agents)[0].activity;
  store.apply(claude("UserPromptSubmit", { prompt: "go" }));
  assert.equal(doing(), "thinking");
  store.apply(claude("PreToolUse", { tool_name: "Bash", tool_input: { command: "npm test" } }));
  assert.equal(doing(), "terminal");
  store.apply(claude("PostToolUse", { tool_name: "Bash" }));
  assert.equal(doing(), "terminal");
  store.apply(claude("PreToolUse", { tool_name: "WebSearch", tool_input: { query: "x" } }));
  assert.equal(doing(), "web");
});

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const BREAK_TO_IDLE_MS = 10 * MINUTE_MS;
const ENDED_SUBAGENT_TTL_MS = 15 * MINUTE_MS;
const ENDED_SESSION_TTL_MS = 30 * MINUTE_MS;
const SILENT_SESSION_TTL_MS = 6 * HOUR_MS;
const QUIET_PROJECT_TTL_MS = 30 * DAY_MS;
const LATE_EVENING_UTC = Date.UTC(2026, 0, 10, 23, 59);
const NEXT_MORNING_UTC = Date.UTC(2026, 0, 11, 0, 1);
const STARTED_AT = Date.UTC(2026, 0, 10, 12, 0);

const projectOf = (store) => Object.values(store.snapshot().projects)[0];
const agentKeysOf = (store) => Object.keys(projectOf(store).agents);
const reading = (tokens, costUsd, at = 1000, sessionId = "s1") => ({ sessionId, at, tokens, costUsd, rateLimits: null });

test("sweep removes a finished subagent only after 15 minutes", () => {
  const store = createOfficeStore();
  store.apply(claude("SubagentStart", { agent_id: "a1", agent_type: "code-reviewer" }, STARTED_AT));
  store.apply(claude("SubagentStop", { agent_id: "a1" }, STARTED_AT));
  store.sweep(STARTED_AT + ENDED_SUBAGENT_TTL_MS);
  assert.deepEqual(agentKeysOf(store), ["claude:s1", "claude:s1:a1"]);
  store.sweep(STARTED_AT + ENDED_SUBAGENT_TTL_MS + 1);
  assert.deepEqual(agentKeysOf(store), ["claude:s1"]);
});

test("sweep removes a closed session only after 30 minutes", () => {
  const store = createOfficeStore();
  store.apply(claude("SessionStart", {}, STARTED_AT));
  store.apply(claude("SessionEnd", { reason: "other" }, STARTED_AT));
  store.sweep(STARTED_AT + ENDED_SESSION_TTL_MS);
  assert.deepEqual(agentKeysOf(store), ["claude:s1"]);
  store.sweep(STARTED_AT + ENDED_SESSION_TTL_MS + 1);
  assert.deepEqual(agentKeysOf(store), []);
});

test("sweep removes a session that went silent for more than 6 hours without closing", () => {
  const store = createOfficeStore();
  store.apply(claude("SessionStart", {}, STARTED_AT));
  store.sweep(STARTED_AT + SILENT_SESSION_TTL_MS);
  assert.deepEqual(agentKeysOf(store), ["claude:s1"]);
  store.sweep(STARTED_AT + SILENT_SESSION_TTL_MS + 1);
  assert.deepEqual(agentKeysOf(store), []);
});

test("an empty room stays for 30 days of quiet before sweep removes it", () => {
  const store = createOfficeStore();
  store.apply(claude("SessionStart", {}, STARTED_AT));
  store.apply(claude("SessionEnd", { reason: "other" }, STARTED_AT));
  store.sweep(STARTED_AT + ENDED_SESSION_TTL_MS + 1);
  store.sweep(STARTED_AT + QUIET_PROJECT_TTL_MS);
  assert.equal(projectOf(store).name, "orquestra");
  store.sweep(STARTED_AT + QUIET_PROJECT_TTL_MS + 1);
  assert.deepEqual(store.snapshot().projects, {});
});

test("sweep forgets the session and usage meter of removed agents and keeps the live ones", () => {
  const store = createOfficeStore();
  store.apply(claude("SessionStart", {}, STARTED_AT));
  store.recordUsage(reading(1_000, 0.5, STARTED_AT));
  store.apply(claude("SessionEnd", { reason: "other" }, STARTED_AT));
  store.apply(claude("SessionStart", { session_id: "s2" }, STARTED_AT + ENDED_SESSION_TTL_MS));
  store.recordUsage(reading(1_000, 0.5, STARTED_AT + ENDED_SESSION_TTL_MS, "s2"));
  store.sweep(STARTED_AT + ENDED_SESSION_TTL_MS + 1);
  const { sessions, meters } = store.snapshot();
  assert.deepEqual(Object.keys(sessions), ["s2"]);
  assert.deepEqual(Object.keys(meters), ["s2"]);
});

test("a break turns into idle only after 10 minutes of quiet", () => {
  const store = createOfficeStore();
  store.apply(claude("Stop", {}, STARTED_AT));
  store.sweep(STARTED_AT + BREAK_TO_IDLE_MS);
  assert.equal(projectOf(store).agents["claude:s1"].status, "break");
  store.sweep(STARTED_AT + BREAK_TO_IDLE_MS + 1);
  assert.equal(projectOf(store).agents["claude:s1"].status, "idle");
});

test("a quiet agent that is not on a break keeps its status", () => {
  const store = createOfficeStore();
  store.apply(claude("UserPromptSubmit", { prompt: "go" }, STARTED_AT));
  store.sweep(STARTED_AT + BREAK_TO_IDLE_MS + 1);
  assert.equal(projectOf(store).agents["claude:s1"].status, "working");
});

test("the daily stats start over at midnight UTC", () => {
  const store = createOfficeStore();
  store.apply(claude("UserPromptSubmit", { prompt: "go" }, LATE_EVENING_UTC));
  store.apply(claude("PreToolUse", { tool_name: "Bash", tool_input: { command: "ls" } }, LATE_EVENING_UTC));
  store.apply(claude("UserPromptSubmit", { prompt: "again" }, NEXT_MORNING_UTC));
  assert.deepEqual(projectOf(store).stats, { day: "2026-01-11", prompts: 1, tools: 0, turns: 0, tokens: 0, costUsd: 0 });
});

test("usage read after midnight counts toward the new day", () => {
  const store = createOfficeStore();
  store.apply(claude("SessionStart", {}, LATE_EVENING_UTC));
  store.recordUsage(reading(1_000, 0.5, LATE_EVENING_UTC));
  store.recordUsage(reading(1_600, 1.25, NEXT_MORNING_UTC));
  const { day, tokens, costUsd } = projectOf(store).stats;
  assert.deepEqual({ day, tokens, costUsd }, { day: "2026-01-11", tokens: 600, costUsd: 0.75 });
});

test("the first usage reading of a session is only the baseline", () => {
  const store = createOfficeStore();
  store.apply(claude("SessionStart"));
  store.recordUsage(reading(1_000, 0.5));
  const { tokens, costUsd } = projectOf(store).stats;
  assert.deepEqual({ tokens, costUsd }, { tokens: 0, costUsd: 0 });
});

test("a usage counter that drops, as after /clear, adds only the new spend", () => {
  const store = createOfficeStore();
  store.apply(claude("SessionStart"));
  store.recordUsage(reading(1_000, 0.5));
  store.recordUsage(reading(1_600, 1.25));
  store.recordUsage(reading(200, 0.25));
  const { tokens, costUsd } = projectOf(store).stats;
  assert.deepEqual({ tokens, costUsd }, { tokens: 800, costUsd: 1 });
});

const PROTOTYPE_KEYS = ["__proto__", "constructor"];

test("a folder named like a prototype key is an ordinary room that sweep can clean", () => {
  for (const cwd of PROTOTYPE_KEYS) {
    const store = createOfficeStore();
    store.apply(claude("SessionStart", { session_id: "s-proto", cwd }, STARTED_AT));
    assert.doesNotThrow(() => store.sweep(STARTED_AT + 1));
    assert.deepEqual(Object.keys(store.snapshot().projects), [cwd]);
  }
});

test("a repository root named like a prototype key is an ordinary room", () => {
  const store = createOfficeStore();
  store.apply(claude("SessionStart", { office: { repoRoot: "__proto__" } }, STARTED_AT));
  assert.doesNotThrow(() => store.sweep(STARTED_AT + 1));
  assert.equal(projectOf(store).name, "__proto__");
});

test("a session id named like a prototype key is an ordinary session", () => {
  for (const sessionId of PROTOTYPE_KEYS) {
    const store = createOfficeStore();
    store.apply(claude("SessionStart", { session_id: sessionId }, STARTED_AT));
    store.recordUsage(reading(1_000, 0.5, STARTED_AT, sessionId));
    assert.doesNotThrow(() => store.sweep(STARTED_AT + 1));
    assert.deepEqual(agentKeysOf(store), [`claude:${sessionId}`]);
  }
});

test("a template change for a project named like a prototype key does not reach every object", () => {
  const store = createOfficeStore();
  try {
    assert.equal(store.setTemplate("__proto__", "cafe"), false);
    assert.equal({}.template, undefined);
  } finally {
    delete Object.prototype.template;
  }
});

test("a saved state left behind by a prototype key loads and sweeps without breaking", () => {
  const saved = JSON.parse('{"projects":{},"sessions":{"s-proto":"__proto__","s-ctor":"constructor"},"meters":{}}');
  const store = createOfficeStore(saved);
  assert.doesNotThrow(() => store.sweep(STARTED_AT));
  assert.deepEqual(store.snapshot().sessions, {});
});

test("a saved room named like a prototype key loads as an ordinary room", () => {
  const savedRoom = { key: "__proto__", name: "__proto__", template: "cafe", createdAt: STARTED_AT, updatedAt: STARTED_AT, stats: { day: "2026-01-10", prompts: 0, tools: 0, turns: 0, tokens: 0, costUsd: 0 }, agents: {} };
  const saved = JSON.parse(`{"projects":{"__proto__":${JSON.stringify(savedRoom)}},"sessions":{"s1":"__proto__"},"meters":{}}`);
  const store = createOfficeStore(saved);
  store.apply(claude("SessionStart", {}, STARTED_AT));
  assert.doesNotThrow(() => store.sweep(STARTED_AT + 1));
  assert.deepEqual(agentKeysOf(store), ["claude:s1"]);
  assert.equal(store.closeProject("__proto__"), true);
  assert.deepEqual(store.snapshot().projects, {});
});
