export const SLOT_MS = 3_600_000;
export const KEPT_SLOTS = 48;

const WORKING_STATUSES = new Set(["working", "reviewing"]);
const NEEDS_YOU_STATUS = "needs_you";
const CLOSED_STRETCH = Object.freeze({ since: null, working: 0, needsYou: 0 });
const SLOT_TOTALS = ["workingMs", "workingAgentMs", "needsYouMs", "needsYouAgentMs", "needsYouCount", "costUsd"];

const slotStartOf = (at) => Math.floor(at / SLOT_MS) * SLOT_MS;
const oldestKeptStart = (now) => slotStartOf(now) - (KEPT_SLOTS - 1) * SLOT_MS;
const emptySlot = (start) => ({ start, ...Object.fromEntries(SLOT_TOTALS.map((total) => [total, 0])) });
const isActive = ({ working, needsYou }) => working > 0 || needsYou > 0;

export function emptyTimeline() {
  return { slotMs: SLOT_MS, slots: [], open: { ...CLOSED_STRETCH } };
}

export function countsOf(agents) {
  const live = agents.filter((agent) => !agent.endedAt);
  return {
    working: live.filter((agent) => WORKING_STATUSES.has(agent.status)).length,
    needsYou: live.filter((agent) => agent.status === NEEDS_YOU_STATUS).length,
  };
}

function withSlotAt(slots, at, change) {
  const start = slotStartOf(at);
  const existing = slots.find((slot) => slot.start === start);
  if (existing) return slots.map((slot) => (slot === existing ? change(slot) : slot));
  return [...slots, change(emptySlot(start))].sort((a, b) => a.start - b.start);
}

function withStretch(slot, spanMs, { working, needsYou }) {
  return {
    ...slot,
    workingMs: slot.workingMs + (working > 0 ? spanMs : 0),
    workingAgentMs: slot.workingAgentMs + working * spanMs,
    needsYouMs: slot.needsYouMs + (needsYou > 0 ? spanMs : 0),
    needsYouAgentMs: slot.needsYouAgentMs + needsYou * spanMs,
  };
}

function closeStretch(slots, from, to, counts) {
  let closed = slots;
  for (let at = from; at < to;) {
    const end = Math.min(to, slotStartOf(at) + SLOT_MS);
    const spanMs = end - at;
    closed = withSlotAt(closed, at, (slot) => withStretch(slot, spanMs, counts));
    at = end;
  }
  return closed;
}

// Closes [open.since, now) with the counts that held during it and opens a new stretch with the counts from now on.
// A late event (now before since) only changes the counts, so time never runs backwards.
export function advanceTimeline(timeline, now, counts) {
  const { since, working, needsYou } = timeline.open;
  const isLate = since !== null && now < since;
  const shouldClose = since !== null && !isLate && isActive({ working, needsYou });
  const slots = shouldClose ? closeStretch(timeline.slots, Math.max(since, oldestKeptStart(now)), now, { working, needsYou }) : timeline.slots;
  return { ...timeline, slots, open: { since: isLate ? since : now, working: counts.working, needsYou: counts.needsYou } };
}

export function markNeedsYou(timeline, at) {
  return { ...timeline, slots: withSlotAt(timeline.slots, at, (slot) => ({ ...slot, needsYouCount: slot.needsYouCount + 1 })) };
}

export function addCost(timeline, at, costUsd) {
  if (!(costUsd > 0)) return timeline;
  return { ...timeline, slots: withSlotAt(timeline.slots, at, (slot) => ({ ...slot, costUsd: slot.costUsd + costUsd })) };
}

export function pruneTimeline(timeline, now) {
  const oldest = oldestKeptStart(now);
  return { ...timeline, slots: timeline.slots.filter((slot) => slot.start >= oldest) };
}

const isSavedSlot = (slot) => slot !== null && typeof slot === "object" && Number.isFinite(slot.start);
const finiteOrZero = (value) => (Number.isFinite(value) ? value : 0);
const restoredSlot = (slot) => ({ start: slotStartOf(slot.start), ...Object.fromEntries(SLOT_TOTALS.map((total) => [total, finiteOrZero(slot[total])])) });

// The open stretch is not restored: the collector cannot tell what the agents did while it was down, so that time
// does not count and a new stretch opens with the first event or sweep after the restart.
export function restoredTimeline(saved) {
  if (!Array.isArray(saved?.slots)) return emptyTimeline();
  const slots = saved.slots.filter(isSavedSlot).map(restoredSlot).sort((a, b) => a.start - b.start);
  return { ...emptyTimeline(), slots };
}
