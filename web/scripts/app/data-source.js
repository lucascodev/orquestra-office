import { demoHistory, demoState, demoTerminal, queueDemoMessage, resolveDemoRequest, tickDemo } from "../data/demo-data.js";
import { officeApi } from "./office-api.js";
import { runnerClient } from "./runner-client.js";

const DEMO_TICK_MS = 4_000;
const RUNNER_POLL_MS = 4_000;
const DEMO_ONLY = "Na prévia com dados de exemplo não dá para abrir sessões.";

const agentKeyOfSession = (session) => `claude:${session.sessionId}`;

export function createDataSource(onState) {
  let mode = "connecting";
  let local = { projects: {} };
  let runner = { isAvailable: false, sessions: [] };
  let demoTerminalChange = null;

  const isDemo = () => mode === "demo";
  const liveSessionOf = (agentKey) => runner.sessions.find((session) => session.sessionId && session.status !== "ended" && agentKeyOfSession(session) === agentKey) ?? null;

  const publish = () => {
    const liveAgents = Object.fromEntries(runner.sessions.filter((session) => liveSessionOf(agentKeyOfSession(session))).map((session) => [agentKeyOfSession(session), session.status]));
    onState({ mode, projects: { ...local.projects }, pending: local.pending ?? [], outbox: local.outbox ?? {}, usage: local.usage ?? null, runner: { isAvailable: runner.isAvailable, liveAgents } });
  };

  function startDemo() {
    mode = "demo";
    local = demoState();
    runner = local.runner;
    let step = 0;
    publish();
    setInterval(() => { tickDemo(local, step++); publish(); }, DEMO_TICK_MS);
  }

  async function refreshRunner() {
    const sessions = await runnerClient.listSessions();
    const next = { isAvailable: sessions !== null, sessions: sessions ?? [] };
    if (JSON.stringify(next) === JSON.stringify(runner)) return;
    runner = next;
    publish();
  }

  function startLive() {
    mode = "live";
    const stream = new EventSource("/api/stream");
    stream.addEventListener("state", (event) => { local = JSON.parse(event.data); mode = "live"; publish(); });
    stream.onerror = () => { mode = "offline"; publish(); };
    refreshRunner();
    setInterval(refreshRunner, RUNNER_POLL_MS);
  }

  async function start() {
    try {
      const response = await fetch("/api/state", { cache: "no-store" });
      if (!response.ok) throw new Error(String(response.status));
      local = await response.json();
      publish();
      startLive();
    } catch {
      startDemo();
    }
  }

  async function setTemplate(projectKey, template) {
    if (!isDemo()) {
      await officeApi.setTemplate(projectKey, template);
      return;
    }
    local.projects[projectKey].template = template;
    publish();
  }

  async function decide(requestId, body) {
    if (!isDemo()) return officeApi.decide(requestId, body);
    const wasResolved = resolveDemoRequest(local, requestId, body);
    publish();
    return wasResolved;
  }

  async function sendMessage(agentKey, text) {
    const session = liveSessionOf(agentKey);
    if (isDemo() && session) {
      demoTerminalChange?.({ type: "entry", entry: { at: Date.now(), kind: "prompt", text, detail: "" } });
      return true;
    }
    if (session) return runnerClient.send(session.id, text);
    if (!isDemo()) return officeApi.sendMessage(agentKey, text);
    const wasQueued = queueDemoMessage(local, agentKey);
    publish();
    return wasQueued;
  }

  const loadHistory = async (agent) => (isDemo() ? demoHistory(agent) : officeApi.loadHistory(agent.key));

  async function closeProject(projectKey) {
    if (!isDemo()) return officeApi.closeProject(projectKey);
    const { [projectKey]: closed, ...open } = local.projects;
    local = { ...local, projects: open };
    publish();
    return Boolean(closed);
  }

  async function openSession(cwd, prompt) {
    if (isDemo()) return { error: DEMO_ONLY };
    const outcome = await runnerClient.openSession(cwd, prompt);
    await refreshRunner();
    return outcome;
  }

  function watchTerminal(agent, handlers) {
    const session = liveSessionOf(agent.key);
    if (!session) return () => {};
    if (!isDemo()) return runnerClient.watch(session.id, handlers);
    demoTerminalChange = handlers.onChange;
    handlers.onSnapshot(demoTerminal(agent));
    return () => { demoTerminalChange = null; };
  }

  const onLiveSession = (action) => async (agentKey) => {
    const session = liveSessionOf(agentKey);
    return Boolean(session) && !isDemo() && action(session.id);
  };

  return {
    start, setTemplate, decide, sendMessage, loadHistory, closeProject, openSession, watchTerminal,
    interruptSession: onLiveSession(runnerClient.interrupt),
    stopSession: onLiveSession(runnerClient.stop),
  };
}
