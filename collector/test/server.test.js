import { test } from "node:test";
import { request } from "node:http";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { createServer } from "../src/http/server.js";
import { createOfficeStore } from "../src/office/office-store.js";

async function withServer(run, options = {}) {
  const store = createOfficeStore();
  const server = createServer({ store, webDir: fileURLToPath(new URL("../../web", import.meta.url)), siteDir: "/nonexistent", ...options });
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
