import { claudeActorOf, normalizeClaudeEvent } from "../claude/claude-event.js";
import { claudeHistoryEntry } from "../claude/claude-history-entry.js";
import { questionsOf } from "../claude/hook-questions.js";
import { answersOf, permissionDecisionOf, queuedMessagesOf } from "../claude/hook-responses.js";
import { normalizeStatusline } from "../claude/statusline-reading.js";
import { normalizeCodexEvent } from "../codex/codex-event.js";
import { HOOK_ACCESS } from "./hook-auth.js";
import { parseJsonOrNull, readRawBody, sendJson, sendJsonText } from "./json-io.js";
import { isJson } from "./request-policy.js";

const EVENT_BODY_LIMIT = 8 * 1024 * 1024;
const OK_STATUS = 200;
const LEGACY_ANSWER = Object.freeze({});

export function createHookRoutes({ store, activity, holdPermission, holdQuestion, deliverQueuedMessages, hookAuth, legacyHooks }) {
  const actorOf = (payload) => (payload?.session_id ? claudeActorOf(payload) : null);
  const record = (payload) => activity.record(normalizeClaudeEvent(payload), claudeHistoryEntry(payload));

  async function permission(payload, onAbort) {
    record(payload);
    return permissionDecisionOf(await holdPermission({ actor: actorOf(payload), toolName: payload?.tool_name, toolInput: payload?.tool_input, onAbort }));
  }

  async function question(payload, onAbort) {
    return answersOf(await holdQuestion({ actor: actorOf(payload), questions: questionsOf(payload?.tool_input), onAbort }));
  }

  function stop(payload) {
    record(payload);
    return queuedMessagesOf(deliverQueuedMessages(actorOf(payload)));
  }

  const activityRoutes = {
    "/events/claude": record,
    "/events/codex": (payload) => store.apply(normalizeCodexEvent(payload)),
    "/events/statusline": (payload) => store.recordUsage(normalizeStatusline(payload)),
  };

  const signedRoutes = {
    "/hooks/claude/permission": permission,
    "/hooks/claude/question": question,
    "/hooks/claude/stop": stop,
  };

  // Hooks from before the signatures get the empty answer Claude Code reads as "no decision", so nothing breaks in the terminal.
  function answerLegacy(res) {
    legacyHooks.see();
    return sendJson(res, OK_STATUS, LEGACY_ANSWER);
  }

  function handleActivity(req, res, path, body) {
    const access = hookAuth.activityAccessOf(req);
    if (access === HOOK_ACCESS.REFUSED) return sendJson(res, 401, { error: "invalid token" });
    if (access === HOOK_ACCESS.LEGACY) return answerLegacy(res);
    activityRoutes[path](parseJsonOrNull(body));
    return sendJson(res, OK_STATUS, {});
  }

  async function handleSigned(req, res, path, body) {
    const { access, nonce } = hookAuth.signedAccessOf(req, path, body);
    if (access === HOOK_ACCESS.REFUSED) return sendJson(res, 401, { error: "invalid signature" });
    if (access === HOOK_ACCESS.LEGACY) return answerLegacy(res);
    const onAbort = (abort) => res.on("close", () => { if (!res.writableFinished) abort(); });
    const text = JSON.stringify(await signedRoutes[path](parseJsonOrNull(body), onAbort));
    const signature = hookAuth.responseSignatureOf({ path, nonce, status: OK_STATUS, body: text });
    if (!signature) return sendJson(res, 401, { error: "office secret missing" });
    return sendJsonText(res, OK_STATUS, text, signature);
  }

  async function handle(req, res, url) {
    if (!isJson(req)) return sendJson(res, 415, {});
    const body = await readRawBody(req, EVENT_BODY_LIMIT);
    if (Object.hasOwn(activityRoutes, url.pathname)) return handleActivity(req, res, url.pathname, body);
    return handleSigned(req, res, url.pathname, body);
  }

  const handles = (pathname) => Object.hasOwn(activityRoutes, pathname) || Object.hasOwn(signedRoutes, pathname);

  return { handles, handle };
}
