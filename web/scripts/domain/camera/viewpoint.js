// The approved mock-up is drawn in true isometric: turned 45 degrees and tilted so both floor axes rise at 30 degrees on screen.
export const ISOMETRIC_VIEW = { yaw: Math.PI / 4, pitch: Math.atan(1 / Math.SQRT2) };
export const TRANSITION_MS = 350;
const CLOSEST_ZOOM = 4;
const NO_INSETS = { left: 0, right: 0, top: 0, bottom: 0 };
const MIN_FREE_PIXELS = 1;

function basisOf({ yaw, pitch }) {
  return {
    right: { x: Math.cos(yaw), y: 0, z: -Math.sin(yaw) },
    up: { x: -Math.sin(yaw) * Math.sin(pitch), y: Math.cos(pitch), z: -Math.cos(yaw) * Math.sin(pitch) },
  };
}

const dot = (a, b) => a.x * b.x + (a.y ?? 0) * b.y + a.z * b.z;

function onViewPlane(point, target, view) {
  const { right, up } = basisOf(view);
  const offset = { x: point.x - target.x, y: point.y ?? 0, z: point.z - target.z };
  return { u: dot(offset, right), v: dot(offset, up) };
}

// The ground offset that shows up on the view plane as (u, v).
function groundOffsetOf({ u, v }, view) {
  const { right, up } = basisOf(view);
  const determinant = right.x * up.z - right.z * up.x;
  return { x: (u * up.z - v * right.z) / determinant, z: (v * right.x - u * up.x) / determinant };
}

export function groundToScreen({ target, scale }, point, viewport, view = ISOMETRIC_VIEW) {
  const { u, v } = onViewPlane(point, target, view);
  return { x: viewport.width / 2 + u * scale, y: viewport.height / 2 - v * scale };
}

export function screenToGround({ target, scale }, pixel, viewport, view = ISOMETRIC_VIEW) {
  const offset = groundOffsetOf({ u: (pixel.x - viewport.width / 2) / scale, v: (viewport.height / 2 - pixel.y) / scale }, view);
  return { x: target.x + offset.x, z: target.z + offset.z };
}

function cornersOf({ minX, maxX, minZ, maxZ, minY = 0, maxY = 0 }) {
  return [minX, maxX].flatMap((x) => [minY, maxY].flatMap((y) => [minZ, maxZ].map((z) => ({ x, y, z }))));
}

// The bounds fill the part of the screen the floating panels leave free, centered in it.
export function frameBounds({ bounds, viewport, insets = NO_INSETS, view = ISOMETRIC_VIEW }) {
  const origin = { x: 0, z: 0 };
  const projected = cornersOf(bounds).map((corner) => onViewPlane(corner, origin, view));
  const us = projected.map(({ u }) => u);
  const vs = projected.map(({ v }) => v);
  const freeWidth = Math.max(MIN_FREE_PIXELS, viewport.width - insets.left - insets.right);
  const freeHeight = Math.max(MIN_FREE_PIXELS, viewport.height - insets.top - insets.bottom);
  const scale = Math.min(freeWidth / (Math.max(...us) - Math.min(...us)), freeHeight / (Math.max(...vs) - Math.min(...vs)));
  const centerU = (Math.max(...us) + Math.min(...us)) / 2 - (insets.left + freeWidth / 2 - viewport.width / 2) / scale;
  const centerV = (Math.max(...vs) + Math.min(...vs)) / 2 + (insets.top + freeHeight / 2 - viewport.height / 2) / scale;
  return { target: groundOffsetOf({ u: centerU, v: centerV }, view), scale };
}

// The target that shows the point in the middle of what the panels leave free: the screen center mirrored across the free center.
export function centerBetweenPanels({ point, scale, viewport, insets = NO_INSETS, view = ISOMETRIC_VIEW }) {
  const freeCenter = {
    x: insets.left + (viewport.width - insets.left - insets.right) / 2,
    y: insets.top + (viewport.height - insets.top - insets.bottom) / 2,
  };
  return screenToGround({ target: point, scale }, { x: viewport.width - freeCenter.x, y: viewport.height - freeCenter.y }, viewport, view);
}

export const zoomLimits =(wholeScale) => ({ min: wholeScale, max: wholeScale * CLOSEST_ZOOM });

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function zoomAt(viewpoint, { factor, at, viewport, limits, view = ISOMETRIC_VIEW }) {
  const anchor = screenToGround(viewpoint, at, viewport, view);
  const scale = clamp(viewpoint.scale * factor, limits.min, limits.max);
  const offset = groundOffsetOf({ u: (at.x - viewport.width / 2) / scale, v: (viewport.height / 2 - at.y) / scale }, view);
  return { target: { x: anchor.x - offset.x, z: anchor.z - offset.z }, scale };
}

export function panBy({ target, scale }, { dx, dy }, view = ISOMETRIC_VIEW) {
  const offset = groundOffsetOf({ u: dx / scale, v: -dy / scale }, view);
  return { target: { x: target.x - offset.x, z: target.z - offset.z }, scale };
}

export function clampToMap(viewpoint, { minX, maxX, minZ, maxZ }) {
  const { x, z } = viewpoint.target;
  if (x >= minX && x <= maxX && z >= minZ && z <= maxZ) return viewpoint;
  return { ...viewpoint, target: { x: clamp(x, minX, maxX), z: clamp(z, minZ, maxZ) } };
}

const easeInOut = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
const between = (from, to, t) => from + (to - from) * t;

// Zoom changes by the same ratio every frame, so going from far to near does not rush at the end.
export function transitionAt(from, to, elapsedMs, { isMotionReduced = false } = {}) {
  if (isMotionReduced || elapsedMs >= TRANSITION_MS) return { viewpoint: to, isDone: true };
  const t = easeInOut(Math.max(0, elapsedMs) / TRANSITION_MS);
  return {
    viewpoint: {
      target: { x: between(from.target.x, to.target.x, t), z: between(from.target.z, to.target.z, t) },
      scale: from.scale * (to.scale / from.scale) ** t,
    },
    isDone: false,
  };
}
