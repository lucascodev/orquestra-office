const CONTROL_AND_BIDI = /[\u0000-\u001F\u007F-\u009F‪-‮⁦-⁩]/g;
const CONTROL_AND_BIDI_BUT_TAB_AND_NEWLINE = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F‪-‮⁦-⁩]/g;
const LINE_BREAKS_AND_TABS = /[\t\r\n]+/g;
const WINDOWS_LINE_BREAK = /\r\n?/g;
// A code point takes at most two UTF-16 units, so this much of the input always holds the code points that are kept.
const UNITS_PER_CODE_POINT = 2;

function cutByCodePoint(text, limit) {
  if (text.length <= limit) return text;
  return Array.from(text).slice(0, limit).join("");
}

const headOf = (value, limit) => (typeof value === "string" ? value.slice(0, limit * UNITS_PER_CODE_POINT) : "");

export function lineOf(value, limit) {
  const clean = headOf(value, limit).replace(LINE_BREAKS_AND_TABS, " ").replace(CONTROL_AND_BIDI, "").trim();
  return cutByCodePoint(clean, limit);
}

export function textBlockOf(value, limit) {
  const clean = headOf(value, limit).replace(WINDOWS_LINE_BREAK, "\n").replace(CONTROL_AND_BIDI_BUT_TAB_AND_NEWLINE, "");
  return cutByCodePoint(clean, limit);
}
