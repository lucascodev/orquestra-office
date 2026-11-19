import { workIdOf } from "../../work/domain/values/work-id.js";

const TEXT_LIMIT = 1024;
const TEXT_FIELDS = ["message", "content", "text", "result"];
const ID_DIGITS_LIMIT = 9;

const isDigit = (char) => char >= "0" && char <= "9";

function digitsFrom(text, start) {
  let end = start;
  while (end < text.length && isDigit(text[end]) && end - start < ID_DIGITS_LIMIT) end += 1;
  return end > start ? text.slice(start, end) : null;
}

// "Task #9 created" names its id after the "#"; without one, the first number in the text is the id.
function idInText(text) {
  if (typeof text !== "string" || text.length > TEXT_LIMIT) return null;
  const hash = text.indexOf("#");
  const afterHash = hash >= 0 ? digitsFrom(text, hash + 1) : null;
  if (afterHash) return afterHash;
  let firstDigit = 0;
  while (firstDigit < text.length && !isDigit(text[firstDigit])) firstDigit += 1;
  return digitsFrom(text, firstDigit);
}

function idInObject(response) {
  const known = [response.task?.id, response.taskId, response.task_id, response.id].map(workIdOf).find(Boolean);
  if (known) return known;
  return TEXT_FIELDS.map((field) => idInText(response[field])).find(Boolean) ?? null;
}

export function taskIdOf(response) {
  if (response !== null && typeof response === "object") return idInObject(response);
  return idInText(response);
}
