import { createServer as createHttpServer } from "node:http";
import { createOutbox } from "../control/domain/outbox.js";
import { createPendingDecisions } from "../control/domain/pending-decisions.js";
import { normalizeCodexEvent } from "../codex/codex-event.js";
import { createSessionHistory } from "../history/session-history.js";
import { createClaudeRoutes } from "./claude-routes.js";
import { createEventStream } from "./event-stream.js";
import { createOfficeApi } from "./office-api.js";
import { createHostPolicy, isJson, isSameOrigin, readJsonBody, sendJson } from "./request-guard.js";
import { serveFile } from "./static-files.js";

const EVENT_BODY_LIMIT = 8 * 1024 * 1024;
const API_BODY_LIMIT = 64 * 1024;

function publicView(store, decisions, outbox) {
  const { meters, ...office } = store.snapshot();
  return { ...office, pending: decisions.list(), outbox: outbox.counts() };
}

export function createServer({ store, webDir, allowedHosts = [], decisions = createPendingDecisions(), outbox = createOutbox(), history = createSessionHistory() }) {
  const hosts = createHostPolicy(allowedHosts);
  const view = () => publicView(store, decisions, outbox);
  const stream = createEventStream({ snapshot: view, sources: [store, decisions, outbox] });
  const claudeRoutes = createClaudeRoutes({ store, decisions, outbox, history, hasViewers: () => stream.viewerCount() > 0 });
  const api = createOfficeApi({ store, decisions, outbox, history });

  async function handleHook(req, res, url) {
    if (!isJson(req)) return sendJson(res, 415, {});
    const payload = await readJsonBody(req, EVENT_BODY_LIMIT);
    if (url.pathname === "/events/codex") {
      store.apply(normalizeCodexEvent(payload));
      return sendJson(res, 200, {});
    }
    const onAbort = (abort) => res.on("close", () => { if (!res.writableFinished) abort(); });
    return sendJson(res, 200, await claudeRoutes[url.pathname](payload, onAbort));
  }

  async function handleApiPost(req, res, url) {
    if (!isJson(req)) return sendJson(res, 415, {});
    if (!isSameOrigin(req)) return sendJson(res, 403, { error: "forbidden origin" });
    const body = await readJsonBody(req, API_BODY_LIMIT);

    const templateRoute = url.pathname.match(/^\/api\/projects\/(.+)\/template$/);
    if (templateRoute) return sendJson(res, store.setTemplate(decodeURIComponent(templateRoute[1]), body?.template) ? 200 : 400, {});
    const closeRoute = url.pathname.match(/^\/api\/projects\/(.+)\/close$/);
    if (closeRoute) return sendJson(res, store.closeProject(decodeURIComponent(closeRoute[1])) ? 200 : 404, {});
    const decisionRoute = url.pathname.match(/^\/api\/decisions\/([\w-]+)$/);
    if (decisionRoute) return sendJson(res, api.decide(decisionRoute[1], body), {});
    if (url.pathname === "/api/agents/message") return sendJson(res, api.sendMessage(body), {});
    return sendJson(res, 404, {});
  }

  async function handleGet(res, url, req) {
    if (url.pathname === "/api/state") return sendJson(res, 200, view());
    if (url.pathname === "/api/stream") return stream.subscribe(req, res);
    if (url.pathname === "/api/agents/history") return sendJson(res, 200, { entries: api.historyOf(url.searchParams.get("key") ?? "") });
    if (await serveFile(res, webDir, url.pathname)) return undefined;
    return sendJson(res, 404, {});
  }

  return createHttpServer(async (req, res) => {
    if (!hosts.allows(req)) return sendJson(res, 403, { error: "forbidden host" });
    const url = new URL(req.url ?? "/", "http://localhost");
    const isHook = url.pathname === "/events/codex" || Object.hasOwn(claudeRoutes, url.pathname);

    if (req.method === "POST" && isHook) return handleHook(req, res, url);
    if (req.method === "POST") return handleApiPost(req, res, url);
    if (req.method !== "GET") return sendJson(res, 405, {});
    return handleGet(res, url, req);
  });
}
