import { QUESTION_INTENT, REQUEST_INTENTS, TOOL_INTENT } from "../../data/text/pt-br/request-intents.js";
import { ownValueOf } from "../shared/own-value.js";
import { fillPhrase } from "../text/fill-phrase.js";

const QUESTION = "question";

// What the agent wants, said after its name: "Vitor quer rodar um comando".
export function requestIntentText({ kind, summaryId, subject = null, toolName = null }) {
  const phrase = summaryId ? ownValueOf(REQUEST_INTENTS, summaryId) : undefined;
  if (phrase) return fillPhrase(phrase, { subject });
  if (kind === QUESTION) return QUESTION_INTENT;
  return fillPhrase(TOOL_INTENT, { subject: toolName });
}
