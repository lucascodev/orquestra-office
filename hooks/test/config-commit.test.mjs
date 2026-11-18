import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { BACKUPS_KEPT } from "../lib/config-backup.mjs";
import { commitConfig } from "../lib/config-commit.mjs";

const FAILED_RUNS = 4;
const EARLIER_BACKUPS = ["settings.json.bak-20200101-000000-000", "settings.json.bak-20200101-000001-000", "settings.json.bak-20200101-000002-000"];

function configWithBackups(t, content) {
  const dir = mkdtempSync(join(tmpdir(), "office-commit-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, "settings.json");
  writeFileSync(path, content);
  for (const name of EARLIER_BACKUPS) writeFileSync(join(dir, name), name);
  return { dir, path };
}

const backupsIn = (dir) => readdirSync(dir).filter((name) => name.startsWith("settings.json.bak-")).sort();

test("runs that find the file changed meanwhile leave the earlier backups and no new one", (t) => {
  const { dir, path } = configWithBackups(t, "saved by another program");

  const results = Array.from({ length: FAILED_RUNS }, () => commitConfig({ path, originalText: "what the installer read", nextText: "office" }));

  assert.ok(results.every((result) => result.hasChangedMeanwhile && result.backupPath === null));
  assert.deepEqual(backupsIn(dir), EARLIER_BACKUPS);
  assert.equal(readFileSync(path, "utf8"), "saved by another program");
});

test("a successful run keeps its backup and prunes down to the most recent ones", (t) => {
  const { dir, path } = configWithBackups(t, "original");

  const { backupPath } = commitConfig({ path, originalText: "original", nextText: "office" });

  assert.equal(readFileSync(backupPath, "utf8"), "original");
  assert.equal(backupsIn(dir).length, BACKUPS_KEPT);
  assert.ok(backupsIn(dir).includes(backupPath.slice(dir.length + 1)));
  assert.equal(readFileSync(path, "utf8"), "office");
});
