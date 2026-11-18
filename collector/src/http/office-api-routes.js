import { OUTCOME } from "../control/application/outcome.js";
import { readJsonBody, sendJson } from "./json-io.js";
import { isCrossSite, isJson, isSameOrigin } from "./request-policy.js";
import { decodePathSegment } from "./url-path.js";

const API_BODY_LIMIT = 64 * 1024;
const STATUS_OF_OUTCOME = { [OUTCOME.DONE]: 200, [OUTCOME.NOT_FOUND]: 404, [OUTCOME.INVALID]: 400 };
const TEMPLATE_ROUTE = /^\/api\/projects\/(.+)\/template$/;
const CLOSE_ROUTE = /^\/api\/projects\/(.+)\/close$/;
const DECISION_ROUTE = /^\/api\/decisions\/([\w-]+)$/;
const MESSAGE_ROUTE = "/api/agents/message";

export function createOfficeApiRoutes({ store, history, stream, officeView, decidePendingRequest, sendMessageToAgent }) {
  async function post(req, res, url) {
    if (!isJson(req)) return sendJson(res, 415, {});
    if (!isSameOrigin(req)) return sendJson(res, 403, { error: "forbidden origin" });
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
    if (url.pathname === MESSAGE_ROUTE) return sendJson(res, STATUS_OF_OUTCOME[sendMessageToAgent({ agentKey: body?.key, text: body?.text })], {});
    return sendJson(res, 404, {});
  }

  const getRoutes = {
    "/api/state": (req, res) => sendJson(res, 200, officeView()),
    "/api/stream": (req, res) => stream.subscribe(req, res),
    "/api/agents/history": (req, res, url) => sendJson(res, 200, { entries: history.of(url.searchParams.get("key") ?? "") }),
  };

  function get(req, res, url) {
    if (isCrossSite(req)) return sendJson(res, 403, { error: "forbidden site" });
    return getRoutes[url.pathname](req, res, url);
  }

  return { post, get, handlesGet: (pathname) => Object.hasOwn(getRoutes, pathname) };
}
