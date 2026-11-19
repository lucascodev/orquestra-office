export const COUNTDOWN_WARNING_MS = 30_000;

const deadlineOf = (request) => request.expiresAt ?? Number.POSITIVE_INFINITY;

function byDeadline(a, b) {
  return deadlineOf(a) - deadlineOf(b) || (a.createdAt ?? 0) - (b.createdAt ?? 0) || a.id.localeCompare(b.id);
}

const remainingOf = (request, now) => (request.expiresAt ? Math.max(0, request.expiresAt - now) : null);

export function pendingInFocus(pending, { shownId = null, now }) {
  if (pending.length === 0) return null;
  const ordered = [...pending].sort(byDeadline);
  const shownIndex = ordered.findIndex((request) => request.id === shownId);
  const index = Math.max(0, shownIndex);
  const request = ordered[index];
  return {
    request,
    position: index + 1,
    total: ordered.length,
    remainingMs: remainingOf(request, now),
    previousId: ordered[index - 1]?.id ?? null,
    nextId: ordered[index + 1]?.id ?? null,
  };
}

export const newArrivals = (knownIds, pending) => pending.filter((request) => !knownIds.has(request.id)).sort(byDeadline);

export function crossesWarning(previousMs, remainingMs) {
  if (previousMs === null || remainingMs === null) return false;
  return previousMs > COUNTDOWN_WARNING_MS && remainingMs <= COUNTDOWN_WARNING_MS;
}

export function requesterOf(projects, agentKey) {
  for (const project of Object.values(projects)) {
    const agent = Object.hasOwn(project.agents, agentKey) ? project.agents[agentKey] : null;
    if (agent) return { name: agent.name, projectName: project.name };
  }
  return null;
}
