import { cleanTextBlockOf } from "./values/clean-text.js";

export const PLAN_TEXT_LIMIT = 20_000;

function codePointCountOver(text, limit) {
  let count = 0;
  for (const _ of text) {
    count += 1;
    if (count > limit) return true;
  }
  return false;
}

// length is the size of the plan as the agent wrote it, in JavaScript characters, so the page can say how much was cut.
export function planTextOf(written) {
  if (typeof written !== "string") return null;
  const text = cleanTextBlockOf(written, PLAN_TEXT_LIMIT);
  if (!text.trim()) return null;
  return { text, length: written.length, isTruncated: codePointCountOver(written, PLAN_TEXT_LIMIT) };
}
