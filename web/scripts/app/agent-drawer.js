import { agentMark, originOf } from "../view/office/agent-badges.js";
import { renderDrawerIdentity, renderDrawerShell, renderDrawerStatus } from "../view/sheet/agent-sheet-view.js";
import { createAgentPanel } from "./agent-panel.js";
import { createPanelResizer } from "./panel-resizer.js";

const ESCAPE = "Escape";
const TYPING_TARGETS = "input, textarea";
const FOLLOW_ACTION = '[data-action="follow"]';

const DRAWER_SHEET = {
  shell: (agent, context) => renderDrawerShell({
    agentName: agent.name, canReceiveMessages: context.canReceiveMessages, isLive: context.isLive, isFollowed: context.isFollowed,
  }),
  identity: (agent, context) => renderDrawerIdentity(agent, { mark: agentMark(agent), origin: originOf(agent), projectName: context.projectName }),
  facts: (agent) => renderDrawerStatus(agent),
};

const isFocusable = (element) => Boolean(element?.isConnected) && !element.closest("[hidden]") && element.getClientRects().length > 0;

// A draft being typed survives Esc: only an empty field lets Esc close the drawer.
const isKeepingDraft = (target) => Boolean(target.closest?.(TYPING_TARGETS)) && target.value !== "";

// The agent's sheet in a drawer over the right of the map, as wide as the person drags it. Esc or the close button give the focus
// back to whoever opened it: the button pressed, the agent's tag on the map or the map itself.
export function createAgentDrawer({ drawer, control, map, onResize }) {
  const sheet = drawer.querySelector('[data-slot="sheet"]');
  let returnTo = null;

  const resizer = createPanelResizer({ handle: drawer.querySelector("[data-drawer-resizer]"), side: drawer, workspace: drawer.parentElement, onResize });

  function giveFocusBack(closedKey) {
    const target = [returnTo, map.tagOf(closedKey), map.element].find(isFocusable);
    returnTo = null;
    target?.focus();
  }

  const panel = createAgentPanel({
    sheet,
    control,
    view: DRAWER_SHEET,
    onOpen: (agent) => {
      drawer.setAttribute("aria-label", `Ficha de ${agent.name}`);
      drawer.hidden = false;
      resizer.refresh();
    },
    onClose: (closedKey) => {
      drawer.hidden = true;
      onResize();
      giveFocusBack(closedKey);
    },
    actions: {
      follow: (agentKey) => (map.followedKey() === agentKey ? map.stopFollowing() : map.follow(agentKey)),
    },
  });

  function open(agent, context, { opener = null, focus = "close" } = {}) {
    returnTo = opener;
    panel.open(agent, context, { focus });
  }

  // A decided request leaves the sheet; whoever was answering it lands on the close button instead of the top of the page.
  function update(agent, context) {
    const hadFocus = sheet.contains(document.activeElement);
    panel.update(agent, context);
    if (hadFocus && panel.openAgentKey() && !sheet.contains(document.activeElement)) sheet.querySelector("[data-close]")?.focus();
  }

  function showFollowing(followedKey) {
    sheet.querySelector(FOLLOW_ACTION)?.setAttribute("aria-pressed", String(followedKey !== null && followedKey === panel.openAgentKey()));
  }

  document.addEventListener("keydown", (event) => {
    if (event.key !== ESCAPE || event.defaultPrevented || !panel.openAgentKey()) return;
    const isInDrawer = drawer.contains(event.target);
    if (!isInDrawer && event.target !== document.body) return;
    if (isInDrawer && isKeepingDraft(event.target)) return;
    event.preventDefault();
    panel.close();
  });

  return { open, update, close: panel.close, openAgentKey: panel.openAgentKey, showFollowing };
}
