import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { localDayStart } from "../scripts/domain/shared/local-day-start.js";
import { testsOverview } from "../scripts/domain/work-sheet/tests-overview.js";
import { renderTestsTab } from "../scripts/view/sheet/tests-tab-view.js";

// Three hours behind UTC, so the collector, which turns the day at UTC midnight, keeps runs from last night until 21:00.
process.env.TZ = "America/Sao_Paulo";

const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 10, 19, 11);
const run = (finishedAt) => ({ finishedAt, label: "npm test", framework: null, isOk: true, passed: 3, failed: 0, skipped: 0 });

describe("today in the viewer's own day", () => {
  it("starts at the local midnight, not at the collector's UTC midnight", () => {
    assert.equal(localDayStart(NOW), Date.UTC(2026, 10, 19, 3));
    assert.equal(localDayStart(Date.UTC(2026, 10, 19, 2)), Date.UTC(2026, 10, 18, 3));
  });

  it("leaves out of Hoje the runs the collector still counts as today but were last night for the viewer", () => {
    const lastNight = Date.UTC(2026, 10, 19, 1);
    const thisMorning = Date.UTC(2026, 10, 19, 10);
    const tests = { lastRun: { ...run(thisMorning), command: "npm test" }, runsToday: [run(thisMorning), run(lastNight), run(null)] };
    const overview = testsOverview(tests, { dayStart: localDayStart(NOW) });
    assert.deepEqual(overview.runsToday.map((entry) => entry.finishedAt), [thisMorning]);
    assert.ok(renderTestsTab(overview).includes("Hoje · 1 rodada"));
    assert.equal(testsOverview(tests, { dayStart: localDayStart(NOW + 20 * HOUR) }).runsToday.length, 0);
  });
});
