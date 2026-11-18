import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeCodexEvent } from "../src/codex/codex-event.js";

const PATH_LIMIT = 400;
const SESSION_ID_LIMIT = 128;
const HUGE_CWD = "/home/".padEnd(1_200_000, "x");
const LONG_THREAD_ID = "t".repeat(SESSION_ID_LIMIT * 4);

test("a finished codex turn waits for the user in the folder of the turn", () => {
  const e = normalizeCodexEvent({ type: "agent-turn-complete", "thread-id": "t1", cwd: "/home/dev/loja" }, 1);
  assert.deepEqual({ sessionId: e.sessionId, cwd: e.cwd, status: e.status }, { sessionId: "t1", cwd: "/home/dev/loja", status: "waiting" });
});

test("a huge cwd and a long thread id are cut, so one notify cannot blow up every frame of the office", () => {
  const e = normalizeCodexEvent({ type: "agent-turn-complete", "thread-id": LONG_THREAD_ID, cwd: HUGE_CWD }, 1);
  assert.equal(e.cwd, HUGE_CWD.slice(0, PATH_LIMIT));
  assert.equal(e.sessionId, LONG_THREAD_ID.slice(0, SESSION_ID_LIMIT));
});
