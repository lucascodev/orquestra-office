import { test } from "node:test";
import assert from "node:assert/strict";
import { stdoutChanges } from "../src/claude/stdout-changes.js";

const SESSION_ID = "8f0c2a4e-1b3d-4c5e-9f6a-7b8c9d0e1f2a";

const streamLine = (event) => `${JSON.stringify({ ...event, session_id: SESSION_ID })}\n`;

const INIT = streamLine({ type: "system", subtype: "init", cwd: "/home/dev/loja", tools: ["Bash", "Read"], model: "claude-opus" });
const MESSAGE_START = streamLine({ type: "stream_event", parent_tool_use_id: null, event: { type: "message_start", message: { id: "msg_1", role: "assistant", content: [] } } });
const TEXT_DELTA = streamLine({ type: "stream_event", parent_tool_use_id: null, event: { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Tudo ve" } } });
const ASSISTANT = streamLine({ type: "assistant", parent_tool_use_id: null, message: { id: "msg_1", role: "assistant", content: [{ type: "text", text: "Tudo verde." }] } });
const RESULT = streamLine({ type: "result", subtype: "success", is_error: false, result: "Tudo verde." });

function collectChanges(chunks) {
  const changes = [];
  const onChunk = stdoutChanges((change) => changes.push(change));
  chunks.forEach(onChunk);
  return changes;
}

const session = { type: "session", sessionId: SESSION_ID };

test("a turn read from stdout becomes session, status, delta and entry changes in order", () => {
  assert.deepEqual(collectChanges([INIT, MESSAGE_START, TEXT_DELTA, ASSISTANT, RESULT]), [
    session,
    session, { type: "status", status: "working" },
    session, { type: "delta", text: "Tudo ve" },
    session, { type: "entry", entry: { kind: "reply", text: "Tudo verde.", detail: "" } },
    session, { type: "status", status: "idle" },
  ]);
});

test("a line split across chunks is read once it is complete", () => {
  const cut = Math.floor(TEXT_DELTA.length / 2);
  const changes = [];
  const onChunk = stdoutChanges((change) => changes.push(change));

  onChunk(TEXT_DELTA.slice(0, cut));
  assert.deepEqual(changes, []);
  onChunk(TEXT_DELTA.slice(cut));
  assert.deepEqual(changes, [session, { type: "delta", text: "Tudo ve" }]);
});

test("several lines in one chunk all become changes", () => {
  assert.deepEqual(collectChanges([`${MESSAGE_START}${TEXT_DELTA}`]), [session, { type: "status", status: "working" }, session, { type: "delta", text: "Tudo ve" }]);
});

test("a line that is not JSON is skipped and the next lines still come through", () => {
  assert.deepEqual(collectChanges(["Warning: something printed outside stream-json\n", TEXT_DELTA]), [session, { type: "delta", text: "Tudo ve" }]);
});

test("each change reaches the listener alone", () => {
  const calls = [];
  stdoutChanges((...args) => calls.push(args))(TEXT_DELTA);
  assert.deepEqual(calls, [[session], [{ type: "delta", text: "Tudo ve" }]]);
});
