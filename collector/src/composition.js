import { createDecidePendingRequest } from "./control/application/decide-pending-request.js";
import { createDeliverQueuedMessages } from "./control/application/deliver-queued-messages.js";
import { createHoldPermission } from "./control/application/hold-permission.js";
import { createHoldQuestion } from "./control/application/hold-question.js";
import { createHoldRequest } from "./control/application/hold-request.js";
import { createSendMessageToAgent } from "./control/application/send-message-to-agent.js";
import { createOutbox } from "./control/domain/outbox.js";
import { createPendingDecisions } from "./control/domain/pending-decisions.js";
import { createSessionHistory } from "./history/session-history.js";
import { createEventStream } from "./http/event-stream.js";
import { createHookRoutes } from "./http/hook-routes.js";
import { createOfficeApiRoutes } from "./http/office-api-routes.js";
import { createServer } from "./http/server.js";
import { createPublicOfficeView } from "./office/application/public-office-view.js";
import { createRecordActivity } from "./office/application/record-activity.js";
import { createOfficeStore } from "./office/domain/office-store.js";
import { createOfficeStateFile } from "./office/infra/office-state-file.js";

const SWEEP_INTERVAL_MS = 30_000;

export function createOffice({ webDir, dataDir = null, holdMs, allowedHosts = [] }) {
  const stateFile = dataDir ? createOfficeStateFile(dataDir) : null;
  const store = createOfficeStore(stateFile?.load());
  if (stateFile) store.onChange(() => stateFile.scheduleSave(store.snapshot()));

  const decisions = createPendingDecisions({ holdMs });
  const outbox = createOutbox();
  const history = createSessionHistory();
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
  const server = createServer({ allowedHosts, webDir, hookRoutes, officeApi });

  let sweepTimer = null;

  // A sweep that throws inside the timer would take the whole collector down with it.
  function sweepSafely() {
    try {
      store.sweep(Date.now());
    } catch (error) {
      console.error("office sweep failed:", error);
    }
  }

  function startSweep() {
    sweepTimer = setInterval(sweepSafely, SWEEP_INTERVAL_MS);
  }

  function stop() {
    clearInterval(sweepTimer);
    stateFile?.saveNow(store.snapshot());
  }

  return { server, store, decisions, startSweep, stop };
}
