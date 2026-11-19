import { PERSONAL_ACCOUNT, WORK_ACCOUNT } from "./demo-accounts.js";

const MIN = 60_000;
const HOUR = 60 * MIN;
const FIRST_HOUR = 8;
const BUSIEST_TEAM = 3;
const HOURLY_COST_USD = 1.1;
const WORKING_NOW = 2;
const NEEDS_YOU_NOW = 1;
const BUSY_SHARE = [0.2, 0.45, 0.7, 0.5, 0.3, 0.85, 1, 0.65, 0.4, 0.75, 0.9, 0.6, 0.5, 0.3];
const ASKED_AT_HOURS = new Map([[11, 1], [14, 2]]);

const startOfHour = (ms) => {
  const date = new Date(ms);
  date.setMinutes(0, 0, 0);
  return date.getTime();
};

function slotAt(start, share, hour) {
  const needsYouCount = ASKED_AT_HOURS.get(hour) ?? 0;
  return {
    start,
    workingMs: Math.round(share * HOUR),
    workingAgentMs: Math.round(share * BUSIEST_TEAM * HOUR),
    needsYouMs: needsYouCount * 2 * MIN,
    needsYouAgentMs: needsYouCount * 2 * MIN,
    needsYouCount,
    costUsd: Math.round(share * HOURLY_COST_USD * 100) / 100,
  };
}

// The approved mock-up's day: work since eight with two moments that waited for you, up to the hour now running.
function demoTimeline(now) {
  const currentHour = startOfHour(now);
  const dayStart = new Date(now).setHours(0, 0, 0, 0);
  const slots = [];
  for (let start = dayStart + FIRST_HOUR * HOUR, index = 0; start < currentHour && index < BUSY_SHARE.length; start += HOUR, index += 1) {
    slots.push(slotAt(start, BUSY_SHARE[index], FIRST_HOUR + index));
  }
  return { slotMs: HOUR, slots, open: { since: currentHour, working: WORKING_NOW, needsYou: NEEDS_YOU_NOW } };
}

function demoAccounts(now) {
  const reading = (fiveHour, sevenDay) => ({
    fiveHour: { usedPercentage: fiveHour, resetsAt: now + 2 * HOUR },
    sevenDay: { usedPercentage: sevenDay, resetsAt: now + 70 * HOUR },
  });
  return {
    [PERSONAL_ACCOUNT.id]: { ...PERSONAL_ACCOUNT, rateLimits: reading(37, 84), updatedAt: now },
    [WORK_ACCOUNT.id]: { ...WORK_ACCOUNT, rateLimits: reading(12, 41), updatedAt: now },
  };
}

export const demoDay = (now) => ({ accounts: demoAccounts(now), timeline: demoTimeline(now) });
