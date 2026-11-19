import { ownValueOf } from "../../domain/shared/own-value.js";
import { demoDay } from "../demo/demo-day.js";
import { demoDevices, demoPairingCode } from "../demo/demo-devices.js";
import { createDemoAsker } from "../demo/demo-requests.js";
import { demoStressState } from "../demo/demo-stress.js";
import { demoHistory, demoTerminal } from "../demo/demo-terminal.js";
import { demoThemesState } from "../demo/demo-themes.js";
import { demoState, queueDemoMessage, resolveDemoRequest, tickDemo } from "../demo/demo-world.js";

const DEMO_TICK_MS = 4_000;
const DEMO_ONLY = "Na prévia com dados de exemplo não dá para abrir sessões.";
const SCENES = { temas: demoThemesState, estresse: demoStressState };

export function createDemoBackend({ scene = null, keepsAsking = false } = {}) {
  let world = null;
  let notify = () => {};
  let terminalChange = null;
  let devices = demoDevices(Date.now());

  const publish = () => notify({ mode: "demo", office: world, runner: world.runner });

  async function start(onChange) {
    notify = onChange;
    world = { ...(ownValueOf(SCENES, scene) ?? demoState)(), ...demoDay(Date.now()) };
    let step = 0;
    const askAgain = keepsAsking ? createDemoAsker(world.pending) : () => {};
    publish();
    setInterval(() => {
      tickDemo(world, step++);
      askAgain(world, Date.now());
      publish();
    }, DEMO_TICK_MS);
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

  async function revokeDevice(id) {
    const remaining = devices.filter((device) => device.id !== id);
    const wasRevoked = remaining.length < devices.length;
    devices = remaining;
    return wasRevoked;
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
    listDevices: async () => devices.map((device) => ({ ...device })),
    pairDevice: async () => demoPairingCode(Date.now()),
    revokeDevice,
  };
}
