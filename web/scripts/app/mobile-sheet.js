import { movedCursor, TAB_KEYS } from "../domain/office/option-cursor.js";
import { isDismissedByDrag } from "../domain/shared/drag-dismiss.js";

const ESCAPE = "Escape";
const PANELS = { rooms: ".hq-rooms", day: ".hq-day", accounts: ".hq-accounts", legend: ".hq-legend" };
const DRAGGING_CLASS = "is-dragging";

// On a phone the room list, the day, the accounts and the legend leave the map and live in a bottom sheet with tabs, opened by
// a button and closed by its close button, Esc or a drag down. The panels are moved, not copied, so they keep updating as usual,
// and go back to their places when the screen grows past the phone width.
export function createMobileSheet({ hud, phoneQuery, onChange = () => {} }) {
  const sheet = hud.querySelector("[data-mobile-sheet]");
  const toggle = hud.querySelector("[data-sheet-toggle]");
  const tabs = [...sheet.querySelectorAll('[role="tab"]')];
  const homes = new Map();
  let drag = null;

  const panelOf = (name) => sheet.querySelector(`[data-tabpanel="${name}"]`);

  function bringPanelsIn() {
    for (const [name, selector] of Object.entries(PANELS)) {
      const panel = hud.querySelector(selector);
      if (!panel || panelOf(name).contains(panel)) continue;
      const placeholder = document.createComment(name);
      panel.before(placeholder);
      homes.set(panel, placeholder);
      panelOf(name).append(panel);
    }
  }

  function sendPanelsHome() {
    for (const [panel, placeholder] of homes) placeholder.replaceWith(panel);
    homes.clear();
  }

  function setOpen(isOpen, { focusTarget = null } = {}) {
    sheet.hidden = !isOpen;
    toggle.setAttribute("aria-expanded", String(isOpen));
    focusTarget?.focus();
    onChange();
  }

  const selectedTab = () => tabs.find((tab) => tab.getAttribute("aria-selected") === "true") ?? tabs[0];

  function open() {
    setOpen(true, { focusTarget: selectedTab() });
  }

  function close() {
    if (sheet.hidden) return;
    const hadFocus = sheet.contains(document.activeElement);
    setOpen(false, { focusTarget: hadFocus ? toggle : null });
  }

  function select(tab) {
    for (const candidate of tabs) {
      const isSelected = candidate === tab;
      candidate.setAttribute("aria-selected", String(isSelected));
      candidate.tabIndex = isSelected ? 0 : -1;
      panelOf(candidate.dataset.tab).hidden = !isSelected;
    }
    tab.focus();
  }

  function fitScreen() {
    if (phoneQuery.matches) bringPanelsIn();
    else {
      sheet.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
      sendPanelsHome();
    }
    onChange();
  }

  function startDrag(event) {
    drag = { pointerId: event.pointerId, startY: event.clientY, distance: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
    sheet.classList.add(DRAGGING_CLASS);
  }

  function moveDrag(event) {
    if (event.pointerId !== drag?.pointerId) return;
    drag.distance = Math.max(0, event.clientY - drag.startY);
    sheet.style.translate = `0 ${drag.distance}px`;
  }

  function endDrag(event) {
    if (event.pointerId !== drag?.pointerId) return;
    const isDismissed = isDismissedByDrag({ distance: drag.distance, sheetHeight: sheet.offsetHeight });
    drag = null;
    sheet.classList.remove(DRAGGING_CLASS);
    sheet.style.translate = "";
    if (isDismissed) setOpen(false, { focusTarget: sheet.contains(document.activeElement) ? toggle : null });
  }

  toggle.addEventListener("click", () => (sheet.hidden ? open() : close()));
  sheet.querySelector("[data-sheet-close]").addEventListener("click", close);
  sheet.addEventListener("keydown", (event) => {
    if (event.key === ESCAPE && !event.defaultPrevented) {
      event.preventDefault();
      close();
    }
  });
  for (const tab of tabs) tab.addEventListener("click", () => select(tab));
  sheet.querySelector('[role="tablist"]').addEventListener("keydown", (event) => {
    const next = movedCursor({ count: tabs.length, index: tabs.indexOf(event.target), key: event.key, keys: TAB_KEYS });
    if (next === null) return;
    event.preventDefault();
    select(tabs[next]);
  });
  const grip = sheet.querySelector("[data-sheet-grip]");
  grip.addEventListener("pointerdown", startDrag);
  grip.addEventListener("pointermove", moveDrag);
  grip.addEventListener("pointerup", endDrag);
  grip.addEventListener("pointercancel", endDrag);
  phoneQuery.addEventListener("change", fitScreen);
  fitScreen();

  return { close, isOpen: () => !sheet.hidden };
}
