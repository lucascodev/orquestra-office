import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fakeHome } from "./support/fake-home.mjs";
import { makeUnwritable, READ_ONLY_SKIP } from "./support/read-only.mjs";
import { officeNotifyLine } from "../lib/codex-config.mjs";
import { BASE_ENV, runHookScript } from "./support/run-hook-script.mjs";

const INSTALLER = "install-codex-notify.mjs";
const SYSTEM_CURL = process.platform === "win32" ? join(BASE_ENV.SystemRoot, "System32", "curl.exe") : ["/usr/bin/curl", "/bin/curl", "/usr/local/bin/curl", "/opt/homebrew/bin/curl"].find(existsSync);
const notifyAt = (officeUrl, home = BASE_ENV.HOME) => officeNotifyLine({
  officeUrl, curlPath: SYSTEM_CURL, nullDevice: process.platform === "win32" ? "NUL" : "/dev/null", activityHeaderFile: join(home, ".orquestra-office", "activity.header"),
});
const OFFICE_NOTIFY = notifyAt("http://127.0.0.1:8420");
const NOTIFY_BEFORE_NOPROXY = 'notify = ["curl", "-s", "-m", "3", "-X", "POST", "-H", "Content-Type: application/json", "http://127.0.0.1:8420/events/codex", "--data-raw"]';
const MANIFEST = "orquestra-office.json";

function codexHome(t) {
  const dir = mkdtempSync(join(tmpdir(), "office-codex-cli-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

const install = (dir, env = {}, args = []) => runHookScript(INSTALLER, { env: { CODEX_HOME: dir, ...env }, args });
const readConfig = (dir) => readFileSync(join(dir, "config.toml"), "utf8");
const backupsIn = (dir) => readdirSync(dir).filter((name) => name.startsWith("config.toml.bak-"));
const UNREMOVABLE_BACKUP = "config.toml.bak-20200101-000000-000";
const NEWER_BACKUPS = ["config.toml.bak-20200101-000001-000", "config.toml.bak-20200101-000002-000"];

test("creates config.toml with the office notify when there is none", async (t) => {
  const dir = codexHome(t);

  const result = await install(dir);

  assert.equal(result.code, 0);
  assert.equal(readConfig(dir), `${OFFICE_NOTIFY}\n`);
  assert.match(result.stdout, /Codex turns will show up at http:\/\/127\.0\.0\.1:8420\./);
  assert.deepEqual(backupsIn(dir), []);
});

test("uses OFFICE_URL from the environment, normalized to its origin, in the notify command", async (t) => {
  const dir = codexHome(t);

  await install(dir, { OFFICE_URL: "http://LOCALHOST:1234/" });

  assert.match(readConfig(dir), /"http:\/\/localhost:1234\/events\/codex"/);
});

test("refuses a remote OFFICE_URL, exits 1 and writes nothing", async (t) => {
  const dir = codexHome(t);

  const result = await install(dir, { OFFICE_URL: "http://evil.example" });

  assert.equal(result.code, 1);
  assert.match(result.stderr, /^OFFICE_URL was refused:.+--allow-remote-office.+ Nothing was changed\./);
  assert.deepEqual(readdirSync(dir), []);
});

test("--allow-remote-office accepts a remote https office", async (t) => {
  const dir = codexHome(t);

  const result = await install(dir, { OFFICE_URL: "https://office.example.com" }, ["--allow-remote-office"]);

  assert.equal(result.code, 0);
  assert.match(readConfig(dir), /"https:\/\/office\.example\.com\/events\/codex"/);
});

test("an empty OFFICE_URL counts as unset", async (t) => {
  const dir = codexHome(t);

  await install(dir, { OFFICE_URL: "" });

  assert.match(readConfig(dir), /"http:\/\/127\.0\.0\.1:8420\/events\/codex"/);
});

test("an empty CODEX_HOME counts as unset: config goes to ~/.codex, not to the current folder", async (t) => {
  const { home, env } = fakeHome(t);
  const cwd = codexHome(t);

  const result = await runHookScript(INSTALLER, { env: { ...env, CODEX_HOME: "" }, cwd });

  assert.equal(result.code, 0);
  assert.ok(existsSync(join(home, ".codex", "config.toml")));
  assert.deepEqual(readdirSync(cwd), []);
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

test("a config.toml that cannot be replaced exits 1 with a short message, no stack trace and no backup", { skip: READ_ONLY_SKIP }, async (t) => {
  const dir = codexHome(t);
  const original = 'model = "o3"\n';
  writeFileSync(join(dir, "config.toml"), original);
  const restore = makeUnwritable(dir, "config.toml");

  let result;
  try {
    result = await install(dir);
  } finally {
    restore();
  }

  assert.equal(result.code, 1);
  assert.match(result.stderr, /^Could not save .*config\.toml \(\w+\).*\. Nothing was changed\.\n$/);
  assert.equal(readConfig(dir), original);
  assert.deepEqual(backupsIn(dir), []);
});

test("an old backup that cannot be removed still saves config and manifest, exits 0 and warns in one line", async (t) => {
  const dir = codexHome(t);
  writeFileSync(join(dir, "config.toml"), 'model = "o3"\n');
  mkdirSync(join(dir, UNREMOVABLE_BACKUP));
  for (const name of NEWER_BACKUPS) writeFileSync(join(dir, name), name);

  const result = await install(dir);

  assert.equal(result.code, 0);
  assert.equal(readConfig(dir), `${OFFICE_NOTIFY}\nmodel = "o3"\n`);
  assert.ok(existsSync(join(dir, MANIFEST)));
  assert.match(result.stdout, /^Backup: /m);
  assert.match(result.stdout, /Office notify installed in /);
  assert.match(result.stderr, new RegExp(`^Saved, but could not remove old backup .*${UNREMOVABLE_BACKUP} \\(\\w+\\)\\.\\n$`));
});

test("running again with nothing to change writes nothing and makes no backup", async (t) => {
  const dir = codexHome(t);
  writeFileSync(join(dir, "config.toml"), 'model = "o3"\n');
  await install(dir);

  const result = await install(dir);

  assert.equal(result.code, 0);
  assert.match(result.stdout, /config\.toml is already up to date\. Nothing was changed\./);
  assert.equal(readConfig(dir), `${OFFICE_NOTIFY}\nmodel = "o3"\n`);
  assert.equal(backupsIn(dir).length, 1);
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

for (const foreignNotify of [
  'notify = ["sh", "-c", "curl -d @- http://127.0.0.1:8420/events/codex; my-script"]',
  '"notify" = ["curl", "-s", "--noproxy", "*", "-m", "3", "-X", "POST", "-H", "Content-Type: application/json", "http://127.0.0.1:8420/events/codex", "--data-raw"]',
]) {
  test(`keeps a notify that only looks like the office's, on install and on remove: ${foreignNotify.slice(0, 30)}`, async (t) => {
    const dir = codexHome(t);
    const original = `model = "o3"\n${foreignNotify}\n`;
    writeFileSync(join(dir, "config.toml"), original);

    for (const args of [[], ["--remove"]]) {
      const result = await install(dir, {}, args);

      assert.equal(result.code, 1);
      assert.match(result.stderr, /already has another notify command:/);
    }
    assert.equal(readConfig(dir), original);
  });
}

test("replaces the notify written before --noproxy existed, without a second notify", async (t) => {
  const dir = codexHome(t);
  writeFileSync(join(dir, "config.toml"), `${NOTIFY_BEFORE_NOPROXY}\nmodel = "o3"\n`);

  const result = await install(dir);

  assert.equal(result.code, 0);
  assert.equal(readConfig(dir), `${OFFICE_NOTIFY}\nmodel = "o3"\n`);
});

test("records the notify in orquestra-office.json, so reinstalling with another OFFICE_URL replaces it", async (t) => {
  const dir = codexHome(t);
  await install(dir, { OFFICE_URL: "http://localhost:9999" });

  const result = await install(dir);

  assert.equal(result.code, 0);
  assert.equal(readConfig(dir), `${OFFICE_NOTIFY}\n`);
  assert.deepEqual(JSON.parse(readFileSync(join(dir, MANIFEST), "utf8")).codex.notify, [JSON.parse(OFFICE_NOTIFY.replace(/^notify = /, ""))]);

  await install(dir, {}, ["--remove"]);

  assert.equal(existsSync(join(dir, MANIFEST)), false);
});

test("keeps the Claude section of a manifest shared with CLAUDE_CONFIG_DIR", async (t) => {
  const dir = codexHome(t);
  const claude = { urls: ["http://127.0.0.1:8420/events/claude"], commands: [] };
  writeFileSync(join(dir, MANIFEST), JSON.stringify({ claude }));

  await install(dir);
  await install(dir, {}, ["--remove"]);

  assert.deepEqual(JSON.parse(readFileSync(join(dir, MANIFEST), "utf8")), { claude });
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

test("--remove without a config creates nothing and says there was nothing to remove", async (t) => {
  const parent = codexHome(t);
  const dir = join(parent, "nested");

  const result = await install(dir, {}, ["--remove"]);

  assert.equal(result.code, 0);
  assert.match(result.stdout, /Nothing to remove: .*config\.toml does not exist\./);
  assert.deepEqual(readdirSync(parent), []);
});

test("creates the office secret and points the notify at the activity header next to it", async (t) => {
  const { home, env } = fakeHome(t);
  const dir = codexHome(t);

  const result = await install(dir, env);

  assert.equal(result.code, 0);
  assert.match(readFileSync(join(home, ".orquestra-office", "secret"), "utf8"), /^[\w-]{43}\n$/);
  assert.match(readFileSync(join(home, ".orquestra-office", "activity.header"), "utf8"), /^Authorization: Bearer [\w-]{43}\n$/);
  assert.equal(readConfig(dir), `${notifyAt("http://127.0.0.1:8420", home)}\n`);
});
