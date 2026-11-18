import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { runHookScript } from "./support/run-hook-script.mjs";

const INSTALLER = "install-codex-notify.mjs";
const BACKUP_NAME = /^config\.toml\.bak-\d{8}-\d{6}$/;
const OFFICE_NOTIFY = 'notify = ["curl", "-s", "-m", "3", "-X", "POST", "-H", "Content-Type: application/json", "http://127.0.0.1:8420/events/codex", "--data-raw"]';

function codexHome(t) {
  const dir = mkdtempSync(join(tmpdir(), "office-codex-cli-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

const install = (dir, env = {}, args = []) => runHookScript(INSTALLER, { env: { CODEX_HOME: dir, ...env }, args });
const readConfig = (dir) => readFileSync(join(dir, "config.toml"), "utf8");
const backupsIn = (dir) => readdirSync(dir).filter((name) => BACKUP_NAME.test(name));

test("creates config.toml with the office notify when there is none", async (t) => {
  const dir = codexHome(t);

  const result = await install(dir);

  assert.equal(result.code, 0);
  assert.equal(readConfig(dir), `${OFFICE_NOTIFY}\n`);
  assert.match(result.stdout, /Codex turns will show up at http:\/\/127\.0\.0\.1:8420\./);
  assert.deepEqual(backupsIn(dir), []);
});

test("uses OFFICE_URL from the environment in the notify command", async (t) => {
  const dir = codexHome(t);

  await install(dir, { OFFICE_URL: "http://office.test:1234" });

  assert.match(readConfig(dir), /"http:\/\/office\.test:1234\/events\/codex"/);
});

test("backs up the existing config with its original content and normalizes line endings", async (t) => {
  const dir = codexHome(t);
  const original = 'model = "o3"\r\n\r\n[profiles.a]\r\nfoo = 1\r\n\r\n';
  writeFileSync(join(dir, "config.toml"), original);

  const result = await install(dir);

  const [backup] = backupsIn(dir);
  assert.equal(readFileSync(join(dir, backup), "utf8"), original);
  assert.match(result.stdout, new RegExp(`^Backup: .*${backup}$`, "m"));
  assert.equal(readConfig(dir), `${OFFICE_NOTIFY}\nmodel = "o3"\n\n[profiles.a]\nfoo = 1\n`);
});

test("refuses a notify that belongs to someone else, exits 1 and changes nothing", async (t) => {
  const dir = codexHome(t);
  const original = 'notify = ["notify-send"]\n';
  writeFileSync(join(dir, "config.toml"), original);

  for (const args of [[], ["--remove"]]) {
    const result = await install(dir, {}, args);

    assert.equal(result.code, 1);
    assert.match(result.stderr, /already has another notify command:\n {2}notify = \["notify-send"\]\nNothing was changed\./);
  }
  assert.equal(readConfig(dir), original);
  assert.deepEqual(backupsIn(dir), []);
});

test("--remove takes out only the office notify", async (t) => {
  const dir = codexHome(t);
  writeFileSync(join(dir, "config.toml"), 'model = "o3"\n');
  await install(dir);

  const result = await install(dir, {}, ["--remove"]);

  assert.equal(result.code, 0);
  assert.match(result.stdout, /Office notify removed from /);
  assert.equal(readConfig(dir), 'model = "o3"\n');
});

test("--remove without a config still writes an empty one", async (t) => {
  const dir = join(codexHome(t), "nested");

  const result = await install(dir, {}, ["--remove"]);

  assert.equal(result.code, 0);
  assert.ok(existsSync(join(dir, "config.toml")));
  assert.equal(readConfig(dir), "\n");
});
