import { DEFAULT_OFFICE_URL } from "./office-url.mjs";

export const STATUSLINE_FILE = "office-statusline.mjs";
export const SESSION_START_FILE = "office-session-start.mjs";
export const OFFICE_ROUTES = Object.freeze({
  activity: "/events/claude",
  stop: "/hooks/claude/stop",
  permission: "/hooks/claude/permission",
  question: "/hooks/claude/question",
});

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const scriptCommandPattern = (file) => new RegExp(`^node "[^"]*[\\\\/]${escapeRegExp(file)}"$`);
const SESSION_START_COMMAND = scriptCommandPattern(SESSION_START_FILE);
const STATUSLINE_COMMAND = scriptCommandPattern(STATUSLINE_FILE);

const stringsIn = (list) => (Array.isArray(list) ? list.filter((item) => typeof item === "string") : []);

// Installs made before the manifest existed are recognized by the exact URL at this office or the default one.
const legacyUrls = (officeUrl) => [officeUrl, DEFAULT_OFFICE_URL].flatMap((origin) => Object.values(OFFICE_ROUTES).map((route) => `${origin}${route}`));

export function officeMatcher({ officeUrl, recorded = {} }) {
  const urls = new Set([...stringsIn(recorded.urls), ...legacyUrls(officeUrl)]);
  const commands = new Set(stringsIn(recorded.commands));
  // The file-name pattern only finds installs older than the manifest; once it records commands, a matching name is someone else's script.
  const isLegacy = !Array.isArray(recorded.commands);
  const isRecordedOr = (pattern, command) => typeof command === "string" && (commands.has(command) || (isLegacy && pattern.test(command)));
  return {
    isOfficeHook: (hook) => (hook?.type === "http" && urls.has(hook.url)) || (hook?.type === "command" && isRecordedOr(SESSION_START_COMMAND, hook.command)),
    isOfficeStatusline: (statusLine) => isRecordedOr(STATUSLINE_COMMAND, statusLine?.command),
  };
}
