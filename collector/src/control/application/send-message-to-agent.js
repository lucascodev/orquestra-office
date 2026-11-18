import { canReceiveMessages } from "../../office/domain/can-receive-messages.js";
import { OUTCOME } from "./outcome.js";

export function createSendMessageToAgent({ store, outbox, history, now = Date.now }) {
  return function sendMessageToAgent({ agentKey, text }) {
    const agent = store.findAgent(String(agentKey ?? ""));
    if (!agent || !canReceiveMessages(agent)) return OUTCOME.NOT_FOUND;
    if (!outbox.queue(agent.key, text)) return OUTCOME.INVALID;
    history.add(agent.key, { at: now(), kind: "message", text: String(text).trim(), detail: "" });
    return OUTCOME.DONE;
  };
}
