import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { createDataSource } from "../scripts/app/data-source.js";
import { createDemoBackend } from "../scripts/infra/backends/demo-backend.js";
import { createLiveBackend } from "../scripts/infra/backends/live-backend.js";

const BACKEND_METHODS = [
  "closeProject", "decide", "interruptSession", "listDevices", "loadHistory", "loadPlan", "openSession", "pairDevice", "revokeDevice", "sendMessage", "setTemplate",
  "start", "stopSession", "watchTerminal",
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
    assert.deepEqual(states, [{
      mode: "fake", projects: {}, pending: [], outbox: {}, usage: null, accounts: null, timeline: null, generatedAt: null, security: null,
      runner: { isAvailable: true, liveAgents: { [LIVE_AGENT]: "working" } },
    }]);
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

const RUNNER_NONCE = "AAECAwQFBgcICQoLDA0ODw";
const RUNNER_TICKET = "kAQ744p9HcBF8JvI2Tx0JiekFQsGFuWcAw2gPsykN_M";
const RUNNER_TOKEN = "runner-token";
const HOUR_MS = 3_600_000;

// The runner and the collector as the page sees them: a challenge, a ticket for it and a token that unlocks the runner.
function runnerAndOffice(requests, { tokenStatus = () => 200 } = {}) {
  return async (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : null;
    requests.push([url, init.method ?? "GET", body, init.headers?.Authorization ?? null]);
    if (url.endsWith("/auth/challenge")) return jsonResponse(200, { nonce: RUNNER_NONCE });
    if (url === "/api/runner-ticket") return jsonResponse(200, { ticket: RUNNER_TICKET });
    if (url.endsWith("/auth/session")) return jsonResponse(200, { token: RUNNER_TOKEN, expiresAt: Date.now() + HOUR_MS });
    return jsonResponse(url.startsWith("http://127.0.0.1:8421") ? tokenStatus(init.headers?.Authorization) : 200, {});
  };
}

describe("live backend", () => {
  it("sends a message for a live session to the runner, with a token bought by the office's ticket, and any other to the office queue", async (context) => {
    const requests = [];
    context.mock.method(globalThis, "fetch", runnerAndOffice(requests));
    const backend = createLiveBackend();

    assert.equal(await backend.sendMessage(LIVE_AGENT, "oi", LIVE_SESSION), true);
    assert.equal(await backend.sendMessage(QUEUED_AGENT, "olá", null), true);

    const messages = requests.filter(([url]) => url === RUNNER_MESSAGES || url === OFFICE_MESSAGES);
    assert.deepEqual(messages, [
      [RUNNER_MESSAGES, "POST", { text: "oi" }, `Bearer ${RUNNER_TOKEN}`],
      [OFFICE_MESSAGES, "POST", { key: QUEUED_AGENT, text: "olá" }, null],
    ]);
    assert.ok(requests.some(([url, , body]) => url === "/api/runner-ticket" && body.nonce === RUNNER_NONCE));
    assert.ok(requests.some(([url, , body]) => url.endsWith("/auth/session") && body.ticket === RUNNER_TICKET));
  });

  it("buys a new runner token once when the runner forgot the old one", async (context) => {
    const requests = [];
    let refusals = 1;
    context.mock.method(globalThis, "fetch", runnerAndOffice(requests, { tokenStatus: () => (refusals-- > 0 ? 401 : 200) }));

    assert.equal(await createLiveBackend().interruptSession(LIVE_SESSION), true);
    assert.equal(requests.filter(([url]) => url.endsWith("/interrupt")).length, 2);
  });
});


const PAIRING_CODE = "AAECAwQFBgcICQoLDA0ODw";
const jsonResponse = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

// Node has no EventSource without a flag; the page only needs one that can fail and be closed.
function fakeEventSources(context) {
  const streams = [];
  globalThis.EventSource = class {
    constructor(url) { this.url = url; this.isClosed = false; streams.push(this); }
    addEventListener() {}
    close() { this.isClosed = true; }
  };
  context.after(() => { delete globalThis.EventSource; });
  return streams;
}

describe("live backend pairing", () => {
  it("shows the unpaired page instead of falling back to the demo when the collector answers 401", async (context) => {
    context.mock.method(globalThis, "fetch", async () => jsonResponse(401, { error: "unpaired", isSecretMissing: true }));
    const states = [];

    const isStarted = await createLiveBackend().start((state) => states.push(state));

    assert.equal(isStarted, true);
    assert.deepEqual(states.map((state) => state.mode), ["unpaired"]);
    assert.equal(states[0].office.security.isSecretMissing, true);
  });

  it("still gives way to the demo when there is no collector at all", async (context) => {
    context.mock.method(globalThis, "fetch", async () => { throw new TypeError("fetch failed"); });

    assert.equal(await createLiveBackend().start(() => {}), false);
  });

  it("redeems the code from the address before loading the office", async (context) => {
    const requests = [];
    context.mock.method(globalThis, "fetch", async (url, init = {}) => {
      requests.push([url, init.method ?? "GET", init.body ? JSON.parse(init.body) : null]);
      return url === "/api/state" ? jsonResponse(401, { error: "unpaired" }) : jsonResponse(204, null);
    });

    await createLiveBackend({ pairingCode: PAIRING_CODE, deviceLabel: "Chrome no Windows" }).start(() => {});

    assert.deepEqual(requests.slice(0, 2), [
      ["/api/pairings/redeem", "POST", { code: PAIRING_CODE, label: "Chrome no Windows" }],
      ["/api/state", "GET", null],
    ]);
  });

  it("when the stream breaks, asks the state whether the browser was unpaired and shows it", async (context) => {
    context.mock.timers.enable({ apis: ["setInterval"] });
    const streams = fakeEventSources(context);
    let isPaired = true;
    context.mock.method(globalThis, "fetch", async (url) => {
      if (url === "/api/state") return isPaired ? jsonResponse(200, { projects: {} }) : jsonResponse(401, { error: "unpaired" });
      return jsonResponse(503, {});
    });
    const states = [];
    await createLiveBackend().start((state) => states.push(state));
    isPaired = false;

    streams[0].onerror();
    await new Promise((resolve) => setImmediate(resolve));

    assert.deepEqual(states.map((state) => state.mode).slice(-2), ["offline", "unpaired"]);
    assert.equal(streams[0].isClosed, true);
  });

  it("when the stream breaks with the collector away, stays offline instead of calling itself unpaired", async (context) => {
    context.mock.timers.enable({ apis: ["setInterval"] });
    const streams = fakeEventSources(context);
    let isUp = true;
    context.mock.method(globalThis, "fetch", async (url) => {
      if (!isUp) throw new TypeError("fetch failed");
      return url === "/api/state" ? jsonResponse(200, { projects: {} }) : jsonResponse(503, {});
    });
    const states = [];
    await createLiveBackend().start((state) => states.push(state));
    isUp = false;

    streams[0].onerror();
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(states.at(-1).mode, "offline");
  });

  it("lists, pairs and revokes devices through the office API", async (context) => {
    const requests = [];
    context.mock.method(globalThis, "fetch", async (url, init = {}) => {
      requests.push([url, init.method ?? "GET"]);
      if (url === "/api/devices") return jsonResponse(200, { devices: [{ id: "d1" }] });
      return jsonResponse(url === "/api/pairings" ? 200 : 204, { code: PAIRING_CODE, expiresAt: NOW, urls: [] });
    });
    const backend = createLiveBackend();

    assert.deepEqual(await backend.listDevices(), [{ id: "d1" }]);
    assert.equal((await backend.pairDevice()).code, PAIRING_CODE);
    assert.equal(await backend.revokeDevice("d 1"), true);
    assert.deepEqual(requests, [["/api/devices", "GET"], ["/api/pairings", "POST"], ["/api/devices/d%201/revoke", "POST"]]);
  });
});

describe("demo backend pairing", () => {
  beforeEach(() => mock.timers.enable({ apis: ["setInterval", "Date"], now: NOW }));
  afterEach(() => mock.timers.reset());

  it("shows example devices and a pairing code without a single request to the API", async (context) => {
    const fetchCalls = context.mock.method(globalThis, "fetch", async () => { throw new Error("the demo must not call the API"); });
    const backend = createDemoBackend();
    await backend.start(() => {});

    const devices = await backend.listDevices();
    const issued = await backend.pairDevice();
    const wasRevoked = await backend.revokeDevice(devices[1].id);

    assert.equal(devices.length, 2);
    assert.match(issued.urls[0], /#pair=/);
    assert.equal(wasRevoked, true);
    assert.equal((await backend.listDevices()).length, 1);
    assert.equal(fetchCalls.mock.callCount(), 0);
  });
});
