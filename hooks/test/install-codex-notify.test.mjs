import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fakeHome } from "./support/fake-home.mjs";
import { runHookScript } from "./support/run-hook-script.mjs";

const INSTALLER = "install-codex-notify.mjs";
const BACKUP_NAME = /^config\.toml\.bak-\d{8}-\d{6}$/;
const OFFICE_NOTIFY = 'notify = ["curl", "-s", "--noproxy", "*", "-m", "3", "-X", "POST", "-H", "Content-Type: application/json", "http://127.0.0.1:8420/events/codex", "--data-raw"]';
const NOTIFY_BEFORE_NOPROXY = 'notify = ["curl", "-s", "-m", "3", "-X", "POST", "-H", "Content-Type: application/json", "http://127.0.0.1:8420/events/codex", "--data-raw"]';
const MANIFEST = "orquestra-office.json";

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
