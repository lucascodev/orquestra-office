import { persistedAgentOf } from "../../work/domain/persisted-work.js";

const mapValues = (record, map) => Object.fromEntries(Object.entries(record ?? {}).map(([key, value]) => [key, map(value)]));

// What goes to disk: the office as it is, minus the texts that only live while the collector runs.
export function savedOfficeStateOf(state) {
  if (!state?.projects) return state;
  return { ...state, projects: mapValues(state.projects, (project) => ({ ...project, agents: mapValues(project.agents, persistedAgentOf) })) };
}
