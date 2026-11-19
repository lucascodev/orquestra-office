export const needsYou = (project) => Object.values(project.agents).filter((agent) => agent.status === "needs_you").length;
