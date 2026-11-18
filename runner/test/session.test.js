import { test } from "node:test";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
import { createSession } from "../src/sessions/session.js";
import { fakeClaudeLauncher } from "./support/fake-claude-process.js";

const STARTED_AT = Date.parse("2026-11-18T12:00:00Z");
const SESSION_ID_WAIT_MS = 20_000;
const PENDING = Symbol("pending");

function startSession() {
  const claude = fakeClaudeLauncher();
  const session = createSession({ cwd: tmpdir(), startProcess: claude.startProcess, now: () => STARTED_AT });
  return { session, process: claude.processes[0] };
}

const settledValue = (promise) => Promise.race([promise, new Promise((resolve) => setImmediate(() => resolve(PENDING)))]);

test("a crash with an error ends the session with a 'a sessão caiu' entry carrying the error", () => {
  const { session, process } = startSession();
  process.exit({ code: null, error: "spawn claude ENOENT" });

  assert.deepEqual(session.transcript().entries, [{ at: STARTED_AT, kind: "error", text: "a sessão caiu", detail: "spawn claude ENOENT" }]);
  assert.equal(session.summary().status, "ended");
  assert.equal(session.summary().endedAt, STARTED_AT);
});

test("sessionIdWithin is still waiting one millisecond before the deadline", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { session } = startSession();
  const sessionId = session.sessionIdWithin(SESSION_ID_WAIT_MS);
  t.mock.timers.tick(SESSION_ID_WAIT_MS - 1);

  assert.equal(await settledValue(sessionId), PENDING);
});

test("sessionIdWithin gives null when Claude reports no session id in time", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { session } = startSession();
  const sessionId = session.sessionIdWithin(SESSION_ID_WAIT_MS);
  t.mock.timers.tick(SESSION_ID_WAIT_MS);

  assert.equal(await settledValue(sessionId), null);
});
