import { isRecord } from "../shared/is-record.js";
import { workEventsOf } from "./work-event.js";

const newer = (newest, event) => (newest === null || event.at > newest.at ? event : newest);

const agentsOf = (project) => (isRecord(project) && isRecord(project.agents) ? Object.values(project.agents) : []);

function eventsOfAgent(agent, project, dayStart) {
  return workEventsOf(agent)
    .filter((event) => event.at >= dayStart)
    .map((event) => ({ ...event, agentKey: agent.key, agentName: agent.name, projectName: project.name }));
}

// The newest test result or approved plan of the day across the whole headquarters, or null when there is none yet.
export function latestWorkEvent(projects, { dayStart }) {
  const events = Object.values(isRecord(projects) ? projects : {})
    .flatMap((project) => agentsOf(project).flatMap((agent) => eventsOfAgent(agent, project, dayStart)));
  return events.reduce(newer, null);
}
