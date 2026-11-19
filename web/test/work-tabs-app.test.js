import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { createWorkTabs } from "../scripts/app/work-tabs.js";
import { testsOverview } from "../scripts/domain/work-sheet/tests-overview.js";
import { agentWorkSignalOf } from "../scripts/domain/work-signals/agent-work-signal.js";
import { renderTestsTab } from "../scripts/view/sheet/tests-tab-view.js";
import { agentWith, NOW, SECOND, testsWith } from "./support/work-fixtures.js";

const PANELS = ["now", "todos", "plan", "tests"];
const ELAPSED = /data-elapsed-since="(\d+)"/g;

// Just enough of the drawer for the tabs: slots that keep the HTML they get, panels that hide, the clocks found in the tests
// slot's HTML, and the click handler, kept so a test can press a tab.
function fakeSheet() {
  const slots = Object.fromEntries(["work-tabs", ...PANELS].map((name) => [name, { innerHTML: "", contains: () => false, querySelector: () => null }]));
  const panels = PANELS.map((id) => ({ dataset: { workPanel: id }, hidden: id !== "now" }));
  const clocks = new Map();
  const handlers = {};
  const clocksIn = (html) => {
    if (!clocks.has(html)) clocks.set(html, [...html.matchAll(ELAPSED)].map(([, since]) => ({ dataset: { elapsedSince: since }, textContent: "" })));
    return clocks.get(html);
  };
  const sheet = {
    querySelector(selector) {
      const slot = /^\[data-slot="([\w-]+)"\]$/.exec(selector);
      return slot ? slots[slot[1]] ?? null : { focus() {} };
    },
    querySelectorAll(selector) {
      if (selector === "[data-work-panel]") return panels;
      if (selector === "[data-elapsed-since]") return clocksIn(slots.tests.innerHTML);
      throw new Error(`the fake sheet does not read ${selector}`);
    },
    addEventListener: (type, handler) => { handlers[type] = handler; },
  };
  const press = (id) => handlers.click({ target: { closest: () => ({ dataset: { workTab: id } }) } });
  const clockText = () => clocksIn(slots.tests.innerHTML)[0]?.textContent ?? null;
  return { sheet, slots, press, clockText };
}

function recordingView() {
  const planCalls = [];
  return {
    planCalls,
    tabs: (tabs) => tabs.map((tab) => `${tab.id}:${tab.isSelected}`).join(","),
    todos: () => "",
    plan: (agent, loaded) => {
      planCalls.push(loaded);
      return `${loaded.loading}:${loaded.text ?? ""}`;
    },
    tests: (agent, day) => renderTestsTab(testsOverview(agent.tests, day)),
  };
}

function deferredPlans() {
  const asked = [];
  return { asked, loadPlan: () => new Promise((resolve) => { asked.push(resolve); }) };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));
const planOf = (version, state = "proposed") => ({ version, state, proposedAt: NOW - version * SECOND, decidedAt: null, length: 10 });
const planner = (version) => agentWith({ key: "claude:p1", plan: planOf(version) });

describe("tabs of the agent's sheet, in the page", () => {
  let now;
  beforeEach(() => {
    now = NOW;
    globalThis.document = { activeElement: null };
    mock.timers.enable({ apis: ["setInterval"] });
  });
  afterEach(() => {
    mock.timers.reset();
    delete globalThis.document;
  });

  const tabsWith = (control) => {
    const fake = fakeSheet();
    const view = recordingView();
    const tabs = createWorkTabs({ sheet: fake.sheet, control, view, clockNow: () => now });
    return { ...fake, view, tabs };
  };

  it("ticks the clock of the running round every second, with the same text as the tag over the figure", () => {
    const { tabs, press, clockText } = tabsWith(deferredPlans());
    const runner = agentWith({ tests: testsWith({ running: { command: "npm test", framework: null, startedAt: NOW - 12_400 } }) });
    tabs.open(runner.key);
    tabs.render(runner);
    press("tests");
    const tagClock = () => agentWorkSignalOf(runner, now).text.replace("testando ", "");
    assert.deepEqual([clockText(), tagClock()], ["0:12", "0:12"]);
    now += SECOND;
    mock.timers.tick(SECOND);
    assert.deepEqual([clockText(), tagClock()], ["0:13", "0:13"]);
    tabs.close();
  });

  it("keeps the text of an older version that arrives late from taking the place of the version asked for after it", async () => {
    const plans = deferredPlans();
    const { tabs, press, slots } = tabsWith(plans);
    tabs.open("claude:p1");
    tabs.render(planner(1));
    press("plan");
    tabs.render(planner(2));
    assert.equal(plans.asked.length, 2);
    plans.asked[0]({ text: "# v1", version: 1, state: "proposed", proposedAt: NOW - SECOND, decidedAt: null });
    await settle();
    assert.equal(slots.plan.innerHTML, "loading:");
    plans.asked[1]({ text: "# v2", version: 2, state: "proposed", proposedAt: NOW - 2 * SECOND, decidedAt: null });
    await settle();
    assert.equal(slots.plan.innerHTML, "ready:# v2");
    tabs.close();
  });
});
