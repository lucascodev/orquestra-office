import { cameraCommandFor, wheelZoomFactor } from "../../domain/camera/camera-commands.js";

const DRAG_THRESHOLD_PX = 4;
const PRIMARY_BUTTON = 0;
const TAG = ".name-tag";

const distanceBetween = ([a, b]) => Math.hypot(a.x - b.x, a.y - b.y);
const middleOf = ([a, b]) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

// Mouse, touch and keyboard on the map, turned into camera intents: a press that travels less than a few pixels is a click.
// A press on a name tag stays the tag's click unless it turns into a drag or a pinch, which then moves the camera like any
// other; the click that would follow such a drag is swallowed. Points are in CSS pixels from the top left corner of the region.
export function attachCameraInput({ surface, region }, { pan, zoomAt, zoomAtCenter, frameAt, frameWhole, stopFollowing, pick }) {
  const pointers = new Map();
  let pressedAt = null;
  let isDragging = false;
  let lastPinch = null;
  let startedOnTag = false;
  let swallowsClick = false;

  const pointOf = (event) => {
    const rect = region.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  function onPointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== PRIMARY_BUTTON) return;
    const isOnTag = Boolean(event.target.closest?.(TAG));
    if (!isOnTag && event.target !== surface) return;
    if (!isOnTag) surface.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, pointOf(event));
    if (pointers.size === 1) {
      pressedAt = pointOf(event);
      isDragging = false;
      startedOnTag = isOnTag;
      swallowsClick = false;
    }
    lastPinch = null;
  }

  function startDragging() {
    if (isDragging) return;
    isDragging = true;
    swallowsClick = startedOnTag;
    for (const id of pointers.keys()) if (!surface.hasPointerCapture(id)) surface.setPointerCapture(id);
  }

  function pinch() {
    const points = [...pointers.values()];
    const now = { distance: distanceBetween(points), middle: middleOf(points) };
    if (lastPinch) {
      pan(now.middle.x - lastPinch.middle.x, now.middle.y - lastPinch.middle.y);
      zoomAt(now.distance / lastPinch.distance, now.middle);
    }
    lastPinch = now;
  }

  function onPointerMove(event) {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    const point = pointOf(event);
    pointers.set(event.pointerId, point);
    if (pointers.size >= 2) {
      startDragging();
      pinch();
      return;
    }
    if (!isDragging && Math.hypot(point.x - pressedAt.x, point.y - pressedAt.y) < DRAG_THRESHOLD_PX) return;
    startDragging();
    pan(point.x - previous.x, point.y - previous.y);
  }

  function onPointerUp(event) {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    lastPinch = null;
    if (pointers.size > 0) return;
    if (!isDragging && !startedOnTag && event.type === "pointerup") pick(pointOf(event));
    pressedAt = null;
    isDragging = false;
  }

  function onWheel(event) {
    event.preventDefault();
    zoomAt(wheelZoomFactor({ deltaY: event.deltaY, deltaMode: event.deltaMode, isPinch: event.ctrlKey }), pointOf(event));
  }

  function onKeyDown(event) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const command = cameraCommandFor(event.key);
    if (!command) return;
    event.preventDefault();
    if (command.kind === "pan") pan(command.dx, command.dy);
    if (command.kind === "zoom") zoomAtCenter(command.factor);
    if (command.kind === "frame") frameWhole();
    if (command.kind === "stopFollowing") stopFollowing();
  }

  function onClick(event) {
    if (!swallowsClick) return;
    swallowsClick = false;
    event.stopPropagation();
    event.preventDefault();
  }

  region.addEventListener("pointerdown", onPointerDown);
  region.addEventListener("pointermove", onPointerMove);
  region.addEventListener("pointerup", onPointerUp);
  region.addEventListener("pointercancel", onPointerUp);
  region.addEventListener("click", onClick, true);
  surface.addEventListener("dblclick", (event) => frameAt(pointOf(event)));
  region.addEventListener("wheel", onWheel, { passive: false });
  region.addEventListener("keydown", onKeyDown);
}
