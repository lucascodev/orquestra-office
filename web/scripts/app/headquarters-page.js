import { KEY_ZOOM_FACTOR } from "../domain/camera/camera-commands.js";
import { alertPlacement, insetsAroundPanels } from "../domain/camera/frame-insets.js";
import { areaBounds, projectBounds } from "../domain/camera/frame-target.js";
import { layoutHeadquarters } from "../domain/headquarters/headquarters-layout.js";
import { accountUsage, agentAccountLabel } from "../domain/office/account-usage.js";
import { withBuildingAgentNames } from "../domain/office/agent-names.js";
import { areaCensus } from "../domain/office/area-census.js";
import { canReceiveMessages } from "../domain/office/can-receive-messages.js";
import { dayTimeline } from "../domain/office/day-timeline.js";
import { islandFacts } from "../domain/office/island-facts.js";
import { serverClockNow } from "../domain/office/pending-queue.js";
import { searchEntries } from "../domain/office/search-entries.js";
import { localDayStart } from "../domain/shared/local-day-start.js";
import { ownValueOf } from "../domain/shared/own-value.js";
import { latestWorkEvent } from "../domain/work-signals/latest-work-event.js";
import { renderAccounts } from "../view/hud/accounts-view.js";
import { renderAreaList } from "../view/hud/area-list-view.js";
import { followingStoppedText, renderCameraControls, renderFollowing } from "../view/hud/camera-controls-view.js";
import { renderConnection } from "../view/hud/connection-view.js";
import { renderDayTimeline } from "../view/hud/day-timeline-view.js";
import { requestsButtonLabel } from "../view/hud/pending-alert-view.js";
import { renderLegend } from "../view/hud/legend-view.js";
import { renderUnpaired } from "../view/office/pairing-view.js";
import { renderSecurityNotice } from "../view/office/security-notice-view.js";
import { createAgentDrawer } from "./agent-drawer.js";
import { createCommandPalette } from "./command-palette.js";
import { createMinimap } from "./minimap.js";
import { createMobileSheet } from "./mobile-sheet.js";
import { createPendingAlert } from "./pending-alert.js";

const CENSUS_REFRESH_MS = 2_000;
const ANNOUNCE_DELAY_MS = 100;
const LOWERED_ALERT_GAP_PX = 8;
const NOTICE_GAP_PX = 8;
const DAY_REFRESH_MS = 30_000;
const FOCUS_KEYS = ["project", "area", "frame", "agent"];
const DOCKED_PANELS = {
  left: [".hq-rooms", ".hq-legend"],
  right: [".hq-drawer"],
  top: [".hq-capsule", ".hq-search-button", ".hq-alert", ".hq-accounts"],
  bottom: [".hq-day", ".hq-camera"],
};
// On a phone only the top bar and the request card stay over the map; the drawer and the open sheet cover it whole.
const PHONE_DOCKED_PANELS = {
  top: [".hq-capsule"],
  bottom: [".hq-alert", ".hq-sheet-toggle"],
};
const PHONE_QUERY = "(max-width: 719px)";
const FLOATING_PANELS = ".hq-panel, .hq-alert, .hq-sheet-panel";
const EMPTY_STATE = {
  mode: "connecting", projects: {}, pending: [], outbox: {}, usage: null, accounts: null, timeline: null, generatedAt: null, security: null,
  runner: { isAvailable: false, liveAgents: {} },
};
const UNPAIRED_MODE = "unpaired";
const LIVE_MODE = "live";
const MODES_WITH_DEVICES = new Set([LIVE_MODE, "demo"]);

const NO_MAP = { element: null, followedKey: () => null, follow: () => {}, stopFollowing: () => {}, tagOf: () => null };
const WHOLE_ROOM = { kind: "whole", id: "whole" };
const ROOM_ATTRIBUTE = { whole: "frame", project: "project", area: "area" };
const APPLE_PLATFORM = /mac|iphone|ipad/i;
const APPLE_SEARCH_KEYS = "⌘ K";

function focusSelectorOf(element) {
  const key = FOCUS_KEYS.find((name) => element.dataset[name] !== undefined);
  return key ? `[data-${key}="${CSS.escape(element.dataset[key])}"]` : null;
}

const isApplePlatform = () => APPLE_PLATFORM.test(navigator.userAgentData?.platform ?? navigator.platform ?? "");
const roomSelectorOf = (room) => `[data-${ROOM_ATTRIBUTE[room.kind]}="${CSS.escape(room.id)}"]`;

function roomOfButton(button) {
  if (button.dataset.project !== undefined) return { kind: "project", id: button.dataset.project };
  if (button.dataset.area !== undefined) return { kind: "area", id: button.dataset.area };
  return WHOLE_ROOM;
}

// The floating panels around the full-window map: they read the state and tell the map where it is free to frame.
export function createHeadquartersPage({ hud, headquarters, source, newSessionDialog, devicesDialog, isOnThisMachine }) {
  const slot = (name) => hud.querySelector(`[data-slot="${name}"]`);
  const rooms = slot("rooms");
  const notice = slot("notice");
  // Held from the start: on a phone the panel moves after the drawer, where the island's sheet has a slot of the same name.
  const dayPanel = slot("day");
  const devicesButton = hud.querySelector("[data-open-devices]");
  const newSessionButton = hud.querySelector("[data-new-session]");
  const runnerOff = hud.querySelector("[data-runner-off]");
  const requestsButton = hud.querySelector("[data-requests]");
  const phoneQuery = window.matchMedia(PHONE_QUERY);
  const renderedHtml = new WeakMap();
  let state = EMPTY_STATE;
  let receivedAt = null;
  let awaitedAgentKey = null;
  // Redrawing the list between press and release would swap the button under the pointer and swallow the click.
  let isPressing = false;
  let hasDeferredRooms = false;
  let currentRoom = WHOLE_ROOM;
  let focusedProjectKey = null;

  const clockNow = () => serverClockNow({ localNow: Date.now(), generatedAt: state.generatedAt, receivedAt });
  const layoutNow = () => headquarters?.layoutShown() ?? layoutHeadquarters(state.projects);
  const censusNow = () => areaCensus({ layout: layoutNow(), projects: state.projects, stops: headquarters?.destinations() ?? new Map() });

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
    keepingFocus(rooms, () => setHtml(rooms, renderAreaList(censusNow(), currentRoom)));
  }

  function renderDay() {
    const now = clockNow();
    const dayStart = localDayStart(now);
    keepingFocus(dayPanel, () => setHtml(dayPanel, renderDayTimeline(dayTimeline(state.timeline, { now, dayStart }), latestWorkEvent(state.projects, { dayStart }))));
  }

  // Not paired, the page says how to pair; paired and live, it warns about old hooks or a missing secret.
  function noticeHtml() {
    if (state.mode === UNPAIRED_MODE) return renderUnpaired({ isOnThisMachine, isSecretMissing: state.security?.isSecretMissing === true });
    return state.mode === LIVE_MODE ? renderSecurityNotice(state.security) : "";
  }

  function renderNotice() {
    const html = noticeHtml();
    setHtml(notice, html);
    notice.hidden = html === "";
    notice.classList.toggle("is-blocking", state.mode === UNPAIRED_MODE);
    placeNotice();
  }

  function renderRequestsButton() {
    const count = state.pending.length;
    requestsButton.querySelector("[data-requests-count]").textContent = String(count);
    requestsButton.setAttribute("aria-label", requestsButtonLabel(count));
    requestsButton.setAttribute("aria-disabled", String(count === 0));
  }

  function render() {
    setHtml(slot("connection"), renderConnection(state.mode));
    devicesButton.hidden = !MODES_WITH_DEVICES.has(state.mode);
    renderNotice();
    renderRequestsButton();
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
    openAgent(awaitedAgentKey);
    awaitedAgentKey = null;
  }

  function findAgent(agentKey) {
    const project = Object.values(state.projects).find((candidate) => Object.hasOwn(candidate.agents, agentKey));
    return project ? { agent: project.agents[agentKey], project } : null;
  }

  function drawerContext({ agent, project }) {
    const liveStatus = state.runner.liveAgents[agent.key] ?? null;
    return {
      request: state.pending.find((request) => request.agentKey === agent.key) ?? null,
      queued: state.outbox[agent.key] ?? 0,
      liveStatus,
      canReceiveMessages: Boolean(liveStatus) || canReceiveMessages(agent),
      projectName: project.name,
      accountLabel: agentAccountLabel({ accounts: state.accounts, accountId: agent.accountId }),
      isFollowed: headquarters?.followedKey() === agent.key,
    };
  }

  function openAgent(agentKey, { opener = null, focus = "close" } = {}) {
    const found = findAgent(agentKey);
    if (!found) return;
    focusedProjectKey = found.project.key;
    drawer.open(found.agent, drawerContext(found), { opener, focus });
  }

  const openAgentFromMap = (agentKey) => openAgent(agentKey, { opener: headquarters?.tagOf(agentKey) });

  const islandFactsOf = (projectKey) => (Object.hasOwn(state.projects, projectKey) ? islandFacts(state.projects[projectKey], state.outbox) : null);
  const islandContext = () => ({ canOpenSession: state.runner.isAvailable });
  const suggestedFolder = () => (focusedProjectKey && Object.hasOwn(state.projects, focusedProjectKey) ? focusedProjectKey : "");

  function openIsland(projectKey, opener) {
    const facts = islandFactsOf(projectKey);
    if (!facts) return;
    focusedProjectKey = projectKey;
    drawer.openIsland(facts, islandContext(), { opener });
    fitMapBetweenPanels();
  }

  function updateDrawer() {
    const openIslandKey = drawer.openProjectKey();
    if (openIslandKey) drawer.updateIsland(islandFactsOf(openIslandKey), islandContext());
    const openKey = drawer.openAgentKey();
    if (!openKey) return;
    const found = findAgent(openKey);
    drawer.update(found?.agent ?? null, found ? drawerContext(found) : null);
  }

  function receive(next) {
    receivedAt = Date.now();
    state = { ...next, projects: withBuildingAgentNames(next.projects) };
    headquarters?.show(state.projects, state.outbox);
    render();
    pendingAlert.update(state);
    updateDrawer();
    palette.refresh();
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
    onOpenAgent: (agentKey, button) => openAgent(agentKey, { opener: button, focus: "request" }),
  });

  const drawer = createAgentDrawer({
    drawer: slot("drawer"), control: source, map: headquarters ?? NO_MAP, onResize: () => fitMapBetweenPanels(), clockNow,
    island: {
      announce,
      onOpenAgent: (agentKey, button) => openAgent(agentKey, { opener: button }),
      onNewSession: (projectKey) => newSessionDialog.show(projectKey),
    },
  });

  function frameRoom(room) {
    if (!headquarters) return;
    if (room.kind === "whole") headquarters.frameWhole();
    if (room.kind === "project") headquarters.frame(projectBounds(layoutNow(), room.id));
    if (room.kind === "area") headquarters.frame(areaBounds(layoutNow(), room.id));
  }

  // The island's sheet looks the list button up again when it closes, since the list is redrawn every few seconds.
  function goToRoom(room, opener = null) {
    currentRoom = room;
    if (room.kind === "whole") focusedProjectKey = null;
    renderRooms();
    if (room.kind === "project") openIsland(room.id, opener ?? (() => rooms.querySelector(roomSelectorOf(room))));
    else mobileSheet.close();
    frameRoom(room);
  }

  const searchEntriesNow = () => searchEntries({
    projects: state.projects, census: censusNow(), pendingCount: state.pending.length,
    isRunnerAvailable: state.runner.isAvailable, isFollowing: Boolean(headquarters?.followedKey()),
  });

  function goToCommonRoom(areaId) {
    const room = { kind: "area", id: areaId };
    goToRoom(room);
    rooms.querySelector(roomSelectorOf(room))?.focus();
  }

  const SEARCH_ACTIONS = {
    "go-to-request": () => {
      const alertElement = slot("alert");
      if (!alertElement.hidden) alertElement.focus();
    },
    "new-session": () => newSessionDialog.show(suggestedFolder()),
    "frame-whole": () => {
      goToRoom(WHOLE_ROOM);
      headquarters?.element.focus();
    },
    "stop-following": () => headquarters?.stopFollowing(),
  };

  // An agent opens in the drawer with the camera following it; a room is framed as from the list; an action does its thing.
  const SEARCH_CHOICES = {
    agent: ({ id }, opener) => {
      openAgent(id, { opener });
      fitMapBetweenPanels();
      headquarters?.follow(id);
    },
    room: ({ id, room }) => (room === "project" ? goToRoom({ kind: "project", id }) : goToCommonRoom(id)),
    action: ({ id }) => ownValueOf(SEARCH_ACTIONS, id)?.(),
  };

  const palette = createCommandPalette({
    dialog: slot("search"),
    entries: searchEntriesNow,
    onChoose: (choice, opener) => ownValueOf(SEARCH_CHOICES, choice.kind)?.(choice, opener),
  });

  function cameraMovedByHand() {
    if (!currentRoom) return;
    currentRoom = null;
    renderRooms();
  }

  const CAMERA_ACTIONS = {
    in: () => headquarters?.zoomAtCenter(KEY_ZOOM_FACTOR),
    out: () => headquarters?.zoomAtCenter(1 / KEY_ZOOM_FACTOR),
    whole: () => goToRoom(WHOLE_ROOM),
    unfollow: () => headquarters?.stopFollowing(),
  };

  const cameraPanel = slot("camera");
  cameraPanel.innerHTML = renderCameraControls();
  const following = cameraPanel.querySelector('[data-slot="following"]');
  const minimap = createMinimap({ canvas: cameraPanel.querySelector("[data-minimap]"), onPick: (point) => headquarters?.centerOn(point) });
  let followedName = null;

  // Says who the camera follows next to its buttons, and out loud when it stops, since a drag or a room button ends it.
  function showFollowing(followedKey) {
    drawer.showFollowing(followedKey);
    if (followedKey) cameraMovedByHand();
    const name =followedKey ? findAgent(followedKey)?.agent.name ?? null : null;
    if (name === followedName) return;
    if (!name && followedName) announce(followingStoppedText(followedName));
    followedName = name;
    const hadFocus = following.contains(document.activeElement);
    following.innerHTML = name ? renderFollowing(name) : "";
    following.hidden = !name;
    if (hadFocus) headquarters?.element.focus();
  }

  function visibleRectsOf(selectors) {
    return selectors.map((selector) => hud.querySelector(selector))
      .filter((element) => element && !element.hidden && element.offsetParent !== null)
      .map((element) => element.getBoundingClientRect());
  }

  // Placed from the brand and the accounts alone, which never move with it, so this never flips back and forth.
  // On a phone the style sheet keeps it as a card at the bottom.
  function placeAlert() {
    const alertElement = slot("alert");
    if (alertElement.hidden) return;
    if (phoneQuery.matches) {
      Object.assign(alertElement.style, { top: "", left: "", width: "", translate: "" });
      return;
    }
    const [capsule = null] = visibleRectsOf([".hq-capsule"]);
    const [besideAccounts = null] = visibleRectsOf([".hq-accounts"]);
    const accounts = besideAccounts && capsule && besideAccounts.top < capsule.bottom ? besideAccounts : null;
    const placement = alertPlacement({ viewportWidth: hud.clientWidth, left: capsule, right: accounts });
    const rowBottom = Math.max(capsule?.bottom ?? 0, accounts?.bottom ?? 0);
    Object.assign(alertElement.style, placement.isLowered
      ? { top: `${rowBottom + LOWERED_ALERT_GAP_PX}px`, left: "", width: "", translate: "" }
      : { top: "", left: `${placement.left}px`, width: `${placement.width}px`, translate: "none" });
  }

  // Both live at the top centre; under a request the notice moves below it instead of hiding behind it.
  function placeNotice() {
    const alertElement = slot("alert");
    const isUnderAlert = !notice.hidden && !alertElement.hidden && !phoneQuery.matches && state.mode !== UNPAIRED_MODE;
    const alertBottom = alertElement.getBoundingClientRect().bottom - hud.getBoundingClientRect().top;
    notice.style.top = isUnderAlert ? `${alertBottom + NOTICE_GAP_PX}px` : "";
  }

  function fitMapBetweenPanels() {
    placeAlert();
    placeNotice();
    if (!headquarters) return;
    const stage = headquarters.element.getBoundingClientRect();
    const panels = phoneQuery.matches ? PHONE_DOCKED_PANELS : DOCKED_PANELS;
    const docked = Object.fromEntries(Object.entries(panels).map(([edge, selectors]) => [edge, visibleRectsOf(selectors)]));
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
    if (button) goToRoom(roomOfButton(button));
  });
  dayPanel.addEventListener("click", (event) => {
    const button = event.target.closest("[data-agent]");
    if (!button) return;
    mobileSheet.close();
    openAgent(button.dataset.agent, { opener: button });
    fitMapBetweenPanels();
  });
  cameraPanel.addEventListener("click", (event) => {
    const button = event.target.closest("[data-camera]");
    if (button) CAMERA_ACTIONS[button.dataset.camera]?.();
  });
  newSessionButton.addEventListener("click", () => newSessionDialog.show(suggestedFolder()));
  devicesButton.addEventListener("click", () => devicesDialog.show());
  hud.querySelector("[data-open-search]").addEventListener("click", palette.open);
  const mobileSheet = createMobileSheet({ hud, phoneQuery, onChange: () => fitMapBetweenPanels() });
  requestsButton.addEventListener("click", () => {
    const alertElement = slot("alert");
    if (alertElement.hidden) return;
    mobileSheet.close();
    alertElement.focus();
  });
  if (isApplePlatform()) hud.querySelector("[data-search-keys]").textContent = APPLE_SEARCH_KEYS;

  setHtml(slot("legend"), renderLegend());
  const panelWatcher = new ResizeObserver(fitMapBetweenPanels);
  for (const element of [hud, ...hud.querySelectorAll(FLOATING_PANELS)]) panelWatcher.observe(element);
  setInterval(renderRooms, CENSUS_REFRESH_MS);
  setInterval(renderDay, DAY_REFRESH_MS);
  render();

  return {
    receive, awaitAgent, openAgentFromMap, showFollowing, showView: minimap.draw,
    openIslandFromMap: (projectKey) => goToRoom({ kind: "project", id: projectKey }, headquarters?.element),
    cameraMovedByHand, refitMap: fitMapBetweenPanels, clockNow, state: () => state,
  };
}
