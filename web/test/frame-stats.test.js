import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { frameStats } from "../scripts/domain/shared/frame-stats.js";

const WINDOW_MS = 2_000;

describe("frame stats", () => {
  it("counts the frames drawn per second in the window and how long they took on average and at worst", () => {
    const frames = [{ at: 300, workMs: 30 }, { at: 1_500, workMs: 10 }, { at: 2_000, workMs: 20 }, { at: 2_400, workMs: 6 }];
    assert.deepEqual(frameStats({ frames, now: 2_400, windowMs: WINDOW_MS }), { perSecond: 1.5, averageMs: 12, worstMs: 20 });
  });

  it("reads nothing before the first frame", () => {
    assert.deepEqual(frameStats({ frames: [], now: 1_000, windowMs: WINDOW_MS }), { perSecond: 0, averageMs: 0, worstMs: 0 });
  });
});
