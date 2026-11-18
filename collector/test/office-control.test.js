import { test } from "node:test";
import assert from "node:assert/strict";
import { createOffice } from "../src/composition.js";
import { postActivity, postSigned } from "./support/hook-client.js";
import { listenOnFetchablePort } from "./support/listen-on-fetchable-port.js";
import { processWideSecretFile } from "./support/office-secret.js";
import { pairBrowser } from "./support/panel-client.js";

const JSON_HEADERS = { "Content-Type": "application/json" };
const SESSION = { session_id: "s1", cwd: "/tmp/demo" };
const HOLD_MS = 5_000;
const EXPIRING_HOLD_MS = 20;
const EXPIRY_TEST_TIMEOUT_MS = 2_000;
const NO_VIEWER_TEST_TIMEOUT_MS = 1_000;

async function withOffice(run, { holdMs = HOLD_MS } = {}) {
  const { server, store, decisions } = createOffice({ webDir: "/nonexistent", holdMs, secretFile: processWideSecretFile() });
  const base = await listenOnFetchablePort(server);
  try {
    cookies.set(base, (await pairBrowser(base)).cookie);
    await run(base, store, decisions);
  } finally { server.closeAllConnections(); server.close(); }
}

// Every test runs as the office page of a paired browser: its cookie, and its own origin on POSTs unless a test sends another.
const cookies = new Map();
const asPage = (url, headers = {}) => ({ Cookie: cookies.get(new URL(url).origin), ...headers });
const fetchPage = (url, { headers, ...init } = {}) => fetch(url, { ...init, headers: asPage(url, headers) });
const post = (url, body, headers = JSON_HEADERS) => fetch(url, { method: "POST", headers: asPage(url, { Origin: new URL(url).origin, ...headers }), body: JSON.stringify(body) });
const stateOf = async (base) => (await fetchPage(`${base}/api/state`)).json();

async function openOfficePage(base) {
  const viewer = new AbortController();
  const stream = await fetchPage(`${base}/api/stream`, { signal: viewer.signal });
  await stream.body.getReader().read();
  return viewer;
}

async function pendingRequest(base) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const [request] = (await stateOf(base)).pending;
    if (request) return request;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("no pending request showed up");
}

const permissionHook = (base) => postSigned(base, "/hooks/claude/permission", { ...SESSION, hook_event_name: "PermissionRequest", tool_name: "Bash", tool_input: { command: "rm -rf build" } });

test("with no office page open the permission goes straight back to the terminal", { timeout: NO_VIEWER_TEST_TIMEOUT_MS }, () => withOffice(async (base) => {
  assert.deepEqual((await permissionHook(base)).body, { decision: null });
  assert.deepEqual((await stateOf(base)).pending, []);
}));

test("a permission is held until the office approves it", () => withOffice(async (base) => {
  const viewer = await openOfficePage(base);
  const hook = permissionHook(base);
  const request = await pendingRequest(base);
  assert.equal(request.kind, "permission");
  assert.equal(request.detail, "rm -rf build");

  assert.equal((await post(`${base}/api/decisions/${request.id}`, { behavior: "allow" })).status, 200);
  assert.deepEqual((await hook).body, { decision: { behavior: "allow" } });
  assert.deepEqual((await stateOf(base)).pending, []);
  viewer.abort();
}));

test("denying from the office tells the agent why", () => withOffice(async (base) => {
  const viewer = await openOfficePage(base);
  const hook = permissionHook(base);
  const request = await pendingRequest(base);
  await post(`${base}/api/decisions/${request.id}`, { behavior: "deny", message: "use trash instead" });
  assert.deepEqual((await hook).body, { decision: { behavior: "deny", message: "use trash instead" } });
  viewer.abort();
}));

test("sending a held permission back to the terminal releases the hook with no decision", () => withOffice(async (base) => {
  const viewer = await openOfficePage(base);
  const released = permissionHook(base);
  const decided = await post(`${base}/api/decisions/${(await pendingRequest(base)).id}`, { behavior: "terminal" });
  assert.equal(decided.status, 200);
  assert.deepEqual((await stateOf(base)).pending, []);
  assert.deepEqual((await released).body, { decision: null });
  viewer.abort();
}));

test("a held permission nobody answers expires and goes back to the terminal", { timeout: EXPIRY_TEST_TIMEOUT_MS }, () => withOffice(async (base, store, decisions) => {
  const viewer = await openOfficePage(base);
  const heldCounts = [];
  decisions.onChange(() => heldCounts.push(decisions.list().length));
  assert.deepEqual((await permissionHook(base)).body, { decision: null });
  assert.deepEqual(heldCounts, [1, 0]);
  viewer.abort();
}, { holdMs: EXPIRING_HOLD_MS }));

test("another site cannot approve a pending permission", () => withOffice(async (base) => {
  const viewer = await openOfficePage(base);
  const hook = permissionHook(base);
  const request = await pendingRequest(base);
  const forged = await post(`${base}/api/decisions/${request.id}`, { behavior: "allow" }, { ...JSON_HEADERS, Origin: "http://evil.example" });
  assert.equal(forged.status, 403);
  assert.equal((await stateOf(base)).pending.length, 1);
  await post(`${base}/api/decisions/${request.id}`, { behavior: "deny" });
  await hook;
  viewer.abort();
}));

test("a question is answered from the office with the original questions echoed back", () => withOffice(async (base) => {
  const viewer = await openOfficePage(base);
  const questions = [{ question: "Which framework?", header: "Framework", multiSelect: false, options: [{ label: "React", description: "" }, { label: "Vue", description: "" }] }];
  const hook = postSigned(base, "/hooks/claude/question", { ...SESSION, hook_event_name: "PreToolUse", tool_name: "AskUserQuestion", tool_input: { questions } });
  const request = await pendingRequest(base);
  assert.equal(request.kind, "question");
  assert.equal((await post(`${base}/api/decisions/${request.id}`, { answers: {} })).status, 400);

  await post(`${base}/api/decisions/${request.id}`, { answers: { "Which framework?": "Vue" } });
  assert.deepEqual((await hook).body, { answers: { "Which framework?": "Vue" } });
  viewer.abort();
}));

test("a message waits in the outbox and is delivered when the turn ends", () => withOffice(async (base) => {
  await postActivity(base, "/events/claude", { ...SESSION, hook_event_name: "SessionStart" });
  assert.equal((await post(`${base}/api/agents/message`, { key: "claude:unknown", text: "hi" })).status, 404);
  assert.equal((await post(`${base}/api/agents/message`, { key: "claude:s1", text: "  " })).status, 400);
  assert.equal((await post(`${base}/api/agents/message`, { key: "claude:s1", text: "also update the README" })).status, 200);
  assert.deepEqual((await stateOf(base)).outbox, { "claude:s1": 1 });

  const stop = (await postSigned(base, "/hooks/claude/stop", { ...SESSION, hook_event_name: "Stop" })).body;
  assert.deepEqual(stop, { messages: ["also update the README"] });
  assert.deepEqual((await stateOf(base)).outbox, {});
  assert.deepEqual((await postSigned(base, "/hooks/claude/stop", { ...SESSION, hook_event_name: "Stop" })).body, { messages: [] });
}));

test("history keeps the conversation text, the office state never does", () => withOffice(async (base) => {
  await postActivity(base, "/events/claude", { ...SESSION, hook_event_name: "UserPromptSubmit", prompt: "rename the secret module" });
  await postActivity(base, "/events/claude", { ...SESSION, hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "git mv secret.js vault.js" } });
  await postSigned(base, "/hooks/claude/stop", { ...SESSION, hook_event_name: "Stop", last_assistant_message: "Renamed it." });

  const { entries } = await (await fetchPage(`${base}/api/agents/history?key=${encodeURIComponent("claude:s1")}`)).json();
  assert.deepEqual(entries.map((entry) => entry.kind), ["prompt", "tool", "reply"]);
  assert.equal(entries[1].detail, "git mv secret.js vault.js");

  const state = JSON.stringify(await stateOf(base));
  assert.ok(!state.includes("secret"));
  assert.ok(!state.includes("Renamed it."));
}));

test("a room can be closed from the office and comes back with new activity", () => withOffice(async (base) => {
  await postActivity(base, "/events/claude", { ...SESSION, hook_event_name: "SessionStart" });
  const [key] = Object.keys((await stateOf(base)).projects);
  assert.equal((await post(`${base}/api/projects/${encodeURIComponent("/tmp/unknown")}/close`, {})).status, 404);
  assert.equal((await post(`${base}/api/projects/${encodeURIComponent(key)}/close`, {})).status, 200);
  assert.deepEqual((await stateOf(base)).projects, {});

  await postActivity(base, "/events/claude", { ...SESSION, hook_event_name: "UserPromptSubmit", prompt: "back to work" });
  assert.deepEqual(Object.keys((await stateOf(base)).projects), [key]);
}));

test("statusline readings feed the usage windows and today's tokens and cost", () => withOffice(async (base) => {
  await postActivity(base, "/events/claude", { ...SESSION, hook_event_name: "SessionStart" });
  const reading = (costUsd, input, output) => postActivity(base, "/events/statusline", {
    ...SESSION, cost: { total_cost_usd: costUsd }, context_window: { total_input_tokens: input, total_output_tokens: output },
    rate_limits: { five_hour: { used_percentage: 23.5, resets_at: 1_738_425_600 }, seven_day: { used_percentage: 41.2, resets_at: 1_738_857_600 } },
  });
  await reading(1.5, 1_000, 200);
  await reading(2.25, 1_600, 300);

  const state = await stateOf(base);
  const { stats } = Object.values(state.projects)[0];
  assert.equal(stats.tokens, 700);
  assert.equal(stats.costUsd, 0.75);
  assert.deepEqual(state.usage.rateLimits.fiveHour, { usedPercentage: 23.5, resetsAt: 1_738_425_600_000 });
  assert.equal(state.usage.rateLimits.sevenDay.usedPercentage, 41.2);
  assert.equal(state.meters, undefined);
}));

const CROSS_SITE = { "Sec-Fetch-Site": "cross-site" };

test("a page from another site cannot watch the office, so it cannot hold permissions away from the terminal", () => withOffice(async (base) => {
  const viewer = new AbortController();
  const stream = await fetchPage(`${base}/api/stream`, { headers: CROSS_SITE, signal: viewer.signal });
  try {
    assert.equal(stream.status, 403);
    assert.deepEqual((await permissionHook(base)).body, { decision: null });
    assert.deepEqual((await stateOf(base)).pending, []);
  } finally {
    viewer.abort();
  }
}));

test("a page from another site cannot read the office state or a session history", () => withOffice(async (base) => {
  assert.equal((await fetchPage(`${base}/api/state`, { headers: CROSS_SITE })).status, 403);
  assert.equal((await fetchPage(`${base}/api/agents/history?key=claude:s1`, { headers: CROSS_SITE })).status, 403);
}));

const FOREIGN_ORIGIN = { Origin: "http://evil.example" };

test("over plain HTTP on the LAN, where browsers send no fetch metadata, a page from another origin cannot watch or read the office", { timeout: NO_VIEWER_TEST_TIMEOUT_MS }, () => withOffice(async (base) => {
  const viewer = new AbortController();
  const stream = await fetchPage(`${base}/api/stream`, { headers: FOREIGN_ORIGIN, signal: viewer.signal });
  try {
    assert.equal(stream.status, 403);
    assert.equal((await fetchPage(`${base}/api/state`, { headers: FOREIGN_ORIGIN })).status, 403);
    assert.deepEqual((await permissionHook(base)).body, { decision: null });
    assert.deepEqual((await stateOf(base)).pending, []);
  } finally {
    viewer.abort();
  }
}));

test("another port of the same host cannot read the office either", () => withOffice(async (base) => {
  assert.equal((await fetchPage(`${base}/api/state`, { headers: { "Sec-Fetch-Site": "same-site" } })).status, 403);
}));

test("the office page itself and requests without fetch metadata still read the office", () => withOffice(async (base) => {
  assert.equal((await fetchPage(`${base}/api/state`, { headers: { "Sec-Fetch-Site": "same-origin" } })).status, 200);
  assert.equal((await fetchPage(`${base}/api/state`, { headers: { "Sec-Fetch-Site": "none" } })).status, 200);
  assert.equal((await fetchPage(`${base}/api/state`)).status, 200);
  assert.equal((await fetchPage(`${base}/api/state`, { headers: { Origin: base } })).status, 200);
}));
