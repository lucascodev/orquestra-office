import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { test } from "node:test";
import { readStdin } from "../lib/read-stdin.mjs";

test("joins every chunk before decoding, so a character split between chunks survives", async () => {
  const [first, second] = [Buffer.from([0x7b, 0x22, 0xc3]), Buffer.from([0xa7, 0x22, 0x7d])];

  assert.equal(await readStdin(Readable.from([first, second])), '{"ç"}');
});

test("empty input reads as an empty string", async () => {
  assert.equal(await readStdin(Readable.from([])), "");
});
