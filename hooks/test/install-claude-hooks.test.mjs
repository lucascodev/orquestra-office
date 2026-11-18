import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { HOOKS_DIR, runHookScript } from "./support/run-hook-script.mjs";

const INSTALLER = "install-claude-hooks.mjs";
const DEFAULT_OFFICE_URL = "http://127.0.0.1:8420";
const BACKUP_NAME = /^settings\.json\.bak-\d{8}-\d{6}$/;

function configDir(t) {
  const dir = mkdtempSync(join(tmpdir(), "office-claude-cli-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

const install = (dir, env = {}, args = []) => runHookScript(INSTALLER, { env: { CLAUDE_CONFIG_DIR: dir, ...env }, args });
const readSettings = (dir) => JSON.parse(readFileSync(join(dir, "settings.json"), "utf8"));
const backupsIn = (dir) => readdirSync(dir).filter((name) => BACKUP_NAME.test(name));

test("installs hooks and status line pointing at this hooks folder and the default office", async (t) => {
  const dir = configDir(t);

  const result = await install(dir);

  assert.equal(result.code, 0);
  const settings = readSettings(dir);
  assert.equal(settings.statusLine.command, `node "${join(HOOKS_DIR, "office-statusline.mjs")}"`);
  assert.equal(settings.hooks.SessionStart[0].hooks[0].command, `node "${join(HOOKS_DIR, "office-session-start.mjs")}"`);
  assert.equal(settings.hooks.Stop[0].hooks[0].url, `${DEFAULT_OFFICE_URL}/hooks/claude/stop`);
  assert.match(result.stdout, new RegExp(`show up at ${DEFAULT_OFFICE_URL}\\.`));
  assert.deepEqual(backupsIn(dir), []);
});

test("uses OFFICE_URL from the environment in every http hook", async (t) => {
  const dir = configDir(t);

  await install(dir, { OFFICE_URL: "http://office.test:1234" });

  const urls = Object.values(readSettings(dir).hooks).flat().flatMap((group) => group.hooks).filter((hook) => hook.type === "http").map((hook) => hook.url);
  assert.ok(urls.length > 0);
  assert.ok(urls.every((url) => url.startsWith("http://office.test:1234/")));
});

test("backs up an existing settings file with its original content before rewriting it", async (t) => {
  const dir = configDir(t);
  const original = `${JSON.stringify({ model: "opus" })}\n`;
  writeFileSync(join(dir, "settings.json"), original);

  const result = await install(dir);

  const [backup] = backupsIn(dir);
  assert.equal(readFileSync(join(dir, backup), "utf8"), original);
  assert.match(result.stdout, new RegExp(`^Backup: .*${backup}$`, "m"));
  assert.equal(readSettings(dir).model, "opus");
});

test("refuses unreadable JSON, exits 1 and leaves the file untouched", async (t) => {
  const dir = configDir(t);
  writeFileSync(join(dir, "settings.json"), "{ not json");

  const result = await install(dir);

  assert.equal(result.code, 1);
  assert.match(result.stderr, /as JSON\. Nothing was changed\./);
  assert.equal(readFileSync(join(dir, "settings.json"), "utf8"), "{ not json");
  assert.deepEqual(backupsIn(dir), []);
});

test("warns and keeps a status line that belongs to the user", async (t) => {
  const dir = configDir(t);
  writeFileSync(join(dir, "settings.json"), JSON.stringify({ statusLine: { type: "command", command: "my-statusline" } }));

  const result = await install(dir);

  assert.match(result.stdout, /You already have a statusLine, so it was left alone\./);
  assert.deepEqual(readSettings(dir).statusLine, { type: "command", command: "my-statusline" });
});

test("--remove takes the office out and keeps what belongs to the user", async (t) => {
  const dir = configDir(t);
  writeFileSync(join(dir, "settings.json"), JSON.stringify({ theme: "dark", hooks: { Stop: [{ hooks: [{ type: "command", command: "echo mine" }] }] } }));
  await install(dir);

  const result = await install(dir, {}, ["--remove"]);

  assert.equal(result.code, 0);
  assert.match(result.stdout, /Office hooks removed from /);
  assert.deepEqual(readSettings(dir), { theme: "dark", hooks: { Stop: [{ hooks: [{ type: "command", command: "echo mine" }] }] } });
});

test("creates the config folder when it does not exist yet", async (t) => {
  const dir = join(configDir(t), "nested", "claude");

  const result = await install(dir);

  assert.equal(result.code, 0);
  assert.ok(existsSync(join(dir, "settings.json")));
});
