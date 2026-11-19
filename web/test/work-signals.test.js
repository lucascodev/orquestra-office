import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { countPhrase } from "../scripts/domain/text/count-phrase.js";
import { countOf } from "../scripts/domain/work-signals/agent-work-fields.js";
import { agentWorkSignalOf, NO_WORK_SIGNAL, PASSED_SHOWN_MS, WRITING_SHOWN_MS } from "../scripts/domain/work-signals/agent-work-signal.js";
import { clockText } from "../scripts/domain/work-signals/clock-text.js";
import { agentWith, checklistOf, failedRun, HOUR, item, MINUTE, NOW, passedRun, run, SECOND, testsWith } from "./support/work-fixtures.js";

describe("clock of a running test", () => {
  const cases = [
    [0, "0:00"],
    [999, "0:00"],
    [12 * SECOND, "0:12"],
    [MINUTE + 5 * SECOND, "1:05"],
    [75 * MINUTE + 3 * SECOND, "75:03"],
    [-4 * SECOND, "0:00"],
    [Number.NaN, "0:00"],
  ];
  for (const [elapsedMs, expected] of cases) {
    it(`reads ${expected} after ${elapsedMs} ms`, () => assert.equal(clockText(elapsedMs), expected));
  }
});

describe("counted phrases", () => {
  const forms = { one: "1 falhou", other: "{count} falharam", unknown: "testes falharam" };
  const cases = [[1, "1 falhou"], [2, "2 falharam"], [0, "0 falharam"], [null, "testes falharam"], [-1, "testes falharam"], [1.5, "testes falharam"]];
  for (const [count, expected] of cases) {
    it(`say ${expected} for ${count}`, () => assert.equal(countPhrase(forms, count), expected));
  }
});

describe("counts read from the collector", () => {
  const cases = [[3, 3], [0, 0], ["248", 248], ["", null], ["2 testes", null], [-1, null], [2.5, null], [null, null], [undefined, null], [{}, null]];
  for (const [value, expected] of cases) {
    it(`read ${JSON.stringify(value) ?? "undefined"} as ${expected}`, () => assert.equal(countOf(value), expected));
  }
});

describe("signal over the agent's figure", () => {
  const cases = [
    ["nothing for a state saved before the fields", agentWith(), null, ""],
    ["nothing for a Codex agent", agentWith({ source: "codex", checklist: undefined, plan: undefined, tests: undefined }), null, ""],
    ["nothing for fields of the wrong shape", agentWith({ tests: "x", checklist: { items: "x" } }), null, ""],
    ["the running clock", agentWith({ tests: testsWith({ running: { command: "npm test", framework: null, startedAt: NOW - 12 * SECOND } }) }), "testing", "testando 0:12"],
    ["the running clock over a failed run", agentWith({ tests: testsWith({ running: { startedAt: NOW - SECOND }, lastRun: failedRun(2, 248) }) }), "testing", "testando 0:01"],
    ["the failures, until the next run", agentWith({ tests: testsWith({ lastRun: failedRun(2, 248, NOW - 3 * HOUR) }) }), "tests-failed", "2 falharam"],
    ["a single failure in the singular", agentWith({ tests: testsWith({ lastRun: failedRun(1, 9) }) }), "tests-failed", "1 falhou"],
    ["a failure without a known count", agentWith({ tests: testsWith({ lastRun: failedRun(null, null) }) }), "tests-failed", "testes falharam"],
    ["the failures over a test being written", agentWith({ tests: testsWith({ lastRun: failedRun(2, 248), lastTestFileAt: NOW - SECOND }) }), "tests-failed", "2 falharam"],
    ["the passes, for a minute", agentWith({ tests: testsWith({ lastRun: passedRun(250) }) }), "tests-passed", "250 passaram"],
    ["a single pass in the singular", agentWith({ tests: testsWith({ lastRun: passedRun(1) }) }), "tests-passed", "1 passou"],
    ["passes without a known count", agentWith({ tests: testsWith({ lastRun: passedRun(null) }) }), "tests-passed", "testes passaram"],
    ["a test being written", agentWith({ tests: testsWith({ lastRun: passedRun(250, NOW - 5 * MINUTE), lastTestFileAt: NOW - 20 * SECOND }) }), "writing-tests", "escrevendo teste"],
    ["a test being written before any run", agentWith({ tests: testsWith({ lastTestFileAt: NOW - 20 * SECOND }) }), "writing-tests", "escrevendo teste"],
    ["the passes over a test written before the run", agentWith({ tests: testsWith({ lastRun: passedRun(250), lastTestFileAt: NOW - MINUTE }) }), "tests-passed", "250 passaram"],
    ["the checklist when a test file was written before the last run", agentWith({ checklist: checklistOf("completed", "pending"), tests: testsWith({ lastRun: passedRun(5, NOW - 5 * MINUTE), lastTestFileAt: NOW - 6 * MINUTE }) }), "checklist", "1/2"],
    ["the open checklist", agentWith({ checklist: checklistOf("completed", "completed", "completed", "completed", "in_progress", "pending", "pending") }), "checklist", "4/7"],
    ["nothing for a checklist all done", agentWith({ checklist: checklistOf("completed", "completed") }), null, ""],
    ["nothing for an empty checklist", agentWith({ checklist: { items: [], updatedAt: NOW } }), null, ""],
    ["nothing for a null checklist", agentWith({ checklist: null, tests: null }), null, ""],
    ["nothing for checklist items without a status", agentWith({ checklist: { items: [null, 3, "x", { text: "a" }] } }), null, ""],
    ["only the items that have a status", agentWith({ checklist: { items: [null, item("completed"), { status: 1 }, item("pending")] } }), "checklist", "1/2"],
    ["nothing for a checklist that is a list", agentWith({ checklist: [item("pending")] }), null, ""],
    ["nothing for tests that are a list", agentWith({ tests: [failedRun(2, 1)] }), null, ""],
    ["nothing for a run that does not say whether it passed", agentWith({ tests: testsWith({ lastRun: { failed: 2, finishedAt: NOW } }) }), null, ""],
    ["nothing for a run whose result is text", agentWith({ tests: testsWith({ lastRun: run({ isOk: "false", failed: 2, finishedAt: NOW }) }) }), null, ""],
    ["nothing for a running entry that is text", agentWith({ tests: testsWith({ running: "npm test" }) }), null, ""],
    ["nothing for a start time that is text", agentWith({ tests: testsWith({ running: { startedAt: String(NOW) } }) }), null, ""],
    ["nothing for a test file time that is not a number", agentWith({ tests: testsWith({ lastTestFileAt: Number.NaN }) }), null, ""],
    ["unknown counts for counts that are not numbers", agentWith({ tests: testsWith({ lastRun: run({ isOk: false, failed: "muitos", passed: {}, finishedAt: NOW }) }) }), "tests-failed", "testes falharam"],
    ["passes whose end time is not a number as gone", agentWith({ tests: testsWith({ lastRun: run({ isOk: true, passed: 5, finishedAt: null }) }) }), null, ""],
  ];
  for (const [title, agent, kind, text] of cases) {
    it(`shows ${title}`, () => {
      const signal = agentWorkSignalOf(agent, NOW);
      assert.deepEqual([signal.kind, signal.text], [kind, text]);
    });
  }

  it("has the mark of each signal, so none of them is told by colour alone", () => {
    const marks = [
      agentWith({ tests: testsWith({ running: { startedAt: NOW } }) }),
      agentWith({ tests: testsWith({ lastRun: failedRun(2, 1) }) }),
      agentWith({ tests: testsWith({ lastRun: passedRun(3) }) }),
      agentWith({ tests: testsWith({ lastTestFileAt: NOW }) }),
      agentWith({ checklist: checklistOf("pending") }),
    ].map((agent) => agentWorkSignalOf(agent, NOW).icon);
    assert.deepEqual(marks, ["⚗", "✕", "✓", "✎", "☰"]);
  });

  it("tells how long the tests have been running and nothing for the other signals", () => {
    assert.equal(agentWorkSignalOf(agentWith({ tests: testsWith({ running: { startedAt: NOW - 12 * SECOND } }) }), NOW).elapsedMs, 12 * SECOND);
    assert.equal(agentWorkSignalOf(agentWith({ tests: testsWith({ running: { startedAt: NOW + SECOND } }) }), NOW).elapsedMs, 0);
    assert.equal(agentWorkSignalOf(agentWith({ tests: testsWith({ lastRun: failedRun(2, 1) }) }), NOW).elapsedMs, null);
  });

  it("lets the passes go after one minute and falls back to what comes next", () => {
    const agent = agentWith({ checklist: checklistOf("pending"), tests: testsWith({ lastRun: passedRun(250, NOW) }) });
    assert.equal(agentWorkSignalOf(agent, NOW + PASSED_SHOWN_MS - 1).kind, "tests-passed");
    assert.equal(agentWorkSignalOf(agent, NOW + PASSED_SHOWN_MS).kind, "checklist");
  });

  it("stops saying a test is being written one minute after the last test file", () => {
    const agent = agentWith({ tests: testsWith({ lastTestFileAt: NOW }) });
    assert.equal(agentWorkSignalOf(agent, NOW + WRITING_SHOWN_MS - 1).kind, "writing-tests");
    assert.deepEqual(agentWorkSignalOf(agent, NOW + WRITING_SHOWN_MS), NO_WORK_SIGNAL);
  });

  it("ignores a running entry without a start time", () => {
    assert.equal(agentWorkSignalOf(agentWith({ tests: testsWith({ running: { command: "npm test" } }) }), NOW).kind, null);
  });

  it("has no signal, and never throws, for an agent that is not a record", () => {
    for (const agent of [null, undefined, "x", 3, []]) assert.deepEqual(agentWorkSignalOf(agent, NOW), NO_WORK_SIGNAL);
  });
});
