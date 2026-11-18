import { createServer as createHttpServer } from "node:http";
import { createDecidePendingRequest } from "../control/application/decide-pending-request.js";
import { createDeliverQueuedMessages } from "../control/application/deliver-queued-messages.js";
import { createHoldPermission } from "../control/application/hold-permission.js";
import { createHoldQuestion } from "../control/application/hold-question.js";
import { createHoldRequest } from "../control/application/hold-request.js";
import { createSendMessageToAgent } from "../control/application/send-message-to-agent.js";
import { createOutbox } from "../control/domain/outbox.js";
import { createPendingDecisions } from "../control/domain/pending-decisions.js";
import { createSessionHistory } from "../history/session-history.js";
import { createPublicOfficeView } from "../office/application/public-office-view.js";
import { createRecordActivity } from "../office/application/record-activity.js";
import { createEventStream } from "./event-stream.js";
import { createHookRoutes } from "./hook-routes.js";
import { createOfficeApiRoutes } from "./office-api-routes.js";
import { createHostPolicy, sendJson } from "./request-guard.js";
import { serveFile } from "./static-files.js";

export function createServer({ store, webDir, allowedHosts = [], decisions = createPendingDecisions(), outbox = createOutbox(), history = createSessionHistory() }) {
  const hosts = createHostPolicy(allowedHosts);
  const officeView = createPublicOfficeView({ store, decisions, outbox });
  const stream = createEventStream({ snapshot: officeView, sources: [store, decisions, outbox] });
  const activity = createRecordActivity({ store, history });
  const holdRequest = createHoldRequest({ decisions, hasViewers: () => stream.viewerCount() > 0 });
  const hookRoutes = createHookRoutes({
    store,
    activity,
    holdPermission: createHoldPermission({ holdRequest, activity }),
    holdQuestion: createHoldQuestion({ holdRequest, activity }),
    deliverQueuedMessages: createDeliverQueuedMessages({ store, outbox }),
  });
  const officeApi = createOfficeApiRoutes({
    store,
    history,
    stream,
    officeView,
    decidePendingRequest: createDecidePendingRequest({ decisions }),
    sendMessageToAgent: createSendMessageToAgent({ store, outbox, history }),
  });

  async function handleGet(req, res, url) {
    if (officeApi.handlesGet(url.pathname)) return officeApi.get(req, res, url);
    if (await serveFile(res, webDir, url.pathname)) return undefined;
    return sendJson(res, 404, {});
  }

  return createHttpServer(async (req, res) => {
    if (!hosts.allows(req)) return sendJson(res, 403, { error: "forbidden host" });
    const url = new URL(req.url ?? "/", "http://localhost");

    if (req.method === "POST" && hookRoutes.handles(url.pathname)) return hookRoutes.handle(req, res, url);
    if (req.method === "POST") return officeApi.post(req, res, url);
    if (req.method !== "GET") return sendJson(res, 405, {});
    return handleGet(req, res, url);
  });
}
