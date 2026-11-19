import { HEADQUARTERS_PALETTE } from "../data/headquarters-palette.js";
import { fromMinimap, MINIMAP_SIZE, minimapFootprint, minimapShapes } from "../domain/headquarters/minimap-shapes.js";

const ALERT_LINE_PX = 2;
const FOOTPRINT_LINE_PX = 1.5;
const PRIMARY_BUTTON = 0;
const { alert: ALERT_COLOR, footprint: FOOTPRINT_COLOR, ground: GROUND_COLOR } = HEADQUARTERS_PALETTE.minimap;

const pixelKey = (points) => points.map(({ x, y }) => `${Math.round(x * 2)},${Math.round(y * 2)}`).join(" ");

// The plan seen from above with the camera's footprint over it. A press or a drag on it centers the camera on that spot.
export function createMinimap({ canvas, onPick }) {
  const context = canvas.getContext("2d");
  const ratio = Math.max(1, Math.round(window.devicePixelRatio || 1));
  canvas.width = MINIMAP_SIZE.width * ratio;
  canvas.height = MINIMAP_SIZE.height * ratio;
  let layout = null;
  let plan = null;
  let planKey = "";
  let drawnKey = "";
  let pressedPointer = null;

  function paintShape({ x, y, w, h, color, isAlert }) {
    context.fillStyle = color;
    context.fillRect(x, y, w, h);
    if (!isAlert) return;
    context.strokeStyle = ALERT_COLOR;
    context.lineWidth = ALERT_LINE_PX;
    context.strokeRect(x - 1, y - 1, w + 2, h + 2);
  }

  function paintFootprint(points) {
    context.beginPath();
    points.forEach(({ x, y }, index) => (index === 0 ? context.moveTo(x, y) : context.lineTo(x, y)));
    context.closePath();
    context.strokeStyle = FOOTPRINT_COLOR;
    context.lineWidth = FOOTPRINT_LINE_PX;
    context.stroke();
  }

  function draw({ layout: nextLayout, viewpoint, viewport, insets }) {
    if (!nextLayout || !viewpoint || canvas.offsetParent === null) return;
    if (nextLayout !== layout) {
      layout = nextLayout;
      plan = minimapShapes(layout);
      planKey = JSON.stringify(plan.shapes);
    }
    const footprint = minimapFootprint(plan.frame, viewpoint, viewport, insets);
    const key = `${planKey}|${pixelKey(footprint)}`;
    if (key === drawnKey) return;
    drawnKey = key;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.fillStyle = GROUND_COLOR;
    context.fillRect(0, 0, MINIMAP_SIZE.width, MINIMAP_SIZE.height);
    plan.shapes.forEach(paintShape);
    paintFootprint(footprint);
  }

  function pick(event) {
    if (!plan) return;
    const rect = canvas.getBoundingClientRect();
    const point = { x: ((event.clientX - rect.left) / rect.width) * MINIMAP_SIZE.width, y: ((event.clientY - rect.top) / rect.height) * MINIMAP_SIZE.height };
    onPick(fromMinimap(plan.frame, point));
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== PRIMARY_BUTTON) return;
    pressedPointer = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    pick(event);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerId === pressedPointer) pick(event);
  });
  const release = (event) => {
    if (event.pointerId === pressedPointer) pressedPointer = null;
  };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);

  return { draw };
}
