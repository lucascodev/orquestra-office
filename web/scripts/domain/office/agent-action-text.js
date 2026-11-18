import { AGENT_ACTIONS } from "../../data/text/pt-br/agent-actions.js";
import { ownValueOf } from "../shared/own-value.js";
import { fillPhrase } from "../text/fill-phrase.js";

function actionText(actionId, subject, sentText) {
  const phrase = actionId ? ownValueOf(AGENT_ACTIONS, actionId) : undefined;
  return phrase ? fillPhrase(phrase, { subject }) : (sentText ?? "");
}

export const agentActionText = ({ actionId, subject, action }) => actionText(actionId, subject, action);

export const logEntryText = ({ actionId, subject, text }) => actionText(actionId, subject, text);
