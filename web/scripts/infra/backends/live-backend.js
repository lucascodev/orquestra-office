import { officeApi, UnpairedError } from "../office-api.js";
import { runnerClient } from "../runner-client.js";

const RUNNER_POLL_MS = 4_000;
const EMPTY_OFFICE = Object.freeze({ projects: {} });

// pairingCode comes from the #pair= fragment the opener or a QR code put in the address; it is redeemed before anything else.
export function createLiveBackend({ pairingCode = null, deviceLabel = "" } = {}) {
  let mode = "connecting";
  let office = EMPTY_OFFICE;
  let runner = { isAvailable: false, sessions: [] };
  let notify = () => {};
  let stopWatching = () => {};
  let runnerTimer = null;

  const publish = () => notify({ mode, office, runner });

  async function refreshRunner() {
    const sessions = await runnerClient.listSessions();
    const next = { isAvailable: sessions !== null, sessions: sessions ?? [] };
    if (JSON.stringify(next) === JSON.stringify(runner)) return;
    runner = next;
    publish();
  }

  function showUnpaired(error) {
    stopWatching();
    clearInterval(runnerTimer);
    mode = "unpaired";
    office = { ...EMPTY_OFFICE, security: { legacyHooksSeenAt: null, isSecretMissing: error.isSecretMissing } };
    runner = { isAvailable: false, sessions: [] };
    publish();
  }

  // The stream cannot tell a revoked device from a dropped connection, so a failure asks the state which one it was.
  async function recheckPairing() {
    try {
      await officeApi.loadState();
    } catch (error) {
      if (error instanceof UnpairedError) showUnpaired(error);
    }
  }

  function listen() {
    mode = "live";
    stopWatching = officeApi.watchState({
      onState: (state) => { office = state; mode = "live"; publish(); },
      onError: () => { mode = "offline"; publish(); recheckPairing(); },
    });
    refreshRunner();
    runnerTimer = setInterval(refreshRunner, RUNNER_POLL_MS);
  }

  async function start(onChange) {
    notify = onChange;
    try {
      if (pairingCode) await officeApi.redeemPairing(pairingCode, deviceLabel);
      office = await officeApi.loadState();
    } catch (error) {
      if (!(error instanceof UnpairedError)) return false;
      showUnpaired(error);
      return true;
    }
    publish();
    listen();
    return true;
  }

  async function setTemplate(projectKey, template) {
    await officeApi.setTemplate(projectKey, template);
  }

  async function openSession(cwd, prompt) {
    const outcome = await runnerClient.openSession(cwd, prompt);
    await refreshRunner();
    return outcome;
  }

  return {
    start,
    setTemplate,
    decide: (requestId, body) => officeApi.decide(requestId, body),
    sendMessage: (agentKey, text, session) => (session ? runnerClient.send(session.id, text) : officeApi.sendMessage(agentKey, text)),
    loadHistory: (agent) => officeApi.loadHistory(agent.key),
    loadPlan: (agent) => officeApi.loadPlan(agent.key),
    closeProject: (projectKey) => officeApi.closeProject(projectKey),
    openSession,
    watchTerminal: (agent, session, handlers) => runnerClient.watch(session.id, handlers),
    interruptSession: (session) => runnerClient.interrupt(session.id),
    stopSession: (session) => runnerClient.stop(session.id),
    listDevices: () => officeApi.listDevices(),
    pairDevice: () => officeApi.pairDevice(),
    revokeDevice: (id) => officeApi.revokeDevice(id),
  };
}
