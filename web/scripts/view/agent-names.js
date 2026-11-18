import { hashOf } from "../domain/shared/seeded-random.js";
import { FIRST_NAMES } from "../data/first-names.js";

function firstFreeIndex(preferred, taken) {
  let index = preferred;
  for (let tries = 0; taken.has(index) && tries < FIRST_NAMES.length; tries += 1) index = (index + 1) % FIRST_NAMES.length;
  return index;
}

// Ordered by key, not by start time: start times change while the office is open and would shuffle names between colleagues.
function namesFor(agents) {
  const taken = new Set();
  const names = new Map();
  for (const agent of [...agents].sort((a, b) => a.key.localeCompare(b.key))) {
    const index = firstFreeIndex(hashOf(agent.key) % FIRST_NAMES.length, taken);
    taken.add(index);
    names.set(agent.key, FIRST_NAMES[index]);
  }
  return names;
}

export function withAgentNames(project) {
  const names = namesFor(Object.values(project.agents));
  const agents = Object.fromEntries(Object.entries(project.agents).map(([key, agent]) => [key, { ...agent, name: names.get(agent.key) }]));
  return { ...project, agents };
}
