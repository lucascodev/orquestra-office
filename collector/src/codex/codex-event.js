import { PATH_LIMIT, SESSION_ID_LIMIT } from "../shared/text/field-limits.js";

export function normalizeCodexEvent(payload, now = Date.now()) {
  if (!payload || typeof payload !== "object") return null;
  if (payload.type !== "agent-turn-complete") return null;
  const threadId = String(payload["thread-id"] ?? payload.thread_id ?? "").slice(0, SESSION_ID_LIMIT);
  if (!threadId) return null;
  return {
    source: "codex",
    sessionId: threadId,
    agentId: null,
    agentType: null,
    cwd: typeof payload.cwd === "string" ? payload.cwd.slice(0, PATH_LIMIT) : "",
    at: now,
    kind: "activity",
    status: "waiting",
    action: "terminou o turno e espera você",
    counts: "turns",
  };
}
