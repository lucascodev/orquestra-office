import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { backupConfig, backupStamp, backupsToPrune } from "../lib/config-backup.mjs";

const SAME_INSTANT = new Date("2026-11-18T09:05:07.123Z");

function configFile(t, content = "original") {
  const dir = mkdtempSync(join(tmpdir(), "office-backup-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, "settings.json");
  writeFileSync(path, content);
  return { dir, path };
}

const at = (second) => new Date(Date.UTC(2026, 10, 18, 9, 5, second));

test("the stamp is the UTC date and time down to the millisecond", () => {
  assert.equal(backupStamp(new Date("2026-11-18T09:05:07.999Z")), "20261118-090507-999");
});

test("copies the config next to it with the stamp and returns the copy's path", (t) => {
  const { path } = configFile(t);

  const backupPath = backupConfig(path, SAME_INSTANT);

  assert.equal(backupPath, `${path}.bak-20261118-090507-123`);
  assert.equal(readFileSync(backupPath, "utf8"), "original");
  assert.equal(readFileSync(path, "utf8"), "original");
});

test("a second backup in the same millisecond gets a suffix instead of overwriting the first", (t) => {
  const { path } = configFile(t, "first");
  const first = backupConfig(path, SAME_INSTANT);
  writeFileSync(path, "second");

  const second = backupConfig(path, SAME_INSTANT);

  assert.equal(second, `${first}-1`);
  assert.equal(readFileSync(first, "utf8"), "first");
  assert.equal(readFileSync(second, "utf8"), "second");
});

test("keeps only the three most recent office backups of that file", (t) => {
  const { dir, path } = configFile(t);
  const untouched = ["settings.json.bak-20200101-000000", "config.toml.bak-20200101-000000-000", "settings.json.bak-mine", "notes.txt"];
  for (const name of untouched.slice(1)) writeFileSync(join(dir, name), "x");
  writeFileSync(join(dir, untouched[0]), "legacy");

  const kept = [1, 2, 3, 4, 5].map((second) => backupConfig(path, at(second))).slice(-3);

  const backups = readdirSync(dir).filter((name) => name.startsWith("settings.json.bak-2"));
  assert.deepEqual(backups.sort(), kept.map((backup) => backup.slice(dir.length + 1)).sort());
  assert.ok(untouched.slice(1).every((name) => readdirSync(dir).includes(name)));
});

test("orders backups by time, then by collision suffix", () => {
  const names = [
    "settings.json.bak-20261118-090507-123-10",
    "settings.json.bak-20261118-090507",
    "settings.json.bak-20261118-090507-123-2",
    "settings.json.bak-20261118-090508-000",
    "settings.json.bak-20261118-090507-123",
    "other.json.bak-20200101-000000-000",
  ];

  assert.deepEqual(backupsToPrune("settings.json", names, 3), [
    "settings.json.bak-20261118-090507-123",
    "settings.json.bak-20261118-090507",
  ]);
});

test("the backup is readable only by its owner", { skip: process.platform === "win32" && "file modes are not POSIX on Windows" }, (t) => {
  const { path } = configFile(t);

  const backupPath = backupConfig(path, SAME_INSTANT);

  assert.equal(statSync(backupPath).mode & 0o777, 0o600);
});
