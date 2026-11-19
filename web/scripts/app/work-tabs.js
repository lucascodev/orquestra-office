import { movedCursor, TAB_KEYS } from "../domain/office/option-cursor.js";
import { localDayStart } from "../domain/shared/local-day-start.js";
import { planDocument } from "../domain/work-sheet/plan-document.js";
import { planStatus } from "../domain/work-sheet/plan-status.js";
import { runningElapsedMs } from "../domain/work-sheet/running-elapsed.js";
import { FIRST_TAB, workTabs } from "../domain/work-sheet/work-tabs.js";
import { formatCountdown } from "../view/shared/format.js";

const CLOCK_TICK_MS = 1_000;
const PLAN_TAB = "plan";
const LOAD = { loading: "loading", failed: "failed", missing: "missing", ready: "ready" };
const NO_PLAN_LOADED = { agentKey: null, stamp: null, loading: LOAD.loading, text: null };
const TAB_SELECTOR = "[data-work-tab]";

// The tabs of the agent's sheet: which one is open, the panels drawn from the agent, the plan text fetched only when its tab
// opens (and again when the stream says the plan changed), and the clock of a running round, which ticks on its own.
export function createWorkTabs({ sheet, control, view, clockNow }) {
  const rendered = new WeakMap();
  let wanted = FIRST_TAB;
  let shownAgentKey = null;
  let agent = null;
  let plan = NO_PLAN_LOADED;
  let clock = 0;

  const slot = (name) => sheet.querySelector(`[data-slot="${name}"]`);

  function setHtml(element, html) {
    if (!element || rendered.get(element) === html) return false;
    rendered.set(element, html);
    element.innerHTML = html;
    return true;
  }

  function showElapsed() {
    const now = clockNow();
    for (const shown of sheet.querySelectorAll("[data-elapsed-since]")) {
      const elapsed = runningElapsedMs(Number(shown.dataset.elapsedSince), now);
      shown.textContent = elapsed === null ? "" : formatCountdown(elapsed);
    }
  }

  function showTabs(current) {
    const list = slot("work-tabs");
    const focusedTab = list.contains(document.activeElement) ? document.activeElement.dataset.workTab : null;
    const tabs = workTabs(current, wanted);
    const wasRedrawn = setHtml(list, view.tabs(tabs));
    if (wasRedrawn && focusedTab) list.querySelector(`[data-work-tab="${focusedTab}"]`)?.focus();
    const selected = tabs.find((tab) => tab.isSelected)?.id ?? FIRST_TAB;
    for (const panel of sheet.querySelectorAll("[data-work-panel]")) panel.hidden = panel.dataset.workPanel !== selected;
    return selected;
  }

  function showPanels(current) {
    setHtml(slot("todos"), view.todos(current));
    setHtml(slot("plan"), view.plan(current, plan.agentKey === current.key ? plan : NO_PLAN_LOADED));
    setHtml(slot("tests"), view.tests(current, { dayStart: localDayStart(clockNow()) }));
    showElapsed();
  }

  function loadOutcome(response) {
    if (response === null) return { loading: LOAD.failed, text: null };
    const fetched = planDocument(response);
    return fetched ? { loading: LOAD.ready, text: fetched.text } : { loading: LOAD.missing, text: null };
  }

  async function refreshPlan(current) {
    const status = planStatus(current.plan);
    if (!status) return;
    const isCurrent = plan.agentKey === current.key && plan.stamp === status.stamp;
    if (isCurrent && plan.loading !== LOAD.failed) return;
    const asked = { ...NO_PLAN_LOADED, agentKey: current.key, stamp: status.stamp };
    plan = asked;
    const response = await control.loadPlan(current).catch(() => null);
    if (plan !== asked) return;
    plan = { ...asked, ...loadOutcome(response) };
    if (agent?.key === asked.agentKey) showPanels(agent);
  }

  function render(current) {
    agent = current;
    if (!slot("work-tabs")) return;
    const selected = showTabs(current);
    showPanels(current);
    if (selected === PLAN_TAB) refreshPlan(current);
  }

  function select(id) {
    wanted = id;
    if (agent) render(agent);
    sheet.querySelector(`[data-work-tab="${id}"]`)?.focus();
  }

  function open(agentKey) {
    if (agentKey !== shownAgentKey) wanted = FIRST_TAB;
    shownAgentKey = agentKey;
    clearInterval(clock);
    clock = setInterval(showElapsed, CLOCK_TICK_MS);
  }

  function close() {
    clearInterval(clock);
    agent = null;
  }

  sheet.addEventListener("click", (event) => {
    const tab = event.target.closest(TAB_SELECTOR);
    if (tab) select(tab.dataset.workTab);
  });

  sheet.addEventListener("keydown", (event) => {
    const tab = event.target.closest?.(TAB_SELECTOR);
    if (!tab) return;
    const tabs = [...sheet.querySelectorAll(TAB_SELECTOR)];
    const next = movedCursor({ count: tabs.length, index: tabs.indexOf(tab), key: event.key, keys: TAB_KEYS });
    if (next === null) return;
    event.preventDefault();
    select(tabs[next].dataset.workTab);
  });

  return { open, render, close };
}
