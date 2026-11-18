import { test } from "node:test";
import assert from "node:assert/strict";
import { toMessageText } from "../src/sessions/message-text.js";

const MESSAGE_LIMIT = 8_000;

test("a message loses its surrounding whitespace", () => {
  assert.equal(toMessageText("  \n now commit \t "), "now commit");
});

test("a message is cut at the limit after trimming", () => {
  assert.equal(toMessageText(` ${"x".repeat(MESSAGE_LIMIT + 1)}`), "x".repeat(MESSAGE_LIMIT));
});

test("anything that is not text becomes an empty message", () => {
  assert.deepEqual([undefined, null, 42, { text: "hi" }].map(toMessageText), ["", "", "", ""]);
});
