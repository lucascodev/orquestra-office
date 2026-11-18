import { TOOL_SUMMARIES } from "../../data/text/pt-br/tool-summaries.js";
import { ownValueOf } from "../shared/own-value.js";
import { clipText } from "../text/clip-text.js";
import { fillPhrase } from "../text/fill-phrase.js";

const SUMMARY_LIMIT = 160;

export function toolSummaryText({ summaryId, subject, summary }, phrases = TOOL_SUMMARIES) {
  const phrase = summaryId ? ownValueOf(phrases, summaryId) : undefined;
  return phrase ? clipText(fillPhrase(phrase, { subject }), SUMMARY_LIMIT) : (summary ?? "");
}
