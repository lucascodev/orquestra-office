import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addCost, advanceTimeline, countsOf, emptyTimeline, KEPT_SLOTS, markNeedsYou, pruneTimeline, restoredTimeline, SLOT_MS,
} from "../src/office/domain/status-timeline.js";

const MINUTE_MS = 60_000;
const DAY_START = Date.UTC(2026, 10, 19);
const at = (hour, minute = 0) => DAY_START + hour * SLOT_MS + minute * MINUTE_MS;
const NO_ONE = { working: 0, needsYou: 0 };

function deepFreeze(value) {
  if (value && typeof value === "object") Object.values(Object.freeze(value)).forEach(deepFreeze);
  return value;
}

const openAt = (since, counts) => ({ ...emptyTimeline(), open: { since, ...counts } });
const slot = (hour, totals = {}) => ({
  start: at(hour), workingMs: 0, workingAgentMs: 0, needsYouMs: 0, needsYouAgentMs: 0, needsYouCount: 0, costUsd: 0, ...totals,
});

const stretches = [
  {
    name: "a stretch inside one hour goes to that hour",
    since: at(9, 10), now: at(9, 40), counts: { working: 2, needsYou: 0 },
    slots: [slot(9, { workingMs: 30 * MINUTE_MS, workingAgentMs: 60 * MINUTE_MS })],
  },
  {
    name: "a stretch across the turn of the hour is split at the hour",
    since: at(9, 50), now: at(10, 20), counts: { working: 1, needsYou: 0 },
    slots: [
      slot(9, { workingMs: 10 * MINUTE_MS, workingAgentMs: 10 * MINUTE_MS }),
      slot(10, { workingMs: 20 * MINUTE_MS, workingAgentMs: 20 * MINUTE_MS }),
    ],
  },
  {
    name: "a stretch across several hours fills each whole hour in between",
    since: at(9, 30), now: at(12, 15), counts: { working: 0, needsYou: 1 },
    slots: [
      slot(9, { needsYouMs: 30 * MINUTE_MS, needsYouAgentMs: 30 * MINUTE_MS }),
      slot(10, { needsYouMs: SLOT_MS, needsYouAgentMs: SLOT_MS }),
      slot(11, { needsYouMs: SLOT_MS, needsYouAgentMs: SLOT_MS }),
      slot(12, { needsYouMs: 15 * MINUTE_MS, needsYouAgentMs: 15 * MINUTE_MS }),
    ],
  },
  {
    name: "working and waiting at once count in both, wall time once and agent time per agent",
    since: at(14), now: at(14, 6), counts: { working: 3, needsYou: 2 },
    slots: [slot(14, { workingMs: 6 * MINUTE_MS, workingAgentMs: 18 * MINUTE_MS, needsYouMs: 6 * MINUTE_MS, needsYouAgentMs: 12 * MINUTE_MS })],
  },
  {
    name: "a stretch with no one working or waiting leaves no slot",
    since: at(9), now: at(11), counts: NO_ONE,
    slots: [],
  },
  {
    name: "a stretch that never opened leaves no slot",
    since: null, now: at(11), counts: { working: 1, needsYou: 0 },
    slots: [],
  },
  {
    name: "a stretch older than the kept window fills only the kept hours",
    since: at(0) - 10 * 24 * SLOT_MS, now: at(0), counts: { working: 1, needsYou: 0 },
    slots: Array.from({ length: KEPT_SLOTS - 1 }, (_, index) => slot(index - (KEPT_SLOTS - 1), { workingMs: SLOT_MS, workingAgentMs: SLOT_MS })),
  },
];

for (const { name, since, now, counts, slots } of stretches) {
  test(`advanceTimeline: ${name}`, () => {
    const before = deepFreeze(openAt(since, counts));
    const after = advanceTimeline(before, now, { working: 4, needsYou: 1 });
    assert.deepEqual(after.slots, slots);
    assert.deepEqual(after.open, { since: now, working: 4, needsYou: 1 });
  });
}

test("advanceTimeline: a late event changes the counts but keeps the stretch open where it was", () => {
  const before = deepFreeze(openAt(at(10), { working: 1, needsYou: 0 }));
  const after = advanceTimeline(before, at(9, 59), { working: 2, needsYou: 0 });
  assert.deepEqual(after.slots, []);
  assert.deepEqual(after.open, { since: at(10), working: 2, needsYou: 0 });
});

test("advanceTimeline: closing the same hour twice adds up", () => {
  const first = advanceTimeline(openAt(at(9), { working: 1, needsYou: 0 }), at(9, 20), { working: 2, needsYou: 0 });
  const second = advanceTimeline(deepFreeze(first), at(9, 30), NO_ONE);
  assert.deepEqual(second.slots, [slot(9, { workingMs: 30 * MINUTE_MS, workingAgentMs: 40 * MINUTE_MS })]);
});

test("markNeedsYou: each request adds one mark to its hour", () => {
  const once = markNeedsYou(deepFreeze(emptyTimeline()), at(11, 5));
  const twice = markNeedsYou(deepFreeze(once), at(11, 50));
  const elsewhere = markNeedsYou(deepFreeze(twice), at(13, 1));
  assert.deepEqual(elsewhere.slots, [slot(11, { needsYouCount: 2 }), slot(13, { needsYouCount: 1 })]);
});

test("addCost: the spend of each reading adds up in its hour, and no spend leaves no slot", () => {
  const first = addCost(deepFreeze(emptyTimeline()), at(15, 10), 0.25);
  const second = addCost(deepFreeze(first), at(15, 40), 0.5);
  const nothing = addCost(deepFreeze(second), at(16, 0), 0);
  assert.deepEqual(nothing.slots, [slot(15, { costUsd: 0.75 })]);
});

test("addCost: a reading for an earlier hour goes in order", () => {
  const later = addCost(emptyTimeline(), at(15), 1);
  assert.deepEqual(addCost(deepFreeze(later), at(13), 2).slots.map((kept) => kept.start), [at(13), at(15)]);
});

test("pruneTimeline: keeps the last 48 hours, the current one included", () => {
  const now = at(12, 30);
  const hours = Array.from({ length: KEPT_SLOTS + 3 }, (_, index) => slot(12 - index, { costUsd: 1 })).reverse();
  const pruned = pruneTimeline(deepFreeze({ ...emptyTimeline(), slots: hours }), now);
  assert.equal(pruned.slots.length, KEPT_SLOTS);
  assert.equal(pruned.slots[0].start, at(12) - (KEPT_SLOTS - 1) * SLOT_MS);
  assert.equal(pruned.slots.at(-1).start, at(12));
});

test("countsOf: working and reviewing work, needs_you waits, an ended agent counts as neither", () => {
  const agents = [
    { status: "working", endedAt: null },
    { status: "reviewing", endedAt: null },
    { status: "needs_you", endedAt: null },
    { status: "working", endedAt: at(9) },
    { status: "needs_you", endedAt: at(9) },
    { status: "break", endedAt: null },
    { status: "idle", endedAt: null },
    { status: "waiting", endedAt: null },
  ];
  assert.deepEqual(countsOf(agents), { working: 2, needsYou: 1 });
});

const restorations = [
  { name: "a state saved before the timeline", saved: undefined, slots: [] },
  { name: "a timeline without slots", saved: { open: { since: at(9), working: 1, needsYou: 0 } }, slots: [] },
  {
    name: "a timeline with broken slots",
    saved: { slots: [null, 7, { start: "x" }, { start: at(10), workingMs: "a lot", costUsd: 0.5 }, { start: at(9), workingMs: 60 }] },
    slots: [slot(9, { workingMs: 60 }), slot(10, { costUsd: 0.5 })],
  },
];

for (const { name, saved, slots } of restorations) {
  test(`restoredTimeline: ${name} opens with a closed stretch`, () => {
    const restored = restoredTimeline(saved);
    assert.deepEqual(restored, { slotMs: SLOT_MS, slots, open: { since: null, working: 0, needsYou: 0 } });
  });
}
