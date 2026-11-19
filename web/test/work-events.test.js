import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { latestWorkEvent } from "../scripts/domain/work-signals/latest-work-event.js";
import { workEventsOf } from "../scripts/domain/work-signals/work-event.js";
import { agentWith, DAY_START, failedRun, HOUR, MINUTE, NOW, passedRun, SECOND, testsWith } from "./support/work-fixtures.js";

const LOG_SIZE = 20;
const approvedPlan = (decidedAt) => ({ version: 2, state: "approved", proposedAt: decidedAt - MINUTE, decidedAt, length: 900 });

describe("lines of the day's timeline from the agent's last run and approved plan", () => {
  const cases = [
    ["failures with the passes of the same run", testsWith({ lastRun: failedRun(2, 248) }), "tests-failed", "✕", "rodou os testes: 2 falharam, 248 passaram"],
    ["failures alone when nothing passed", testsWith({ lastRun: failedRun(1, 0) }), "tests-failed", "✕", "rodou os testes: 1 falhou"],
    ["failures without any count", testsWith({ lastRun: failedRun(null, null) }), "tests-failed", "✕", "rodou os testes: houve falhas"],
    ["passes", testsWith({ lastRun: passedRun(250) }), "tests-passed", "✓", "rodou os testes: 250 passaram"],
    ["a single pass", testsWith({ lastRun: passedRun(1) }), "tests-passed", "✓", "rodou os testes: 1 passou"],
    ["passes without any count", testsWith({ lastRun: passedRun(null) }), "tests-passed", "✓", "rodou os testes: todos passaram"],
  ];
  for (const [title, tests, kind, icon, text] of cases) {
    it(`tells ${title}, at the moment the run finished`, () => {
      const [event] = workEventsOf(agentWith({ tests }));
      assert.deepEqual(event, { kind, at: tests.lastRun.finishedAt, icon, text });
    });
  }

  it("tells the approved plan at the moment it was approved", () => {
    assert.deepEqual(workEventsOf(agentWith({ plan: approvedPlan(NOW - MINUTE) })), [{ kind: "plan-approved", at: NOW - MINUTE, icon: "✓", text: "teve o plano aprovado" }]);
  });

  const leftOut = [
    ["a plan still waiting", agentWith({ plan: { version: 1, state: "proposed", proposedAt: NOW, decidedAt: null } })],
    ["a revised plan", agentWith({ plan: { version: 2, state: "revised", proposedAt: NOW, decidedAt: null } })],
    ["an approved plan without the time it was approved", agentWith({ plan: { version: 1, state: "approved", proposedAt: NOW, decidedAt: null } })],
    ["a run without the time it finished", agentWith({ tests: testsWith({ lastRun: failedRun(2, 1, null) }) })],
    ["a run that does not say whether it passed", agentWith({ tests: testsWith({ lastRun: { ...failedRun(2, 1), isOk: "no" } }) })],
    ["an agent saved before the fields, as Codex", agentWith({ source: "codex" })],
    ["the log alone", agentWith({ log: [{ at: NOW, actionId: "tests-failed", subject: 2 }, { at: NOW, actionId: "plan-approved", subject: null }] })],
    ["an agent that is not a record", null],
  ];
  for (const [title, agent] of leftOut) {
    it(`leaves out ${title}`, () => assert.deepEqual(workEventsOf(agent), []));
  }
});

describe("newest event of the day", () => {
  const projectOf = (key, name, agents) => ({ key, name, agents: Object.fromEntries(agents.map((agent) => [agent.key, agent])) });
  const projects = {
    "c:/office": projectOf("c:/office", "orquestra-office", [
      agentWith({ key: "claude:n1", name: "Nina", tests: testsWith({ lastRun: failedRun(2, 248, NOW - 3 * MINUTE) }) }),
      agentWith({ key: "claude:h1", name: "Heitor", tests: testsWith({ lastRun: passedRun(9, DAY_START - MINUTE) }) }),
    ]),
    "c:/shop": projectOf("c:/shop", "loja-online", [
      agentWith({ key: "claude:v1", name: "Vitor", plan: approvedPlan(NOW - 10 * MINUTE), tests: testsWith({ lastRun: passedRun(5, NOW - HOUR) }) }),
      agentWith({ key: "codex:t1", name: "Tomás", source: "codex", log: undefined }),
    ]),
  };

  it("is the newest test result or approved plan, with who and where", () => {
    assert.deepEqual(latestWorkEvent(projects, { dayStart: DAY_START }), {
      kind: "tests-failed", at: NOW - 3 * MINUTE, icon: "✕", text: "rodou os testes: 2 falharam, 248 passaram",
      agentKey: "claude:n1", agentName: "Nina", projectName: "orquestra-office",
    });
  });

  it("finds the newest run even after more than twenty other actions pushed it out of the agent's log", () => {
    const busyLog = Array.from({ length: LOG_SIZE }, (_, index) => ({ at: NOW - MINUTE + (index + 1) * SECOND, actionId: "reading", subject: "x" }));
    const ana = agentWith({ key: "claude:a1", name: "Ana", tests: testsWith({ lastRun: failedRun(2, 10, NOW - MINUTE) }), log: busyLog });
    const bia = agentWith({ key: "claude:b1", name: "Bia", tests: testsWith({ lastRun: passedRun(250, NOW - HOUR) }), log: [{ at: NOW - HOUR, actionId: "tests-passed", subject: 250 }] });
    const event = latestWorkEvent({ office: projectOf("c:/office", "orquestra-office", [ana, bia]) }, { dayStart: DAY_START });
    assert.deepEqual([event.agentName, event.text], ["Ana", "rodou os testes: 2 falharam, 10 passaram"]);
  });

  it("leaves yesterday out and has nothing when today has no event", () => {
    const yesterdayOnly = { "c:/office": projectOf("c:/office", "orquestra-office", [projects["c:/office"].agents["claude:h1"]]) };
    assert.equal(latestWorkEvent(yesterdayOnly, { dayStart: DAY_START }), null);
    assert.equal(latestWorkEvent({}, { dayStart: DAY_START }), null);
  });

  it("skips malformed projects, agents and fields without throwing", () => {
    const malformed = {
      broken: null,
      noAgents: { name: "x", agents: "x" },
      odd: projectOf("c:/odd", "odd", [
        agentWith({ key: "claude:a", tests: "x", plan: [] }),
        agentWith({ key: "claude:b", tests: testsWith({ lastRun: failedRun("muitos", null, NOW) }) }),
      ]),
    };
    assert.equal(latestWorkEvent(malformed, { dayStart: DAY_START }).text, "rodou os testes: houve falhas");
    for (const value of [null, undefined, "x", 3]) assert.equal(latestWorkEvent(value, { dayStart: DAY_START }), null);
  });
});
