import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { backupConfig, backupStamp } from "../lib/config-backup.mjs";

test("the stamp is the UTC date and time down to the second", () => {
  assert.equal(backupStamp(new Date("2026-11-18T09:05:07.999Z")), "20261118-090507");
});

test("copies the config next to it with the stamp and returns the copy's path", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "office-backup-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, "settings.json");
  writeFileSync(path, "original");

  const backupPath = backupConfig(path, new Date("2026-11-18T09:05:07Z"));

  assert.equal(backupPath, `${path}.bak-20261118-090507`);
  assert.equal(readFileSync(backupPath, "utf8"), "original");
  assert.equal(readFileSync(path, "utf8"), "original");
});
