import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createOffice } from "../src/composition.js";
import { postSigned, signedHeaders } from "./support/hook-client.js";
import { listenOnFetchablePort } from "./support/listen-on-fetchable-port.js";
import { OTHER_KEY, OTHER_SECRET, secretFileFor } from "./support/office-secret.js";
import { bootstrapChallengeOf, cookieOf, issueBootstrapCode, pairBrowser, redeem } from "./support/panel-client.js";

const HOLD_MS = 5_000;
const NINETY_DAYS_SECONDS = 7_776_000;
const LAN_HOST = "192.168.0.50";
const API_ROUTES = [
  ["GET", "/api/state"], ["GET", "/api/stream"], ["GET", "/api/agents/history?key=claude:s1"], ["GET", "/api/devices"], ["GET", "/api/anything"],
  ["POST", "/api/decisions/x"], ["POST", "/api/agents/message"], ["POST", "/api/projects/p/template"], ["POST", "/api/projects/p/close"],
  ["POST", "/api/pairings"], ["POST", "/api/devices/x/revoke"],
];

function dataDirFor(t) {
  const dir = mkdtempSync(join(tmpdir(), "office-pairing-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

async function withOffice(t, run, options = {}) {
  const office = createOffice({ webDir: "/nonexistent", holdMs: HOLD_MS, secretFile: secretFileFor(t), ...options });
  const base = await listenOnFetchablePort(office.server);
  try { await run(base, office); } finally { office.server.closeAllConnections(); office.server.close(); }
}

const rawRequest = (base, { method = "GET", path, headers = {}, body }) => new Promise((resolve, reject) => {
  const { hostname, port } = new URL(base);
  const req = request({ hostname, port, method, path, headers }, (res) => {
    const chunks = [];
    res.on("data", (chunk) => chunks.push(chunk));
    res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString("utf8") }));
  });
  req.on("error", reject);
  req.end(body);
});

for (const [method, path] of API_ROUTES) {
  test(`${method} ${path} without a paired cookie is a 401`, (t) => withOffice(t, async (base) => {
    const res = await fetch(`${base}${path}`, { method, headers: { "Content-Type": "application/json", Origin: base }, body: method === "POST" ? "{}" : undefined });

    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), { error: "unpaired" });
  }));
}

test("a Host of localhost sent from the network does not stand in for a cookie", (t) => withOffice(t, async (base) => {
  const answer = await rawRequest(base, { method: "POST", path: "/api/decisions/x", headers: { Host: "localhost", "Content-Type": "application/json" }, body: "{}" });

  assert.equal(answer.status, 401);
  assert.equal((await rawRequest(base, { path: "/api/state", headers: { Host: LAN_HOST } })).status, 401);
}, { allowedHosts: [LAN_HOST] }));

test("the page files stay public, since they hold no data", (t) => withOffice(t, async (base) => {
  assert.equal((await fetch(`${base}/missing.html`)).status, 404);
  assert.equal((await fetch(`${base}/api/state`)).status, 401);
}));

test("a signed bootstrap gives a code that pairs this browser with an HttpOnly, strict, 90-day cookie", (t) => withOffice(t, async (base) => {
  const code = await issueBootstrapCode(base);

  const res = await redeem(base, code);

  assert.equal(res.status, 204);
  assert.equal(res.headers.get("set-cookie"), `${cookieOf(res)}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${NINETY_DAYS_SECONDS}`);
  assert.equal((await fetch(`${base}/api/state`, { headers: { Cookie: cookieOf(res) } })).status, 200);
}));

test("the bootstrap answer is signed and carries the code, when it expires and the link to open", (t) => withOffice(t, async (base) => {
  const answer = await postSigned(base, "/pairing/bootstrap", { challenge: await bootstrapChallengeOf(base) });

  assert.equal(answer.isSigned, true);
  assert.match(answer.body.code, /^[\w-]{22}$/);
  assert.ok(answer.body.expiresAt > Date.now());
  assert.deepEqual(answer.body.urls, [`${base}/#pair=${answer.body.code}`]);
}));

test("a bootstrap that is not signed with this office's key gets no code", (t) => withOffice(t, async (base) => {
  assert.equal((await postSigned(base, "/pairing/bootstrap", { challenge: await bootstrapChallengeOf(base) }, { key: OTHER_KEY })).status, 401);
  assert.equal((await fetch(`${base}/pairing/bootstrap`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).status, 401);
}));

test("a signed bootstrap without a challenge, or with one the office never gave, gets no code", (t) => withOffice(t, async (base) => {
  assert.equal((await postSigned(base, "/pairing/bootstrap", {})).status, 401);
  assert.equal((await postSigned(base, "/pairing/bootstrap", { challenge: "AAAAAAAAAAAAAAAAAAAAAA" })).status, 401);
}));

test("anyone may ask for a bootstrap challenge, which lasts 30 seconds and needs a JSON request, so a plain form cannot spend them",(t) => withOffice(t, async (base) => {
  const res = await fetch(`${base}/pairing/challenge`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  const answer = await res.json();

  assert.equal(res.status, 200);
  assert.match(answer.challenge, /^[\w-]{22}$/);
  assert.ok(answer.expiresAt <= Date.now() + 30_000);
  assert.equal((await fetch(`${base}/pairing/challenge`, { method: "POST", body: "{}" })).status, 415);
}));

test("a captured bootstrap is refused when sent again, even after the collector restarts", (t) => {
  const secretFile = secretFileFor(t);
  let captured = null;
  return withOffice(t, async (base) => {
    const body = JSON.stringify({ challenge: await bootstrapChallengeOf(base) });
    captured = { body, headers: signedHeaders({ path: "/pairing/bootstrap", body }) };
    const replay = () => fetch(`${base}/pairing/bootstrap`, { method: "POST", ...captured });

    assert.equal((await replay()).status, 200);
    assert.equal((await replay()).status, 401);
  }, { secretFile }).then(() => withOffice(t, async (base) => {
    assert.equal((await fetch(`${base}/pairing/bootstrap`, { method: "POST", ...captured })).status, 401);
  }, { secretFile }));
});

test("a pairing code works only once", (t) => withOffice(t, async (base) => {
  const code = await issueBootstrapCode(base);

  assert.equal((await redeem(base, code)).status, 204);
  const reused = await redeem(base, code);
  assert.equal(reused.status, 400);
  assert.equal(reused.headers.get("set-cookie"), null);
}));

test("an expired pairing code is refused", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.now() });
  return withOffice(t, async (base) => {
    const code = await issueBootstrapCode(base);
    t.mock.timers.tick(120_000);

    assert.equal((await redeem(base, code)).status, 400);
  });
});

test("a made-up code is refused", (t) => withOffice(t, async (base) => {
  assert.equal((await redeem(base, "AAAAAAAAAAAAAAAAAAAAAA")).status, 400);
}));

test("redeeming needs the office page as Origin", (t) => withOffice(t, async (base) => {
  const code = await issueBootstrapCode(base);

  assert.equal((await redeem(base, code, { origin: "http://evil.example" })).status, 403);
  assert.equal((await fetch(`${base}/api/pairings/redeem`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) })).status, 403);
  assert.equal((await redeem(base, code)).status, 204);
}));

test("a paired browser issues a code for another device, with links on this host and on the LAN", (t) => withOffice(t, async (base) => {
  const browser = await pairBrowser(base);

  const res = await browser.post("/api/pairings", {});
  const issued = await res.json();

  assert.equal(res.status, 200);
  const port = new URL(base).port;
  assert.deepEqual(issued.urls, [`${base}/#pair=${issued.code}`, `http://${LAN_HOST}:${port}/#pair=${issued.code}`]);
  assert.equal((await redeem(base, issued.code)).status, 204);
}, { allowedHosts: [LAN_HOST] }));

test("only the paired browser's own page may issue a code", (t) => withOffice(t, async (base) => {
  const browser = await pairBrowser(base);

  assert.equal((await browser.post("/api/pairings", {}, { Origin: "http://evil.example" })).status, 403);
  assert.equal((await fetch(`${base}/api/pairings`, { method: "POST", headers: { Cookie: browser.cookie, "Content-Type": "application/json" }, body: "{}" })).status, 403);
}));

test("the devices list shows each device once, marks the current one and never shows a token", (t) => withOffice(t, async (base) => {
  const laptop = await pairBrowser(base);
  await pairBrowser(base);

  const { devices } = await (await laptop.get("/api/devices")).json();

  assert.equal(devices.length, 2);
  assert.deepEqual(devices.map((device) => device.isCurrent).sort(), [false, true]);
  assert.deepEqual(Object.keys(devices[0]).sort(), ["createdAt", "host", "id", "isCurrent", "label", "lastSeenAt"]);
  assert.ok(!JSON.stringify(devices).includes(laptop.cookie.split("=")[1]));
}));

test("revoking a device signs it out and closes its open page", (t) => withOffice(t, async (base) => {
  const laptop = await pairBrowser(base);
  const phone = await pairBrowser(base);
  const viewer = new AbortController();
  const stream = await phone.get("/api/stream", { signal: viewer.signal });
  const reader = stream.body.getReader();
  await reader.read();
  const { devices } = await (await laptop.get("/api/devices")).json();
  const phoneId = devices.find((device) => !device.isCurrent).id;

  assert.equal((await laptop.post(`/api/devices/${phoneId}/revoke`, {})).status, 204);

  assert.equal(await reader.read().then(({ done }) => done, () => true), true);
  assert.equal((await phone.get("/api/state")).status, 401);
  assert.equal((await laptop.get("/api/state")).status, 200);
  assert.equal((await laptop.post(`/api/devices/${phoneId}/revoke`, {})).status, 404);
  viewer.abort();
}));

test("revoking itself also clears the cookie", (t) => withOffice(t, async (base) => {
  const laptop = await pairBrowser(base);
  const { devices } = await (await laptop.get("/api/devices")).json();

  const res = await laptop.post(`/api/devices/${devices[0].id}/revoke`, {});

  assert.equal(res.status, 204);
  assert.match(res.headers.get("set-cookie"), /^office_session=; .*Max-Age=0$/);
}));

test("loading the state renews the cookie", (t) => withOffice(t, async (base) => {
  const browser = await pairBrowser(base);

  const res = await browser.get("/api/state");

  assert.equal(res.headers.get("set-cookie"), `${browser.cookie}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${NINETY_DAYS_SECONDS}`);
}));

test("only the hash of the cookie goes to disk, and a paired device survives a restart", (t) => {
  const dataDir = dataDirFor(t);
  const secretFile = secretFileFor(t);
  let cookie = null;
  return withOffice(t, async (base) => {
    cookie = (await pairBrowser(base)).cookie;
    const saved = readFileSync(join(dataDir, "devices.json"), "utf8");
    assert.ok(!saved.includes(cookie.split("=")[1]));
    assert.match(saved, /"tokenHash":"[0-9a-f]{64}"/);
  }, { dataDir, secretFile }).then(() => withOffice(t, async (base) => {
    assert.equal((await fetch(`${base}/api/state`, { headers: { Cookie: cookie } })).status, 200);
  }, { dataDir, secretFile }));
});

test("a rotated secret drops every paired device, after a restart and while running", (t) => {
  const dataDir = dataDirFor(t);
  const secretFile = secretFileFor(t);
  let cookie = null;
  return withOffice(t, async (base) => {
    const running = await pairBrowser(base);
    cookie = running.cookie;
    writeFileSync(secretFile, `${OTHER_SECRET}\n`);
    assert.equal((await running.get("/api/state")).status, 401);
  }, { dataDir, secretFile }).then(() => withOffice(t, async (base) => {
    assert.equal((await fetch(`${base}/api/state`, { headers: { Cookie: cookie } })).status, 401);
  }, { dataDir, secretFile }));
});

test("without a secret nothing pairs, and the refusal says the secret is missing", (t) => withOffice(t, async (base) => {
  assert.equal((await postSigned(base, "/pairing/bootstrap", {})).status, 401);
  assert.deepEqual(await (await fetch(`${base}/api/state`)).json(), { error: "unpaired", isSecretMissing: true });
}, { secretFile: null }));

test("the hooks key alone approves nothing in the panel", (t) => withOffice(t, async (base) => {
  const signed = await postSigned(base, "/api/decisions/x", { behavior: "allow" });

  assert.equal(signed.status, 401);
}));

test("an unpaired viewer does not count as an open office page, so permissions go straight to the terminal", (t) => withOffice(t, async (base, office) => {
  const viewer = new AbortController();
  const stream = await fetch(`${base}/api/stream`, { signal: viewer.signal });

  const answer = await postSigned(base, "/hooks/claude/permission", { session_id: "s1", cwd: "/tmp/demo", hook_event_name: "PermissionRequest", tool_name: "Bash", tool_input: { command: "ls" } });

  assert.equal(stream.status, 401);
  assert.deepEqual(answer.body, { decision: null });
  assert.deepEqual(office.decisions.list(), []);
  viewer.abort();
}));

test("a paired page gets the runner ticket for a nonce, signed with the office key", (t) => withOffice(t, async (base) => {
  const browser = await pairBrowser(base);
  const nonce = "AAECAwQFBgcICQoLDA0ODw";

  const res = await browser.post("/api/runner-ticket", { nonce });

  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ticket: "kAQ744p9HcBF8JvI2Tx0JiekFQsGFuWcAw2gPsykN_M" });
  assert.equal((await browser.post("/api/runner-ticket", { nonce: "not a nonce" })).status, 400);
  assert.equal((await fetch(`${base}/api/runner-ticket`, { method: "POST", headers: { "Content-Type": "application/json", Origin: base }, body: JSON.stringify({ nonce }) })).status, 401);
}));
