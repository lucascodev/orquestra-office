import { liveAgentsOf, liveSessionOf } from "../domain/office/live-sessions.js";

export function createDataSource(onState) {
  let backend = null;
  let sessions = [];

  const liveSessionFor = (agentKey) => liveSessionOf(sessions, agentKey);

  function publish({ mode, office, runner }) {
    sessions = runner.sessions;
    onState({
      mode, projects: { ...office.projects }, pending: office.pending ?? [], outbox: office.outbox ?? {}, usage: office.usage ?? null,
      accounts: office.accounts ?? null, timeline: office.timeline ?? null, generatedAt: office.generatedAt ?? null, security: office.security ?? null,
      runner: { isAvailable: runner.isAvailable, liveAgents: liveAgentsOf(runner.sessions) },
    });
  }

  // Without a collector the page falls back to the demo: a backend that cannot connect gives way to the next one.
  async function start(backends) {
    for (const candidate of backends) {
      backend = candidate;
      if (await candidate.start(publish)) return;
    }
  }

  const sendMessage = async (agentKey, text) => backend.sendMessage(agentKey, text, liveSessionFor(agentKey));

  function watchTerminal(agent, handlers) {
    const session = liveSessionFor(agent.key);
    if (!session) return () => {};
    return backend.watchTerminal(agent, session, handlers);
  }

  const onLiveSession = (action) => async (agentKey) => {
    const session = liveSessionFor(agentKey);
    return Boolean(session) && action(session);
  };

  return {
    start,
    setTemplate: async (projectKey, template) => backend.setTemplate(projectKey, template),
    decide: async (requestId, body) => backend.decide(requestId, body),
    sendMessage,
    loadHistory: async (agent) => backend.loadHistory(agent),
    loadPlan: async (agent) => backend.loadPlan(agent),
    closeProject: async (projectKey) => backend.closeProject(projectKey),
    openSession: async (cwd, prompt) => backend.openSession(cwd, prompt),
    watchTerminal,
    interruptSession: onLiveSession((session) => backend.interruptSession(session)),
    stopSession: onLiveSession((session) => backend.stopSession(session)),
    listDevices: async () => backend.listDevices(),
    pairDevice: async () => backend.pairDevice(),
    revokeDevice: async (id) => backend.revokeDevice(id),
  };
}
