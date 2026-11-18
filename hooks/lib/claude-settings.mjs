import { join } from "node:path";
import { DECISION_FILE, OFFICE_ROUTES, SESSION_START_FILE, STATUSLINE_FILE, officeMatcher } from "./claude-office-entries.mjs";
import { curlPostArgs } from "./curl.mjs";

const DECISION_TIMEOUT_SECONDS = 150;
const STOP_TIMEOUT_SECONDS = 5;
const SESSION_END_TIMEOUT_SECONDS = 2;
const SESSION_START_TIMEOUT_SECONDS = 5;
const DECISION_STATUS_MESSAGE = "Esperando você no escritório (ou responda aqui em instantes)";
const BACKGROUND_ACTIVITY_EVENTS = [
  "UserPromptSubmit", "PreToolUse", "PostToolUse", "PostToolUseFailure",
  "Notification", "StopFailure", "SubagentStart", "SubagentStop",
];

const scriptCommand = (hooksDir, file) => `node "${join(hooksDir, file)}"`;

// The office address and the secret path go into the command itself: the decision script reads nothing from the environment.
const decisionCommand = ({ hooksDir, officeUrl, secretFile }) => `${scriptCommand(hooksDir, DECISION_FILE)} --office-url "${officeUrl}" --secret-file "${secretFile}"`;

function officeGroups({ officeUrl, hooksDir, curlPath, nullDevice, secretFile, activityHeaderFile }) {
  const activityArgs = curlPostArgs({ url: `${officeUrl}${OFFICE_ROUTES.activity}`, nullDevice, activityHeaderFile });
  // Background hooks never hold up a tool call, and curl in exec form costs a fraction of a node process (ADR 0002, S.0).
  const backgroundActivityHook = { type: "command", command: curlPath, args: activityArgs, async: true };
  // SessionEnd stays in the foreground: with -p, Claude Code kills background hooks when the session ends.
  const sessionEndHook = { type: "command", command: curlPath, args: activityArgs, timeout: SESSION_END_TIMEOUT_SECONDS, onFailure: "continue" };
  const command = decisionCommand({ hooksDir, officeUrl, secretFile });
  const decisionHook = { type: "command", command, timeout: DECISION_TIMEOUT_SECONDS, onFailure: "continue", statusMessage: DECISION_STATUS_MESSAGE };
  // SessionStart runs a script: it adds the repository root and the team's role names.
  const sessionStartHook = { type: "command", command: scriptCommand(hooksDir, SESSION_START_FILE), timeout: SESSION_START_TIMEOUT_SECONDS };
  return [
    ["SessionStart", { hooks: [sessionStartHook] }],
    ...BACKGROUND_ACTIVITY_EVENTS.map((event) => [event, { hooks: [backgroundActivityHook] }]),
    ["SessionEnd", { hooks: [sessionEndHook] }],
    ["Stop", { hooks: [{ type: "command", command, timeout: STOP_TIMEOUT_SECONDS }] }],
    ["PermissionRequest", { hooks: [decisionHook] }],
    ["PreToolUse", { matcher: "AskUserQuestion", hooks: [decisionHook] }],
  ];
}

const officeStatusline = (hooksDir) => ({ type: "command", command: scriptCommand(hooksDir, STATUSLINE_FILE) });

const uniqueBy = (items, keyOf) => [...new Map(items.map((item) => [keyOf(item), item])).values()];

export function officeEntries(options) {
  const hooks = officeGroups(options).flatMap(([, group]) => group.hooks).filter((hook) => hook.type === "command");
  const execs = hooks.filter((hook) => Array.isArray(hook.args)).map(({ command, args }) => ({ command, args }));
  return {
    commands: [...new Set([...hooks.filter((hook) => !hook.args).map((hook) => hook.command), officeStatusline(options.hooksDir).command])],
    execs: uniqueBy(execs, (exec) => JSON.stringify(exec)),
  };
}

const isOfficeGroup = (group, matcher) => Array.isArray(group?.hooks) && group.hooks.length > 0 && group.hooks.every(matcher.isOfficeHook);

export const isForeignStatusline = (statusLine, options) => Boolean(statusLine) && !officeMatcher(options).isOfficeStatusline(statusLine);

export function hasHttpOfficeHooks(settings, { officeUrl, recorded }) {
  const matcher = officeMatcher({ officeUrl, recorded });
  return Object.values(settings.hooks ?? {}).flat().some((group) => Array.isArray(group?.hooks) && group.hooks.some(matcher.isHttpOfficeHook));
}

export function withOfficeHooks(hooks, options) {
  const matcher = officeMatcher(options);
  const next = Object.fromEntries(Object.entries(hooks).map(([event, groups]) => [event, groups.filter((group) => !isOfficeGroup(group, matcher))]));
  if (!options.isRemoving) {
    for (const [event, group] of officeGroups(options)) next[event] = [...(next[event] ?? []), group];
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
