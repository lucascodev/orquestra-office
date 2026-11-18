import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fakeHome } from "./support/fake-home.mjs";
import { HOOKS_DIR, runHookScript } from "./support/run-hook-script.mjs";

const INSTALLER = "install-claude-hooks.mjs";
const DEFAULT_OFFICE_URL = "http://127.0.0.1:8420";

function configDir(t) {
  const dir = mkdtempSync(join(tmpdir(), "office-claude-cli-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

const install = (dir, env = {}, args = []) => runHookScript(INSTALLER, { env: { CLAUDE_CONFIG_DIR: dir, ...env }, args });
const readSettings = (dir) => JSON.parse(readFileSync(join(dir, "settings.json"), "utf8"));
const backupsIn = (dir) => readdirSync(dir).filter((name) => name.startsWith("settings.json.bak-"));

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

const httpHookUrls = (settings) => Object.values(settings.hooks).flat().flatMap((group) => group.hooks).filter((hook) => hook.type === "http").map((hook) => hook.url);

test("uses OFFICE_URL from the environment, normalized to its origin, in every http hook", async (t) => {
  const dir = configDir(t);

  await install(dir, { OFFICE_URL: "http://LOCALHOST:1234/" });

  const urls = httpHookUrls(readSettings(dir));
  assert.ok(urls.length > 0);
  assert.ok(urls.every((url) => url.startsWith("http://localhost:1234/")));
});

for (const officeUrl of ["http://evil.example", "https://evil.example", "http://127.0.0.1:8420/x", "http://user:pw@127.0.0.1:8420"]) {
  test(`refuses OFFICE_URL ${officeUrl}, exits 1 and writes nothing`, async (t) => {
    const dir = configDir(t);

    const result = await install(dir, { OFFICE_URL: officeUrl });

    assert.equal(result.code, 1);
    assert.match(result.stderr, /^OFFICE_URL was refused: .+\. Nothing was changed\./);
    assert.deepEqual(readdirSync(dir), []);
  });
}

test("--allow-remote-office accepts a remote https office and still refuses a remote http one", async (t) => {
  const dir = configDir(t);

  const refused = await install(dir, { OFFICE_URL: "http://office.example.com" }, ["--allow-remote-office"]);
  const accepted = await install(dir, { OFFICE_URL: "https://office.example.com" }, ["--allow-remote-office"]);

  assert.equal(refused.code, 1);
  assert.match(refused.stderr, /needs https:\/\//);
  assert.equal(accepted.code, 0);
  assert.ok(httpHookUrls(readSettings(dir)).every((url) => url.startsWith("https://office.example.com/")));
});

test("an empty OFFICE_URL counts as unset", async (t) => {
  const dir = configDir(t);

  const result = await install(dir, { OFFICE_URL: "" });

  assert.equal(result.code, 0);
  assert.ok(httpHookUrls(readSettings(dir)).every((url) => url.startsWith(`${DEFAULT_OFFICE_URL}/`)));
});

test("an empty CLAUDE_CONFIG_DIR counts as unset: settings go to ~/.claude, not to the current folder", async (t) => {
  const { home, env } = fakeHome(t);
  const cwd = configDir(t);

  const result = await runHookScript(INSTALLER, { env: { ...env, CLAUDE_CONFIG_DIR: "" }, cwd });

  assert.equal(result.code, 0);
  assert.ok(existsSync(join(home, ".claude", "settings.json")));
  assert.deepEqual(readdirSync(cwd), []);
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

for (const content of ["null", '{"hooks":"x"}', '{"hooks":{"PreToolUse":null}}', '"abc"', "[1,2]"]) {
  test(`refuses JSON that is not a settings object, without a backup: ${content}`, async (t) => {
    const dir = configDir(t);
    writeFileSync(join(dir, "settings.json"), content);

    const result = await install(dir);

    assert.equal(result.code, 1);
    assert.match(result.stderr, /is not a settings object: .+\. Nothing was changed\./);
    assert.equal(readFileSync(join(dir, "settings.json"), "utf8"), content);
    assert.deepEqual(backupsIn(dir), []);
  });
}

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
