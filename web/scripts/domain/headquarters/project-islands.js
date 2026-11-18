import { teamsOf } from "../room/desk-islands.js";
import { ISLAND_SEATS } from "./island-grid.js";

// Creation order and not sortedProjects: that one moves projects up when they need you, and the islands would jump around.
const byCreation = (a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0) || a.key.localeCompare(b.key);

// A team goes whole to the first island with room for it; only a team that fits nowhere is spread over the free chairs.
function seatTeams(teams, islandCount) {
  const islands = Array.from({ length: islandCount }, () => []);
  for (const team of teams) {
    const members = team.map((agent) => ({ agent }));
    const home = islands.find((island) => island.length + members.length <= ISLAND_SEATS);
    if (home) home.push(...members);
    else members.forEach((member) => islands.find((island) => island.length < ISLAND_SEATS).push(member));
  }
  return islands;
}

function unplayedRoles(project) {
  const present = new Set(Object.values(project.agents).filter((agent) => !agent.endedAt).map((agent) => agent.label));
  return (project.team ?? []).filter((role) => !present.has(role));
}

// Roles only take chairs the project's people left empty: a role that does not fit is not shown.
function withReservedChairs(islands, roles) {
  let next = 0;
  return islands.map((occupants) => {
    const reserved = roles.slice(next, next + ISLAND_SEATS - occupants.length).map((role) => ({ role }));
    next += reserved.length;
    return [...occupants, ...reserved];
  });
}

function islandsOfProject(project) {
  const teams = teamsOf(project);
  const seated = teams.reduce((total, team) => total + team.length, 0);
  const islandCount = Math.max(1, Math.ceil(seated / ISLAND_SEATS));
  return withReservedChairs(seatTeams(teams, islandCount), unplayedRoles(project)).map((occupants) => ({ project, occupants }));
}

export function projectIslands(projects) {
  return Object.values(projects).sort(byCreation).flatMap(islandsOfProject).map((island, index) => ({ index, ...island }));
}
