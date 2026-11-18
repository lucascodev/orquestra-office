import { test } from "node:test";
import assert from "node:assert/strict";
import { createDecidePendingRequest } from "../src/control/application/decide-pending-request.js";
import { createDeliverQueuedMessages } from "../src/control/application/deliver-queued-messages.js";
import { createHoldPermission } from "../src/control/application/hold-permission.js";
import { createHoldQuestion } from "../src/control/application/hold-question.js";
import { createHoldRequest } from "../src/control/application/hold-request.js";
import { OUTCOME } from "../src/control/application/outcome.js";
import { createSendMessageToAgent } from "../src/control/application/send-message-to-agent.js";
import { createOutbox } from "../src/control/domain/outbox.js";
import { createPendingDecisions } from "../src/control/domain/pending-decisions.js";
import { createSessionHistory } from "../src/history/session-history.js";
import { createRecordActivity } from "../src/office/application/record-activity.js";
import { AGENT_ACTION } from "../src/office/domain/agent-actions.js";
import { TOOL_SUMMARY } from "../src/shared/claude/tool-summary-ids.js";
import { ENTRY_TEXT } from "../src/shared/terminal/entry-text-ids.js";
import { createOfficeStore } from "../src/office/domain/office-store.js";

const HOLD_MS = 5_000;
const EXPIRING_HOLD_MS = 20;
const EXPIRY_TEST_TIMEOUT_MS = 2_000;
const MAIN_KEY = "claude:s1";
const SUBAGENT_KEY = "claude:s1:a1";
const ACTOR = Object.freeze({ source: "claude", sessionId: "s1", agentId: null, agentType: null, cwd: "/tmp/demo", projectRoot: "" });
const SUBAGENT = Object.freeze({ ...ACTOR, agentId: "a1", agentType: "Explore" });
const BASH = { toolName: "Bash", toolInput: { command: "rm -rf build" } };
const QUESTIONS = [{ question: "Which framework?", header: "Framework", multiSelect: false, options: [] }];
const NEVER_ABORTED = () => {};

function createControl({ holdMs = HOLD_MS, isWatched = true } = {}) {
  const store = createOfficeStore();
  const history = createSessionHistory();
  const decisions = createPendingDecisions({ holdMs });
  const outbox = createOutbox();
  const activity = createRecordActivity({ store, history });
  const holdRequest = createHoldRequest({ decisions, hasViewers: () => isWatched });
  return {
    store,
    history,
    decisions,
    outbox,
    holdPermission: createHoldPermission({ holdRequest, activity }),
    holdQuestion: createHoldQuestion({ holdRequest, activity }),
    deliverQueuedMessages: createDeliverQueuedMessages({ store, outbox }),
    decidePendingRequest: createDecidePendingRequest({ decisions }),
    sendMessageToAgent: createSendMessageToAgent({ store, outbox, history }),
  };
}

const agentOf = (store, key) => store.findAgent(key);
const actionOf = (store, key) => {
  const { actionId, subject } = agentOf(store, key);
  return { actionId, subject };
};
const startSession = (store, actor = ACTOR) => store.apply({ ...actor, at: 1, kind: "activity", status: "idle", actionId: AGENT_ACTION.SESSION_OPENED, subject: null });

test("with nobody watching the office a permission goes straight back with no answer", async () => {
  const control = createControl({ isWatched: false });
  const held = control.holdPermission({ actor: ACTOR, ...BASH, onAbort: NEVER_ABORTED });
  assert.deepEqual(control.decisions.list(), []);
  assert.equal(await held, null);
});

test("a hook without a session is never held", async () => {
  const control = createControl();
  const held = control.holdPermission({ actor: null, ...BASH, onAbort: NEVER_ABORTED });
  assert.deepEqual(control.decisions.list(), []);
  assert.equal(await held, null);
});

test("an approved permission comes back as the answer and is noted in the room and in the history", async () => {
  const control = createControl();
  const held = control.holdPermission({ actor: ACTOR, ...BASH, onAbort: NEVER_ABORTED });
  const [request] = control.decisions.list();
  assert.deepEqual({ agentKey: request.agentKey, kind: request.kind, detail: request.detail }, { agentKey: MAIN_KEY, kind: "permission", detail: "rm -rf build" });
  assert.equal(request.summary, undefined);
  assert.deepEqual([request.toolName, request.summaryId, request.subject], ["Bash", TOOL_SUMMARY.RUN_COMMAND, null]);

  control.decisions.settle(request.id, { behavior: "allow" });
  assert.deepEqual(await held, { behavior: "allow" });
  assert.deepEqual(actionOf(control.store, MAIN_KEY), { actionId: AGENT_ACTION.PERMISSION_APPROVED, subject: "Bash" });
  const [note, ...others] = control.history.of(MAIN_KEY);
  assert.deepEqual(others, []);
  assert.deepEqual([note.kind, note.textId, note.toolName, note.summaryId, note.subject, note.text], ["note", ENTRY_TEXT.PERMISSION_APPROVED, "Bash", TOOL_SUMMARY.RUN_COMMAND, null, undefined]);
});

test("a permission for a tool with no summary is shown as using that tool", async () => {
  const control = createControl();
  control.holdPermission({ actor: ACTOR, toolName: "mcp__github__create_issue", toolInput: {}, onAbort: NEVER_ABORTED });
  const [request] = control.decisions.list();
  assert.deepEqual([request.summaryId, request.subject], [TOOL_SUMMARY.USE_TOOL, "mcp__github__create_issue"]);
});

test("a denied permission is noted as refused", async () => {
  const control = createControl();
  const held = control.holdPermission({ actor: ACTOR, ...BASH, onAbort: NEVER_ABORTED });
  control.decisions.settle(control.decisions.list()[0].id, { behavior: "deny", message: "no" });
  assert.deepEqual(await held, { behavior: "deny", message: "no" });
  assert.deepEqual(actionOf(control.store, MAIN_KEY), { actionId: AGENT_ACTION.PERMISSION_DENIED, subject: "Bash" });
  assert.equal(control.history.of(MAIN_KEY).at(-1).textId, ENTRY_TEXT.PERMISSION_DENIED);
});

test("closing the hook connection releases the held permission with no answer and no note", async () => {
  const control = createControl();
  let abort = null;
  const held = control.holdPermission({ actor: ACTOR, ...BASH, onAbort: (release) => { abort = release; } });
  abort();
  assert.equal(await held, null);
  assert.deepEqual(control.decisions.list(), []);
  assert.deepEqual(control.history.of(MAIN_KEY), []);
});

test("a held permission nobody answers expires with no answer", { timeout: EXPIRY_TEST_TIMEOUT_MS }, async () => {
  const control = createControl({ holdMs: EXPIRING_HOLD_MS });
  assert.equal(await control.holdPermission({ actor: ACTOR, ...BASH, onAbort: NEVER_ABORTED }), null);
  assert.deepEqual(control.decisions.list(), []);
});

test("a question with nothing to ask is not held", async () => {
  const control = createControl();
  const held = control.holdQuestion({ actor: ACTOR, questions: [], onAbort: NEVER_ABORTED });
  assert.deepEqual(control.decisions.list(), []);
  assert.equal(await held, null);
});

test("an answered question comes back with the answers and notes them", async () => {
  const control = createControl();
  const held = control.holdQuestion({ actor: ACTOR, questions: QUESTIONS, onAbort: NEVER_ABORTED });
  const [request] = control.decisions.list();
  assert.deepEqual({ kind: request.kind, toolName: request.toolName, questions: request.questions }, { kind: "question", toolName: "AskUserQuestion", questions: QUESTIONS });
  assert.deepEqual([request.summaryId, request.subject], [TOOL_SUMMARY.ASK_QUESTION, null]);

  control.decisions.settle(request.id, { answers: { "Which framework?": "Vue" } });
  assert.deepEqual(await held, { answers: { "Which framework?": "Vue" } });
  assert.deepEqual(actionOf(control.store, MAIN_KEY), { actionId: AGENT_ACTION.QUESTION_ANSWERED, subject: null });
  const note = control.history.of(MAIN_KEY).at(-1);
  assert.deepEqual([note.textId, note.answers, note.text], [ENTRY_TEXT.QUESTION_ANSWERED, ["Vue"], undefined]);
});

test("queued messages are handed over once, at the end of the main session's turn", () => {
  const control = createControl();
  control.outbox.queue(MAIN_KEY, "also update the README");
  assert.deepEqual(control.deliverQueuedMessages(ACTOR), ["also update the README"]);
  assert.deepEqual(actionOf(control.store, MAIN_KEY), { actionId: AGENT_ACTION.MESSAGE_DELIVERED, subject: null });
  assert.deepEqual(control.deliverQueuedMessages(ACTOR), []);
});

test("a subagent finishing never takes messages", () => {
  const control = createControl();
  control.outbox.queue(MAIN_KEY, "hi");
  control.outbox.queue(SUBAGENT_KEY, "hi");
  assert.deepEqual(control.deliverQueuedMessages(SUBAGENT), []);
  assert.deepEqual(control.outbox.counts(), { [MAIN_KEY]: 1, [SUBAGENT_KEY]: 1 });
});

test("with no message waiting the turn ends without touching the room", () => {
  const control = createControl();
  assert.deepEqual(control.deliverQueuedMessages(ACTOR), []);
  assert.equal(agentOf(control.store, MAIN_KEY), null);
});

test("deciding a request that is not pending is not found", () => {
  assert.equal(createControl().decidePendingRequest("missing", { behavior: "allow" }), OUTCOME.NOT_FOUND);
});

test("an answer that does not fit the request is refused and the request stays pending", () => {
  const control = createControl();
  control.holdPermission({ actor: ACTOR, ...BASH, onAbort: NEVER_ABORTED });
  const [request] = control.decisions.list();
  assert.equal(control.decidePendingRequest(request.id, { behavior: "maybe" }), OUTCOME.INVALID);
  assert.equal(control.decidePendingRequest(request.id, null), OUTCOME.INVALID);
  assert.equal(control.decisions.list().length, 1);
  assert.equal(control.decidePendingRequest(request.id, { behavior: "terminal" }), OUTCOME.DONE);
  assert.deepEqual(control.decisions.list(), []);
});

test("a message goes only to a running Claude Code main session", () => {
  const control = createControl();
  startSession(control.store);
  startSession(control.store, SUBAGENT);
  startSession(control.store, { ...ACTOR, source: "codex", sessionId: "t1" });
  assert.equal(control.sendMessageToAgent({ agentKey: "claude:unknown", text: "hi" }), OUTCOME.NOT_FOUND);
  assert.equal(control.sendMessageToAgent({ agentKey: SUBAGENT_KEY, text: "hi" }), OUTCOME.NOT_FOUND);
  assert.equal(control.sendMessageToAgent({ agentKey: "codex:t1", text: "hi" }), OUTCOME.NOT_FOUND);
  assert.equal(control.sendMessageToAgent({ agentKey: MAIN_KEY, text: "  " }), OUTCOME.INVALID);

  assert.equal(control.sendMessageToAgent({ agentKey: MAIN_KEY, text: "  also update the README " }), OUTCOME.DONE);
  assert.deepEqual(control.outbox.counts(), { [MAIN_KEY]: 1 });
  assert.deepEqual(control.history.of(MAIN_KEY).map(({ kind, text }) => ({ kind, text })), [{ kind: "message", text: "also update the README" }]);
});

test("a session that already closed takes no messages", () => {
  const control = createControl();
  startSession(control.store);
  control.store.apply({ ...ACTOR, at: 2, kind: "session-end", status: "idle", actionId: AGENT_ACTION.SESSION_CLOSED, subject: null });
  assert.equal(control.sendMessageToAgent({ agentKey: MAIN_KEY, text: "hi" }), OUTCOME.NOT_FOUND);
});
