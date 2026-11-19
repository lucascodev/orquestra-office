import { test } from "node:test";
import assert from "node:assert/strict";
import { checklistFromTodos, withTaskCreated, withTaskUpdated } from "../src/work/domain/checklist.js";
import { approvedPlan, nextPlan, PLAN_STATE } from "../src/work/domain/plan.js";
import { planTextOf } from "../src/work/domain/plan-text.js";

const AT = 1_000;
const LATER = 2_000;
const ITEM_LIMIT = 50;
const TEXT_LIMIT = 200;
const PLAN_TEXT_LIMIT = 20_000;

const todo = (content, status = "pending", activeForm = undefined) => ({ content, status, activeForm });
const textsOf = (checklist) => checklist.items.map((item) => item.text);

test("a todo list becomes the checklist, with its order, status and active text", () => {
  const checklist = checklistFromTodos([todo("Read the spec", "completed", "Reading the spec"), todo("Write tests", "in_progress", "Writing tests")], AT);
  assert.deepEqual(checklist, {
    items: [
      { id: "1", text: "Read the spec", status: "completed", activeText: "Reading the spec" },
      { id: "2", text: "Write tests", status: "in_progress", activeText: "Writing tests" },
    ],
    updatedAt: AT,
  });
});

test("a todo with its own id keeps it", () => {
  assert.equal(checklistFromTodos([{ id: "a-1", content: "x", status: "pending" }], AT).items[0].id, "a-1");
});

test("a todo with an unknown status counts as pending", () => {
  assert.equal(checklistFromTodos([todo("x", "deleted")], AT).items[0].status, "pending");
});

test("a todo without text is left out", () => {
  assert.deepEqual(textsOf(checklistFromTodos([todo(""), { status: "pending" }, todo("kept")], AT)), ["kept"]);
});

test("an empty todo list empties the checklist", () => {
  assert.deepEqual(checklistFromTodos([], AT), { items: [], updatedAt: AT });
});

test("a todo list that is not a list keeps no checklist", () => {
  assert.equal(checklistFromTodos("nope", AT), null);
});

test("the checklist keeps at most 50 items of at most 200 characters", () => {
  const todos = Array.from({ length: 60 }, (_, index) => todo(`${index} ${"x".repeat(300)}`));
  const checklist = checklistFromTodos(todos, AT);
  assert.equal(checklist.items.length, ITEM_LIMIT);
  assert.ok(checklist.items.every((item) => item.text.length === TEXT_LIMIT));
});

test("checklist texts lose control characters and secrets", () => {
  const [item] = checklistFromTodos([todo("Rotate‮ PASSWORD=hunter2", "pending", "Using token: abc")], AT).items;
  assert.deepEqual([item.text, item.activeText], ["Rotate PASSWORD=[redacted]", "Using token: [redacted]"]);
});

test("the checklist is a list even for a task id like __proto__", () => {
  const checklist = withTaskCreated(null, { id: "__proto__", text: "x" }, AT);
  assert.ok(Array.isArray(checklist.items));
  assert.equal(checklist.items[0].id, "__proto__");
  assert.equal(Object.getPrototypeOf(checklist), Object.prototype);
});

test("creating a task adds a pending item to the checklist", () => {
  const checklist = withTaskCreated(null, { id: "1", text: "Write tests", activeText: "Writing tests" }, AT);
  assert.deepEqual(checklist, { items: [{ id: "1", text: "Write tests", status: "pending", activeText: "Writing tests" }], updatedAt: AT });
});

test("tasks created in parallel keep the order of their ids", () => {
  const second = withTaskCreated(null, { id: "2", text: "second" }, AT);
  const both = withTaskCreated(withTaskCreated(second, { id: "10", text: "tenth" }, AT), { id: "1", text: "first" }, AT);
  assert.deepEqual(textsOf(both), ["first", "second", "tenth"]);
});

test("a task created without a known id takes the next number", () => {
  const checklist = withTaskCreated(withTaskCreated(null, { id: "3", text: "a" }, AT), { id: null, text: "b" }, AT);
  assert.deepEqual(checklist.items.map((item) => item.id), ["3", "4"]);
});

test("the same task created twice stays one item", () => {
  const once = withTaskCreated(null, { id: "1", text: "a" }, AT);
  assert.equal(withTaskCreated(once, { id: "1", text: "a" }, AT).items.length, 1);
});

test("a task without text is not added", () => {
  assert.equal(withTaskCreated(null, { id: "1", text: "" }, AT), null);
});

test("updating a task changes its status and text", () => {
  const created = withTaskCreated(null, { id: "1", text: "a" }, AT);
  const updated = withTaskUpdated(created, { id: "1", status: "completed", text: "a, done" }, LATER);
  assert.deepEqual(updated, { items: [{ id: "1", text: "a, done", status: "completed", activeText: null }], updatedAt: LATER });
});

test("a task updated as deleted leaves the checklist", () => {
  const created = withTaskCreated(withTaskCreated(null, { id: "1", text: "a" }, AT), { id: "2", text: "b" }, AT);
  assert.deepEqual(textsOf(withTaskUpdated(created, { id: "1", status: "deleted" }, LATER)), ["b"]);
});

test("an unknown status on update keeps the status the task had", () => {
  const created = withTaskCreated(null, { id: "1", text: "a" }, AT);
  assert.equal(withTaskUpdated(created, { id: "1", status: "weird" }, LATER).items[0].status, "pending");
});

test("updating a task nobody knows changes nothing", () => {
  const created = withTaskCreated(null, { id: "1", text: "a" }, AT);
  assert.equal(withTaskUpdated(created, { id: "9", status: "completed" }, LATER), created);
  assert.equal(withTaskUpdated(null, { id: "9", status: "completed" }, LATER), null);
});

test("the first plan is version 1 and proposed", () => {
  assert.deepEqual(nextPlan(null, 120, AT), { version: 1, state: PLAN_STATE.PROPOSED, proposedAt: AT, decidedAt: null, length: 120 });
});

test("a new plan while the last one waits for approval is a revision", () => {
  const plan = nextPlan(nextPlan(null, 120, AT), 140, LATER);
  assert.deepEqual([plan.version, plan.state, plan.length], [2, PLAN_STATE.REVISED, 140]);
});

test("a new plan after an approved one is proposed again", () => {
  const plan = nextPlan(approvedPlan(nextPlan(null, 120, AT), AT), 90, LATER);
  assert.deepEqual([plan.version, plan.state], [2, PLAN_STATE.PROPOSED]);
});

test("approving a plan records when", () => {
  assert.deepEqual(approvedPlan(nextPlan(null, 120, AT), LATER), { version: 1, state: PLAN_STATE.APPROVED, proposedAt: AT, decidedAt: LATER, length: 120 });
});

test("approving an approved plan keeps the first decision", () => {
  const approved = approvedPlan(nextPlan(null, 120, AT), AT);
  assert.equal(approvedPlan(approved, LATER), approved);
});

test("the plan text keeps the markdown and masks secrets", () => {
  const written = "# Plan\n\n1. Set API_KEY=abc‮\n2. Test";
  assert.deepEqual(planTextOf(written), { text: "# Plan\n\n1. Set API_KEY=[redacted]\n2. Test", length: written.length, isTruncated: false });
});

test("a plan text over 20 000 characters is cut and says so", () => {
  const plan = planTextOf("x".repeat(25_000));
  assert.deepEqual([plan.text.length, plan.length, plan.isTruncated], [PLAN_TEXT_LIMIT, 25_000, true]);
});

test("an empty plan has no text", () => {
  assert.equal(planTextOf("  \n "), null);
  assert.equal(planTextOf(undefined), null);
});
