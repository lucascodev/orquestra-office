import { ownValueOf } from "../../domain/shared/own-value.js";
import { demoDay } from "../demo/demo-day.js";
import { demoHistory, demoTerminal } from "../demo/demo-terminal.js";
import { demoThemesState } from "../demo/demo-themes.js";
import { demoState, queueDemoMessage, resolveDemoRequest, tickDemo } from "../demo/demo-world.js";

const DEMO_TICK_MS = 4_000;
const DEMO_ONLY = "Na prévia com dados de exemplo não dá para abrir sessões.";
const SCENES = { temas: demoThemesState };

export function createDemoBackend({ scene = null } = {}) {
  let world = null;
  let notify = () => {};
  let terminalChange = null;

  const publish = () => notify({ mode: "demo", office: world, runner: world.runner });

  async function start(onChange) {
    notify = onChange;
    world = { ...(ownValueOf(SCENES, scene) ?? demoState)(), ...demoDay(Date.now()) };
    let step = 0;
    publish();
    setInterval(() => { tickDemo(world, step++); publish(); }, DEMO_TICK_MS);
    return true;
  }

  async function setTemplate(projectKey, template) {
    world.projects[projectKey].template = template;
    publish();
  }

  async function decide(requestId, body) {
    const wasResolved = resolveDemoRequest(world, requestId, body);
    publish();
    return wasResolved;
  }

  async function sendMessage(agentKey, text, session) {
    if (session) {
      terminalChange?.({ type: "entry", entry: { at: Date.now(), kind: "prompt", text, detail: "" } });
      return true;
    }
    const wasQueued = queueDemoMessage(world, agentKey);
    publish();
    return wasQueued;
  }

  async function closeProject(projectKey) {
    const { [projectKey]: closed, ...open } = world.projects;
    world = { ...world, projects: open };
    publish();
    return Boolean(closed);
  }

  function watchTerminal(agent, session, handlers) {
    terminalChange = handlers.onChange;
    handlers.onSnapshot(demoTerminal(agent));
    return () => { terminalChange = null; };
  }

  return {
    start,
    setTemplate,
    decide,
    sendMessage,
    loadHistory: async (agent) => demoHistory(agent),
    closeProject,
    openSession: async () => ({ error: DEMO_ONLY }),
    watchTerminal,
    interruptSession: async () => false,
    stopSession: async () => false,
  };
}
