import { test } from "node:test";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
import { createSessionRegistry } from "../src/sessions/session-registry.js";
import { fakeClaudeLauncher } from "./support/fake-claude-process.js";

const MAX_OPEN_SESSIONS = 8;
const ENDED_SESSION_TTL_MS = 10 * 60_000;
const PROMPT_LIMIT = 8_000;
const START = Date.parse("2026-11-18T12:00:00Z");

function registryAt(clock = { now: START }) {
  const claude = fakeClaudeLauncher();
  const registry = createSessionRegistry({ startProcess: claude.startProcess, now: () => clock.now });
  return { registry, claude, clock };
}

const openIn = (registry, prompt = "run the tests") => registry.open({ cwd: tmpdir(), prompt });

test("refuses a ninth open session and starts no process for it", () => {
  const { registry, claude } = registryAt();
  for (let index = 0; index < MAX_OPEN_SESSIONS; index += 1) assert.ok(openIn(registry).session);

  assert.deepEqual(openIn(registry), { error: `Já existem ${MAX_OPEN_SESSIONS} sessões abertas pelo escritório. Encerre uma antes.` });
  assert.equal(claude.processes.length, MAX_OPEN_SESSIONS);
});

test("an ended session frees its place under the limit", () => {
  const { registry } = registryAt();
  const sessions = Array.from({ length: MAX_OPEN_SESSIONS }, () => openIn(registry).session);
  sessions[0].stop();

  assert.ok(openIn(registry).session);
});

test("an ended session is still listed exactly at the ten minute mark", () => {
  const { registry, clock } = registryAt();
  const { session } = openIn(registry);
  session.stop();
  clock.now += ENDED_SESSION_TTL_MS;

  assert.deepEqual(registry.list().map((item) => item.id), [session.id]);
});

test("an ended session is forgotten once more than ten minutes have passed", () => {
  const { registry, clock } = registryAt();
  const { session } = openIn(registry);
  session.stop();
  clock.now += ENDED_SESSION_TTL_MS + 1;

  assert.deepEqual(registry.list(), []);
  assert.equal(registry.get(session.id), null);
});

test("a session that is still open is never forgotten, however old", () => {
  const { registry, clock } = registryAt();
  const { session } = openIn(registry);
  clock.now += ENDED_SESSION_TTL_MS * 100;

  assert.deepEqual(registry.list().map((item) => item.id), [session.id]);
});

test("the first message reaches Claude without surrounding whitespace", () => {
  const { registry, claude } = registryAt();
  openIn(registry, "  \n run the tests \t ");

  assert.deepEqual(claude.processes[0].sent, ["run the tests"]);
});

test("the first message is cut at the prompt limit", () => {
  const { registry, claude } = registryAt();
  openIn(registry, "x".repeat(PROMPT_LIMIT + 1));

  assert.deepEqual(claude.processes[0].sent, ["x".repeat(PROMPT_LIMIT)]);
});
