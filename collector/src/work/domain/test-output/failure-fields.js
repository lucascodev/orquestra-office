import { FAILURE_FIELD_LIMIT } from "./limits.js";

// C0 and C1 controls, plus the bidi overrides and isolates that can make a file name read backwards on screen.
const UNSAFE_CODE_POINT_RANGES = Object.freeze([
  [0x0000, 0x001f],
  [0x007f, 0x009f],
  [0x202a, 0x202e],
  [0x2066, 0x2069],
]);
const ELLIPSIS = "…";

const isSafe = (character) => {
  const codePoint = character.codePointAt(0);
  return !UNSAFE_CODE_POINT_RANGES.some(([first, last]) => codePoint >= first && codePoint <= last);
};

function fieldOf(value) {
  if (typeof value !== "string") return null;
  const codePoints = Array.from(value.toWellFormed()).filter(isSafe);
  const text = codePoints.join("").trim();
  if (!text) return null;
  const kept = Array.from(text);
  if (kept.length <= FAILURE_FIELD_LIMIT) return text;
  return `${kept.slice(0, FAILURE_FIELD_LIMIT - ELLIPSIS.length).join("")}${ELLIPSIS}`;
}

export function publicFailureOf(failure) {
  const name = fieldOf(failure?.name);
  if (!name) return null;
  return { name, location: fieldOf(failure.location), message: fieldOf(failure.message) };
}

export function locationOf(file, line = null) {
  if (!file) return null;
  return line ? `${file}:${line}` : file;
}
