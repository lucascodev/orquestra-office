import { ANSWER_SEPARATOR, TERMINAL_NOTES } from "../../data/text/pt-br/terminal-notes.js";
import { ownValueOf } from "../shared/own-value.js";
import { fillPhrase } from "../text/fill-phrase.js";
import { toolSummaryText } from "./tool-summary-text.js";

export function terminalEntryText(entry) {
  const phrase = entry.textId ? ownValueOf(TERMINAL_NOTES, entry.textId) : undefined;
  if (!phrase) return entry.text ?? "";
  return fillPhrase(phrase, {
    subject: entry.subject,
    summary: toolSummaryText(entry),
    answers: (entry.answers ?? []).join(ANSWER_SEPARATOR),
  });
}
