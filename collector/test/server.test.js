import { test } from "node:test";
import { request } from "node:http";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { createOffice } from "../src/composition.js";
import { createServer } from "../src/http/server.js";

async function withServer(run, options = {}) {
  const { server, store } = createOffice({ webDir: fileURLToPath(new URL("../../web", import.meta.url)), ...options });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await run(base, store); } finally { server.closeAllConnections(); server.close(); }
}

const post = (url, body, headers = { "Content-Type": "application/json" }) =>
  fetch(url, { method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body) });

test("hook events answer 200 with an empty decision and update the state", () => withServer(async (base) => {
  const res = await post(`${base}/events/claude`, { session_id: "s1", cwd: "/tmp/demo", hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "ls" } });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {});
  const state = await (await fetch(`${base}/api/state`)).json();
  assert.equal(Object.values(state.projects)[0].name, "demo");
}));

test("broken json and non-json requests never break the hook", () => withServer(async (base) => {
  assert.equal((await post(`${base}/events/claude`, "{nope")).status, 200);
  assert.equal((await post(`${base}/events/claude`, "x", { "Content-Type": "text/plain" })).status, 415);
}));

const statusForHost = (base, host) => new Promise((resolve, reject) => {
  const req = request(`${base}/api/state`, { headers: { Host: host } }, (res) => { res.resume(); resolve(res.statusCode); });
  req.on("error", reject);
  req.end();
});

test("foreign host headers are refused (DNS rebinding)", () => withServer(async (base) => {
  assert.equal(await statusForHost(base, "evil.example"), 403);
}));

test("a host named in allowedHosts is served, and every other foreign host is still refused", () => withServer(async (base) => {
  assert.equal(await statusForHost(base, "192.168.0.50:8420"), 200);
  assert.equal(await statusForHost(base, "192.168.0.51:8420"), 403);
  assert.equal(await statusForHost(base, "evil.example"), 403);
}, { allowedHosts: ["192.168.0.50"] }));

test("static files cannot escape the web folder", () => withServer(async (base) => {
  assert.equal((await fetch(`${base}/index.html`)).status, 200);
  assert.equal((await fetch(`${base}/..%2fcollector%2fpackage.json`)).status, 404);
  assert.equal((await fetch(`${base}/scripts/../../collector/src/main.js`)).status, 404);
}));

const MALFORMED_ESCAPE = "%E0%A4%A";
const RAW_REQUEST_TIMEOUT_MS = 2_000;

const rawRequest = (base, method, path) => new Promise((resolve, reject) => {
  const { hostname, port } = new URL(base);
  const req = request({ hostname, port, method, path, headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(RAW_REQUEST_TIMEOUT_MS) }, (res) => {
    res.resume();
    res.on("end", () => resolve(res.statusCode));
  });
  req.on("error", reject);
  req.end(method === "POST" ? "{}" : undefined);
});

test("a malformed escape in a page path is a 404 and the office keeps running", () => withServer(async (base) => {
  assert.equal(await rawRequest(base, "GET", `/${MALFORMED_ESCAPE}`), 404);
  assert.equal((await fetch(`${base}/api/state`)).status, 200);
}));

test("a malformed escape in a project key is rejected and the office keeps running", () => withServer(async (base) => {
  assert.equal(await rawRequest(base, "POST", `/api/projects/${MALFORMED_ESCAPE}/close`), 404);
  assert.equal(await rawRequest(base, "POST", `/api/projects/${MALFORMED_ESCAPE}/template`), 400);
  assert.equal((await fetch(`${base}/api/state`)).status, 200);
}));

test("an unexpected failure in a route answers 500 and the office keeps running", async (t) => {
  t.mock.method(console, "error", () => {});
  const failingRoutes = { handles: () => true, handle: async () => { throw new Error("route exploded"); } };
  const officeApi = { handlesGet: () => true, get: (req, res) => { res.writeHead(200); res.end(); } };
  const server = createServer({ allowedHosts: [], webDir: "/nonexistent", hookRoutes: failingRoutes, officeApi });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal(await rawRequest(base, "POST", "/hooks/claude/permission"), 500);
    assert.equal(await rawRequest(base, "GET", "/api/state"), 200);
    assert.equal(console.error.mock.callCount(), 1);
  } finally { server.closeAllConnections(); server.close(); }
});

test("a template change for a project named like a prototype key does not reach every object", () => withServer(async (base) => {
  try {
    assert.equal((await post(`${base}/api/projects/__proto__/template`, { template: "cafe" })).status, 400);
    assert.equal({}.template, undefined);
  } finally {
    delete Object.prototype.template;
  }
}));

const SECURITY_HEADERS = {
  "x-frame-options": "DENY",
  "content-security-policy": "frame-ancestors 'none'",
  "x-content-type-options": "nosniff",
  "cross-origin-resource-policy": "same-origin",
  "referrer-policy": "no-referrer",
};
const securityHeadersOf = (res) => Object.fromEntries(Object.keys(SECURITY_HEADERS).map((name) => [name, res.headers.get(name)]));

test("every response carries the headers that keep other sites from framing or reading the office", () => withServer(async (base) => {
  const responses = {
    page: await fetch(`${base}/`),
    state: await fetch(`${base}/api/state`),
    missing: await fetch(`${base}/missing.html`),
    hook: await post(`${base}/events/claude`, { session_id: "s1", cwd: "/tmp/demo", hook_event_name: "SessionStart" }),
  };
  assert.equal(responses.page.status, 200);
  assert.equal(responses.missing.status, 404);
  for (const [name, res] of Object.entries(responses)) {
    await res.arrayBuffer();
    assert.deepEqual(securityHeadersOf(res), SECURITY_HEADERS, name);
  }
}));

const HOOK_BODY_LIMIT = 8 * 1024 * 1024;
const API_BODY_LIMIT = 64 * 1024;
const OVERSIZED_TEST_TIMEOUT_MS = 5_000;

const postPadded = (base, path, bytes) => new Promise((resolve, reject) => {
  const { hostname, port } = new URL(base);
  const req = request({ hostname, port, method: "POST", path, headers: { "Content-Type": "application/json", "Content-Length": bytes }, signal: AbortSignal.timeout(RAW_REQUEST_TIMEOUT_MS) }, (res) => {
    res.resume();
    resolve(res.statusCode);
  });
  req.on("error", reject);
  req.end(Buffer.concat([Buffer.from("{}"), Buffer.alloc(bytes - 2, " ")]));
});

test("a hook body over the limit is refused with 413 and the office keeps running", { timeout: OVERSIZED_TEST_TIMEOUT_MS }, () => withServer(async (base) => {
  assert.equal(await postPadded(base, "/events/claude", HOOK_BODY_LIMIT + 1), 413);
  assert.equal(await postPadded(base, "/events/claude", HOOK_BODY_LIMIT), 200);
  assert.equal((await fetch(`${base}/api/state`)).status, 200);
}));

test("an office API body over the limit is refused with 413 and the office keeps running", { timeout: OVERSIZED_TEST_TIMEOUT_MS }, () => withServer(async (base) => {
  assert.equal(await postPadded(base, "/api/agents/message", API_BODY_LIMIT + 1), 413);
  assert.equal(await postPadded(base, "/api/agents/message", API_BODY_LIMIT), 404);
  assert.equal((await fetch(`${base}/api/state`)).status, 200);
}));
