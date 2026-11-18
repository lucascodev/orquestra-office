import { test } from "node:test";
import assert from "node:assert/strict";
import { lineReader, parseEvent } from "../src/claude/json-lines.js";

function collectLines() {
  const lines = [];
  return { lines, read: lineReader((line) => lines.push(line)) };
}

test("a line split across chunks is delivered once, whole, when its newline arrives", () => {
  const { lines, read } = collectLines();
  read('{"type":"sys');
  assert.deepEqual(lines, []);
  read('tem"}\n{"type":');
  assert.deepEqual(lines, ['{"type":"system"}']);
  read('"result"}\n');
  assert.deepEqual(lines, ['{"type":"system"}', '{"type":"result"}']);
});

test("blank and whitespace-only lines are skipped", () => {
  const { lines, read } = collectLines();
  read("first\n\n   \nsecond\n");
  assert.deepEqual(lines, ["first", "second"]);
});

test("windows line endings do not leak into the line", () => {
  const { lines, read } = collectLines();
  read("first\r\nsecond\r\n");
  assert.deepEqual(lines, ["first", "second"]);
});

test("a JSON line becomes the event it encodes", () => {
  assert.deepEqual(parseEvent('{"type":"result","is_error":false}'), { type: "result", is_error: false });
});

test("a line that is not JSON is ignored instead of throwing", () => {
  assert.equal(parseEvent("Warning: something printed to stdout"), null);
});
