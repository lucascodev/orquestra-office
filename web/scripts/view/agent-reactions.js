import { hashOf, rng } from "../domain/shared/seeded-random.js";
import { temperamentOf } from "./agent-temperament.js";

const WORKING_REACTIONS = { terminal: "running", delegating: "delegating", planning: "planning", thinking: "thinking", failed: "failed", web: "browsing", reading: "reading" };
const FREE_STATUSES = new Set(["break", "waiting", "idle"]);
const FIRST_FREE_ACTIVITY = { break: "coffee", waiting: "coffee", idle: "sofa" };

export const FREE_TIME = [
  { id: "coffee", reaction: "coffee" },
  { id: "water", reaction: "water" },
  { id: "window", reaction: "gazing" },
  { id: "books", reaction: "shelving" },
  { id: "filing", reaction: "filing" },
  { id: "copier", reaction: "copying" },
  { id: "board", reaction: "drawing" },
  { id: "meeting", reaction: "meeting" },
  { id: "sofa", reaction: "resting" },
  { id: "plant", reaction: "watering" },
];
export const AT_DESK_WITH_NOTHING_TO_DO = "stretching";
export const JUST_FINISHED = "unwinding";
export const HANDING_OVER = "handingOver";
const HANDOFF_MS = 18_000;

const FREE_TIME_REACTION = Object.fromEntries(FREE_TIME.map((activity) => [activity.id, activity.reaction]));
export const freeTimeReaction = (activityId) => FREE_TIME_REACTION[activityId];

export const hasFreeTime = (agent) => !agent.endedAt && FREE_STATUSES.has(agent.status);

export function busyReactionOf(agent) {
  if (agent.endedAt) return "leaving";
  if (hasFreeTime(agent)) return null;
  switch (agent.status) {
    case "needs_you": return agent.activity === "asking" ? "asking" : "permission";
    case "blocked": return "blocked";
    case "reviewing": return agent.activity === "web" ? "browsing" : "reading";
    case "working": return WORKING_REACTIONS[agent.activity] ?? "typing";
    default: return "typing";
  }
}

export function isWindingDown(agent, now, freeSince) {
  return now !== null && now - freeSince < temperamentOf(agent.key).lingerMs;
}

export function isHandingOver(agent, now) {
  return agent.kind === "subagent" && Boolean(agent.endedAt) && now !== null && now - agent.endedAt < HANDOFF_MS;
}

function personalOrder(agentKey) {
  const random = rng(hashOf(agentKey));
  return FREE_TIME.map((activity) => [random(), activity.id]).sort(([a], [b]) => a - b).map(([, id]) => id);
}

// A null "now" (reduced motion) freezes people on their first choice.
export function freeTimePreferences(agent, now, freeSince) {
  const order = personalOrder(agent.key);
  const { lingerMs, freeTimeSlotMs } = temperamentOf(agent.key);
  const slot = now === null ? 0 : Math.max(0, Math.floor((now - freeSince - lingerMs) / freeTimeSlotMs));
  const start = slot % order.length;
  const rotated = [...order.slice(start), ...order.slice(0, start)];
  return slot === 0 ? [FIRST_FREE_ACTIVITY[agent.status], ...rotated] : rotated;
}
