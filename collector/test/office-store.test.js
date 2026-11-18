import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeClaudeEvent } from "../src/events/claude-event.js";
import { normalizeCodexEvent } from "../src/events/codex-event.js";
import { createOfficeStore } from "../src/office/office-store.js";

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
