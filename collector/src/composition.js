import { createBootstrapPairing } from "./access/application/bootstrap-pairing.js";
import { createIdentifyDevice } from "./access/application/identify-device.js";
import { createIssuePairingCode } from "./access/application/issue-pairing-code.js";
import { createRedeemPairing } from "./access/application/redeem-pairing.js";
import { createRevokeDevice } from "./access/application/revoke-device.js";
import { createBootstrapChallenges } from "./access/domain/bootstrap-challenges.js";
import { createDeviceSessions } from "./access/domain/device-sessions.js";
import { createLegacyHooksNotice } from "./access/domain/legacy-hooks-notice.js";
import { createPairingCodes } from "./access/domain/pairing-codes.js";
import { createDeviceSessionsFile } from "./access/infra/device-sessions-file.js";
import { createOfficeKey } from "./access/infra/office-key.js";
import { hashToken, newDeviceId, newPairingCode, newSessionToken } from "./access/infra/session-tokens.js";
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
import { createHookAuth } from "./http/hook-auth.js";
import { createHookRoutes } from "./http/hook-routes.js";
import { createOfficeApiRoutes } from "./http/office-api-routes.js";
import { createPairingRoutes } from "./http/pairing-routes.js";
import { createPanelAuth } from "./http/panel-auth.js";
import { createServer } from "./http/server.js";
import { runnerTicketMessage } from "./shared/auth/signed-message.js";
import { createPublicOfficeView } from "./office/application/public-office-view.js";
import { createRecordActivity } from "./office/application/record-activity.js";
import { createOfficeStore } from "./office/domain/office-store.js";
import { createOfficeStateFile } from "./office/infra/office-state-file.js";

const SWEEP_INTERVAL_MS = 30_000;

export function createOffice({ webDir, dataDir = null, holdMs, allowedHosts = [], secretFile = null }) {
  const stateFile = dataDir ? createOfficeStateFile(dataDir) : null;
  const store = createOfficeStore(stateFile?.load());
  if (stateFile) store.onChange(() => stateFile.scheduleSave(store.snapshot()));

  const decisions = createPendingDecisions({ holdMs });
  const outbox = createOutbox();
  const history = createSessionHistory();
  const officeKey = createOfficeKey({ secretFile });
  const legacyHooks = createLegacyHooksNotice();
  const security = () => ({ legacyHooksSeenAt: legacyHooks.seenAt(), isSecretMissing: officeKey.isMissing() });
  const officeView = createPublicOfficeView({ store, decisions, outbox, security });
  const stream = createEventStream({ snapshot: officeView, sources: [store, decisions, outbox, legacyHooks] });

  const devicesFile = dataDir ? createDeviceSessionsFile(dataDir) : null;
  const deviceSessions = createDeviceSessions({ saved: devicesFile?.load(), keyId: officeKey.keyId(), newId: newDeviceId });
  if (devicesFile) deviceSessions.onChange(() => devicesFile.save(deviceSessions.snapshot()));
  deviceSessions.onChange(() => stream.keepDevices(new Set(deviceSessions.list().map((device) => device.id))));
  // A rotated secret is noticed on the next read of the key; checking it here too means a page paired under the old key
  // stops holding requests the moment one arrives, not on the next sweep. A missing secret drops nobody: it may be mid-rotation.
  function applyCurrentKey() {
    const keyId = officeKey.keyId();
    if (keyId) deviceSessions.useKey(keyId);
  }
  const pairingCodes = createPairingCodes({ newCode: newPairingCode });
  const bootstrapChallenges = createBootstrapChallenges({ newChallenge: newPairingCode });
  const issuePairingCode = createIssuePairingCode({ pairingCodes, lanHosts: allowedHosts });
  const currentKeyId = () => officeKey.keyId();
  const hookAuth = createHookAuth({ officeKey });
  const panelAuth = createPanelAuth({
    identifyDevice: createIdentifyDevice({ deviceSessions, hashToken, currentKeyId }),
    isSecretMissing: () => officeKey.isMissing(),
  });

  const activity = createRecordActivity({ store, history });
  const hasViewers = () => {
    applyCurrentKey();
    return stream.viewerCount() > 0;
  };
  const holdRequest = createHoldRequest({ decisions, hasViewers });
  const hookRoutes = createHookRoutes({
    store,
    activity,
    holdPermission: createHoldPermission({ holdRequest, activity }),
    holdQuestion: createHoldQuestion({ holdRequest, activity }),
    deliverQueuedMessages: createDeliverQueuedMessages({ store, outbox }),
    hookAuth,
    legacyHooks,
  });
  const officeApi = createOfficeApiRoutes({
    store,
    history,
    stream,
    officeView,
    decidePendingRequest: createDecidePendingRequest({ decisions }),
    sendMessageToAgent: createSendMessageToAgent({ store, outbox, history }),
    panelAuth,
    signRunnerTicket: (nonce) => officeKey.sign(runnerTicketMessage(nonce)),
  });
  const pairingRoutes = createPairingRoutes({
    hookAuth,
    panelAuth,
    issueBootstrapChallenge: () => bootstrapChallenges.issue(),
    bootstrapPairing: createBootstrapPairing({ bootstrapChallenges, issuePairingCode }),
    issuePairingCode,
    redeemPairing: createRedeemPairing({ pairingCodes, deviceSessions, newSessionToken, hashToken, currentKeyId }),
    revokeDevice: createRevokeDevice({ deviceSessions }),
    listDevices: () => deviceSessions.list(),
  });
  const server = createServer({ allowedHosts, webDir, hookRoutes, pairingRoutes, officeApi });

  let sweepTimer = null;

  // A sweep that throws inside the timer would take the whole collector down with it.
  function sweepSafely() {
    try {
      store.sweep(Date.now());
      legacyHooks.sweep();
      applyCurrentKey();
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

  return { server, store, decisions, officeView, isSecretMissing: () => officeKey.isMissing(), startSweep, stop };
}
