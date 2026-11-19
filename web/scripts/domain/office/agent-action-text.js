import { AGENT_ACTIONS } from "../../data/text/pt-br/agent-actions.js";
import { countOf } from "../shared/field-values.js";
import { ownValueOf } from "../shared/own-value.js";
import { countPhrase } from "../text/count-phrase.js";
import { fillPhrase } from "../text/fill-phrase.js";

const subjectPhrase = (phrase, subject) => fillPhrase(phrase, { subject });
const countedPhrase = (phrase, subject) => countPhrase(phrase, countOf(subject));

// Most actions put their subject in the phrase as it came; a test result counts it, so "1 falhou" never reads "1 falharam".
const PHRASE_WRITERS = {
  "tests-passed": countedPhrase,
  "tests-failed": countedPhrase,
};

function actionText(actionId, subject, sentText) {
  const phrase = actionId ? ownValueOf(AGENT_ACTIONS, actionId) : undefined;
  if (!phrase) return sentText ?? "";
  const write = ownValueOf(PHRASE_WRITERS, actionId) ?? subjectPhrase;
  return write(phrase, subject);
}

export const agentActionText = ({ actionId, subject, action }) => actionText(actionId, subject, action);

export const logEntryText = ({ actionId, subject, text }) => actionText(actionId, subject, text);
