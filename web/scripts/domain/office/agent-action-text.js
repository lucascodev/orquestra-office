import { AGENT_ACTIONS } from "../../data/text/pt-br/agent-actions.js";
import { ownValueOf } from "../shared/own-value.js";
import { fillPhrase } from "../text/fill-phrase.js";

function actionText(actionId, subject, sentText, phrases) {
  const phrase = actionId ? ownValueOf(phrases, actionId) : undefined;
  return phrase ? fillPhrase(phrase, { subject }) : (sentText ?? "");
}

export const agentActionText = ({ actionId, subject, action }, phrases = AGENT_ACTIONS) => actionText(actionId, subject, action, phrases);

export const logEntryText = ({ actionId, subject, text }, phrases = AGENT_ACTIONS) => actionText(actionId, subject, text, phrases);
