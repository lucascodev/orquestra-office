import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeClaudeEvent } from "../src/claude/claude-event.js";
import { createOfficeStore } from "../src/office/domain/office-store.js";
import { SLOT_MS } from "../src/office/domain/status-timeline.js";

const MINUTE_MS = 60_000;
const DAY_START = Date.UTC(2026, 10, 19);
const SWEEP_INTERVAL_MS = 30_000;
const at = (hour, minute = 0) => DAY_START + hour * SLOT_MS + minute * MINUTE_MS;

const claude = (event, time, extra = {}) =>
  normalizeClaudeEvent({ session_id: "s1", cwd: "C:\\projetos\\orquestra", hook_event_name: event, ...extra }, time);
const reading = (costUsd, time) => ({ sessionId: "s1", at: time, tokens: 0, costUsd, rateLimits: null });

const slotsOf = (store) => store.snapshot().timeline.slots;
const totalsAt = (store, hour, fields) => {
  const found = slotsOf(store).find((slot) => slot.start === at(hour));
  return found ? Object.fromEntries(fields.map((field) => [field, found[field]])) : null;
};

test("an agent that works 30 minutes across two hours fills both hours with its time", () => {
  const store = createOfficeStore();
  store.apply(claude("UserPromptSubmit", at(9, 45), { prompt: "go" }));
  store.apply(claude("Stop", at(10, 15)));
  assert.deepEqual(totalsAt(store, 9, ["workingMs", "workingAgentMs"]), { workingMs: 15 * MINUTE_MS, workingAgentMs: 15 * MINUTE_MS });
  assert.deepEqual(totalsAt(store, 10, ["workingMs", "workingAgentMs"]), { workingMs: 15 * MINUTE_MS, workingAgentMs: 15 * MINUTE_MS });
  assert.deepEqual(store.snapshot().timeline.open, { since: at(10, 15), working: 0, needsYou: 0 });
});

test("a subagent working beside its session adds agent time but not wall time, and stops counting when it ends", () => {
  const store = createOfficeStore();
  store.apply(claude("UserPromptSubmit", at(10), { prompt: "go" }));
  store.apply(claude("SubagentStart", at(10, 10), { agent_id: "a1", agent_type: "code-reviewer" }));
  store.apply(claude("SubagentStop", at(10, 30), { agent_id: "a1" }));
  store.apply(claude("Stop", at(10, 40)));
  assert.deepEqual(totalsAt(store, 10, ["workingMs", "workingAgentMs"]), { workingMs: 40 * MINUTE_MS, workingAgentMs: 60 * MINUTE_MS });
});

test("a permission request marks its hour once and counts the wait until it is answered", () => {
  const store = createOfficeStore();
  store.apply(claude("UserPromptSubmit", at(11), { prompt: "go" }));
  store.apply(claude("PermissionRequest", at(11, 20), { tool_name: "Bash" }));
  store.apply(claude("Notification", at(11, 21), { notification_type: "permission_prompt", message: "Claude needs your permission" }));
  store.apply(claude("PostToolUse", at(11, 25), { tool_name: "Bash" }));
  store.apply(claude("Stop", at(11, 30)));
  assert.deepEqual(totalsAt(store, 11, ["workingMs", "needsYouMs", "needsYouCount"]), {
    workingMs: 25 * MINUTE_MS, needsYouMs: 5 * MINUTE_MS, needsYouCount: 1,
  });
});

test("the spend of each usage reading goes to the hour of the reading, like the daily stats", () => {
  const store = createOfficeStore();
  store.apply(claude("SessionStart", at(12)));
  store.recordUsage(reading(0.5, at(12, 5)));
  store.recordUsage(reading(1.25, at(12, 50)));
  store.recordUsage(reading(2, at(13, 10)));
  assert.deepEqual(totalsAt(store, 12, ["costUsd"]), { costUsd: 0.75 });
  assert.deepEqual(totalsAt(store, 13, ["costUsd"]), { costUsd: 0.75 });
});

test("time passing with nothing changed makes no new frame or save, yet the next change closes the stretch", () => {
  const store = createOfficeStore();
  store.apply(claude("UserPromptSubmit", at(9), { prompt: "go" }));
  let changes = 0;
  store.onChange(() => { changes += 1; });
  for (let now = at(9); now <= at(10, 30); now += SWEEP_INTERVAL_MS) store.sweep(now);
  assert.equal(changes, 0);
  store.apply(claude("Stop", at(10, 30)));
  assert.equal(changes, 1);
  assert.deepEqual(totalsAt(store, 9, ["workingMs"]), { workingMs: SLOT_MS });
  assert.deepEqual(totalsAt(store, 10, ["workingMs"]), { workingMs: 30 * MINUTE_MS });
});

test("closing a project stops counting its agents at the collector's clock", () => {
  const store = createOfficeStore(undefined, { now: () => at(14, 20) });
  store.apply(claude("UserPromptSubmit", at(14), { prompt: "go" }));
  const [projectKey] = Object.keys(store.snapshot().projects);
  store.closeProject(projectKey);
  assert.deepEqual(totalsAt(store, 14, ["workingMs"]), { workingMs: 20 * MINUTE_MS });
  assert.deepEqual(store.snapshot().timeline.open, { since: at(14, 20), working: 0, needsYou: 0 });
});

test("hours older than 48 hours drop off as time goes by", () => {
  const store = createOfficeStore();
  store.apply(claude("SessionStart", at(0)));
  store.recordUsage(reading(0.5, at(0)));
  store.recordUsage(reading(1, at(0, 30)));
  store.sweep(at(47, 59));
  assert.equal(slotsOf(store).length, 1);
  store.sweep(at(48));
  assert.deepEqual(slotsOf(store), []);
});

test("a state saved before the timeline opens with an empty one and starts counting", () => {
  const saved = { projects: {}, sessions: {}, meters: {}, usage: { rateLimits: null, updatedAt: 0 } };
  const store = createOfficeStore(saved);
  assert.deepEqual(store.snapshot().timeline, { slotMs: SLOT_MS, slots: [], open: { since: null, working: 0, needsYou: 0 } });
  store.apply(claude("UserPromptSubmit", at(9), { prompt: "go" }));
  store.apply(claude("Stop", at(9, 10)));
  assert.deepEqual(totalsAt(store, 9, ["workingMs"]), { workingMs: 10 * MINUTE_MS });
});

test("a saved timeline comes back with its hours and the time the collector was down left out", () => {
  const first = createOfficeStore();
  first.apply(claude("UserPromptSubmit", at(9), { prompt: "go" }));
  first.apply(claude("PreToolUse", at(9, 30), { tool_name: "Bash", tool_input: { command: "ls" } }));
  const saved = JSON.parse(JSON.stringify(first.snapshot()));
  const restarted = createOfficeStore(saved);
  restarted.sweep(at(11));
  restarted.apply(claude("Stop", at(11, 10)));
  assert.deepEqual(totalsAt(restarted, 9, ["workingMs"]), { workingMs: 30 * MINUTE_MS });
  assert.deepEqual(totalsAt(restarted, 11, ["workingMs"]), { workingMs: 10 * MINUTE_MS });
  assert.equal(totalsAt(restarted, 10, ["workingMs"]), null);
});
