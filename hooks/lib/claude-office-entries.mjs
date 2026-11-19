import { DEFAULT_OFFICE_URL } from "./office-url.mjs";

export const STATUSLINE_FILE = "office-statusline.mjs";
export const SESSION_START_FILE = "office-session-start.mjs";
export const DECISION_FILE = "office-decision.mjs";
export const OFFICE_ROUTES = Object.freeze({
  activity: "/events/claude",
  stop: "/hooks/claude/stop",
  permission: "/hooks/claude/permission",
  question: "/hooks/claude/question",
});

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Before the manifest the scripts took no argument; the optional address is the one the installer writes since then.
const scriptCommandPattern = (file) => new RegExp(`^node "[^"]*[\\\\/]${escapeRegExp(file)}"( --office-url "[^"]*")?$`);
const SESSION_START_COMMAND = scriptCommandPattern(SESSION_START_FILE);
const STATUSLINE_COMMAND = scriptCommandPattern(STATUSLINE_FILE);
const DECISION_COMMAND = new RegExp(`^node "[^"]*[\\\\/]${escapeRegExp(DECISION_FILE)}" `);

const stringsIn = (list) => (Array.isArray(list) ? list.filter((item) => typeof item === "string") : []);
const execKeyOf = (command, args) => JSON.stringify([command, args]);
const execKeysIn = (list) => (Array.isArray(list) ? list.filter((item) => Array.isArray(item?.args)).map((item) => execKeyOf(item.command, item.args)) : []);

// Installs made before the manifest existed are recognized by the exact URL at this office or the default one.
const legacyUrls = (officeUrl) => [officeUrl, DEFAULT_OFFICE_URL].flatMap((origin) => Object.values(OFFICE_ROUTES).map((route) => `${origin}${route}`));
const legacyActivityUrls = (officeUrl) => new Set([officeUrl, DEFAULT_OFFICE_URL].map((origin) => `${origin}${OFFICE_ROUTES.activity}`));

export function officeMatcher({ officeUrl, recorded = {} }) {
  const urls = new Set([...stringsIn(recorded.urls), ...legacyUrls(officeUrl)]);
  const commands = new Set(stringsIn(recorded.commands));
  const execs = new Set(execKeysIn(recorded.execs));
  const activityUrls = legacyActivityUrls(officeUrl);
  // The file-name pattern only finds installs older than the manifest; once it records commands, a matching name is someone else's script.
  const isLegacy = !Array.isArray(recorded.commands);
  const isLegacyExec = !Array.isArray(recorded.execs);
  const isRecordedOr = (patterns, command) => typeof command === "string" && (commands.has(command) || (isLegacy && patterns.some((pattern) => pattern.test(command))));
  const isOfficeExec = (hook) => execs.has(execKeyOf(hook.command, hook.args)) || (isLegacyExec && activityUrls.has(hook.args.at(-1)));
  return {
    isOfficeHook(hook) {
      if (hook?.type === "http") return urls.has(hook.url);
      if (hook?.type !== "command") return false;
      if (Array.isArray(hook.args)) return isOfficeExec(hook);
      return isRecordedOr([SESSION_START_COMMAND, DECISION_COMMAND], hook.command);
    },
    isOfficeStatusline: (statusLine) => isRecordedOr([STATUSLINE_COMMAND], statusLine?.command),
    isHttpOfficeHook: (hook) => hook?.type === "http" && urls.has(hook.url),
  };
}
