import { test } from "node:test";
import { request } from "node:http";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
import { changesOf } from "../src/claude/stream-changes.js";
import { createRunner } from "../src/composition.js";
import { createServer } from "../src/http/server.js";
import { fakeClaudeLauncher } from "./support/fake-claude-process.js";
import { listenOnFetchablePort } from "./support/listen-on-fetchable-port.js";

const OFFICE = "http://localhost:8420";
const JSON_HEADERS = { "Content-Type": "application/json", Origin: OFFICE };
const SESSION_ID = "11111111-2222-3333-4444-555555555555";

async function withRunner(run) {
  const claude = fakeClaudeLauncher({ sessionId: SESSION_ID });
  const runner = createRunner({ allowedOrigins: [OFFICE], startProcess: claude.startProcess });
  const { server } = runner;
  const base = await listenOnFetchablePort(server);
  try { await run(base, claude, runner); } finally { server.closeAllConnections(); server.close(); }
}

const post = (url, body, headers = JSON_HEADERS) => fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
const openSession = async (base, prompt = "run the tests") => (await (await post(`${base}/sessions`, { cwd: tmpdir(), prompt })).json()).session;

async function readSnapshot(base, id) {
  const viewer = new AbortController();
  const stream = await fetch(`${base}/sessions/${id}/stream`, { headers: { Origin: OFFICE }, signal: viewer.signal });
  const { value } = await stream.body.getReader().read();
  viewer.abort();
  return JSON.parse(new TextDecoder().decode(value).split("data: ")[1]);
}

test("stream events become terminal changes", () => {
  assert.deepEqual(changesOf({ type: "stream_event", session_id: "s", event: { type: "content_block_delta", delta: { type: "text_delta", text: "ol" } } }),
    [{ type: "session", sessionId: "s" }, { type: "delta", text: "ol" }]);
  assert.deepEqual(changesOf({ type: "assistant", message: { content: [{ type: "tool_use", name: "Bash", input: { command: "npm test", description: "Run tests" } }] } }),
    [{ type: "entry", entry: { kind: "tool", toolName: "Bash", summaryId: "run-command", subject: "Run tests", text: "Bash: Run tests", detail: "npm test" } }]);
  assert.deepEqual(changesOf({ type: "assistant", parent_tool_use_id: "t1", message: { content: [{ type: "text", text: "subagent chatter" }] } }), []);
  assert.deepEqual(changesOf({ type: "result", is_error: true, terminal_reason: "aborted_streaming" }),
    [{ type: "status", status: "idle" }, { type: "entry", entry: { kind: "note", textId: "turn-interrupted", text: "turno interrompido", detail: "" } }]);
});

test("opening a session starts Claude Code with the first message and reports its id", () => withRunner(async (base, claude) => {
  const session = await openSession(base);
  assert.equal(session.sessionId, SESSION_ID);
  assert.equal(session.status, "working");
  assert.deepEqual(claude.processes[0].sent, ["run the tests"]);
  assert.deepEqual((await (await fetch(`${base}/sessions`)).json()).sessions.map((item) => item.id), [session.id]);
}));

test("a session needs a real folder and a first message", () => withRunner(async (base, claude) => {
  assert.equal((await post(`${base}/sessions`, { cwd: "/definitely/not/here", prompt: "hi" })).status, 400);
  assert.equal((await post(`${base}/sessions`, { cwd: tmpdir(), prompt: "  " })).status, 400);
  assert.equal(claude.processes.length, 0);
}));

test("messages, interrupts and the transcript reach the right session", () => withRunner(async (base, claude) => {
  const session = await openSession(base);
  const [process] = claude.processes;
  process.printEvent({ type: "stream_event", event: { type: "content_block_delta", delta: { type: "text_delta", text: "All gre" } } });
  assert.equal((await readSnapshot(base, session.id)).partial, "All gre");

  process.printEvent({ type: "assistant", message: { content: [{ type: "text", text: "All green." }] } });
  process.printEvent({ type: "result", is_error: false });
  assert.equal((await post(`${base}/sessions/${session.id}/messages`, { text: "now commit" })).status, 200);
  assert.equal((await post(`${base}/sessions/${session.id}/interrupt`, {})).status, 200);

  const snapshot = await readSnapshot(base, session.id);
  assert.deepEqual(snapshot.entries.map((entry) => [entry.kind, entry.text]), [["prompt", "run the tests"], ["reply", "All green."], ["prompt", "now commit"]]);
  assert.equal(snapshot.partial, "");
  assert.deepEqual(process.sent, ["run the tests", "now commit"]);
  assert.equal(process.interrupts, 1);
}));

test("an ended session refuses new messages", () => withRunner(async (base) => {
  const session = await openSession(base);
  assert.equal((await post(`${base}/sessions/${session.id}/stop`, {})).status, 200);
  assert.equal((await post(`${base}/sessions/${session.id}/messages`, { text: "still there?" })).status, 409);
  assert.equal((await readSnapshot(base, session.id)).session.status, "ended");
}));

test("stopping the runner ends every open session", () => withRunner(async (base, claude, runner) => {
  const first = await openSession(base);
  const second = await openSession(base, "review the diff");
  runner.stop();

  const { sessions } = await (await fetch(`${base}/sessions`)).json();
  assert.deepEqual(sessions.map((item) => [item.id, item.status]), [[first.id, "ended"], [second.id, "ended"]]);
}));

test("only the office page may talk to the runner", () => withRunner(async (base, claude) => {
  const forged = await post(`${base}/sessions`, { cwd: tmpdir(), prompt: "hi" }, { "Content-Type": "application/json", Origin: "http://evil.example" });
  assert.equal(forged.status, 403);
  assert.equal((await post(`${base}/sessions`, "cwd=x", { "Content-Type": "text/plain", Origin: OFFICE })).status, 415);
  assert.equal(claude.processes.length, 0);

  const preflight = await fetch(`${base}/sessions`, { method: "OPTIONS", headers: { Origin: OFFICE, "Access-Control-Request-Method": "POST" } });
  assert.equal(preflight.headers.get("access-control-allow-origin"), OFFICE);
}));

const RAW_REQUEST_TIMEOUT_MS = 2_000;
const CRASH_TEST_TIMEOUT_MS = 5_000;

const rawGet = (base, path) => new Promise((resolve, reject) => {
  const { hostname, port } = new URL(base);
  const req = request({ hostname, port, path, headers: { Host: "localhost" }, signal: AbortSignal.timeout(RAW_REQUEST_TIMEOUT_MS) }, (res) => {
    res.resume();
    res.on("end", () => resolve(res.statusCode));
  });
  req.on("error", reject);
  req.end();
});

test("a malformed request URL is a 400 and the runner keeps running", { timeout: CRASH_TEST_TIMEOUT_MS }, () => withRunner(async (base) => {
  assert.equal(await rawGet(base, "//["), 400);
  assert.equal(await rawGet(base, "/health"), 200);
}));

test("an unexpected failure in a route answers 500, is logged and the runner keeps running", { timeout: CRASH_TEST_TIMEOUT_MS }, async (t) => {
  const reportError = t.mock.method(console, "error", () => {});
  const failingRegistry = { list: () => { throw new Error("registry exploded"); } };
  const server = createServer({ registry: failingRegistry, allowedOrigins: [OFFICE] });
  const base = await listenOnFetchablePort(server);
  try {
    assert.equal(await rawGet(base, "/sessions"), 500);
    assert.equal(await rawGet(base, "/health"), 200);
    assert.equal(reportError.mock.callCount(), 1);
  } finally { server.closeAllConnections(); server.close(); }
});
