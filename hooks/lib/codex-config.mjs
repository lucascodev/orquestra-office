const NOTIFY_MAX_SECONDS = "3";
const TABLE_HEADER = /^\s*\[/;
const NOTIFY_KEY = /^\s*notify\s*=/;
const OFFICE_NOTIFY_PATH = "/events/codex";

export function officeNotifyLine(officeUrl) {
  const command = ["curl", "-s", "-m", NOTIFY_MAX_SECONDS, "-X", "POST", "-H", "Content-Type: application/json", `${officeUrl}${OFFICE_NOTIFY_PATH}`, "--data-raw"];
  return `notify = ${JSON.stringify(command).replace(/,/g, ", ")}`;
}

export const configLines = (text) => text.split(/\r?\n/);

export const configText = (lines) => `${lines.join("\n").replace(/\n+$/, "")}\n`;

// notify is a root key: the same name inside a [table] is a different setting and stays untouched.
function rootNotifyIndex(lines) {
  const firstTable = lines.findIndex((line) => TABLE_HEADER.test(line));
  const rootEnd = firstTable === -1 ? lines.length : firstTable;
  return lines.slice(0, rootEnd).findIndex((line) => NOTIFY_KEY.test(line));
}

export function applyNotify(lines, { isRemoving, officeUrl }) {
  const notifyIndex = rootNotifyIndex(lines);
  if (notifyIndex !== -1 && !lines[notifyIndex].includes(OFFICE_NOTIFY_PATH)) return { foreignNotifyLine: lines[notifyIndex] };
  const withoutOfficeNotify = notifyIndex === -1 ? [...lines] : lines.toSpliced(notifyIndex, 1);
  return { lines: isRemoving ? withoutOfficeNotify : [officeNotifyLine(officeUrl), ...withoutOfficeNotify] };
}
