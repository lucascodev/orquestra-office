import { cameraCommandFor, wheelZoomFactor } from "../../domain/camera/camera-commands.js";

const DRAG_THRESHOLD_PX = 4;
const PRIMARY_BUTTON = 0;

const distanceBetween = ([a, b]) => Math.hypot(a.x - b.x, a.y - b.y);
const middleOf = ([a, b]) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

// Mouse, touch and keyboard on the map, turned into camera intents: a press that travels less than a few pixels is a click.
// Presses and drags belong to the drawing surface, so the name tags above it keep their own clicks; the wheel and the keys
// belong to the whole map region. Points are in CSS pixels from the top left corner of the region.
export function attachCameraInput({ surface, region }, { pan, zoomAt, zoomAtCenter, frameAt, frameWhole, stopFollowing, pick }) {
  const pointers = new Map();
  let pressedAt = null;
  let isDragging = false;
  let lastPinch = null;

  const pointOf = (event) => {
    const rect = region.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  function onPointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== PRIMARY_BUTTON) return;
    surface.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, pointOf(event));
    if (pointers.size === 1) {
      pressedAt = pointOf(event);
      isDragging = false;
    }
    lastPinch = null;
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
      isDragging = true;
      pinch();
      return;
    }
    if (!isDragging && Math.hypot(point.x - pressedAt.x, point.y - pressedAt.y) < DRAG_THRESHOLD_PX) return;
    isDragging = true;
    pan(point.x - previous.x, point.y - previous.y);
  }

  function onPointerUp(event) {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    lastPinch = null;
    if (pointers.size > 0) return;
    if (!isDragging && event.type === "pointerup") pick(pointOf(event));
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

  surface.addEventListener("pointerdown", onPointerDown);
  surface.addEventListener("pointermove", onPointerMove);
  surface.addEventListener("pointerup", onPointerUp);
  surface.addEventListener("pointercancel", onPointerUp);
  surface.addEventListener("dblclick", (event) => frameAt(pointOf(event)));
  region.addEventListener("wheel", onWheel, { passive: false });
  region.addEventListener("keydown", onKeyDown);
}
