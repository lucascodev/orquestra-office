import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createOfficeStateFile as createPersistence } from "../src/office/infra/office-state-file.js";

const STATE_FILE = "office.json";
const SAVE_DELAY_MS = 2_000;
const PERMISSION_BITS = 0o777;
const OWNER_ONLY_FILE = 0o600;
const SAVED_STATE = { projects: { "/home/dev/loja": { key: "/home/dev/loja", name: "loja", agents: {} } }, sessions: { s1: "/home/dev/loja" } };

async function withDataDir(run) {
  const dir = await mkdtemp(join(tmpdir(), "office-persistence-"));
  try { await run(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}

test("a saved state loads back the same", () => withDataDir(async (dir) => {
  createPersistence(dir).saveNow(SAVED_STATE);
  assert.deepEqual(createPersistence(dir).load(), SAVED_STATE);
}));

test("saving creates the data folder when it does not exist yet", () => withDataDir(async (dir) => {
  const dataDir = join(dir, "nested", "data");
  createPersistence(dataDir).saveNow(SAVED_STATE);
  assert.deepEqual(JSON.parse(await readFile(join(dataDir, STATE_FILE), "utf8")), SAVED_STATE);
}));

// Windows keeps no owner-only bit in the file mode, so only POSIX systems can show it.
test("the state file can be read and written only by its owner", { skip: process.platform === "win32" }, () => withDataDir(async (dir) => {
  createPersistence(dir).saveNow(SAVED_STATE);
  assert.equal((await stat(join(dir, STATE_FILE))).mode & PERMISSION_BITS, OWNER_ONLY_FILE);
}));

test("a temp file left by a crash does not hand its mode to the state file", { skip: process.platform === "win32" }, () => withDataDir(async (dir) => {
  await writeFile(join(dir, `${STATE_FILE}.tmp`), "{}", { mode: 0o644 });
  createPersistence(dir).saveNow(SAVED_STATE);
  assert.equal((await stat(join(dir, STATE_FILE))).mode & PERMISSION_BITS, OWNER_ONLY_FILE);
}));

test("a temp file left by a crash is replaced by the new state", () => withDataDir(async (dir) => {
  await writeFile(join(dir, `${STATE_FILE}.tmp`), "left over");
  createPersistence(dir).saveNow(SAVED_STATE);
  assert.deepEqual(JSON.parse(await readFile(join(dir, STATE_FILE), "utf8")), SAVED_STATE);
}));

test("with nothing saved yet the state loads as null", () => withDataDir(async (dir) => {
  assert.equal(createPersistence(dir).load(), null);
}));

test("a corrupted state file loads as null instead of throwing", (t) => withDataDir(async (dir) => {
  t.mock.method(console, "error", () => {});
  await writeFile(join(dir, STATE_FILE), "{\"projects\": {");
  assert.equal(createPersistence(dir).load(), null);
}));

test("an atomic save leaves only the final state file, with no temporary file behind", () => withDataDir(async (dir) => {
  const persistence = createPersistence(dir);
  persistence.saveNow({ projects: {} });
  persistence.saveNow(SAVED_STATE);
  assert.deepEqual(await readdir(dir), [STATE_FILE]);
  assert.deepEqual(persistence.load(), SAVED_STATE);
}));

test("a save that cannot write reports the error instead of throwing", (t) => withDataDir(async (dir) => {
  const reportError = t.mock.method(console, "error", () => {});
  const fileInTheWay = join(dir, "not-a-folder");
  await writeFile(fileInTheWay, "");
  assert.doesNotThrow(() => createPersistence(fileInTheWay).saveNow(SAVED_STATE));
  assert.equal(reportError.mock.callCount(), 1);
}));

test("a scheduled save waits for the delay and then writes the latest state", (t) => withDataDir(async (dir) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const persistence = createPersistence(dir);
  persistence.scheduleSave({ projects: {} });
  persistence.scheduleSave(SAVED_STATE);
  t.mock.timers.tick(SAVE_DELAY_MS - 1);
  assert.equal(persistence.load(), null);
  t.mock.timers.tick(1);
  assert.deepEqual(persistence.load(), SAVED_STATE);
}));

test("a corrupted state file is reported before the office starts empty", (t) => withDataDir(async (dir) => {
  const reportError = t.mock.method(console, "error", () => {});
  await writeFile(join(dir, STATE_FILE), "{\"projects\": {");
  assert.equal(createPersistence(dir).load(), null);
  assert.equal(reportError.mock.callCount(), 1);
}));

test("a missing state file is not reported, since it only means the first start", (t) => withDataDir(async (dir) => {
  const reportError = t.mock.method(console, "error", () => {});
  assert.equal(createPersistence(dir).load(), null);
  assert.equal(reportError.mock.callCount(), 0);
}));
