import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  centerBetweenPanels, clampToMap, frameBounds, groundToScreen, ISOMETRIC_VIEW, panBy, screenToGround, TRANSITION_MS, transitionAt, zoomAt, zoomLimits,
} from "../scripts/domain/camera/viewpoint.js";

const VIEWPORT = { width: 1440, height: 900 };
const INSETS = { left: 300, right: 40, top: 80, bottom: 200 };
const MAP = { minX: -2, maxX: 28, minZ: -2, maxZ: 27, minY: 0, maxY: 2.4 };
const ISLAND = { minX: 1, maxX: 4.6, minZ: 9.8, maxZ: 11.3, minY: 0, maxY: 1.2 };
const NEAR = 1e-6;

const cornersOf = ({ minX, maxX, minZ, maxZ, minY, maxY }) => [minX, maxX].flatMap((x) => [minY, maxY].flatMap((y) => [minZ, maxZ].map((z) => ({ x, y, z }))));
const screenBox = (viewpoint, bounds) => {
  const points = cornersOf(bounds).map((corner) => groundToScreen(viewpoint, corner, VIEWPORT));
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
};
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-6, `${message ?? ""} ${actual} != ${expected}`);
const framed = (bounds = MAP) => frameBounds({ bounds, viewport: VIEWPORT, insets: INSETS });

describe("camera angle", () => {
  it("is the true isometric view of the approved mock-up: x runs right and down, z runs left and down, both at 30 degrees", () => {
    const viewpoint = { target: { x: 0, z: 0 }, scale: 10 };
    const origin = groundToScreen(viewpoint, { x: 0, z: 0 }, VIEWPORT);
    const alongX = groundToScreen(viewpoint, { x: 1, z: 0 }, VIEWPORT);
    const alongZ = groundToScreen(viewpoint, { x: 0, z: 1 }, VIEWPORT);
    close((alongX.y - origin.y) / (alongX.x - origin.x), Math.tan(Math.PI / 6));
    close((alongZ.y - origin.y) / (origin.x - alongZ.x), Math.tan(Math.PI / 6));
    assert.ok(alongX.x > origin.x && alongZ.x < origin.x);
    assert.ok(ISOMETRIC_VIEW.pitch > 0.6 && ISOMETRIC_VIEW.pitch < 0.63);
  });
});

describe("framing", () => {
  it("fits the whole map in the part of the screen the floating panels leave free", () => {
    const box = screenBox(framed(), MAP);
    assert.ok(box.left >= INSETS.left - NEAR && box.right <= VIEWPORT.width - INSETS.right + NEAR, JSON.stringify(box));
    assert.ok(box.top >= INSETS.top - NEAR && box.bottom <= VIEWPORT.height - INSETS.bottom + NEAR, JSON.stringify(box));
    const freeWidth = VIEWPORT.width - INSETS.left - INSETS.right;
    const freeHeight = VIEWPORT.height - INSETS.top - INSETS.bottom;
    assert.ok(Math.abs(box.right - box.left - freeWidth) < NEAR || Math.abs(box.bottom - box.top - freeHeight) < NEAR);
  });

  it("centers what it frames in the free part of the screen", () => {
    const box = screenBox(framed(), MAP);
    close((box.left + box.right) / 2, INSETS.left + (VIEWPORT.width - INSETS.left - INSETS.right) / 2);
    close((box.top + box.bottom) / 2, INSETS.top + (VIEWPORT.height - INSETS.top - INSETS.bottom) / 2);
  });

  it("keeps a followed point in the middle of the free part of the screen, beside an open drawer", () => {
    const point = { x: 12, z: 7 };
    const drawerInsets = { ...INSETS, right: 420 };
    const target = centerBetweenPanels({ point, scale: 40, viewport: VIEWPORT, insets: drawerInsets });
    const onScreen = groundToScreen({ target, scale: 40 }, point, VIEWPORT);
    close(onScreen.x, drawerInsets.left + (VIEWPORT.width - drawerInsets.left - drawerInsets.right) / 2);
    close(onScreen.y, drawerInsets.top + (VIEWPORT.height - drawerInsets.top - drawerInsets.bottom) / 2);
  });

  it("comes much closer to frame a single island", () => {
    assert.ok(framed(ISLAND).scale > 4 * framed(MAP).scale);
    const box = screenBox(framed(ISLAND), ISLAND);
    assert.ok(box.left >= INSETS.left - NEAR && box.bottom <= VIEWPORT.height - INSETS.bottom + NEAR);
  });
});

describe("zoom and pan", () => {
  const start = framed();
  const limits = zoomLimits(start.scale);

  it("zooms from the whole headquarters up to four times closer", () => {
    assert.deepEqual(limits, { min: start.scale, max: start.scale * 4 });
  });

  it("keeps the point under the cursor in place while zooming", () => {
    const cursor = { x: 1000, y: 300 };
    const before = screenToGround(start, cursor, VIEWPORT);
    const zoomed = zoomAt(start, { factor: 1.7, at: cursor, viewport: VIEWPORT, limits });
    close(zoomed.scale, start.scale * 1.7);
    const after = screenToGround(zoomed, cursor, VIEWPORT);
    close(after.x, before.x, "x");
    close(after.z, before.z, "z");
  });

  it("stops at the closest and the farthest zoom", () => {
    const cursor = { x: 700, y: 450 };
    close(zoomAt(start, { factor: 100, at: cursor, viewport: VIEWPORT, limits }).scale, limits.max);
    close(zoomAt(start, { factor: 0.01, at: cursor, viewport: VIEWPORT, limits }).scale, limits.min);
  });

  it("moves the map along with the pointer when dragged", () => {
    const grabbed = { x: 900, y: 500 };
    const ground = screenToGround(start, grabbed, VIEWPORT);
    const moved = panBy(start, { dx: -120, dy: 45 });
    const now = groundToScreen(moved, { ...ground, y: 0 }, VIEWPORT);
    close(now.x, grabbed.x - 120);
    close(now.y, grabbed.y + 45);
  });

  it("does not let the camera wander off the map", () => {
    const lost = { target: { x: 80, z: -40 }, scale: start.scale };
    assert.deepEqual(clampToMap(lost, MAP).target, { x: MAP.maxX, z: MAP.minZ });
    assert.deepEqual(clampToMap(start, MAP), start);
  });

  it("finds on the ground the point drawn under a given pixel", () => {
    const point = { x: 13.2, z: 7.7 };
    const back = screenToGround(start, groundToScreen(start, point, VIEWPORT), VIEWPORT);
    close(back.x, point.x);
    close(back.z, point.z);
  });
});

describe("going to a room", () => {
  const from = { target: { x: 13, z: 12 }, scale: 20 };
  const to = { target: { x: 3, z: 3 }, scale: 80 };

  it(`gets there in ${TRANSITION_MS} ms, starting and ending smoothly`, () => {
    assert.deepEqual(transitionAt(from, to, 0), { viewpoint: from, isDone: false });
    assert.deepEqual(transitionAt(from, to, TRANSITION_MS), { viewpoint: to, isDone: true });
    const early = transitionAt(from, to, TRANSITION_MS * 0.1).viewpoint;
    const middle = transitionAt(from, to, TRANSITION_MS / 2).viewpoint;
    assert.ok(early.target.x > 12.5, "eases in");
    close(middle.target.x, 8);
    assert.ok(middle.scale > from.scale && middle.scale < to.scale);
  });

  it("jumps straight there when the viewer asked for reduced motion", () => {
    assert.deepEqual(transitionAt(from, to, 0, { isMotionReduced: true }), { viewpoint: to, isDone: true });
  });
});
