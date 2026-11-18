import { ownValueOf } from "../shared/own-value.js";

export const KEY_PAN_PIXELS = 80;
export const KEY_ZOOM_FACTOR = 1.25;
const LINE_PIXELS = 16;
const PAGE_PIXELS = 800;
const WHEEL_SENSITIVITY = 0.0015;
const PINCH_SENSITIVITY = 0.01;
const MAX_STEP_FACTOR = 2;
const DELTA_PIXELS = [1, LINE_PIXELS, PAGE_PIXELS];

const pan = (dx, dy) => ({ kind: "pan", dx, dy });
const zoom = (factor) => ({ kind: "zoom", factor });

// Dragging moves the map under the pointer; an arrow shows what lies its way, so the map moves the other way.
const COMMANDS = {
  ArrowLeft: pan(KEY_PAN_PIXELS, 0),
  ArrowRight: pan(-KEY_PAN_PIXELS, 0),
  ArrowUp: pan(0, KEY_PAN_PIXELS),
  ArrowDown: pan(0, -KEY_PAN_PIXELS),
  "+": zoom(KEY_ZOOM_FACTOR),
  "=": zoom(KEY_ZOOM_FACTOR),
  "-": zoom(1 / KEY_ZOOM_FACTOR),
  0: { kind: "frame" },
  Escape: { kind: "stopFollowing" },
};

export const cameraCommandFor = (key) => ownValueOf(COMMANDS, key) ?? null;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function wheelZoomFactor({ deltaY, deltaMode, isPinch = false }) {
  const pixels = deltaY * (DELTA_PIXELS[deltaMode] ?? 1);
  const factor = Math.exp(-pixels * (isPinch ? PINCH_SENSITIVITY : WHEEL_SENSITIVITY));
  return clamp(factor, 1 / MAX_STEP_FACTOR, MAX_STEP_FACTOR);
}
