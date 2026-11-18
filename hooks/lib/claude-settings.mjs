import { join } from "node:path";

export const STATUSLINE_FILE = "office-statusline.mjs";
export const SESSION_START_FILE = "office-session-start.mjs";

const ACTIVITY_TIMEOUT_SECONDS = 3;
const DECISION_TIMEOUT_SECONDS = 150;
const SESSION_START_TIMEOUT_SECONDS = 5;
const DECISION_STATUS_MESSAGE = "Esperando você no escritório (ou responda aqui em instantes)";
const ACTIVITY_EVENTS = [
  "UserPromptSubmit", "PreToolUse", "PostToolUse", "PostToolUseFailure",
  "Notification", "StopFailure", "SubagentStart", "SubagentStop", "SessionEnd",
];
const OFFICE_HTTP_PATH = /\/(events|hooks)\/claude(\/|$)/;

const scriptCommand = (hooksDir, file) => `node "${join(hooksDir, file)}"`;

function officeGroups({ officeUrl, hooksDir }) {
  const activityHook = { type: "http", url: `${officeUrl}/events/claude`, timeout: ACTIVITY_TIMEOUT_SECONDS, onFailure: "continue" };
  const decisionHook = (path) => ({
    type: "http", url: `${officeUrl}${path}`, timeout: DECISION_TIMEOUT_SECONDS, onFailure: "continue", statusMessage: DECISION_STATUS_MESSAGE,
  });
  // SessionStart runs a script instead of a plain HTTP post: it adds the repository root and the team's role names.
  const sessionStartHook = { type: "command", command: scriptCommand(hooksDir, SESSION_START_FILE), timeout: SESSION_START_TIMEOUT_SECONDS };
  return [
    ["SessionStart", { hooks: [sessionStartHook] }],
    ...ACTIVITY_EVENTS.map((event) => [event, { hooks: [activityHook] }]),
    ["Stop", { hooks: [{ ...activityHook, url: `${officeUrl}/hooks/claude/stop` }] }],
    ["PermissionRequest", { hooks: [decisionHook("/hooks/claude/permission")] }],
    ["PreToolUse", { matcher: "AskUserQuestion", hooks: [decisionHook("/hooks/claude/question")] }],
  ];
}

// Office entries are recognized by URL path and script file name, so entries written from another folder or office URL are replaced too.
const isOfficeHttpHook = (hook) => hook?.type === "http" && OFFICE_HTTP_PATH.test(String(hook.url ?? ""));
const isOfficeCommandHook = (hook) => hook?.type === "command" && String(hook.command ?? "").includes(SESSION_START_FILE);
const isOfficeHook = (hook) => isOfficeHttpHook(hook) || isOfficeCommandHook(hook);
const isOfficeGroup = (group) => Array.isArray(group?.hooks) && group.hooks.length > 0 && group.hooks.every(isOfficeHook);
const isOfficeStatusline = (statusLine) => String(statusLine?.command ?? "").includes(STATUSLINE_FILE);

export const isForeignStatusline = (statusLine) => Boolean(statusLine) && !isOfficeStatusline(statusLine);

export function withOfficeHooks(hooks, { isRemoving, officeUrl, hooksDir }) {
  const next = Object.fromEntries(Object.entries(hooks).map(([event, groups]) => [event, groups.filter((group) => !isOfficeGroup(group))]));
  if (!isRemoving) {
    for (const [event, group] of officeGroups({ officeUrl, hooksDir })) next[event] = [...(next[event] ?? []), group];
  }
  return Object.fromEntries(Object.entries(next).filter(([, groups]) => groups.length > 0));
}

export function withOfficeStatusline(settings, { isRemoving, hooksDir }) {
  const { statusLine, ...rest } = settings;
  if (isForeignStatusline(statusLine)) return settings;
  return isRemoving ? rest : { ...rest, statusLine: { type: "command", command: scriptCommand(hooksDir, STATUSLINE_FILE) } };
}

export function withOfficeSettings(settings, options) {
  const hooks = withOfficeHooks(settings.hooks ?? {}, options);
  const withoutHooks = Object.fromEntries(Object.entries(settings).filter(([key]) => key !== "hooks"));
  return withOfficeStatusline(Object.keys(hooks).length > 0 ? { ...withoutHooks, hooks } : withoutHooks, options);
}
