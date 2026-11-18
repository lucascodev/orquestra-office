import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { walkStep } from "../scripts/domain/behavior/walk-step.js";

const START = { x: 0, z: 0 };
const EAST = Math.PI / 2;
const SOUTH = 0;

describe("walk step", () => {
  it("covers the distance of the step along the path, facing where it goes", () => {
    const step = walkStep({ position: START, path: [{ x: 4, z: 0 }], distance: 1.5 });
    assert.deepEqual(step, { position: { x: 1.5, z: 0 }, path: [{ x: 4, z: 0 }], heading: EAST });
  });

  it("turns a corner within the same step, carrying the distance left over", () => {
    const step = walkStep({ position: START, path: [{ x: 1, z: 0 }, { x: 1, z: 5 }], distance: 3 });
    assert.deepEqual(step, { position: { x: 1, z: 2 }, path: [{ x: 1, z: 5 }], heading: SOUTH });
  });

  it("stops at the end of the path instead of overshooting it", () => {
    const step = walkStep({ position: START, path: [{ x: 1, z: 0 }, { x: 1, z: 1 }], distance: 10 });
    assert.deepEqual(step, { position: { x: 1, z: 1 }, path: [], heading: null });
  });

  it("stays put and keeps the heading when the step covers no distance", () => {
    const step = walkStep({ position: START, path: [{ x: 3, z: 4 }], distance: 0 });
    assert.deepEqual(step, { position: START, path: [{ x: 3, z: 4 }], heading: null });
  });

  it("skips a waypoint that is already underfoot", () => {
    const step = walkStep({ position: START, path: [{ x: 0, z: 0 }, { x: 0, z: 2 }], distance: 0.5 });
    assert.deepEqual(step, { position: { x: 0, z: 0.5 }, path: [{ x: 0, z: 2 }], heading: SOUTH });
  });

  it("leaves the path it was given untouched", () => {
    const path = [{ x: 1, z: 0 }, { x: 1, z: 1 }];
    walkStep({ position: START, path, distance: 10 });
    assert.deepEqual(path, [{ x: 1, z: 0 }, { x: 1, z: 1 }]);
  });
});
