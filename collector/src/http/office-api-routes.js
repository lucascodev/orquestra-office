import { OUTCOME } from "../control/application/outcome.js";
import { isNonce } from "../shared/auth/signed-message.js";
import { readJsonBody, sendJson } from "./json-io.js";
import { decodePathSegment } from "./url-path.js";

const API_BODY_LIMIT = 64 * 1024;
const STATUS_OF_OUTCOME = { [OUTCOME.DONE]: 200, [OUTCOME.NOT_FOUND]: 404, [OUTCOME.INVALID]: 400 };
const TEMPLATE_ROUTE = /^\/api\/projects\/(.+)\/template$/;
const CLOSE_ROUTE = /^\/api\/projects\/(.+)\/close$/;
const DECISION_ROUTE = /^\/api\/decisions\/([\w-]+)$/;
const MESSAGE_ROUTE = "/api/agents/message";
const RUNNER_TICKET_ROUTE = "/api/runner-ticket";

export function createOfficeApiRoutes({ store, history, stream, officeView, decidePendingRequest, sendMessageToAgent, panelAuth, signRunnerTicket }) {
  // The runner on this machine trusts a page that brings its nonce signed with the office key; only a paired page gets one.
  function runnerTicket(res, nonce) {
    if (!isNonce(nonce)) return sendJson(res, 400, { error: "invalid nonce" });
    const ticket = signRunnerTicket(nonce);
    return ticket ? sendJson(res, 200, { ticket }) : sendJson(res, 503, { error: "office secret missing" });
  }

  async function post(req, res, url) {
    const body = await readJsonBody(req, API_BODY_LIMIT);

    const templateRoute = url.pathname.match(TEMPLATE_ROUTE);
    if (templateRoute) {
      const projectKey = decodePathSegment(templateRoute[1]);
      return sendJson(res, projectKey !== null && store.setTemplate(projectKey, body?.template) ? 200 : 400, {});
    }
    const closeRoute = url.pathname.match(CLOSE_ROUTE);
    if (closeRoute) {
      const projectKey = decodePathSegment(closeRoute[1]);
      return sendJson(res, projectKey !== null && store.closeProject(projectKey) ? 200 : 404, {});
    }
    const decisionRoute = url.pathname.match(DECISION_ROUTE);
    if (decisionRoute) return sendJson(res, STATUS_OF_OUTCOME[decidePendingRequest(decisionRoute[1], body)], {});
    if (url.pathname === RUNNER_TICKET_ROUTE) return runnerTicket(res, body?.nonce);
    if (url.pathname === MESSAGE_ROUTE) return sendJson(res, STATUS_OF_OUTCOME[sendMessageToAgent({ agentKey: body?.key, text: body?.text })], {});
    return sendJson(res, 404, {});
  }

  // Loading the state is what the page does on every visit, so the cookie is renewed there for another 90 days.
  const getRoutes = {
    "/api/state": (req, res, url, session) => sendJson(res, 200, officeView(), { "Set-Cookie": panelAuth.sessionCookie(session.token) }),
    "/api/stream": (req, res, url, session) => stream.subscribe(req, res, session.device.id),
    "/api/agents/history": (req, res, url) => sendJson(res, 200, { entries: history.of(url.searchParams.get("key") ?? "") }),
  };

  function get(req, res, url, session) {
    if (!Object.hasOwn(getRoutes, url.pathname)) return sendJson(res, 404, {});
    return getRoutes[url.pathname](req, res, url, session);
  }

  // Every /api route needs a paired device; without one the answer is 401, whatever the path.
  async function handle(req, res, url) {
    if (req.method !== "GET" && req.method !== "POST") return sendJson(res, 405, {});
    const session = panelAuth.admit(req, res);
    if (!session) return undefined;
    return req.method === "GET" ? get(req, res, url, session) : post(req, res, url);
  }

  return { handle };
}
