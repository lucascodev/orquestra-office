import { teamsOf } from "../room/desk-islands.js";
import { ISLAND_SEATS } from "./island-grid.js";

// Creation order and not sortedProjects: that one moves projects up when they need you, and the islands would jump around.
const byCreation = (a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0) || a.key.localeCompare(b.key);
const byStart = (a, b) => a.startedAt - b.startedAt || a.key.localeCompare(b.key);

// teamsOf only knows subagents of a main agent present; the ones left behind sit together, after the other teams.
function teamsWithOrphans(project) {
  const teams = teamsOf(project);
  const seated = new Set(teams.flat().map((agent) => agent.key));
  const orphans = Object.values(project.agents).filter((agent) => !seated.has(agent.key)).sort(byStart);
  const orphanTeams = orphans.reduce((teamsByParent, agent) => teamsByParent.set(agent.parentKey, [...(teamsByParent.get(agent.parentKey) ?? []), agent]), new Map());
  return [...teams, ...orphanTeams.values()];
}

function homeFor(islands, size) {
  const home = islands.find((island) => island.length + size <= ISLAND_SEATS);
  if (home || size > ISLAND_SEATS) return home;
  islands.push([]);
  return islands.at(-1);
}

function freeChairOf(islands) {
  const island = islands.find((occupants) => occupants.length < ISLAND_SEATS);
  if (island) return island;
  islands.push([]);
  return islands.at(-1);
}

// A team goes whole to the first island with room for it, opening one more if needed; only a team bigger than an island is spread.
function seatTeams(teams, minimumIslands) {
  const islands = Array.from({ length: minimumIslands }, () => []);
  for (const team of teams) {
    const members = team.map((agent) => ({ agent }));
    const home = homeFor(islands, members.length);
    if (home) home.push(...members);
    else members.forEach((member) => freeChairOf(islands).push(member));
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
  const teams = teamsWithOrphans(project);
  const seated = teams.reduce((total, team) => total + team.length, 0);
  const minimumIslands = Math.max(1, Math.ceil(seated / ISLAND_SEATS));
  return withReservedChairs(seatTeams(teams, minimumIslands), unplayedRoles(project)).map((occupants) => ({ project, occupants }));
}

export function projectIslands(projects) {
  return Object.values(projects).sort(byCreation).flatMap(islandsOfProject).map((island, index) => ({ index, ...island }));
}
