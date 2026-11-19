import { agentMark, originOf } from "../view/office/agent-badges.js";
import { renderDrawerIdentity, renderDrawerShell, renderDrawerStatus } from "../view/sheet/agent-sheet-view.js";
import { createAgentPanel } from "./agent-panel.js";
import { createIslandPanel } from "./island-panel.js";
import { createPanelResizer } from "./panel-resizer.js";

const ESCAPE = "Escape";
const TYPING_TARGETS = 'textarea, input:not([type="radio"], [type="checkbox"])';
const FOLLOW_ACTION = '[data-action="follow"]';

const DRAWER_SHEET = {
  shell: (agent, context) => renderDrawerShell({
    agentName: agent.name, canReceiveMessages: context.canReceiveMessages, isLive: context.isLive, isFollowed: context.isFollowed,
  }),
  identity: (agent, context) => renderDrawerIdentity(agent, {
    mark: agentMark(agent), origin: originOf(agent), projectName: context.projectName, accountLabel: context.accountLabel,
  }),
  facts: (agent) => renderDrawerStatus(agent),
};

const isFocusable = (element) => Boolean(element?.isConnected) && !element.closest("[hidden]") && element.getClientRects().length > 0;

// A draft being typed survives Esc: only an empty field lets Esc close the drawer.
const isKeepingDraft = (target) => Boolean(target.closest?.(TYPING_TARGETS)) && target.value !== "";

// The drawer over the right of the map, as wide as the person drags it, showing the agent's sheet or the island's. Esc or the
// close button give the focus back to whoever opened it: the button pressed, the agent's tag on the map or the map itself.
// A sheet opened from inside the other one keeps the first opener, since the button pressed leaves with the sheet it was on.
// An opener may be a function that finds it again, for buttons in lists that are redrawn while the drawer is open.
export function createAgentDrawer({ drawer, control, map, onResize, island }) {
  const sheet = drawer.querySelector('[data-slot="sheet"]');
  let returnTo = null;
  let isSwitching = false;

  const resizer = createPanelResizer({ handle: drawer.querySelector("[data-drawer-resizer]"), side: drawer, workspace: drawer.parentElement, onResize });

  function giveFocusBack(closedKey) {
    const opener = typeof returnTo === "function" ? returnTo() : returnTo;
    const target = [opener, closedKey ? map.tagOf(closedKey) : null, map.element].find(isFocusable);
    returnTo = null;
    target?.focus();
  }

  function show(label) {
    drawer.setAttribute("aria-label", label);
    drawer.hidden = false;
    resizer.refresh();
  }

  function hide(closedKey = null) {
    if (isSwitching) return;
    drawer.hidden = true;
    onResize();
    giveFocusBack(closedKey);
  }

  const agentPanel = createAgentPanel({
    sheet,
    control,
    view: DRAWER_SHEET,
    onOpen: (agent) => show(`Ficha de ${agent.name}`),
    onClose: hide,
    actions: {
      follow: (agentKey) => (map.followedKey() === agentKey ? map.stopFollowing() : map.follow(agentKey)),
    },
  });

  const islandPanel = createIslandPanel({ sheet, control, onOpen: (facts) => show(`Ficha da ilha ${facts.name}`), onClose: () => hide(), ...island });

  function openWith(panel, opener) {
    isSwitching = true;
    for (const other of [agentPanel, islandPanel]) if (other !== panel) other.close();
    isSwitching = false;
    const isInsideDrawer = opener instanceof Element && drawer.contains(opener);
    if (!isInsideDrawer) returnTo = opener;
  }

  function open(agent, context, { opener = null, focus = "close" } = {}) {
    openWith(agentPanel, opener);
    agentPanel.open(agent, context, { focus });
  }

  function openIsland(facts, context, { opener = null } = {}) {
    openWith(islandPanel, opener);
    islandPanel.open(facts, context);
  }

  // A decided request leaves the sheet; whoever was answering it lands on the close button instead of the top of the page.
  function update(agent, context) {
    const hadFocus = sheet.contains(document.activeElement);
    agentPanel.update(agent, context);
    if (hadFocus && agentPanel.openAgentKey() && !sheet.contains(document.activeElement)) sheet.querySelector("[data-close]")?.focus();
  }

  function showFollowing(followedKey) {
    sheet.querySelector(FOLLOW_ACTION)?.setAttribute("aria-pressed", String(followedKey !== null && followedKey === agentPanel.openAgentKey()));
  }

  const isOpen = () => Boolean(agentPanel.openAgentKey() || islandPanel.openProjectKey());

  function close() {
    agentPanel.close();
    islandPanel.close();
  }

  document.addEventListener("keydown", (event) => {
    if (event.key !== ESCAPE || event.defaultPrevented || !isOpen()) return;
    const isInDrawer = drawer.contains(event.target);
    if (!isInDrawer && event.target !== document.body) return;
    if (isInDrawer && isKeepingDraft(event.target)) return;
    event.preventDefault();
    close();
  });

  return {
    open, update, close, openAgentKey: agentPanel.openAgentKey, showFollowing,
    openIsland, updateIsland: islandPanel.update, openProjectKey: islandPanel.openProjectKey,
  };
}
