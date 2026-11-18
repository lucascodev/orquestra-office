import { test } from "node:test";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
import { changesOf } from "../src/claude/stream-changes.js";
import { createRunner } from "../src/composition.js";

const OFFICE = "http://localhost:8420";
const JSON_HEADERS = { "Content-Type": "application/json", Origin: OFFICE };
const SESSION_ID = "11111111-2222-3333-4444-555555555555";

function fakeClaude() {
  const processes = [];
  const startProcess = ({ onChange, onExit }) => {
    const sent = [];
    const emit = (event) => changesOf(event).forEach(onChange);
    const fake = {
      sent, interrupts: 0,
      emit,
      send: (text) => { sent.push(text); emit({ type: "system", subtype: "init", session_id: SESSION_ID }); },
      interrupt: () => { fake.interrupts += 1; },
      stop: () => onExit({ code: 0, error: "" }),
    };
    processes.push(fake);
    return fake;
  };
  return { startProcess, processes };
}

async function withRunner(run) {
  const claude = fakeClaude();
  const { server } = createRunner({ allowedOrigins: [OFFICE], startProcess: claude.startProcess });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await run(base, claude); } finally { server.closeAllConnections(); server.close(); }
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
    [{ type: "entry", entry: { kind: "tool", text: "Bash: Run tests", detail: "npm test" } }]);
  assert.deepEqual(changesOf({ type: "assistant", parent_tool_use_id: "t1", message: { content: [{ type: "text", text: "subagent chatter" }] } }), []);
  assert.deepEqual(changesOf({ type: "result", is_error: true, terminal_reason: "aborted_streaming" }),
    [{ type: "status", status: "idle" }, { type: "entry", entry: { kind: "note", text: "turno interrompido", detail: "" } }]);
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
  process.emit({ type: "stream_event", event: { type: "content_block_delta", delta: { type: "text_delta", text: "All gre" } } });
  assert.equal((await readSnapshot(base, session.id)).partial, "All gre");

  process.emit({ type: "assistant", message: { content: [{ type: "text", text: "All green." }] } });
  process.emit({ type: "result", is_error: false });
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

test("only the office page may talk to the runner", () => withRunner(async (base, claude) => {
  const forged = await post(`${base}/sessions`, { cwd: tmpdir(), prompt: "hi" }, { "Content-Type": "application/json", Origin: "http://evil.example" });
  assert.equal(forged.status, 403);
  assert.equal((await post(`${base}/sessions`, "cwd=x", { "Content-Type": "text/plain", Origin: OFFICE })).status, 415);
  assert.equal(claude.processes.length, 0);

  const preflight = await fetch(`${base}/sessions`, { method: "OPTIONS", headers: { Origin: OFFICE, "Access-Control-Request-Method": "POST" } });
  assert.equal(preflight.headers.get("access-control-allow-origin"), OFFICE);
}));
