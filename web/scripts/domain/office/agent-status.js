export const KNOWN_STATUSES = new Set(["working", "reviewing", "needs_you", "waiting", "break", "blocked", "idle"]);
const SCREEN_LIT_STATUSES = new Set(["working", "reviewing", "needs_you", "waiting"]);

export const ACTIVE_STATUSES = new Set(["working", "reviewing", "needs_you", "waiting", "blocked"]);

export const statusOf = (agent) => (KNOWN_STATUSES.has(agent.status) ? agent.status : "idle");
export const isScreenLit = (agent) => SCREEN_LIT_STATUSES.has(agent.status);
