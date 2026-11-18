export const needsYou = (project) => Object.values(project.agents).filter((agent) => agent.status === "needs_you").length;

export function sortedProjects(projects) {
  return Object.values(projects).sort((a, b) => needsYou(b) - needsYou(a) || b.updatedAt - a.updatedAt);
}
