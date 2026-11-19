import { locationOf } from "./failure-fields.js";

const FRAME_PREFIX = "at ";
const FILE_LINE_COLUMN = /^(.+):(\d+):\d+$/;
const IGNORED_FRAME_PARTS = ["node_modules", "node:"];

function frameTargetOf(trimmed) {
  const body = trimmed.slice(FRAME_PREFIX.length);
  if (!body.endsWith(")")) return body;
  const open = body.lastIndexOf("(");
  return open < 0 ? body : body.slice(open + 1, -1);
}

// Reads "at fn (file:line:col)" or "at file:line:col"; frames from dependencies and Node itself say nothing about the test.
export function stackFrameLocationOf(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith(FRAME_PREFIX)) return null;
  const match = FILE_LINE_COLUMN.exec(frameTargetOf(trimmed));
  if (!match || IGNORED_FRAME_PARTS.some((part) => match[1].includes(part))) return null;
  return locationOf(match[1], match[2]);
}
