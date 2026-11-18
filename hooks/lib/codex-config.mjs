import { DEFAULT_OFFICE_URL } from "./office-url.mjs";

const NOTIFY_MAX_SECONDS = "3";
const OFFICE_NOTIFY_PATH = "/events/codex";
const TABLE_HEADER = /^\s*\[/;
const ANY_NOTIFY_KEY = /^\s*(notify|"notify"|'notify')\s*=/;
const BARE_NOTIFY_VALUE = /^\s*notify\s*=\s*(.*?)\s*$/;
// curl honors HTTP_PROXY and friends: without --noproxy a proxy would see every Codex turn on its way to the office.
const SKIP_PROXY = ["--noproxy", "*"];

const notifyCommand = (officeUrl, proxyFlags) => [
  "curl", "-s", ...proxyFlags, "-m", NOTIFY_MAX_SECONDS, "-X", "POST", "-H", "Content-Type: application/json", `${officeUrl}${OFFICE_NOTIFY_PATH}`, "--data-raw",
];

export const officeNotifyCommand = (officeUrl) => notifyCommand(officeUrl, SKIP_PROXY);

export const officeNotifyLine = (officeUrl) => `notify = [${officeNotifyCommand(officeUrl).map((part) => JSON.stringify(part)).join(", ")}]`;

export const officeNotifyEntries = ({ officeUrl }) => ({ notify: [officeNotifyCommand(officeUrl)] });

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

// Installs made before the manifest existed are recognized by the exact command, with or without --noproxy, at this office or the default one.
const legacyCommands = (officeUrl) => [officeUrl, DEFAULT_OFFICE_URL].flatMap((origin) => [notifyCommand(origin, []), notifyCommand(origin, SKIP_PROXY)]);

function isOfficeNotify(line, { officeUrl, recorded = {} }) {
  const [, valueText] = BARE_NOTIFY_VALUE.exec(line) ?? [];
  const command = valueText === undefined ? null : parseArray(valueText);
  if (!command) return false;
  const known = [...(Array.isArray(recorded.notify) ? recorded.notify : []), ...legacyCommands(officeUrl)];
  return known.some((candidate) => JSON.stringify(candidate) === JSON.stringify(command));
}

// notify is a root key: the same name inside a [table] is a different setting and stays untouched.
function rootNotifyIndex(lines) {
  const firstTable = lines.findIndex((line) => TABLE_HEADER.test(line));
  const rootEnd = firstTable === -1 ? lines.length : firstTable;
  return lines.slice(0, rootEnd).findIndex((line) => ANY_NOTIFY_KEY.test(line));
}

export function applyNotify(lines, { isRemoving, officeUrl, recorded }) {
  const notifyIndex = rootNotifyIndex(lines);
  if (notifyIndex !== -1 && !isOfficeNotify(lines[notifyIndex], { officeUrl, recorded })) return { foreignNotifyLine: lines[notifyIndex] };
  const withoutOfficeNotify = notifyIndex === -1 ? [...lines] : lines.toSpliced(notifyIndex, 1);
  return { lines: isRemoving ? withoutOfficeNotify : [officeNotifyLine(officeUrl), ...withoutOfficeNotify] };
}
