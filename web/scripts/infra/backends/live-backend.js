import { officeApi } from "../office-api.js";
import { runnerClient } from "../runner-client.js";

const RUNNER_POLL_MS = 4_000;

export function createLiveBackend() {
  let mode = "connecting";
  let office = { projects: {} };
  let runner = { isAvailable: false, sessions: [] };
  let notify = () => {};

  const publish = () => notify({ mode, office, runner });

  async function refreshRunner() {
    const sessions = await runnerClient.listSessions();
    const next = { isAvailable: sessions !== null, sessions: sessions ?? [] };
    if (JSON.stringify(next) === JSON.stringify(runner)) return;
    runner = next;
    publish();
  }

  function listen() {
    mode = "live";
    officeApi.watchState({
      onState: (state) => { office = state; mode = "live"; publish(); },
      onError: () => { mode = "offline"; publish(); },
    });
    refreshRunner();
    setInterval(refreshRunner, RUNNER_POLL_MS);
  }

  async function start(onChange) {
    notify = onChange;
    try {
      office = await officeApi.loadState();
    } catch {
      return false;
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
    closeProject: (projectKey) => officeApi.closeProject(projectKey),
    openSession,
    watchTerminal: (agent, session, handlers) => runnerClient.watch(session.id, handlers),
    interruptSession: (session) => runnerClient.interrupt(session.id),
    stopSession: (session) => runnerClient.stop(session.id),
  };
}
