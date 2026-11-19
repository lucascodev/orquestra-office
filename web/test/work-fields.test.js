import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { countOf, textOf, timeOf } from "../scripts/domain/shared/field-values.js";
import { testsOverview } from "../scripts/domain/work-sheet/tests-overview.js";
import { workTabs } from "../scripts/domain/work-sheet/work-tabs.js";
import { agentWorkSignalOf } from "../scripts/domain/work-signals/agent-work-signal.js";
import { agentWorkSummaryOf } from "../scripts/domain/work-signals/agent-work-summary.js";
import { latestWorkEvent } from "../scripts/domain/work-signals/latest-work-event.js";
import { agentWith, DAY_START, failedRun, NOW, testsWith } from "./support/work-fixtures.js";

describe("values read from the collector", () => {
  const counts = [[3, 3], [0, 0], ["248", null], ["", null], [-1, null], [2.5, null], [null, null], [undefined, null], [{}, null]];
  for (const [value, expected] of counts) {
    it(`read the count ${JSON.stringify(value) ?? "undefined"} as ${expected}`, () => assert.equal(countOf(value), expected));
  }

  it("read a time only from a finite number and a text only from a string with something in it", () => {
    assert.deepEqual([NOW, String(NOW), Number.NaN, Number.POSITIVE_INFINITY, null].map(timeOf), [NOW, null, null, null, null]);
    assert.deepEqual(["npm test", "", 3, null, ["x"]].map(textOf), ["npm test", null, null, null, null]);
  });
});

// The tag over the figure, the island's sheet, the tabs and the timeline read the same fields; each field has one rule, so
// none of them says something about an agent that another one denies.
describe("one reading of the agent's checklist and tests", () => {
  const claudeAgent = (fields) => agentWith({ source: "claude", ...fields });
  const tabOf = (agent, id) => workTabs(agent, "now").find((tab) => tab.id === id);

  it("counts an item with an unknown or missing status as still to do, in the tag and in the tab", () => {
    const agent = claudeAgent({ checklist: { items: [{ text: "a", status: "completed" }, { text: "b" }, { text: "c", status: 1 }] } });
    assert.equal(agentWorkSignalOf(agent, NOW).text, "1/3");
    assert.deepEqual(tabOf(agent, "todos").progress, { done: 1, total: 3 });
  });

  it("takes a count written as text as an unknown count, in the tag, the island and the tab", () => {
    const agent = claudeAgent({ tests: testsWith({ lastRun: failedRun("2", "248") }) });
    assert.equal(agentWorkSignalOf(agent, NOW).text, "testes falharam");
    assert.equal(agentWorkSummaryOf(agent).lastRun.text, "");
    assert.equal(testsOverview(agent.tests).lastRun.failed, null);
  });

  it("takes a run that does not say whether it passed as no run at all, everywhere", () => {
    const agent = claudeAgent({ tests: testsWith({ lastRun: { ...failedRun(2, 248), isOk: "false" } }) });
    assert.equal(agentWorkSignalOf(agent, NOW).kind, null);
    assert.equal(agentWorkSummaryOf(agent).lastRun.kind, null);
    assert.equal(testsOverview(agent.tests), null);
    assert.equal(tabOf(agent, "tests").hasAlert, false);
  });

  it("takes a running round without a start time as no round running, in the tag and in the tab", () => {
    const agent = claudeAgent({ tests: testsWith({ running: { command: "npm test", framework: null } }) });
    assert.equal(agentWorkSignalOf(agent, NOW).kind, null);
    assert.equal(testsOverview(agent.tests), null);
  });

  it("takes a list where a record should be as nothing, in the timeline too", () => {
    const nina = claudeAgent({ key: "claude:n1", name: "Nina", tests: testsWith({ lastRun: failedRun(2, 248) }), log: [{ at: NOW - 60_000, actionId: "tests-failed", subject: 2 }] });
    assert.equal(latestWorkEvent({ shop: { name: "loja", agents: [nina] } }, { dayStart: DAY_START }), null);
    assert.equal(agentWorkSignalOf(claudeAgent({ tests: [failedRun(2, 248)] }), NOW).kind, null);
    assert.equal(testsOverview([failedRun(2, 248)]), null);
  });
});
