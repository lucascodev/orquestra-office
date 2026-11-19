import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { countPhrase } from "../scripts/domain/text/count-phrase.js";
import { checklistProgress } from "../scripts/domain/work-sheet/checklist-progress.js";
import { planDocument } from "../scripts/domain/work-sheet/plan-document.js";
import { planStatus } from "../scripts/domain/work-sheet/plan-status.js";
import { runningElapsedMs } from "../scripts/domain/work-sheet/running-elapsed.js";
import { testFileState } from "../scripts/domain/work-sheet/test-file-state.js";
import { hasFailedLastRun } from "../scripts/domain/work-sheet/test-fields.js";
import { testRunSummary } from "../scripts/domain/work-sheet/test-run-summary.js";
import { testsOverview } from "../scripts/domain/work-sheet/tests-overview.js";
import { hasWorkTabs, shownTabOf, workTabs } from "../scripts/domain/work-sheet/work-tabs.js";

const NOW = 1_800_000_000_000;
const MINUTE = 60_000;
const DAMAGED = [undefined, null, "lista", 42, true, [], ["x"], { items: "nada" }, { items: [null, 3, "x"] }];

const item = (id, status, text = `item ${id}`) => ({ id, text, status, activeText: `fazendo ${id}` });
const checklist = (...statuses) => ({ updatedAt: NOW - MINUTE, items: statuses.map((status, index) => item(index + 1, status)) });
const failedRun = { command: "npm test", framework: "vitest", startedAt: NOW - 5_000, finishedAt: NOW, durationMs: 5_000, isOk: false, passed: 248, failed: 2, skipped: 7, failures: [] };
const passedRun = { ...failedRun, isOk: true, passed: 250, failed: 0, skipped: 0 };
const claudeAgent = (extra = {}) => ({ key: "claude:a1", source: "claude", checklist: null, plan: null, tests: null, ...extra });

describe("checklist progress", () => {
  it("counts the items done and finds the one in progress with its place in the list", () => {
    const progress = checklistProgress(checklist("completed", "completed", "in_progress", "pending"));
    assert.deepEqual([progress.done, progress.total, progress.hasOpenItems, progress.updatedAt], [2, 4, true, NOW - MINUTE]);
    assert.deepEqual([progress.current.id, progress.current.position, progress.current.activeText], ["3", 3, "fazendo 3"]);
  });

  it("says when the whole list is done and when nobody is on any item", () => {
    const progress = checklistProgress(checklist("completed", "completed"));
    assert.deepEqual([progress.hasOpenItems, progress.current], [false, null]);
  });

  it("treats an unknown status as still to do and a missing id as the item's place", () => {
    const progress = checklistProgress({ items: [{ text: "a", status: "deleted" }, { id: { nested: 1 }, text: 5, status: "toString" }] });
    assert.deepEqual(progress.items.map((entry) => [entry.id, entry.text, entry.status]), [["0", "a", "pending"], ["1", "", "pending"]]);
  });

  it("is no list at all when it never came, came empty or came damaged from a saved state", () => {
    for (const value of [...DAMAGED, { items: [] }]) assert.equal(checklistProgress(value), null, JSON.stringify(value));
  });
});

describe("test rounds", () => {
  it("counts the failures in the headline of a bad round and the passes in a good one", () => {
    assert.deepEqual(pick(testRunSummary(failedRun), ["verdict", "headlineCount", "hasCounts", "framework"]), ["failed", 2, true, "vitest"]);
    assert.deepEqual(pick(testRunSummary(passedRun), ["verdict", "headlineCount", "isOk"]), ["passed", 250, true]);
  });

  it("has no number for a round known only by its exit code", () => {
    const summary = testRunSummary({ isOk: false, passed: null, failed: null, skipped: null });
    assert.deepEqual(pick(summary, ["verdict", "headlineCount", "hasCounts"]), ["failed", null, false]);
    assert.equal(testRunSummary({ isOk: false, passed: 3, failed: 0 }).headlineCount, null);
  });

  it("drops counts that are not whole numbers and takes a round that does not say whether it passed as no round", () => {
    const summary = testRunSummary({ isOk: false, passed: -1, failed: 1.5, skipped: "7" });
    assert.deepEqual(pick(summary, ["verdict", "passed", "failed", "skipped", "hasCounts"]), ["failed", null, null, null, false]);
    for (const isOk of ["yes", "false", 1, null, undefined]) assert.equal(testRunSummary({ isOk, passed: 3, failed: 0 }), null);
  });

  it("marks the tests as failed only while the last round really failed", () => {
    assert.equal(hasFailedLastRun({ lastRun: failedRun }), true);
    assert.equal(hasFailedLastRun({ lastRun: passedRun }), false);
    assert.equal(hasFailedLastRun({ lastRun: { passed: 1 } }), false);
    for (const value of DAMAGED) assert.equal(hasFailedLastRun(value), false);
  });

  it("tells a test file failing with its count, passing, or without a result", () => {
    assert.deepEqual(testFileState({ path: "a.test.js", action: "edited", failed: 2 }), { path: "a.test.js", action: "edited", result: "failing", failed: 2 });
    assert.deepEqual(testFileState({ path: "b.test.js", action: "created", failed: 0 }), { path: "b.test.js", action: "created", result: "passing", failed: null });
    assert.deepEqual(testFileState({ path: "c.test.js", action: "deleted", failed: null }), { path: "c.test.js", action: null, result: "unknown", failed: null });
  });

  it("gathers the running round, the last one, today's rounds and the files, leaving out damaged entries", () => {
    const overview = testsOverview({
      running: { command: "npx vitest", framework: "vitest", startedAt: NOW - 12_000 },
      lastRun: { ...failedRun, failures: [{ name: "x", location: "a.test.js:3", message: "boom" }, null, "texto"] },
      runsToday: [{ finishedAt: NOW, label: "web", isOk: true, passed: 3 }, null, 7],
      files: [{ path: "a.test.js", action: "edited", failed: 1 }, { path: 3 }, "b.test.js"],
    });
    assert.deepEqual(overview.running, { command: "npx vitest", framework: "vitest", startedAt: NOW - 12_000 });
    assert.deepEqual(overview.lastRun.failures, [{ name: "x", location: "a.test.js:3", message: "boom" }]);
    assert.deepEqual(overview.runsToday.map((run) => [run.label, run.verdict, run.passed]), [["web", "passed", 3]]);
    assert.deepEqual(overview.files.map((file) => file.path), ["a.test.js"]);
  });

  it("has nothing to show for a session without tests or with a damaged record", () => {
    assert.equal(testsOverview({ running: null, lastRun: null, runsToday: [], files: [], lastTestFileAt: null }), null);
    for (const value of DAMAGED) assert.equal(testsOverview(value), null, JSON.stringify(value));
    assert.equal(testsOverview({ running: "sim", lastRun: 3, runsToday: "x", files: {} }), null);
  });

  it("times the running round from its start, never below zero", () => {
    assert.equal(runningElapsedMs(NOW - 12_000, NOW), 12_000);
    assert.equal(runningElapsedMs(NOW + 5_000, NOW), 0);
    assert.equal(runningElapsedMs(null, NOW), null);
    assert.equal(runningElapsedMs(Number.NaN, NOW), null);
  });
});

describe("plans", () => {
  it("reads the state of the latest plan without its text, dating it by its decision or its proposal", () => {
    const approved = planStatus({ version: 2, state: "approved", proposedAt: NOW - 2 * MINUTE, decidedAt: NOW - MINUTE, length: 900 });
    assert.deepEqual(pick(approved, ["state", "version", "at", "decidedAt"]), ["approved", 2, NOW - MINUTE, NOW - MINUTE]);
    const proposed = planStatus({ version: 3, state: "proposed", proposedAt: NOW, decidedAt: null });
    assert.deepEqual(pick(proposed, ["state", "at"]), ["proposed", NOW]);
  });

  it("dates a revised plan, the new version still waiting for approval, by when it arrived", () => {
    const revised = planStatus({ version: 2, state: "revised", proposedAt: NOW - 2 * MINUTE, decidedAt: NOW - MINUTE });
    assert.deepEqual(pick(revised, ["state", "version", "at"]), ["revised", 2, NOW - 2 * MINUTE]);
  });

  it("changes its stamp when the version or the state changes, so the sheet fetches the text again", () => {
    const first = planStatus({ version: 1, state: "proposed", proposedAt: NOW });
    assert.notEqual(first.stamp, planStatus({ version: 1, state: "approved", proposedAt: NOW, decidedAt: NOW }).stamp);
    assert.notEqual(first.stamp, planStatus({ version: 2, state: "proposed", proposedAt: NOW }).stamp);
  });

  it("falls back to a first proposed version for damaged fields and is no plan for a damaged record", () => {
    assert.deepEqual(pick(planStatus({ version: "dois", state: "toString" }), ["state", "version", "at"]), ["proposed", 1, null]);
    for (const value of [undefined, null, "plano", 3, []]) assert.equal(planStatus(value), null);
  });

  it("takes the fetched plan only when it has a text, and no plan for { plan: null } or anything else", () => {
    const fetched = planDocument({ text: "# Plano", version: 2, state: "approved", proposedAt: NOW, decidedAt: NOW });
    assert.deepEqual(pick(fetched, ["text", "version", "state"]), ["# Plano", 2, "approved"]);
    for (const value of [{ plan: null }, { text: "" }, { text: 3 }, null, "texto", []]) assert.equal(planDocument(value), null);
  });

});

describe("tabs of the agent's sheet", () => {
  it("gives the tabs to Claude Code sessions only, even before any field arrives", () => {
    assert.equal(hasWorkTabs(claudeAgent()), true);
    assert.equal(hasWorkTabs({ key: "claude:old", source: "claude" }), true);
    assert.equal(hasWorkTabs({ key: "codex:b1", source: "codex" }), false);
    assert.deepEqual(workTabs({ key: "codex:b1", source: "codex" }, "tests"), []);
  });

  it("opens the tab asked for when it exists and Agora otherwise", () => {
    assert.equal(shownTabOf(claudeAgent(), "plan"), "plan");
    assert.equal(shownTabOf(claudeAgent(), "toString"), "now");
    assert.equal(shownTabOf({ source: "codex" }, "plan"), "now");
  });

  it("shows the list's progress on Tarefas and marks Testes while the last round failed and it is closed", () => {
    const agent = claudeAgent({ checklist: checklist("completed", "in_progress", "pending"), tests: { lastRun: failedRun } });
    const tabs = workTabs(agent, "now");
    assert.deepEqual(tabs.map((tab) => tab.id), ["now", "todos", "plan", "tests"]);
    assert.deepEqual(tabs.map((tab) => tab.isSelected), [true, false, false, false]);
    assert.deepEqual(tabs[1].progress, { done: 1, total: 3 });
    assert.equal(tabs[3].hasAlert, true);
    assert.equal(workTabs(agent, "tests")[3].hasAlert, false);
    assert.equal(workTabs(claudeAgent({ tests: { lastRun: passedRun } }), "now")[3].hasAlert, false);
  });

  it("keeps working with damaged fields from a saved state", () => {
    for (const value of DAMAGED) {
      const tabs = workTabs(claudeAgent({ checklist: value, plan: value, tests: value }), "todos");
      assert.equal(tabs.length, 4);
      assert.equal(tabs[1].progress, null);
    }
  });
});

describe("counted phrases", () => {
  const phrases = { one: "1 falhou", other: "{count} falharam", unknown: "Terminou com erro" };

  it("picks the singular, the plural or the phrase without a number", () => {
    assert.deepEqual([1, 2, 0, null].map((count) => countPhrase(phrases, count)), ["1 falhou", "2 falharam", "0 falharam", "Terminou com erro"]);
  });
});

function pick(record, fields) {
  return fields.map((field) => record[field]);
}
