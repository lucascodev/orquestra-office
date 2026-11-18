import { claudeActorOf, normalizeClaudeEvent } from "../claude/claude-event.js";
import { claudeHistoryEntry } from "../claude/claude-history-entry.js";
import { questionsOf } from "../claude/hook-questions.js";
import { continueWithMessages, NO_DECISION, permissionResponse, questionResponse } from "../claude/hook-responses.js";
import { normalizeStatusline } from "../claude/statusline-reading.js";
import { normalizeCodexEvent } from "../codex/codex-event.js";
import { isJson, readJsonBody, sendJson } from "./request-guard.js";

const EVENT_BODY_LIMIT = 8 * 1024 * 1024;

export function createHookRoutes({ store, activity, holdPermission, holdQuestion, deliverQueuedMessages }) {
  const actorOf = (payload) => (payload?.session_id ? claudeActorOf(payload) : null);
  const record = (payload) => activity.record(normalizeClaudeEvent(payload), claudeHistoryEntry(payload));

  async function permission(payload, onAbort) {
    record(payload);
    const answer = await holdPermission({ actor: actorOf(payload), toolName: payload?.tool_name, toolInput: payload?.tool_input, onAbort });
    return answer ? permissionResponse(answer.behavior, answer.message) : NO_DECISION;
  }

  async function question(payload, onAbort) {
    const answer = await holdQuestion({ actor: actorOf(payload), questions: questionsOf(payload?.tool_input), onAbort });
    return answer ? questionResponse(payload.tool_input.questions, answer.answers) : NO_DECISION;
  }

  function stop(payload) {
    record(payload);
    const messages = deliverQueuedMessages(actorOf(payload));
    return messages.length > 0 ? continueWithMessages(messages) : NO_DECISION;
  }

  const routes = {
    "/events/claude": (payload) => { record(payload); return NO_DECISION; },
    "/events/codex": (payload) => { store.apply(normalizeCodexEvent(payload)); return NO_DECISION; },
    "/events/statusline": (payload) => { store.recordUsage(normalizeStatusline(payload)); return NO_DECISION; },
    "/hooks/claude/permission": permission,
    "/hooks/claude/question": question,
    "/hooks/claude/stop": stop,
  };

  async function handle(req, res, url) {
    if (!isJson(req)) return sendJson(res, 415, {});
    const payload = await readJsonBody(req, EVENT_BODY_LIMIT);
    const onAbort = (abort) => res.on("close", () => { if (!res.writableFinished) abort(); });
    return sendJson(res, 200, await routes[url.pathname](payload, onAbort));
  }

  return { handles: (pathname) => Object.hasOwn(routes, pathname), handle };
}
