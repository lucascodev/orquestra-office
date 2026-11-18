import assert from "node:assert/strict";
import { chmodSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { ConcurrentChangeError, renameWithRetry, writeFileAtomically } from "../lib/atomic-write.mjs";

function folder(t) {
  const dir = mkdtempSync(join(tmpdir(), "office-atomic-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

const leftovers = (dir) => readdirSync(dir).filter((name) => name.includes(".tmp-"));

function linkOrSkip(t, target, link) {
  try {
    symlinkSync(target, link, "file");
    return true;
  } catch (error) {
    if (error.code !== "EPERM") throw error;
    t.skip("creating symlinks needs Developer Mode or admin on Windows");
    return false;
  }
}

const failingTimes = (count, code) => {
  const calls = [];
  return {
    calls,
    rename: (from, to) => {
      calls.push([from, to]);
      if (calls.length <= count) throw Object.assign(new Error(code), { code });
    },
  };
};

test("replaces the file with the new text and leaves no temporary file", (t) => {
  const dir = folder(t);
  const path = join(dir, "settings.json");
  writeFileSync(path, "old");

  writeFileAtomically(path, "new", { expectedText: "old" });

  assert.equal(readFileSync(path, "utf8"), "new");
  assert.deepEqual(leftovers(dir), []);
});

test("creates the file when it was expected to be absent", (t) => {
  const dir = folder(t);
  const path = join(dir, "config.toml");

  writeFileAtomically(path, "new", { expectedText: null });

  assert.equal(readFileSync(path, "utf8"), "new");
});

test("refuses to write when the file changed since it was read, keeping the other writer's content", (t) => {
  const dir = folder(t);
  const path = join(dir, "settings.json");
  writeFileSync(path, "saved by Claude Code meanwhile");

  assert.throws(() => writeFileAtomically(path, "new", { expectedText: "what the installer read" }), ConcurrentChangeError);

  assert.equal(readFileSync(path, "utf8"), "saved by Claude Code meanwhile");
  assert.deepEqual(leftovers(dir), []);
});

test("refuses to write when a file appeared where none was read", (t) => {
  const dir = folder(t);
  const path = join(dir, "settings.json");
  writeFileSync(path, "{}");

  assert.throws(() => writeFileAtomically(path, "new", { expectedText: null }), ConcurrentChangeError);
  assert.equal(readFileSync(path, "utf8"), "{}");
});

test("writes through a symlink and keeps the link", (t) => {
  const dir = folder(t);
  mkdirSync(join(dir, "dotfiles"));
  const target = join(dir, "dotfiles", "settings.json");
  const link = join(dir, "settings.json");
  writeFileSync(target, "old");
  if (!linkOrSkip(t, target, link)) return;

  writeFileAtomically(link, "new", { expectedText: "old" });

  assert.ok(lstatSync(link).isSymbolicLink());
  assert.equal(readFileSync(target, "utf8"), "new");
  assert.deepEqual([...leftovers(dir), ...leftovers(join(dir, "dotfiles"))], []);
});

test("keeps the file mode of the original", { skip: process.platform === "win32" && "file modes are not POSIX on Windows" }, (t) => {
  const path = join(folder(t), "settings.json");
  writeFileSync(path, "old");
  chmodSync(path, 0o640);

  writeFileAtomically(path, "new", { expectedText: "old" });

  assert.equal(statSync(path).mode & 0o777, 0o640);
});

test("on Windows, retries a rename that fails for a moment with EPERM or EBUSY", () => {
  for (const code of ["EPERM", "EBUSY"]) {
    const { calls, rename } = failingTimes(2, code);

    renameWithRetry("a.tmp", "a", { rename, platform: "win32", delayMs: 0 });

    assert.equal(calls.length, 3);
  }
});

test("gives up after a few attempts, and does not retry elsewhere or for other errors", () => {
  assert.throws(() => renameWithRetry("a.tmp", "a", { rename: failingTimes(99, "EBUSY").rename, platform: "win32", delayMs: 0 }), { code: "EBUSY" });

  const posix = failingTimes(1, "EPERM");
  assert.throws(() => renameWithRetry("a.tmp", "a", { rename: posix.rename, platform: "linux", delayMs: 0 }), { code: "EPERM" });
  assert.equal(posix.calls.length, 1);

  const other = failingTimes(1, "ENOENT");
  assert.throws(() => renameWithRetry("a.tmp", "a", { rename: other.rename, platform: "win32", delayMs: 0 }), { code: "ENOENT" });
  assert.equal(other.calls.length, 1);
});
