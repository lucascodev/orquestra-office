import assert from "node:assert/strict";
import { test } from "node:test";
import { canLookUpGitSafely } from "../lib/git-lookup.mjs";

test("on Windows, git is looked up only when libuv honors NoDefaultCurrentDirectoryInExePath (1.48 or newer)", () => {
  for (const libuvVersion of ["1.48.0", "1.48.1", "1.51.0", "2.0.0", "1.100.0"]) {
    assert.equal(canLookUpGitSafely({ platform: "win32", libuvVersion }), true, libuvVersion);
  }
  for (const libuvVersion of ["1.47.9", "1.46.0", "1.9.0", "0.99.0"]) {
    assert.equal(canLookUpGitSafely({ platform: "win32", libuvVersion }), false, libuvVersion);
  }
});

test("on Windows, an unreadable libuv version counts as too old", () => {
  for (const libuvVersion of [undefined, "", "abc", "1"]) {
    assert.equal(canLookUpGitSafely({ platform: "win32", libuvVersion }), false, String(libuvVersion));
  }
});

test("elsewhere the current folder is never searched, so any libuv will do", () => {
  assert.equal(canLookUpGitSafely({ platform: "linux", libuvVersion: "1.40.0" }), true);
  assert.equal(canLookUpGitSafely({ platform: "darwin", libuvVersion: undefined }), true);
});
