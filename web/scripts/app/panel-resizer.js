import { readPreference, writePreference } from "../infra/local-preferences.js";

const WIDTH_KEY = "office.panelWidth";
const WIDTH_PROPERTY = "--panel-width";
const MIN_WIDTH = 320;
const MAX_SHARE_OF_WORKSPACE = 0.7;
const KEY_STEP = 24;
const KEY_DELTAS = { ArrowLeft: KEY_STEP, ArrowRight: -KEY_STEP };
const RESIZING_CLASS = "is-resizing-panel";

const readWidth = () => Number(readPreference(WIDTH_KEY)) || null;
const writeWidth = (width) => writePreference(WIDTH_KEY, width === null ? null : String(width));

export function createPanelResizer({ handle, side, workspace, onResize }) {
  const maxWidth = () => Math.max(MIN_WIDTH, Math.round(workspace.clientWidth * MAX_SHARE_OF_WORKSPACE));
  const clamp = (width) => Math.min(maxWidth(), Math.max(MIN_WIDTH, Math.round(width)));
  let pendingFrame = 0;

  function apply(width) {
    if (width === null) workspace.style.removeProperty(WIDTH_PROPERTY);
    else workspace.style.setProperty(WIDTH_PROPERTY, `${width}px`);
    handle.setAttribute("aria-valuemin", String(MIN_WIDTH));
    handle.setAttribute("aria-valuemax", String(maxWidth()));
    handle.setAttribute("aria-valuenow", String(Math.round(side.getBoundingClientRect().width)));
    onResize();
  }

  function settle(width) {
    apply(width);
    writeWidth(width);
  }

  let endDrag = null;

  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    endDrag?.();
    const startX = event.clientX;
    const startWidth = side.getBoundingClientRect().width;
    const listeners = new AbortController();
    let width = startWidth;

    endDrag = () => {
      listeners.abort();
      endDrag = null;
      cancelAnimationFrame(pendingFrame);
      pendingFrame = 0;
      document.documentElement.classList.remove(RESIZING_CLASS);
      settle(width);
    };
    const move = (moveEvent) => {
      width = clamp(startWidth + startX - moveEvent.clientX);
      if (pendingFrame) return;
      pendingFrame = requestAnimationFrame(() => {
        pendingFrame = 0;
        apply(width);
      });
    };

    handle.setPointerCapture(event.pointerId);
    document.documentElement.classList.add(RESIZING_CLASS);
    handle.addEventListener("pointermove", move, { signal: listeners.signal });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
      handle.addEventListener(type, () => endDrag?.(), { signal: listeners.signal });
    }
  });

  handle.addEventListener("dblclick", () => settle(null));

  handle.addEventListener("keydown", (event) => {
    const delta = KEY_DELTAS[event.key];
    if (!delta) return;
    event.preventDefault();
    settle(clamp(side.getBoundingClientRect().width + delta));
  });

  const saved = readWidth();
  apply(saved === null ? null : clamp(saved));
}
