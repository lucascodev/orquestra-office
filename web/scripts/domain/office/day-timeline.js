const HOUR_MS = 3_600_000;
const HOURS_IN_DAY = 24;
const MINUTES_IN_HOUR = 60;
export const USUAL_DAY = { from: 8, until: 20 };

const emptyHour = () => ({ workingMs: 0, workingAgentMs: 0, needsYouMs: 0, needsYouCount: 0, costUsd: 0 });
const hasActivity = (hour) => hour.workingMs > 0 || hour.needsYouMs > 0 || hour.needsYouCount > 0;

function addSlots(hours, slots, dayStart) {
  for (const slot of slots) {
    const hour = Math.floor((slot.start - dayStart) / HOUR_MS);
    if (hour < 0 || hour >= HOURS_IN_DAY) continue;
    const sum = hours[hour];
    sum.workingMs += slot.workingMs;
    sum.workingAgentMs += slot.workingAgentMs;
    sum.needsYouMs += slot.needsYouMs;
    sum.needsYouCount += slot.needsYouCount;
    sum.costUsd += slot.costUsd;
  }
}

// The collector leaves the stretch since the last change open; it is closed here with the current time, hour by hour.
function addOpenStretch(hours, open, { now, dayStart }) {
  if (!open?.since) return;
  for (let from = Math.max(open.since, dayStart); from < now;) {
    const hour = Math.floor((from - dayStart) / HOUR_MS);
    const to = Math.min(now, dayStart + (hour + 1) * HOUR_MS);
    const span = to - from;
    const sum = hours[hour];
    if (open.working > 0) sum.workingMs += span;
    sum.workingAgentMs += open.working * span;
    if (open.needsYou > 0) sum.needsYouMs += span;
    from = to;
  }
}

function visibleRange(hours, nowHour) {
  const active = hours.map((hour, index) => (hasActivity(hour) ? index : null)).filter((index) => index !== null);
  return {
    from: Math.min(USUAL_DAY.from, nowHour, ...active),
    until: Math.max(USUAL_DAY.until, nowHour, ...active),
  };
}

const totalOf = (hours, field) => hours.reduce((sum, hour) => sum + hour[field], 0);

// Today's hours in the viewer's day: dayStart is the local midnight, so the slots of the collector line up with local hours.
export function dayTimeline(timeline, { now, dayStart }) {
  if (!timeline) return null;
  const hours = Array.from({ length: HOURS_IN_DAY }, emptyHour);
  addSlots(hours, timeline.slots ?? [], dayStart);
  addOpenStretch(hours, timeline.open, { now, dayStart });
  const sinceMidnight = now - dayStart;
  const nowHour = Math.min(HOURS_IN_DAY - 1, Math.floor(sinceMidnight / HOUR_MS));
  const { from, until } = visibleRange(hours, nowHour);
  const visible = hours.slice(from, until + 1);
  const busiest = Math.max(0, ...visible.map((hour) => hour.workingAgentMs));
  return {
    from,
    until,
    hours: visible.map((hour, offset) => ({
      hour: from + offset,
      level: busiest > 0 ? hour.workingAgentMs / busiest : 0,
      needsYouCount: hour.needsYouCount,
      isMarked: hour.needsYouCount > 0,
      isPast: from + offset < nowHour,
      isNow: from + offset === nowHour,
    })),
    totals: { workingMs: totalOf(hours, "workingMs"), needsYouMs: totalOf(hours, "needsYouMs"), costUsd: totalOf(hours, "costUsd") },
    nowAt: {
      hour: nowHour,
      minute: Math.floor((sinceMidnight % HOUR_MS) / (HOUR_MS / MINUTES_IN_HOUR)),
      position: (nowHour - from + (sinceMidnight % HOUR_MS) / HOUR_MS) / (until + 1 - from),
    },
  };
}
