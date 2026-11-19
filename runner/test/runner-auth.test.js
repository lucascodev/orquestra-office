import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runnerTicketMessage } from "../../collector/src/shared/auth/signed-message.js";
import { createRunner } from "../src/composition.js";
import { fakeClaudeLauncher } from "./support/fake-claude-process.js";
import { listenOnFetchablePort } from "./support/listen-on-fetchable-port.js";

const OFFICE = "http://localhost:8420";
const SECRET = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8";
const OTHER_SECRET = "HxwdHh8AAQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRo";
const JSON_HEADERS = { "Content-Type": "application/json", Origin: OFFICE };
const CHALLENGE_TTL_MS = 60_000;

function secretFileFor(t) {
  const dir = mkdtempSync(join(tmpdir(), "runner-secret-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, "secret");
  writeFileSync(file, `${SECRET}\n`);
  return file;
}

async function withRunner(t, run, { secretFile = secretFileFor(t) } = {}) {
  const claude = fakeClaudeLauncher({ sessionId: "11111111-2222-3333-4444-555555555555" });
  const runner = createRunner({ allowedOrigins: [OFFICE], startProcess: claude.startProcess, secretFile });
  const base = await listenOnFetchablePort(runner.server);
  try { await run(base, { claude, secretFile }); } finally { runner.server.closeAllConnections(); runner.server.close(); }
}

const ticketFor = (nonce, secret = SECRET) => createHmac("sha256", Buffer.from(secret, "base64url")).update(runnerTicketMessage(nonce)).digest("base64url");
const post = (base, path, body, headers = JSON_HEADERS) => fetch(`${base}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
const challengeOf = async (base) => (await (await post(base, "/auth/challenge", {})).json()).nonce;

async function tokenOf(base, secret = SECRET) {
  const nonce = await challengeOf(base);
  const res = await post(base, "/auth/session", { nonce, ticket: ticketFor(nonce, secret) });
  return { status: res.status, body: await res.json() };
}

const authorized = (token) => ({ ...JSON_HEADERS, Authorization: `Bearer ${token}` });

for (const [method, path] of [["GET", "/sessions"], ["POST", "/sessions"], ["GET", "/sessions/x/stream"], ["POST", "/sessions/x/messages"], ["POST", "/sessions/x/interrupt"], ["POST", "/sessions/x/stop"]]) {
  test(`${method} ${path} without a token is a 401`, (t) => withRunner(t, async (base, { claude }) => {
    const res = await fetch(`${base}${path}`, { method, headers: JSON_HEADERS, body: method === "POST" ? "{}" : undefined });

    assert.equal(res.status, 401);
    assert.equal(claude.processes.length, 0);
  }));
}

test("the health check stays open, so the page can tell the runner is there", (t) => withRunner(t, async (base) => {
  assert.equal((await fetch(`${base}/health`)).status, 200);
}));

test("a ticket signed by the office for the runner's nonce opens a session token that works on every route", (t) => withRunner(t, async (base, { claude }) => {
  const { status, body } = await tokenOf(base);

  assert.equal(status, 200);
  assert.match(body.token, /^[\w-]{43}$/);
  assert.ok(body.expiresAt > Date.now());
  assert.equal((await fetch(`${base}/sessions`, { headers: authorized(body.token) })).status, 200);
  const opened = await post(base, "/sessions", { cwd: tmpdir(), prompt: "hi" }, authorized(body.token));
  assert.equal(opened.status, 201);
  const { session } = await opened.json();
  const viewer = new AbortController();
  const stream = await fetch(`${base}/sessions/${session.id}/stream?token=${body.token}`, { headers: { Origin: OFFICE }, signal: viewer.signal });
  assert.equal(stream.status, 200);
  viewer.abort();
  assert.equal(claude.processes.length, 1);
}));

test("a ticket made with another key is refused", (t) => withRunner(t, async (base) => {
  assert.equal((await tokenOf(base, OTHER_SECRET)).status, 401);
}));

test("a ticket for another nonce is refused", (t) => withRunner(t, async (base) => {
  const nonce = await challengeOf(base);
  const other = await challengeOf(base);

  assert.equal((await post(base, "/auth/session", { nonce, ticket: ticketFor(other) })).status, 401);
}));

test("a challenge works once, even when the first try was wrong", (t) => withRunner(t, async (base) => {
  const nonce = await challengeOf(base);

  assert.equal((await post(base, "/auth/session", { nonce, ticket: "wrong" })).status, 401);
  assert.equal((await post(base, "/auth/session", { nonce, ticket: ticketFor(nonce) })).status, 401);

  const fresh = await challengeOf(base);
  assert.equal((await post(base, "/auth/session", { nonce: fresh, ticket: ticketFor(fresh) })).status, 200);
  assert.equal((await post(base, "/auth/session", { nonce: fresh, ticket: ticketFor(fresh) })).status, 401);
}));

test("a challenge expires after a minute", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: Date.now() });
  return withRunner(t, async (base) => {
    const nonce = await challengeOf(base);
    t.mock.timers.tick(CHALLENGE_TTL_MS);

    assert.equal((await post(base, "/auth/session", { nonce, ticket: ticketFor(nonce) })).status, 401);
  });
});

test("a made-up token is refused, in the header and in the stream address", (t) => withRunner(t, async (base) => {
  assert.equal((await fetch(`${base}/sessions`, { headers: authorized("A".repeat(43)) })).status, 401);
  assert.equal((await fetch(`${base}/sessions/x/stream?token=${"A".repeat(43)}`, { headers: { Origin: OFFICE } })).status, 401);
}));

test("the token is taken from the address only for the stream, which EventSource cannot give headers", (t) => withRunner(t, async (base) => {
  const { body } = await tokenOf(base);

  assert.equal((await fetch(`${base}/sessions?token=${body.token}`, { headers: { Origin: OFFICE } })).status, 401);
}));

test("rotating the secret drops the tokens already given", (t) => withRunner(t, async (base, { secretFile }) => {
  const { body } = await tokenOf(base);
  writeFileSync(secretFile, `${OTHER_SECRET}\n`);

  assert.equal((await fetch(`${base}/sessions`, { headers: authorized(body.token) })).status, 401);
  assert.equal((await tokenOf(base, OTHER_SECRET)).status, 200);
}));

test("without the secret no token is ever given", (t) => withRunner(t, async (base) => {
  assert.equal((await tokenOf(base)).status, 401);
}, { secretFile: null }));

test("the office page may send the Authorization header across origins", (t) => withRunner(t, async (base) => {
  const preflight = await fetch(`${base}/sessions`, { method: "OPTIONS", headers: { Origin: OFFICE, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization" } });

  assert.match(preflight.headers.get("access-control-allow-headers"), /Authorization/);
}));
