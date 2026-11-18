import { hasFreeTime } from "./agent-reactions.js";

export function createFreeTimeClock() {
  let freeSince = new Map();
  return function observe(agents) {
    const next = new Map();
    for (const agent of agents) {
      if (hasFreeTime(agent)) next.set(agent.key, freeSince.get(agent.key) ?? agent.updatedAt);
    }
    freeSince = next;
    return next;
  };
}
