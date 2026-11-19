import { dictionaryOf } from "./dictionary.js";
import { emptyTimeline, restoredTimeline } from "./status-timeline.js";

const NO_USAGE = Object.freeze({ rateLimits: null, updatedAt: 0 });

function restoredProjects(projects) {
  const entries = Object.entries(dictionaryOf(projects)).map(([key, project]) => [key, { ...project, agents: dictionaryOf(project?.agents) }]);
  return dictionaryOf(Object.fromEntries(entries));
}

export function officeStateFrom(saved) {
  if (!saved?.projects) {
    return { projects: dictionaryOf(), sessions: dictionaryOf(), meters: dictionaryOf(), usage: { ...NO_USAGE }, timeline: emptyTimeline() };
  }
  return {
    projects: restoredProjects(saved.projects),
    sessions: dictionaryOf(saved.sessions),
    meters: dictionaryOf(saved.meters),
    usage: saved.usage ?? { ...NO_USAGE },
    timeline: restoredTimeline(saved.timeline),
  };
}
