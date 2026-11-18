import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OFFICE_URL = process.env.OFFICE_URL ?? "http://127.0.0.1:8420";
const ACTIVITY_TIMEOUT_SECONDS = 3;
const DECISION_TIMEOUT_SECONDS = 150;
const STATUSLINE_FILE = "office-statusline.mjs";
const SESSION_START_FILE = "office-session-start.mjs";
const SESSION_START_TIMEOUT_SECONDS = 5;
const ACTIVITY_EVENTS = [
  "UserPromptSubmit", "PreToolUse", "PostToolUse", "PostToolUseFailure",
  "Notification", "StopFailure", "SubagentStart", "SubagentStop", "SessionEnd",
];
const hooksDir = dirname(fileURLToPath(import.meta.url));

const activityHook = { type: "http", url: `${OFFICE_URL}/events/claude`, timeout: ACTIVITY_TIMEOUT_SECONDS, onFailure: "continue" };
const decisionHook = (path) => ({
  type: "http", url: `${OFFICE_URL}${path}`, timeout: DECISION_TIMEOUT_SECONDS, onFailure: "continue",
  statusMessage: "Esperando você no escritório (ou responda aqui em instantes)",
});

// SessionStart runs a script instead of a plain HTTP post: it adds the repository root and the team's role names.
const sessionStartHook = { type: "command", command: `node "${join(hooksDir, SESSION_START_FILE)}"`, timeout: SESSION_START_TIMEOUT_SECONDS };

const OFFICE_GROUPS = [
  ["SessionStart", { hooks: [sessionStartHook] }],
  ...ACTIVITY_EVENTS.map((event) => [event, { hooks: [activityHook] }]),
  ["Stop", { hooks: [{ ...activityHook, url: `${OFFICE_URL}/hooks/claude/stop` }] }],
  ["PermissionRequest", { hooks: [decisionHook("/hooks/claude/permission")] }],
  ["PreToolUse", { matcher: "AskUserQuestion", hooks: [decisionHook("/hooks/claude/question")] }],
];

const remove = process.argv.includes("--remove");
const settingsPath = join(process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude"), "settings.json");
const statuslineCommand = `node "${join(hooksDir, STATUSLINE_FILE)}"`;

const isOfficeHttpHook = (hook) => hook?.type === "http" && /\/(events|hooks)\/claude(\/|$)/.test(String(hook.url ?? ""));
const isOfficeCommandHook = (hook) => hook?.type === "command" && String(hook.command ?? "").includes(SESSION_START_FILE);
const isOfficeHook = (hook) => isOfficeHttpHook(hook) || isOfficeCommandHook(hook);
const isOfficeGroup = (group) => Array.isArray(group?.hooks) && group.hooks.length > 0 && group.hooks.every(isOfficeHook);
const isOfficeStatusline = (statusLine) => String(statusLine?.command ?? "").includes(STATUSLINE_FILE);

function loadSettings() {
  if (!existsSync(settingsPath)) return {};
  let settings;
  try {
    settings = JSON.parse(readFileSync(settingsPath, "utf8"));
  } catch {
    console.error(`Could not read ${settingsPath} as JSON. Nothing was changed.`);
    process.exit(1);
  }
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
  copyFileSync(settingsPath, `${settingsPath}.bak-${stamp}`);
  console.log(`Backup: ${settingsPath}.bak-${stamp}`);
  return settings;
}

function withOfficeHooks(hooks) {
  const next = Object.fromEntries(Object.entries(hooks).map(([event, groups]) => [event, groups.filter((group) => !isOfficeGroup(group))]));
  if (!remove) {
    for (const [event, group] of OFFICE_GROUPS) next[event] = [...(next[event] ?? []), group];
  }
  return Object.fromEntries(Object.entries(next).filter(([, groups]) => groups.length > 0));
}

function withOfficeStatusline(settings) {
  const { statusLine, ...rest } = settings;
  if (statusLine && !isOfficeStatusline(statusLine)) {
    console.log("You already have a statusLine, so it was left alone. Usage limits, tokens and cost need the office statusline.");
    return settings;
  }
  return remove ? rest : { ...rest, statusLine: { type: "command", command: statuslineCommand } };
}

const settings = loadSettings();
const hooks = withOfficeHooks(settings.hooks ?? {});
const { hooks: previousHooks, ...withoutHooks } = settings;
const updated = withOfficeStatusline(Object.keys(hooks).length > 0 ? { ...withoutHooks, hooks } : withoutHooks);

mkdirSync(dirname(settingsPath), { recursive: true });
writeFileSync(settingsPath, `${JSON.stringify(updated, null, 2)}\n`);
console.log(remove
  ? `Office hooks removed from ${settingsPath}.`
  : `Office hooks installed in ${settingsPath}. New Claude Code sessions will show up at ${OFFICE_URL}.`);
