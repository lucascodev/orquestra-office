import assert from "node:assert/strict";
import { cpSync, existsSync, lstatSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fakeHome } from "./support/fake-home.mjs";
import { startFakeOffice } from "./support/fake-office.mjs";
import { makeUnwritable, READ_ONLY_SKIP } from "./support/read-only.mjs";
import { BASE_ENV, HOOKS_DIR, runHookScript, runScript } from "./support/run-hook-script.mjs";

const THROWAWAY_HOME = BASE_ENV.HOME;

const INSTALLER = "install-claude-hooks.mjs";
const DEFAULT_OFFICE_URL = "http://127.0.0.1:8420";
const MANIFEST = "orquestra-office.json";
const OLD_HOOKS_DIR = join(tmpdir(), "old-checkout", "hooks");

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
  assert.equal(settings.hooks.Stop[0].hooks[0].command, `node "${join(HOOKS_DIR, "office-decision.mjs")}" --office-url "${DEFAULT_OFFICE_URL}" --secret-file "${join(THROWAWAY_HOME, ".orquestra-office", "secret")}"`);
  assert.deepEqual(httpHookUrls(settings), []);
  assert.match(result.stdout, new RegExp(`show up at ${DEFAULT_OFFICE_URL}\\.`));
  assert.deepEqual(backupsIn(dir), []);
});

const DECISION_URL = / --office-url "([^"]+)" /;
const officeHooksOf = (settings) => Object.values(settings.hooks).flat().flatMap((group) => group.hooks);
// Every address an install writes: the last curl argument of the activity hooks and the --office-url of the decision script.
const officeUrlsIn = (settings) => officeHooksOf(settings).flatMap((hook) => {
  if (Array.isArray(hook.args)) return [hook.args.at(-1)];
  const decisionUrl = DECISION_URL.exec(hook.command ?? "")?.[1];
  return decisionUrl ? [`${decisionUrl}/`] : [];
});
const httpHookUrls = (settings) => officeHooksOf(settings).filter((hook) => hook.type === "http").map((hook) => hook.url);

test("uses OFFICE_URL from the environment, normalized to its origin, in every office hook", async (t) => {
  const dir = configDir(t);

  await install(dir, { OFFICE_URL: "http://LOCALHOST:1234/" });

  const urls = officeUrlsIn(readSettings(dir));
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
  assert.ok(officeUrlsIn(readSettings(dir)).every((url) => url.startsWith("https://office.example.com/")));
});

test("an empty OFFICE_URL counts as unset", async (t) => {
  const dir = configDir(t);

  const result = await install(dir, { OFFICE_URL: "" });

  assert.equal(result.code, 0);
  assert.ok(officeUrlsIn(readSettings(dir)).every((url) => url.startsWith(`${DEFAULT_OFFICE_URL}/`)));
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

test("a settings.json that cannot be replaced exits 1 with a short message, no stack trace and no backup", { skip: READ_ONLY_SKIP }, async (t) => {
  const dir = configDir(t);
  const original = JSON.stringify({ model: "opus" });
  writeFileSync(join(dir, "settings.json"), original);
  const restore = makeUnwritable(dir, "settings.json");

  let result;
  try {
    result = await install(dir);
  } finally {
    restore();
  }

  assert.equal(result.code, 1);
  assert.match(result.stderr, /^Could not save .*settings\.json \(\w+\).*\. Nothing was changed\.\n$/);
  assert.equal(readFileSync(join(dir, "settings.json"), "utf8"), original);
  assert.deepEqual(backupsIn(dir), []);
});

test("running again with nothing to change writes nothing and makes no backup", async (t) => {
  const dir = configDir(t);
  writeFileSync(join(dir, "settings.json"), JSON.stringify({ model: "opus" }));
  await install(dir);
  const installed = readFileSync(join(dir, "settings.json"), "utf8");

  const result = await install(dir);

  assert.equal(result.code, 0);
  assert.match(result.stdout, /settings\.json is already up to date\. Nothing was changed\./);
  assert.equal(readFileSync(join(dir, "settings.json"), "utf8"), installed);
  assert.equal(backupsIn(dir).length, 1);
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

test("records what it wrote in orquestra-office.json and deletes the record on --remove", async (t) => {
  const dir = configDir(t);

  await install(dir);

  const { claude } = JSON.parse(readFileSync(join(dir, MANIFEST), "utf8"));
  const settings = readSettings(dir);
  assert.deepEqual(claude.commands, [settings.hooks.SessionStart[0].hooks[0].command, settings.hooks.Stop[0].hooks[0].command, settings.statusLine.command]);
  assert.deepEqual(claude.execs, [{ command: settings.hooks.PostToolUse[0].hooks[0].command, args: settings.hooks.PostToolUse[0].hooks[0].args }]);

  await install(dir, {}, ["--remove"]);

  assert.equal(existsSync(join(dir, MANIFEST)), false);
});

test("third-party hooks and status line that only look like the office survive install and --remove", async (t) => {
  const dir = configDir(t);
  const settings = {
    statusLine: { type: "command", command: "bash ~/bin/wrap-office-statusline.mjs.sh" },
    hooks: {
      Stop: [{ hooks: [{ type: "http", url: "https://audit.example.com/hooks/claude" }] }],
      SessionStart: [{ hooks: [{ type: "command", command: "node ~/tools/my-office-session-start.mjs --audit" }] }],
    },
  };
  writeFileSync(join(dir, "settings.json"), JSON.stringify(settings));

  await install(dir);
  const installed = readSettings(dir);
  await install(dir, {}, ["--remove"]);

  assert.deepEqual(installed.statusLine, settings.statusLine);
  assert.deepEqual(installed.hooks.Stop[0], settings.hooks.Stop[0]);
  assert.deepEqual(installed.hooks.SessionStart[0], settings.hooks.SessionStart[0]);
  assert.deepEqual(readSettings(dir), settings);
});

test("with the manifest, third-party scripts that share the office file names survive install and --remove", async (t) => {
  const dir = configDir(t);
  await install(dir);
  const thirdPartyStatusline = { type: "command", command: 'node "D:/other/office-statusline.mjs"' };
  const thirdPartySessionStart = { hooks: [{ type: "command", command: 'node "D:/mine/office-session-start.mjs"' }] };
  const installed = readSettings(dir);
  writeFileSync(join(dir, "settings.json"), JSON.stringify({
    ...installed,
    statusLine: thirdPartyStatusline,
    hooks: { ...installed.hooks, SessionStart: [thirdPartySessionStart, ...installed.hooks.SessionStart] },
  }));

  await install(dir);
  const reinstalled = readSettings(dir);
  await install(dir, {}, ["--remove"]);

  assert.deepEqual(reinstalled.statusLine, thirdPartyStatusline);
  assert.deepEqual(reinstalled.hooks.SessionStart[0], thirdPartySessionStart);
  assert.deepEqual(readSettings(dir), { statusLine: thirdPartyStatusline, hooks: { SessionStart: [thirdPartySessionStart] } });
});

test("an install from another folder, made before the manifest existed, is replaced without duplicating", async (t) => {
  const dir = configDir(t);
  const oldScript = (file) => `node "${join(OLD_HOOKS_DIR, file)}"`;
  writeFileSync(join(dir, "settings.json"), JSON.stringify({
    statusLine: { type: "command", command: oldScript("office-statusline.mjs") },
    hooks: {
      SessionStart: [{ hooks: [{ type: "command", command: oldScript("office-session-start.mjs"), timeout: 5 }] }],
      Stop: [{ hooks: [{ type: "http", url: `${DEFAULT_OFFICE_URL}/hooks/claude/stop`, timeout: 3, onFailure: "continue" }] }],
    },
  }));

  await install(dir);

  const settings = readSettings(dir);
  assert.equal(settings.statusLine.command, `node "${join(HOOKS_DIR, "office-statusline.mjs")}"`);
  assert.deepEqual(settings.hooks.SessionStart.flatMap((group) => group.hooks).map((hook) => hook.command), [`node "${join(HOOKS_DIR, "office-session-start.mjs")}"`]);
  assert.equal(settings.hooks.Stop.length, 1);
});

test("reinstalling with another OFFICE_URL replaces the previous install through the manifest", async (t) => {
  const dir = configDir(t);
  await install(dir, { OFFICE_URL: "http://localhost:9999" });

  await install(dir);

  const settings = readSettings(dir);
  assert.ok(officeUrlsIn(settings).every((url) => url.startsWith(`${DEFAULT_OFFICE_URL}/`)));
  assert.equal(settings.hooks.Stop.length, 1);
});

test("refuses a manifest that is not a JSON object, exits 1 and changes nothing", async (t) => {
  const dir = configDir(t);
  writeFileSync(join(dir, MANIFEST), "{ broken");

  const result = await install(dir);

  assert.equal(result.code, 1);
  assert.match(result.stderr, /orquestra-office\.json.+Nothing was changed\./);
  assert.deepEqual(readdirSync(dir), [MANIFEST]);
});

test("--remove without settings.json creates nothing and says there was nothing to remove", async (t) => {
  const parent = configDir(t);
  const dir = join(parent, "nested");

  const result = await install(dir, {}, ["--remove"]);

  assert.equal(result.code, 0);
  assert.match(result.stdout, /Nothing to remove: .*settings\.json does not exist\./);
  assert.deepEqual(readdirSync(parent), []);
});

test("a settings.json that is a symlink to a dotfiles folder stays a symlink", async (t) => {
  const dir = configDir(t);
  const target = join(configDir(t), "settings.json");
  writeFileSync(target, JSON.stringify({ model: "opus" }));
  try {
    symlinkSync(target, join(dir, "settings.json"), "file");
  } catch (error) {
    if (error.code !== "EPERM") throw error;
    t.skip("creating symlinks needs Developer Mode or admin on Windows");
    return;
  }

  const result = await install(dir);

  assert.equal(result.code, 0);
  assert.ok(lstatSync(join(dir, "settings.json")).isSymbolicLink());
  assert.equal(JSON.parse(readFileSync(target, "utf8")).model, "opus");
  assert.ok(JSON.parse(readFileSync(target, "utf8")).hooks);
});

const UNSAFE_FOLDER_NAMES = ["odd$(touch pwned)", "odd`touch pwned`", "odd;touch pwned", ...(process.platform === "win32" ? [] : ['odd"quote'])];

for (const folderName of UNSAFE_FOLDER_NAMES) {
  test(`refuses to install from a folder whose name a shell would run: ${folderName}`, async (t) => {
    const copy = join(configDir(t), folderName, "hooks");
    cpSync(join(HOOKS_DIR, "lib"), join(copy, "lib"), { recursive: true });
    cpSync(join(HOOKS_DIR, INSTALLER), join(copy, INSTALLER));
    const dir = configDir(t);

    const result = await runScript(join(copy, INSTALLER), { env: { CLAUDE_CONFIG_DIR: dir } });

    assert.equal(result.code, 1);
    assert.match(result.stderr, /not safe in a shell command.+Nothing was changed\./s);
    assert.deepEqual(readdirSync(dir), []);
  });
}

test("creates the config folder when it does not exist yet", async (t) => {
  const dir = join(configDir(t), "nested", "claude");

  const result = await install(dir);

  assert.equal(result.code, 0);
  assert.ok(existsSync(join(dir, "settings.json")));
});

const SECRET_LINE = /^[\w-]{43}\n$/;
const secretIn = (home) => readFileSync(join(home, ".orquestra-office", "secret"), "utf8");
const headerIn = (home) => readFileSync(join(home, ".orquestra-office", "activity.header"), "utf8");

test("creates the office secret and the activity header in ~/.orquestra-office and points the hooks at them", async (t) => {
  const { home, env } = fakeHome(t);
  const dir = configDir(t);

  const result = await install(dir, env);

  assert.equal(result.code, 0);
  assert.match(secretIn(home), SECRET_LINE);
  assert.match(headerIn(home), /^Authorization: Bearer [\w-]{43}\n$/);
  assert.match(result.stdout, /Office secret created in /);
  const settings = readSettings(dir);
  assert.ok(settings.hooks.PostToolUse[0].hooks[0].args.includes(`@${join(home, ".orquestra-office", "activity.header")}`));
  assert.ok(settings.hooks.PermissionRequest[0].hooks[0].command.endsWith(`--secret-file "${join(home, ".orquestra-office", "secret")}"`));
});

test("installing again keeps the secret, and --rotate-secret replaces it along with the header", async (t) => {
  const { home, env } = fakeHome(t);
  const dir = configDir(t);
  await install(dir, env);
  const first = { secret: secretIn(home), header: headerIn(home) };

  const again = await install(dir, env);
  assert.equal(secretIn(home), first.secret);
  assert.doesNotMatch(again.stdout, /Office secret/);

  const rotated = await install(dir, env, ["--rotate-secret"]);
  assert.equal(rotated.code, 0);
  assert.match(rotated.stdout, /Office secret rotated in .+docker compose restart office/);
  assert.notEqual(secretIn(home), first.secret);
  assert.notEqual(headerIn(home), first.header);
});

test("activity hooks run the absolute path of the system curl", async (t) => {
  const dir = configDir(t);

  await install(dir);

  const { command } = readSettings(dir).hooks.PostToolUse[0].hooks[0];
  const expected = process.platform === "win32" ? join(BASE_ENV.SystemRoot, "System32", "curl.exe") : /^\/.+\/curl$/;
  if (typeof expected === "string") assert.equal(command.toLowerCase(), expected.toLowerCase());
  else assert.match(command, expected);
  assert.ok(existsSync(command));
});

test("says when it migrated the office hooks from http to command", async (t) => {
  const dir = configDir(t);
  writeFileSync(join(dir, "settings.json"), JSON.stringify({
    hooks: { Stop: [{ hooks: [{ type: "http", url: `${DEFAULT_OFFICE_URL}/hooks/claude/stop`, timeout: 3, onFailure: "continue" }] }] },
  }));

  const migrated = await install(dir);
  const again = await install(dir);

  assert.match(migrated.stdout, /migrated from http to command hooks/);
  assert.deepEqual(httpHookUrls(readSettings(dir)), []);
  assert.doesNotMatch(again.stdout, /migrated/);
});

test("--remove leaves the office secret in place", async (t) => {
  const { home, env } = fakeHome(t);
  const dir = configDir(t);
  await install(dir, env);
  const secret = secretIn(home);

  await install(dir, env, ["--remove"]);

  assert.equal(secretIn(home), secret);
});


test("refuses to install when the home folder has characters a shell would run", async (t) => {
  const home = join(configDir(t), "odd$(touch pwned)");
  const dir = configDir(t);

  const result = await install(dir, { HOME: home, USERPROFILE: home });

  assert.equal(result.code, 1);
  assert.match(result.stderr, /office secret file .+not safe in a shell command/);
  assert.deepEqual(readdirSync(dir), []);
});

test("run from a script, it opens no browser and asks the collector nothing, and points at the opener instead", async (t) => {
  const office = await startFakeOffice(t);
  const dir = configDir(t);

  const result = await install(dir, { OFFICE_URL: office.url });

  assert.equal(result.code, 0);
  assert.match(result.stdout, /Open the office already paired with: node hooks\/open-office\.mjs/);
  assert.deepEqual(office.requests, []);
});
