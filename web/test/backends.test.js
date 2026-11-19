import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { createDataSource } from "../scripts/app/data-source.js";
import { createDemoBackend } from "../scripts/infra/backends/demo-backend.js";
import { createLiveBackend } from "../scripts/infra/backends/live-backend.js";

const BACKEND_METHODS = [
  "closeProject", "decide", "interruptSession", "loadHistory", "openSession", "sendMessage", "setTemplate", "start", "stopSession", "watchTerminal",
];
const LIVE_SESSION = { id: "run-1", sessionId: "a1", cwd: "c:/demo", status: "working" };
const LIVE_AGENT = "claude:a1";
const QUEUED_AGENT = "claude:b1";
const NOW = Date.UTC(2026, 10, 18, 15, 0, 0);
const DEMO_ONLY = "Na prévia com dados de exemplo não dá para abrir sessões.";
const RUNNER_MESSAGES = "http://127.0.0.1:8421/sessions/run-1/messages";
const OFFICE_MESSAGES = "/api/agents/message";

const methodsOf = (backend) => Object.keys(backend).filter((name) => typeof backend[name] === "function").sort();

describe("backends", () => {
  it("offer the live office and the demo through the same methods", () => {
    assert.deepEqual(methodsOf(createLiveBackend()), BACKEND_METHODS);
    assert.deepEqual(methodsOf(createDemoBackend()), BACKEND_METHODS);
  });
});

function fakeBackend({ connects, mode = "fake", sessions = [] }) {
  const calls = [];
  const starts = [];
  const record = (name) => async (...args) => { calls.push([name, ...args]); return true; };
  const backend = Object.fromEntries(BACKEND_METHODS.map((name) => [name, record(name)]));
  backend.start = async (publish) => {
    starts.push(mode);
    if (connects) publish({ mode, office: { projects: {} }, runner: { isAvailable: true, sessions } });
    return connects;
  };
  backend.watchTerminal = (...args) => { calls.push(["watchTerminal", ...args]); return () => {}; };
  return { backend, calls, starts };
}

describe("data source", () => {
  it("falls back to the next backend when one cannot connect, and talks only to the one that did", async () => {
    const states = [];
    const live = fakeBackend({ connects: false });
    const demo = fakeBackend({ connects: true, mode: "demo" });
    const source = createDataSource((state) => states.push(state));
    await source.start([live.backend, demo.backend]);
    await source.decide("request-1", { behavior: "allow" });
    assert.deepEqual(states.map((state) => state.mode), ["demo"]);
    assert.deepEqual(live.calls, []);
    assert.deepEqual(demo.calls, [["decide", "request-1", { behavior: "allow" }]]);
  });

  it("stops at the first backend that connects, without starting the ones after it", async () => {
    const states = [];
    const live = fakeBackend({ connects: true, mode: "live" });
    const demo = fakeBackend({ connects: true, mode: "demo" });
    const source = createDataSource((state) => states.push(state));
    await source.start([live.backend, demo.backend]);
    await source.decide("request-1", { behavior: "allow" });
    assert.deepEqual(demo.starts, []);
    assert.deepEqual(states.map((state) => state.mode), ["live"]);
    assert.deepEqual(live.calls, [["decide", "request-1", { behavior: "allow" }]]);
  });

  it("hands the backend the live session of an agent, and none to an agent without one", async () => {
    const { backend, calls } = fakeBackend({ connects: true, sessions: [LIVE_SESSION] });
    const source = createDataSource(() => {});
    await source.start([backend]);
    await source.sendMessage(LIVE_AGENT, "oi");
    await source.sendMessage(QUEUED_AGENT, "oi");
    assert.deepEqual(calls, [["sendMessage", LIVE_AGENT, "oi", LIVE_SESSION], ["sendMessage", QUEUED_AGENT, "oi", null]]);
  });

  it("does not ask the backend to watch, interrupt or stop an agent without a live session", async () => {
    const { backend, calls } = fakeBackend({ connects: true, sessions: [LIVE_SESSION] });
    const source = createDataSource(() => {});
    await source.start([backend]);
    source.watchTerminal({ key: QUEUED_AGENT }, {});
    assert.equal(await source.interruptSession(QUEUED_AGENT), false);
    assert.equal(await source.stopSession(QUEUED_AGENT), false);
    assert.equal(await source.interruptSession(LIVE_AGENT), true);
    assert.deepEqual(calls, [["interruptSession", LIVE_SESSION]]);
  });

  it("publishes the office with the agents that have a live session", async () => {
    const states = [];
    const { backend } = fakeBackend({ connects: true, sessions: [LIVE_SESSION, { ...LIVE_SESSION, id: "run-2", sessionId: "z9", status: "ended" }] });
    await createDataSource((state) => states.push(state)).start([backend]);
    assert.deepEqual(states, [{ mode: "fake", projects: {}, pending: [], outbox: {}, usage: null, accounts: null, timeline: null, generatedAt: null, runner: { isAvailable: true, liveAgents: { [LIVE_AGENT]: "working" } } }]);
  });
});

describe("demo backend", () => {
  beforeEach(() => mock.timers.enable({ apis: ["setInterval", "Date"], now: NOW }));
  afterEach(() => mock.timers.reset());

  async function startedDemo() {
    const states = [];
    const backend = createDemoBackend();
    await backend.start((state) => states.push(state));
    return { backend, states };
  }

  it("queues a message for an agent without a live session and publishes the new count", async () => {
    const { backend, states } = await startedDemo();
    assert.equal(await backend.sendMessage(QUEUED_AGENT, "oi", null), true);
    assert.equal(states.length, 2);
    assert.deepEqual(states.at(-1).office.outbox, { [QUEUED_AGENT]: 1 });
  });

  it("writes a message to a live session into the open terminal instead of queueing it", async () => {
    const { backend, states } = await startedDemo();
    const changes = [];
    backend.watchTerminal({ key: LIVE_AGENT, updatedAt: NOW }, LIVE_SESSION, { onSnapshot: () => {}, onChange: (change) => changes.push(change) });
    assert.equal(await backend.sendMessage(LIVE_AGENT, "oi", LIVE_SESSION), true);
    assert.deepEqual(changes, [{ type: "entry", entry: { at: NOW, kind: "prompt", text: "oi", detail: "" } }]);
    assert.equal(states.length, 1);
    assert.deepEqual(states[0].office.outbox, {});
  });

  it("cannot interrupt, stop or open a session, and says why it cannot open one", async () => {
    const { backend } = await startedDemo();
    assert.equal(await backend.interruptSession(LIVE_SESSION), false);
    assert.equal(await backend.stopSession(LIVE_SESSION), false);
    assert.deepEqual(await backend.openSession("c:/demo", "oi"), { error: DEMO_ONLY });
  });
});

describe("live backend", () => {
  it("sends a message for a live session to the runner and any other to the office queue", async (context) => {
    const requests = [];
    context.mock.method(globalThis, "fetch", async (url, init) => {
      requests.push([url, init.method, JSON.parse(init.body)]);
      return { ok: true };
    });
    const backend = createLiveBackend();
    assert.equal(await backend.sendMessage(LIVE_AGENT, "oi", LIVE_SESSION), true);
    assert.equal(await backend.sendMessage(QUEUED_AGENT, "olá", null), true);
    assert.deepEqual(requests, [
      [RUNNER_MESSAGES, "POST", { text: "oi" }],
      [OFFICE_MESSAGES, "POST", { key: QUEUED_AGENT, text: "olá" }],
    ]);
  });
});
