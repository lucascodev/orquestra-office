import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { isForeignStatusline, officeEntries, withOfficeHooks, withOfficeSettings, withOfficeStatusline } from "../lib/claude-settings.mjs";

const HOOKS_DIR = join("/opt", "office", "hooks");
const OTHER_HOOKS_DIR = join("/home", "me", "old-office", "hooks");
const OFFICE_URL = "http://127.0.0.1:8420";
const INSTALL = { isRemoving: false, officeUrl: OFFICE_URL, hooksDir: HOOKS_DIR };
const REMOVE = { ...INSTALL, isRemoving: true };
const USER_STATUSLINE = { type: "command", command: "my-statusline" };
const USER_BASH_GROUP = { matcher: "Bash", hooks: [{ type: "command", command: "echo mine" }] };
const USER_STOP_GROUP = { hooks: [{ type: "http", url: "http://example.test/mine" }] };
const MIXED_GROUP = { hooks: [{ type: "command", command: 'node "/old/office-session-start.mjs"' }, { type: "command", command: "echo keep" }] };

const userSettings = () => ({
  model: "opus",
  statusLine: USER_STATUSLINE,
  hooks: { PreToolUse: [USER_BASH_GROUP], Stop: [USER_STOP_GROUP], SessionStart: [MIXED_GROUP] },
});
const allHooks = (settings) => Object.values(settings.hooks).flat().flatMap((group) => group.hooks);
const sessionStartCommands = (settings) => settings.hooks.SessionStart.flatMap((group) => group.hooks).map((hook) => hook.command);

test("installing twice gives the same settings as installing once", () => {
  const once = withOfficeSettings(userSettings(), INSTALL);

  assert.deepEqual(withOfficeSettings(once, INSTALL), once);
});

test("installing adds every office event after the user's own groups", () => {
  const installed = withOfficeSettings({}, INSTALL);

  assert.deepEqual(Object.keys(installed.hooks), [
    "SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse", "PostToolUseFailure", "Notification",
    "StopFailure", "SubagentStart", "SubagentStop", "SessionEnd", "Stop", "PermissionRequest",
  ]);
  assert.deepEqual(installed.hooks.PreToolUse.map((group) => group.matcher), [undefined, "AskUserQuestion"]);
  assert.deepEqual(withOfficeSettings(userSettings(), INSTALL).hooks.PreToolUse[0], USER_BASH_GROUP);
});

test("decision hooks wait longer than activity hooks and every http hook continues on failure", () => {
  const { hooks } = withOfficeSettings({}, INSTALL);

  assert.deepEqual(hooks.PermissionRequest[0].hooks[0], {
    type: "http", url: `${OFFICE_URL}/hooks/claude/permission`, timeout: 150, onFailure: "continue",
    statusMessage: "Esperando você no escritório (ou responda aqui em instantes)",
  });
  assert.deepEqual(hooks.Stop[0].hooks[0], { type: "http", url: `${OFFICE_URL}/hooks/claude/stop`, timeout: 3, onFailure: "continue" });
  assert.deepEqual(hooks.SessionStart[0].hooks[0], { type: "command", command: `node "${join(HOOKS_DIR, "office-session-start.mjs")}"`, timeout: 5 });
});

test("removing takes out only the office groups and keeps the user's", () => {
  const removed = withOfficeSettings(withOfficeSettings(userSettings(), INSTALL), REMOVE);

  assert.deepEqual(removed, userSettings());
});

test("removing drops the hooks key when only office groups were there", () => {
  assert.deepEqual(withOfficeSettings(withOfficeSettings({ theme: "dark" }, INSTALL), REMOVE), { theme: "dark" });
});

test("a group that mixes office and user hooks belongs to the user", () => {
  const removed = withOfficeHooks({ SessionStart: [MIXED_GROUP] }, REMOVE);

  assert.deepEqual(removed, { SessionStart: [MIXED_GROUP] });
});

test("an empty group is not taken for an office group", () => {
  assert.deepEqual(withOfficeHooks({ Notification: [{ hooks: [] }] }, REMOVE), { Notification: [{ hooks: [] }] });
});

test("the user's status line stays untouched on install and on remove", () => {
  assert.deepEqual(withOfficeSettings(userSettings(), INSTALL).statusLine, USER_STATUSLINE);
  assert.deepEqual(withOfficeSettings(userSettings(), REMOVE).statusLine, USER_STATUSLINE);
  assert.equal(isForeignStatusline(USER_STATUSLINE, INSTALL), true);
});

test("the office status line is added on install and taken out on remove", () => {
  const installed = withOfficeStatusline({ theme: "dark" }, INSTALL);

  assert.deepEqual(installed, { theme: "dark", statusLine: { type: "command", command: `node "${join(HOOKS_DIR, "office-statusline.mjs")}"` } });
  assert.equal(isForeignStatusline(installed.statusLine, INSTALL), false);
  assert.equal(isForeignStatusline(undefined, INSTALL), false);
  assert.deepEqual(withOfficeStatusline(installed, REMOVE), { theme: "dark" });
});

test("an install from another folder, made before the manifest existed, is replaced without duplicating", () => {
  const fromOldFolder = withOfficeSettings({}, { ...INSTALL, hooksDir: OTHER_HOOKS_DIR });

  const reinstalled = withOfficeSettings(fromOldFolder, INSTALL);

  assert.deepEqual(reinstalled, withOfficeSettings({}, INSTALL));
  assert.deepEqual(sessionStartCommands(reinstalled), [`node "${join(HOOKS_DIR, "office-session-start.mjs")}"`]);
});

test("entries recorded in the manifest are replaced even when they point at another office", () => {
  const oldInstall = { ...INSTALL, hooksDir: OTHER_HOOKS_DIR, officeUrl: "http://localhost:9999" };
  const fromOldOffice = withOfficeSettings({}, oldInstall);

  const reinstalled = withOfficeSettings(fromOldOffice, { ...INSTALL, recorded: officeEntries(oldInstall) });

  assert.deepEqual(reinstalled, withOfficeSettings({}, INSTALL));
  assert.ok(allHooks(reinstalled).filter((hook) => hook.type === "http").every((hook) => hook.url.startsWith(`${OFFICE_URL}/`)));
});

test("the manifest lists the exact urls and commands an install writes", () => {
  assert.deepEqual(officeEntries(INSTALL), {
    urls: [`${OFFICE_URL}/events/claude`, `${OFFICE_URL}/hooks/claude/stop`, `${OFFICE_URL}/hooks/claude/permission`, `${OFFICE_URL}/hooks/claude/question`],
    commands: [`node "${join(HOOKS_DIR, "office-session-start.mjs")}"`, `node "${join(HOOKS_DIR, "office-statusline.mjs")}"`],
  });
});

test("third-party entries that only look like the office survive install and remove", () => {
  const settings = {
    statusLine: { type: "command", command: "bash ~/bin/wrap-office-statusline.mjs.sh" },
    hooks: {
      Stop: [{ hooks: [{ type: "http", url: "https://audit.example.com/hooks/claude" }] }],
      SessionStart: [{ hooks: [{ type: "command", command: "node ~/tools/my-office-session-start.mjs --audit" }] }],
      PostToolUse: [
        { hooks: [{ type: "http", url: `${OFFICE_URL}/events/claude?copy=1` }] },
        { hooks: [{ type: "command", command: `node "${join(HOOKS_DIR, "office-session-start.mjs")}" --audit` }] },
      ],
    },
  };

  const installed = withOfficeSettings(settings, INSTALL);

  assert.deepEqual(installed.statusLine, settings.statusLine);
  for (const [event, groups] of Object.entries(settings.hooks)) assert.deepEqual(installed.hooks[event].slice(0, groups.length), groups);
  assert.deepEqual(withOfficeSettings(installed, REMOVE), settings);
  assert.equal(isForeignStatusline(settings.statusLine, INSTALL), true);
});

test("leaves the settings it receives untouched", () => {
  const settings = userSettings();
  const installed = withOfficeSettings(withOfficeSettings({}, { ...INSTALL, hooksDir: OTHER_HOOKS_DIR }), INSTALL);
  const snapshot = structuredClone(installed);

  withOfficeSettings(settings, INSTALL);
  withOfficeSettings(installed, REMOVE);

  assert.deepEqual(settings, userSettings());
  assert.deepEqual(installed, snapshot);
});
