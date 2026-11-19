import { KEY_ZOOM_FACTOR } from "../domain/camera/camera-commands.js";
import { alertPlacement, insetsAroundPanels } from "../domain/camera/frame-insets.js";
import { areaBounds, projectBounds } from "../domain/camera/frame-target.js";
import { layoutHeadquarters } from "../domain/headquarters/headquarters-layout.js";
import { accountUsage } from "../domain/office/account-usage.js";
import { withBuildingAgentNames } from "../domain/office/agent-names.js";
import { areaCensus } from "../domain/office/area-census.js";
import { dayTimeline } from "../domain/office/day-timeline.js";
import { serverClockNow } from "../domain/office/pending-queue.js";
import { renderAccounts } from "../view/hud/accounts-view.js";
import { renderAreaList } from "../view/hud/area-list-view.js";
import { renderConnection } from "../view/hud/connection-view.js";
import { renderDayTimeline } from "../view/hud/day-timeline-view.js";
import { renderLegend } from "../view/hud/legend-view.js";
import { createPendingAlert } from "./pending-alert.js";

const CENSUS_REFRESH_MS = 2_000;
const ANNOUNCE_DELAY_MS = 100;
const LOWERED_ALERT_GAP_PX = 8;
const DAY_REFRESH_MS = 30_000;
const FOCUS_KEYS = ["project", "area", "frame"];
const DOCKED_PANELS = {
  left: [".hq-rooms", ".hq-legend"],
  right: [],
  top: [".hq-capsule", ".hq-alert", ".hq-accounts"],
  bottom: [".hq-day", ".hq-camera"],
};
const EMPTY_STATE = {
  mode: "connecting", projects: {}, pending: [], outbox: {}, usage: null, accounts: null, timeline: null, generatedAt: null,
  runner: { isAvailable: false, liveAgents: {} },
};

const startOfDay = (ms) => new Date(ms).setHours(0, 0, 0, 0);

function focusSelectorOf(element) {
  const key = FOCUS_KEYS.find((name) => element.dataset[name] !== undefined);
  return key ? `[data-${key}="${CSS.escape(element.dataset[key])}"]` : null;
}

// The floating panels around the full-window map: they read the state and tell the map where it is free to frame.
export function createHeadquartersPage({ hud, headquarters, source, newSessionDialog }) {
  const slot = (name) => hud.querySelector(`[data-slot="${name}"]`);
  const rooms = slot("rooms");
  const newSessionButton = hud.querySelector("[data-new-session]");
  const runnerOff = hud.querySelector("[data-runner-off]");
  const renderedHtml = new WeakMap();
  let state = EMPTY_STATE;
  let receivedAt = null;
  let awaitedAgentKey = null;
  // Redrawing the list between press and release would swap the button under the pointer and swallow the click.
  let isPressing = false;
  let hasDeferredRooms = false;

  const clockNow = () => serverClockNow({ localNow: Date.now(), generatedAt: state.generatedAt, receivedAt });
  const layoutNow = () => headquarters?.layoutShown() ?? layoutHeadquarters(state.projects);

  function setHtml(element, html) {
    if (renderedHtml.get(element) === html) return;
    renderedHtml.set(element, html);
    element.innerHTML = html;
  }

  function keepingFocus(container, update) {
    const focused = container.contains(document.activeElement) ? document.activeElement : null;
    const selector = focused ? focusSelectorOf(focused) : null;
    update();
    if (selector && !focused.isConnected) container.querySelector(selector)?.focus();
  }

  function renderRooms() {
    if (isPressing) {
      hasDeferredRooms = true;
      return;
    }
    const census = areaCensus({ layout: layoutNow(), projects: state.projects, stops: headquarters?.destinations() ?? new Map() });
    keepingFocus(rooms, () => setHtml(rooms, renderAreaList(census)));
  }

  function renderDay() {
    const now = clockNow();
    setHtml(slot("day"), renderDayTimeline(dayTimeline(state.timeline, { now, dayStart: startOfDay(now) })));
  }

  function render() {
    setHtml(slot("connection"), renderConnection(state.mode));
    setHtml(slot("accounts"), renderAccounts(accountUsage(state)));
    newSessionButton.hidden = !state.runner.isAvailable;
    runnerOff.hidden = state.mode !== "live" || state.runner.isAvailable;
    renderRooms();
    renderDay();
  }

  function followArrival() {
    if (!awaitedAgentKey || !headquarters) return;
    const isHere = Object.values(state.projects).some((project) => Object.hasOwn(project.agents, awaitedAgentKey));
    if (!isHere) return;
    headquarters.follow(awaitedAgentKey);
    awaitedAgentKey = null;
  }

  function receive(next) {
    receivedAt = Date.now();
    state = { ...next, projects: withBuildingAgentNames(next.projects) };
    headquarters?.show(state.projects);
    render();
    pendingAlert.update(state);
    followArrival();
  }

  function awaitAgent(agentKey) {
    awaitedAgentKey = agentKey;
    followArrival();
  }

  // Emptied first and filled a moment later, so the same sentence twice in a row is still read out.
  function announce(text) {
    const announcer = slot("announcer");
    announcer.textContent = "";
    setTimeout(() => { announcer.textContent = text; }, ANNOUNCE_DELAY_MS);
  }

  const pendingAlert = createPendingAlert({
    element: slot("alert"), announce, control: source, clockNow, onLeave: () => headquarters?.element.focus(),
  });

  function frameRoom(button) {
    if (!headquarters) return;
    if (button.dataset.frame !== undefined) headquarters.frameWhole();
    if (button.dataset.project !== undefined) headquarters.frame(projectBounds(layoutNow(), button.dataset.project));
    if (button.dataset.area !== undefined) headquarters.frame(areaBounds(layoutNow(), button.dataset.area));
  }

  const CAMERA_ACTIONS = {
    in: () => headquarters?.zoomAtCenter(KEY_ZOOM_FACTOR),
    out: () => headquarters?.zoomAtCenter(1 / KEY_ZOOM_FACTOR),
    whole: () => headquarters?.frameWhole(),
  };

  function visibleRectsOf(selectors) {
    return selectors.map((selector) => hud.querySelector(selector))
      .filter((element) => element && !element.hidden && element.offsetParent !== null)
      .map((element) => element.getBoundingClientRect());
  }

  // Placed from the brand and the accounts alone, which never move with it, so this never flips back and forth.
  function placeAlert() {
    const alertElement = slot("alert");
    if (alertElement.hidden) return;
    const [capsule = null] = visibleRectsOf([".hq-capsule"]);
    const [besideAccounts = null] = visibleRectsOf([".hq-accounts"]);
    const accounts = besideAccounts && capsule && besideAccounts.top < capsule.bottom ? besideAccounts : null;
    const placement = alertPlacement({ viewportWidth: hud.clientWidth, left: capsule, right: accounts });
    const rowBottom = Math.max(capsule?.bottom ?? 0, accounts?.bottom ?? 0);
    Object.assign(alertElement.style, placement.isLowered
      ? { top: `${rowBottom + LOWERED_ALERT_GAP_PX}px`, left: "", width: "", translate: "" }
      : { top: "", left: `${placement.left}px`, width: `${placement.width}px`, translate: "none" });
  }

  function fitMapBetweenPanels() {
    placeAlert();
    if (!headquarters) return;
    const stage = headquarters.element.getBoundingClientRect();
    const docked = Object.fromEntries(Object.entries(DOCKED_PANELS).map(([edge, selectors]) => [edge, visibleRectsOf(selectors)]));
    headquarters.setFrameInsets(insetsAroundPanels({ width: stage.width, height: stage.height }, docked));
  }

  function releasePress() {
    isPressing = false;
    if (!hasDeferredRooms) return;
    hasDeferredRooms = false;
    setTimeout(renderRooms);
  }

  rooms.addEventListener("pointerdown", () => { isPressing = true; });
  window.addEventListener("pointerup", releasePress);
  window.addEventListener("pointercancel", releasePress);
  rooms.addEventListener("click", (event) => {
    const button = event.target.closest("[data-project], [data-area], [data-frame]");
    if (button) frameRoom(button);
  });
  hud.querySelector(".hq-camera").addEventListener("click", (event) => {
    const button = event.target.closest("[data-camera]");
    if (button) CAMERA_ACTIONS[button.dataset.camera]?.();
  });
  newSessionButton.addEventListener("click", () => newSessionDialog.show(""));

  setHtml(slot("legend"), renderLegend());
  const panelWatcher = new ResizeObserver(fitMapBetweenPanels);
  for (const element of [hud, ...hud.querySelectorAll(".hq-panel, .hq-alert")]) panelWatcher.observe(element);
  setInterval(renderRooms, CENSUS_REFRESH_MS);
  setInterval(renderDay, DAY_REFRESH_MS);
  render();

  return { receive, awaitAgent, refitMap: fitMapBetweenPanels, clockNow, state: () => state };
}
