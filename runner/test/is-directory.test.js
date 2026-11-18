import { test } from "node:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { isDirectory } from "../src/infra/is-directory.js";

test("an existing folder is a directory", () => {
  assert.equal(isDirectory(tmpdir()), true);
});

test("a missing path or a file is not a directory", () => {
  assert.equal(isDirectory(join(tmpdir(), "definitely-not-here-8421")), false);
  assert.equal(isDirectory(fileURLToPath(import.meta.url)), false);
});
