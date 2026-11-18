import { decisionAnswerOf, INVALID_ANSWER } from "../control/domain/decision-answer.js";
import { canReceiveMessages } from "../office/domain/can-receive-messages.js";

export function createOfficeApi({ store, decisions, outbox, history }) {
  function decide(id, body) {
    const request = decisions.get(id);
    if (!request) return 404;
    const answer = decisionAnswerOf(request, body ?? {});
    if (answer === INVALID_ANSWER) return 400;
    decisions.settle(id, answer);
    return 200;
  }

  function sendMessage(body) {
    const agent = store.findAgent(String(body?.key ?? ""));
    if (!agent || !canReceiveMessages(agent)) return 404;
    if (!outbox.queue(agent.key, body.text)) return 400;
    history.add(agent.key, { at: Date.now(), kind: "message", text: String(body.text).trim(), detail: "" });
    return 200;
  }

  return { decide, sendMessage, historyOf: (agentKey) => history.of(agentKey) };
}
