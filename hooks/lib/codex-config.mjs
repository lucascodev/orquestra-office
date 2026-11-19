import { chainedNotifyCommand, isChainedNotifyCommand, previousNotifyOf } from "./codex-chain.mjs";
import { DEFAULT_OFFICE_URL } from "./office-url.mjs";

const NOTIFY_MAX_SECONDS = "3";
const OFFICE_NOTIFY_PATH = "/events/codex";
const TABLE_HEADER = /^\s*\[/;
const ANY_NOTIFY_KEY = /^\s*(notify|"notify"|'notify')\s*=/;
const BARE_NOTIFY_VALUE = /^\s*notify\s*=\s*(.*?)\s*$/;
// curl honors HTTP_PROXY and friends: without --noproxy a proxy would see every Codex turn on its way to the office.
const SKIP_PROXY = ["--noproxy", "*"];
const CURL_PROGRAM = /(^|[\\/])curl(\.exe)?$/i;
const HEADER_FILE_ARGUMENT = /^@.*[\\/]\.orquestra-office[\\/]activity\.header$/;

const legacyNotifyCommand = (officeUrl, proxyFlags) => [
  "curl", "-s", ...proxyFlags, "-m", NOTIFY_MAX_SECONDS, "-X", "POST", "-H", "Content-Type: application/json", `${officeUrl}${OFFICE_NOTIFY_PATH}`, "--data-raw",
];

// Codex appends the turn as the last argument, after --data-raw. As in the Claude Code activity hooks, the token comes from
// the header file and the answer goes to the null device.
export const officeNotifyCommand = ({ officeUrl, curlPath, nullDevice, activityHeaderFile }) => [
  curlPath, "-s", ...SKIP_PROXY, "-m", NOTIFY_MAX_SECONDS, "-o", nullDevice, "-H", `@${activityHeaderFile}`,
  "-X", "POST", "-H", "Content-Type: application/json", `${officeUrl}${OFFICE_NOTIFY_PATH}`, "--data-raw",
];

const notifyLineOf = (command) => `notify = [${command.map((part) => JSON.stringify(part)).join(", ")}]`;

export const officeNotifyLine = (options) => notifyLineOf(officeNotifyCommand(options));

export const notifyEntriesOf = (command) => ({ notify: [command] });

export const configLines = (text) => text.split(/\r?\n/);

export const configText = (lines) => `${lines.join("\n").replace(/\n+$/, "")}\n`;

const parseArray = (text) => {
  try {
    const value = JSON.parse(text);
    return Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
};

// Installs made before the manifest or the token existed are recognized by the exact command, with or without --noproxy,
// at this office or the default one.
const legacyCommands = (officeUrl) => [officeUrl, DEFAULT_OFFICE_URL].flatMap((origin) => [legacyNotifyCommand(origin, []), legacyNotifyCommand(origin, SKIP_PROXY)]);

// Without the manifest, a token-era notify is still the office's when it is curl, reads the office header file and posts to the office.
function isUnrecordedTokenNotify(command, officeUrl) {
  if (!CURL_PROGRAM.test(String(command[0])) || !command.some((part) => HEADER_FILE_ARGUMENT.test(String(part)))) return false;
  const [url, lastFlag] = command.slice(-2);
  return lastFlag === "--data-raw" && [officeUrl, DEFAULT_OFFICE_URL].some((origin) => url === `${origin}${OFFICE_NOTIFY_PATH}`);
}

const isStringCommand = (command) => Array.isArray(command) && command.length > 0 && command.every((part) => typeof part === "string");

function notifyCommandOf(line) {
  const [, valueText] = BARE_NOTIFY_VALUE.exec(line) ?? [];
  return valueText === undefined ? null : parseArray(valueText);
}

function isOfficeNotify(command, { officeUrl, recorded = {} }) {
  const known = [...(Array.isArray(recorded.notify) ? recorded.notify : []), ...legacyCommands(officeUrl)];
  if (known.some((candidate) => JSON.stringify(candidate) === JSON.stringify(command))) return true;
  return !Array.isArray(recorded.notify) && (isUnrecordedTokenNotify(command, officeUrl) || isChainedNotifyCommand(command));
}

// notify is a root key: the same name inside a [table] is a different setting and stays untouched.
function rootNotifyIndex(lines) {
  const firstTable = lines.findIndex((line) => TABLE_HEADER.test(line));
  const rootEnd = firstTable === -1 ? lines.length : firstTable;
  return lines.slice(0, rootEnd).findIndex((line) => ANY_NOTIFY_KEY.test(line));
}

// Someone else's notify is kept and runs after the office's; only a single-line array of strings can be chained safely.
export function applyNotify(lines, options) {
  const notifyIndex = rootNotifyIndex(lines);
  const current = notifyIndex === -1 ? null : notifyCommandOf(lines[notifyIndex]);
  const isOffice = current !== null && isOfficeNotify(current, options);
  if (notifyIndex !== -1 && !isOffice && (options.isRemoving || !isStringCommand(current))) return { foreignNotifyLine: lines[notifyIndex] };
  const previous = notifyIndex === -1 ? [] : isOffice ? previousNotifyOf(current) : current;
  const rest = notifyIndex === -1 ? [...lines] : lines.toSpliced(notifyIndex, 1);
  if (options.isRemoving) return { lines: previous.length > 0 ? [notifyLineOf(previous), ...rest] : rest, previous };
  const command = previous.length > 0 ? chainedNotifyCommand(options, previous) : officeNotifyCommand(options);
  return { lines: [notifyLineOf(command), ...rest], command, previous };
}
