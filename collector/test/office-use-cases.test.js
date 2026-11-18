import { test } from "node:test";
import assert from "node:assert/strict";
import { createOutbox } from "../src/control/domain/outbox.js";
import { createPendingDecisions } from "../src/control/domain/pending-decisions.js";
import { createSessionHistory } from "../src/history/session-history.js";
import { createPublicOfficeView } from "../src/office/application/public-office-view.js";
import { createRecordActivity } from "../src/office/application/record-activity.js";
import { createOfficeStore } from "../src/office/domain/office-store.js";

const MAIN_KEY = "claude:s1";
const EVENT = Object.freeze({ source: "claude", sessionId: "s1", agentId: null, agentType: null, cwd: "/tmp/demo", projectRoot: "", at: 1, kind: "activity", status: "working", actionId: "reading", subject: "a.md" });
const ENTRY = Object.freeze({ at: 1, kind: "prompt", text: "rename the secret module", detail: "" });

test("recorded activity moves the room and keeps the text only in the history", () => {
  const store = createOfficeStore();
  const history = createSessionHistory();
  createRecordActivity({ store, history }).record(EVENT, { agentKey: MAIN_KEY, entry: ENTRY });
  const { actionId, subject } = store.findAgent(MAIN_KEY);
  assert.deepEqual({ actionId, subject }, { actionId: "reading", subject: "a.md" });
  assert.deepEqual(history.of(MAIN_KEY), [ENTRY]);
  assert.ok(!JSON.stringify(store.snapshot()).includes("secret"));
});

test("activity with nothing worth keeping in the history only moves the room", () => {
  const store = createOfficeStore();
  const history = createSessionHistory();
  createRecordActivity({ store, history }).record(EVENT, null);
  assert.equal(store.findAgent(MAIN_KEY).status, "working");
  assert.deepEqual(history.of(MAIN_KEY), []);
});

test("the public view hides the usage meters and shows what is pending and queued", () => {
  const store = createOfficeStore();
  const decisions = createPendingDecisions();
  const outbox = createOutbox();
  store.apply(EVENT);
  store.recordUsage({ sessionId: "s1", at: 1, tokens: 1_000, costUsd: 0.5, rateLimits: null });
  decisions.hold({ agentKey: MAIN_KEY, kind: "permission" });
  outbox.queue(MAIN_KEY, "hi");

  const view = createPublicOfficeView({ store, decisions, outbox })();
  assert.equal(view.meters, undefined);
  assert.ok(store.snapshot().meters.s1);
  assert.deepEqual(view.pending.map((request) => request.kind), ["permission"]);
  assert.deepEqual(view.outbox, { [MAIN_KEY]: 1 });
  assert.deepEqual(Object.keys(view.projects), Object.keys(store.snapshot().projects));
});
