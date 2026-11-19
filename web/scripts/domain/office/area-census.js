import { areaOfPoint } from "../headquarters/area-of-point.js";
import { statusOf } from "./agent-status.js";

export const COMMON_ROOMS = ["meeting", "pantry", "games", "lounge"];
export const STATUS_PRIORITY = ["needs_you", "blocked", "working", "waiting", "break", "idle"];
const FOLDED_STATUS = { reviewing: "working" };

export const statusGroupOf = (status) => FOLDED_STATUS[status] ?? status;
const groupOf = (agent) => statusGroupOf(statusOf(agent));

function countByStatus(agents) {
  const counts = new Map();
  for (const agent of agents) counts.set(groupOf(agent), (counts.get(groupOf(agent)) ?? 0) + 1);
  return STATUS_PRIORITY.filter((status) => counts.has(status)).map((status) => ({ status, count: counts.get(status) }));
}

function projectsOnTheFloor(layout, projects) {
  const seen = new Map();
  for (const island of layout.islands) {
    if (!island.projectKey || seen.has(island.projectKey) || !Object.hasOwn(projects, island.projectKey)) continue;
    seen.set(island.projectKey, island.theme.id);
  }
  return [...seen].map(([key, themeId]) => {
    const agents = Object.values(projects[key].agents);
    return { key, name: projects[key].name, themeId, total: agents.length, byStatus: countByStatus(agents) };
  });
}

// People are counted in a common room by where they are headed, which changes less often than where they stand.
function commonRooms(layout, stops) {
  const counts = new Map();
  for (const stop of stops.values()) {
    const areaId = areaOfPoint(layout, stop);
    counts.set(areaId, (counts.get(areaId) ?? 0) + 1);
  }
  return layout.areas.filter((area) => COMMON_ROOMS.includes(area.id)).map(({ id, name }) => ({ id, name, count: counts.get(id) ?? 0 }));
}

export function areaCensus({ layout, projects, stops }) {
  const listed = projectsOnTheFloor(layout, projects);
  return {
    total: listed.reduce((sum, project) => sum + project.total, 0),
    projects: listed,
    areas: commonRooms(layout, stops),
  };
}
