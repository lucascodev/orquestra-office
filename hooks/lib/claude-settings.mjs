import { join } from "node:path";
import { OFFICE_ROUTES, SESSION_START_FILE, STATUSLINE_FILE, officeMatcher } from "./claude-office-entries.mjs";

const ACTIVITY_TIMEOUT_SECONDS = 3;
const DECISION_TIMEOUT_SECONDS = 150;
const SESSION_START_TIMEOUT_SECONDS = 5;
const DECISION_STATUS_MESSAGE = "Esperando você no escritório (ou responda aqui em instantes)";
const ACTIVITY_EVENTS = [
  "UserPromptSubmit", "PreToolUse", "PostToolUse", "PostToolUseFailure",
  "Notification", "StopFailure", "SubagentStart", "SubagentStop", "SessionEnd",
];

const scriptCommand = (hooksDir, file) => `node "${join(hooksDir, file)}"`;

function officeGroups({ officeUrl, hooksDir }) {
  const activityHook = { type: "http", url: `${officeUrl}${OFFICE_ROUTES.activity}`, timeout: ACTIVITY_TIMEOUT_SECONDS, onFailure: "continue" };
  const decisionHook = (route) => ({
    type: "http", url: `${officeUrl}${route}`, timeout: DECISION_TIMEOUT_SECONDS, onFailure: "continue", statusMessage: DECISION_STATUS_MESSAGE,
  });
  // SessionStart runs a script instead of a plain HTTP post: it adds the repository root and the team's role names.
  const sessionStartHook = { type: "command", command: scriptCommand(hooksDir, SESSION_START_FILE), timeout: SESSION_START_TIMEOUT_SECONDS };
  return [
    ["SessionStart", { hooks: [sessionStartHook] }],
    ...ACTIVITY_EVENTS.map((event) => [event, { hooks: [activityHook] }]),
    ["Stop", { hooks: [{ ...activityHook, url: `${officeUrl}${OFFICE_ROUTES.stop}` }] }],
    ["PermissionRequest", { hooks: [decisionHook(OFFICE_ROUTES.permission)] }],
    ["PreToolUse", { matcher: "AskUserQuestion", hooks: [decisionHook(OFFICE_ROUTES.question)] }],
  ];
}

const officeStatusline = (hooksDir) => ({ type: "command", command: scriptCommand(hooksDir, STATUSLINE_FILE) });

export function officeEntries({ officeUrl, hooksDir }) {
  const hooks = officeGroups({ officeUrl, hooksDir }).flatMap(([, group]) => group.hooks);
  return {
    urls: [...new Set(hooks.filter((hook) => hook.type === "http").map((hook) => hook.url))],
    commands: [...hooks.filter((hook) => hook.type === "command").map((hook) => hook.command), officeStatusline(hooksDir).command],
  };
}

const isOfficeGroup = (group, matcher) => Array.isArray(group?.hooks) && group.hooks.length > 0 && group.hooks.every(matcher.isOfficeHook);

export const isForeignStatusline = (statusLine, options) => Boolean(statusLine) && !officeMatcher(options).isOfficeStatusline(statusLine);

export function withOfficeHooks(hooks, { isRemoving, officeUrl, hooksDir, recorded }) {
  const matcher = officeMatcher({ officeUrl, recorded });
  const next = Object.fromEntries(Object.entries(hooks).map(([event, groups]) => [event, groups.filter((group) => !isOfficeGroup(group, matcher))]));
  if (!isRemoving) {
    for (const [event, group] of officeGroups({ officeUrl, hooksDir })) next[event] = [...(next[event] ?? []), group];
  }
  return Object.fromEntries(Object.entries(next).filter(([, groups]) => groups.length > 0));
}

export function withOfficeStatusline(settings, options) {
  const { statusLine, ...rest } = settings;
  if (isForeignStatusline(statusLine, options)) return settings;
  return options.isRemoving ? rest : { ...rest, statusLine: officeStatusline(options.hooksDir) };
}

export function withOfficeSettings(settings, options) {
  const hooks = withOfficeHooks(settings.hooks ?? {}, options);
  const withoutHooks = Object.fromEntries(Object.entries(settings).filter(([key]) => key !== "hooks"));
  return withOfficeStatusline(Object.keys(hooks).length > 0 ? { ...withoutHooks, hooks } : withoutHooks, options);
}
