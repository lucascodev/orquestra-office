import { test } from "node:test";
import assert from "node:assert/strict";
import { createOffice } from "../src/composition.js";

const SWEEP_INTERVAL_MS = 30_000;

test("a sweep that throws is reported and the next sweep still runs", (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  const reportError = t.mock.method(console, "error", () => {});
  const office = createOffice({ webDir: "/nonexistent" });
  const sweep = t.mock.method(office.store, "sweep", () => { throw new Error("sweep exploded"); });
  office.startSweep();
  try {
    assert.doesNotThrow(() => t.mock.timers.tick(SWEEP_INTERVAL_MS));
    t.mock.timers.tick(SWEEP_INTERVAL_MS);
    assert.equal(sweep.mock.callCount(), 2);
    assert.equal(reportError.mock.callCount(), 2);
  } finally {
    office.stop();
  }
});
