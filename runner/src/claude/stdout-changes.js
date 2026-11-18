import { lineReader, parseEvent } from "./json-lines.js";
import { changesOf } from "./stream-changes.js";

export function stdoutChanges(onChange) {
  return lineReader((line) => {
    const event = parseEvent(line);
    if (!event) return;
    for (const change of changesOf(event)) onChange(change);
  });
}
