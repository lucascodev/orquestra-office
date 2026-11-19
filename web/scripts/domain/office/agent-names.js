import { FIRST_NAMES } from "../../data/first-names.js";
import { hashOf } from "../shared/seeded-random.js";

function firstFreeIndex(preferred, taken) {
  let index = preferred;
  for (let tries = 0; taken.has(index) && tries < FIRST_NAMES.length; tries += 1) index = (index + 1) % FIRST_NAMES.length;
  return index;
}

// Ordered by key, not by start time: start times change while the office is open and would shuffle names between colleagues.
function namesFor(agents, taken = new Set()) {
  const names = new Map();
  for (const agent of [...agents].sort((a, b) => a.key.localeCompare(b.key))) {
    const index = firstFreeIndex(hashOf(agent.key) % FIRST_NAMES.length, taken);
    taken.add(index);
    names.set(agent.key, FIRST_NAMES[index]);
  }
  return names;
}

const withNames = (project, names) => ({
  ...project,
  agents: Object.fromEntries(Object.entries(project.agents).map(([key, agent]) => [key, { ...agent, name: names.get(agent.key) ?? agent.name }])),
});

// In the headquarters names are unique in the whole building; a name the agent already brings is kept and stays taken.
export function withBuildingAgentNames(projects) {
  const agents = Object.values(projects).flatMap((project) => Object.values(project.agents));
  const named = agents.filter((agent) => agent.name);
  const taken = new Set(named.map((agent) => FIRST_NAMES.indexOf(agent.name)).filter((index) => index >= 0));
  const names = namesFor(agents.filter((agent) => !agent.name), taken);
  return Object.fromEntries(Object.entries(projects).map(([key, project]) => [key, withNames(project, names)]));
}
