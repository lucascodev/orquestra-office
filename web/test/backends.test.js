import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDataSource } from "../scripts/app/data-source.js";
import { createDemoBackend } from "../scripts/infra/backends/demo-backend.js";
import { createLiveBackend } from "../scripts/infra/backends/live-backend.js";

const BACKEND_METHODS = [
  "closeProject", "decide", "interruptSession", "loadHistory", "openSession", "sendMessage", "setTemplate", "start", "stopSession", "watchTerminal",
];
const LIVE_SESSION = { id: "run-1", sessionId: "a1", cwd: "c:/demo", status: "working" };
const LIVE_AGENT = "claude:a1";
const QUEUED_AGENT = "claude:b1";

const methodsOf = (backend) => Object.keys(backend).filter((name) => typeof backend[name] === "function").sort();

describe("backends", () => {
  it("offer the live office and the demo through the same methods", () => {
    assert.deepEqual(methodsOf(createLiveBackend()), BACKEND_METHODS);
    assert.deepEqual(methodsOf(createDemoBackend()), BACKEND_METHODS);
  });
});

function fakeBackend({ connects, mode = "fake", sessions = [] }) {
  const calls = [];
  const record = (name) => async (...args) => { calls.push([name, ...args]); return true; };
  const backend = Object.fromEntries(BACKEND_METHODS.map((name) => [name, record(name)]));
  backend.start = async (publish) => {
    if (connects) publish({ mode, office: { projects: {} }, runner: { isAvailable: true, sessions } });
    return connects;
  };
  backend.watchTerminal = (...args) => { calls.push(["watchTerminal", ...args]); return () => {}; };
  return { backend, calls };
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
    assert.deepEqual(states, [{ mode: "fake", projects: {}, pending: [], outbox: {}, usage: null, runner: { isAvailable: true, liveAgents: { [LIVE_AGENT]: "working" } } }]);
  });
});
