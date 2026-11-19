import { test } from "node:test";
import assert from "node:assert/strict";
import { createHoldPermission } from "../src/control/application/hold-permission.js";
import { createHoldRequest } from "../src/control/application/hold-request.js";
import { createPendingDecisions } from "../src/control/domain/pending-decisions.js";
import { createSessionHistory } from "../src/history/session-history.js";
import { createRecordActivity } from "../src/office/application/record-activity.js";
import { createOfficeStore } from "../src/office/domain/office-store.js";

const HOLD_MS = 5_000;
const PLAN_TEXT_LIMIT = 20_000;
const ACTOR = Object.freeze({ source: "claude", sessionId: "s1", agentId: null, agentType: null, cwd: "/tmp/demo", projectRoot: "" });
const NEVER_ABORTED = () => {};

function heldRequestFor(toolName, toolInput) {
  const store = createOfficeStore();
  const decisions = createPendingDecisions({ holdMs: HOLD_MS });
  const holdRequest = createHoldRequest({ decisions, hasViewers: () => true });
  const holdPermission = createHoldPermission({ holdRequest, activity: createRecordActivity({ store, history: createSessionHistory() }) });
  holdPermission({ actor: ACTOR, toolName, toolInput, onAbort: NEVER_ABORTED });
  const [request] = decisions.list();
  decisions.settle(request.id, null);
  return request;
}

test("a plan waiting for approval carries its own text, from the signed request", () => {
  const written = "# Plan\n1. Ship it‮";
  const request = heldRequestFor("ExitPlanMode", { plan: written });
  assert.deepEqual([request.plan, request.planLength, request.isPlanTruncated], ["# Plan\n1. Ship it", written.length, false]);
});

test("the plan in the request masks secrets", () => {
  assert.equal(heldRequestFor("ExitPlanMode", { plan: "Use password=hunter2" }).plan, "Use password=[redacted]");
});

test("the plan in the request is not repeated raw in the detail", () => {
  assert.ok(!heldRequestFor("ExitPlanMode", { plan: "Use password=hunter2" }).detail.includes("hunter2"));
});

test("a plan over 20 000 characters is cut in the request and says so", () => {
  const request = heldRequestFor("ExitPlanMode", { plan: "x".repeat(25_000) });
  assert.deepEqual([request.plan.length, request.planLength, request.isPlanTruncated], [PLAN_TEXT_LIMIT, 25_000, true]);
});

test("a plan request without a plan carries an empty plan", () => {
  const request = heldRequestFor("ExitPlanMode", {});
  assert.deepEqual([request.plan, request.planLength, request.isPlanTruncated], ["", 0, false]);
});

test("a permission for another tool carries no plan", () => {
  const request = heldRequestFor("Bash", { command: "ls" });
  assert.deepEqual([request.plan, request.planLength, request.isPlanTruncated], [undefined, undefined, undefined]);
});
