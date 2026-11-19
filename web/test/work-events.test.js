import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { latestWorkEvent } from "../scripts/domain/work-signals/latest-work-event.js";
import { RUN_MATCH_MS, workEventOf } from "../scripts/domain/work-signals/work-event.js";
import { agentWith, DAY_START, failedRun, HOUR, MINUTE, NOW, passedRun, testsWith } from "./support/work-fixtures.js";

describe("line of the day's timeline from the agent's log", () => {
  const entry = (actionId, subject, at = NOW - MINUTE) => ({ at, actionId, subject });
  const cases = [
    ["failures with the passes of the same run", entry("tests-failed", 2), agentWith({ tests: testsWith({ lastRun: failedRun(2, 248) }) }), "✕", "rodou os testes: 2 falharam, 248 passaram"],
    ["failures with the passes of a run of today a moment apart", entry("tests-failed", "2"), agentWith({ tests: testsWith({ runsToday: [failedRun(2, 248, NOW - MINUTE + RUN_MATCH_MS)] }) }), "✕", "rodou os testes: 2 falharam, 248 passaram"],
    ["failures alone when no run matches", entry("tests-failed", 2), agentWith({ tests: testsWith({ lastRun: failedRun(2, 248, NOW - HOUR) }) }), "✕", "rodou os testes: 2 falharam"],
    ["failures alone when nothing passed", entry("tests-failed", 1), agentWith({ tests: testsWith({ lastRun: failedRun(1, 0) }) }), "✕", "rodou os testes: 1 falhou"],
    ["failures without any count", entry("tests-failed", null), agentWith(), "✕", "rodou os testes: houve falhas"],
    ["failures counted by the run when the log has no number", entry("tests-failed", null), agentWith({ tests: testsWith({ lastRun: failedRun(3, 10) }) }), "✕", "rodou os testes: 3 falharam, 10 passaram"],
    ["passes", entry("tests-passed", 250), agentWith(), "✓", "rodou os testes: 250 passaram"],
    ["a single pass", entry("tests-passed", 1), agentWith(), "✓", "rodou os testes: 1 passou"],
    ["passes counted by the run", entry("tests-passed", null), agentWith({ tests: testsWith({ lastRun: passedRun(461, NOW - MINUTE) }) }), "✓", "rodou os testes: 461 passaram"],
    ["passes without any count", entry("tests-passed", null), agentWith(), "✓", "rodou os testes: todos passaram"],
    ["the approved plan", entry("plan-approved", null), agentWith(), "✓", "teve o plano aprovado"],
  ];
  for (const [title, logEntry, agent, icon, text] of cases) {
    it(`tells ${title}`, () => {
      const event = workEventOf(logEntry, agent);
      assert.deepEqual([event.kind, event.at, event.icon, event.text], [logEntry.actionId, logEntry.at, icon, text]);
    });
  }

  const leftOut = [
    ["another action", entry("editing", "a.js")],
    ["an entry without an action", { at: NOW, text: "editando legado.js" }],
    ["an inherited name", entry("toString", null)],
    ["an entry without a time", { actionId: "tests-passed", subject: 3 }],
    ["an entry whose time is text", { at: String(NOW), actionId: "tests-passed", subject: 3 }],
    ["an entry whose action is not text", { at: NOW, actionId: { id: "tests-passed" }, subject: 3 }],
    ["an entry that is text", "tests-passed"],
    ["nothing at all", null],
  ];
  for (const [title, logEntry] of leftOut) {
    it(`leaves out ${title}`, () => assert.equal(workEventOf(logEntry, agentWith()), null));
  }
});

describe("newest event of the day", () => {
  const projectOf = (key, name, agents) => ({ key, name, agents: Object.fromEntries(agents.map((agent) => [agent.key, agent])) });
  const projects = {
    "c:/office": projectOf("c:/office", "orquestra-office", [
      agentWith({ key: "claude:n1", name: "Nina", log: [{ at: NOW - 3 * MINUTE, actionId: "tests-failed", subject: 2 }, { at: NOW - MINUTE, actionId: "editing", subject: "a.js" }] }),
      agentWith({ key: "claude:h1", name: "Heitor", log: [{ at: DAY_START - MINUTE, actionId: "tests-passed", subject: 9 }] }),
    ]),
    "c:/shop": projectOf("c:/shop", "loja-online", [
      agentWith({ key: "claude:v1", name: "Vitor", log: [{ at: NOW - 10 * MINUTE, actionId: "plan-approved", subject: null }] }),
      agentWith({ key: "codex:t1", name: "Tomás", source: "codex", log: undefined }),
    ]),
  };

  it("is the newest test result or approved plan, with who and where", () => {
    assert.deepEqual(latestWorkEvent(projects, { dayStart: DAY_START }), {
      kind: "tests-failed", at: NOW - 3 * MINUTE, icon: "✕", text: "rodou os testes: 2 falharam",
      agentKey: "claude:n1", agentName: "Nina", projectName: "orquestra-office",
    });
  });

  it("leaves yesterday out and has nothing when today has no event", () => {
    const yesterdayOnly = { "c:/office": projectOf("c:/office", "orquestra-office", [projects["c:/office"].agents["claude:h1"]]) };
    assert.equal(latestWorkEvent(yesterdayOnly, { dayStart: DAY_START }), null);
    assert.equal(latestWorkEvent({}, { dayStart: DAY_START }), null);
  });

  it("skips malformed projects, agents, logs and entries without throwing", () => {
    const malformed = {
      broken: null,
      noAgents: { name: "x", agents: "x" },
      odd: projectOf("c:/odd", "odd", [
        agentWith({ key: "claude:a", log: "x" }),
        agentWith({ key: "claude:b", log: [null, 3, "tests-passed", { at: "x", actionId: "tests-passed" }, { at: NOW, actionId: "tests-failed", subject: "muitos" }] }),
      ]),
    };
    assert.equal(latestWorkEvent(malformed, { dayStart: DAY_START }).text, "rodou os testes: houve falhas");
    for (const projects of [null, undefined, "x", 3]) assert.equal(latestWorkEvent(projects, { dayStart: DAY_START }), null);
  });
});
