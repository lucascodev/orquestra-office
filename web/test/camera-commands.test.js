import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cameraCommandFor, KEY_PAN_PIXELS, KEY_ZOOM_FACTOR, wheelZoomFactor } from "../scripts/domain/camera/camera-commands.js";
import { boundsToFrameAt } from "../scripts/domain/camera/frame-target.js";
import { layoutHeadquarters } from "../scripts/domain/headquarters/headquarters-layout.js";

const NOW = 1_800_000_000_000;
const PIXEL_LINES = 1;
const PAGES = 2;

const projectOf = (index) => ({
  key: `c:/p${index}`, name: `p${index}`, template: "startup", createdAt: NOW + index, updatedAt: NOW, team: [],
  agents: { [`claude:p${index}`]: { key: `claude:p${index}`, kind: "main", status: "working", startedAt: NOW, updatedAt: NOW, endedAt: null } },
});
const layoutWith = (count) => layoutHeadquarters(Object.fromEntries(Array.from({ length: count }, (_, i) => [`c:/p${i}`, projectOf(i)])));

describe("camera keys", () => {
  it("moves the map so the arrow shows what lies in its direction", () => {
    assert.deepEqual(cameraCommandFor("ArrowLeft"), { kind: "pan", dx: KEY_PAN_PIXELS, dy: 0 });
    assert.deepEqual(cameraCommandFor("ArrowRight"), { kind: "pan", dx: -KEY_PAN_PIXELS, dy: 0 });
    assert.deepEqual(cameraCommandFor("ArrowUp"), { kind: "pan", dx: 0, dy: KEY_PAN_PIXELS });
    assert.deepEqual(cameraCommandFor("ArrowDown"), { kind: "pan", dx: 0, dy: -KEY_PAN_PIXELS });
  });

  it("zooms in with plus, also typed without shift, and out with minus", () => {
    assert.deepEqual(cameraCommandFor("+"), { kind: "zoom", factor: KEY_ZOOM_FACTOR });
    assert.deepEqual(cameraCommandFor("="), { kind: "zoom", factor: KEY_ZOOM_FACTOR });
    assert.deepEqual(cameraCommandFor("-"), { kind: "zoom", factor: 1 / KEY_ZOOM_FACTOR });
    assert.ok(KEY_ZOOM_FACTOR > 1);
  });

  it("frames the whole headquarters with zero and stops following with escape", () => {
    assert.deepEqual(cameraCommandFor("0"), { kind: "frame" });
    assert.deepEqual(cameraCommandFor("Escape"), { kind: "stopFollowing" });
  });

  it("ignores any other key, including names inherited from objects", () => {
    for (const key of ["a", "Enter", "Tab", "toString", "constructor", "__proto__"]) assert.equal(cameraCommandFor(key), null);
  });
});

describe("wheel zoom", () => {
  it("zooms in when the wheel goes up and out by the same ratio when it goes down", () => {
    const closer = wheelZoomFactor({ deltaY: -100, deltaMode: 0, isPinch: false });
    const farther = wheelZoomFactor({ deltaY: 100, deltaMode: 0, isPinch: false });
    assert.ok(closer > 1);
    assert.ok(Math.abs(closer * farther - 1) < 1e-9);
  });

  it("reads wheels that count lines or pages like the pixels they scroll", () => {
    assert.equal(wheelZoomFactor({ deltaY: -3, deltaMode: PIXEL_LINES }), wheelZoomFactor({ deltaY: -48, deltaMode: 0 }));
    assert.ok(wheelZoomFactor({ deltaY: -1, deltaMode: PAGES }) > wheelZoomFactor({ deltaY: -3, deltaMode: PIXEL_LINES }));
  });

  it("answers a trackpad pinch, which sends small steps, faster than a wheel", () => {
    assert.ok(wheelZoomFactor({ deltaY: -10, deltaMode: 0, isPinch: true }) > wheelZoomFactor({ deltaY: -10, deltaMode: 0, isPinch: false }));
  });

  it("never jumps more than twice in a single event", () => {
    assert.equal(wheelZoomFactor({ deltaY: -100_000, deltaMode: 0 }), 2);
    assert.equal(wheelZoomFactor({ deltaY: 100_000, deltaMode: 0 }), 0.5);
    assert.equal(wheelZoomFactor({ deltaY: 0, deltaMode: 0 }), 1);
  });
});

describe("what a double click frames", () => {
  it("frames the island under the pointer, rug included", () => {
    const layout = layoutWith(4);
    const [island] = layout.islands;
    const bounds = boundsToFrameAt(layout, { x: island.desk.x + 0.2, z: island.desk.z + 0.2 });
    assert.deepEqual([bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ], [island.rug.x, island.rug.x + island.rug.w, island.rug.z, island.rug.z + island.rug.d]);
    assert.ok(bounds.maxY > 0);
  });

  it("frames a common room or the reception, which reaches the facade", () => {
    const layout = layoutWith(9);
    const pantry = boundsToFrameAt(layout, { x: 10, z: 3 });
    assert.deepEqual([pantry.minX, pantry.maxX, pantry.minZ, pantry.maxZ], [7, 14, 0, 6]);
    const reception = boundsToFrameAt(layout, { x: 23, z: layout.size.D - 1 });
    assert.deepEqual([reception.minX, reception.maxX, reception.minZ, reception.maxZ], [20, 26, 8, layout.size.D]);
  });

  it("frames the whole headquarters from the corridor, the open floor or the yard", () => {
    const layout = layoutWith(4);
    for (const point of [{ x: 12, z: 7 }, { x: 19.5, z: 8.5 }, { x: 5, z: layout.size.D + 5 }]) {
      const bounds = boundsToFrameAt(layout, point);
      assert.deepEqual([bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ], [layout.bounds.minX, layout.bounds.maxX, layout.bounds.minZ, layout.bounds.maxZ]);
    }
  });
});
